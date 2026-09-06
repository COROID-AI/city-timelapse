import type { EraId } from '../types';

/**
 * Procedural era ambience beds.
 *
 * Each era has a distinct, fully-synthesized soundscape defined as a list of
 * procedural layers (noise/tone/event). No binary audio assets are used — every
 * sound is generated at runtime from `AudioContext` primitives. A bed owns a
 * master gain node that the engine ramps to crossfade between eras.
 */

export type NoiseColor = 'white' | 'pink';

/** A continuous filtered-noise bed (wind, rain, rumble, murmur). */
export interface NoiseLayerConfig {
  kind: 'noise';
  color: NoiseColor;
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ?: number;
  /** Layer level 0..1. */
  gain: number;
}

/** A continuous oscillator tone (drone, EV hum, neon buzz). */
export interface ToneLayerConfig {
  kind: 'tone';
  type: OscillatorType;
  frequency: number;
  gain: number;
  detune?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
}

/** A periodic synthesized burst (bells, horns, birds, ringtones). */
export interface EventLayerConfig {
  kind: 'event';
  type: OscillatorType;
  frequency: number;
  gain: number;
  /** Seconds between bursts. */
  intervalSec: number;
  /** Decay length of each burst in seconds. */
  durationSec: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
}

export type AmbienceLayer = NoiseLayerConfig | ToneLayerConfig | EventLayerConfig;

/** The full procedural bed profile for a single era. */
export interface EraBedProfile {
  layers: AmbienceLayer[];
}

/** Era bed profiles, keyed by era. Fully procedural — no asset references. */
export const ERA_BED_PROFILES: Record<EraId, EraBedProfile> = {
  '1945': {
    layers: [
      { kind: 'noise', color: 'pink', filterType: 'lowpass', filterFrequency: 300, gain: 0.5 },
      { kind: 'tone', type: 'sine', frequency: 55, gain: 0.1 },
      { kind: 'event', type: 'triangle', frequency: 660, gain: 0.25, intervalSec: 6, durationSec: 1.2 },
      { kind: 'event', type: 'triangle', frequency: 880, gain: 0.18, intervalSec: 9, durationSec: 1.0 },
    ],
  },
  '1965': {
    layers: [
      { kind: 'noise', color: 'pink', filterType: 'lowpass', filterFrequency: 500, gain: 0.55 },
      { kind: 'tone', type: 'square', frequency: 82, gain: 0.08 },
      { kind: 'noise', color: 'white', filterType: 'bandpass', filterFrequency: 3000, filterQ: 1, gain: 0.08 },
      { kind: 'event', type: 'square', frequency: 196, gain: 0.3, intervalSec: 14, durationSec: 0.5 },
    ],
  },
  '1985': {
    layers: [
      { kind: 'noise', color: 'white', filterType: 'bandpass', filterFrequency: 120, filterQ: 0.7, gain: 0.4 },
      { kind: 'tone', type: 'sine', frequency: 60, gain: 0.12 },
      { kind: 'noise', color: 'pink', filterType: 'lowpass', filterFrequency: 1000, gain: 0.3 },
      { kind: 'event', type: 'sawtooth', frequency: 440, gain: 0.2, intervalSec: 10, durationSec: 0.4 },
    ],
  },
  '2005': {
    layers: [
      { kind: 'noise', color: 'pink', filterType: 'lowpass', filterFrequency: 600, gain: 0.5 },
      { kind: 'tone', type: 'sine', frequency: 120, gain: 0.1 },
      { kind: 'noise', color: 'white', filterType: 'bandpass', filterFrequency: 5000, filterQ: 1, gain: 0.06 },
      { kind: 'event', type: 'sine', frequency: 880, gain: 0.22, intervalSec: 8, durationSec: 0.6 },
    ],
  },
  '2025': {
    layers: [
      { kind: 'tone', type: 'sine', frequency: 180, gain: 0.15 },
      { kind: 'tone', type: 'sine', frequency: 360, gain: 0.06 },
      { kind: 'noise', color: 'white', filterType: 'bandpass', filterFrequency: 2500, filterQ: 0.8, gain: 0.25 },
      { kind: 'event', type: 'sine', frequency: 2000, gain: 0.12, intervalSec: 4, durationSec: 0.15 },
      { kind: 'event', type: 'sine', frequency: 2600, gain: 0.1, intervalSec: 6, durationSec: 0.12 },
    ],
  },
};

/**
 * A constructed ambience bed: the master gain the engine ramps for crossfades,
 * plus an `update` hook the engine drives so event layers fire on schedule.
 */
export interface EraBed {
  /** Master gain for the bed; the engine ramps this to crossfade. */
  gain: GainNode;
  /** Advance the bed scheduler with the current context time. */
  update(now: number): void;
  /** Stop all sources, clear transient bursts, and disconnect the bed. */
  dispose(): void;
}

/**
 * Generate a loopable noise buffer (white or pink) entirely procedurally.
 */
export function makeNoiseBuffer(ctx: BaseAudioContext, color: NoiseColor, seconds = 2): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (color === 'white') {
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Pink noise via the Paul Kellet approximation.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

/** Build a fully procedural ambience bed for an era. Starts silent (gain 0). */
export function buildBed(ctx: BaseAudioContext, era: EraId): EraBed {
  const profile = ERA_BED_PROFILES[era];
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0;

  const activeSources = new Set<AudioScheduledSourceNode>();
  const eventLayers: Array<{ config: EventLayerConfig; nextAt: number }> = [];

  for (const layer of profile.layers) {
    if (layer.kind === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, layer.color);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filterType;
      filter.frequency.value = layer.filterFrequency;
      if (layer.filterQ !== undefined) filter.Q.value = layer.filterQ;
      const g = ctx.createGain();
      g.gain.value = layer.gain;
      src.connect(filter);
      filter.connect(g);
      g.connect(bedGain);
      src.start();
      activeSources.add(src);
    } else if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.value = layer.frequency;
      if (layer.detune !== undefined) osc.detune.value = layer.detune;
      let tail: AudioNode = osc;
      if (layer.filterType !== undefined && layer.filterFrequency !== undefined) {
        const filter = ctx.createBiquadFilter();
        filter.type = layer.filterType;
        filter.frequency.value = layer.filterFrequency;
        osc.connect(filter);
        tail = filter;
      }
      const g = ctx.createGain();
      g.gain.value = layer.gain;
      tail.connect(g);
      g.connect(bedGain);
      osc.start();
      activeSources.add(osc);
    } else {
      eventLayers.push({ config: layer, nextAt: ctx.currentTime + layer.intervalSec });
    }
  }

  const triggerEvent = (config: EventLayerConfig): void => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = config.type;
    osc.frequency.value = config.frequency;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(config.gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + config.durationSec);
    let tail: AudioNode = osc;
    if (config.filterType !== undefined && config.filterFrequency !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filterType;
      filter.frequency.value = config.filterFrequency;
      osc.connect(filter);
      tail = filter;
    }
    tail.connect(env);
    env.connect(bedGain);
    osc.start(now);
    osc.stop(now + config.durationSec + 0.05);
    activeSources.add(osc);
    osc.onended = () => {
      activeSources.delete(osc);
    };
  };

  const update = (now: number): void => {
    for (const ev of eventLayers) {
      while (now >= ev.nextAt) {
        triggerEvent(ev.config);
        ev.nextAt += ev.config.intervalSec;
      }
    }
  };

  const dispose = (): void => {
    for (const src of activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Already stopped/disconnected.
      }
    }
    activeSources.clear();
    try {
      bedGain.disconnect();
    } catch {
      // Already disconnected.
    }
  };

  return { gain: bedGain, update, dispose };
}