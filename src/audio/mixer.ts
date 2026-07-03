/**
 * Era-aware crossfade mixer for the City Time Period Timelapse.
 *
 * The mixer manages a layered audio graph for the current era:
 *
 * - **Ambient bed** — a looping low-frequency drone.
 * - **Traffic loop** — a looping engine/street sound.
 * - **Music bed** — a short looping musical motif.
 * - **Event one-shots** — randomly scheduled short sounds (horns, bells, etc.).
 *
 * When the era changes via {@link SfxMixer.setEra}, all looping layers are
 * crossfaded over ~1.5 seconds using exponential gain ramps (which avoid the
 * audible clicks that linear ramps produce at non-zero crossings). The old
 * era's buffers are stopped and disconnected once the crossfade completes.
 *
 * The mixer respects the browser's autoplay policy: the `AudioContext` is
 * created in a suspended state and only resumed on the first user gesture
 * (call {@link SfxMixer.resume} from a click/touch/keydown handler).
 */

import type { EraId } from '../eras/types.js';
import { getEra } from '../eras/types.js';
import {
  getEraAudioBuffers,
  getEventInterval,
  type EraAudioBuffers,
} from './sfx.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration options for the {@link SfxMixer}. */
export interface SfxMixerOptions {
  /** Crossfade duration in seconds when switching eras. Default: 1.5. */
  crossfadeDuration?: number;
  /** Master output gain (0–1). Default: 0.8. */
  masterGain?: number;
  /** Whether to auto-schedule event one-shots. Default: true. */
  autoScheduleEvents?: boolean;
  /** Jitter factor (0–1) applied to event scheduling for natural variation. Default: 0.3. */
  eventJitter?: number;
}

/**
 * The state of a single looping audio layer within the mixer.
 *
 * Each layer has its own gain node (for crossfading) and source node
 * (the looping `AudioBufferSourceNode`).
 */
interface LayerState {
  /** The gain node controlling this layer's volume. */
  gain: GainNode;
  /** The currently playing source (null when stopped). */
  source: AudioBufferSourceNode | null;
}

/**
 * Per-era audio layer set. All four layers are crossfaded together when
 * the era changes.
 */
interface EraLayers {
  ambient: LayerState;
  traffic: LayerState;
  music: LayerState;
  /** The event buffers for this era (played as one-shots, not looped). */
  events: AudioBuffer[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum gain value for exponential ramps (avoids errors at 0). */
const MIN_GAIN = 0.0001;

/** Default crossfade duration in seconds. */
const DEFAULT_CROSSFADE = 1.5;

/** Default master gain. */
const DEFAULT_MASTER_GAIN = 0.8;

// ---------------------------------------------------------------------------
// SfxMixer class
// ---------------------------------------------------------------------------

/**
 * An era-aware audio mixer that crossfades between decade-appropriate
 * soundscapes.
 *
 * Usage:
 * ```ts
 * const mixer = new SfxMixer();
 * // On first user gesture:
 * mixer.resume();
 * // Switch to an era:
 * mixer.setEra('1965');
 * // Each frame:
 * mixer.update(deltaTime);
 * // Cleanup:
 * mixer.dispose();
 * ```
 */
export class SfxMixer {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly destination: AudioNode;

  private readonly crossfadeDuration: number;
  private readonly autoScheduleEvents: boolean;
  private readonly _eventJitter: number;

  /** Currently active era layers (the ones being heard). */
  private currentLayers: EraLayers | null = null;
  /** Layers being faded out (from the previous era). */
  private fadingOutLayers: EraLayers | null = null;
  /** The currently active era id. */
  private currentEraId: EraId | null = null;

  /** Event scheduling state. */
  private eventTimer = 0;
  private eventInterval = 6;
  private eventIndex = 0;

  /** Whether the mixer has been disposed. */
  private disposed = false;

  /** Bound resume handler (for one-time autoplay unlock). */
  private resumeHandler: (() => void) | null = null;

  constructor(options: SfxMixerOptions = {}) {
    this.crossfadeDuration = options.crossfadeDuration ?? DEFAULT_CROSSFADE;
    this.autoScheduleEvents = options.autoScheduleEvents ?? true;
    this._eventJitter = options.eventJitter ?? 0.3;

    // Create AudioContext (will be suspended until user gesture per autoplay policy)
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();

    // Master gain -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = options.masterGain ?? DEFAULT_MASTER_GAIN;
    this.destination = this.masterGain;
    this.masterGain.connect(this.ctx.destination);

    // Attach a one-time resume handler for autoplay policy
    this.resumeHandler = (): void => {
      void this.resume();
    };
    window.addEventListener('pointerdown', this.resumeHandler, { once: true });
    window.addEventListener('keydown', this.resumeHandler, { once: true });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Resume the AudioContext after a user gesture.
   * This is required by browser autoplay policies.
   */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    // Remove the one-time listeners if still attached
    if (this.resumeHandler) {
      window.removeEventListener('pointerdown', this.resumeHandler);
      window.removeEventListener('keydown', this.resumeHandler);
      this.resumeHandler = null;
    }
  }

  /**
   * Set the current era, crossfading all audio layers.
   *
   * If the AudioContext is suspended (no user gesture yet), the layers are
   * prepared but will remain silent until {@link resume} is called.
   *
   * @param eraId  The era to switch to.
   */
  setEra(eraId: EraId): void {
    if (this.disposed) return;
    if (this.currentEraId === eraId) return;

    const era = getEra(eraId);
    const buffers = getEraAudioBuffers(this.ctx, eraId);

    // If we have existing layers, start fading them out
    if (this.currentLayers) {
      this.fadeOutLayers(this.currentLayers);
      this.fadingOutLayers = this.currentLayers;
    }

    // Create new layers for the incoming era
    const newLayers = this.createEraLayers(buffers);
    this.currentLayers = newLayers;
    this.currentEraId = eraId;

    // Update event scheduling
    this.eventInterval = getEventInterval(era);
    this.eventTimer = 0;
    this.eventIndex = 0;

    // Fade in the new layers
    this.fadeInLayers(newLayers);
  }

  /**
   * Per-frame update. Must be called every frame to schedule event one-shots.
   *
   * @param deltaTime  Time since the last frame, in seconds.
   */
  update(deltaTime: number): void {
    if (this.disposed || !this.currentLayers || !this.autoScheduleEvents) return;
    if (this.ctx.state !== 'running') return;

    this.eventTimer += deltaTime;
    if (this.eventTimer >= this.eventInterval) {
      this.eventTimer = -this._eventJitter * this.eventInterval * Math.random();
      this.playRandomEvent();
    }
  }

  /**
   * Play a random one-shot event from the current era.
   */
  playRandomEvent(): void {
    if (!this.currentLayers || this.currentLayers.events.length === 0) return;
    const buf = this.currentLayers.events[this.eventIndex % this.currentLayers.events.length]!;
    this.eventIndex++;
    this.playOneShot(buf);
  }

  /**
   * Play a specific one-shot buffer immediately.
   * @param buffer  The AudioBuffer to play.
   */
  playOneShot(buffer: AudioBuffer): void {
    if (this.disposed) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(this.destination);
    source.start();
    // Auto-disconnect when done
    source.onended = (): void => {
      source.disconnect();
    };
  }

  /**
   * Set the master output volume.
   * @param volume  Target volume (0–1).
   */
  setVolume(volume: number): void {
    const t = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(Math.max(MIN_GAIN, this.masterGain.gain.value), t);
    this.masterGain.gain.exponentialRampToValueAtTime(
      Math.max(MIN_GAIN, volume),
      t + 0.3,
    );
  }

  /** The current era id, or `null` if no era has been set. */
  get eraId(): EraId | null {
    return this.currentEraId;
  }

  /** Whether the AudioContext is currently running. */
  get isRunning(): boolean {
    return this.ctx.state === 'running';
  }

  /** The underlying AudioContext (exposed for advanced use). */
  get audioContext(): AudioContext {
    return this.ctx;
  }

  /**
   * Dispose all resources: stop all sources, disconnect nodes, close the
   * AudioContext, and remove event listeners.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Stop all layers
    if (this.currentLayers) {
      this.stopLayers(this.currentLayers);
      this.currentLayers = null;
    }
    if (this.fadingOutLayers) {
      this.stopLayers(this.fadingOutLayers);
      this.fadingOutLayers = null;
    }

    // Remove resume handler
    if (this.resumeHandler) {
      window.removeEventListener('pointerdown', this.resumeHandler);
      window.removeEventListener('keydown', this.resumeHandler);
      this.resumeHandler = null;
    }

    // Disconnect master and close context
    try {
      this.masterGain.disconnect();
    } catch {
      // Already disconnected
    }
    void this.ctx.close();
  }

  // -------------------------------------------------------------------------
  // Private: layer management
  // -------------------------------------------------------------------------

  /**
   * Create the four audio layers for an era and start them playing (at gain 0).
   */
  private createEraLayers(buffers: EraAudioBuffers): EraLayers {
    const ambient = this.createLoopLayer(buffers.ambient);
    const traffic = this.createLoopLayer(buffers.traffic);
    const music = this.createLoopLayer(buffers.music);

    return {
      ambient,
      traffic,
      music,
      events: buffers.events,
    };
  }

  /**
   * Create a single looping layer: a source node connected through a gain node.
   * The gain starts at 0 so we can fade it in.
   */
  private createLoopLayer(buffer: AudioBuffer): LayerState {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.destination);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    return { gain, source };
  }

  /**
   * Fade in all layers of an era set to their target gains.
   */
  private fadeInLayers(layers: EraLayers): void {
    const t = this.ctx.currentTime;
    const dur = this.crossfadeDuration;
    const era = this.currentEraId ? getEra(this.currentEraId) : null;
    if (!era) return;

    this.rampGain(layers.ambient.gain, era.sfx.ambientGain, t, dur);
    this.rampGain(layers.traffic.gain, era.sfx.trafficGain, t, dur);
    this.rampGain(layers.music.gain, era.sfx.musicGain, t, dur);
  }

  /**
   * Fade out all layers of an era set to silence, then stop and disconnect.
   */
  private fadeOutLayers(layers: EraLayers): void {
    const t = this.ctx.currentTime;
    const dur = this.crossfadeDuration;

    this.rampGain(layers.ambient.gain, 0, t, dur);
    this.rampGain(layers.traffic.gain, 0, t, dur);
    this.rampGain(layers.music.gain, 0, t, dur);

    // Schedule stop after crossfade completes
    const stopTime = t + dur + 0.1;
    this.scheduleLayerStop(layers.ambient, stopTime);
    this.scheduleLayerStop(layers.traffic, stopTime);
    this.scheduleLayerStop(layers.music, stopTime);
  }

  /**
   * Exponentially ramp a gain node from its current value to a target.
   * Uses `exponentialRampToValueAtTime` to avoid clicks.
   */
  private rampGain(gain: GainNode, target: number, startTime: number, duration: number): void {
    gain.gain.cancelScheduledValues(startTime);
    // Set the starting value to the current value (or MIN_GAIN if at 0)
    const currentVal = Math.max(MIN_GAIN, gain.gain.value);
    gain.gain.setValueAtTime(currentVal, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIN_GAIN, target),
      startTime + duration,
    );
  }

  /**
   * Schedule a source to stop and disconnect at a future time.
   */
  private scheduleLayerStop(layer: LayerState, stopTime: number): void {
    if (!layer.source) return;
    try {
      layer.source.stop(stopTime);
    } catch {
      // Already stopped
    }
    layer.source.onended = (): void => {
      try {
        layer.gain.disconnect();
      } catch {
        // Already disconnected
      }
    };
  }

  /**
   * Immediately stop and disconnect all layers in an era set.
   */
  private stopLayers(layers: EraLayers): void {
    this.stopLayer(layers.ambient);
    this.stopLayer(layers.traffic);
    this.stopLayer(layers.music);
  }

  /** Immediately stop a single layer. */
  private stopLayer(layer: LayerState): void {
    if (layer.source) {
      try {
        layer.source.stop();
      } catch {
        // Already stopped
      }
      try {
        layer.source.disconnect();
      } catch {
        // Already disconnected
      }
      layer.source = null;
    }
    try {
      layer.gain.disconnect();
    } catch {
      // Already disconnected
    }
  }
}
