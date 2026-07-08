/**
 * Era-Aware Crossfade Mixer for Audio Management
 * Handles smooth transitions between era-specific audio with autoplay policy compliance
 */

import type { EraId } from '../eras';
import { SFX_ERA_DATA } from '../eras';
import { generateEraAudioBuffers, type EraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  crossfadeDuration?: number;
  masterVolume?: number;
}

export class SfxMixer {
  private ctx: AudioContext;
  private options: Required<SfxMixerOptions>;
  private eraBuffers: Map<EraId, EraAudioBuffers> = new Map();
  private ambientSource: AudioBufferSourceNode | null = null;
  private trafficSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode;
  private trafficGain: GainNode;
  private masterGain: GainNode;
  private currentEra: EraId | null = null;
  private eventPlayers: Set<AudioBufferSourceNode> = new Set();
  private isInitialized: boolean = false;

  constructor(options: SfxMixerOptions = {}) {
    this.options = {
      crossfadeDuration: options.crossfadeDuration ?? 1.5,
      masterVolume: options.masterVolume ?? 0.7
    };
    
    this.ctx = new AudioContext();
    this.ambientGain = this.ctx.createGain();
    this.trafficGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    
    this.ambientGain.connect(this.masterGain);
    this.trafficGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.options.masterVolume;
  }

  /**
   * Initialize audio context on first user gesture (required for autoplay policy)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    this.isInitialized = true;
  }

  /**
   * Load all era audio buffers
   */
  async loadAllEras(): Promise<void> {
    for (const eraId of Object.keys(SFX_ERA_DATA) as EraId[]) {
      this.eraBuffers.set(eraId, generateEraAudioBuffers(this.ctx, SFX_ERA_DATA[eraId]));
    }
  }

  /**
   * Crossfade between eras using exponential ramp on GainNodes
   */
  async crossfade(fromEra: EraId | null, toEra: EraId): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    const toBuffers = this.eraBuffers.get(toEra);
    if (!toBuffers) {
      console.warn(`No audio buffers loaded for era ${toEra}`);
      return;
    }

    // Stop old sources
    if (this.ambientSource) {
      this.ambientSource.stop();
      this.ambientSource.disconnect();
    }
    if (this.trafficSource) {
      this.trafficSource.stop();
      this.trafficSource.disconnect();
    }

    // Fade out current era
    if (fromEra) {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + this.options.crossfadeDuration);
      this.trafficGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + this.options.crossfadeDuration);
    } else {
      this.ambientGain.gain.value = 0;
      this.trafficGain.gain.value = 0;
    }

    // Schedule fade in for new era
    this.ambientGain.gain.setValueAtTime(0.001, this.ctx.currentTime + this.options.crossfadeDuration);
    this.trafficGain.gain.setValueAtTime(0.001, this.ctx.currentTime + this.options.crossfadeDuration);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.5, this.ctx.currentTime + this.options.crossfadeDuration + 0.1);
    this.trafficGain.gain.exponentialRampToValueAtTime(0.3, this.ctx.currentTime + this.options.crossfadeDuration + 0.1);

    // Create and start new sources
    this.ambientSource = this.ctx.createBufferSource();
    this.ambientSource.buffer = toBuffers.ambient;
    this.ambientSource.loop = true;
    this.ambientSource.connect(this.ambientGain);
    this.ambientSource.start(this.ctx.currentTime + this.options.crossfadeDuration);

    this.trafficSource = this.ctx.createBufferSource();
    this.trafficSource.buffer = toBuffers.traffic;
    this.trafficSource.loop = true;
    this.trafficSource.connect(this.trafficGain);
    this.trafficSource.start(this.ctx.currentTime + this.options.crossfadeDuration);

    this.currentEra = toEra;
  }

  /**
   * Play a random event sound from the current era
   */
  playEventSound(): void {
    if (!this.currentEra) return;
    
    const buffers = this.eraBuffers.get(this.currentEra);
    if (!buffers || buffers.events.length === 0) return;
    
    const randomEvent = buffers.events[Math.floor(Math.random() * buffers.events.length)];
    const source = this.ctx.createBufferSource();
    source.buffer = randomEvent;
    source.connect(this.masterGain);
    source.start();
    
    this.eventPlayers.add(source);
    source.onended = () => this.eventPlayers.delete(source);
  }

  /**
   * Transition to a specific era
   */
  async setEra(eraId: EraId): Promise<void> {
    if (this.currentEra !== eraId) {
      await this.crossfade(this.currentEra, eraId);
    }
  }

  /**
   * Clean up all audio resources
   */
  dispose(): void {
    this.eventPlayers.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    
    if (this.ambientSource) {
      this.ambientSource.disconnect();
    }
    if (this.trafficSource) {
      this.trafficSource.disconnect();
    }
    
    this.ambientGain.disconnect();
    this.trafficGain.disconnect();
    this.masterGain.disconnect();
    
    if (this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    
    this.eraBuffers.clear();
    this.eventPlayers.clear();
  }
}