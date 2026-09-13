/**
 * Procedural era ambience beds synthesized entirely via Web Audio.
 *
 * Provides distinct audio bed configurations for all 6 timelapse eras:
 * 1945 (wartime/post-war sparseness), 1965 (mid-century traffic hum),
 * 1985 (80s urban din & neon buzz), 2005 (modern metropolis roar),
 * 2025 (smart city & EV hum), and 2055 (cyber levitation & atmospheric shimmer).
 *
 * No external sound files or fetches — everything is synthesized from
 * oscillators, procedural noise buffers, and biquad filter networks.
 */

import { clamp } from '../lib/math';
import { createSeededRng } from '../lib/rng';

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055' | string;

export interface EraToneConfig {
  /** Waveform type for tonal drone/hum oscillator. */
  readonly type: OscillatorType;
  /** Frequency in Hz. */
  readonly frequency: number;
  /** Relative amplitude gain in [0, 1]. */
  readonly gain: number;
  /** Detune offset in cents. */
  readonly detune?: number;
}

export interface EraNoiseConfig {
  /** Filter response type. */
  readonly filterType: BiquadFilterType;
  /** Filter cutoff / center frequency in Hz. */
  readonly cutoff: number;
  /** Filter resonance Q factor. */
  readonly resonance?: number;
  /** Relative noise amplitude gain in [0, 1]. */
  readonly gain: number;
}

export interface EraSubBassConfig {
  /** Sub-bass rumble frequency in Hz. */
  readonly frequency: number;
  /** Sub-bass amplitude gain in [0, 1]. */
  readonly gain: number;
}

export interface EraAmbienceDescriptor {
  /** Era identifier matching timeline options. */
  readonly id: EraId;
  /** Descriptive display name. */
  readonly name: string;
  /** Target base volume level for this bed in [0, 1]. */
  readonly baseVolume: number;
  /** Synthesized tone oscillators (mains hum, motor tones, drones). */
  readonly tones: readonly EraToneConfig[];
  /** Synthesized filtered noise layers (wind, traffic wash, air friction). */
  readonly noise: readonly EraNoiseConfig[];
  /** Optional low-frequency sub rumble for ground weight. */
  readonly subBass?: EraSubBassConfig;
}

/**
 * Standard default ambience descriptors for each era in the timelapse.
 */
export const DEFAULT_ERA_AMBIENCE: Record<string, EraAmbienceDescriptor> = {
  '1945': {
    id: '1945',
    name: 'Post-War Sparseness (1945)',
    baseVolume: 0.35,
    tones: [
      { type: 'sine', frequency: 55, gain: 0.15 },
      { type: 'triangle', frequency: 110, gain: 0.08 },
    ],
    noise: [
      { filterType: 'bandpass', cutoff: 650, resonance: 0.8, gain: 0.18 },
    ],
    subBass: { frequency: 45, gain: 0.1 },
  },
  '1965': {
    id: '1965',
    name: 'Mid-Century Traffic Hum (1965)',
    baseVolume: 0.45,
    tones: [
      { type: 'sine', frequency: 60, gain: 0.2 },
      { type: 'triangle', frequency: 120, gain: 0.12 },
      { type: 'sine', frequency: 180, gain: 0.06 },
    ],
    noise: [
      { filterType: 'lowpass', cutoff: 500, resonance: 1.0, gain: 0.25 },
    ],
    subBass: { frequency: 50, gain: 0.15 },
  },
  '1985': {
    id: '1985',
    name: '80s Urban Din & Neon (1985)',
    baseVolume: 0.5,
    tones: [
      { type: 'sawtooth', frequency: 120, gain: 0.08 },
      { type: 'sine', frequency: 240, gain: 0.1 },
      { type: 'sine', frequency: 242, gain: 0.06, detune: 10 },
    ],
    noise: [
      { filterType: 'bandpass', cutoff: 1200, resonance: 1.5, gain: 0.28 },
      { filterType: 'lowpass', cutoff: 800, resonance: 0.7, gain: 0.2 },
    ],
    subBass: { frequency: 58, gain: 0.18 },
  },
  '2005': {
    id: '2005',
    name: '2000s Metropolis Din (2005)',
    baseVolume: 0.52,
    tones: [
      { type: 'sine', frequency: 85, gain: 0.18 },
      { type: 'triangle', frequency: 220, gain: 0.12 },
    ],
    noise: [
      { filterType: 'lowpass', cutoff: 1600, resonance: 0.9, gain: 0.32 },
      { filterType: 'highpass', cutoff: 3000, resonance: 0.5, gain: 0.08 },
    ],
    subBass: { frequency: 40, gain: 0.22 },
  },
  '2025': {
    id: '2025',
    name: '2025 Smart City & EV Flow (2025)',
    baseVolume: 0.4,
    tones: [
      { type: 'triangle', frequency: 320, gain: 0.1 },
      { type: 'sine', frequency: 640, gain: 0.06 },
    ],
    noise: [
      { filterType: 'bandpass', cutoff: 2200, resonance: 2.0, gain: 0.16 },
      { filterType: 'lowpass', cutoff: 600, resonance: 0.5, gain: 0.12 },
    ],
    subBass: { frequency: 38, gain: 0.08 },
  },
  '2055': {
    id: '2055',
    name: '2055 Cyber Levitation (2055)',
    baseVolume: 0.42,
    tones: [
      { type: 'sine', frequency: 216, gain: 0.12 },
      { type: 'sine', frequency: 432, gain: 0.08 },
      { type: 'triangle', frequency: 864, gain: 0.04 },
    ],
    noise: [
      { filterType: 'bandpass', cutoff: 4500, resonance: 3.0, gain: 0.18 },
      { filterType: 'highpass', cutoff: 5000, resonance: 1.0, gain: 0.1 },
    ],
    subBass: { frequency: 32, gain: 0.2 },
  },
};

/**
 * Handle to an active, synthesized era ambience audio graph.
 */
export interface AmbienceBedInstance {
  readonly eraId: string;
  readonly descriptor: EraAmbienceDescriptor;
  readonly gainNode: GainNode;
  /** Set or ramp the bed's output volume. */
  setVolume(targetVolume: number, rampDuration?: number, startTime?: number): void;
  /** Stop all oscillators and noise sources in this bed. */
  stop(stopTime?: number): void;
  /** Disconnect and dispose all Web Audio nodes in this bed. */
  disconnect(): void;
}

/**
 * Generate a procedural looping white noise AudioBuffer using a deterministic PRNG.
 */
export function createNoiseBuffer(
  ctx: AudioContext,
  durationSeconds = 3,
  seed = 42,
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  const rng = createSeededRng(seed);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = rng.range(-1, 1);
  }

  return buffer;
}

/**
 * Compute an equal-power gain curve array for smooth crossfades without acoustic dips.
 * Formula: for normalized progress p in [0, 1]:
 * fade-in:  gain(p) = sin(p * PI / 2)
 * fade-out: gain(p) = cos(p * PI / 2)
 */
export function createEqualPowerFadeCurve(
  startGain: number,
  endGain: number,
  points = 32,
): Float32Array {
  const length = Math.max(2, points);
  const curve = new Float32Array(length);
  const isFadeIn = startGain <= endGain;

  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    if (isFadeIn) {
      const shape = Math.sin((t * Math.PI) / 2);
      curve[i] = startGain + (endGain - startGain) * shape;
    } else {
      const shape = Math.cos((t * Math.PI) / 2);
      curve[i] = endGain + (startGain - endGain) * shape;
    }
  }

  return curve;
}

/**
 * Instantiate a complete synthesized ambience bed for the given era descriptor.
 */
export function createAmbienceBed(
  ctx: AudioContext,
  destination: AudioNode,
  descriptor: EraAmbienceDescriptor,
  sharedNoiseBuffer?: AudioBuffer,
): AmbienceBedInstance {
  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(0, ctx.currentTime);
  bedGain.connect(destination);

  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  const intermediateNodes: AudioNode[] = [bedGain];

  // 1. Synthesize tonal oscillators (drones / city hums)
  for (const tone of descriptor.tones) {
    const osc = ctx.createOscillator();
    const toneGain = ctx.createGain();

    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.frequency, ctx.currentTime);
    if (tone.detune !== undefined && osc.detune) {
      osc.detune.setValueAtTime(tone.detune, ctx.currentTime);
    }
    toneGain.gain.setValueAtTime(tone.gain, ctx.currentTime);

    osc.connect(toneGain);
    toneGain.connect(bedGain);
    osc.start(ctx.currentTime);

    sources.push(osc);
    intermediateNodes.push(toneGain);
  }

  // 2. Synthesize filtered noise layers (wind, traffic, atmospheric wash)
  const noiseBuf = sharedNoiseBuffer ?? createNoiseBuffer(ctx, 3, 100);
  for (const noise of descriptor.noise) {
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = noise.filterType;
    filter.frequency.setValueAtTime(noise.cutoff, ctx.currentTime);
    if (noise.resonance !== undefined && filter.Q) {
      filter.Q.setValueAtTime(noise.resonance, ctx.currentTime);
    }

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(noise.gain, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(bedGain);
    noiseSource.start(ctx.currentTime);

    sources.push(noiseSource);
    intermediateNodes.push(filter, noiseGain);
  }

  // 3. Synthesize optional sub-bass rumble
  if (descriptor.subBass) {
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(descriptor.subBass.frequency, ctx.currentTime);
    subGain.gain.setValueAtTime(descriptor.subBass.gain, ctx.currentTime);

    subOsc.connect(subGain);
    subGain.connect(bedGain);
    subOsc.start(ctx.currentTime);

    sources.push(subOsc);
    intermediateNodes.push(subGain);
  }

  return {
    eraId: descriptor.id,
    descriptor,
    gainNode: bedGain,
    setVolume(targetVolume: number, rampDuration = 0.05, startTime?: number) {
      const now = startTime ?? ctx.currentTime;
      const target = clamp(targetVolume, 0, 1);
      bedGain.gain.cancelScheduledValues(now);
      bedGain.gain.setValueAtTime(bedGain.gain.value, now);
      if (rampDuration > 0) {
        bedGain.gain.linearRampToValueAtTime(target, now + rampDuration);
      } else {
        bedGain.gain.setValueAtTime(target, now);
      }
    },
    stop(stopTime?: number) {
      const now = stopTime ?? ctx.currentTime;
      for (const src of sources) {
        try {
          src.stop(now);
        } catch {
          // Ignore if already stopped
        }
      }
    },
    disconnect() {
      for (const src of sources) {
        try {
          src.stop();
        } catch {}
        try {
          src.disconnect();
        } catch {}
      }
      for (const node of intermediateNodes) {
        try {
          node.disconnect();
        } catch {}
      }
      sources.length = 0;
      intermediateNodes.length = 0;
    },
  };
}
