/**
 * src/audio/mixer.ts — era-aware crossfade SFX mixer.
 *
 * Per the audio-implementation-plan contract, SfxMixer owns the Web Audio
 * graph for ambient bed, traffic loop, event one-shots and music. It is
 * autoplay-safe: no AudioContext is created until `init()` runs inside a user
 * gesture (the app calls it from the first pointer/key interaction), and
 * `setEra()` crossfades layers with exponential GainNode ramps over ~1.5s
 * (no clicks). `dispose()` tears the whole graph down.
 *
 * Crossfade model
 * ---------------
 * Each looping layer owns a single layer GainNode. When the era changes we
 * swap the looped buffer *per layer*:
 *
 *   1. the current source is ramped to silence (~120ms, silent start point)
 *   2. it is stopped at the end of that fade (no audible click)
 *   3. the new era's source starts at the silent layer gain and is ramped up
 *      over the remaining ~1.5s window with exponentialRampToValueAtTime
 *
 * Scheduled values are always cancelled first and the old source is fully
 * released (`stop()` + `disconnect()`), so rapid era cycling never leaves
 * overlapping loops running on the same gain. Exponential ramps never touch
 * zero (they floor at 0.0001), so the graph never clicks. A master
 * DynamicsCompressor guards against transient clipping when several layers
 * peak at once. The music layer plays a procedurally generated era-styled
 * bed (see sfx.generateMusicBuffer) so each era's music is audibly distinct.
 */

import { SFX_ERA_DATA, type EraId } from '../eras';
import { generateAllEraBuffers, type EraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume 0..1. Default 0.8. */
  masterVolume?: number;
  /** Local storage key for the persisted mute flag. Default 'city-timelapse:audio-muted'. */
  storageKey?: string;
  /** Override AudioContext factory (used by tests). */
  contextFactory?: () => AudioContext | null;
}

/** One looping layer (ambient/traffic/music) plus its loop plumbing. */
interface Layer {
  gain: GainNode;
  /** Currently playing loop source, if any. */
  source: AudioBufferSourceNode | null;
  /** The era whose buffers the playing source was created from. */
  bundleEra: EraId | null;
}

type LoopKind = 'ambient' | 'traffic' | 'music';

const CROSSFADE_MS = 1500;
const OUT_FADE_S = 0.12;
const MIN_GAIN = 0.0001;

function createDefaultAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
}

export class SfxMixer {
  private readonly masterVolume: number;
  private readonly storageKey: string;
  private readonly createCtx: () => AudioContext | null;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambient: Layer | null = null;
  private traffic: Layer | null = null;
  private music: Layer | null = null;
  private eventGain: GainNode | null = null;
  private buffers: Record<EraId, EraAudioBuffers> | null = null;
  private currentEraId: EraId = '1945';
  private muted = false;
  private disposed = false;

  constructor(options: SfxMixerOptions = {}) {
    this.masterVolume = options.masterVolume ?? 0.8;
    this.storageKey = options.storageKey ?? 'city-timelapse:audio-muted';
    if (typeof localStorage !== 'undefined') {
      this.muted = localStorage.getItem(this.storageKey) === '1';
    }
    this.createCtx = options.contextFactory ?? createDefaultAudioContext;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Whether audio has been initialized (autoplay-safe latch). */
  get isInitialized(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Create the context and start the current era's layers. Must be called from
   * a user gesture to satisfy autoplay policy; safe to call repeatedly.
   */
  init(): void {
    if (this.disposed || this.ctx) {
      return;
    }
    const ctx = this.createCtx();
    if (!ctx) {
      return;
    }
    void ctx.resume().catch(() => undefined);
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 6;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.25;
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    this.ambient = this.createLayer(ctx, 0.9);
    this.traffic = this.createLayer(ctx, 0.6);
    this.music = this.createLayer(ctx, 0.3);
    this.eventGain = ctx.createGain();
    this.eventGain.gain.value = 0.7;
    this.eventGain.connect(this.master);

    // Generate all buffers upfront (procedural, no network).
    this.buffers = generateAllEraBuffers(ctx);

    // Initial era: start loops with a near-instantaneous fade-in so the user
    // gesture lands on sound immediately.
    const data = SFX_ERA_DATA[this.currentEraId];
    const now = ctx.currentTime;
    this.swapLoop('ambient', this.buffers[this.currentEraId].ambient, 0.9, 0.15, now);
    this.swapLoop(
      'traffic',
      this.buffers[this.currentEraId].traffic,
      0.15 + data.trafficDensity * 0.55,
      0.15,
      now,
    );
    this.swapLoop('music', this.buffers[this.currentEraId].music, 0.18, 0.15, now);
  }

  /** Forced unlock helper — call from latency-free event handlers. */
  unlock(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  /**
   * Crossfade the ambient/traffic/music layers to the given era over ~1.5s.
   * Old loops are faded to silence and stopped, then the new era's loops are
   * started and faded in — no overlapping sources, no clicks. Idempotent:
   * same-era calls no-op, so rapid era cycling never double-triggers.
   */
  setEra(id: EraId): void {
    if (!SFX_ERA_DATA[id]) {
      throw new Error(`Cannot set unknown era: ${String(id)}`);
    }
    if (id === this.currentEraId) {
      return;
    }
    this.currentEraId = id;
    if (!this.ctx || !this.buffers) {
      return;
    }
    const data = SFX_ERA_DATA[id];
    const now = this.ctx.currentTime;
    this.swapLoop('ambient', this.buffers[id].ambient, 0.9, CROSSFADE_MS / 1000, now);
    this.swapLoop(
      'traffic',
      this.buffers[id].traffic,
      0.15 + data.trafficDensity * 0.55,
      CROSSFADE_MS / 1000,
      now,
    );
    this.swapLoop('music', this.buffers[id].music, 0.18, CROSSFADE_MS / 1000, now);
  }

  /** Fire a one-shot event (by name) for the current era. */
  playEvent(name: string): void {
    if (!this.ctx || !this.buffers || !this.eventGain) {
      return;
    }
    const eventNames = SFX_ERA_DATA[this.currentEraId].events;
    const eventIndex = eventNames.indexOf(name);
    if (eventIndex < 0) {
      return;
    }
    const buffer = this.buffers[this.currentEraId].events[eventIndex];
    if (!buffer) {
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const now = this.ctx.currentTime;
    const local = this.ctx.createGain();
    local.gain.setValueAtTime(MIN_GAIN, now);
    local.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    local.gain.exponentialRampToValueAtTime(MIN_GAIN, now + buffer.duration);
    source.connect(local);
    local.connect(this.eventGain);
    source.start(now);
    source.onended = () => {
      local.disconnect();
    };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, this.muted ? '1' : '0');
    }
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.masterVolume, now + 0.15);
    }
    return this.muted;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.ctx) {
      for (const kind of ['ambient', 'traffic', 'music'] as const) {
        this.stopSource(this[kind]?.source ?? null);
      }
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.ambient = null;
    this.traffic = null;
    this.music = null;
    this.eventGain = null;
    this.buffers = null;
  }

  private createLayer(ctx: AudioContext, startGain: number): Layer {
    const gain = ctx.createGain();
    gain.gain.value = startGain;
    gain.connect(this.master as GainNode);
    return { gain, source: null, bundleEra: null };
  }

  /**
   * Swap one looping layer to a new buffer. The previous source is faded out
   * (120ms) and stopped at its silent endpoint; the new source starts at the
   * floor gain and ramps exponentially to its target over `fade` seconds.
   */
  private swapLoop(kind: LoopKind, buffer: AudioBuffer, target: number, fade: number, now: number): void {
    const layer = this[kind];
    if (!this.ctx || !layer) {
      return;
    }
    const ctx = this.ctx;

    // 1. Fade out + stop the old source at its silent end point.
    if (layer.source) {
      const old = layer.source;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
      layer.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + OUT_FADE_S);
      try {
        old.stop(now + OUT_FADE_S + 0.005);
      } catch {
        // Already stopped.
      }
      old.onended = () => {
        old.disconnect();
      };
      layer.source = null;
    }

    // 2. Follow the fade-out with the new era's loop: start at the floor gain
    //    (no second cancel — the events below continue the curve) and ramp up
    //    over the bounded crossfade window.
    layer.gain.gain.setValueAtTime(MIN_GAIN, now + OUT_FADE_S);
    layer.gain.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, target), now + OUT_FADE_S + fade);

    // 3. Start the new loop at its (still-silent) start point.
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(layer.gain);
    source.start(now + OUT_FADE_S);
    layer.source = source;
    layer.bundleEra = this.currentEraId;
  }

  private stopSource(source: AudioBufferSourceNode | null): void {
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    }
  }
}