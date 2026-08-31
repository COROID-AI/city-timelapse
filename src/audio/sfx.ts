/**
 * Procedural audio buffer generator.
 *
 * Everything is synthesized with the Web Audio API — no external files.
 * Each era gets a set of AudioBuffers: an ambient noise bed, a traffic-style
 * loop, and a palette of one-shot event sounds (bells, horns, chimes, drones).
 *
 * Buffers are designed to loop cleanly (integer-second lengths) for the
 * mixer's crossfading layers.
 */

import { SFX_ERA_DATA, type EraId, type EventTypeId, type SfxEraData } from '../eras';

export interface EraAudioBuffers {
  readonly ambient: AudioBuffer;
  readonly traffic: AudioBuffer;
  readonly events: Readonly<Record<EventTypeId, AudioBuffer | null>>;
}

const EVENT_TYPES: readonly EventTypeId[] = [
  'horn',
  'bell',
  'siren',
  'coin',
  'bounce',
  'chime',
  'message',
  'drone',
  'tick',
  'whoosh',
];

export function generateEraAudioBuffers(
  ctx: AudioContext,
  data: SfxEraData,
): EraAudioBuffers {
  const ambient = makeAmbientBed(ctx, data);
  const traffic = makeTrafficLoop(ctx, data);
  const events = {} as Record<EventTypeId, AudioBuffer | null>;
  for (const type of EVENT_TYPES) {
    events[type] = data.eventTypes.includes(type) ? makeEvent(ctx, type, data) : null;
  }
  return { ambient, traffic, events };
}

export function generateAllEraBuffers(
  ctx: AudioContext,
): Record<EraId, EraAudioBuffers> {
  const out = {} as Record<EraId, EraAudioBuffers>;
  for (const id of Object.keys(SFX_ERA_DATA) as EraId[]) {
    out[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return out;
}

/** One second of pink-ish noise (leaky-integrator filtered white). */
function makeNoise(ctx: AudioContext): Float32Array {
  const len = ctx.sampleRate;
  const data = new Float32Array(len);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = white * 0.55 + last * 3.2;
  }
  return data;
}

function makeAmbientBed(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 4;
  const len = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buffer.getChannelData(0);
  const noise = makeNoise(ctx);
  const fLow = data.ambient.lowFreq / ctx.sampleRate;
  const fHigh = data.ambient.highFreq / ctx.sampleRate;
  const gain = data.ambient.gain * 0.5;
  const rumble = data.ambient.rumbleGain;
  for (let i = 0; i < len; i++) {
    const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len);
    const slow = Math.sin(2 * Math.PI * 0.7 * (i / ctx.sampleRate));
    const drone =
      0.16 * Math.sin(2 * Math.PI * fLow * i) +
      0.05 * Math.sin(2 * Math.PI * fHigh * i) * (0.5 + 0.5 * slow);
    const n = noise[i % ctx.sampleRate] * 0.5;
    out[i] = (drone * rumble + n) * env * gain;
  }
  return buffer;
}

function makeTrafficLoop(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 2;
  const len = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buffer.getChannelData(0);
  const fEngine = data.traffic.engineHz / ctx.sampleRate;
  const fHum = data.traffic.humHz / ctx.sampleRate;
  const gain = data.traffic.gain * 0.4;
  const sample = 1 / ctx.sampleRate;
  for (let i = 0; i < len; i++) {
    const t = i * sample;
    // Engine chug: sign of a slow saw approximates a boxy piston rumble.
    const phase = t * fEngine * 2 * Math.PI;
    const piston = Math.sin(phase) > 0 ? 1 : -0.15;
    const wobble = 0.18 * Math.sin(2 * Math.PI * fHum * t + 0.7 * Math.sin(phase * 0.25));
    const hiss = Math.random() * 0.08;
    const fade = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len);
    out[i] = (piston * 0.28 + wobble + hiss) * gain * fade;
  }
  return buffer;
}

function makeEvent(ctx: AudioContext, type: EventTypeId, data: SfxEraData): AudioBuffer | null {
  const sr = ctx.sampleRate;
  switch (type) {
    case 'horn': {
      const seconds = 0.7;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      const f = (data.traffic.engineHz * 6) / sr;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 18) * Math.exp(-t * 4.5);
        out[i] = Math.sin(2 * Math.PI * f * i) * env * 0.6 + Math.sin(2 * Math.PI * f * 1.5 * i) * env * 0.3;
      }
      return buffer;
    }
    case 'bell': {
      const seconds = 1.2;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 3.2);
        const f0 = 660 / sr;
        out[i] =
          (Math.sin(2 * Math.PI * f0 * i) * 0.5 +
            Math.sin(2 * Math.PI * f0 * 2.41 * i) * 0.25 +
            Math.sin(2 * Math.PI * f0 * 3.9 * i) * 0.14) *
          env *
          0.5;
      }
      return buffer;
    }
    case 'siren': {
      const seconds = 1.6;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const sweep = 700 + 600 * Math.sin(2 * Math.PI * 2.2 * t);
        const phase = (sweep * t) % 1;
        const env = Math.min(1, t * 20) * Math.exp(-t * 1.6);
        out[i] = Math.sin(2 * Math.PI * phase * 16) * env * 0.4;
      }
      return buffer;
    }
    case 'coin':
      return makeToneSlap(ctx, [1318, 1760], 0.25, 0.4);
    case 'bounce':
      return makeToneSlap(ctx, [800, 620, 470], 0.5, 0.35);
    case 'chime':
      return makeToneSlap(ctx, [1046, 1318, 1568], 0.7, 0.3);
    case 'message': {
      // Digital notification blip.
      const seconds = 0.3;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.max(0, 1 - t * 6);
        const blip = Math.sin(2 * Math.PI * (1560 / sr) * i) * 0.4 + Math.sin(2 * Math.PI * (2093 / sr) * i) * 0.3;
        out[i] = blip * env * 0.5;
      }
      return buffer;
    }
    case 'drone': {
      const seconds = 1.4;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.sin(Math.PI * Math.min(1, t / 1.4));
        out[i] =
          (Math.sin(2 * Math.PI * (110 / sr) * i) * 0.3 +
            Math.sin(2 * Math.PI * (110.7 / sr) * i) * 0.3) *
          env *
          0.5;
      }
      return buffer;
    }
    case 'tick': {
      const seconds = 0.05;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        out[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - t * 80) * 0.35;
      }
      return buffer;
    }
    case 'whoosh': {
      const seconds = 0.6;
      const len = Math.floor(sr * seconds);
      const buffer = ctx.createBuffer(1, len, sr);
      const out = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.sin(Math.PI * Math.min(1, t / 0.6)) ** 2;
        out[i] = (Math.random() * 2 - 1) * env * 0.4;
      }
      return buffer;
    }
    default:
      return null;
  }
}

function makeToneSlap(
  ctx: AudioContext,
  freqs: number[],
  seconds: number,
  gain: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buffer = ctx.createBuffer(1, len, sr);
  const out = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 5.5) * Math.min(1, t * 200);
    let v = 0;
    for (let k = 0; k < freqs.length; k++) {
      v += Math.sin(2 * Math.PI * (freqs[k] / sr) * i * (1 + k * 0.01)) * (0.5 / (k + 1));
    }
    out[i] = v * env * gain;
  }
  return buffer;
}