/**
 * Synthesized audio engine using the Web Audio API.
 *
 * No external audio assets: every sound is generated procedurally from
 * oscillators + filtered noise. Per-era ambience beds differ in base
 * frequency, noise colour, and modulation; era changes arpeggiate a short
 * motif. Audio is lazy: the AudioContext is created only on the first user
 * gesture and resumes if the browser suspended it.
 */

import type { SfxConfig } from "../data/eras";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceNodes: AudioNode[] = [];
  private currentAmbience: SfxConfig | null = null;
  private _enabled = true;
  private _started = false;

  /** True once the AudioContext has been created by a user gesture. */
  get started(): boolean {
    return this._started;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(v ? 0.9 : 0.0001, now, 0.08);
    }
  }

  /**
   * Create / resume the AudioContext. Must be called from a user gesture.
   * Returns true if audio is running (or will run once suspended state clears).
   */
  init(): boolean {
    if (typeof window === "undefined") return false;
    const Ctor =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext;
    if (!Ctor) return false;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this._enabled ? 0.9 : 0.0001;
      this.master.connect(this.ctx.destination);
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.0;
      this.ambienceGain.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer();
      this._started = true;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx.state === "running" || this.ctx.state === "suspended";
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Stop and tear down the current ambience bed (graceful). */
  private stopAmbience(): void {
    const ctx = this.ctx;
    const gain = this.ambienceGain;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.25);
    const nodes = this.ambienceNodes;
    this.ambienceNodes = [];
    window.setTimeout(() => {
      for (const n of nodes) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (n as any).stop?.();
        } catch {
          /* ignore */
        }
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    }, 600);
  }

  /**
   * Crossfade to a new per-era ambience bed. Safe to call every frame; it only
   * rebuilds the bed when the era's ambience *kind* changes.
   */
  setAmbience(cfg: SfxConfig): void {
    if (!this.ctx || !this.ambienceGain || !this.noiseBuffer) return;
    if (this.currentAmbience && this.currentAmbience.ambience === cfg.ambience) {
      // same bed: gently retune the drone base frequency
      this.currentAmbience = cfg;
      return;
    }
    this.currentAmbience = cfg;
    this.stopAmbience();

    const ctx = this.ctx;
    const out = this.ambienceGain!;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0.0001, now, 0.05);

    // Low drone.
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = cfg.baseFreq;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 600;
    drone.connect(droneFilter).connect(droneGain).connect(out);
    drone.start();
    this.ambienceNodes.push(drone, droneGain, droneFilter);

    // Filtered noise bed coloured by ambience type.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    switch (cfg.ambience) {
      case "wind":
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.value = 500;
        noiseFilter.Q.value = 0.7;
        break;
      case "traffic":
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.value = 300;
        break;
      case "crowd":
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.value = 1200;
        noiseFilter.Q.value = 0.5;
        break;
      case "digital":
        noiseFilter.type = "highpass";
        noiseFilter.frequency.value = 2000;
        break;
    }
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = cfg.noise * 0.18;
    noise.connect(noiseFilter).connect(noiseGain).connect(out);
    noise.start();
    this.ambienceNodes.push(noise, noiseFilter, noiseGain);

    // Slow LFO modulating the drone for life.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cfg.baseFreq * 0.04;
    lfo.connect(lfoGain).connect(drone.frequency);
    lfo.start();
    this.ambienceNodes.push(lfo, lfoGain);

    // Fade the bed in.
    out.gain.setTargetAtTime(0.9, now + 0.1, 0.4);
  }

  /**
   * Play the era-change motif: a quick arpeggio + a soft whoosh.
   */
  playEraChange(cfg: SfxConfig): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const motif = cfg.motif;
    const step = 0.09;
    motif.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = now + i * step;
      const peak = 0.16;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.36);
    });

    // Whoosh: filtered noise sweep.
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, now);
      bp.frequency.exponentialRampToValueAtTime(3500, now + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      noise.connect(bp).connect(g).connect(this.master!);
      noise.start(now);
      noise.stop(now + 0.55);
    }
  }

  /** Dispose everything (used on unmount / context loss). */
  dispose(): void {
    this.stopAmbience();
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
    this.master = null;
    this.ambienceGain = null;
    this.noiseBuffer = null;
    this.ambienceNodes = [];
    this.currentAmbience = null;
    this._started = false;
  }
}

/** Shared singleton instance. */
export const audioEngine = new AudioEngine();
