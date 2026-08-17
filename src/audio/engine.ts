/** Procedural audio engine using WebAudio API */

export interface AudioProfile {
  baseFreq: number;
  filterFreq: number;
  filterQ: number;
  rhythmSpeed: number;
}

const ERA_PROFILES: Record<string, AudioProfile> = {
  '1945': { baseFreq: 120, filterFreq: 800, filterQ: 2, rhythmSpeed: 0.3 },
  '1965': { baseFreq: 180, filterFreq: 1200, filterQ: 1.5, rhythmSpeed: 0.5 },
  '1985': { baseFreq: 220, filterFreq: 2000, filterQ: 3, rhythmSpeed: 0.8 },
  '2005': { baseFreq: 200, filterFreq: 1500, filterQ: 1, rhythmSpeed: 0.6 },
  '2025': { baseFreq: 240, filterFreq: 1800, filterQ: 2, rhythmSpeed: 0.7 },
  '2055': { baseFreq: 160, filterFreq: 3000, filterQ: 4, rhythmSpeed: 1.0 },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private initialized = false;
  private volume = 0.5;
  private muted = false;

  init(): boolean {
    if (this.initialized) return true;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * (this.muted ? 0 : 1);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.masterGain) {
      this.masterGain.gain.value = v * (this.muted ? 0 : 1);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume * (m ? 0 : 1);
    }
  }

  playClick(): void {
    if (!this.init()) return;
    this.resume();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx!.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  playWhoosh(): void {
    if (!this.init()) return;
    this.resume();
    const bufferSize = this.ctx!.sampleRate * 0.5;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    const source = this.ctx!.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, this.ctx!.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3000, this.ctx!.currentTime + 0.3);
    filter.Q.value = 2;
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.5);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start();
  }

  startAmbience(eraKey: string): void {
    if (!this.init()) return;
    this.stopAmbience();
    const profile = ERA_PROFILES[eraKey] || ERA_PROFILES['2025'];
    const t = this.ctx!.currentTime;

    // Pad oscillator
    const pad = this.ctx!.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = profile.baseFreq;
    const padGain = this.ctx!.createGain();
    padGain.gain.value = 0.04;
    pad.connect(padGain);
    padGain.connect(this.masterGain!);
    pad.start();
    this.ambientNodes.push(pad, padGain);

    // Filtered noise bed
    const bufLen = this.ctx!.sampleRate * 2;
    const buf = this.ctx!.createBuffer(1, bufLen, this.ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nFilter = this.ctx!.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.value = profile.filterFreq;
    nFilter.Q.value = profile.filterQ;
    const nGain = this.ctx!.createGain();
    nGain.gain.value = 0.02;
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain!);
    noise.start();
    this.ambientNodes.push(noise, nFilter, nGain);
  }

  stopAmbience(): void {
    for (const node of this.ambientNodes) {
      try {
        if ('stop' in node) (node as OscillatorNode).stop();
        node.disconnect();
      } catch {}
    }
    this.ambientNodes = [];
  }

  destroy(): void {
    this.stopAmbience();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }

  isAvailable(): boolean {
    return typeof AudioContext !== 'undefined';
  }
}

export const audioEngine = new AudioEngine();
