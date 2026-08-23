/**
 * Era-aware crossfading SFX mixer.
 *
 * Four layers per era — ambient bed, traffic loop, event one-shots, music —
 * each backed by a pair of GainNodes so an outgoing era can fade out while
 * the incoming era fades in. All level movement uses exponential GainNode
 * ramps bounded to a ~1.5 s window (click-free, never reaching exactly 0).
 *
 * Autoplay policy: no AudioContext is created until the first user gesture.
 * Call {@link SfxMixer.handleUserGesture} (or
 * {@link SfxMixer.attachGestureUnlock}) from a pointer/key handler; the
 * mixer resumes the context there.
 */

import { ERA_IDS, SFX_ERA_DATA } from '../eras';
import type { EraId } from '../eras';
import type { EraAudioBuffers } from './sfx';

export type SfxLayerId = 'ambient' | 'traffic' | 'events' | 'music';

/** Ordered layer identifiers. */
export const SFX_LAYER_IDS: readonly SfxLayerId[] = [
  'ambient',
  'traffic',
  'events',
  'music',
];

/** Smallest gain an exponential ramp may target (Web Audio forbids 0). */
export const MIN_AUDIBLE_GAIN = 0.0001;

/** Hard upper bound for any crossfade window (seconds). */
export const MAX_CROSSFADE_SECONDS = 1.5;

/** Default crossfade window (seconds). */
export const DEFAULT_CROSSFADE_SECONDS = 1.5;

/** Lower bound so a misconfigured 0 s fade cannot click. */
export const MIN_CROSSFADE_SECONDS = 0.05;

/** Static per-layer balance. Era loudness differences are baked into the
 * synthesized buffers themselves (see `SfxEraData.*.level`). */
const LAYER_BASE_GAIN: Record<SfxLayerId, number> = {
  ambient: 0.9,
  traffic: 0.75,
  events: 1.0,
  music: 0.55,
};

export interface SfxMixerOptions {
  /** Pre-rendered buffers per era, e.g. from `generateAllEraBuffers()`. */
  readonly buffers: Record<EraId, EraAudioBuffers>;
  /** Era selected before the mixer starts. Defaults to `'1945'`. */
  readonly initialEra?: EraId;
  /** Crossfade window in seconds; clamped to `[0.05, 1.5]`. */
  readonly crossfadeSeconds?: number;
  /** Master output gain, clamped to `(0, 1]`. Defaults to `0.8`. */
  readonly masterVolume?: number;
  /** Override AudioContext construction (tests / embedding shells). */
  readonly contextFactory?: () => AudioContext;
}

interface LayerState {
  readonly gains: [GainNode, GainNode];
  readonly currentGains: [number, number];
  activeSlot: 0 | 1;
  readonly voices: [Set<AudioBufferSourceNode>, Set<AudioBufferSourceNode>];
}

/** Lifecycle state machine surfaced for tests/debugging. */
export type SfxMixerPhase = 'idle' | 'starting' | 'running' | 'disposed';

function createDefaultContext(): AudioContext {
  const scope = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) {
    throw new Error(
      'SfxMixer: Web Audio (AudioContext) is unavailable in this environment.',
    );
  }
  return new Ctor();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Prevent a pending scheduler timeout from holding the process open (Node). */
function unrefTimer(handle: ReturnType<typeof setTimeout>): void {
  const candidate = handle as { unref?: () => void };
  if (typeof candidate.unref === 'function') {
    candidate.unref();
  }
}

export class SfxMixer {
  readonly #buffers: Record<EraId, EraAudioBuffers>;
  readonly #crossfadeSeconds: number;
  readonly #masterVolume: number;
  readonly #contextFactory: () => AudioContext;
  readonly #layers: Map<SfxLayerId, LayerState> = new Map();

  #era: EraId;
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #phase: SfxMixerPhase = 'idle';
  #startPromise: Promise<void> | null = null;
  #abortController: AbortController | null = null;
  #eventTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SfxMixerOptions) {
    const missing = ERA_IDS.filter((id) => !options.buffers[id]);
    if (missing.length > 0) {
      throw new Error(`SfxMixer: buffers missing for era(s): ${missing.join(', ')}`);
    }
    this.#buffers = options.buffers;
    this.#era = options.initialEra ?? '1945';
    this.#crossfadeSeconds = clamp(
      options.crossfadeSeconds ?? DEFAULT_CROSSFADE_SECONDS,
      MIN_CROSSFADE_SECONDS,
      MAX_CROSSFADE_SECONDS,
    );
    this.#masterVolume = clamp(options.masterVolume ?? 0.8, MIN_AUDIBLE_GAIN, 1);
    this.#contextFactory = options.contextFactory ?? createDefaultContext;
  }

  /** Currently selected era (applied instantly before start, crossfaded after). */
  get era(): EraId {
    return this.#era;
  }

  /** True once layer graphs exist and loops are playing. */
  get isStarted(): boolean {
    return this.#phase === 'running';
  }

  get phase(): SfxMixerPhase {
    return this.#phase;
  }

  /** Effective crossfade window in seconds (already clamped). */
  get crossfadeDuration(): number {
    return this.#crossfadeSeconds;
  }

  /**
   * Select an era. Before start this only records the target (applied on
   * start); after start it triggers a bounded crossfade across all layers.
   * Unknown ids throw; calls after dispose are silently ignored so UI
   * teardown races cannot crash.
   */
  setEra(id: EraId): void {
    if (!(ERA_IDS as readonly string[]).includes(id)) {
      throw new RangeError(`SfxMixer.setEra: unknown era id "${String(id)}"`);
    }
    if (this.#phase === 'disposed' || id === this.#era) {
      return;
    }
    this.#era = id;
    if (this.#phase === 'running') {
      this.#crossfadeTo(id);
    }
  }

  /**
   * Idempotent startup: creates (or resumes) the AudioContext, builds the
   * layer graph and starts loops for the current era. Intended to be invoked
   * from a user-gesture handler to satisfy browser autoplay policies.
   */
  async ensureStarted(): Promise<void> {
    if (this.#phase === 'disposed') {
      throw new Error('SfxMixer.ensureStarted: mixer has been disposed.');
    }
    if (this.#phase === 'running' || this.#phase === 'starting') {
      return this.#startPromise ?? undefined;
    }
    this.#phase = 'starting';
    this.#startPromise = this.#start();
    return this.#startPromise;
  }

  /** Semantic alias for autoplay-policy unlock on the first user gesture. */
  handleUserGesture(): Promise<void> {
    return this.ensureStarted();
  }

  /**
   * Wire one-shot gesture listeners (pointerdown / touchstart / keydown) that
   * start the mixer. Returns a detach function; also detached on dispose().
   */
  attachGestureUnlock(target: Document | HTMLElement = document): () => void {
    this.detachGestureUnlock();
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;
    const handler = (): void => {
      void this.handleUserGesture();
      this.detachGestureUnlock();
    };
    for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
      target.addEventListener(type, handler, { signal, capture: true });
    }
    return () => this.detachGestureUnlock();
  }

  private detachGestureUnlock(): void {
    this.#abortController?.abort();
    this.#abortController = null;
  }

  async #start(): Promise<void> {
    let ctx: AudioContext;
    try {
      ctx = this.#contextFactory();
    } catch (error) {
      this.#phase = 'idle';
      this.#startPromise = null;
      throw error;
    }
    this.#ctx = ctx;

    try {
      // Autoplay policy: resume inside the gesture-initiated call chain.
      await ctx.resume().catch(() => undefined);
      if (this.#phase !== 'starting') {
        return; // disposed while awaiting resume
      }

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.#masterVolume, ctx.currentTime);
      master.connect(ctx.destination);
      this.#master = master;

      const era = this.#era;
      for (const layerId of SFX_LAYER_IDS) {
        const state = this.#createLayer(ctx, master, layerId);
        this.#layers.set(layerId, state);
        if (layerId !== 'events') {
          this.#startLoop(state, this.#buffers[era][layerId]);
        }
      }

      this.#phase = 'running';
      this.#scheduleNextEvent();
    } catch (error) {
      this.#phase = 'idle';
      this.#startPromise = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  #createLayer(ctx: AudioContext, master: GainNode, layerId: SfxLayerId): LayerState {
    const base = LAYER_BASE_GAIN[layerId];
    const active: GainNode = ctx.createGain();
    const inactive: GainNode = ctx.createGain();
    active.gain.setValueAtTime(base, ctx.currentTime);
    inactive.gain.setValueAtTime(MIN_AUDIBLE_GAIN, ctx.currentTime);
    active.connect(master);
    inactive.connect(master);
    return {
      gains: [active, inactive],
      currentGains: [base, MIN_AUDIBLE_GAIN],
      activeSlot: 0,
      voices: [new Set(), new Set()],
    };
  }

  #startLoop(state: LayerState, buffer: AudioBuffer): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const slot = state.activeSlot;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(state.gains[slot]);
    source.addEventListener('ended', () => {
      state.voices[slot].delete(source);
    });
    state.voices[slot].add(source);
    source.start(ctx.currentTime);
  }

  /**
   * Fade every layer from the outgoing era to the incoming era using
   * exponential ramps bounded by `crossfadeDuration` (≤ ~1.5 s).
   */
  #crossfadeTo(id: EraId): void {
    const ctx = this.#ctx;
    if (!ctx || this.#phase !== 'running') return;
    const now = ctx.currentTime;
    const end = now + this.#crossfadeSeconds;

    for (const layerId of SFX_LAYER_IDS) {
      const state = this.#layers.get(layerId);
      if (!state) continue;
      const out = state.activeSlot;
      const inc = (1 - out) as 0 | 1;

      const gOut = state.gains[out].gain;
      gOut.cancelScheduledValues(now);
      gOut.setValueAtTime(state.currentGains[out], now);
      gOut.exponentialRampToValueAtTime(MIN_AUDIBLE_GAIN, end);
      state.currentGains[out] = MIN_AUDIBLE_GAIN;

      const gInc = state.gains[inc].gain;
      gInc.cancelScheduledValues(now);
      gInc.setValueAtTime(state.currentGains[inc], now);
      gInc.exponentialRampToValueAtTime(LAYER_BASE_GAIN[layerId], end);
      state.currentGains[inc] = LAYER_BASE_GAIN[layerId];

      this.#retireVoices(state, out, end);
      // One-shots and loops both route through whichever slot is now live.
      state.activeSlot = inc;
      if (layerId !== 'events') {
        this.#startLoop(state, this.#buffers[id][layerId]);
      }
    }
  }

  #retireVoices(state: LayerState, slot: 0 | 1, endTime: number): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const voices = state.voices[slot];
    for (const source of voices) {
      source.addEventListener('ended', () => {
        try {
          source.disconnect();
        } catch {
          // Already disconnected.
        }
      });
      try {
        source.stop(endTime + 0.02);
      } catch {
        // Already stopped; nothing to retire.
      }
    }
    voices.clear();
  }

  /** Average spacing between one-shot street events for an era (seconds). */
  #eventInterval(era: EraId): number {
    return SFX_ERA_DATA[era].events.intervalSeconds;
  }

  #scheduleNextEvent(delayOverrideMs?: number): void {
    if (this.#phase !== 'running') return;
    const delayMs =
      delayOverrideMs ?? this.#eventInterval(this.#era) * 1000 * (0.5 + Math.random());
    this.#eventTimer = setTimeout(() => {
      if (this.#phase !== 'running') return;
      this.#playRandomEvent();
      this.#scheduleNextEvent();
    }, delayMs);
    unrefTimer(this.#eventTimer);
  }

  #playRandomEvent(): void {
    const ctx = this.#ctx;
    if (!ctx || this.#phase !== 'running') return;
    const events = this.#buffers[this.#era].events;
    if (events.length === 0) return;
    const state = this.#layers.get('events');
    if (!state) return;
    const slot = state.activeSlot;
    const buffer = events[Math.floor(Math.random() * events.length)];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(state.gains[slot]);
    source.addEventListener('ended', () => {
      state.voices[slot].delete(source);
    });
    state.voices[slot].add(source);
    source.start(ctx.currentTime);
  }

  /**
   * Stop all voices, tear down the graph and close the AudioContext.
   * Idempotent; safe to call from pagehide/unmount handlers.
   */
  dispose(): void {
    if (this.#phase === 'disposed') return;
    const wasStarting = this.#phase === 'starting';
    this.#phase = 'disposed';
    if (this.#eventTimer !== null) {
      clearTimeout(this.#eventTimer);
      this.#eventTimer = null;
    }
    this.detachGestureUnlock();

    const ctx = this.#ctx;
    if (!ctx || (!wasStarting && this.#layers.size === 0 && !this.#master)) {
      this.#layers.clear();
      return;
    }

    const now = ctx.currentTime;
    for (const state of this.#layers.values()) {
      for (const slot of [0, 1] as const) {
        state.gains[slot].gain.cancelScheduledValues(now);
        for (const source of state.voices[slot]) {
          try {
            source.stop(now);
          } catch {
            // Never started; ignore.
          }
          try {
            source.disconnect();
          } catch {
            // Already disconnected.
          }
        }
        state.voices[slot].clear();
        try {
          state.gains[slot].disconnect();
        } catch {
          // Already disconnected.
        }
      }
    }
    this.#layers.clear();

    if (this.#master) {
      try {
        this.#master.disconnect();
      } catch {
        // Already disconnected.
      }
      this.#master = null;
    }

    void ctx.close().catch(() => undefined);
    this.#ctx = null;
    this.#startPromise = null;
  }
}
