import { EraAudioProfile } from '../eras/types';

/**
 * Procedural audio engine. All sound is synthesized with WebAudio:
 * - a music loop (bass + arpeggiated lead) scheduled per era
 * - a continuous ambience bed (filtered noise + tones)
 * Lazy-initialized on first user gesture (autoplay policy).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private loopTimer: number | null = null;
  private ambienceNodes: AudioNode[] = [];
  private muted = false;
  private started = false;
  private current: EraAudioProfile | null = null;
  private baseNote = 220; // A3

  get isStarted(): boolean {
    return this.started;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Initialize/resume on first gesture. Safe to call repeatedly. */
  public ensure(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.35;
      this.ambienceGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.started = true;
    return true;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  /** Switch to a new era's music + ambience. */
  public setEra(profile: EraAudioProfile): void {
    this.current = profile;
    // Do not create/resume the AudioContext until a user gesture has unlocked it
    // (browser autoplay policy). The era profile is applied on unlock.
    if (!this.started) return;
    if (!this.ensure()) return;
    this.stopLoop();
    this.stopAmbience();
    this.startAmbience(profile);
    this.scheduleLoop(profile);
  }

  /** Called on first user gesture to unlock audio and apply the current era. */
  public unlock(): void {
    if (!this.ensure()) return;
    if (this.current) this.setEra(this.current);
  }

  private stopLoop(): void {
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleLoop(profile: EraAudioProfile): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const beatDur = 60 / profile.bpm;
    const stepCount = 16;
    const scale = profile.scale.length > 0 ? profile.scale : [0];

    const playStep = (step: number) => {
      const t = ctx.currentTime + 0.02;
      // bass on every 4th step
      if (step % 4 === 0) {
        const bassNote = this.baseNote / 2;
        this.voice(bassNote, profile.bass, 0.5, t, this.musicGain!, 0.35);
      }
      // lead arpeggio on off-beats
      if (step % 2 === 1) {
        const deg = scale[(step >> 1) % scale.length] ?? 0;
        const semis = (scale[(step) % scale.length] ?? 0) + 12;
        const note = this.baseNote * Math.pow(2, semis / 12);
        this.voice(note, profile.lead, beatDur * 0.5, t, this.musicGain!, 0.22);
        void deg;
      }
    };

    const runLoop = () => {
      if (!this.current || this.current !== profile) return;
      for (let s = 0; s < stepCount; s++) {
        const step = s;
        window.setTimeout(() => {
          if (this.current === profile) playStep(step);
        }, step * (beatDur * 1000));
      }
      this.loopTimer = window.setTimeout(runLoop, stepCount * beatDur * 1000);
    };
    runLoop();
  }

  private voice(
    freq: number,
    type: OscillatorType,
    dur: number,
    when: number,
    dest: AudioNode,
    gain: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private startAmbience(profile: EraAudioProfile): void {
    if (!this.ctx || !this.ambienceGain) return;
    const ctx = this.ctx;
    // noise buffer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    switch (profile.ambience) {
      case 'distant_trains':
        filter.frequency.value = 220;
        break;
      case 'traffic_hum':
        filter.frequency.value = 400;
        break;
      case 'arcade_blips':
        filter.frequency.value = 1200;
        break;
      case 'soft_city':
        filter.frequency.value = 320;
        break;
      case 'quiet_future':
        filter.frequency.value = 180;
        break;
    }
    const amp = ctx.createGain();
    amp.gain.value = 0.25;
    noise.connect(filter);
    filter.connect(amp);
    amp.connect(this.ambienceGain);
    noise.start();

    // arcade: add periodic blips
    if (profile.ambience === 'arcade_blips') {
      const blipTimer = window.setInterval(() => {
        if (this.current !== profile || !this.ctx) return;
        const f = 600 + Math.random() * 1400;
        this.voice(f, 'square', 0.08, this.ctx.currentTime, this.ambienceGain!, 0.08);
      }, 350);
      this.ambienceNodes.push({ stop: () => window.clearInterval(blipTimer) } as unknown as AudioNode);
    }

    this.ambienceNodes.push(noise, filter, amp);
  }

  private stopAmbience(): void {
    this.ambienceNodes.forEach((n) => {
      const sn = n as unknown as { stop?: () => void };
      if (typeof sn.stop === 'function') {
        try { sn.stop(); } catch { /* already stopped */ }
      }
      try { (n as AudioNode).disconnect(); } catch { /* noop */ }
    });
    this.ambienceNodes = [];
  }

  public dispose(): void {
    this.stopLoop();
    this.stopAmbience();
    if (this.ctx) void this.ctx.close();
  }
}

export const audioEngine = new AudioEngine();
