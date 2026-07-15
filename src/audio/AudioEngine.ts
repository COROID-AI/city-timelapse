import type { EraIndex } from "../types";
import { ERAS } from "../config/eras";

/**
 * Fully synthesized audio via Web Audio API. No binary assets.
 *
 * - Era-appropriate ambient beds: filtered noise + drones tuned per era mood.
 * - Transition "whoosh" with a pitch sweep.
 * - UI click on era selection.
 * - Mute toggle.
 *
 * All audio is gated behind a user gesture (the Start overlay calls resume()).
 */

type Mood = EraIndex;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentBed: AmbientBed | null = null;
  private muted = false;
  private started = false;

  /** Base note frequencies for each era's drone (Hz). */
  private static readonly DRONE_FREQS: readonly number[] = [
    55, // 1945 — low warm
    65.4, // 1965 — C2
    49, // 1985 — dark G1
    73.4, // 2005 — D2
    82.4, // 2025 — E2
    110, // 2055 — A2
  ];

  /** Filter cutoffs for the noise bed per era. */
  private static readonly NOISE_CUTOFFS: readonly number[] = [
    320, // 1945 — muffled
    600, // 1965 — open
    800, // 1985 — grit
    500, // 2005 — clean
    700, // 2025 — airy
    1400, // 2055 — shimmer
  ];

  get isStarted(): boolean {
    return this.started;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Create the AudioContext (must be called from a user gesture). */
  async resume(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.35;
      this.ambientGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.started = true;
  }

  /** Start or crossfade the ambient bed for an era. */
  setEraBed(era: EraIndex): void {
    if (!this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;
    const freq = AudioEngine.DRONE_FREQS[era];
    const cutoff = AudioEngine.NOISE_CUTOFFS[era];

    // Fade out old bed.
    if (this.currentBed) {
      const old = this.currentBed;
      const now = ctx.currentTime;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.8);
      // Stop after fade.
      window.setTimeout(() => {
        try {
          old.oscs.forEach((o) => o.stop());
          old.noiseSource?.stop();
          old.nodes.forEach((n) => n.disconnect());
        } catch {
          /* already stopped */
        }
      }, 1000);
    }

    // Build new bed.
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(this.ambientGain);
    const now = ctx.currentTime;
    bedGain.gain.linearRampToValueAtTime(1, now + 1.2);

    const nodes: AudioNode[] = [bedGain];
    const oscs: OscillatorNode[] = [];

    // Drone: two detuned oscillators (root + fifth).
    const droneFreqs = [freq, freq * 1.5];
    for (const f of droneFreqs) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.12;
      // Slow LFO for breathing.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);
      osc.connect(oscGain);
      oscGain.connect(bedGain);
      osc.start();
      lfo.start();
      oscs.push(osc, lfo);
      nodes.push(oscGain, lfoGain);
    }

    // Noise bed (traffic/wind texture).
    const noiseSource = this.createNoiseSource();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = cutoff;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(bedGain);
    noiseSource.start();
    nodes.push(noiseFilter, noiseGain);

    this.currentBed = { oscs, noiseSource, gain: bedGain, nodes };
  }

  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  /** Play a transition whoosh. */
  playTransition(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Pitch-swept noise.
    const src = this.createNoiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
    filter.frequency.exponentialRampToValueAtTime(400, now + 1.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 1.4);

    // Tonal chime sweep.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.08, now + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 1.1);
  }

  /** Play a soft UI click. */
  playClick(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : 0.5,
        now + 0.15
      );
    }
    return this.muted;
  }

  setMute(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, now + 0.15);
    }
  }

  getEraName(era: EraIndex): string {
    return ERAS[era].name;
  }

  dispose(): void {
    if (this.currentBed) {
      try {
        this.currentBed.oscs.forEach((o) => o.stop());
        this.currentBed.noiseSource?.stop();
        this.currentBed.nodes.forEach((n) => n.disconnect());
      } catch {
        /* ignore */
      }
      this.currentBed = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

interface AmbientBed {
  oscs: OscillatorNode[];
  noiseSource: AudioBufferSourceNode;
  gain: GainNode;
  nodes: AudioNode[];
}

export type { Mood };
