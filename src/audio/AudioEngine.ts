import type { EraId } from '../types';

/**
 * Procedural ambient audio engine using the Web Audio API. All sound is
 * synthesised at runtime (no external assets) so the build is self-contained.
 *
 * IMPORTANT (autoplay policy): the AudioContext is only created / resumed
 * inside a user gesture handler (toggle / era click). It is NEVER created on
 * load or autoplayed.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private currentEra: EraId = '1945';
  private started = false;
  private muted = false;
  private targetVolume = 0.18;

  get isStarted(): boolean {
    return this.started;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Must be called from within a user gesture. Creates and resumes the
   * AudioContext, then starts the ambient bed for the current era.
   */
  async start(initialEra: EraId): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.targetVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.started = true;
    this.currentEra = initialEra;
    this.buildEraBed(initialEra);
  }

  /** Tear down the current era's nodes and build a new bed. */
  setEra(era: EraId): void {
    if (!this.started || !this.ctx) return;
    this.currentEra = era;
    this.buildEraBed(era);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : this.targetVolume,
        t + 0.25,
      );
    }
  }

  /** Clean up everything; safe to call multiple times. */
  dispose(): void {
    this.stopNodes();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
    this.started = false;
  }

  // --------------------------------------------------------------------
  // Per-era ambient bed construction
  // --------------------------------------------------------------------

  private stopNodes(): void {
    for (const n of this.nodes) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (n as any).stop?.();
      } catch {
        /* not all nodes have stop() */
      }
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes = [];
  }

  private buildEraBed(era: EraId): void {
    if (!this.ctx || !this.masterGain) return;
    this.stopNodes();
    const ctx = this.ctx;

    switch (era) {
      case '1945':
        this.bed1945(ctx);
        break;
      case '1965':
        this.bed1965(ctx);
        break;
      case '1985':
        this.bed1985(ctx);
        break;
      case '2005':
        this.bed2005(ctx);
        break;
      case '2025':
        this.bed2025(ctx);
        break;
      case '2055':
        this.bed2055(ctx);
        break;
    }
  }

  // --- helpers ---
  private add(node: AudioNode): void {
    this.nodes.push(node);
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // --- 1945: warm vinyl crackle + distant tram hum + muffled street ---
  private bed1945(ctx: AudioContext): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const ng = ctx.createGain();
    ng.gain.value = 0.04;
    noise.connect(lp).connect(ng).connect(this.masterGain!);
    noise.start();
    this.add(noise);

    // Low tram hum
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const og = ctx.createGain();
    og.gain.value = 0.03;
    const olp = ctx.createBiquadFilter();
    olp.type = 'lowpass';
    olp.frequency.value = 120;
    osc.connect(olp).connect(og).connect(this.masterGain!);
    osc.start();
    this.add(osc);
  }

  // --- 1965: brighter traffic murmur, light radio-ish tones ---
  private bed1965(ctx: AudioContext): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(bp).connect(ng).connect(this.masterGain!);
    noise.start();
    this.add(noise);

    // Idle engine drone
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 70;
    const og = ctx.createGain();
    og.gain.value = 0.025;
    osc.connect(og).connect(this.masterGain!);
    osc.start();
    this.add(osc);
  }

  // --- 1985: pulsing synth bass + neon hum ---
  private bed1985(ctx: AudioContext): void {
    // Pulsing bass
    const bass = ctx.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.value = 65;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 200;
    const bg = ctx.createGain();
    bg.gain.value = 0.05;
    bass.connect(bf).connect(bg).connect(this.masterGain!);
    bass.start();
    this.add(bass);

    // LFO pulse on the bass gain
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(bg.gain);
    lfo.start();
    this.add(lfo);

    // High neon whine
    const neon = ctx.createOscillator();
    neon.type = 'sine';
    neon.frequency.value = 1560;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.006;
    neon.connect(nGain).connect(this.masterGain!);
    neon.start();
    this.add(neon);
  }

  // --- 2005: city hustle, distant traffic, subtle electric hum ---
  private bed2005(ctx: AudioContext): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(lp).connect(ng).connect(this.masterGain!);
    noise.start();
    this.add(noise);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 120;
    const og = ctx.createGain();
    og.gain.value = 0.02;
    osc.connect(og).connect(this.masterGain!);
    osc.start();
    this.add(osc);
  }

  // --- 2025: modern EV whir + digital chatter ---
  private bed2025(ctx: AudioContext): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    noise.connect(bp).connect(ng).connect(this.masterGain!);
    noise.start();
    this.add(noise);

    // EV whir
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 220;
    const og = ctx.createGain();
    og.gain.value = 0.02;
    osc.connect(og).connect(this.masterGain!);
    osc.start();
    this.add(osc);
  }

  // --- 2055: sci-fi drone + shimmering high pad ---
  private bed2055(ctx: AudioContext): void {
    // Detuned drone
    const d1 = ctx.createOscillator();
    d1.type = 'sawtooth';
    d1.frequency.value = 110;
    const d2 = ctx.createOscillator();
    d2.type = 'sawtooth';
    d2.frequency.value = 110.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const dg = ctx.createGain();
    dg.gain.value = 0.04;
    d1.connect(lp);
    d2.connect(lp);
    lp.connect(dg).connect(this.masterGain!);
    d1.start();
    d2.start();
    this.add(d1);
    this.add(d2);

    // Shimmering high pad
    const pad = ctx.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 1760;
    const pg = ctx.createGain();
    pg.gain.value = 0.008;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain).connect(pg.gain);
    pad.connect(pg).connect(this.masterGain!);
    pad.start();
    lfo.start();
    this.add(pad);
    this.add(lfo);
  }
}
