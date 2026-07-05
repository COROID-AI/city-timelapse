import { EraId, SFX_ERA_DATA } from '../eras';
import { getTransitionSfxParams, TransitionSfxParams } from './transitions';

export interface TransitionPlayerOptions {
  /** Gain relative to master ambient (~0.2 default) */
  volume?: number;
  /** Target spatial radius in meters */
  spatialRadius?: number;
}

export class TransitionPlayer {
  private audioContext: AudioContext | null = null;
  private initialized = false;
  private volume: number;
  private spatialRadius: number;

  constructor(options: TransitionPlayerOptions = {}) {
    this.volume = options.volume ?? 0.22;
    this.spatialRadius = options.spatialRadius ?? 6;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // @ts-expect-error - webkit fallback
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)() as AudioContext;
    this.initialized = true;
  }

  /**
   * Play a transition sound from one era to another.
   * If spatialization is supported, it uses a PannerNode with a small position offset.
   */
  playTransition(from: EraId, to: EraId, cameraPos?: { x: number; y: number; z: number }): void {
    if (!this.initialized || !this.audioContext) return;

    const ctx = this.audioContext;
    const params = getTransitionSfxParams(from, to, SFX_ERA_DATA);

    const buffer = synthTransitionBuffer(ctx, params);
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Spatialize if possible
    const panner = ctx.createPanner();
    // Use HRTF when available; fall back automatically otherwise.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = panner as any;
    if (typeof p.panningModel !== 'undefined') {
      p.panningModel = 'HRTF';
    }
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 20;

    // Place it slightly above/around camera to sound "nearby" but not fixed.
    const cam = cameraPos ?? { x: 0, y: 0, z: 0 };
    const seed = (from + '|' + to).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const angle = (seed % 360) * (Math.PI / 180);
    const radius = this.spatialRadius;
    panner.positionX.setValueAtTime(cam.x + Math.cos(angle) * radius, now);
    panner.positionY.setValueAtTime(cam.y + 1.2, now);
    panner.positionZ.setValueAtTime(cam.z + Math.sin(angle) * radius, now);

    const gain = ctx.createGain();
    const max = 0.33;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(max, this.volume), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + buffer.duration);

    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + buffer.duration);
  }

  dispose(): void {
    if (!this.audioContext) return;
    // no tracking of sources; they should finish naturally.
    this.audioContext.close();
    this.audioContext = null;
    this.initialized = false;
  }
}

function synthTransitionBuffer(ctx: AudioContext, params: TransitionSfxParams): AudioBuffer {
  const sampleRate = ctx.sampleRate;

  const duration =
    params.type === 'whoosh-sweep' ? 0.65 : params.type === 'era-snap' ? 0.35 : params.type === 'glass-chime' ? 0.9 : 0.75;

  const length = Math.max(1, Math.ceil(sampleRate * duration));
  const data = new Float32Array(length);

  const baseFreq = Math.max(40, params.baseFreq);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const p = t / duration;

    // Envelope (fast attack, quick decay, no clicks)
    const attack = 0.015;
    const release = 0.12;
    let env = 0;
    if (p < attack / duration) {
      env = p / (attack / duration);
    } else if (p > 1 - release / duration) {
      env = (1 - p) / (release / duration);
    } else {
      env = 1;
    }

    const noise = (Math.random() * 2 - 1) * params.noiseAmount;

    let tone = 0;
    if (params.type === 'whoosh-sweep') {
      // Band-limited-ish noise with falling resonant tone
      const sweepFreq = baseFreq * (1.8 - 1.0 * p);
      const mod = Math.sin(2 * Math.PI * 3 * p);
      tone = 0.35 * Math.sin(2 * Math.PI * sweepFreq * t) + 0.2 * mod;
      data[i] = (noise * 0.55 + tone) * env * 0.22;
      continue;
    }

    if (params.type === 'era-snap') {
      // Short transient with a couple harmonics
      const f1 = baseFreq * 0.95;
      const f2 = baseFreq * 1.5;
      tone = 0.55 * Math.sin(2 * Math.PI * f1 * t) + 0.25 * Math.sin(2 * Math.PI * f2 * t);
      data[i] = (tone + noise * 0.2) * env * 0.28;
      continue;
    }

    if (params.type === 'vinyl-scratch') {
      // Scratch-ish: noise shaped by a decaying random amplitude plus a faint tonal buzz
      const scratchGate = Math.exp(-p * 6.5);
      const buzz = 0.3 * Math.sin(2 * Math.PI * (baseFreq * 2.2) * t) + 0.15 * Math.sin(2 * Math.PI * (baseFreq * 3.1) * t);
      data[i] = (noise * scratchGate * 0.95 + buzz) * env * 0.2;
      continue;
    }

    // glass-chime
    const partial1 = Math.sin(2 * Math.PI * (baseFreq * 1.0) * t);
    const partial2 = Math.sin(2 * Math.PI * (baseFreq * 2.1) * t);
    const partial3 = Math.sin(2 * Math.PI * (baseFreq * 3.3) * t);
    const decay = Math.exp(-p * 6.0);
    const ring = (0.55 * partial1 + 0.28 * partial2 + 0.17 * partial3) * decay;
    data[i] = (ring + noise * 0.2) * env * 0.22;
  }

  const buffer = ctx.createBuffer(1, data.length, sampleRate);
  buffer.copyToChannel(data, 0);
  return buffer;
}

export const transitionPlayer = new TransitionPlayer();
