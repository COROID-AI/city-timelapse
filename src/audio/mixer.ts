/**
 * Era-aware crossfade mixer.
 *
 * Owns one AudioContext and a set of looping layers per era:
 *   - ambient bed
 *   - traffic loop
 *   - background music (optional, per era)
 *   - one-shot events scheduled on timers
 *
 * setEra(id) crossfades every layer with exponential gain ramps bounded to a
 * short window, so switching periods never clicks. The AudioContext starts
 * suspended and is resumed on the first user gesture (autoplay policy).
 */

import { ERA_IDS, type EraId } from '../eras';
import { generateAllEraBuffers, type EraAudioBuffers } from './sfx';

export interface SfxMixerOptions {
  /** Master output gain (0..1). */
  masterGain?: number;
  /** Seconds for crossfades (default 1.4). */
  fadeSeconds?: number;
  /** Controls how often one-shot events fire (events/minute). */
  eventRatePerMinute?: number;
}

const DEFAULT_OPTIONS: Required<SfxMixerOptions> = {
  masterGain: 0.8,
  fadeSeconds: 1.4,
  eventRatePerMinute: 8,
};

interface LayerHandle {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class SfxMixer {
  readonly ctx: AudioContext;
  private readonly opts: Required<SfxMixerOptions>;
  private readonly master: GainNode;
  private readonly buffers: Record<EraId, EraAudioBuffers>;
  private readonly layers = new Map<EraId, LayerHandle>();
  private readonly trafficLayers = new Map<EraId, LayerHandle>();
  private readonly musicLayers = new Map<EraId, LayerHandle>();
  private activeEra: EraId = '1945';
  /** Continuous era cursor (0..ERA_IDS.length-1) for the visual/audio tween. */
  eraCursor = 0;
  private appliedCursor = 0;
  private muted = false;
  private started = false;
  private disposed = false;
  private nextEventAt = 0;

  constructor(options?: SfxMixerOptions) {
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) {
      throw new Error('Web Audio is not supported in this browser');
    }
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.opts.masterGain;
    this.master.connect(this.ctx.destination);
    this.buffers = generateAllEraBuffers(this.ctx);
    // Layer gains are the era-crossfade targets. Ambient bed and traffic loop
    // are separate looping layers so setEra() can fade them independently.
    for (const id of ERA_IDS) {
      this.layers.set(id, this.createLoop(this.buffers[id].ambient, 0.0, 0.9));
      const traffic = this.createLoop(this.buffers[id].traffic, 0.0, 0.8);
      traffic.gain.gain.value = 0.0;
      this.trafficLayers.set(id, traffic);
      const music = this.makeMusicBuffer(id);
      this.musicLayers.set(id, this.createLoop(music, 0.0, 0.4));
    }
    // Everything is started at zero gain; the mixer becomes audible only after
    // init() runs from a user gesture.
    this.started = true;
    this.startLayer();
  }

  private createLoop(buffer: AudioBuffer, gain: number, playbackRate = 1): LayerHandle {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = playbackRate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    source.connect(g);
    g.connect(this.master);
    return { source, gain: g };
  }

  /** Schedules the looping sources on a suspended context. */
  private startLayer(): void {
    for (const handle of this.layers.values()) {
      handle.source.start(0);
    }
    for (const handle of this.trafficLayers.values()) {
      handle.source.start(0);
    }
    for (const handle of this.musicLayers.values()) {
      handle.source.start(0);
    }
  }

  /**
   * Must be called from a user gesture. Resumes the AudioContext and fades in
   * the active era layers.
   */
  async init(): Promise<void> {
    if (this.disposed) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* autoplay policy; user will click again */
      }
    }
    this.started = true;
    this.applyEra(this.activeEra, true);
  }

  /** Crossfade all layers to a new era. */
  setEra(id: EraId): void {
    if (this.disposed) return;
    if (id === this.activeEra && this.started) return;
    this.activeEra = id;
    this.applyEra(id, false);
  }

  private applyEra(id: EraId, instant: boolean): void {
    const time = this.ctx.currentTime;
    const fade = instant ? 0.01 : this.opts.fadeSeconds;
    for (const [era, handle] of this.layers) {
      const target = this.started && era === id ? 1 : 0;
      this.rampTo(handle.gain, target, fade, time);
    }
    for (const [era, handle] of this.trafficLayers) {
      const target = this.started && era === id ? 1 : 0;
      this.rampTo(handle.gain, target, fade, time);
    }
    for (const [era, handle] of this.musicLayers) {
      const target = this.started && era === id ? 1 : 0;
      this.rampTo(handle.gain, target, fade, time);
    }
  }

  private rampTo(g: GainNode, value: number, seconds: number, time: number): void {
    const safe = Math.max(value, 0.0001);
    g.gain.cancelScheduledValues(time);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), time);
    // Exponential ramps are bounded to avoid NaN; then snap to exact 0.
    g.gain.exponentialRampToValueAtTime(safe, time + Math.max(seconds, 0.01));
    if (value === 0) {
      g.gain.setValueAtTime(0, time + Math.max(seconds, 0.01) + 0.001);
    }
  }

  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.muted = muted;
    const t = this.ctx.currentTime;
    const target = muted ? 0 : this.opts.masterGain;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), t);
    this.master.gain.exponentialRampToValueAtTime(Math.max(target, 0.0001), t + 0.08);
    if (target === 0) this.master.gain.setValueAtTime(0, t + 0.09);
  }

  /**
   * Applies adjacent-era gains from a continuous cursor so the ambient/traffic
   * layers crossfade across the whole transition rather than snapping.
   */
  private applyEraCursor(cursor: number): void {
    const clamped = Math.min(ERA_IDS.length - 1, Math.max(0, cursor));
    const lo = Math.floor(clamped);
    const hi = Math.min(lo + 1, ERA_IDS.length - 1);
    const t = clamped - lo;
    const time = this.ctx.currentTime;
    const fade = 0.12;
    for (const [era, handle] of this.layers) {
      const idx = ERA_IDS.indexOf(era);
      const target = idx === lo ? 1 - t : idx === hi ? t : 0;
      this.rampTo(handle.gain, target, fade, time);
    }
    for (const [era, handle] of this.trafficLayers) {
      const idx = ERA_IDS.indexOf(era);
      const target = idx === lo ? 1 - t : idx === hi ? t : 0;
      this.rampTo(handle.gain, target, fade, time);
    }
  }

  /** Called each frame; schedules one-shot event sounds at an era-based rate. */
  update(now: number): void {
    if (this.disposed || !this.started || this.muted) return;
    if (now >= this.nextEventAt) {
      this.playEvent();
      const minutes = 60 / this.opts.eventRatePerMinute;
      this.nextEventAt = now + minutes * (0.6 + Math.random() * 0.8);
    }
    // Follow the eased era cursor so audio layers crossfade in sync with the
    // visual transition instead of snapping at the discrete endpoint.
    if (this.eraCursor !== this.appliedCursor) {
      this.applyEraCursor(this.eraCursor);
      this.appliedCursor = this.eraCursor;
    }
  }

  private playEvent(): void {
    const data = this.buffers[this.activeEra];
    const candidates = (
      Object.keys(data.events) as (keyof EraAudioBuffers['events'])[]
    ).filter((k) => data.events[k] !== null);
    if (candidates.length === 0) return;
    const key = candidates[Math.floor(Math.random() * candidates.length)];
    const buffer = data.events[key];
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.42;
    source.connect(g);
    g.connect(this.master);
    source.start();
  }

  /** Minimal deterministic era music: gentle oscillator melody baked to a buffer. */
  private makeMusicBuffer(_id: EraId): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const seconds = 4;
    const len = sr * seconds;
    const buffer = this.ctx.createBuffer(1, len, sr);
    const out = buffer.getChannelData(0);
    const baseFreq = 196; // G3
    const steps = [0, 4, 7, 12, 7, 4, 2, 0];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const stepIndex = Math.floor(t / 0.5) % steps.length;
      const f = baseFreq * Math.pow(2, steps[stepIndex] / 12);
      const env = Math.exp(-6 * ((t % 0.5) / 0.5));
      const pluck =
        Math.sin(2 * Math.PI * f * t) * env * 0.5 +
        Math.sin(2 * Math.PI * f * 2 * t) * env * 0.15;
      out[i] = pluck * 0.12 + Math.sin(2 * Math.PI * 55 * t) * 0.04;
    }
    return buffer;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const handle of this.layers.values()) {
      try {
        handle.source.stop();
      } catch {
        /* already stopped */
      }
      handle.source.disconnect();
      handle.gain.disconnect();
    }
    for (const handle of this.trafficLayers.values()) {
      try {
        handle.source.stop();
      } catch {
        /* already stopped */
      }
      handle.source.disconnect();
      handle.gain.disconnect();
    }
    for (const handle of this.musicLayers.values()) {
      try {
        handle.source.stop();
      } catch {
        /* already stopped */
      }
      handle.source.disconnect();
      handle.gain.disconnect();
    }
    this.layers.clear();
    this.trafficLayers.clear();
    this.musicLayers.clear();
    void this.ctx.close().catch(() => undefined);
  }
}

