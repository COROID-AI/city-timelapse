import * as THREE from 'three'
import type { EraId, SfxEraData } from '../eras'
import { ERA_IDS, SFX_ERA_DATA } from '../eras'
import { generateAllEraBuffers, type EraAudioBuffers } from './sfx'

/**
 * Era-aware Web Audio mixer.
 *
 * Design:
 * - The AudioContext is created lazily on the first user gesture (click or
 *   keypress) and stays suspended until then, so there is no autoplay attempt
 *   and no browser autoplay warning. `unlockOnGesture()` must be called from a
 *   real user gesture handler (the visible mute/unmute toggle click).
 * - Each era owns a small channel strip (ambient bed, traffic loop, event
 *   one-shots, music bus). `setEra()` crossfades the strips with exponential
 *   gain ramps over a bounded window (~1.5s), never a jump.
 * - The positional listener is updated from the camera every frame via
 *   `updateListener(camera)`. When the listener is not updated (headless/CI),
 *   the mixer degrades gracefully: the context may be absent or suspended and
 *   every audio call is a no-op.
 *
 * No environment is required to call `dispose()`; the class never throws when
 * Web Audio is unavailable.
 */

export interface SfxMixerOptions {
  /** Crossfade duration in seconds between era ambience layers. */
  crossfadeSeconds?: number
  /** Master volume scale applied to all channels (0..1). */
  volume?: number
  /**
   * Ambient-level background gain for the current era (0..1). The mixer uses
   * this as the steady-state level of the ambience bus; the actual per-layer
   * gains come from SfxEraData so the crossfade math stays data-driven.
   */
  ambienceGain?: number
  /** Optional AudioContext factory for tests / headless environments. */
  contextFactory?: () => AudioContext | null
}

export interface SfxMixerState {
  /** Whether the context has been created and resumed by a user gesture. */
  enabled: boolean
  /** Whether the user has muted the mix. */
  muted: boolean
  /** Current era id (or null before any setEra call). */
  currentEra: EraId | null
  /** True while a crossfade is in progress. */
  crossfading: boolean
  /** Remaining crossfade time in seconds (0 when idle). */
  crossfadeRemaining: number
  /** Whether a positional listener is attached and being updated. */
  listenerActive: boolean
}

/** Stable per-era mixer gain (0..1) used as the crossfade endpoint. */
const ERA_BUS_GAIN = 0.5

/**
 * Build a gain envelope for an exponential ramp. Returns a value strictly
 * greater than zero when `target > 0` so `exponentialRampToValueAtTime` keeps
 * its contract; otherwise returns 0 (handled with a linear fade to silence).
 */
export function exponentialRampValue(target: number): number {
  return target > 0 ? Math.max(target, 0.0001) : 0
}

/**
 * Schedule a smooth gain change on `gain` starting at `startTime` and ending
 * at `endTime`. Uses an exponential ramp when both endpoints are non-zero and
 * a linear ramp otherwise, so the envelope never jumps and never passes
 * through zero with an exponential curve.
 */
export function scheduleGainRamp(
  gain: GainNode,
  from: number,
  to: number,
  startTime: number,
  endTime: number,
): void {
  const now = Math.min(startTime, endTime)
  const end = Math.max(startTime, endTime)
  const safeFrom = exponentialRampValue(from)
  const safeTo = exponentialRampValue(to)
  if (safeFrom > 0 && safeTo > 0) {
    gain.gain.setValueAtTime(safeFrom, now)
    gain.gain.exponentialRampToValueAtTime(safeTo, end)
  } else {
    gain.gain.setValueAtTime(from, now)
    gain.gain.linearRampToValueAtTime(to, end)
  }
}

interface EraStrip {
  era: EraId
  data: SfxEraData
  buffers: EraAudioBuffers
  /** Master strip gain; receives the crossfade envelope. */
  bus: GainNode
  /** Ambient bed routed through a per-era filter. */
  ambient: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }
  /** Traffic loop. */
  traffic: { source: AudioBufferSourceNode; gain: GainNode }
  /** Event one-shots; scheduled from the current strip while it is active. */
  events: { buffers: AudioBuffer[]; gain: GainNode; nextSpawn: number }
  /** Music bus (downstream era-audio tasks wire real music sources here). */
  music: GainNode
}

const DEFAULT_CROSSFADE_SECONDS = 1.5

export class SfxMixer {
  readonly crossfadeSeconds: number
  readonly volume: number
  readonly ambienceGain: number

  state: SfxMixerState = {
    enabled: false,
    muted: true,
    currentEra: null,
    crossfading: false,
    crossfadeRemaining: 0,
    listenerActive: false,
  }

  private readonly contextFactory: () => AudioContext | null
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly strips = new Map<EraId, EraStrip>()
  private activeStrip: EraStrip | null = null
  private crossfadeTimer = 0
  private crossfadeDuration = 0
  private listenerActive = false
  private readonly listenerDirection = new THREE.Vector3()
  private readonly disposers: Array<() => void> = []
  private readonly gestureTarget: HTMLElement | null
  private gestureListenersAttached = false
  private pendingEra: EraId | null = null

  constructor(options: SfxMixerOptions = {}) {
    this.crossfadeSeconds = options.crossfadeSeconds ?? DEFAULT_CROSSFADE_SECONDS
    this.volume = options.volume ?? 1
    this.ambienceGain = options.ambienceGain ?? 1
    this.contextFactory = options.contextFactory ?? defaultContextFactory
    this.gestureTarget =
      typeof document !== 'undefined' ? document.documentElement : null
  }

  /**
   * Create and resume the AudioContext. Must be called from a user gesture
   * handler (the visible mute/unmute toggle click). Safe to call repeatedly.
   * Returns true when the mixer became enabled.
   */
  unlockOnGesture(): boolean {
    if (this.state.enabled && this.ctx) {
      // A later gesture may be needed if the first resume() was rejected
      // (e.g. programmatic unlock outside a gesture context).
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined)
      }
      return true
    }
    if (this.gestureTarget && !this.gestureListenersAttached) {
      this.gestureListenersAttached = true
      this.gestureTarget.addEventListener('click', this.handleGesture, { passive: true })
      this.gestureTarget.addEventListener('keydown', this.handleGesture)
      this.disposers.push(() => {
        this.gestureTarget?.removeEventListener('click', this.handleGesture)
        this.gestureTarget?.removeEventListener('keydown', this.handleGesture)
        this.gestureListenersAttached = false
      })
    }
    return this.ensureContext()
  }

  /** True when Web Audio is available in this environment. */
  private ensureContext(): boolean {
    if (this.state.enabled && this.ctx) return true
    let ctx: AudioContext | null = null
    try {
      ctx = this.contextFactory()
    } catch {
      ctx = null
    }
    if (!ctx) return false
    this.ctx = ctx
    this.master = ctx.createGain()
    // Starts muted (per the acceptance criteria): the visible toggle is the
    // first gesture and unmute ramps the master back in smoothly.
    this.master.gain.setValueAtTime(0, ctx.currentTime)
    this.master.connect(ctx.destination)

    // Pre-generate buffers for every era (pure allocation, no playback yet).
    const buffers = generateAllEraBuffers(ctx)
    for (const era of ERA_IDS) {
      this.createStrip(era, SFX_ERA_DATA[era], buffers[era])
    }

    if (ctx.state === 'suspended') {
      // resume() is only valid inside a user gesture; when called from the
      // toggle click this resolves immediately.
      void ctx.resume().catch(() => undefined)
    }
    this.state.enabled = true
    if (this.pendingEra) {
      const era = this.pendingEra
      this.pendingEra = null
      this.setEra(era)
    }
    return true
  }

  private createStrip(era: EraId, data: SfxEraData, buffers: EraAudioBuffers): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return

    const bus = ctx.createGain()
    // Idle floor (-80 dB): effectively silent but keeps exponential ramps
    // valid, so crossfades never pass through a hard zero.
    bus.gain.setValueAtTime(0.0001, ctx.currentTime)
    bus.connect(this.master)

    // Ambient bed: looped noise through a per-era bandpass filter.
    const ambientFilter = ctx.createBiquadFilter()
    ambientFilter.type = 'bandpass'
    ambientFilter.frequency.setValueAtTime(360, ctx.currentTime)
    ambientFilter.Q.setValueAtTime(0.9, ctx.currentTime)
    const ambientGain = ctx.createGain()
    ambientGain.gain.setValueAtTime(data.ambient.gain * this.ambienceGain, ctx.currentTime)
    ambientFilter.connect(ambientGain)
    ambientGain.connect(bus)
    const ambientSource = ctx.createBufferSource()
    ambientSource.buffer = buffers.ambient
    ambientSource.loop = true
    ambientSource.connect(ambientFilter)
    ambientSource.start()

    // Traffic loop: low-passed rumble, brightness follows era density.
    const trafficFilter = ctx.createBiquadFilter()
    trafficFilter.type = 'lowpass'
    trafficFilter.frequency.setValueAtTime(
      160 + data.traffic.density * 420,
      ctx.currentTime,
    )
    const trafficGain = ctx.createGain()
    trafficGain.gain.setValueAtTime(data.traffic.gain, ctx.currentTime)
    trafficFilter.connect(trafficGain)
    trafficGain.connect(bus)
    const trafficSource = ctx.createBufferSource()
    trafficSource.buffer = buffers.traffic
    trafficSource.loop = true
    trafficSource.connect(trafficFilter)
    trafficSource.start()

    // Event one-shots: a per-strip gain bus, scheduled by the scheduler.
    const eventsGain = ctx.createGain()
    eventsGain.gain.setValueAtTime(1, ctx.currentTime)
    eventsGain.connect(bus)

    // Music bus for downstream era-audio tasks.
    const musicGain = ctx.createGain()
    musicGain.gain.setValueAtTime(data.music.gain, ctx.currentTime)
    musicGain.connect(bus)

    const strip: EraStrip = {
      era,
      data,
      buffers,
      bus,
      ambient: { source: ambientSource, filter: ambientFilter, gain: ambientGain },
      traffic: { source: trafficSource, gain: trafficGain },
      events: { buffers: buffers.events, gain: eventsGain, nextSpawn: 0 },
      music: musicGain,
    }
    this.strips.set(era, strip)
  }

  /**
   * Switch the active ambience to `era`, crossfading the old strip out and
   * the new strip in over `crossfadeSeconds`. Idempotent for the current era.
   */
  setEra(era: EraId): void {
    const target = this.strips.get(era)
    if (!target) {
      // Audio not unlocked yet: remember the choice so the first gesture
      // resumes into this era.
      this.state.currentEra = era
      this.pendingEra = era
      return
    }
    if (this.activeStrip?.era === era && !this.state.crossfading) return
    const ctx = this.ctx
    if (!ctx || !this.master) {
      // Audio not unlocked yet: remember the choice so the first gesture
      // resumes into this era.
      this.state.currentEra = era
      this.pendingEra = era
      return
    }

    const now = ctx.currentTime
    const duration = Math.max(0.05, Math.min(this.crossfadeSeconds, 3))
    const end = now + duration

    const previous = this.activeStrip
    if (previous) {
      scheduleGainRamp(previous.bus, previous.bus.gain.value, 0, now, end)
    }
    scheduleGainRamp(target.bus, target.bus.gain.value, ERA_BUS_GAIN, now, end)

    this.activeStrip = target
    this.state.currentEra = era
    this.state.crossfading = true
    this.state.crossfadeRemaining = duration
    this.crossfadeTimer = 0
    this.crossfadeDuration = duration
  }

  /**
   * Update the positional listener from the camera. Call every frame with the
   * active three.js camera. When no camera is provided (headless), the
   * listener stays disabled and the mixer keeps running non-positionally.
   */
  updateListener(camera: {
    position: { x: number; y: number; z: number }
    getWorldDirection: (target: THREE.Vector3) => THREE.Vector3
  }): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const listener = ctx.listener
    if (!listener) return

    if (!this.listenerActive) {
      // Forward vector default: -Z (three.js camera convention).
      try {
        listener.forwardZ.setValueAtTime(-1, ctx.currentTime)
        listener.forwardY.setValueAtTime(0, ctx.currentTime)
        listener.upX.setValueAtTime(0, ctx.currentTime)
        listener.upY.setValueAtTime(1, ctx.currentTime)
        listener.upZ.setValueAtTime(0, ctx.currentTime)
        this.listenerActive = true
      } catch {
        this.listenerActive = false
      }
    }
    if (!this.listenerActive) return

    try {
      if (typeof listener.positionX !== 'undefined') {
        listener.positionX.setTargetAtTime(camera.position.x, ctx.currentTime, 0.08)
        listener.positionY.setTargetAtTime(camera.position.y, ctx.currentTime, 0.08)
        listener.positionZ.setTargetAtTime(camera.position.z, ctx.currentTime, 0.08)
      }
      camera.getWorldDirection(this.listenerDirection)
      listener.forwardX.setTargetAtTime(this.listenerDirection.x, ctx.currentTime, 0.08)
      listener.forwardY.setTargetAtTime(this.listenerDirection.y, ctx.currentTime, 0.08)
      listener.forwardZ.setTargetAtTime(this.listenerDirection.z, ctx.currentTime, 0.08)
    } catch {
      this.listenerActive = false
    }
    this.state.listenerActive = this.listenerActive
  }

  /**
   * Set the master mute. When unmuting, ramps the master gain back in
   * smoothly (no click). When muting, ramps out.
   */
  setMuted(muted: boolean): void {
    this.state.muted = muted
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const target = muted ? 0 : this.volume
    if (muted) {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + 0.12)
    } else {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now)
      this.master.gain.exponentialRampToValueAtTime(Math.max(target, 0.0001), now + 0.25)
    }
  }

  /** Toggle mute; returns the new muted state. */
  toggleMuted(): boolean {
    this.setMuted(!this.state.muted)
    return this.state.muted
  }

  /**
   * Per-frame update: advances era crossfades and schedules one-shot events
   * for the active era. Call from the render loop (after updateListener).
   */
  update(deltaSeconds: number): void {
    const ctx = this.ctx
    if (!ctx || !this.state.enabled || this.state.muted) return
    const strip = this.activeStrip
    if (!strip) return

    if (this.state.crossfading) {
      this.crossfadeTimer += deltaSeconds
      this.state.crossfadeRemaining = Math.max(0, this.crossfadeDuration - this.crossfadeTimer)
      if (this.crossfadeTimer >= this.crossfadeDuration) {
        this.state.crossfading = false
        this.state.crossfadeRemaining = 0
      }
    }

    this.scheduleEvents(strip, ctx.currentTime)
  }

  private scheduleEvents(strip: EraStrip, now: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const events = strip.events
    // Spawn the first event shortly after the era becomes active.
    if (events.nextSpawn === 0) {
      events.nextSpawn = now + 0.4 + Math.random() * 1.5
    }
    while (events.nextSpawn <= now) {
      const spec = strip.data.events[Math.floor(Math.random() * strip.data.events.length)]
      const buffer = events.buffers[Math.min(
        Math.floor(Math.random() * events.buffers.length),
        events.buffers.length - 1,
      )]
      if (buffer && spec) {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        const gain = ctx.createGain()
        // Event gain scaled by the era's event spec and a small random lift.
        const level = Math.min(1, spec.gain * (0.8 + Math.random() * 0.4))
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(Math.max(level, 0.0001), now + 0.02)
        gain.gain.setValueAtTime(Math.max(level, 0.0001), now + buffer.duration - 0.1)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + buffer.duration)
        source.connect(gain)
        gain.connect(events.gain)
        source.start(now)
        source.stop(now + buffer.duration + 0.05)
      }
      const interval = 60 / Math.max(0.2, spec?.ratePerMinute ?? 1)
      events.nextSpawn = now + interval * (0.6 + Math.random() * 0.9)
    }
  }

  /** Release the AudioContext and all listeners. Safe to call twice. */
  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose()
    const ctx = this.ctx
    if (ctx) {
      try {
        for (const strip of this.strips.values()) {
          strip.ambient.source.stop()
          strip.traffic.source.stop()
        }
      } catch {
        // sources may already be stopped
      }
      try {
        void ctx.close()
      } catch {
        // already closed or unavailable
      }
    }
    this.ctx = null
    this.master = null
    this.strips.clear()
    this.activeStrip = null
    this.state.enabled = false
    this.state.currentEra = null
    this.state.crossfading = false
    this.state.crossfadeRemaining = 0
    this.state.listenerActive = false
    this.listenerActive = false
  }

  private readonly handleGesture = (): void => {
    this.ensureContext()
  }
}

function defaultContextFactory(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  try {
    return new AudioContextCtor()
  } catch {
    return null
  }
}