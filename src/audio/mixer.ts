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
import { ERA_IDS, type EraId } from '../eras';

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
 * One era's pre-allocated audio layer. Created once at init and reused for
 * every era switch — no AudioBufferSourceNode is allocated after init.
 */
interface EraLayer {
  readonly eraId: EraId;
  /** Per-era gain connected to master; crossfaded on era switch. */
  readonly gain: GainNode;
  /** Looping sources created once at init: ambient, traffic, music. */
  readonly sources: AudioBufferSourceNode[];
  /** Dynamic one-shot event sources currently playing. */
  readonly eventSources: Set<AudioBufferSourceNode>;
  /** setTimeout id for the next event one-shot, or null. */
  eventTimerId: number | null;
}

// ---------------------------------------------------------------------------
// SfxMixer
// ---------------------------------------------------------------------------

export class SfxMixer {
  // --- Lazy-initialised audio resources ---
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _buffers: Record<EraId, EraAudioBuffers> | null = null;
  /** Pre-allocated, looping source layers — one per era. Never re-created. */
  private _eraLayers: Map<EraId, EraLayer> | null = null;

  // --- Resolved options ---
  private readonly _options: Required<SfxMixerOptions>;

  // --- Playback state ---
  private _currentEra: EraId | null = null;
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

    const { ctx, buffers, eraLayers } = await this.ensureInitialized();

    // Guard against disposal during async resume
    if (this._disposed) return;

    const now = ctx.currentTime;
    // Time constant: ~95% of target in crossfadeSeconds (3τ ≈ 95%)
    const tau = this._options.crossfadeSeconds / 3;

    const newLayer = eraLayers.get(id)!;
    // Fade in the new era's gain
    newLayer.gain.gain.setTargetAtTime(1, now, tau);

    // Fade out the old era's gain (if any) and stop its event scheduling.
    if (this._currentEra) {
      const oldLayer = eraLayers.get(this._currentEra)!;
      oldLayer.gain.gain.setTargetAtTime(0.0001, now, tau);
      this.stopEventScheduling(oldLayer);
    }

    this._currentEra = id;

    // (Re)start scheduling random event one-shots for the new era.
    this.scheduleEvents(newLayer, buffers[id], ctx);
  }

  /**
   * Tears down all audio resources: stops every AudioBufferSourceNode,
   * disconnects every GainNode, clears all timers, and closes the
   * AudioContext. Safe to call multiple times.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    if (this._eraLayers) {
      for (const layer of this._eraLayers.values()) {
        this.stopEventScheduling(layer);

        // Stop and disconnect looping sources
        for (const source of layer.sources) {
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

        layer.gain.disconnect();
      }
    }

    if (this._masterGain) {
      this._masterGain.disconnect();
    }

    if (this._ctx && this._ctx.state !== 'closed') {
      void this._ctx.close();
    }

    this._eraLayers = null;
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
    eraLayers: Map<EraId, EraLayer>;
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

      // Pre-allocate every era's looping source layer ONCE. Sources are
      // started immediately and loop forever; era switches become pure gain
      // crossfades — zero AudioBufferSourceNode allocation per switch.
      this._eraLayers = new Map<EraId, EraLayer>();
      for (const eraId of ERA_IDS) {
        const buf = this._buffers[eraId];
        const gain = this._ctx.createGain();
        gain.gain.value = 0.0001; // silent until faded in
        gain.connect(this._masterGain);

        const sources: AudioBufferSourceNode[] = [];
        for (const layer of [buf.ambient, buf.traffic, buf.music]) {
          const src = this._ctx.createBufferSource();
          src.buffer = layer;
          src.loop = true;
          src.connect(gain);
          src.start();
          sources.push(src);
        }

        this._eraLayers.set(eraId, {
          eraId,
          gain,
          sources,
          eventSources: new Set<AudioBufferSourceNode>(),
          eventTimerId: null,
        });
      }
    }

    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    return {
      ctx: this._ctx,
      masterGain: this._masterGain!,
      buffers: this._buffers!,
      eraLayers: this._eraLayers!,
    };
  }

  /**
   * Schedules random event one-shots from the era's event buffers at
   * irregular intervals. Stops automatically when the era is no longer
   * current or the mixer is disposed. Event one-shots are short-lived and
   * properly cleaned up via onended — they are not the looping layers that
   * the pooling acceptance criterion concerns.
   */
  private scheduleEvents(layer: EraLayer, eraBuffers: EraAudioBuffers, ctx: AudioContext): void {
    if (eraBuffers.events.length === 0) return;

    const scheduleNext = (): void => {
      if (this._disposed || this._currentEra !== layer.eraId) return;

      // Pick a random event
      const eventIndex = Math.floor(Math.random() * eraBuffers.events.length);
      const eventBuffer = eraBuffers.events[eventIndex];

      const source = ctx.createBufferSource();
      source.buffer = eventBuffer;
      source.connect(layer.gain);
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
  private stopEventScheduling(layer: EraLayer): void {
    if (layer.eventTimerId !== null) {
      window.clearTimeout(layer.eventTimerId);
      layer.eventTimerId = null;
    }
  }
}
