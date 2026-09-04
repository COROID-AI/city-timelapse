// Procedural Web Audio buffer generator — no external sound files.
// Produces era-aware ambient beds, traffic loops and one-shot event samples
// entirely from AudioContext.createBuffer() synthesis.

import type { EraId, SfxEraData, SfxEventKind } from '../eras';
import { ERA_IDS, SFX_ERA_DATA } from '../eras';

export interface EraAudioBuffers {
  /** Steady filtered noise bed (city ambience, wind, crowd murmur). */
  ambient: AudioBuffer;
  /** Looping traffic texture (distant engines, rolling rumble). */
  traffic: AudioBuffer;
  /** One-shot samples that can be fired during a given era. */
  events: Partial<Record<SfxEventKind, AudioBuffer>>;
  /** Music bed sample (style varies by era). */
  music: AudioBuffer;
}

const SAMPLE_RATE = 44100;

function createBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  return ctx.createBuffer(1, Math.max(1, Math.floor(SAMPLE_RATE * seconds)), SAMPLE_RATE);
}

function fillNoise(buffer: AudioBuffer, color: number, seed = 1): void {
  const data = buffer.getChannelData(0);
  const n = data.length;
  let last = 0;
  let rand = seed;
  const rnd = (): number => {
    rand = (rand * 16807 + 7) % 2147483647;
    return rand / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const white = rnd() * 2 - 1;
    // One-pole filter: color 0 = brown (heavy low), 1 = white.
    last += (white - last) * (0.02 + color * 0.6);
    const v = last * (1 + color * 2);
    data[i] = v;
  }
}

function applyEnv(buffer: AudioBuffer, attack: number, release: number, gain = 1): void {
  const data = buffer.getChannelData(0);
  const n = data.length;
  const a = Math.max(1, Math.floor(attack * SAMPLE_RATE));
  const r = Math.max(1, Math.floor(release * SAMPLE_RATE));
  for (let i = 0; i < a && i < n; i++) data[i] *= (i / a) * gain;
  for (let i = Math.max(0, n - r); i < n; i++) data[i] *= ((n - i) / r) * gain;
}

function applyLowpass(data: Float32Array, cutoff: number): void {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last += alpha * (data[i] - last);
    data[i] = last;
  }
}

function applyHighpass(data: Float32Array, cutoff: number): void {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  let prev = 0;
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const input = data[i];
    const out = alpha * (last + input - prev);
    last = input;
    prev = input;
    data[i] = out;
  }
}

function addSine(
  buffer: AudioBuffer,
  freq: number,
  amp: number,
  startSeconds: number,
  duration: number,
  decay = 0.2,
): void {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const start = Math.max(0, startSeconds);
  const n = Math.floor(start * sr);
  const total = Math.floor(duration * sr);
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const env = Math.exp(-t * decay);
    const phase = 2 * Math.PI * freq * (start + t);
    const idx = n + i;
    if (idx < data.length) data[idx] += amp * Math.sin(phase) * env;
  }
}

/** Distant siren: alternating two-tone wail, lowpassed heavily. */
function buildSiren(ctx: AudioContext, seconds = 3.2): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  const data = buffer.getChannelData(0);
  const n = data.length;
  const period = 0.9;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const seg = Math.floor(t / period) % 2 === 0 ? 640 : 790;
    const wobble = 1 + 0.05 * Math.sin(2 * Math.PI * 2.5 * t);
    data[i] = 0.5 * Math.sin(2 * Math.PI * seg * wobble * t);
  }
  applyLowpass(data, 900);
  applyEnv(buffer, 0.05, 0.4, 0.55);
  return buffer;
}

/** Old-school automobile horn: short honk with slight pitch drop. */
function buildHorn(ctx: AudioContext, seconds = 0.7): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  addSine(buffer, 330, 0.5, 0.05, seconds - 0.1, 7);
  addSine(buffer, 415, 0.4, 0.08, seconds - 0.1, 6);
  addSine(buffer, 520, 0.2, 0.1, seconds - 0.1, 8);
  applyLowpass(buffer.getChannelData(0), 2400);
  applyEnv(buffer, 0.012, 0.1, 0.9);
  return buffer;
}

/** Streetcar / shop bell: short bright ring. */
function buildBell(ctx: AudioContext, seconds = 0.9): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  addSine(buffer, 880, 0.6, 0.05, seconds - 0.05, 3.5);
  addSine(buffer, 1320, 0.35, 0.05, seconds - 0.05, 5);
  addSine(buffer, 2200, 0.15, 0.05, seconds - 0.05, 7);
  applyEnv(buffer, 0.004, 0.15, 0.8);
  return buffer;
}

/** Light modern chime / crosswalk beep. */
function buildChime(ctx: AudioContext, seconds = 0.5): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  addSine(buffer, 1046, 0.45, 0.05, seconds - 0.05, 6);
  addSine(buffer, 1568, 0.3, 0.05, seconds - 0.05, 8);
  return buffer;
}

/** City ambience bed: filtered noise plus warm tonal drone. */
function buildAmbient(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  fillNoise(buffer, data.noiseColor);
  applyLowpass(buffer.getChannelData(0), 900);
  applyHighpass(buffer.getChannelData(0), 120);
  addSine(buffer, data.ambienceFreq, 0.18, 0, seconds, 0.22);
  addSine(buffer, data.ambienceFreq * data.droneRatio, 0.08, 0, seconds, 0.18);
  applyEnv(buffer, 1.2, 1.2, data.ambientGain);
  return buffer;
}

/** Looping traffic engine rumble. */
function buildTraffic(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  fillNoise(buffer, 0.25);
  const cutoff = Math.max(120, 500 - data.engineRumble * 250);
  applyLowpass(buffer.getChannelData(0), cutoff);
  applyHighpass(buffer.getChannelData(0), 60);
  const pulses = Math.max(2, Math.round(data.trafficDensity * 10));
  for (let p = 0; p < pulses; p++) {
    const t = p / pulses;
    const amp = 0.12 * (0.5 + Math.sin(t * 9) * 0.4);
    addSine(buffer, 55 + data.trafficSpeed * 25 * (0.5 + Math.sin(t * 7) * 0.4), amp, t * seconds, 0.9, 1.4);
  }
  const gain = (0.4 + data.trafficDensity * 0.6) * 0.7;
  applyEnv(buffer, 0.8, 1.0, gain);
  return buffer;
}

/** Era music bed — a short synthetic loop in the era's style. */
function buildMusic(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  const buffer = createBuffer(ctx, seconds);
  const bassFreq = 110;
  const style = data.musicStyle;
  addSine(buffer, bassFreq, 0.2, 0, seconds, 0.1);
  addSine(buffer, bassFreq * 1.25, 0.08, 0, seconds, 0.12);
  if (style === 'swing') {
    addSine(buffer, 660, 0.08, 0.5, 0.3, 5);
    addSine(buffer, 880, 0.06, 1.0, 0.4, 5);
  } else if (style === 'rock') {
    addSine(buffer, 440, 0.1, 0.2, 0.5, 4);
    addSine(buffer, 660, 0.06, 2.2, 2.6, 4);
  } else if (style === 'synth') {
    addSine(buffer, 330, 0.12, 0.1, 1.2, 2.5);
    addSine(buffer, 440, 0.1, 0.4, 1.4, 2.2);
    addSine(buffer, 550, 0.06, 1.6, 1.0, 2.0);
  } else if (style === 'hiphop') {
    addSine(buffer, 220, 0.16, 0.1, 2.0, 1.8);
    addSine(buffer, 330, 0.08, 1.6, 1.0, 2.0);
  } else {
    addSine(buffer, 523, 0.05, 0.4, 1.0, 1.4);
    addSine(buffer, 659, 0.04, 2.1, 0.8, 1.5);
  }
  applyEnv(buffer, 0.6, 0.6, data.musicGain * 0.8);
  return buffer;
}

export function generateEraAudioBuffers(ctx: AudioContext, data: SfxEraData): EraAudioBuffers {
  const events: Partial<Record<SfxEventKind, AudioBuffer>> = {};
  if (data.events.indexOf('horn') >= 0) events.horn = buildHorn(ctx);
  if (data.events.indexOf('bell') >= 0) events.bell = buildBell(ctx);
  if (data.events.indexOf('siren') >= 0) events.siren = buildSiren(ctx);
  if (data.events.indexOf('chime') >= 0) events.chime = buildChime(ctx);
  return {
    ambient: buildAmbient(ctx, data),
    traffic: buildTraffic(ctx, data),
    events,
    music: buildMusic(ctx, data),
  };
}

export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const out = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    out[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return out;
}