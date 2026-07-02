/**
 * sfx.ts — Procedural Audio Buffer Generator
 *
 * Synthesizes all era-appropriate sound buffers entirely in code via
 * AudioContext.createBuffer(). No external audio files are loaded.
 *
 * Layers per era:
 *  - ambient:  filtered noise bed + tonal drones
 *  - traffic:  looping engine sound (filtered sawtooth + LFO modulation)
 *  - events:   one-shot buffers (horns, bells, sirens, chimes, beeps)
 *  - music:    a short melodic loop built from the era's scale
 */

import { EraId, SfxEraData, SFX_ERA_DATA, ERA_IDS } from '../eras';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A set of generated AudioBuffers for a single era. */
export interface EraAudioBuffers {
  /** Looping ambient bed (noise + drones). */
  ambient: AudioBuffer;
  /** Looping traffic engine sound. */
  traffic: AudioBuffer;
  /** One-shot event sounds. */
  events: AudioBuffer[];
  /** Looping musical phrase. */
  music: AudioBuffer;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 44100;
const AMBIENT_DURATION = 4.0;
const TRAFFIC_DURATION = 3.0;
const MUSIC_DURATION = 8.0;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Create a mono AudioBuffer of the given duration. */
function createBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.ceil(duration * SAMPLE_RATE);
  return ctx.createBuffer(1, length, SAMPLE_RATE);
}

/** Fill a buffer with white noise (-1..1). */
function fillNoise(buffer: AudioBuffer): Float32Array {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

/** Simple one-pole low-pass filter applied in-place to a Float32Array. */
function lowpass(data: Float32Array, cutoff: number): void {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let prev = data[0];
  for (let i = 1; i < data.length; i++) {
    prev = prev + alpha * (data[i] - prev);
    data[i] = prev;
  }
}

/** Apply an exponential fade-in and fade-out to avoid clicks. */
function applyFades(data: Float32Array, fadeSamples: number): void {
  const n = data.length;
  const fade = Math.min(fadeSamples, Math.floor(n / 2));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    data[i] *= gain;
    data[n - 1 - i] *= gain;
  }
}

/** Convert a frequency + semitone offset to Hz. */
function semitonesToFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

// ---------------------------------------------------------------------------
// Ambient bed synthesis
// ---------------------------------------------------------------------------

function generateAmbient(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = createBuffer(ctx, AMBIENT_DURATION);
  const out = buffer.getChannelData(0);

  // Layer 1: filtered noise bed.
  const noise = fillNoise(buffer);
  lowpass(noise, data.ambientNoiseCutoff);
  for (let i = 0; i < out.length; i++) {
    out[i] = noise[i] * 0.3;
  }

  // Layer 2: tonal drones (sine + slight detune).
  for (const tone of data.ambientTones) {
    const detune = tone * 1.003; // slight beating
    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      const env = 0.5 + 0.5 * Math.sin(t * 0.5);
      out[i] +=
        (Math.sin(2 * Math.PI * tone * t) +
          Math.sin(2 * Math.PI * detune * t)) *
        0.15 *
        env;
    }
  }

  // Normalize and apply gain.
  const gain = data.ambientGain;
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  const norm = max > 0 ? gain / max : gain;
  for (let i = 0; i < out.length; i++) out[i] *= norm;

  applyFades(out, 256);
  return buffer;
}

// ---------------------------------------------------------------------------
// Traffic engine synthesis
// ---------------------------------------------------------------------------

function generateTraffic(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = createBuffer(ctx, TRAFFIC_DURATION);
  const out = buffer.getChannelData(0);
  const { baseFrequency, modulationDepth, modulationRate, electric, gain } = data.traffic;

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    // LFO modulates the engine frequency for a rumbling feel.
    const lfo = Math.sin(2 * Math.PI * modulationRate * t);
    const freq = baseFrequency + modulationDepth * lfo;

    if (electric) {
      // Electric vehicles: clean hum + high whine.
      const hum = Math.sin(2 * Math.PI * freq * t);
      const whine = Math.sin(2 * Math.PI * freq * 6 * t) * 0.2;
      out[i] = (hum + whine) * 0.5;
    } else {
      // Combustion engine: sawtooth + noise rumble.
      const saw = 2 * (t * freq - Math.floor(t * freq + 0.5));
      const rumble = (Math.random() * 2 - 1) * 0.3;
      out[i] = saw * 0.4 + rumble * 0.6;
    }
  }

  // Low-pass to soften the engine character.
  lowpass(out, electric ? 2000 : 800);

  // Normalize.
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  const norm = max > 0 ? gain / max : gain;
  for (let i = 0; i < out.length; i++) out[i] *= norm;

  applyFades(out, 512);
  return buffer;
}

// ---------------------------------------------------------------------------
// Event one-shot synthesis
// ---------------------------------------------------------------------------

function generateEvent(ctx: AudioContext, eventData: SfxEraData['events'][number]): AudioBuffer {
  const duration = eventData.duration + 0.2; // tail
  const buffer = createBuffer(ctx, duration);
  const out = buffer.getChannelData(0);
  const { frequency, duration: dur, type } = eventData;
  const samples = Math.floor(dur * SAMPLE_RATE);

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    if (i > samples) {
      // Exponential decay tail.
      out[i] = out[samples] * Math.exp(-(i - samples) / (0.1 * SAMPLE_RATE));
      continue;
    }
    const env = Math.min(1, t * 40) * Math.exp(-t * 3);
    switch (type) {
      case 'horn': {
        // Square-wave horn with slight vibrato.
        const vib = Math.sin(2 * Math.PI * 6 * t) * 5;
        out[i] = Math.sign(Math.sin(2 * Math.PI * (frequency + vib) * t)) * 0.5 * env;
        break;
      }
      case 'bell': {
        // Bell: sine + harmonics with long decay.
        out[i] =
          (Math.sin(2 * Math.PI * frequency * t) +
            Math.sin(2 * Math.PI * frequency * 2 * t) * 0.5 +
            Math.sin(2 * Math.PI * frequency * 3 * t) * 0.25) *
          env * 0.3;
        break;
      }
      case 'siren': {
        // Wailing siren: frequency sweeps up and down.
        const sweep = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t);
        const f = frequency * (0.7 + 0.6 * sweep);
        out[i] = Math.sin(2 * Math.PI * f * t) * 0.4 * env;
        break;
      }
      case 'chime': {
        // Bright chime: triangle + high harmonics.
        const tri = 2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1;
        out[i] = (tri + Math.sin(2 * Math.PI * frequency * 4 * t) * 0.3) * 0.3 * env;
        break;
      }
      case 'beep': {
        // Short electronic beep.
        out[i] = Math.sign(Math.sin(2 * Math.PI * frequency * t)) * 0.3 * env;
        break;
      }
      case 'announcement': {
        // Low muffled announcement tone.
        out[i] = (Math.sin(2 * Math.PI * frequency * t) + (Math.random() * 2 - 1) * 0.1) * 0.25 * env;
        break;
      }
    }
  }

  applyFades(out, 64);
  return buffer;
}

// ---------------------------------------------------------------------------
// Music synthesis
// ---------------------------------------------------------------------------

function generateMusic(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const buffer = createBuffer(ctx, MUSIC_DURATION);
  const out = buffer.getChannelData(0);
  const { rootFrequency, scale, tempo, gain } = data.music;

  const beatDuration = 60 / tempo;
  const notesPerBeat = 2;
  const noteDuration = beatDuration / notesPerBeat;
  const totalNotes = Math.floor(MUSIC_DURATION / noteDuration);

  for (let n = 0; n < totalNotes; n++) {
    const startSample = Math.floor(n * noteDuration * SAMPLE_RATE);
    const endSample = Math.floor((n + 1) * noteDuration * SAMPLE_RATE);
    // Pick a scale degree (random walk for melodic feel).
    const degree = scale[Math.floor(Math.random() * scale.length)];
    const octave = Math.random() < 0.3 ? 12 : 0;
    const freq = semitonesToFreq(rootFrequency, degree + octave);

    for (let i = startSample; i < endSample && i < out.length; i++) {
      const localT = (i - startSample) / SAMPLE_RATE;
      const env = Math.min(1, localT * 30) * Math.exp(-localT * 4);
      // Simple synth: sine with a bit of sawtooth grit.
      const sine = Math.sin(2 * Math.PI * freq * localT);
      const saw = 2 * (localT * freq - Math.floor(localT * freq + 0.5));
      out[i] += (sine * 0.7 + saw * 0.3) * env * 0.15;
    }
  }

  // Normalize.
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  const norm = max > 0 ? gain / max : gain;
  for (let i = 0; i < out.length; i++) out[i] *= norm;

  applyFades(out, 1024);
  return buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all AudioBuffers for a single era from its SfxEraData.
 */
export function generateEraAudioBuffers(ctx: AudioContext, data: SfxEraData): EraAudioBuffers {
  return {
    ambient: generateAmbient(ctx, data),
    traffic: generateTraffic(ctx, data),
    events: data.events.map((ev) => generateEvent(ctx, ev)),
    music: generateMusic(ctx, data),
  };
}

/**
 * Generate AudioBuffers for all five eras. Returns a Record keyed by EraId.
 */
export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    result[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return result;
}
