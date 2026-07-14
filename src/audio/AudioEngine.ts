import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendScalar } from '../core/mathUtils';

// Web Audio synthesized ambient soundscape that morphs per era.
// Two crossfading oscillators (so discrete wave-types blend without clicks),
// a shaped noise bed, an LFO sweeping the filter, and a convolver reverb.
// AudioContext is created lazily and resumed ONLY on a user gesture.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private started = false;
  private muted = false;
  private targetVolume = 0.32;

  /** True if the audio graph has been constructed and is running. */
  public isStarted(): boolean {
    return this.started;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Create + resume the graph. Must be called from a user gesture handler. */
  public start(): void {
    if (this.started) {
      this.resume();
      return;
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    // Master chain: sources -> filter -> dry/wet -> master -> destination
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.targetVolume;
    master.connect(ctx.destination);
    this.master = master;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.7;
    filter.connect(master);
    this.filter = filter;

    // Reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(ctx, 3.2, 2.4);
    this.convolver = convolver;

    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    dry.connect(filter);
    this.dry = dry;

    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    wet.connect(convolver);
    convolver.connect(master);
    this.wet = wet;

    // Two crossfading oscillators
    const gainA = ctx.createGain();
    gainA.gain.value = 0.5;
    gainA.connect(dry);
    gainA.connect(wet);
    this.gainA = gainA;

    const gainB = ctx.createGain();
    gainB.gain.value = 0;
    gainB.connect(dry);
    gainB.connect(wet);
    this.gainB = gainB;

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 60;
    oscA.connect(gainA);
    oscA.start();
    this.oscA = oscA;

    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 60;
    oscB.connect(gainB);
    oscB.start();
    this.oscB = oscB;

    // Noise bed
    const noise = this.makeNoiseSource(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.1;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dry);
    noiseGain.connect(wet);
    noise.start();
    this.noiseGain = noiseGain;

    // LFO modulating filter cutoff
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.lfo = lfo;
    this.lfoGain = lfoGain;

    this.started = true;
    this.resume();
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : this.targetVolume, t, 0.08);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Dispose all audio nodes. */
  public dispose(): void {
    try {
      this.oscA?.stop();
      this.oscB?.stop();
      this.lfo?.stop();
    } catch {
      /* already stopped */
    }
    this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }

  /** Morph audio parameters from era weights (called each frame while running). */
  public update(weights: EraWeights): void {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Find the two active eras from the weights vector.
    let lo = 0;
    for (let i = 0; i < ERA_COUNT; i++) {
      if (weights[i] > 0) {
        lo = i;
        break;
      }
    }
    let hi = lo + 1;
    if (hi >= ERA_COUNT) hi = lo;
    const wLo = weights[lo];
    const wHi = hi > lo ? weights[hi] : 0;

    const a = ERAS[lo].audio;
    const b = ERAS[hi].audio;

    const baseFreq = lerpVal(a.base, b.base, wHi);
    const cutoff = lerpVal(a.cutoff, b.cutoff, wHi);
    const detune = lerpVal(a.detune, b.detune, wHi);
    const noise = lerpVal(a.noise, b.noise, wHi);
    const lfoRate = lerpVal(a.lfo, b.lfo, wHi);
    const reverb = lerpVal(a.reverb, b.reverb, wHi);

    // Smoothly schedule parameters.
    this.filter?.frequency.setTargetAtTime(cutoff, now, 0.15);
    this.noiseGain?.gain.setTargetAtTime(noise * 0.5, now, 0.2);
    this.lfo?.frequency.setTargetAtTime(lfoRate, now, 0.2);
    this.lfoGain?.gain.setTargetAtTime(cutoff * 0.4, now, 0.2);
    this.wet?.gain.setTargetAtTime(reverb * 0.6, now, 0.2);

    // Oscillator A = lower era, B = upper era; crossfade by fractional weight.
    if (this.oscA) {
      this.oscA.type = a.type;
      this.oscA.frequency.setTargetAtTime(baseFreq, now, 0.2);
      this.oscA.detune.setTargetAtTime(-detune, now, 0.2);
    }
    if (this.oscB && hi > lo) {
      this.oscB.type = b.type;
      this.oscB.frequency.setTargetAtTime(b.base, now, 0.2);
      this.oscB.detune.setTargetAtTime(detune, now, 0.2);
    }
    this.gainA?.gain.setTargetAtTime(0.42 * (1 - wHi) + 0.001, now, 0.12);
    this.gainB?.gain.setTargetAtTime(0.42 * wHi + 0.001, now, 0.12);
  }

  // --- internal helpers ---

  private makeNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // brown-ish noise for a soft bed
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  private makeImpulse(
    ctx: AudioContext,
    duration: number,
    decay: number,
  ): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return impulse;
  }
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
