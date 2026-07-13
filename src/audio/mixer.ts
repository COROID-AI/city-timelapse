// =============================================================================
// City Timelapse — Era-Aware Crossfade Mixer
//
// Plays the four procedural audio layers (ambient, traffic, events, music) for
// the current era and crossfades between eras using exponential gain ramps
// (setTargetAtTime) to avoid clicks. The AudioContext is created lazily and
// resumed on first user gesture, complying with browser autoplay policies.
//
// Usage:
//   const mixer = new SfxMixer();
//   // On first user gesture:
//   await mixer.resume();
//   // Switch eras:
//   await mixer.setEra('1985');
//   // Clean up:
//   mixer.dispose();
// =============================================================================

import { generateAllEraBuffers, type EraAudioBuffers } from './sfx';
import type { EraId } from '../eras';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for constructing an {@link SfxMixer}. */
export interface SfxMixerOptions {
  /** Crossfade duration in seconds. Gain reaches ~95% in this time. Default: 1.5. */
  readonly crossfadeSeconds?: number;
  /** Master output volume, 0..1. Default: 0.5. */
  readonly masterVolume?: number;
  /** Average seconds between random event one-shots. Default: 4. */
  readonly eventIntervalSeconds?: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * A currently-playing or fading-out era layer. Each layer owns its own
 * GainNode (connected to master) and a set of AudioBufferSourceNodes.
 */
interface ActiveLayer {
  readonly eraId: EraId;
  readonly layerGain: GainNode;
  /** Looping sources: ambient, traffic, music. */
  readonly loopSources: AudioBufferSourceNode[];
  /** Dynamic one-shot event sources currently playing. */
  readonly eventSources: Set<AudioBufferSourceNode>;
  /** setTimeout id for the next event one-shot, or null. */
  eventTimerId: number | null;
  /** setTimeout id for layer cleanup after crossfade, or null. */
  cleanupTimerId: number | null;
}

// ---------------------------------------------------------------------------
// SfxMixer
// ---------------------------------------------------------------------------

export class SfxMixer {
  // --- Lazy-initialised audio resources ---
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _buffers: Record<EraId, EraAudioBuffers> | null = null;

  // --- Resolved options ---
  private readonly _options: Required<SfxMixerOptions>;

  // --- Playback state ---
  private _currentEra: EraId | null = null;
  private _currentLayer: ActiveLayer | null = null;
  private _fadingLayers: ActiveLayer[] = [];
  private _disposed = false;

  constructor(options?: SfxMixerOptions) {
    this._options = {
      crossfadeSeconds: options?.crossfadeSeconds ?? 1.5,
      masterVolume: options?.masterVolume ?? 0.5,
      eventIntervalSeconds: options?.eventIntervalSeconds ?? 4,
    };
  }

  /** The era currently playing (or fading in). Null before the first setEra(). */
  get currentEra(): EraId | null {
    return this._currentEra;
  }

  /**
   * Creates the AudioContext (if not yet created) and resumes it. Should be
   * called on first user gesture to comply with browser autoplay policies.
   * Safe to call multiple times.
   */
  async resume(): Promise<void> {
    if (this._disposed) return;
    await this.ensureInitialized();
  }

  /**
   * Switches to a new era, crossfading all four layers over ~1.5s using
   * exponential gain ramps. If the same era is already playing, does nothing.
   * If the AudioContext hasn't been created yet, creates and resumes it first
   * (should be called from a user gesture handler).
   */
  async setEra(id: EraId): Promise<void> {
    if (this._disposed) return;
    if (this._currentEra === id) return;

    const { ctx, masterGain, buffers } = await this.ensureInitialized();

    // Guard against disposal during async resume
    if (this._disposed) return;

    const eraBuffers = buffers[id];

    // Create new layer (sources started, gain near-zero)
    const newLayer = this.createLayer(id, eraBuffers, ctx, masterGain);

    const now = ctx.currentTime;
    // Time constant: ~95% of target in crossfadeSeconds (3τ ≈ 95%)
    const tau = this._options.crossfadeSeconds / 3;

    // Fade in new layer
    newLayer.layerGain.gain.setTargetAtTime(1, now, tau);

    // Fade out current layer (if any)
    if (this._currentLayer) {
      const oldLayer = this._currentLayer;
      oldLayer.layerGain.gain.setTargetAtTime(0.0001, now, tau);
      this.stopEventScheduling(oldLayer);
      this._fadingLayers.push(oldLayer);

      // Schedule cleanup after crossfade completes
      const cleanupDelay = (this._options.crossfadeSeconds + 0.5) * 1000;
      oldLayer.cleanupTimerId = window.setTimeout(() => {
        this.cleanupLayer(oldLayer);
      }, cleanupDelay);
    }

    this._currentLayer = newLayer;
    this._currentEra = id;

    // Start scheduling random event one-shots
    this.scheduleEvents(newLayer, eraBuffers, ctx);
  }

  /**
   * Tears down all audio resources: stops every AudioBufferSourceNode,
   * disconnects every GainNode, clears all timers, and closes the
   * AudioContext. Safe to call multiple times.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    const allLayers = [this._currentLayer, ...this._fadingLayers].filter(
      (layer): layer is ActiveLayer => layer !== null,
    );

    for (const layer of allLayers) {
      this.stopEventScheduling(layer);

      if (layer.cleanupTimerId !== null) {
        window.clearTimeout(layer.cleanupTimerId);
        layer.cleanupTimerId = null;
      }

      // Stop and disconnect loop sources
      for (const source of layer.loopSources) {
        try {
          source.stop();
        } catch {
          // Source may have already stopped
        }
        source.disconnect();
      }

      // Stop and disconnect event sources
      for (const source of layer.eventSources) {
        try {
          source.stop();
        } catch {
          // Source may have already stopped
        }
        source.disconnect();
      }

      layer.layerGain.disconnect();
    }

    if (this._masterGain) {
      this._masterGain.disconnect();
    }

    if (this._ctx && this._ctx.state !== 'closed') {
      void this._ctx.close();
    }

    this._currentLayer = null;
    this._fadingLayers = [];
    this._currentEra = null;
    this._ctx = null;
    this._masterGain = null;
    this._buffers = null;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Lazily creates the AudioContext, master GainNode, and all era buffers,
   * then resumes the context if suspended. Returns the initialised resources.
   */
  private async ensureInitialized(): Promise<{
    ctx: AudioContext;
    masterGain: GainNode;
    buffers: Record<EraId, EraAudioBuffers>;
  }> {
    if (this._disposed) {
      throw new Error('[SfxMixer] Cannot use after dispose()');
    }

    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._options.masterVolume;
      this._masterGain.connect(this._ctx.destination);
      this._buffers = generateAllEraBuffers(this._ctx);
    }

    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    return {
      ctx: this._ctx,
      masterGain: this._masterGain!,
      buffers: this._buffers!,
    };
  }

  /**
   * Creates a new ActiveLayer with three looping sources (ambient, traffic,
   * music) started immediately. The layer gain is set to 0.0001 to avoid an
   * initial pop; the caller ramps it up via setTargetAtTime.
   */
  private createLayer(
    eraId: EraId,
    eraBuffers: EraAudioBuffers,
    ctx: AudioContext,
    masterGain: GainNode,
  ): ActiveLayer {
    // Create layer gain at near-zero to prevent initial pop
    const layerGain = ctx.createGain();
    layerGain.gain.value = 0.0001;
    layerGain.connect(masterGain);

    const loopSources: AudioBufferSourceNode[] = [];

    // Ambient
    const ambientSource = ctx.createBufferSource();
    ambientSource.buffer = eraBuffers.ambient;
    ambientSource.loop = true;
    ambientSource.connect(layerGain);
    ambientSource.start();
    loopSources.push(ambientSource);

    // Traffic
    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = eraBuffers.traffic;
    trafficSource.loop = true;
    trafficSource.connect(layerGain);
    trafficSource.start();
    loopSources.push(trafficSource);

    // Music
    const musicSource = ctx.createBufferSource();
    musicSource.buffer = eraBuffers.music;
    musicSource.loop = true;
    musicSource.connect(layerGain);
    musicSource.start();
    loopSources.push(musicSource);

    return {
      eraId,
      layerGain,
      loopSources,
      eventSources: new Set<AudioBufferSourceNode>(),
      eventTimerId: null,
      cleanupTimerId: null,
    };
  }

  /**
   * Schedules random event one-shots from the era's event buffers at
   * irregular intervals. Stops automatically when the layer is no longer
   * current or the mixer is disposed.
   */
  private scheduleEvents(layer: ActiveLayer, eraBuffers: EraAudioBuffers, ctx: AudioContext): void {
    if (eraBuffers.events.length === 0) return;

    const scheduleNext = (): void => {
      if (this._disposed || this._currentLayer !== layer) return;

      // Pick a random event
      const eventIndex = Math.floor(Math.random() * eraBuffers.events.length);
      const eventBuffer = eraBuffers.events[eventIndex];

      const source = ctx.createBufferSource();
      source.buffer = eventBuffer;
      source.connect(layer.layerGain);
      layer.eventSources.add(source);

      source.onended = () => {
        layer.eventSources.delete(source);
        source.disconnect();
      };

      source.start();

      // Schedule next event with randomised interval
      const interval = this._options.eventIntervalSeconds * (0.5 + Math.random());
      layer.eventTimerId = window.setTimeout(scheduleNext, interval * 1000);
    };

    // First event after a short delay
    layer.eventTimerId = window.setTimeout(scheduleNext, this._options.eventIntervalSeconds * 500);
  }

  /** Cancels the pending event one-shot timer for a layer. */
  private stopEventScheduling(layer: ActiveLayer): void {
    if (layer.eventTimerId !== null) {
      window.clearTimeout(layer.eventTimerId);
      layer.eventTimerId = null;
    }
  }

  /**
   * Stops and disconnects all sources and the layer gain for a fading-out
   * layer. Called after the crossfade completes.
   */
  private cleanupLayer(layer: ActiveLayer): void {
    this.stopEventScheduling(layer);

    for (const source of layer.loopSources) {
      try {
        source.stop();
      } catch {
        // Source may have already stopped
      }
      source.disconnect();
    }

    for (const source of layer.eventSources) {
      try {
        source.stop();
      } catch {
        // Source may have already stopped
      }
      source.disconnect();
    }

    layer.layerGain.disconnect();

    const index = this._fadingLayers.indexOf(layer);
    if (index >= 0) {
      this._fadingLayers.splice(index, 1);
    }
  }
}
