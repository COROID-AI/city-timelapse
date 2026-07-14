import type { EraConfig, EraId } from '../types';
import { ERA_LIST } from '../config/eras';
import { lerpN } from '../util/math';

/**
 * Procedural ambient soundscape synthesised entirely with the Web Audio API —
 * no external audio files required. A low drone + filtered noise bed shifts
 * timbre per era; a gentle "whoosh" plays on era transitions.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private muted = false;
  private started = false;
  private currentEra: EraId = '1945';

  /** Must be called from a user gesture (click) to satisfy autoplay policy. */
  init(): void {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // Drone: two detuned oscillators through a lowpass
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.12;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      this.droneOscA = this.ctx.createOscillator();
      this.droneOscA.type = 'sawtooth';
      this.droneOscA.frequency.value = 55;
      this.droneOscB = this.ctx.createOscillator();
      this.droneOscB.type = 'sawtooth';
      this.droneOscB.frequency.value = 55.4;
      this.droneOscA.connect(lp);
      this.droneOscB.connect(lp);
      lp.connect(this.droneGain);
      this.droneGain.connect(this.master);
      this.droneOscA.start();
      this.droneOscB.start();

      // Noise bed: looping white noise through a bandpass
      this.noiseSrc = this.ctx.createBufferSource();
      this.noiseSrc.buffer = this.makeNoiseBuffer(2);
      this.noiseSrc.loop = true;
      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.value = 800;
      this.noiseFilter.Q.value = 0.7;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.04;
      this.noiseSrc.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      this.noiseSrc.start();

      this.started = true;
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.applyEra(ERA_LIST[0]);
    } catch {
      // Audio is non-essential; fail silently.
      this.started = false;
    }
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Smoothly retune the drone + noise to match an era's mood. */
  setEra(config: EraConfig): void {
    this.currentEra = config.id;
    this.applyEra(config);
  }

  private applyEra(config: EraConfig): void {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    // Base frequency rises slightly into the future
    const baseFreq = 48 + (config.year - 1945) / (2055 - 1945) * 24;
    if (this.droneOscA) this.droneOscA.frequency.setTargetAtTime(baseFreq, t, 0.8);
    if (this.droneOscB) this.droneOscB.frequency.setTargetAtTime(baseFreq * 1.008, t, 0.8);
    // Noise brightness increases with technology level
    if (this.noiseFilter) {
      const bright = 400 + (config.year - 1945) / (2055 - 1945) * 1800;
      this.noiseFilter.frequency.setTargetAtTime(bright, t, 0.8);
    }
    if (this.noiseGain) {
      const g = config.nightFactor > 0.3 ? 0.06 : 0.03;
      this.noiseGain.gain.setTargetAtTime(g, t, 0.8);
    }
  }

  /** Crossfade drone/noise between two eras during a timeline transition. */
  crossfade(from: EraConfig, to: EraConfig, progress: number): void {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const yr = lerpN(from.year, to.year, progress);
    const baseFreq = 48 + (yr - 1945) / (2055 - 1945) * 24;
    if (this.droneOscA) this.droneOscA.frequency.setTargetAtTime(baseFreq, t, 0.3);
    if (this.droneOscB) this.droneOscB.frequency.setTargetAtTime(baseFreq * 1.008, t, 0.3);
    if (this.noiseFilter) {
      const bright = 400 + (yr - 1945) / (2055 - 1945) * 1800;
      this.noiseFilter.frequency.setTargetAtTime(bright, t, 0.3);
    }
  }

  /** Play a soft transition "whoosh" when jumping between eras. */
  playWhoosh(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.7;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(dur);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(200, t);
    filt.frequency.exponentialRampToValueAtTime(2400, t + dur);
    filt.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.1);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }
  get isStarted(): boolean {
    return this.started;
  }
  get era(): EraId {
    return this.currentEra;
  }
}
