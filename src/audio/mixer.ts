/**
 * Era-aware crossfade mixer.
 * Manages audio layers (ambient, traffic, events, music) and crossfades
 * between eras with smooth gain ramps.
 */
import type { EraId } from '../eras';
import type { EraAudioBuffers } from './sfx';
import { SFX_ERA_DATA } from '../eras';
import { generateAllEraBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume 0..1 */
  volume?: number;
  /** Whether audio starts muted */
  muted?: boolean;
  /** Crossfade duration in seconds */
  crossfadeDuration?: number;
}

interface Layer {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  buffer: AudioBuffer;
}

export class SfxMixer {
  private ctx: AudioContext;
  private options: Required<Omit<SfxMixerOptions, 'volume' | 'muted'>> & {
    volume: number;
    muted: boolean;
  };
  private buffers: Record<EraId, EraAudioBuffers>;
  private layers: Map<string, Layer> = new Map();
  private currentEra: EraId | null = null;
  private initialized = false;
  private eventTimers: number[] = [];

  constructor(ctx: AudioContext, options: SfxMixerOptions = {}) {
    this.ctx = ctx;
    this.options = {
      volume: options.volume ?? 0.7,
      muted: options.muted ?? false,
      crossfadeDuration: options.crossfadeDuration ?? 1.5,
    };
    this.buffers = generateAllEraBuffers(ctx);
  }

  /**
   * Initialize the mixer. Must be called after a user gesture to resume
   * the AudioContext (autoplay policy).
   */
  init(): void {
    if (this.initialized) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.initialized = true;
  }

  /**
   * Set the current era, crossfading from the previous era.
   * @param eraId Target era
   */
  setEra(eraId: EraId): void {
    if (!this.initialized) return;

    const prevEra = this.currentEra;
    void prevEra;
    this.currentEra = eraId;

    const eraData = SFX_ERA_DATA[eraId];

    // Crossfade ambient layer
    this.crossfadeLayer('ambient', this.buffers[eraId].ambient, eraData.ambientVolume);

    // Crossfade traffic layer
    this.crossfadeLayer('traffic', this.buffers[eraId].traffic, eraData.trafficVolume);

    // Start event scheduler for new era
    this.scheduleEvents(eraId);

    // Clean up old event timers
    this.cleanupEventTimers();
  }

  /**
   * Crossfade a specific audio layer to a new buffer.
   */
  private crossfadeLayer(layerName: string, newBuffer: AudioBuffer, targetVolume: number): void {
    const now = this.ctx.currentTime;
    const fadeDuration = this.options.crossfadeDuration;

    // Fade out existing layer
    const existing = this.layers.get(layerName);
    if (existing && existing.source) {
      existing.gain.gain.cancelScheduledValues(now);
      existing.gain.gain.setValueAtTime(existing.gain.gain.value, now);
      existing.gain.gain.exponentialRampToValueAtTime(0.001, now + fadeDuration);
      // Stop the old source after fade completes
      setTimeout(() => {
        if (existing.source) {
          existing.source.stop();
        }
      }, fadeDuration * 1000 + 50);
    }

    // Create new source
    const source = this.ctx.createBufferSource();
    source.buffer = newBuffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    const effectiveVolume = this.options.muted ? 0 : targetVolume * this.options.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(effectiveVolume, now + fadeDuration);

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);

    this.layers.set(layerName, { source, gain, buffer: newBuffer });
  }

  /**
   * Schedule random event one-shots for an era.
   */
  private scheduleEvents(eraId: EraId): void {
    const eraData = SFX_ERA_DATA[eraId];
    if (eraData.events.length === 0) return;

    // Schedule events at random intervals
    const scheduleNext = () => {
      if (this.currentEra !== eraId) return; // Era changed, stop scheduling

      const interval = 3 + Math.random() * 7; // 3-10 seconds between events
      const timer = window.setTimeout(() => {
        if (this.currentEra === eraId && !this.options.muted) {
          this.playRandomEvent(eraId);
        }
        scheduleNext();
      }, interval * 1000);
      this.eventTimers.push(timer);
    };

    scheduleNext();
  }

  /**
   * Play a random event one-shot from the era's event pool.
   */
  private playRandomEvent(eraId: EraId): void {
    const events = this.buffers[eraId].events;
    if (events.length === 0) return;

    const eventBuffer = events[Math.floor(Math.random() * events.length)];
    const source = this.ctx.createBufferSource();
    source.buffer = eventBuffer;

    const gain = this.ctx.createGain();
    const effectiveVolume = this.options.muted ? 0 : this.options.volume * 0.5;
    gain.gain.setValueAtTime(effectiveVolume, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();

    // Clean up after playback
    source.onended = () => {
      gain.disconnect();
      source.disconnect();
    };
  }

  private cleanupEventTimers(): void {
    for (const timer of this.eventTimers) {
      clearTimeout(timer);
    }
    this.eventTimers = [];
  }

  /**
   * Update master volume.
   */
  setVolume(volume: number): void {
    this.options.volume = Math.max(0, Math.min(1, volume));
    // Update all layer gains
    for (const layer of this.layers.values()) {
      const eraData = this.currentEra ? SFX_ERA_DATA[this.currentEra] : null;
      if (!eraData) continue;
      const targetVolume = this.options.muted ? 0 : layer === this.layers.get('ambient') ? eraData.ambientVolume : eraData.trafficVolume;
      const effectiveVolume = targetVolume * this.options.volume;
      layer.gain.gain.setTargetAtTime(effectiveVolume, this.ctx.currentTime, 0.01);
    }
  }

  /**
   * Toggle mute state.
   */
  setMuted(muted: boolean): void {
    this.options.muted = muted;
    for (const layer of this.layers.values()) {
      if (muted) {
        layer.gain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.05);
      } else {
        layer.gain.gain.setTargetAtTime(layer.gain.gain.value * 1.01, this.ctx.currentTime, 0.01);
      }
    }
  }

  /**
   * Dispose of all audio resources.
   */
  dispose(): void {
    this.cleanupEventTimers();
    for (const layer of this.layers.values()) {
      if (layer.source) {
        layer.source.stop();
        layer.source.disconnect();
      }
      layer.gain.disconnect();
    }
    this.layers.clear();
    this.buffers = {} as Record<EraId, EraAudioBuffers>;
  }
}
