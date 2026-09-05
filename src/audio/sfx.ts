/**
 * src/audio/sfx.ts — Procedural AudioBuffer generator.
 *
 * Per the audio-implementation-plan contract, this module synthesizes all
 * sounds with the Web Audio API (AudioContext.createBuffer) — no external
 * files, no network. `generateAllEraBuffers` produces a full per-era palette
 * from the declarative SfxEraData specs in src/eras.ts.
 */

import { SFX_ERA_DATA, type EraId, type SfxEraData } from '../eras';

/** Per-era bundle of pre-rendered AudioBuffers. */
export interface EraAudioBuffers {
  /** Seamless looping ambient bed (filtered noise + tonal drone). */
  ambient: AudioBuffer;
  /** Seamless looping traffic rumble layer, density-aware. */
  traffic: AudioBuffer;
  /** One-shot event sounds (horns, bells, sirens, whines). */
  events: AudioBuffer[];
}

const SAMPLE_RATE = 44100;

function createBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  return ctx.createBuffer(1, Math.max(1, Math.floor(seconds * SAMPLE_RATE)), SAMPLE_RATE);
}

function fillNoise(data: Float32Array, seed = 0): void {
  // Deterministic pseudo-noise so buffers are stable across generates.
  let state = seed | 0 || 1;
  for (let i = 0; i < data.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    data[i] = (state / 4294967296) * 2 - 1;
  }
}

function lowpassInPlace(data: Float32Array, cutoff: number, iterations = 3): void {
  // Crude one-pole lowpass applied a few times for a smooth bed.
  const alpha = Math.min(0.96, Math.max(0.02, cutoff / SAMPLE_RATE));
  let prev = 0;
  for (let pass = 0; pass < iterations; pass += 1) {
    prev = 0;
    for (let i = 0; i < data.length; i += 1) {
      prev += alpha * (data[i] - prev);
      data[i] = prev;
    }
  }
}

function normalize(data: Float32Array, target = 0.32): void {
  let max = 0.0001;
  for (let i = 0; i < data.length; i += 1) {
    const abs = Math.abs(data[i]);
    if (abs > max) {
      max = abs;
    }
  }
  const scale = target / max;
  for (let i = 0; i < data.length; i += 1) {
    data[i] *= scale;
  }
}

function trimTail(data: Float32Array, fadeSeconds = 0.08): void {
  const fade = Math.min(data.length - 1, Math.floor(fadeSeconds * SAMPLE_RATE));
  for (let i = 0; i < fade; i += 1) {
    const env = i / fade;
    data[i] *= env;
    data[data.length - 1 - i] *= env;
  }
}

/**
 * Ambient bed: low drone at the era root plus filtered noise, looped with
 * crossfaded edges so it can be played in a loop without clicks.
 */
export function generateAmbientBuffer(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 4;
  const buffer = createBuffer(ctx, seconds);
  const out = buffer.getChannelData(0);

  const rootHz = data.ambientRootHz;
  fillNoise(out, Math.round(rootHz * 31));
  lowpassInPlace(out, data.ambientCutoffHz, 2);
  // Add a tonal drone via a cheap synthesized sine-ish oscillation.
  for (let i = 0; i < out.length; i += 1) {
    const t = i / SAMPLE_RATE;
    const drone =
      Math.sin(2 * Math.PI * rootHz * t) * 0.35 +
      Math.sin(2 * Math.PI * rootHz * 0.5 * t) * 0.2 +
      Math.sin(2 * Math.PI * rootHz * 2 * t) * 0.08;
    out[i] = out[i] * 0.55 + drone * 0.45;
  }
  // Crossfade the loop seam (first/last 10%).
  const seam = Math.floor(seconds * SAMPLE_RATE * 0.1);
  for (let i = 0; i < seam; i += 1) {
    const env = i / seam;
    out[i] = out[i] * env + out[out.length - seam + i] * (1 - env);
  }
  normalize(out, 0.3);
  return buffer;
}

/** Traffic layer: rumble engines whose count scales with traffic density. */
export function generateTrafficBuffer(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 4;
  const buffer = createBuffer(ctx, seconds);
  const out = buffer.getChannelData(0);

  fillNoise(out, Math.round(data.trafficRootHz * 17));
  lowpassInPlace(out, Math.min(600, data.trafficRootHz * 8), 2);
  const engineCount = Math.round(data.trafficDensity * 6) + 1;
  for (let e = 0; e < engineCount; e += 1) {
    const freq = data.trafficRootHz * (0.8 + e * 0.12);
    for (let i = 0; i < out.length; i += 1) {
      const t = i / SAMPLE_RATE;
      const phase = 2 * Math.PI * freq * t + e * 1.7;
      const amplitude = 0.16 + Math.sin(2 * Math.PI * 0.7 * t) * 0.03;
      out[i] += Math.sin(phase) * amplitude + Math.sin(phase * 0.503) * amplitude * 0.5;
    }
  }
  const seam = Math.floor(seconds * SAMPLE_RATE * 0.1);
  for (let i = 0; i < seam; i += 1) {
    const env = i / seam;
    out[i] = out[i] * env + out[out.length - seam + i] * (1 - env);
  }
  normalize(out, 0.28 * (0.4 + data.trafficDensity));
  return buffer;
}

/** One-shot event sound for a named era event type. */
export function generateEventBuffer(ctx: AudioContext, event: string): AudioBuffer {
  const seconds = event === 'siren_far' ? 1.6 : event === 'siren_close' ? 1.2 : 0.5;
  const buffer = createBuffer(ctx, seconds);
  const out = buffer.getChannelData(0);

  switch (event) {
    case 'trolley_bell': {
      const base = 880;
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        out[i] = Math.sin(2 * Math.PI * base * t) * Math.exp(-t * 6);
        out[i] += Math.sin(2 * Math.PI * base * 1.5 * t) * 0.4 * Math.exp(-t * 8);
      }
      break;
    }
    case 'steam_hiss': {
      fillNoise(out, 991);
      lowpassInPlace(out, 2500, 1);
      for (let i = 0; i < out.length; i += 1) {
        out[i] *= Math.min(1, i / (SAMPLE_RATE * 0.02)) * Math.exp(-(i / SAMPLE_RATE) * 6);
      }
      break;
    }
    case 'car_horn_old': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const env = t < 0.2 ? t / 0.2 : t > 0.4 ? Math.max(0, 1 - (t - 0.4) / 0.1) : 1;
        out[i] =
          (Math.sin(2 * Math.PI * 300 * t) * 0.6 + Math.sin(2 * Math.PI * 452 * t) * 0.4) * env;
      }
      break;
    }
    case 'engine_v8':
    case 'engine': {
      fillNoise(out, 481);
      lowpassInPlace(out, 320, 2);
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        out[i] += Math.sin(2 * Math.PI * 85 * t) * 0.5 * (0.8 + Math.sin(2 * Math.PI * 28 * t));
      }
      break;
    }
    case 'jingle_vinyl': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const melody = Math.sin(2 * Math.PI * 523 * t) * 0.5 + Math.sin(2 * Math.PI * 659 * t) * 0.3;
        out[i] = melody * Math.exp(-t * 3) + (Math.random() - 0.5) * 0.04;
      }
      break;
    }
    case 'car_horn': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const env = t < 0.2 ? t / 0.2 : t > 0.45 ? Math.max(0, 1 - (t - 0.45) / 0.08) : 1;
        out[i] =
          (Math.sin(2 * Math.PI * 420 * t) * 0.6 + Math.sin(2 * Math.PI * 630 * t) * 0.4) * env;
      }
      break;
    }
    case 'siren_far':
    case 'siren_close': {
      const fmin = 500;
      const fmax = 900;
      const sweepSeconds = 0.7;
      let phase = 0;
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const cycle = (t % sweepSeconds) / sweepSeconds;
        const freq = fmin + (fmax - fmin) * (cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env =
          i < SAMPLE_RATE * 0.05 ? i / (SAMPLE_RATE * 0.05) : 1 - Math.max(0, t - (seconds - 0.1)) / 0.1;
        out[i] = Math.sin(phase) * 0.4 * env;
      }
      break;
    }
    case 'synth_bass': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        out[i] = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 220 * t) * 0.5) *
          Math.exp(-t * 4);
      }
      break;
    }
    case 'bus_airbrake': {
      fillNoise(out, 221);
      lowpassInPlace(out, 1400, 1);
      for (let i = 0; i < out.length; i += 1) {
        out[i] *= Math.max(0, 1 - (i / SAMPLE_RATE) * 8);
      }
      break;
    }
    case 'ev_whine': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const freq = 220 + 320 * (t / seconds);
        out[i] = Math.sin(2 * Math.PI * freq * t) * 0.35 * Math.min(1, i / (SAMPLE_RATE * 0.05));
      }
      break;
    }
    case 'pedestrian_ping': {
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        out[i] = Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-t * 10) * 0.4;
      }
      break;
    }
    case 'drone_hum': {
      fillNoise(out, 313);
      lowpassInPlace(out, 700, 1);
      for (let i = 0; i < out.length; i += 1) {
        const t = i / SAMPLE_RATE;
        out[i] = out[i] * 0.5 + Math.sin(2 * Math.PI * 120 * t) * 0.3 * Math.exp(-t * 2);
      }
      break;
    }
    default: {
      fillNoise(out, 777);
      lowpassInPlace(out, 1800, 1);
      break;
    }
  }
  trimTail(out);
  normalize(out, 0.5);
  return buffer;
}

/** Generate the full per-era buffer bundle from an era's SfxEraData. */
export function generateEraAudioBuffers(
  ctx: AudioContext,
  data: SfxEraData,
  events: string[] = data.events,
): EraAudioBuffers {
  return {
    ambient: generateAmbientBuffer(ctx, data),
    traffic: generateTrafficBuffer(ctx, data),
    events: events.map((event) => generateEventBuffer(ctx, event)),
  };
}

/** Generate a buffer bundle for every era, keyed by EraId. */
export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  return {
    '1945': generateEraAudioBuffers(ctx, SFX_ERA_DATA['1945']),
    '1965': generateEraAudioBuffers(ctx, SFX_ERA_DATA['1965']),
    '1985': generateEraAudioBuffers(ctx, SFX_ERA_DATA['1985']),
    '2005': generateEraAudioBuffers(ctx, SFX_ERA_DATA['2005']),
    '2025': generateEraAudioBuffers(ctx, SFX_ERA_DATA['2025']),
  };
}