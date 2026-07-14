import type { EraConfig } from '../config/eras';

// ============================================================================
// Procedural audio engine. All sounds synthesized via Web Audio API — no
// external audio files (offline, no 404s). Ambient bed per era that crossfades
// when the era changes, plus a UI click. Respects autoplay policy (AudioContext
// is only created on first user gesture via init()).
// ============================================================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = false;
  private started = false;

  // per-era ambient nodes
  private ambient: AmbientBed | null = null;
  private nextAmbient: AmbientBed | null = null;
  private crossFadeStart = 0;
  private crossFadeDur = 1.4;
  private crossFading = false;

  private currentEra: number = -1;
  // pending era queued before audio is started (autoplay policy)
  private pendingEraConfig: EraConfig | null = null;
  private pendingEra: number = -1;

  // call on first user gesture to satisfy autoplay policy
  init(): void {
    if (this.started) return;
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
      this.started = true;
      // start pending ambient bed if one was queued
      if (this.pendingEraConfig && this.pendingEra >= 0) {
        this.ambient = this.createAmbient(this.pendingEraConfig);
        this.currentEra = this.pendingEra;
        this.pendingEraConfig = null;
      }
    } catch {
      // no audio available
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.started) {
      // init will be called by gesture; just remember the intent
      if (on) this.init();
      return;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.15);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isStarted(): boolean {
    return this.started;
  }

  // ---- Ambient bed management ---------------------------------------------

  setEra(era: EraConfig, eraIndex: number): void {
    if (!this.started || !this.ctx || !this.masterGain) {
      // queue for when audio starts (autoplay policy)
      this.pendingEraConfig = era;
      this.pendingEra = eraIndex;
      return;
    }
    if (this.currentEra === eraIndex) return;
    this.currentEra = eraIndex;
    if (this.ambient === null) {
      this.ambient = this.createAmbient(era);
    } else {
      // crossfade to new era
      this.nextAmbient = this.createAmbient(era);
      this.crossFadeStart = this.ctx.currentTime;
      this.crossFading = true;
    }
  }

  update(): void {
    if (!this.ctx || !this.crossFading || !this.nextAmbient || !this.ambient) return;
    const elapsed = this.ctx.currentTime - this.crossFadeStart;
    const t = Math.min(1, elapsed / this.crossFadeDur);
    // equal-power crossfade
    const a = Math.cos((t * Math.PI) / 2);
    const b = Math.cos(((1 - t) * Math.PI) / 2);
   this.ambient.gain.gain.value = a;
   this.nextAmbient.gain.gain.value = b;
    if (t >= 1) {
      this.ambient.stop();
      this.ambient = this.nextAmbient;
      this.nextAmbient = null;
      this.crossFading = false;
    }
    this.ambient.update(this.ctx.currentTime);
    if (this.nextAmbient) this.nextAmbient.update(this.ctx.currentTime);
  }

  // ---- UI click ------------------------------------------------------------
  playClick(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // ---- Create era-appropriate ambient bed ---------------------------------
  private createAmbient(era: EraConfig): AmbientBed {
    if (!this.ctx || !this.masterGain) throw new Error('no ctx');
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain);
    const bed = new AmbientBed(this.ctx, gain, era);
    bed.start();
   gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.3);
    return bed;
  }

  dispose(): void {
    if (this.ambient) this.ambient.stop();
    if (this.nextAmbient) this.nextAmbient.stop();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}

// ---------------------------------------------------------------------------
// An ambient bed is a collection of looping oscillators + noise shaped per era.
// Each era has a distinct character: 1945 distant city hum, 1965 radio warmth,
// 1985 synth bass, 2005 digital shimmer, 2025 clean electronic, 2055 sci-fi
// drone. Synthesized with oscillators and filtered noise.
// ---------------------------------------------------------------------------
class AmbientBed {
  gain: GainNode;
  private ctx: AudioContext;
  private nodes: AudioNode[] = [];
  private era: EraConfig;

  constructor(ctx: AudioContext, gain: GainNode, era: EraConfig) {
    this.ctx = ctx;
    this.gain = gain;
    this.era = era;
  }

  start(): void {
    const era = this.era.year;
    this.gain.gain.value = 0;

    // base drone (every era)
    const droneFreq = era === 2055 ? 55 : era === 2025 ? 65 : era === 2005 ? 73 : era === 1985 ? 82 : era === 1965 ? 98 : 110;
    const drone = this.ctx.createOscillator();
    drone.type = era >= 2025 ? 'sine' : 'triangle';
    drone.frequency.value = droneFreq;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.08;
    drone.connect(droneGain);
    droneGain.connect(this.gain);
    drone.start();
    this.nodes.push(drone, droneGain);

    // fifth harmony
    const harm = this.ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = droneFreq * 1.5;
    const harmGain = this.ctx.createGain();
    harmGain.gain.value = 0.04;
    harm.connect(harmGain);
    harmGain.connect(this.gain);
    harm.start();
    this.nodes.push(harm, harmGain);

    // LFO for subtle modulation
    const lfoOsc = this.ctx.createOscillator();
    lfoOsc.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfoOsc.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfoOsc.start();
    this.nodes.push(lfoOsc, lfoGain);

    // white noise buffer (wind/traffic/synth noise)
    const noiseBuf = this.makeNoiseBuffer(2);
    const wind = this.ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';

    if (era === 1945) {
      noiseFilter.frequency.value = 400;
      noiseFilter.Q.value = 0.5;
    } else if (era === 1965) {
      noiseFilter.frequency.value = 800;
      noiseFilter.Q.value = 0.7;
    } else if (era === 1985) {
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1200;
      noiseFilter.Q.value = 1.0;
    } else if (era === 2005) {
      noiseFilter.frequency.value = 2000;
      noiseFilter.Q.value = 0.8;
    } else if (era === 2025) {
      noiseFilter.frequency.value = 600;
      noiseFilter.Q.value = 0.5;
    } else {
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 3000;
      noiseFilter.Q.value = 2.0;
    }

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = era === 2055 ? 0.05 : era === 2025 ? 0.03 : 0.06;
    wind.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gain);
    wind.start();
    this.nodes.push(wind, noiseFilter, noiseGain);

    // era-specific accents
    if (era === 1985 || era === 2005 || era === 2055) {
      const shimmer = this.ctx.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.value = era === 2055 ? 1760 : era === 2005 ? 1318 : 1568;
      const sg = this.ctx.createGain();
      sg.gain.value = 0.012;
      shimmer.connect(sg);
      sg.connect(this.gain);
      shimmer.start();
      this.nodes.push(shimmer, sg);
      const tOsc = this.ctx.createOscillator();
      tOsc.frequency.value = 0.4;
      const tGain = this.ctx.createGain();
      tGain.gain.value = 0.01;
      tOsc.connect(tGain);
      tGain.connect(sg.gain);
      tOsc.start();
      this.nodes.push(tOsc, tGain);
    }

    if (era === 1945 || era === 1965) {
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = droneFreq / 2;
      const subG = this.ctx.createGain();
      subG.gain.value = 0.06;
      sub.connect(subG);
      subG.connect(this.gain);
      sub.start();
      this.nodes.push(sub, subG);
    }

    if (era === 2055) {
      const pulse = this.ctx.createOscillator();
      pulse.type = 'sine';
      pulse.frequency.value = 220;
      const pg = this.ctx.createGain();
      pg.gain.value = 0;
      pulse.connect(pg);
      pg.connect(this.gain);
      pulse.start();
      this.nodes.push(pulse, pg);
      const pulseLfo = this.ctx.createOscillator();
      pulseLfo.frequency.value = 0.7;
      const pulseLfoG = this.ctx.createGain();
      pulseLfoG.gain.value = 0.04;
      pulseLfo.connect(pulseLfoG);
      pulseLfoG.connect(pg.gain);
      pulseLfo.start();
      this.nodes.push(pulseLfo, pulseLfoG);
    }
  }

  update(time: number): void {
    void time;
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  stop(): void {
    try {
      for (const n of this.nodes) {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) {
          n.stop();
        }
        n.disconnect();
      }
    } catch {
      // already stopped
    }
    this.nodes = [];
  }
}
