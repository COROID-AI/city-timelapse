/**
 * Era-aware crossfade mixer for procedural SFX.
 *
 * Manages four looping layers — ambient bed, traffic loop, event one-shots,
 * and music — and crossfades between era-specific buffer sets using
 * GainNode exponential ramps. Respects the browser autoplay policy by
 * deferring AudioContext resume until the first user gesture.
 */

import type { EraId } from '../eras.js';
import { getSfxEraData } from '../eras.js';
import {
  generateAllEraBuffers,
  clearEraBufferCache,
  type EraAudioBuffers,
} from './sfx.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SfxMixerOptions {
  /** Master output volume 0–1. Default 0.6. */
  readonly masterVolume?: number;
  /** Crossfade duration in seconds. Default 1.5. */
  readonly crossfadeDuration?: number;
  /** Ambient layer volume 0–1. Default 0.4. */
  readonly ambientVolume?: number;
  /** Traffic layer volume 0–1. Default 0.3. */
  readonly trafficVolume?: number;
  /** Event layer volume 0–1. Default 0.5. */
  readonly eventVolume?: number;
  /** Music layer volume 0–1. Default 0.2. */
  readonly musicVolume?: number;
}

interface LayerNodes {
  readonly gain: GainNode;
  readonly source: AudioBufferSourceNode | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SfxMixer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A four-layer procedural audio mixer that crossfades between eras.
 *
 * Usage:
 *   const mixer = new SfxMixer();
 *   await mixer.init();      // call on first user gesture
 *   mixer.setEra('1985');   // crossfades to 1985 sounds
 *   mixer.dispose();
 */
export class SfxMixer {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly layers: {
    ambient: LayerNodes;
    traffic: LayerNodes;
    events: GainNode;
    music: GainNode;
  };

  private readonly options: Required<SfxMixerOptions>;
  private buffers: Record<EraId, EraAudioBuffers> | null = null;
  private currentEra: EraId | null = null;
  private eventTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(options: SfxMixerOptions = {}) {
    this.options = {
      masterVolume: options.masterVolume ?? 0.6,
      crossfadeDuration: options.crossfadeDuration ?? 1.5,
      ambientVolume: options.ambientVolume ?? 0.4,
      trafficVolume: options.trafficVolume ?? 0.3,
      eventVolume: options.eventVolume ?? 0.5,
      musicVolume: options.musicVolume ?? 0.2,
    };

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error('[SfxMixer] Web Audio API not supported');
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.options.masterVolume;
    this.master.connect(this.ctx.destination);

    this.layers = {
      ambient: this.createLayer(this.options.ambientVolume),
      traffic: this.createLayer(this.options.trafficVolume),
      events: this.createGainLayer(this.options.eventVolume),
      music: this.createGainLayer(this.options.musicVolume),
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialise the mixer. Must be called from a user-gesture handler to
   * satisfy autoplay policies. Generates all era buffers and starts the
   * initial era's loops.
   */
  async init(startEra: EraId = '1945'): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.buffers) {
      this.buffers = generateAllEraBuffers(this.ctx);
    }
    this.startEraLoops(startEra);
  }

  /**
   * Resume the AudioContext (call from a user gesture if it was suspended).
   */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Crossfade to a new era's audio. Layers that are already playing fade out
   * while the new era's layers fade in, using exponential ramps to avoid clicks.
   */
  setEra(era: EraId): void {
    if (this.disposed) return;
    if (!this.buffers) {
      // Not yet initialised — generate on demand
      this.buffers = generateAllEraBuffers(this.ctx);
    }

    if (this.currentEra === era) return;
    this.currentEra = era;

    const now = this.ctx.currentTime;
    const xfade = this.options.crossfadeDuration;
    const buffers = this.buffers[era];

    // Fade out existing loop sources and swap
    this.swapLayerSource('ambient', buffers.ambient, now, xfade);
    this.swapLayerSource('traffic', buffers.traffic, now, xfade);

    // Restart event scheduling for the new era
    this.scheduleEvents(era);
  }

  /** Get the currently active era, or null if not started. */
  getEra(): EraId | null {
    return this.currentEra;
  }

  /** Set the master output volume (0–1). */
  setMasterVolume(volume: number): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)),
      now + 0.1,
    );
  }

  /** Tear down all audio nodes and free resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.eventTimer) {
      clearInterval(this.eventTimer);
      this.eventTimer = null;
    }

    this.stopLayerSource('ambient');
    this.stopLayerSource('traffic');

    clearEraBufferCache(this.ctx);

    this.master.disconnect();
    this.ctx.close().catch(() => {
      // ignore close errors
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private createLayer(_volume: number): LayerNodes {
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // start silent, ramp in
    gain.connect(this.master);
    return { gain, source: null };
  }

  private createGainLayer(volume: number): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this.master);
    return gain;
  }

  private startEraLoops(era: EraId): void {
    if (!this.buffers) return;
    this.currentEra = era;
    const buffers = this.buffers[era];
    const now = this.ctx.currentTime;

    this.startLayerSource('ambient', buffers.ambient, now, this.options.ambientVolume);
    this.startLayerSource('traffic', buffers.traffic, now, this.options.trafficVolume);
    this.scheduleEvents(era);
  }

  private startLayerSource(
    layerKey: 'ambient' | 'traffic',
    buffer: AudioBuffer,
    now: number,
    targetVolume: number,
  ): void {
    const layer = this.layers[layerKey];
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(layer.gain);
    source.start(0);
    (this.layers[layerKey] as { source: AudioBufferSourceNode | null }).source = source;

    // Ramp in
    layer.gain.gain.cancelScheduledValues(now);
    layer.gain.gain.setValueAtTime(0.0001, now);
    layer.gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, targetVolume),
      now + this.options.crossfadeDuration,
    );
  }

  private swapLayerSource(
    layerKey: 'ambient' | 'traffic',
    buffer: AudioBuffer,
    now: number,
    xfade: number,
  ): void {
    const layer = this.layers[layerKey];

    // Fade out old source
    if (layer.source) {
      const old = layer.source;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
      layer.gain.gain.exponentialRampToValueAtTime(0.0001, now + xfade * 0.8);
      old.stop(now + xfade);
      (this.layers[layerKey] as { source: AudioBufferSourceNode | null }).source = null;
    }

    // Start new source with a fresh gain ramp on a dedicated gain node
    const targetVolume =
      layerKey === 'ambient' ? this.options.ambientVolume : this.options.trafficVolume;
    this.startLayerSource(layerKey, buffer, now, targetVolume);
  }

  private stopLayerSource(layerKey: 'ambient' | 'traffic'): void {
    const layer = this.layers[layerKey];
    if (layer.source) {
      try {
        layer.source.stop();
      } catch {
        // already stopped
      }
      layer.source.disconnect();
      (this.layers[layerKey] as { source: AudioBufferSourceNode | null }).source = null;
    }
  }

  private scheduleEvents(era: EraId): void {
    if (this.eventTimer) {
      clearInterval(this.eventTimer);
      this.eventTimer = null;
    }

    const data = getSfxEraData(era);
    if (data.events.length === 0) return;

    // Use the shortest interval as the poll frequency
    const minInterval = Math.min(...data.events.map((e) => e.interval));
    const pollMs = Math.max(500, (minInterval / 2) * 1000);

    this.eventTimer = setInterval(() => {
      if (this.disposed || !this.buffers || this.currentEra !== era) return;
      const buffers = this.buffers[era];
      for (let i = 0; i < data.events.length; i++) {
        const ev = data.events[i];
        // Probabilistic trigger based on interval
        if (Math.random() < (pollMs / 1000) / ev.interval) {
          const buf = buffers.events[i % buffers.events.length];
          if (buf) this.playEventOneShot(buf);
        }
      }
    }, pollMs);
  }

  private playEventOneShot(buffer: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.layers.events);
    source.start();
    source.onended = () => {
      source.disconnect();
    };
  }
}
