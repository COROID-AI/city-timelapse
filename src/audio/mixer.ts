/**
 * mixer.ts — Era-Aware Crossfade Mixer
 *
 * Manages looping playback of the procedurally-generated AudioBuffers and
 * crossfades between era soundscapes when the user changes the timeline.
 *
 * Layers per era:
 *  - ambient bed   (continuous loop)
 *  - traffic loop   (continuous loop)
 *  - event one-shots (scheduled randomly)
 *  - music loop     (continuous loop)
 *
 * Crossfades use GainNode exponential ramps within a bounded ~1.5s window
 * to avoid clicks. The mixer respects browser autoplay policies by lazily
 * creating/resuming the AudioContext on the first user gesture.
 */

import { EraId, ERA_IDS, SFX_ERA_DATA } from '../eras';
import {
  EraAudioBuffers,
  generateAllEraBuffers,
} from './sfx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SfxMixerOptions {
  /** Crossfade duration in seconds. Defaults to 1.5. */
  crossfadeDuration?: number;
  /** Master output volume (0..1). Defaults to 0.8. */
  masterVolume?: number;
  /** Minimum interval between random event one-shots (seconds). Defaults to 3. */
  minEventInterval?: number;
  /** Maximum interval between random event one-shots (seconds). Defaults to 12. */
  maxEventInterval?: number;
}

/** Per-era set of audio nodes used by the mixer. */
interface EraLayerNodes {
  ambientSource: AudioBufferSourceNode;
  trafficSource: AudioBufferSourceNode;
  musicSource: AudioBufferSourceNode;
  ambientGain: GainNode;
  trafficGain: GainNode;
  musicGain: GainNode;
  eventGain: GainNode;
}

// ---------------------------------------------------------------------------
// SfxMixer
// ---------------------------------------------------------------------------

export class SfxMixer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers: Record<EraId, EraAudioBuffers> | null = null;

  /** Nodes for the currently-active era, keyed by era id. Only the active era's
   *  sources are playing; the rest are stopped. */
  private activeLayers: Map<EraId, EraLayerNodes> = new Map();

  /** The era currently being played (fully faded in). */
  private currentEra: EraId | null = null;

  /** The era we are crossfading FROM (fading out), if a transition is in progress. */
  private outgoingEra: EraId | null = null;

  private readonly options: Required<SfxMixerOptions>;

  /** Whether the AudioContext has been resumed (user gesture received). */
  private initialized = false;

  /** Timer handle for scheduling the next event one-shot. */
  private eventTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether the mixer has been disposed. */
  private disposed = false;

  /** Bound gesture handler for lazy init. */
  private readonly gestureHandler: () => void;

  constructor(options: SfxMixerOptions = {}) {
    this.options = {
      crossfadeDuration: 1.5,
      masterVolume: 0.8,
      minEventInterval: 3,
      maxEventInterval: 12,
      ...options,
    } as Required<SfxMixerOptions>;

    this.gestureHandler = () => this.init();
    // Listen for the first user gesture to satisfy autoplay policies.
    window.addEventListener('pointerdown', this.gestureHandler, { once: true });
    window.addEventListener('keydown', this.gestureHandler, { once: true });
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Initialize the AudioContext and pre-generate all era buffers.
   * Safe to call multiple times; only runs once. Called automatically on the
   * first user gesture, but can also be called explicitly.
   */
  init(): void {
    if (this.initialized || this.disposed) return;
    this.initialized = true;

    // Remove gesture listeners if still attached.
    window.removeEventListener('pointerdown', this.gestureHandler);
    window.removeEventListener('keydown', this.gestureHandler);

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    // Resume in case the context starts suspended.
    this.ctx.resume().catch(() => {
      /* Autoplay may block until gesture; ignore. */
    });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.options.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate all era buffers.
    this.buffers = generateAllEraBuffers(this.ctx);
  }

  /**
   * Ensure the context is running. Call from a user-gesture handler if needed.
   */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        /* ignore */
      });
    }
  }

  // -----------------------------------------------------------------------
  // Era switching with crossfade
  // -----------------------------------------------------------------------

  /**
   * Switch to a new era, crossfading all layers over the configured duration.
   */
  setEra(id: EraId): void {
    if (this.disposed) return;
    if (!this.initialized) this.init();
    if (!this.ctx || !this.buffers || !this.masterGain) return;

    // If already on this era, do nothing (unless a transition was in flight).
    if (this.currentEra === id && this.outgoingEra === null) return;

    // If this era is already the outgoing one (mid-transition), cancel.
    if (this.outgoingEra === id) return;

    const now = this.ctx.currentTime;
    const fade = this.options.crossfadeDuration;

    // Fade out the current era's layers.
    if (this.currentEra) {
      this.fadeOutEra(this.currentEra, now, fade);
      this.outgoingEra = this.currentEra;
    }

    // Fade in (or start) the new era's layers.
    this.fadeInEra(id, now, fade);

    this.currentEra = id;

    // Schedule cleanup of outgoing nodes after the fade completes.
    if (this.outgoingEra) {
      const outgoing = this.outgoingEra;
      setTimeout(() => {
        this.stopEraNodes(outgoing);
        if (this.outgoingEra === outgoing) {
          this.outgoingEra = null;
        }
      }, (fade + 0.2) * 1000);
    }

    // Restart event scheduling for the new era.
    this.scheduleNextEvent();
  }

  /** Get the currently active era, or null if none has been set. */
  getEra(): EraId | null {
    return this.currentEra;
  }

  // -----------------------------------------------------------------------
  // Layer management
  // -----------------------------------------------------------------------

  /** Create and start the source nodes for an era (if not already running). */
  private fadeInEra(id: EraId, now: number, fade: number): void {
    if (!this.ctx || !this.buffers || !this.masterGain) return;
    const buf = this.buffers[id];
    const sfx = SFX_ERA_DATA[id];

    let layer = this.activeLayers.get(id);
    if (!layer) {
      layer = this.createEraLayer(id, buf);
      this.activeLayers.set(id, layer);
    }

    // Start sources if not already started.
    try {
      layer.ambientSource.start();
    } catch {
      /* already started */
    }
    try {
      layer.trafficSource.start();
    } catch {
      /* already started */
    }
    try {
      layer.musicSource.start();
    } catch {
      /* already started */
    }

    // Ramp gains up from ~0 to target values.
    const rampTime = now + fade;
    this.rampGain(layer.ambientGain, sfx.ambientGain, now, rampTime);
    this.rampGain(layer.trafficGain, sfx.traffic.gain, now, rampTime);
    this.rampGain(layer.musicGain, sfx.music.gain, now, rampTime);
    this.rampGain(layer.eventGain, 0.5, now, rampTime);
  }

  /** Ramp an era's gains down toward 0. */
  private fadeOutEra(id: EraId, now: number, fade: number): void {
    const layer = this.activeLayers.get(id);
    if (!layer) return;
    const rampTime = now + fade;
    this.rampGain(layer.ambientGain, 0, now, rampTime);
    this.rampGain(layer.trafficGain, 0, now, rampTime);
    this.rampGain(layer.musicGain, 0, now, rampTime);
    this.rampGain(layer.eventGain, 0, now, rampTime);
  }

  /** Create the source + gain nodes for an era. */
  private createEraLayer(id: EraId, buf: EraAudioBuffers): EraLayerNodes {
    const ctx = this.ctx!;
    const master = this.masterGain!;

    const ambientSource = ctx.createBufferSource();
    ambientSource.buffer = buf.ambient;
    ambientSource.loop = true;
    const ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientSource.connect(ambientGain).connect(master);

    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = buf.traffic;
    trafficSource.loop = true;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = 0;
    trafficSource.connect(trafficGain).connect(master);

    const musicSource = ctx.createBufferSource();
    musicSource.buffer = buf.music;
    musicSource.loop = true;
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicSource.connect(musicGain).connect(master);

    const eventGain = ctx.createGain();
    eventGain.gain.value = 0;
    eventGain.connect(master);

    void id;
    return {
      ambientSource,
      trafficSource,
      musicSource,
      ambientGain,
      trafficGain,
      musicGain,
      eventGain,
    };
  }

  /** Stop and disconnect all nodes for an era. */
  private stopEraNodes(id: EraId): void {
    const layer = this.activeLayers.get(id);
    if (!layer) return;
    try {
      layer.ambientSource.stop();
    } catch {
      /* already stopped */
    }
    try {
      layer.trafficSource.stop();
    } catch {
      /* already stopped */
    }
    try {
      layer.musicSource.stop();
    } catch {
      /* already stopped */
    }
    layer.ambientSource.disconnect();
    layer.trafficSource.disconnect();
    layer.musicSource.disconnect();
    layer.ambientGain.disconnect();
    layer.trafficGain.disconnect();
    layer.musicGain.disconnect();
    layer.eventGain.disconnect();
    this.activeLayers.delete(id);
  }

  // -----------------------------------------------------------------------
  // Event one-shot scheduling
  // -----------------------------------------------------------------------

  /** Schedule the next random event one-shot for the current era. */
  private scheduleNextEvent(): void {
    if (this.eventTimer) clearTimeout(this.eventTimer);
    if (this.disposed || !this.currentEra || !this.ctx || !this.buffers) return;

    const { minEventInterval, maxEventInterval } = this.options;
    const delay = minEventInterval + Math.random() * (maxEventInterval - minEventInterval);

    this.eventTimer = setTimeout(() => {
      this.playRandomEvent();
      this.scheduleNextEvent();
    }, delay * 1000);
  }

  /** Play a random event one-shot from the current era. */
  private playRandomEvent(): void {
    if (!this.ctx || !this.buffers || !this.currentEra || !this.masterGain) return;
    const buf = this.buffers[this.currentEra];
    const sfx = SFX_ERA_DATA[this.currentEra];
    if (buf.events.length === 0) return;

    // Weighted random selection.
    const totalWeight = sfx.events.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < sfx.events.length; i++) {
      r -= sfx.events[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }

    const eventBuf = buf.events[idx];
    const source = this.ctx.createBufferSource();
    source.buffer = eventBuf;
    source.loop = false;

    // Use the active era's event gain for crossfade consistency.
    const layer = this.activeLayers.get(this.currentEra);
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.6;
    source.connect(gainNode);
    if (layer) {
      gainNode.connect(layer.eventGain);
    } else {
      gainNode.connect(this.masterGain);
    }

    source.start();
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
  }

  // -----------------------------------------------------------------------
  // Gain ramping helper
  // -----------------------------------------------------------------------

  /**
   * Smoothly ramp a GainNode's value using exponential ramp (click-free).
   * Uses setTargetAtTime for a natural-sounding transition.
   */
  private rampGain(gain: GainNode, target: number, now: number, endTime: number): void {
    const duration = Math.max(0.01, endTime - now);
    // setTargetAtTime provides an exponential approach — click-free.
    // Time constant = duration / 3 for ~95% completion within duration.
    const timeConstant = duration / 3;
    gain.gain.setTargetAtTime(Math.max(0.0001, target), now, timeConstant);
  }

  // -----------------------------------------------------------------------
  // Master volume & cleanup
  // -----------------------------------------------------------------------

  /** Set the master output volume (0..1). */
  setMasterVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, volume),
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  /** Clean up all audio nodes, timers, and the AudioContext. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.eventTimer) {
      clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }

    window.removeEventListener('pointerdown', this.gestureHandler);
    window.removeEventListener('keydown', this.gestureHandler);

    for (const id of ERA_IDS) {
      this.stopEraNodes(id);
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.ctx) {
      this.ctx.close().catch(() => {
        /* ignore */
      });
      this.ctx = null;
    }

    this.buffers = null;
    this.currentEra = null;
    this.outgoingEra = null;
  }
}
