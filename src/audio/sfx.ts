/**
 * Procedural audio buffer generator.
 *
 * Synthesises era-appropriate ambient beds, traffic loops, and one-shot
 * event sounds entirely from oscillators and noise — no external audio files.
 * Every buffer is generated via `AudioContext.createBuffer()` and cached per
 * era so the mixer can crossfade between them instantly.
 */

import type { EraId, SfxEraData, SfxEventSpec } from '../eras.js';
import { SFX_ERA_DATA } from '../eras.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Audio buffers for one era: ambient bed, traffic loop, and event one-shots. */
export interface EraAudioBuffers {
  readonly ambient: AudioBuffer;
  readonly traffic: AudioBuffer;
  readonly events: readonly AudioBuffer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient bed — tonal drone + filtered noise
// ─────────────────────────────────────────────────────────────────────────────

function generateAmbient(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const duration = 4;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  const { droneFreq, droneHarmonic, noiseLevel } = data.ambient;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const shimmer = 0.6 + 0.4 * Math.sin(t * 0.5);
    const drone =
      Math.sin(2 * Math.PI * droneFreq * t) * 0.3 +
      Math.sin(2 * Math.PI * droneHarmonic * t) * 0.15;
    const noise = (Math.random() * 2 - 1) * noiseLevel * shimmer;
    out[i] = drone * shimmer + noise;
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic loop — modulated engine rumble
// ─────────────────────────────────────────────────────────────────────────────

function generateTraffic(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const duration = 3;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  const { engineBaseFreq, intensity, filterFreq, modulationRate } = data.traffic;

  let lastNoise = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * modulationRate * t);
    const engine =
      Math.sin(2 * Math.PI * engineBaseFreq * t) * 0.4 +
      Math.sin(2 * Math.PI * engineBaseFreq * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * engineBaseFreq * 3 * t) * 0.1;
    const rawNoise = Math.random() * 2 - 1;
    const cutoff = filterFreq / sampleRate;
    lastNoise = lastNoise + cutoff * (rawNoise - lastNoise);
    out[i] = engine * intensity * mod + lastNoise * intensity * 0.5;
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// One-shot event sounds
// ─────────────────────────────────────────────────────────────────────────────

function generateEvent(ctx: AudioContext, spec: SfxEventSpec): AudioBuffer {
  const duration = spec.duration;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  const { type, frequency, volume, sweepTo } = spec;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    const attack = 0.05;
    let env: number;
    if (progress < attack) {
      env = progress / attack;
    } else {
      env = Math.pow(1 - (progress - attack) / (1 - attack), 2);
    }

    let sample = 0;

    switch (type) {
      case 'horn':
        sample = Math.sign(Math.sin(2 * Math.PI * frequency * t)) * 0.6;
        sample += Math.sin(2 * Math.PI * frequency * 2 * t) * 0.2;
        break;
      case 'bell':
        sample = Math.sin(2 * Math.PI * frequency * t) * 0.7;
        sample += Math.sin(2 * Math.PI * frequency * 2.4 * t) * 0.3 * env;
        break;
      case 'siren': {
        const sweepFreq = sweepTo && sweepTo > 0
          ? frequency + (sweepTo - frequency) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t))
          : frequency;
        sample = Math.sin(2 * Math.PI * sweepFreq * t) * 0.7;
        break;
      }
      case 'whistle': {
        const vib = frequency + frequency * 0.02 * Math.sin(2 * Math.PI * 6 * t);
        sample = Math.sin(2 * Math.PI * vib * t) * 0.6;
        break;
      }
      case 'beep':
        sample = Math.sign(Math.sin(2 * Math.PI * frequency * t)) * 0.5;
        break;
      case 'chime': {
        const f = sweepTo && sweepTo > 0
          ? frequency + (sweepTo - frequency) * progress
          : frequency;
        sample = Math.sin(2 * Math.PI * f * t) * 0.6;
        sample += Math.sin(2 * Math.PI * f * 1.5 * t) * 0.2;
        break;
      }
      case 'engine-rev': {
        const f = frequency * (1 + progress * 2);
        sample = (2 * ((f * t) % 1) - 1) * 0.5;
        break;
      }
      case 'notification': {
        const f = progress < 0.5 ? frequency : frequency * 1.5;
        sample = Math.sin(2 * Math.PI * f * t) * 0.5;
        break;
      }
      default:
        break;
    }
    out[i] = sample * env * volume;
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function generateEraAudioBuffers(ctx: AudioContext, data: SfxEraData): EraAudioBuffers {
  return {
    ambient: generateAmbient(ctx, data),
    traffic: generateTraffic(ctx, data),
    events: data.events.map((ev) => generateEvent(ctx, ev)),
  };
}

const allBuffersCache = new Map<AudioContext, Record<EraId, EraAudioBuffers>>();

export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const cached = allBuffersCache.get(ctx);
  if (cached) return cached;

  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ['1945', '1965', '1985', '2005', '2025'] as const) {
    result[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  allBuffersCache.set(ctx, result);
  return result;
}

export function clearEraBufferCache(ctx: AudioContext): void {
  allBuffersCache.delete(ctx);
}
