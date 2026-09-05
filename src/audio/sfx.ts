import type { EraId, SfxEraData } from '../eras'
import { ERA_IDS, SFX_ERA_DATA } from '../eras'

/**
 * Procedural AudioBuffer generator.
 *
 * Every sound is synthesized into `AudioBuffer`s with `createBuffer` — no
 * external audio files, so the build stays self-contained and works offline.
 * The generator is pure with respect to the AudioContext: it only allocates
 * buffers, so it is safe to call before the context is running (headless
 * environments, pre-gesture setup).
 */

export interface EraAudioBuffers {
  /** Filtered noise bed for the era's air/room tone (loops). */
  ambient: AudioBuffer
  /** Traffic engine rumble loop. */
  traffic: AudioBuffer
  /** One-shot event samples (horns, sirens, bells, chatter, ...). */
  events: AudioBuffer[]
}

export const EVENT_BUFFER_LENGTH_SECONDS = 3
export const AMBIENT_BUFFER_LENGTH_SECONDS = 8
export const TRAFFIC_BUFFER_LENGTH_SECONDS = 8
const SAMPLE_RATE = 44100

/** Deterministic PRNG so buffer generation is reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noiseColorFilter(
  random: () => number,
  color: 'brown' | 'pink' | 'white',
): () => number {
  if (color === 'brown') {
    // Integrated white noise: brown noise (strong low-frequency energy).
    let last = 0
    return () => {
      const white = random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      return last * 3.5
    }
  }
  if (color === 'pink') {
    // Paul Kellet's economical pink noise approximation.
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    return () => {
      const white = random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      b6 = white * 0.115926
      return out * 0.11
    }
  }
  return () => random() * 2 - 1
}

function fillNoiseBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  color: 'brown' | 'pink' | 'white',
  seed: number,
): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(SAMPLE_RATE * seconds), SAMPLE_RATE)
  const data = buffer.getChannelData(0)
  const sample = noiseColorFilter(mulberry32(seed), color)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = sample()
  }
  return buffer
}

/** Add a short fade-in/out so the loop never clicks at its seam. */
function applyLoopFade(data: Float32Array, sampleRate: number): void {
  const fadeSamples = Math.min(data.length, Math.floor(sampleRate * 0.08))
  for (let i = 0; i < fadeSamples; i += 1) {
    const t = i / fadeSamples
    data[i] *= t * t
    data[data.length - 1 - i] *= t * t
  }
}

/**
 * Synthesize the ambient noise bed for an era: a long filtered noise loop
 * with a soft 8s crossfade seam (no clicks). The mixer applies the era's
 * bandpass/lowpass filter and gain envelope.
 */
export function generateAmbientBuffer(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const buffer = fillNoiseBuffer(
    ctx,
    AMBIENT_BUFFER_LENGTH_SECONDS,
    data.ambient.noiseColor,
    hashSeed(`ambient:${data.era}`),
  )
  applyLoopFade(buffer.getChannelData(0), buffer.sampleRate)
  return buffer
}

/**
 * Synthesize the traffic rumble loop: brown noise shaped with a low-frequency
 * "engine" swell so density reads as engine brightness and weight.
 */
export function generateTrafficBuffer(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(SAMPLE_RATE * TRAFFIC_BUFFER_LENGTH_SECONDS), SAMPLE_RATE)
  const out = buffer.getChannelData(0)
  const random = mulberry32(hashSeed(`traffic:${data.era}`))
  const sample = noiseColorFilter(random, 'brown')
  const density = data.traffic.density
  // Engine pulse ~ how often a vehicle passes; higher density = busier layer.
  const pulseHz = 0.35 + density * 1.4
  const pulsePeriod = Math.max(1, Math.floor(SAMPLE_RATE / pulseHz))
  let phase = 0
  let engine = 0
  for (let i = 0; i < out.length; i += 1) {
    const brown = sample()
    phase = (phase + 1) % pulsePeriod
    const pulse = phase / pulsePeriod
    // Swell toward the middle of each pass, quiet at the seam.
    const envelope = Math.sin(Math.PI * pulse) ** 2
    engine = engine * 0.995 + (brown * 0.5 + envelope * 0.5) * (0.35 + density * 0.65)
    out[i] = engine * 0.6
  }
  applyLoopFade(out, buffer.sampleRate)
  return buffer
}

function fillOneShot(
  buffer: AudioBuffer,
  fn: (t: number, duration: number, random: () => number) => number,
  seed: number,
): void {
  const data = buffer.getChannelData(0)
  const random = mulberry32(seed)
  const duration = buffer.duration
  const fade = Math.floor(buffer.sampleRate * 0.02)
  for (let i = 0; i < data.length; i += 1) {
    const t = i / buffer.sampleRate
    data[i] = fn(t, duration, random)
  }
  // 20ms fade-in/out removes click edges on one-shots.
  for (let i = 0; i < fade && i < data.length; i += 1) {
    const f = i / fade
    data[i] *= f * f
    data[data.length - 1 - i] *= f * f
  }
}

function hornSample(t: number, _duration: number, _random: () => number): number {
  const attack = Math.min(1, t / 0.04)
  const body = Math.sin(2 * Math.PI * 220 * t) + 0.45 * Math.sin(2 * Math.PI * 330 * t)
  const wobble = 0.75 + 0.25 * Math.sin(2 * Math.PI * 6 * t)
  const release = Math.max(0, 1 - Math.max(0, t - 0.85) / 0.15)
  return body * attack * wobble * release * 0.5
}

function sirenSample(t: number, duration: number, _random: () => number): number {
  const sweep = 500 + 350 * Math.sin(2 * Math.PI * 0.9 * t)
  const phase = (2 * Math.PI * sweep * t) % (2 * Math.PI)
  const body = Math.sin(phase) + 0.5 * Math.sin(phase * 1.5)
  const attack = Math.min(1, t / 0.12)
  const release = Math.max(0, 1 - Math.max(0, t - (duration - 0.3)) / 0.3)
  return body * attack * release * 0.4
}

function bellSample(t: number, _duration: number, _random: () => number): number {
  const decay = Math.exp(-3.2 * t)
  const partials =
    Math.sin(2 * Math.PI * 660 * t) +
    0.6 * Math.sin(2 * Math.PI * 990 * t) +
    0.3 * Math.sin(2 * Math.PI * 1320 * t)
  return partials * decay * 0.5
}

function chatterSample(t: number, _duration: number, random: () => number): number {
  const syllable = 0.09 + 0.05 * random()
  const syllables = Math.floor(2 + random() * 3)
  let out = 0
  for (let s = 0; s < syllables; s += 1) {
    const start = s * syllable * (1.4 + random() * 0.6)
    const end = start + syllable
    if (t < start || t >= end) continue
    const local = (t - start) / (end - start)
    const envelope = Math.sin(Math.PI * local)
    const freq = 180 + random() * 220
    out += Math.sin(2 * Math.PI * freq * t) * envelope * 0.4
  }
  return out
}

function crowdSample(t: number, duration: number, random: () => number): number {
  // Sum of ~14 short syllables spread across the buffer, band-limited feel.
  let out = 0
  for (let v = 0; v < 14; v += 1) {
    const start = random() * duration * 0.7
    const len = 0.06 + random() * 0.1
    if (t < start || t >= start + len) continue
    const local = (t - start) / len
    const envelope = Math.sin(Math.PI * local)
    const freq = 140 + random() * 260
    out += Math.sin(2 * Math.PI * freq * t) * envelope * 0.18
  }
  return out
}

function horseSample(t: number, _duration: number, _random: () => number): number {
  const beat = 0.16
  const step = Math.floor(t / beat)
  const local = t - step * beat
  const click = Math.exp(-local * 60) * 0.9
  const body = Math.sin(2 * Math.PI * 90 * t) * Math.exp(-local * 25) * 0.3
  return (click + body) * 0.5
}

function scooterSample(t: number, _duration: number, _random: () => number): number {
  const attack = Math.min(1, t / 0.05)
  const release = Math.max(0, 1 - Math.max(0, t - 1.4) / 0.3)
  const body = Math.sin(2 * Math.PI * 380 * t) + 0.6 * Math.sin(2 * Math.PI * 760 * t)
  const buzz = 0.5 + 0.5 * Math.sin(2 * Math.PI * 55 * t)
  return body * buzz * attack * release * 0.35
}

function droneSample(t: number, duration: number, _random: () => number): number {
  const attack = Math.min(1, t / 0.3)
  const release = Math.max(0, 1 - Math.max(0, t - (duration - 0.5)) / 0.5)
  const chop = 0.6 + 0.4 * Math.sin(2 * Math.PI * 31 * t)
  const phase = (2 * Math.PI * 140 * t) % (2 * Math.PI)
  const body = Math.sin(phase) + 0.4 * Math.sin(2 * Math.PI * 280 * t)
  return body * chop * attack * release * 0.45
}

const EVENT_SYNTHESIZERS: Record<string, (t: number, duration: number, random: () => number) => number> = {
  horn: hornSample,
  siren: sirenSample,
  bell: bellSample,
  chatter: chatterSample,
  crowd: crowdSample,
  horse: horseSample,
  scooter: scooterSample,
  drone: droneSample,
}

/** Synthesize one one-shot event buffer (3s, faded edges). */
export function generateEventBuffer(
  ctx: BaseAudioContext,
  kind: string,
  seed: number,
): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    Math.floor(SAMPLE_RATE * EVENT_BUFFER_LENGTH_SECONDS),
    SAMPLE_RATE,
  )
  const synth = EVENT_SYNTHESIZERS[kind] ?? hornSample
  fillOneShot(buffer, synth, seed)
  return buffer
}

/** Generate the full buffer set for one era. */
export function generateEraAudioBuffers(
  ctx: BaseAudioContext,
  data: SfxEraData,
): EraAudioBuffers {
  const events = data.events.map((event, index) =>
    generateEventBuffer(ctx, event.kind, hashSeed(`event:${data.era}:${event.kind}:${index}`)),
  )
  return {
    ambient: generateAmbientBuffer(ctx, data),
    traffic: generateTrafficBuffer(ctx, data),
    events,
  }
}

/** Generate buffers for every era in the registry. */
export function generateAllEraBuffers(ctx: BaseAudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>
  for (const era of ERA_IDS) {
    result[era] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[era])
  }
  return result
}

/** Small deterministic string hash for reproducible seeds. */
function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}