// Ambient audio: a fully synthesised soundscape (no external mp3). A low
// ambient drone + periodic city pulses are generated with oscillators and a
// noise buffer. AudioContext is lazy-created on first user interaction.

import { EraConfig } from './eras';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private noise: AudioBufferSourceNode | null = null;
  private muted = false;
  private started = false;

  /** Lazily build the audio graph. Safe to call multiple times. */
  init(): void {
    if (this.started) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.12;
      this.droneGain.connect(this.master);

      const freqs = [55, 82.4, 110];
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = 0.3;
        osc.connect(g);
        g.connect(this.droneGain);
        osc.start();
        this.oscillators.push(osc);
      }

      // Wind/noise bed.
      const bufferSize = 2 * this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      this.noise = this.ctx.createBufferSource();
      this.noise.buffer = buffer;
      this.noise.loop = true;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 380;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.05;
      this.noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.master);
      this.noise.start();

      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  /** Resume the context after a user gesture (autoplay policy). */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.1);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Shift the drone base pitch per era for an audible era change. */
  applyEra(state: EraConfig): void {
    if (!this.ctx || !this.droneGain) return;
    const idx = Math.max(0, state.year - 1945) / 80; // 0..1
    const base = 48 + idx * 12; // semitones up over 80 years
    const semis = [0, 7, 12];
    this.oscillators.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(440 * Math.pow(2, (base + (semis[i] ?? 0) - 69) / 12), this.ctx!.currentTime, 0.5);
    });
  }
}
