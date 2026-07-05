// src/audio/mixer.ts
// Era-aware crossfade mixer for ambient audio

import { EraId } from '../eras';
import { EraAudioBuffers, generateAllEraBuffers } from './sfx';

/**
 * Options for the SFX mixer
 */
export interface SfxMixerOptions {
  /** Fade duration in seconds for crossfades (default: 1.5) */
  fadeTime?: number;
}

/**
 * Manages era-specific audio with crossfading between eras
 */
export class SfxMixer {
  private audioContext: AudioContext | null = null;
  private currentEra: EraId | null = null;
  private fadeTime: number;
  private buffers: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;

  // Nodes for ambient layer
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientGainNode: GainNode | null = null; // for fade

  // Nodes for traffic layer
  private trafficSource: AudioBufferSourceNode | null = null;
  private trafficGain: GainNode | null = null;
  private trafficGainNode: GainNode | null = null;

  // Master gain
  private masterGain: GainNode | null = null;

  // For crossfading: we keep the old nodes and fade them out while fading in the new
  private ambientSourceOld: AudioBufferSourceNode | null = null;
  private ambientGainOld: GainNode | null = null;
  private trafficSourceOld: AudioBufferSourceNode | null = null;
  private trafficGainOld: GainNode | null = null;

  // Flag to indicate if we are initialized (AudioContext resumed)
  private initialized = false;

  constructor(options: SfxMixerOptions = {}) {
    this.fadeTime = options.fadeTime ?? 1.5;
  }

  /**
   * Initialize the mixer. Must be called after a user gesture to unlock audio context.
   * @returns Promise that resolves when the AudioContext is ready
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return; // already initialized
    }

    // @ts-expect-error: ignore TS2351 - newable union type
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
   * Set the current era, crossfading from the previous era's ambient and traffic loops.
   * @param eraId The era to switch to
   */
  async setEra(eraId: EraId): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    // If same era, do nothing
    if (this.currentEra === eraId) {
      return;
    }

    const now = this.audioContext.currentTime;

    // Stop and disconnect old ambient and traffic nodes after fade out
    if (this.ambientSource) {
      // Create a gain node for fading out if not already created for crossfade
      if (!this.ambientGainOld) {
        this.ambientGainOld = this.audioContext.createGain();
        this.ambientSource.connect(this.ambientGainOld);
        this.ambientGainOld.connect(this.masterGain!);
      }
      // Fade out the old ambient
      this.ambientGainOld.gain.cancelScheduledValues(now);
      this.ambientGainOld.gain.setValueAtTime(this.ambientGainOld.gain.value, now);
      this.ambientGainOld.gain.exponentialRampToValueAtTime(0.001, now + this.fadeTime);

      // Schedule stop after fade out
      this.ambientSource.stop(now + this.fadeTime);
      this.ambientSourceOld = this.ambientSource;
      // this.ambientGainOld = this.ambientGainOld; // keep reference - removed self-assignment
      this.ambientSource = null;
      this.ambientGain = null;
    }

    if (this.trafficSource) {
      if (!this.trafficGainOld) {
        this.trafficGainOld = this.audioContext.createGain();
        this.trafficSource.connect(this.trafficGainOld);
        this.trafficGainOld.connect(this.masterGain!);
      }
      this.trafficGainOld.gain.cancelScheduledValues(now);
      this.trafficGainOld.gain.setValueAtTime(this.trafficGainOld.gain.value, now);
      this.trafficGainOld.gain.exponentialRampToValueAtTime(0.001, now + this.fadeTime);
      this.trafficSource.stop(now + this.fadeTime);
      this.trafficSourceOld = this.trafficSource;
      // this.trafficGainOld = this.trafficGainOld; // keep reference - removed self-assignment
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
    // Start at silence and fade in
    this.ambientGain.gain.setValueAtTime(0.001, now);
    this.ambientSource.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain!);
    this.ambientSource.start(now);
    // Fade in
    this.ambientGain.gain.exponentialRampToValueAtTime(0.3, now + this.fadeTime); // ambient volume level

    // Traffic
    this.trafficSource = this.audioContext.createBufferSource();
    this.trafficSource.buffer = trafficBuffer;
    this.trafficSource.loop = true;
    this.trafficGain = this.audioContext.createGain();
    this.trafficGain.gain.setValueAtTime(0.001, now);
    this.trafficSource.connect(this.trafficGain);
    this.trafficGain.connect(this.masterGain!);
    this.trafficSource.start(now);
    this.trafficGain.gain.exponentialRampToValueAtTime(0.2, now + this.fadeTime); // traffic volume level

    // Clean up old nodes after fade out (they will be disconnected and garbage collected)
    // We already scheduled stop, so we can null the old references after the fade time
    setTimeout(() => {
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
   * Play a one-shot event sound for the current era
   * @param eventType The type of event (e.g., 'horn', 'siren')
   */
  playEvent(eventType: string): void {
    if (!this.initialized || !this.audioContext || !this.currentEra) {
      return;
    }

    const eventBuffer = this.buffers[this.currentEra].events[eventType];
    if (!eventBuffer) {
      console.warn(`Event sound ${eventType} not found for era ${this.currentEra}`);
      return;
    }

    const now = this.audioContext.currentTime;
    const source = this.audioContext.createBufferSource();
    source.buffer = eventBuffer;
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.2, now); // event volume
    source.connect(gain);
    gain.connect(this.masterGain!);
    source.start(now);
    // Automatically disconnect when done
    source.stop(now + eventBuffer.duration);
  }

  /**
   * Set the master volume (0 to 1)
   * @param volume Volume level
   */
  setVolume(volume: number): void {
    if (!this.masterGain) {
      return;
    }
    const now = this.audioContext?.currentTime ?? 0;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
  }

  /**
   * Dispose of the mixer and release resources
   */
  dispose(): void {
    if (!this.audioContext) {
      return;
    }

    // Stop and disconnect all nodes
    const stopAndDisconnect = (source: AudioBufferSourceNode | null, gain: GainNode | null) => {
      if (source) {
        source.stop();
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

    this.audioContext.close();
    this.audioContext = null;
    this.initialized = false;
    this.currentEra = null;

    // Clear buffers (they are AudioBuffers, which will be GC'd when references are dropped)
    this.buffers = {} as Record<EraId, EraAudioBuffers>;
  }
}

// Export a singleton instance for convenience
export const sfxMixer = new SfxMixer();