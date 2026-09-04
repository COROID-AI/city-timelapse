/**
 * Procedural Web Audio buffer generation — no external files.
 *
 * Each era gets looping ambient (filtered noise + tonal drone), a looping
 * traffic bed (engine rumble), and a bank of one-shot event buffers
 * (horns, bells, sirens, ...). All synthesis happens through
 * AudioContext.createBuffer().
 */

import { SFX_ERA_DATA } from '../eras';
import type { EraId, SfxEraData, SfxEventType } from '../eras';

export interface EraAudioBuffers {
  ambient: AudioBuffer;
  traffic: AudioBuffer;
  events: Partial<Record<SfxEventType, AudioBuffer>>;
}

const SR = 44100;

function makeBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  return ctx.createBuffer(2, Math.ceil(seconds * SR), SR);
}

function write(
  buf: AudioBuffer,
  fn: (t: number, ch: 0 | 1) => number,
): AudioBuffer {
  for (let ch = 0 as 0 | 1; ch <= 1; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = fn(i / SR, ch);
    }
  }
  return buf;
}

function noiseSample(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

/** Simple one-pole low-pass filter applied inline to a sample stream. */
function lowPass(input: number[], cutoff: number): number[] {
  if (cutoff <= 0 || cutoff >= SR / 2) return input;
  const alpha = Math.exp((-2 * Math.PI * cutoff) / SR);
  const out: number[] = new Array(input.length);
  let prev = 0;
  for (let i = 0; i < input.length; i++) {
    prev += (1 - alpha) * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

function highPass(input: number[], cutoff: number): number[] {
  const alpha = Math.exp((-2 * Math.PI * cutoff) / SR);
  const out: number[] = new Array(input.length);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < input.length; i++) {
    prevOut = alpha * (prevOut + input[i] - prevIn);
    prevIn = input[i];
    out[i] = prevOut;
  }
  return out;
}

function envelope(
  input: number[],
  attack: number,
  release: number,
  sustain = 1,
): number[] {
  const a = Math.max(1, Math.floor(attack * SR));
  const r = Math.max(1, Math.floor(release * SR));
  const out = input.slice();
  for (let i = 0; i < a && i < out.length; i++) {
    out[i] *= (i / a) * sustain;
  }
  for (let i = 0; i < r && i < out.length; i++) {
    const j = out.length - 1 - i;
    if (j < 0) break;
    out[j] *= (i / r) * sustain;
  }
  return out;
}

function addInto(target: number[], src: number[], offset = 0): void {
  for (let i = 0; i < src.length; i++) {
    const j = i + offset;
    if (j >= target.length) break;
    target[j] += src[i];
  }
}

function normalize(input: number[], peak = 0.9): number[] {
  let max = 0;
  for (const v of input) max = Math.max(max, Math.abs(v));
  if (max === 0) return input;
  const k = peak / max;
  return input.map((v) => v * k);
}

/* ------------------------------------------------------------------ */
/* Ambient bed: filtered noise + tonal drone                           */
/* ------------------------------------------------------------------ */

function generateAmbient(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 6;
  const buf = makeBuffer(ctx, seconds);
  const rnd = noiseSample(0x19451945);
  const raw: number[] = new Array(Math.ceil(seconds * SR));
  for (let i = 0; i < raw.length; i++) raw[i] = rnd();
  const filtered = lowPass(raw, data.ambient.noiseCutoff);
  const drone = new Array(raw.length).fill(0);
  const base = data.ambient.droneBase;
  const detune = data.ambient.droneDetune;
  const f = (t: number, mult: number) => Math.sin(2 * Math.PI * base * mult * t);
  for (let i = 0; i < drone.length; i++) {
    const t = i / SR;
    const slow = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * t);
    drone[i] =
      0.45 * f(t, 1) +
      0.28 * f(t, Math.pow(2, detune / 1200)) +
      0.22 * f(t, 2) * slow;
  }
  const mixed = filtered.map((v, i) => v * 0.5 + drone[i] * 0.5);
  return write(buf, (t) => {
    const idx = Math.floor(t * SR);
    return mixed[idx] ?? 0;
  });
}

/* ------------------------------------------------------------------ */
/* Traffic bed: engine rumble with passing-vehicle swells              */
/* ------------------------------------------------------------------ */

function generateTraffic(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const seconds = 8;
  const buf = makeBuffer(ctx, seconds);
  const rnd = noiseSample(0x19651965);
  const raw: number[] = new Array(Math.ceil(seconds * SR));
  for (let i = 0; i < raw.length; i++) raw[i] = rnd();
  const rumble = lowPass(raw, 140);
  const out = new Array(raw.length).fill(0);
  const base = data.traffic.rumbleFreq;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const thump = Math.sin(2 * Math.PI * base * t) * 0.6 + Math.sin(2 * Math.PI * base * 0.5 * t) * 0.4;
    out[i] = rumble[i] * 0.4 + thump * 0.6;
  }
  // periodic "passing vehicle" swells (band-passed noise whoosh)
  const passCount = Math.max(1, Math.round(data.traffic.density * seconds));
  for (let p = 0; p < passCount; p++) {
    const start = Math.floor((p + 0.5) * (seconds / passCount) * SR);
    const len = Math.floor(1.2 * SR);
    const whoosh = new Array(len).fill(0);
    for (let i = 0; i < len; i++) whoosh[i] = rnd() * 0.5;
    const band = highPass(lowPass(whoosh, 900), 180);
    const env = envelope(band, 0.35, 0.4, 0.8);
    addInto(out, env, start);
  }
  return write(buf, (t) => {
    const idx = Math.floor(t * SR);
    return out[idx] ?? 0;
  });
}

/* ------------------------------------------------------------------ */
/* One-shot events                                                     */
/* ------------------------------------------------------------------ */

function generateHorn(ctx: AudioContext, vintage: boolean): AudioBuffer {
  const seconds = 1.4;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  const f0 = vintage ? 330 : 392;
  const f1 = f0 * 1.5;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 3.2);
    out[i] = (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f1 * t)) * env * 0.6;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateBell(ctx: AudioContext): AudioBuffer {
  const seconds = 2.2;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  const partials = [
    { f: 660, a: 0.7, d: 2.2 },
    { f: 990, a: 0.4, d: 1.4 },
    { f: 1320, a: 0.25, d: 0.9 },
    { f: 1760, a: 0.15, d: 0.6 },
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of partials) {
      v += p.a * Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t * p.d);
    }
    out[i] = v * 0.4;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateSiren(ctx: AudioContext): AudioBuffer {
  const seconds = 3.2;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const sweep = 700 + 500 * Math.sin(2 * Math.PI * 0.9 * t);
    const env = Math.sin(Math.PI * Math.min(1, t / seconds));
    out[i] = Math.sin(2 * Math.PI * sweep * t) * env * 0.35;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateChirp(ctx: AudioContext): AudioBuffer {
  const seconds = 0.5;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 1400 + 1200 * (t / seconds);
    const env = Math.sin(Math.PI * Math.min(1, t / seconds));
    out[i] = Math.sin(2 * Math.PI * f * t) * env * 0.3;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateEngine(ctx: AudioContext, modern: boolean): AudioBuffer {
  const seconds = 2.4;
  const buf = makeBuffer(ctx, seconds);
  const rnd = noiseSample(0x20052005);
  const raw: number[] = new Array(Math.ceil(seconds * SR));
  for (let i = 0; i < raw.length; i++) raw[i] = rnd();
  const lp = lowPass(raw, modern ? 260 : 420);
  const out = new Array(raw.length).fill(0);
  const f0 = modern ? 55 : 90;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 1.6);
    out[i] = (lp[i] * 0.5 + Math.sin(2 * Math.PI * f0 * t) * 0.5) * env * 0.5;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateTrain(ctx: AudioContext): AudioBuffer {
  const seconds = 4;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const clack = Math.sin(2 * Math.PI * 4 * t) > 0.92 ? 1 : 0;
    const env = Math.sin(Math.PI * Math.min(1, t / seconds));
    out[i] = (Math.sin(2 * Math.PI * 110 * t) * 0.25 + clack * 0.5) * env * 0.4;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateShutter(ctx: AudioContext): AudioBuffer {
  const seconds = 0.35;
  const buf = makeBuffer(ctx, seconds);
  const rnd = noiseSample(0x19851985);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * Math.min(1, t / seconds));
    out[i] = rnd() * env * 0.4;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

function generateDrone(ctx: AudioContext): AudioBuffer {
  const seconds = 1.8;
  const buf = makeBuffer(ctx, seconds);
  const out = new Array(Math.ceil(seconds * SR)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * Math.min(1, t / seconds));
    const f = 220 + 90 * Math.sin(2 * Math.PI * 3.2 * t);
    out[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.5 * t)) * env * 0.3;
  }
  return write(buf, (t) => out[Math.floor(t * SR)] ?? 0);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function generateEraAudioBuffers(
  ctx: AudioContext,
  data: SfxEraData,
): EraAudioBuffers {
  const events: EraAudioBuffers['events'] = {};
  for (const type of data.events.types) {
    switch (type) {
      case 'horn':
        events.horn = generateHorn(ctx, data.ambient.droneBase < 60);
        break;
      case 'bell':
        events.bell = generateBell(ctx);
        break;
      case 'siren':
        events.siren = generateSiren(ctx);
        break;
      case 'chirp':
        events.chirp = generateChirp(ctx);
        break;
      case 'engine':
        events.engine = generateEngine(ctx, data.ambient.droneBase > 80);
        break;
      case 'train':
        events.train = generateTrain(ctx);
        break;
      case 'shutter':
        events.shutter = generateShutter(ctx);
        break;
      case 'drone':
        events.drone = generateDrone(ctx);
        break;
    }
  }
  return {
    ambient: generateAmbient(ctx, data),
    traffic: generateTraffic(ctx, data),
    events,
  };
}

export function generateAllEraBuffers(
  ctx: AudioContext,
): Record<EraId, EraAudioBuffers> {
  const out = {} as Record<EraId, EraAudioBuffers>;
  (Object.keys(SFX_ERA_DATA) as EraId[]).forEach((id) => {
    out[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  });
  return out;
}

export { normalize };