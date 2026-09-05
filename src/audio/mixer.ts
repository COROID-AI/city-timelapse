/**
 * src/audio/mixer.ts — era-aware crossfade SFX mixer.
 *
 * Per the audio-implementation-plan contract, SfxMixer owns the Web Audio
 * graph for ambient bed, traffic loop, event one-shots and music. It is
 * autoplay-safe: no AudioContext is created until `init()` runs inside a user
 * gesture (the app calls it from the first pointer/key interaction), and
 * `setEra()` crossfades layers with exponential GainNode ramps over ~1.5s
 * (no clicks). `dispose()` tears the whole graph down.
 */

import { SFX_ERA_DATA, type EraId } from '../eras';
import { generateAllEraBuffers, type EraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master volume 0..1. Default 0.8. */
  masterVolume?: number;
  /** Local storage key for the persisted mute flag. Default 'city-timelapse:audio-muted'. */
  storageKey?: string;
  /** Override clock for tests. */
  now?: () => number;
}

export class SfxMixer {
  private readonly masterVolume: number;
  private readonly storageKey: string;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private eventGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private trafficSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private buffers: Record<EraId, EraAudioBuffers> | null = null;
  private currentEra: EraId = '1945';
  private muted = false;
  private disposed = false;

  constructor(options: SfxMixerOptions = {}) {
    this.masterVolume = options.masterVolume ?? 0.8;
    this.storageKey = options.storageKey ?? 'city-timelapse:audio-muted';
    if (typeof localStorage !== 'undefined') {
      this.muted = localStorage.getItem(this.storageKey) === '1';
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Whether audio has been initialized (autoplay-safe latch). */
  get isInitialized(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Create the context and start the current era's layers. Must be called from
   * a user gesture to satisfy autoplay policy; safe to call repeatedly.
   */
  init(): void {
    if (this.disposed || this.ctx) {
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    void ctx.resume();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(ctx.destination);

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.9;
    this.ambientGain.connect(this.master);
    this.trafficGain = ctx.createGain();
    this.trafficGain.gain.value = 0.6;
    this.trafficGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
    this.eventGain = ctx.createGain();
    this.eventGain.gain.value = 0.7;
    this.eventGain.connect(this.master);

    // Generate all buffers upfront (procedural, no network).
    this.buffers = generateAllEraBuffers(ctx);
    const data = SFX_ERA_DATA[this.currentEra];
    this.startLoop('ambient', this.buffers[this.currentEra].ambient, this.ambientGain, 0.9, 0.001, ctx.currentTime);
    this.startLoop(
      'traffic',
      this.buffers[this.currentEra].traffic,
      this.trafficGain,
      0.15 + data.trafficDensity * 0.55,
      0.001,
      ctx.currentTime,
    );
    this.startLoop('music', this.buffers[this.currentEra].ambient, this.musicGain, 0.18, 0.001, ctx.currentTime);
  }

  /** Forced unlock helper — call from latency-free event handlers. */
  unlock(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /**
   * Crossfade the ambient/traffic/music layers to the given era over ~1.5s.
   * Leaves the current sources running and swaps them on top of the crossfade,
   * so the audible layer blends smoothly.
   */
  setEra(id: EraId): void {
    this.currentEra = id;
    if (!this.ctx || !this.buffers) {
      return;
    }
    const now = this.ctx.currentTime;
    const fade = 1.5;
    const data = SFX_ERA_DATA[id];
    const bundle = this.buffers[id];

    // Fade out the ambient bed quickly, then swap it.
    if (this.ambientSource && this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }
    this.startLoop('ambient', bundle.ambient, this.ambientGain, 0.9, fade, now + 0.18);

    // Traffic: short crossfade to the new density level.
    if (this.trafficSource && this.trafficGain) {
      this.trafficGain.gain.cancelScheduledValues(now);
      this.trafficGain.gain.setValueAtTime(this.trafficGain.gain.value, now);
      this.trafficGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }
    const trafficGainTarget = 0.15 + data.trafficDensity * 0.55;
    this.startLoop('traffic', bundle.traffic, this.trafficGain, trafficGainTarget, fade, now + 0.18);

    // Music: very low bed-level noise so it never dominates.
    if (this.musicSource && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }
    this.startLoop('music', bundle.ambient, this.musicGain, 0.18, fade, now + 0.18);
  }

  /** Fire a one-shot event (by name) for the current era. */
  playEvent(name: string): void {
    if (!this.ctx || !this.buffers || !this.eventGain) {
      return;
    }
    const eventNames = SFX_ERA_DATA[this.currentEra].events;
    const eventIndex = eventNames.indexOf(name);
    if (eventIndex < 0) {
      return;
    }
    const buffer = this.buffers[this.currentEra].events[eventIndex];
    if (!buffer) {
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const now = this.ctx.currentTime;
    const local = this.ctx.createGain();
    local.gain.setValueAtTime(0.0001, now);
    local.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    local.gain.exponentialRampToValueAtTime(0.0001, now + buffer.duration);
    source.connect(local);
    local.connect(this.eventGain);
    source.start(now);
    source.onended = () => {
      local.disconnect();
    };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, this.muted ? '1' : '0');
    }
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.masterVolume, now + 0.15);
    }
    return this.muted;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopSource(this.ambientSource);
    this.stopSource(this.trafficSource);
    this.stopSource(this.musicSource);
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.trafficGain = null;
    this.musicGain = null;
    this.eventGain = null;
    this.ambientSource = null;
    this.trafficSource = null;
    this.musicSource = null;
    this.buffers = null;
  }

  private startLoop(
    kind: 'ambient' | 'traffic' | 'music',
    buffer: AudioBuffer,
    gain: GainNode | null,
    gainTarget: number,
    fade: number,
    startTime: number,
  ): void {
    if (!this.ctx || !gain) {
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    const startGain = gain.gain.value;
    gain.gain.cancelScheduledValues(startTime);
    gain.gain.setValueAtTime(startGain, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainTarget), startTime + fade);
    source.start(startTime);
    if (kind === 'ambient') {
      this.ambientSource = source;
    } else if (kind === 'traffic') {
      this.trafficSource = source;
    } else {
      this.musicSource = source;
    }
  }

  private stopSource(source: AudioBufferSourceNode | null): void {
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    }
  }
}