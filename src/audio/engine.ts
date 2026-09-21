/**
 * Era-agnostic WebAudio engine.
 *
 * `createAudioEngine` builds a lazy WebAudio graph — master, music, ambience
 * and SFX buses, a mute gate and a master analyser — and renders whatever
 * declarative soundscape descriptor it is handed. It is deliberately ignorant
 * of eras, the scene pipeline and React: the era registry owns the mapping from
 * a time period to a {@link SoundscapeDescriptor}, this module owns playback.
 *
 * Two properties shape the implementation:
 *
 * - **Nothing is constructed at import time.** The `AudioContext` is only built
 *   inside `unlock()`, which the app calls from a user gesture, so autoplay
 *   policies are satisfied and importing the module can never crash a
 *   server-side or pruned build.
 * - **No environment may throw at the engine.** When WebAudio is missing the
 *   engine reports `supported: false` and every call becomes a silent no-op.
 */

import { clamp, createAmbienceBed, createNoiseBuffer, disconnectNode, rampGain } from './beds'
import type { AmbienceBed } from './beds'
import { renderOneShot, resolveOneShotId } from './oneshots'
import type { OneShotVoice } from './oneshots'
import { validateSoundscapeDescriptor } from './validation'
import type {
  AudioContextStateLike,
  AudioEngine,
  AudioEngineOptions,
  AudioEngineState,
  BusName,
  BusVolumes,
  CrossfadeRejectionReason,
  CrossfadeResult,
  NoiseColor,
  NormalizedSoundscapeDescriptor,
  OneShotHandle,
  OneShotOptions,
  OneShotRejectionReason,
  SoundscapeDescriptor,
  ValidationIssue,
} from './types'

/** Fade used by `crossfadeBeds`/`stopBeds` when the caller omits a duration. */
export const DEFAULT_CROSSFADE_SECONDS = 1.5

/** Upper bound for any requested fade, so a typo cannot freeze a bed forever. */
export const MAX_CROSSFADE_SECONDS = 60

const DEFAULT_ANALYSER_FFT_SIZE = 2048
const DEFAULT_ANALYSER_SMOOTHING = 0.6
const VOLUME_RAMP_SECONDS = 0.03
const MUTE_RAMP_SECONDS = 0.04
const MAX_ONE_SHOT_DELAY_SECONDS = 10

/**
 * Builds the platform `AudioContext`. Returns a factory rather than a context
 * so construction happens when the engine decides to unlock, not when the
 * options are read.
 */
export function defaultAudioContextFactory(): () => AudioContext | null {
  return () => {
    const scope = globalThis as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Context = scope.AudioContext ?? scope.webkitAudioContext
    if (typeof Context !== 'function') {
      return null
    }
    try {
      return new Context()
    } catch {
      // Some browsers throw when too many contexts exist; degrade to silence.
      return null
    }
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  const candidate = value as { then?: unknown } | null | undefined
  return typeof candidate?.then === 'function'
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return clamp(value, min, max)
}

/** The engine's private node wiring; never exposed on the public API. */
interface AudioGraph {
  readonly master: GainNode
  readonly mute: GainNode
  readonly analyser: AnalyserNode
  readonly buses: Record<BusName, GainNode>
  /** Every node the graph created, so `dispose()` can detach all of it. */
  readonly nodes: readonly AudioNode[]
}

/**
 * Buffer type `getFloatTimeDomainData` accepts. Spelled through `Parameters`
 * so the module compiles against both the classic `Float32Array` declaration
 * and the newer ArrayBuffer-generic one.
 */
type TimeDomainBuffer = Parameters<AnalyserNode['getFloatTimeDomainData']>[0]

/** Mixer and playback implementation behind the `AudioEngine` contract. */
export class WebAudioEngine implements AudioEngine {
  private readonly factory: () => AudioContext | null
  private readonly random: () => number
  private readonly crossfadeSeconds: number
  private readonly analyserFftSize: number
  private readonly analyserSmoothing: number

  private volumes: Record<BusName, number>
  private muted: boolean

  private context: AudioContext | null = null
  private graph: AudioGraph | null = null
  private unsupported = false
  private unlocked = false
  private disposed = false

  private activeBed: AmbienceBed | null = null
  private pendingBed: NormalizedSoundscapeDescriptor | null = null
  private readonly retiringBeds = new Set<AmbienceBed>()
  private readonly voices = new Set<OneShotVoice>()
  private readonly noiseBuffers = new Map<NoiseColor, AudioBuffer>()
  private readonly listeners = new Set<(state: AudioEngineState) => void>()
  private rmsBuffer: TimeDomainBuffer | null = null

  constructor(options: AudioEngineOptions = {}) {
    this.factory = options.contextFactory ?? defaultAudioContextFactory()
    this.random = options.random ?? Math.random
    this.crossfadeSeconds = sanitizeNumber(
      options.crossfadeSeconds,
      DEFAULT_CROSSFADE_SECONDS,
      0,
      MAX_CROSSFADE_SECONDS,
    )
    this.analyserFftSize = Math.max(
      32,
      Math.round(sanitizeNumber(options.analyserFftSize, DEFAULT_ANALYSER_FFT_SIZE, 32, 32768)),
    )
    this.analyserSmoothing = sanitizeNumber(options.analyserSmoothing, DEFAULT_ANALYSER_SMOOTHING, 0, 1)
    this.volumes = {
      master: sanitizeNumber(options.volumes?.master, 1, 0, 1),
      music: sanitizeNumber(options.volumes?.music, 1, 0, 1),
      ambience: sanitizeNumber(options.volumes?.ambience, 1, 0, 1),
      sfx: sanitizeNumber(options.volumes?.sfx, 1, 0, 1),
    }
    this.muted = options.muted === true
  }

  /* ---------------------------------------------------------- lifecycle -- */

  async unlock(): Promise<AudioEngineState> {
    if (this.disposed) {
      return this.getState()
    }
    const context = this.ensureContext()
    if (context === null) {
      this.emit()
      return this.getState()
    }
    try {
      await context.resume()
    } catch {
      // The browser may still refuse (no gesture, no output device). The state
      // readout keeps reporting `suspended` so the UI can ask again.
    }
    this.unlocked = true
    const pending = this.pendingBed
    if (pending !== null) {
      this.pendingBed = null
      this.applyBed(pending, this.resolveFadeSeconds(pending.fadeInSeconds))
    }
    this.emit()
    return this.getState()
  }

  getState(): AudioEngineState {
    if (this.context !== null) {
      this.prune(this.context.currentTime)
    }
    const contextState = this.contextState()
    const oneShotVoices = this.voices.size
    const bedVoices = (this.activeBed === null ? 0 : 1) + this.retiringBeds.size
    return {
      contextState,
      contextCreated: this.context !== null,
      supported: !this.unsupported,
      unlocked: this.unlocked,
      running: contextState === 'running',
      muted: this.muted,
      disposed: this.disposed,
      volumes: { ...this.volumes },
      currentBed: this.activeBed?.id ?? null,
      pendingBed: this.pendingBed?.id ?? null,
      retiringBeds: [...this.retiringBeds].map((bed) => bed.id),
      liveVoices: oneShotVoices + bedVoices,
      oneShotVoices,
      bedVoices,
      analyserRms: this.getAnalyserRms(),
    }
  }

  subscribe(listener: (state: AudioEngineState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    if (this.activeBed !== null) {
      this.activeBed.dispose()
      this.activeBed = null
    }
    for (const bed of this.retiringBeds) {
      bed.dispose()
    }
    this.retiringBeds.clear()
    for (const voice of this.voices) {
      voice.dispose()
    }
    this.voices.clear()

    const graph = this.graph
    if (graph !== null) {
      for (const node of graph.nodes) {
        disconnectNode(node)
      }
    }
    this.graph = null

    const context = this.context
    this.context = null
    this.noiseBuffers.clear()
    this.listeners.clear()
    this.rmsBuffer = null
    this.pendingBed = null
    this.unlocked = false

    if (context !== null) {
      try {
        const closing: unknown = context.close()
        if (isPromiseLike(closing)) {
          void closing.then(undefined, () => undefined)
        }
      } catch {
        // Closing is best-effort; a failed close must not break disposal.
      }
    }
  }

  /* ------------------------------------------------------------- mixer -- */

  setVolume(bus: BusName, value: number): number {
    const current = this.volumes[bus]
    if (current === undefined) {
      return 0
    }
    const next = typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : current
    const volumes: Record<BusName, number> = { ...this.volumes }
    volumes[bus] = next
    this.volumes = volumes

    const graph = this.graph
    const context = this.context
    if (graph !== null && context !== null) {
      rampGain(graph.buses[bus].gain, next, context.currentTime, context.currentTime + VOLUME_RAMP_SECONDS)
    }
    this.emit()
    return next
  }

  getVolume(bus: BusName): number {
    return this.volumes[bus] ?? 0
  }

  getVolumes(): BusVolumes {
    return { ...this.volumes }
  }

  mute(muted = true): boolean {
    const next = muted !== false
    if (next !== this.muted) {
      this.muted = next
      const graph = this.graph
      const context = this.context
      if (graph !== null && context !== null) {
        rampGain(
          graph.mute.gain,
          next ? 0 : 1,
          context.currentTime,
          context.currentTime + MUTE_RAMP_SECONDS,
        )
      }
      this.emit()
    }
    return this.muted
  }

  isMuted(): boolean {
    return this.muted
  }

  toggleMute(): boolean {
    return this.mute(!this.muted)
  }

  /* ----------------------------------------------------------- beds ----- */

  crossfadeBeds(descriptor: SoundscapeDescriptor | null, seconds?: number): CrossfadeResult {
    if (this.disposed) {
      return this.failure('disposed')
    }
    if (descriptor === null) {
      return this.stopBeds(seconds)
    }
    const validation = validateSoundscapeDescriptor(descriptor)
    const fadeSeconds = this.resolveFadeSeconds(seconds ?? validation.value?.fadeInSeconds)
    if (!validation.valid || validation.value === null) {
      return {
        applied: false,
        pending: false,
        bedId: typeof descriptor.id === 'string' ? descriptor.id : null,
        durationSeconds: fadeSeconds,
        reason: 'invalid-descriptor',
        issues: validation.issues,
      }
    }
    return this.applyBed(validation.value, fadeSeconds)
  }

  stopBeds(seconds?: number): CrossfadeResult {
    if (this.disposed) {
      return this.failure('disposed')
    }
    const fadeSeconds = this.resolveFadeSeconds(seconds)
    const hadPending = this.pendingBed !== null
    this.pendingBed = null
    const bed = this.activeBed
    this.activeBed = null
    if (bed !== null && this.context !== null) {
      this.retireBed(bed, fadeSeconds, this.context.currentTime)
    }
    this.emit()
    return {
      applied: bed !== null || hadPending,
      pending: false,
      bedId: null,
      durationSeconds: fadeSeconds,
      reason: null,
      issues: [],
    }
  }

  /* -------------------------------------------------------- one-shots --- */

  playOneShot(id: string, options: OneShotOptions = {}): OneShotHandle {
    if (this.disposed) {
      return this.rejected('disposed')
    }
    const resolved = resolveOneShotId(id)
    if (resolved === null) {
      return this.rejected('unknown-id')
    }
    const context = this.context
    const graph = this.graph
    if (context === null || graph === null) {
      return this.rejected(this.unsupported ? 'unsupported' : 'locked')
    }

    const gain = sanitizeNumber(options.gain, 1, 0, 2)
    const pan = sanitizeNumber(options.pan, 0, -1, 1)
    const rate = sanitizeNumber(options.rate, 1, 0.25, 4)
    const delay = sanitizeNumber(options.delaySeconds, 0, 0, MAX_ONE_SHOT_DELAY_SECONDS)
    const startTime = context.currentTime + delay

    const voice = renderOneShot(context, resolved, {
      destination: graph.buses.sfx,
      when: startTime,
      gain,
      pan,
      rate,
      random: this.random,
      noiseBuffer: (color) => this.noiseBufferFor(context, color),
    })
    this.voices.add(voice)
    this.attachVoiceCleanup(voice)
    this.emit()

    return {
      id: resolved,
      started: true,
      reason: null,
      durationSeconds: voice.durationSeconds,
      gain,
      pan,
      rate,
      startTime,
      stop: (when?: number) => {
        voice.release(when ?? context.currentTime)
        this.emit()
      },
    }
  }

  /* -------------------------------------------------------- analyser ---- */

  getAnalyserRms(): number {
    const analyser = this.graph?.analyser
    if (analyser === undefined || typeof analyser.getFloatTimeDomainData !== 'function') {
      return 0
    }
    const size = analyser.fftSize
    if (this.rmsBuffer === null || this.rmsBuffer.length !== size) {
      this.rmsBuffer = new Float32Array(size)
    }
    analyser.getFloatTimeDomainData(this.rmsBuffer)
    let sum = 0
    for (let index = 0; index < this.rmsBuffer.length; index += 1) {
      const sample = this.rmsBuffer[index] ?? 0
      sum += sample * sample
    }
    return this.rmsBuffer.length === 0 ? 0 : Math.sqrt(sum / this.rmsBuffer.length)
  }

  /* -------------------------------------------------------- internals --- */

  private contextState(): AudioContextStateLike {
    if (this.disposed) {
      return 'closed'
    }
    if (this.context !== null) {
      return this.context.state
    }
    return this.unsupported ? 'unavailable' : 'suspended'
  }

  private ensureContext(): AudioContext | null {
    if (this.context !== null) {
      return this.context
    }
    if (this.disposed) {
      return null
    }
    let created: AudioContext | null = null
    try {
      created = this.factory()
    } catch {
      created = null
    }
    if (created === null) {
      this.unsupported = true
      return null
    }
    this.context = created
    this.buildGraph(created)
    return created
  }

  private buildGraph(context: AudioContext): void {
    const master = context.createGain()
    master.gain.value = this.volumes.master
    const mute = context.createGain()
    mute.gain.value = this.muted ? 0 : 1
    const analyser = context.createAnalyser()
    analyser.fftSize = this.analyserFftSize
    analyser.smoothingTimeConstant = this.analyserSmoothing

    master.connect(mute)
    mute.connect(analyser)
    analyser.connect(context.destination)

    const music = this.createBus(context, 'music', master)
    const ambience = this.createBus(context, 'ambience', master)
    const sfx = this.createBus(context, 'sfx', master)

    this.graph = {
      master,
      mute,
      analyser,
      buses: { master, music, ambience, sfx },
      nodes: [master, mute, analyser, music, ambience, sfx],
    }
  }

  private createBus(context: AudioContext, bus: BusName, master: GainNode): GainNode {
    const node = context.createGain()
    node.gain.value = this.volumes[bus]
    node.connect(master)
    return node
  }

  private applyBed(descriptor: NormalizedSoundscapeDescriptor, fadeSeconds: number): CrossfadeResult {
    const context = this.context
    const graph = this.graph
    if (context === null || graph === null) {
      this.pendingBed = descriptor
      this.emit()
      return {
        applied: false,
        pending: true,
        bedId: descriptor.id,
        durationSeconds: fadeSeconds,
        reason: this.unsupported ? 'unsupported' : 'locked',
        issues: [],
      }
    }
    const now = context.currentTime
    const previous = this.activeBed
    const bed = createAmbienceBed(context, descriptor, {
      destination: graph.buses.ambience,
      when: now,
      fadeSeconds,
      gain: descriptor.gain,
      random: this.random,
      noiseBuffer: (color) => this.noiseBufferFor(context, color),
    })
    this.activeBed = bed
    if (previous !== null) {
      this.retireBed(previous, fadeSeconds, now)
    }
    this.emit()
    return {
      applied: true,
      pending: false,
      bedId: descriptor.id,
      durationSeconds: fadeSeconds,
      reason: null,
      issues: [],
    }
  }

  private retireBed(bed: AmbienceBed, seconds: number, now: number): void {
    bed.fadeOut(seconds, now)
    if (seconds <= 0) {
      bed.dispose()
      return
    }
    this.retiringBeds.add(bed)
  }

  private resolveFadeSeconds(seconds: number | undefined): number {
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return clamp(seconds, 0, MAX_CROSSFADE_SECONDS)
    }
    return this.crossfadeSeconds
  }

  private noiseBufferFor(context: AudioContext, color: NoiseColor): AudioBuffer {
    const cached = this.noiseBuffers.get(color)
    if (cached !== undefined) {
      return cached
    }
    const buffer = createNoiseBuffer(context, color, this.random)
    this.noiseBuffers.set(color, buffer)
    return buffer
  }

  private attachVoiceCleanup(voice: OneShotVoice): void {
    const source = voice.sources[0]
    if (source === undefined) {
      return
    }
    source.onended = () => {
      if (this.voices.delete(voice)) {
        voice.dispose()
        this.emit()
      }
    }
  }

  /** Releases voices and retired beds whose scheduled window has passed. */
  private prune(now: number): void {
    for (const voice of [...this.voices]) {
      if (voice.endsAt <= now) {
        this.voices.delete(voice)
        voice.dispose()
      }
    }
    for (const bed of [...this.retiringBeds]) {
      if (bed.endsAt !== null && bed.endsAt <= now) {
        this.retiringBeds.delete(bed)
        bed.dispose()
      }
    }
  }

  private rejected(reason: OneShotRejectionReason): OneShotHandle {
    return {
      id: null,
      started: false,
      reason,
      durationSeconds: 0,
      gain: 0,
      pan: 0,
      rate: 1,
      startTime: 0,
      stop: () => undefined,
    }
  }

  private failure(reason: CrossfadeRejectionReason, issues: readonly ValidationIssue[] = []): CrossfadeResult {
    return {
      applied: false,
      pending: false,
      bedId: null,
      durationSeconds: 0,
      reason,
      issues,
    }
  }

  private emit(): void {
    if (this.listeners.size === 0) {
      return
    }
    const state = this.getState()
    for (const listener of [...this.listeners]) {
      try {
        listener(state)
      } catch {
        // A broken subscriber must never interrupt audio.
      }
    }
  }
}

/** Creates an engine. No `AudioContext` exists until `unlock()` is called. */
export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  return new WebAudioEngine(options)
}
