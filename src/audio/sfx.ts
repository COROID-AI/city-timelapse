import type { EraYear } from '../eras';

/**
 * Procedural SFX / ambient audio engine built on the Web Audio API.
 *
 * Every era gets a layered, era-appropriate ambient bed (plus vehicle sound)
 * that is generated entirely from oscillators and noise buffers — no external
 * audio assets are required. A transition whoosh/sweep is played whenever the
 * active era changes.
 *
 * Because browsers block audio until a user gesture, the engine must be
 * {@link SfxEngine.init}ialized from a user interaction (a click, pointer
 * down, or key press). Until then it simply records the desired era and
 * starts playing as soon as it is unlocked.
 */
export interface SfxEngineOptions {
  /** Master output volume 0..1 (default 0.5). */
  masterVolume?: number;
  /** Start muted (default false). */
  muted?: boolean;
}

/** A single scheduled tone (oscillator burst). */
interface ToneSpec {
  frequency: number;
  type: OscillatorType;
  /** Seconds the tone is audible. */
  duration: number;
  /** Peak gain 0..1. */
  gain: number;
  /** Optional frequency sweep target (exponential). */
  slideTo?: number;
  /** Seconds before the tone starts (for chime arpeggios). */
  delay?: number;
}

export class SfxEngine {
  private readonly masterVolume: number;
  private muted: boolean;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private currentEra: EraYear | null = null;
  private initialized = false;
  private disposed = false;

  private ambientNodes: AudioNode[] = [];
  private ambientSources: (AudioBufferSourceNode | OscillatorNode)[] = [];
  private scheduler: number | null = null;
  private schedulerTick = 0;

  constructor(options: SfxEngineOptions = {}) {
    this.masterVolume = options.masterVolume ?? 0.5;
    this.muted = options.muted ?? false;
  }

  /**
   * Unlock the AudioContext and start the currently selected era's ambient
   * bed. MUST be called from a user-gesture handler to satisfy browser
   * autoplay policies. Safe to call repeatedly.
   */
  init(): void {
    if (this.initialized || this.disposed) {
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return;
    }
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.initialized = true;

    // If an era was selected before the user interacted, start it now.
    if (this.currentEra !== null) {
      this.startAmbient(this.currentEra);
    }
  }

  /**
   * Select the era to play. Switches the ambient bed and is intended to be
   * called together with {@link playTransition} when the transition engine
   * fires.
   */
  setEra(era: EraYear): void {
    this.currentEra = era;
    if (this.ctx && this.master) {
      this.startAmbient(era);
    }
  }

  /** Play the transition whoosh/sweep. No-op until initialized (or muted). */
  playTransition(): void {
    if (!this.ctx || !this.master || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const buffer = this.ensureNoise(ctx);
    const t = ctx.currentTime;
    const dur = 1.4;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(3400, t + dur * 0.5);
    filter.frequency.exponentialRampToValueAtTime(220, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.12);
    gain.gain.setValueAtTime(0.5, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
    source.stop(t + dur + 0.05);
  }

  /** Mute or unmute the master output. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      const target = muted ? 0 : this.masterVolume;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Release all audio resources. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopAmbient();
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.master = null;
  }

  // --- ambient bed ----------------------------------------------------------

  private startAmbient(era: EraYear): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }
    this.stopAmbient();
    this.currentEra = era;

    const nodes: AudioNode[] = [];
    const sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
    const noise = this.ensureNoise(ctx);

    const addNoiseLoop = (
      filterType: BiquadFilterType,
      freq: number,
      gain: number,
      q = 0.7,
    ): void => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
      nodes.push(filter, g);
      sources.push(src);
    };

    const addOsc = (
      type: OscillatorType,
      freq: number,
      gain: number,
      detune = 0,
    ): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(master);
      osc.start();
      nodes.push(g);
      sources.push(osc);
    };

    // A low oscillator whose frequency is wobbled by an LFO (engine rumble).
    const addEngine = (
      baseFreq: number,
      gain: number,
      lfoFreq: number,
      lfoDepth: number,
    ): void => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = baseFreq;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoFreq;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      nodes.push(g, lfoGain);
      sources.push(osc, lfo);
    };

    // A gentle vibrato LFO injected into an oscillator's detune (tape wobble).
    const addWobble = (target: OscillatorNode, lfoFreq: number, depth: number): void => {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoFreq;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = depth;
      lfo.connect(lfoGain);
      lfoGain.connect(target.detune);
      lfo.start();
      nodes.push(lfoGain);
      sources.push(lfo);
    };

    switch (era) {
      case 1945: {
        // Muffled street hum (low-passed noise).
        addNoiseLoop('lowpass', 320, 0.16);
        // Muffled big-band warm pad (soft, filtered feel).
        const pad1 = ctx.createOscillator();
        pad1.type = 'triangle';
        pad1.frequency.value = 130.8; // C3
        const pad2 = ctx.createOscillator();
        pad2.type = 'triangle';
        pad2.frequency.value = 164.8; // E3
        const pad3 = ctx.createOscillator();
        pad3.type = 'triangle';
        pad3.frequency.value = 196.0; // G3
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 900;
        const padGain = ctx.createGain();
        padGain.gain.value = 0.05;
        pad1.connect(padFilter);
        pad2.connect(padFilter);
        pad3.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(master);
        pad1.start();
        pad2.start();
        pad3.start();
        nodes.push(padFilter, padGain);
        sources.push(pad1, pad2, pad3);
        // Vintage engine rumbles.
        addEngine(42, 0.05, 7.5, 10);
        addEngine(48, 0.035, 7.5, 10);
        break;
      }
      case 1965: {
        // Tape-warm ambient hiss.
        addNoiseLoop('lowpass', 1400, 0.06);
        // Doo-wop "ooh" pad with tape wobble.
        const pad1 = ctx.createOscillator();
        pad1.type = 'triangle';
        pad1.frequency.value = 174.6; // F3
        const pad2 = ctx.createOscillator();
        pad2.type = 'triangle';
        pad2.frequency.value = 220.0; // A3
        const pad3 = ctx.createOscillator();
        pad3.type = 'triangle';
        pad3.frequency.value = 261.6; // C4
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 1600;
        const padGain = ctx.createGain();
        padGain.gain.value = 0.05;
        pad1.connect(padFilter);
        pad2.connect(padFilter);
        pad3.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(master);
        pad1.start();
        pad2.start();
        pad3.start();
        addWobble(pad1, 0.6, 14);
        addWobble(pad2, 0.6, 14);
        nodes.push(padFilter, padGain);
        sources.push(pad1, pad2, pad3);
        // V8 idle rumble.
        addEngine(38, 0.06, 20, 8);
        addOsc('square', 76, 0.018);
        break;
      }
      case 1985: {
        // Synth-pop pad (detuned saws for that wide 80s chorus).
        addOsc('sawtooth', 110.0, 0.03, -8);
        addOsc('sawtooth', 110.0, 0.03, 8);
        addOsc('sawtooth', 164.8, 0.025, -8);
        addOsc('sawtooth', 164.8, 0.025, 8);
        // Digital beeps + arcade bleeps scheduled on a timer.
        this.startScheduler(era);
        break;
      }
      case 2005: {
        // Pop / early-digital ambient (clean pad + bright air).
        addOsc('sine', 130.8, 0.05); // C3
        addOsc('sine', 196.0, 0.04); // G3
        addNoiseLoop('highpass', 2000, 0.025);
        // Modern engine hum (smooth).
        addOsc('sine', 60, 0.05);
        addOsc('sine', 120, 0.025);
        break;
      }
      case 2025: {
        // Minimal electronic ambient (sparse sines).
        addOsc('sine', 220.0, 0.03);
        addOsc('sine', 277.2, 0.025); // C#4
        addOsc('sine', 329.6, 0.02); // E4
        // Electric vehicle whir.
        addEngine(1800, 0.012, 6, 90);
        // Notification chimes scheduled on a timer.
        this.startScheduler(era);
        break;
      }
    }

    this.ambientNodes = nodes;
    this.ambientSources = sources;
  }

  private stopAmbient(): void {
    if (this.scheduler !== null) {
      window.clearInterval(this.scheduler);
      this.scheduler = null;
    }
    for (const src of this.ambientSources) {
      try {
        src.stop();
      } catch {
        // Already stopped — ignore.
      }
      src.disconnect();
    }
    for (const node of this.ambientNodes) {
      node.disconnect();
    }
    this.ambientSources = [];
    this.ambientNodes = [];
  }

  // --- one-shot event scheduling -------------------------------------------

  private startScheduler(era: EraYear): void {
    if (this.scheduler !== null) {
      window.clearInterval(this.scheduler);
    }
    const intervalMs = era === 2025 ? 2200 : 1600;
    this.schedulerTick = 0;
    this.scheduler = window.setInterval(() => {
      this.schedulerTick += 1;
      if (era === 2025) {
        this.playTone({ frequency: 880, type: 'sine', duration: 0.5, gain: 0.12 });
        this.playTone({
          frequency: 1318.5,
          type: 'sine',
          duration: 0.7,
          gain: 0.1,
          delay: 0.12,
        });
      } else if (this.schedulerTick % 3 === 0) {
        this.playArcadeBlip();
      } else {
        this.playTone({
          frequency: this.schedulerTick % 2 === 0 ? 880 : 1174.7,
          type: 'square',
          duration: 0.08,
          gain: 0.06,
        });
      }
    }, intervalMs);
  }

  private playTone(spec: ToneSpec): void {
    if (!this.ctx || !this.master || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime + (spec.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.frequency, t);
    if (spec.slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(spec.slideTo, t + spec.duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(spec.gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + spec.duration + 0.05);
  }

  private playArcadeBlip(): void {
    if (!this.ctx || !this.master || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // --- noise buffer ---------------------------------------------------------

  private ensureNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
