import type { EraId } from '../eras.js';
import type { EraAudioBuffers } from './sfx.js';

/**
 * Mixer options configuration
 */
export interface SfxMixerOptions {
  crossfadeDuration?: number;
  enableAmbient?: boolean;
  enableTraffic?: boolean;
  enableMusic?: boolean;
}

/**
 * Default mixer options
 */
const DEFAULT_OPTIONS: Required<SfxMixerOptions> = {
  crossfadeDuration: 1.5,
  enableAmbient: true,
  enableTraffic: true,
  enableMusic: true
};

/**
 * SFX Mixer class for era-aware audio crossfading
 */
export class SfxMixer {
  private ctx: AudioContext | null = null;
  private options: Required<SfxMixerOptions>;
  private buffers: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;
  private currentEra: EraId | null = null;
  
  // Audio nodes
  private ambientSource: AudioBufferSourceNode | null = null;
  private trafficSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  
  // Crossfade state
  private fadeInProgress = false;
  private fadeTimers: Map<EraId, number> = new Map();
  
  constructor(options: SfxMixerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Initializes the mixer - must be called from a user gesture to comply with autoplay policy
   */
  async init(buffers: Record<EraId, EraAudioBuffers>): Promise<void> {
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Create gain nodes
      this.ambientGain = this.ctx.createGain();
      this.trafficGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      
      // Connect to destination
      this.ambientGain.connect(this.ctx.destination);
      this.trafficGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      
      this.buffers = buffers;
      
      // Start with initial era
      if (this.currentEra) {
        this.fadeInEra(this.currentEra, true);
      }
    } catch (error) {
      console.warn('Web Audio API not available:', error);
    }
  }
  
  /**
   * Sets the current era with crossfade transition
   */
  setEra(eraId: EraId): void {
    if (this.fadeInProgress && this.currentEra) {
      this.crossfadeTo(eraId);
    } else if (this.currentEra && this.ctx) {
      this.fadeInEra(eraId, false);
    } else {
      this.currentEra = eraId;
    }
  }
  
  /**
   * Gets the current era
   */
  getCurrentEra(): EraId | null {
    return this.currentEra;
  }
  
  /**
   * Plays a one-shot event sound
   */
  playEvent(eraId: EraId, eventType: string): void {
    if (!this.ctx || !this.options.enableAmbient) return;
    
    const buffers = this.buffers[eraId];
    if (!buffers || buffers.events.length === 0) return;
    
    // Play a random event sound matching the requested type
    const eventToPlay = buffers.events[Math.floor(Math.random() * buffers.events.length)];
    
    const source = this.ctx.createBufferSource();
    source.buffer = eventToPlay;
    source.connect(this.ctx.destination);
    source.start();
    source.onended = () => {
      source.disconnect();
    };
  }
  
  /**
   * Disposes all audio resources
   */
  dispose(): void {
    // Clear any pending fade timers
    this.fadeTimers.forEach(timerId => clearTimeout(timerId));
    this.fadeTimers.clear();
    
    if (this.ambientSource) {
      try { this.ambientSource.stop(); } catch { /* Already stopped */ }
      this.ambientSource.disconnect();
    }
    if (this.trafficSource) {
      try { this.trafficSource.stop(); } catch { /* Already stopped */ }
      this.trafficSource.disconnect();
    }
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* Already stopped */ }
      this.musicSource.disconnect();
    }
    
    this.ambientGain?.disconnect();
    this.trafficGain?.disconnect();
    this.musicGain?.disconnect();
    
    this.ctx?.close();
    this.ctx = null;
    this.buffers = {} as Record<EraId, EraAudioBuffers>;
  }
  
  /**
   * Begins fade-in for an era's audio
   */
  private fadeInEra(eraId: EraId, immediate: boolean): void {
    if (!this.ctx || !this.buffers[eraId]) return;
    
    this.fadeInProgress = true;
    this.currentEra = eraId;
    
    const buffers = this.buffers[eraId];
    const duration = immediate ? 0 : this.options.crossfadeDuration;
    
    // Ambient layer
    if (this.options.enableAmbient && this.ambientGain) {
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = buffers.ambient;
      this.ambientSource.loop = true;
      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(
        0.4,
        this.ctx.currentTime + duration
      );
      this.ambientSource.connect(this.ambientGain);
      this.ambientSource.start();
    }
    
    // Traffic layer
    if (this.options.enableTraffic && this.trafficGain) {
      this.trafficSource = this.ctx.createBufferSource();
      this.trafficSource.buffer = buffers.traffic;
      this.trafficSource.loop = true;
      this.trafficGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.trafficGain.gain.linearRampToValueAtTime(
        0.3,
        this.ctx.currentTime + duration
      );
      this.trafficSource.connect(this.trafficGain);
      this.trafficSource.start();
    }
    
    // Music layer
    if (this.options.enableMusic && this.musicGain) {
      this.musicSource = this.ctx.createBufferSource();
      this.musicSource.buffer = buffers.music;
      this.musicSource.loop = true;
      this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(
        0.2,
        this.ctx.currentTime + duration
      );
      this.musicSource.connect(this.musicGain);
      this.musicSource.start();
    }
    
    // Clear fade flag after transition
    const timerId = window.setTimeout(() => {
      this.fadeInProgress = false;
      this.fadeTimers.delete(eraId);
    }, immediate ? 0 : duration * 1000);
    this.fadeTimers.set(eraId, timerId);
  }
  
  /**
   * Crossfades from current era to new era
   */
  private crossfadeTo(newEraId: EraId): void {
    if (!this.ctx || !this.currentEra || !this.buffers[newEraId]) return;
    
    const oldEraId = this.currentEra;
    const oldBuffers = this.buffers[oldEraId];
    const duration = this.options.crossfadeDuration;
    
    // Fade out old era
    const startTime = this.ctx.currentTime;
    
    if (this.ambientGain && oldBuffers) {
      this.ambientGain.gain.cancelScheduledValues(startTime);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, startTime);
      this.ambientGain.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    
    if (this.trafficGain && oldBuffers) {
      this.trafficGain.gain.cancelScheduledValues(startTime);
      this.trafficGain.gain.setValueAtTime(this.trafficGain.gain.value, startTime);
      this.trafficGain.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    
    if (this.musicGain && oldBuffers) {
      this.musicGain.gain.cancelScheduledValues(startTime);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, startTime);
      this.musicGain.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    
    // Stop old sources after fade
    const stopOldSources = () => {
      this.ambientSource?.stop();
      this.trafficSource?.stop();
      this.musicSource?.stop();
    };
    
    // Fade in new era
    const fadeInNew = () => {
      this.fadeInProgress = true;
      this.currentEra = newEraId;
      this.fadeInEra(newEraId, false);
    };
    
    const timerId = window.setTimeout(() => {
      stopOldSources();
      fadeInNew();
      this.fadeTimers.delete(newEraId);
    }, duration * 1000);
    this.fadeTimers.set(newEraId, timerId);
  }
}