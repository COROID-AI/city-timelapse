import { ERA_IDS, type EraId } from '../eras';
import { generateAllEraBuffers, generateWhoosh, type EraAudioBuffers } from './sfx';

/**
 * Era-aware crossfade mixer.
 *
 * Owns a single shared AudioContext and a graph in which each era's three
 * looping beds (ambient, traffic, music) are routed through their own gain
 * node. Only the active era's gains are non-zero; changing era crossfades the
 * beds over a bounded window using exponential ramps so there are no clicks.
 * One-shot event buffers (horns, bells, sirens, ...) are scheduled periodically
 * for the active era on a shared event bus, and a whoosh fires through a
 * dedicated gain whenever the era changes.
 *
 * Browser autoplay policy is respected: the AudioContext is created lazily and
 * only resumed on the first user gesture (see `unlock()`). `muted` zeroes the
 * master gain so a single toggle silences everything.
 */

/** Crossfade window in seconds (bounded, no clicks). */
export const CROSSFADE_SECONDS = 1.5;

/** Event scheduling parameters. */
const EVENT_MIN_GAP = 3.5;
const EVENT_MAX_GAP = 9;
const EVENT_VOLUME = 0.32;

/** Mixer construction options. */
export interface SfxMixerOptions {
  /** Master volume applied to all audio (0..1). */
  volume?: number;
  /** Initial muted state. */
  muted?: boolean;
}

interface BedNode {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

interface EraBus {
  ambient: BedNode;
  traffic: BedNode;
  music: BedNode;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private whooshGain: GainNode | null = null;
  private eventGain: GainNode | null = null;

  private buffers: Record<EraId, EraAudioBuffers> | null = null;

  private buses = new Map<EraId, EraBus>();
  private activeEra: EraId = ERA_IDS[0];
  private muted: boolean;
  private volume: number;
  private disposed = false;

  private eventBuffer: AudioBuffer[] | null = null;
  private eventIndex = 0;
  private eventTimer = 0;
  private eventGap = 0;

  /** Whether the underlying AudioContext exists yet. */
  get ready(): boolean {
    return this.ctx !== null;
  }

  get mutedState(): boolean {
    return this.muted;
  }

  constructor(options: SfxMixerOptions = {}) {
    this.volume = clamp01(options.volume ?? 0.65);
    this.muted = options.muted ?? false;
  }

  /** Master volume (0..1). */
  setVolume(v: number): void {
    this.volume = clamp01(v);
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.effectiveGain(), t, 0.05);
  }

  /** Mute/unmute all audio. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.effectiveGain(), t, 0.03);
  }

  /** Effective master gain factoring in mute. */
  private effectiveGain(): number {
    return this.muted ? 0 : this.volume;
  }

  /**
   * Create (or resume) the AudioContext. Must be called from a user gesture to
   * satisfy the autoplay policy. Idempotent after first unlock.
   */
  unlock(): void {
    if (this.disposed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.effectiveGain();
    this.master.connect(ctx.destination);

    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0.55;
    this.whooshGain.connect(this.master);

    this.eventGain = ctx.createGain();
    this.eventGain.gain.value = EVENT_VOLUME;
    this.eventGain.connect(this.master);

    // Generate all buffers procedurally (no network).
    this.buffers = generateAllEraBuffers(ctx);
    this.eventBuffer = this.buffers[this.activeEra].events;
    this.eventIndex = 0;
    this.eventTimer = 0;
    this.eventGap = EVENT_MIN_GAP;

    // Build a bed bus per era.
    for (const id of ERA_IDS) {
      const era = this.buffers[id];
      this.buses.set(id, {
        ambient: this.makeBed(era.ambient),
        traffic: this.makeBed(era.traffic),
        music: this.makeBed(era.music),
      });
    }

    // Fade in the active era's beds.
    this.fadeTo(this.activeEra, this.activeEra, 0.3);

    if (ctx.state === 'suspended') void ctx.resume();
  }

  private makeBed(buffer: AudioBuffer): BedNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(this.master!);
    src.start();
    return { src, gain };
  }

  /**
   * Set the active era, crossfading the looping beds and firing the whoosh.
   * Safe to call before the context is unlocked (era is remembered and applied
   * on unlock).
   */
  setEra(id: EraId): void {
    if (id === this.activeEra) return;
    const from = this.activeEra;
    this.activeEra = id;
    if (!this.ctx || !this.buffers) return;

    this.playWhoosh();
    this.fadeTo(from, id, CROSSFADE_SECONDS);

    this.eventBuffer = this.buffers[id].events;
    this.eventIndex = 0;
    this.eventGap = 0.6; // trigger an event soon after a transition
  }

  private fadeTo(from: EraId, to: EraId, ramp: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const prev = this.buses.get(from);
    if (prev) {
      this.rampBed(prev.ambient, 0, t, ramp);
      this.rampBed(prev.traffic, 0, t, ramp);
      this.rampBed(prev.music, 0, t, ramp);
    }
    const next = this.buses.get(to);
    if (next) {
      this.rampBed(next.ambient, this.bedGain('ambient'), t, ramp);
      this.rampBed(next.traffic, this.bedGain('traffic'), t, ramp);
      this.rampBed(next.music, this.bedGain('music'), t, ramp);
    }
  }

  private rampBed(bed: BedNode, target: number, t: number, ramp: number): void {
    const g = bed.gain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(target, t, ramp / 4);
  }

  /** Per-bed target gain for the active era (muted via master). */
  private bedGain(bed: 'ambient' | 'traffic' | 'music'): number {
    if (bed === 'traffic') return 0.28;
    if (bed === 'music') return 0.16;
    return 0.4;
  }

  private playWhoosh(): void {
    const ctx = this.ctx!;
    if (!this.whooshGain) return;
    const buffer = generateWhoosh(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.whooshGain);
    src.start(ctx.currentTime);
  }

  /** Advance event scheduling by dt seconds. Call each frame. */
  update(dt: number): void {
    if (!this.ctx || !this.eventActive) return;
    this.eventTimer += dt;
    if (this.eventTimer >= this.eventGap) {
      this.triggerEvent();
      this.eventTimer = 0;
      this.eventGap = EVENT_MIN_GAP + Math.random() * (EVENT_MAX_GAP - EVENT_MIN_GAP);
    }
  }

  private get eventActive(): boolean {
    return this.ctx !== null && this.eventBuffer !== null;
  }

  private triggerEvent(): void {
    const ctx = this.ctx!;
    const list = this.eventBuffer;
    if (!list || list.length === 0 || !this.eventGain) return;
    const buffer = list[this.eventIndex % list.length];
    this.eventIndex++;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.eventGain);
    src.start(ctx.currentTime);
  }

  /** Stop all sources and release the AudioContext. */
  dispose(): void {
    this.disposed = true;
    for (const bus of this.buses.values()) {
      try {
        bus.ambient.src.stop();
        bus.traffic.src.stop();
        bus.music.src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.buses.clear();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.master = null;
    this.whooshGain = null;
    this.eventGain = null;
    this.buffers = null;
    this.eventBuffer = null;
  }
}