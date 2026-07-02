/**
 * Era-aware crossfade mixer for the City Time Period Timelapse.
 *
 * The mixer owns four looping layer groups — **ambient bed**, **traffic loop**,
 * **street-event one-shots**, and **music** — one set per era.  Calling
 * {@link SfxMixer.setEra} crossfades every layer to the target era's
 * pre-rendered buffers within a bounded, click-free exponential ramp window.
 *
 * Autoplay policy
 * ---------------
 * Browsers block audio until a user gesture.  The mixer is created in a
 * suspended state and only `resume()`s the `AudioContext` on the first call to
 * {@link SfxMixer.resume} (typically wired to a `pointerdown` / `keydown`
 * listener in the scene bootstrap).
 *
 * Architecture
 * ------------
 * Each era has a dedicated sub-graph:
 *
 *   ambientSource → ambientGain ─┐
 *   trafficSource → trafficGain ─┤
 *   musicSource   → musicGain   ─┤ → masterGain → destination
 *   eventBus      → eventGain   ─┘
 *
 * On `setEra()` the *old* era's gains are ramped to 0 and disconnected once
 * silent, while the *new* era's gains are ramped from 0 to their target
 * values.  One-shot events are scheduled on the active era's event bus using
 * a randomized timer that respects `eventInterval`.
 */

import { ERA_IDS, SFX_ERA_DATA, type EraId } from '../eras.js';
import { generateAllEraBuffers, type AllEraAudioBuffers } from './sfx.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options accepted by the {@link SfxMixer} constructor. */
export interface SfxMixerOptions {
  /** Master output volume 0–1 (default `0.8`). */
  readonly masterVolume?: number;
  /** Crossfade duration in seconds, clamped to [0.2, 3] (default `1.5`). */
  readonly crossfadeDuration?: number;
  /**
   * If `true` the mixer will lazily synthesise all era buffers on first
   * `setEra()` / `resume()` call.  If `false` (default) the caller is
   * responsible for providing buffers via {@link SfxMixer.loadBuffers}.
   */
  readonly autoGenerate?: boolean;
}

/** Internal per-era playback graph. */
interface EraGraph {
  readonly id: EraId;
  readonly ambientSource: AudioBufferSourceNode;
  readonly trafficSource: AudioBufferSourceNode;
  readonly musicSource: AudioBufferSourceNode;
  readonly ambientGain: GainNode;
  readonly trafficGain: GainNode;
  readonly eventGain: GainNode;
  readonly musicGain: GainNode;
  /** Shared bus that one-shot events connect through. */
  readonly eventBus: GainNode;
  /** All layer gains, ramped together on crossfade. */
  readonly layerGains: readonly GainNode[];
  /** Currently running event one-shot sources (for cleanup). */
  activeEventSources: Set<AudioBufferSourceNode>;
  /** Handle for the repeating event scheduler. */
  eventTimer: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum crossfade window (seconds). */
const MIN_FADE = 0.2;
/** Maximum crossfade window (seconds). */
const MAX_FADE = 3.0;
/** Epsilon used to avoid zero-gain exponential ramps (which click / do nothing). */
const GAIN_EPSILON = 0.0001;

// ---------------------------------------------------------------------------
// SfxMixer
// ---------------------------------------------------------------------------

/**
 * Era-aware audio mixer.  Create one instance, call {@link SfxMixer.resume}
 * after a user gesture, then drive era changes via {@link SfxMixer.setEra}.
 */
export class SfxMixer {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly fadeDuration: number;
  private readonly autoGenerate: boolean;

  private buffers: AllEraAudioBuffers | null = null;
  private graphs: Partial<Record<EraId, EraGraph>> = {};
  private currentEra: EraId | null = null;
  private disposed = false;

  /**
   * @param ctx The `AudioContext` to use.  The mixer does **not** create one
   *   so the caller can share a single context across the app.
   */
  constructor(ctx: AudioContext, options: SfxMixerOptions = {}) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = options.masterVolume ?? 0.8;
    this.masterGain.connect(ctx.destination);
    this.fadeDuration = clamp(options.crossfadeDuration ?? 1.5, MIN_FADE, MAX_FADE);
    this.autoGenerate = options.autoGenerate ?? false;
  }

  // -------------------------------------------------------------------------
  // Buffer loading
  // -------------------------------------------------------------------------

  /**
   * Inject pre-generated buffers (e.g. from `generateAllEraBuffers`).
   * Allows the caller to control *when* the (CPU-heavy) synthesis happens.
   */
  loadBuffers(buffers: AllEraAudioBuffers): void {
    this.assertNotDisposed();
    this.buffers = buffers;
  }

  /** Lazily generate all buffers if they have not been provided yet. */
  private ensureBuffers(): void {
    if (!this.buffers) {
      if (this.autoGenerate) {
        this.buffers = generateAllEraBuffers(this.ctx);
      } else {
        throw new Error('[SfxMixer] No buffers loaded. Call loadBuffers() or enable autoGenerate.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Autoplay / lifecycle
  // -------------------------------------------------------------------------

  /**
   * Resume the `AudioContext` — must be called from a user gesture handler
   * to satisfy browser autoplay policies.  Safe to call multiple times.
   * @returns A promise that resolves once the context is running.
   */
  async resume(): Promise<void> {
    this.assertNotDisposed();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.ensureBuffers();
  }

  /** The era currently being heard (most recent `setEra` target). */
  get era(): EraId | null {
    return this.currentEra;
  }

  // -------------------------------------------------------------------------
  // Era transitions
  // -------------------------------------------------------------------------

  /**
   * Crossfade to the target era within the bounded ramp window.
   *
   * The first call starts playback immediately (instant fade-in).  Subsequent
   * calls ramp the outgoing era's layers to silence while ramping the incoming
   * era's layers to their target gains.  Old era graphs are torn down once
   * they are inaudible.
   *
   * @param id Target era id.
   */
  setEra(id: EraId): void {
    this.assertNotDisposed();
    this.ensureBuffers();

    const now = this.ctx.currentTime;
    const fade = this.fadeDuration;

    // Fade out the previous era (if any)
    const prev = this.currentEra ? this.graphs[this.currentEra] : null;
    if (prev) {
      this.fadeOutGraph(prev, now, fade);
    }

    // Build / fetch the target era graph
    let next = this.graphs[id];
    if (!next) {
      next = this.buildEraGraph(id);
      this.graphs[id] = next;
    }

    // Fade in the target era
    this.fadeInGraph(next, now, fade);
    this.startEventScheduler(next);

    this.currentEra = id;
  }

  // -------------------------------------------------------------------------
  // Master volume
  // -------------------------------------------------------------------------

  /** Smoothly set the master output volume (0–1). */
  setMasterVolume(volume: number, rampSeconds = 0.3): void {
    this.assertNotDisposed();
    const now = this.ctx.currentTime;
    const g = this.masterGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(GAIN_EPSILON, g.value), now);
    g.linearRampToValueAtTime(clamp(volume, 0, 1), now + rampSeconds);
  }

  // -------------------------------------------------------------------------
  // Graph construction
  // -------------------------------------------------------------------------

  private buildEraGraph(id: EraId): EraGraph {
    if (!this.buffers) {
      throw new Error('[SfxMixer] Buffers missing — call loadBuffers() first.');
    }
    const buffers = this.buffers[id];
    const ctx = this.ctx;

    // --- Layer gains (start silent so we can fade in) ---------------------
    const ambientGain = ctx.createGain();
    ambientGain.gain.value = GAIN_EPSILON;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = GAIN_EPSILON;
    const eventGain = ctx.createGain();
    eventGain.gain.value = GAIN_EPSILON;
    const musicGain = ctx.createGain();
    musicGain.gain.value = GAIN_EPSILON;

    // --- Looping sources --------------------------------------------------
    const ambientSource = ctx.createBufferSource();
    ambientSource.buffer = buffers.ambient;
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);

    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = buffers.traffic;
    trafficSource.loop = true;
    trafficSource.connect(trafficGain);

    const musicSource = ctx.createBufferSource();
    musicSource.buffer = buffers.music;
    musicSource.loop = true;
    musicSource.connect(musicGain);

    // --- Event bus --------------------------------------------------------
    const eventBus = ctx.createGain();
    eventBus.connect(eventGain);

    // --- Connect layers to master -----------------------------------------
    ambientGain.connect(this.masterGain);
    trafficGain.connect(this.masterGain);
    eventGain.connect(this.masterGain);
    musicGain.connect(this.masterGain);

    // --- Start the looping sources now (they are silent) ------------------
    ambientSource.start();
    trafficSource.start();
    musicSource.start();

    return {
      id,
      ambientSource,
      trafficSource,
      musicSource,
      ambientGain,
      trafficGain,
      eventGain,
      musicGain,
      eventBus,
      layerGains: [ambientGain, trafficGain, eventGain, musicGain],
      activeEventSources: new Set(),
      eventTimer: null,
    };
  }

  // -------------------------------------------------------------------------
  // Crossfade helpers
  // -------------------------------------------------------------------------

  /** Ramp an era graph's layers **in** to their era-appropriate target gains. */
  private fadeInGraph(graph: EraGraph, now: number, fade: number): void {
    const data = SFX_ERA_DATA[graph.id];
    const targets = [
      data.ambientGain,
      data.trafficGain,
      data.eventGain,
      data.musicGain,
    ];
    graph.layerGains.forEach((g, i) => {
      const tgt = clamp(targets[i], 0, 1);
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(GAIN_EPSILON, now);
      g.gain.exponentialRampToValueAtTime(Math.max(GAIN_EPSILON, tgt), now + fade);
    });
  }

  /** Ramp an era graph's layers **out** to silence and tear it down. */
  private fadeOutGraph(graph: EraGraph, now: number, fade: number): void {
    // Stop scheduling events for the outgoing era
    this.stopEventScheduler(graph);

    for (const g of graph.layerGains) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(GAIN_EPSILON, g.gain.value), now);
      g.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + fade);
    }

    // Tear down after the fade completes
    const teardownDelay = (fade + 0.1) * 1000;
    window.setTimeout(() => {
      this.tearDownGraph(graph);
    }, teardownDelay);
  }

  // -------------------------------------------------------------------------
  // One-shot event scheduling
  // -------------------------------------------------------------------------

  /** Start the random one-shot scheduler for a graph. */
  private startEventScheduler(graph: EraGraph): void {
    this.stopEventScheduler(graph);
    const data = SFX_ERA_DATA[graph.id];
    if (!this.buffers) return;
    const buffers = this.buffers[graph.id];

    const scheduleNext = (): void => {
      if (this.disposed || this.currentEra !== graph.id) return;

      // Pick a random event buffer
      if (buffers.events.length > 0) {
        const idx = Math.floor(Math.random() * buffers.events.length);
        const buf = buffers.events[idx];
        this.fireOneShot(buf, graph);
      }

      // Randomise the next interval around the mean (±40%)
      const interval = data.eventInterval * (0.6 + Math.random() * 0.8);
      graph.eventTimer = window.setTimeout(scheduleNext, interval * 1000);
    };

    // First event after a short delay
    graph.eventTimer = window.setTimeout(scheduleNext, data.eventInterval * 500);
  }

  /** Stop the scheduler for a graph and clear pending timers. */
  private stopEventScheduler(graph: EraGraph): void {
    if (graph.eventTimer !== null) {
      window.clearTimeout(graph.eventTimer);
      graph.eventTimer = null;
    }
  }

  /** Play a single one-shot event buffer through the graph's event bus. */
  private fireOneShot(buffer: AudioBuffer, graph: EraGraph): void {
    if (this.disposed || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(graph.eventBus);
    src.start();
    graph.activeEventSources.add(src);
    src.onended = () => {
      graph.activeEventSources.delete(src);
    };
  }

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------

  /** Disconnect and stop all sources for a single era graph. */
  private tearDownGraph(graph: EraGraph): void {
    this.stopEventScheduler(graph);
    // Stop any still-running one-shots
    for (const src of graph.activeEventSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    graph.activeEventSources.clear();

    for (const s of [graph.ambientSource, graph.trafficSource, graph.musicSource]) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    for (const g of [...graph.layerGains, graph.eventBus]) {
      g.disconnect();
    }

    delete this.graphs[graph.id];
  }

  /**
   * Fully dispose of the mixer: stop all audio, disconnect all nodes, and
   * release resources.  The instance is unusable afterwards.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const id of ERA_IDS) {
      const graph = this.graphs[id];
      if (graph) this.tearDownGraph(graph);
    }
    this.graphs = {};

    this.masterGain.disconnect();
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('[SfxMixer] Instance has been disposed.');
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Clamp `v` into `[min, max]`. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
