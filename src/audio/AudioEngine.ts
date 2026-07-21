import type { AmbientAudioDef } from '../types';

// ---------------------------------------------------------------------------
// AudioEngine — procedural ambient synthesis via the Web Audio API.
// No external audio files. Everything is generated: a drone bed of detuned
// oscillators, a filtered-noise rumble, periodic transients (engine passes /
// footsteps), and a one-shot transition whoosh.
//
// The engine is a singleton (one AudioContext per page). It lazily creates the
// context on the first user gesture (browsers require this) and then runs.
// ---------------------------------------------------------------------------

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private transientGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private rumbleSource: AudioBufferSourceNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private transientInterval: number | null = null;
  private started = false;
  private running = false;

  /**
   * Lazily create the AudioContext and build the synth graph. Must be called
   * from a user gesture. Safe to call multiple times.
   */
  init(): void {
    if (this.started) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // Web Audio unavailable
    const ctx = new Ctor();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(ctx.destination);

    // --- Drone bed: three detuned oscillators through a gentle lowpass ---
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.5;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 600;
    droneFilter.Q.value = 0.5;
    this.droneGain.connect(droneFilter);
    droneFilter.connect(this.masterGain);

    // --- Rumble: filtered brown-ish noise ---
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.2;
    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 180;
    this.rumbleGain.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.masterGain);

    const noiseBuffer = this.makeNoiseBuffer(ctx, 2);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;
    noiseSrc.connect(this.rumbleGain);
    noiseSrc.start();
    this.rumbleSource = noiseSrc;

    // Start drones (default era 0 frequencies, updated by updateAmbient)
    this.startDrones([55, 82.5, 110]);

    this.started = true;
  }

  private makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Brown noise (integrated white noise) for a deep rumble
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  private startDrones(freqs: number[]): void {
    if (!this.ctx || !this.droneGain) return;
    // Stop old drones
    for (const osc of this.droneOscs) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.droneOscs = [];

    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      // Subtle detune for richness
      osc.detune.value = (i - 1) * 6;
      const g = this.ctx!.createGain();
      g.gain.value = 0.18;
      osc.connect(g);
      g.connect(this.droneGain!);
      osc.start();
      this.droneOscs.push(osc);
    });
  }

  /** Resume the context (after a user gesture) and start ambient playback. */
  async resume(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this.running = true;
    this.fadeMaster(0.6, 0.5);
    this.startTransients();
  }

  /** Suspend / mute ambient playback. */
  suspend(): void {
    this.running = false;
    this.fadeMaster(0, 0.3);
    this.stopTransients();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  private fadeMaster(target: number, duration: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + duration);
  }

  /**
   * Update ambient parameters from the current era blend. Called every frame
   * by AudioDriver. Cheap: just sets gain + frequency targets.
   */
  updateAmbient(def: AmbientAudioDef): void {
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;
    const ramp = 0.1;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(def.gain * 0.6, now, ramp);
    }
    if (this.rumbleGain) {
      this.rumbleGain.gain.setTargetAtTime(def.rumble * 0.4, now, ramp);
    }
    // Update drone frequencies smoothly
    this.droneOscs.forEach((osc, i) => {
      const f = def.drone[i] ?? def.drone[0];
      osc.frequency.setTargetAtTime(f, now, ramp);
    });
    // Store transient level for the interval callback
    this._transientLevel = def.transient;
  }

  private _transientLevel = 0;

  // --- Periodic transients (engine passes / footsteps) ---
  private startTransients(): void {
    if (this.transientInterval != null) return;
    this.transientInterval = window.setInterval(() => {
      if (!this.running || this._transientLevel < 0.05) return;
      this.playTransient();
    }, 900);
  }

  private stopTransients(): void {
    if (this.transientInterval != null) {
      clearInterval(this.transientInterval);
      this.transientInterval = null;
    }
  }

  /** A short filtered noise burst — an engine pass or footstep. */
  private playTransient(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 0.18;

    const buf = this.makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200 + Math.random() * 600;
    filter.Q.value = 1.5;

    const g = ctx.createGain();
    const vol = this._transientLevel * 0.25;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur);
  }

  // --- Transition whoosh ---
  /**
   * A one-shot whoosh: filtered noise swept from low→high→low with a gain
   * envelope. Played on era change.
   */
  whoosh(): void {
    if (!this.ctx || !this.masterGain || !this.running) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 0.7;

    const buf = this.makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    // Sweep frequency up then down
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + dur * 0.4);
    filter.frequency.exponentialRampToValueAtTime(400, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.35, now + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur);
  }

  get isRunning(): boolean {
    return this.running;
  }
}

export const audioEngine = new AudioEngine();
