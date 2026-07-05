// src/audio/mixer.ts
// Era-aware crossfade mixer for ambient audio

import { EraId } from '../eras';
import { EraAudioBuffers, generateAllEraBuffers } from './sfx';
import { transitionPlayer } from './transitionPlayer';

/**
 * Options for the SFX mixer
 */
export interface SfxMixerOptions {
  /** Fade duration in seconds for crossfades (default: 1.5) */
  fadeTime?: number;
}

/**
 * Manages era-specific audio with crossfading between eras.
 */
export class SfxMixer {
  private audioContext: AudioContext | null = null;
  private currentEra: EraId | null = null;
  private fadeTime: number;

  private buffers: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;

  // Ambient nodes
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;

  // Traffic nodes
  private trafficSource: AudioBufferSourceNode | null = null;
  private trafficGain: GainNode | null = null;

  // For crossfading old nodes
  private ambientSourceOld: AudioBufferSourceNode | null = null;
  private ambientGainOld: GainNode | null = null;
  private trafficSourceOld: AudioBufferSourceNode | null = null;
  private trafficGainOld: GainNode | null = null;

  // Master gain
  private masterGain: GainNode | null = null;

  // Flag to indicate if we are initialized (AudioContext resumed)
  private initialized = false;

  constructor(options: SfxMixerOptions = {}) {
    this.fadeTime = options.fadeTime ?? 1.5;
  }

  /**
   * Initialize the mixer. Must be called after a user gesture to unlock audio context.
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    // @ts-expect-error - webkit fallback
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)() as AudioContext;

    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.audioContext.currentTime); // start at 50% volume
    this.masterGain.connect(this.audioContext.destination);

    // Pre-generate buffers for all eras
    this.buffers = generateAllEraBuffers(this.audioContext);

    this.initialized = true;
  }

  /**
   * Ensure AudioContext is resumed (browser autoplay policies).
   */
  async ensureAudioContextResumed(): Promise<void> {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Set the current era, crossfading from the previous era's ambient and traffic loops.
   */
  async setEra(eraId: EraId): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.audioContext || !this.masterGain) {
      throw new Error('AudioContext not initialized');
    }

    // If same era, do nothing
    if (this.currentEra === eraId) {
      return;
    }

    await this.ensureAudioContextResumed();

    const now = this.audioContext.currentTime;

    // Stop and disconnect old ambient nodes after fade out
    if (this.ambientSource) {
      if (!this.ambientGainOld) {
        this.ambientGainOld = this.audioContext.createGain();
        this.ambientSource.connect(this.ambientGainOld);
        this.ambientGainOld.connect(this.masterGain);
      }

      const gain = this.ambientGainOld.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.exponentialRampToValueAtTime(0.001, now + this.fadeTime);

      this.ambientSource.stop(now + this.fadeTime);
      this.ambientSourceOld = this.ambientSource;

      this.ambientSource = null;
      this.ambientGain = null;
    }

    // Stop and disconnect old traffic nodes after fade out
    if (this.trafficSource) {
      if (!this.trafficGainOld) {
        this.trafficGainOld = this.audioContext.createGain();
        this.trafficSource.connect(this.trafficGainOld);
        this.trafficGainOld.connect(this.masterGain);
      }

      const gain = this.trafficGainOld.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.exponentialRampToValueAtTime(0.001, now + this.fadeTime);

      this.trafficSource.stop(now + this.fadeTime);
      this.trafficSourceOld = this.trafficSource;

      this.trafficSource = null;
      this.trafficGain = null;
    }

    // Create new ambient and traffic nodes
    const ambientBuffer = this.buffers[eraId].ambient;
    const trafficBuffer = this.buffers[eraId].traffic;

    // Ambient
    this.ambientSource = this.audioContext.createBufferSource();
    this.ambientSource.buffer = ambientBuffer;
    this.ambientSource.loop = true;

    this.ambientGain = this.audioContext.createGain();
    this.ambientGain.gain.setValueAtTime(0.001, now);

    this.ambientSource.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    this.ambientSource.start(now);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.3, now + this.fadeTime);

    // Traffic
    this.trafficSource = this.audioContext.createBufferSource();
    this.trafficSource.buffer = trafficBuffer;
    this.trafficSource.loop = true;

    this.trafficGain = this.audioContext.createGain();
    this.trafficGain.gain.setValueAtTime(0.001, now);

    this.trafficSource.connect(this.trafficGain);
    this.trafficGain.connect(this.masterGain);
    this.trafficSource.start(now);
    this.trafficGain.gain.exponentialRampToValueAtTime(0.2, now + this.fadeTime);

    // Cleanup old nodes after fade out
    window.setTimeout(() => {
      if (this.ambientSourceOld) {
        this.ambientSourceOld.disconnect();
        this.ambientSourceOld = null;
      }
      if (this.ambientGainOld) {
        this.ambientGainOld.disconnect();
        this.ambientGainOld = null;
      }
      if (this.trafficSourceOld) {
        this.trafficSourceOld.disconnect();
        this.trafficSourceOld = null;
      }
      if (this.trafficGainOld) {
        this.trafficGainOld.disconnect();
        this.trafficGainOld = null;
      }
    }, (this.fadeTime + 0.1) * 1000);

    this.currentEra = eraId;
  }

  /**
   * Play a one-shot event sound for the current era.
   */
  playEvent(eventType: string): void {
    if (!this.initialized || !this.audioContext || !this.currentEra || !this.masterGain) {
      return;
    }

    const eventBuffer = this.buffers[this.currentEra].events[eventType];
    if (!eventBuffer) {
      // eslint-disable-next-line no-console
      console.warn(`Event sound ${eventType} not found for era ${this.currentEra}`);
      return;
    }

    const now = this.audioContext.currentTime;
    const source = this.audioContext.createBufferSource();
    source.buffer = eventBuffer;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.2, now);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + eventBuffer.duration);
  }

  /**
   * Play an era-to-era transition sound effect.
   * Uses a dedicated TransitionPlayer to spatialize the one-shot.
   */
  playTransition(from: EraId, to: EraId, cameraPos?: { x: number; y: number; z: number }): void {
    if (!this.initialized) {
      void this.initialize();
    }
    transitionPlayer.playTransition(from, to, cameraPos);
  }

  /**
   * Set the master volume (0 to 1)
   */
  setVolume(volume: number): void {
    if (!this.masterGain) {
      return;
    }

    if (!Number.isFinite(volume)) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, volume));
    const now = this.audioContext?.currentTime ?? 0;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(clamped, now);
  }

  /**
   * Dispose of the mixer and release resources
   */
  dispose(): void {
    if (!this.audioContext) {
      return;
    }

    const stopAndDisconnect = (source: AudioBufferSourceNode | null, gain: GainNode | null) => {
      if (source) {
        try {
          source.stop();
        } catch {
          // ignore
        }
        source.disconnect();
      }
      if (gain) {
        gain.disconnect();
      }
    };

    stopAndDisconnect(this.ambientSource, this.ambientGain);
    stopAndDisconnect(this.trafficSource, this.trafficGain);
    stopAndDisconnect(this.ambientSourceOld, this.ambientGainOld);
    stopAndDisconnect(this.trafficSourceOld, this.trafficGainOld);

    if (this.masterGain) {
      this.masterGain.disconnect();
    }

    void this.audioContext.close();
    this.audioContext = null;
    this.initialized = false;
    this.currentEra = null;

    this.buffers = {} as Record<EraId, EraAudioBuffers>;
  }
}

// Export a singleton instance for convenience
export const sfxMixer = new SfxMixer();
