/**
 * Procedural audio buffer generator for the City Time Period Timelapse.
 *
 * Every sound is synthesised at runtime from the declarative `SfxEraData`
 * parameters — no external audio assets are required.  All synthesis targets
 * `AudioContext.createBuffer()` so the output is a set of reusable
 * `AudioBuffer`s that the mixer (`mixer.ts`) loops and crossfades.
 *
 * Synthesis primitives
 * --------------------
 * - White / pink-ish noise beds with one-pole low-pass + band-pass filtering
 * - Tonal drones via additive sinusoids with slow amplitude modulation
 * - Traffic engine textures: filtered sawtooth + noise, amplitude-modulated
 *   to simulate pass-bys
 * - One-shot events: horns, bells, sirens, chimes, whistles, beeps, klaxons,
 *   engine bursts — each with a bespoke envelope and spectral character
 * - Music motifs: sequenced oscillator notes with a soft ADSR envelope
 */

import { ERA_IDS, SFX_ERA_DATA, type EraId, type SfxEraData, type SfxEvent } from '../eras.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The complete set of synthesised buffers for one era. */
export interface EraAudioBuffers {
  /** Continuous ambient bed (noise + tonal drones). */
  readonly ambient: AudioBuffer;
  /** Continuous traffic engine loop. */
  readonly traffic: AudioBuffer;
  /** Pre-rendered one-shot street-event buffers, one per `SfxEvent`. */
  readonly events: readonly AudioBuffer[];
  /** Pre-rendered melodic motif loop. */
  readonly music: AudioBuffer;
}

/** All eras' buffers keyed by `EraId`. */
export type AllEraAudioBuffers = Record<EraId, EraAudioBuffers>;

// ---------------------------------------------------------------------------
// DSP helpers (operate on Float32Array channels)
// ---------------------------------------------------------------------------

/** A simple, deterministic PRNG so buffers are reproducible across runs. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0xffffffff);
  };
}

/** Fill `out` with white noise samples in [-1, 1]. */
function fillWhiteNoise(out: Float32Array, rng: () => number): void {
  for (let i = 0; i < out.length; i++) {
    out[i] = rng() * 2 - 1;
  }
}

/**
 * One-pole low-pass filter (RC filter).
 * `cutoff` in Hz, `sampleRate` in Hz.
 */
function lowPass(input: Float32Array, output: Float32Array, cutoff: number, sampleRate: number): void {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);
  let prev = input[0];
  output[0] = prev;
  for (let i = 1; i < input.length; i++) {
    prev = prev + alpha * (input[i] - prev);
    output[i] = prev;
  }
}

/**
 * Simple band-pass filter (cascade of one-pole low-pass + high-pass).
 * `centre` in Hz.
 */
function bandPass(input: Float32Array, output: Float32Array, centre: number, sampleRate: number): void {
  const n = input.length;
  const tmp = new Float32Array(n);
  // Low-pass at 2*centre
  lowPass(input, tmp, centre * 2, sampleRate);
  // High-pass at centre/2 (remove low frequencies)
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * (centre / 2));
  const alpha = rc / (rc + dt);
  let prevIn = tmp[0];
  let prevOut = 0;
  output[0] = 0;
  for (let i = 1; i < n; i++) {
    prevOut = alpha * (prevOut + tmp[i] - prevIn);
    prevIn = tmp[i];
    output[i] = prevOut;
  }
}

/** Add a sinusoidal tone into `out` with optional amplitude modulation. */
function addTone(
  out: Float32Array,
  sampleRate: number,
  freq: number,
  gain: number,
  amFreq = 0,
  amDepth = 0,
  phase = 0,
): void {
  const twoPiF = 2 * Math.PI * freq;
  const twoPiAm = 2 * Math.PI * amFreq;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const am = 1 - amDepth + amDepth * Math.sin(twoPiAm * t);
    out[i] += gain * Math.sin(twoPiF * t + phase) * am;
  }
}

/** Apply a Hann window to a region (for smooth loop boundaries). */
function applyHannWindow(out: Float32Array, start: number, length: number): void {
  const end = Math.min(start + length, out.length);
  for (let i = start; i < end; i++) {
    const x = (i - start) / length;
    out[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * x));
  }
}

// ---------------------------------------------------------------------------
// Ambient bed synthesis
// ---------------------------------------------------------------------------

function generateAmbient(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const seconds = 8; // 8-second loop
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const ch = buffer.getChannelData(0);

  // 1. Filtered noise bed
  const rng = makeRng(0x9e3779b9);
  const noise = new Float32Array(length);
  fillWhiteNoise(noise, rng);
  const filteredNoise = new Float32Array(length);
  lowPass(noise, filteredNoise, data.ambientNoiseCutoff, sampleRate);
  for (let i = 0; i < length; i++) {
    ch[i] = filteredNoise[i] * 0.4 * data.ambientGain;
  }

  // 2. Tonal drones with slow amplitude modulation
  for (let k = 0; k < data.ambientTones.length; k++) {
    const freq = data.ambientTones[k];
    const amFreq = 0.05 + k * 0.03;
    addTone(ch, sampleRate, freq, 0.15 * data.ambientGain, amFreq, 0.5, k * 1.7);
  }

  // 3. Crossfade the last 1s with the first 1s for a seamless loop
  const fade = Math.floor(sampleRate * 1);
  const head = new Float32Array(fade);
  const tail = new Float32Array(fade);
  for (let i = 0; i < fade; i++) {
    head[i] = ch[i];
    tail[i] = ch[length - fade + i];
  }
  for (let i = 0; i < fade; i++) {
    const w = 0.5 * (1 - Math.cos(Math.PI * i / fade));
    ch[i] = head[i] * (1 - w) + tail[i] * w;
  }
  // Fade tail out so it matches the (now crossfaded) head
  applyHannWindow(ch, length - fade, fade);

  return buffer;
}

// ---------------------------------------------------------------------------
// Traffic loop synthesis
// ---------------------------------------------------------------------------

function generateTraffic(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const seconds = 10;
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const ch = buffer.getChannelData(0);

  const rng = makeRng(0x12345678);

  // Engine rumble: sawtooth-ish via summed partials + filtered noise
  const engine = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Sawtooth approximation (first 5 partials)
    let s = 0;
    for (let h = 1; h <= 5; h++) {
      s += Math.sin(2 * Math.PI * data.trafficEngineFreq * h * t) / h;
    }
    engine[i] = (s / Math.PI) * 0.5;
  }

  // Add filtered noise for tyre / road texture
  const roadNoise = new Float32Array(length);
  fillWhiteNoise(roadNoise, rng);
  const roadFiltered = new Float32Array(length);
  bandPass(roadNoise, roadFiltered, data.trafficBandpass, sampleRate);
  for (let i = 0; i < length; i++) {
    engine[i] += roadFiltered[i] * 0.3;
  }

  // Amplitude-modulate to simulate pass-bys (gaussian-like bumps)
  const passByCount = Math.max(1, Math.round(data.trafficDensity * seconds));
  for (let p = 0; p < passByCount; p++) {
    const center = ((p + 0.5) / passByCount) * length;
    const width = Math.floor(sampleRate * 1.5); // 1.5s pass-by
    const start = Math.max(0, Math.floor(center - width));
    const end = Math.min(length, Math.floor(center + width));
    for (let i = start; i < end; i++) {
      const x = (i - center) / width;
      const env = Math.exp(-x * x * 3); // gaussian
      // Doppler-ish pitch shift: slight frequency modulation as the vehicle passes
      const doppler = 1 + 0.03 * x;
      ch[i] += engine[i] * env * data.trafficGain * doppler;
    }
  }

  // Normalise to avoid clipping
  let max = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(ch[i]);
    if (a > max) max = a;
  }
  if (max > 1) {
    const inv = 1 / max;
    for (let i = 0; i < length; i++) ch[i] *= inv;
  }

  // Loop crossfade
  const fade = Math.floor(sampleRate * 0.8);
  applyHannWindow(ch, 0, fade);
  applyHannWindow(ch, length - fade, fade);

  return buffer;
}
// ---------------------------------------------------------------------------
// One-shot event synthesis
// ---------------------------------------------------------------------------

/**
 * Apply a simple ADSR / percussive envelope to a single-event buffer.
 * `attack`, `decay`, `sustain` level, `release` in seconds.
 */
function applyEnvelope(
  out: Float32Array,
  sampleRate: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
): void {
  const n = out.length;
  const a = Math.floor(attack * sampleRate);
  const d = Math.floor(decay * sampleRate);
  const r = Math.floor(release * sampleRate);
  const sustainStart = a + d;
  const releaseStart = Math.max(sustainStart, n - r);
  for (let i = 0; i < n; i++) {
    let env: number;
    if (i < a) {
      env = a > 0 ? i / a : 1;
    } else if (i < sustainStart) {
      env = sustain + (1 - sustain) * (1 - (i - a) / Math.max(1, d));
    } else if (i < releaseStart) {
      env = sustain;
    } else {
      const relLen = Math.max(1, n - releaseStart);
      env = sustain * (1 - (i - releaseStart) / relLen);
    }
    out[i] *= Math.max(0, env);
  }
}

/** Generate a single one-shot event buffer based on its `SfxEvent` type. */
function generateEvent(ctx: BaseAudioContext, event: SfxEvent): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(event.duration * sampleRate));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const ch = buffer.getChannelData(0);

  switch (event.type) {
    case 'horn': {
      // Bright, slightly buzzy sustained tone (square-ish via odd partials)
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let s = 0;
        for (let h = 1; h <= 5; h += 2) {
          s += Math.sin(2 * Math.PI * event.frequency * h * t) / h;
        }
        ch[i] = (s * (4 / Math.PI)) * 0.3;
      }
      applyEnvelope(ch, sampleRate, 0.01, 0.05, 0.85, event.duration * 0.3);
      break;
    }
    case 'bell': {
      // Inharmonic bell partials with long decay
      const partials = [
        { freq: event.frequency, gain: 1.0 },
        { freq: event.frequency * 2.0, gain: 0.5 },
        { freq: event.frequency * 2.4, gain: 0.33 },
        { freq: event.frequency * 3.0, gain: 0.2 },
        { freq: event.frequency * 4.5, gain: 0.12 },
      ];
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let s = 0;
        for (const p of partials) {
          const decay = Math.exp(-2 * t * (p.freq / event.frequency));
          s += p.gain * Math.sin(2 * Math.PI * p.freq * t) * decay;
        }
        ch[i] = s * 0.4;
      }
      break;
    }
    case 'siren': {
      // Frequency sweep between 0.7x and 1.3x of base, ~1.2s cycle
      const cycle = 1.2;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const sweep = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / cycle);
        const f = event.frequency * (0.7 + 0.6 * sweep);
        // Integrate phase for continuous waveform
        // (use accumulated phase to avoid discontinuities)
        ch[i] = Math.sin(2 * Math.PI * f * t) * 0.35;
      }
      applyEnvelope(ch, sampleRate, 0.05, 0.1, 0.9, event.duration * 0.2);
      break;
    }
    case 'chime': {
      // Short, high, pingy tone with fast decay
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const decay = Math.exp(-8 * t);
        ch[i] =
          (Math.sin(2 * Math.PI * event.frequency * t) +
            0.5 * Math.sin(2 * Math.PI * event.frequency * 2 * t)) *
          decay *
          0.25;
      }
      break;
    }
    case 'whistle': {
      // Narrow-band filtered noise with a tonal core — human/steam whistle
      const rng = makeRng(0xabcdef01);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = rng() * 2 - 1;
        const tone = Math.sin(2 * Math.PI * event.frequency * t);
        // Low-pass the noise crudely (running average of 3)
        ch[i] = (tone * 0.7 + noise * 0.3) * 0.3;
      }
      // Crude smoothing
      for (let i = 1; i < length - 1; i++) {
        ch[i] = (ch[i - 1] + ch[i] + ch[i + 1]) / 3;
      }
      applyEnvelope(ch, sampleRate, 0.03, 0.08, 0.8, event.duration * 0.4);
      break;
    }
    case 'engine_burst': {
      // Short low-frequency rumble burst
      const rng = makeRng(0x55aa55aa);
      const noise = new Float32Array(length);
      fillWhiteNoise(noise, rng);
      const filtered = new Float32Array(length);
      lowPass(noise, filtered, event.frequency * 3, sampleRate);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        ch[i] =
          (Math.sin(2 * Math.PI * event.frequency * t) * 0.5 + filtered[i] * 0.5) * 0.4;
      }
      applyEnvelope(ch, sampleRate, 0.02, 0.1, 0.6, event.duration * 0.5);
      break;
    }
    case 'beep': {
      // Short digital beep — pure sine, hard envelope
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        ch[i] = Math.sin(2 * Math.PI * event.frequency * t) * 0.3;
      }
      applyEnvelope(ch, sampleRate, 0.002, 0.01, 0.95, 0.02);
      break;
    }
    case 'klaxon': {
      // Two-tone alternating horn (ah-oo-ga style)
      const half = Math.floor(length / 2);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const f = i < half ? event.frequency : event.frequency * 1.5;
        ch[i] = Math.sin(2 * Math.PI * f * t) * 0.35;
      }
      applyEnvelope(ch, sampleRate, 0.02, 0.05, 0.85, event.duration * 0.3);
      break;
    }
  }

  // Scale by event gain
  for (let i = 0; i < length; i++) {
    ch[i] *= event.gain;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Music motif synthesis
// ---------------------------------------------------------------------------

function generateMusic(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const noteDur = 60 / data.musicTempo; // seconds per beat
  const notes = data.musicNotes;
  const loopBars = 4;
  const totalNotes = notes.length * loopBars;
  const seconds = noteDur * totalNotes;
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const ch = buffer.getChannelData(0);

  for (let ni = 0; ni < totalNotes; ni++) {
    const noteIdx = ni % notes.length;
    const freq = notes[noteIdx];
    const startSample = Math.floor(ni * noteDur * sampleRate);
    const noteSamples = Math.floor(noteDur * sampleRate);
    const endSample = Math.min(startSample + noteSamples, length);

    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / sampleRate;
      // ADSR within the note
      const localT = (i - startSample) / noteSamples;
      let env: number;
      if (localT < 0.1) {
        env = localT / 0.1;
      } else if (localT < 0.7) {
        env = 1.0;
      } else {
        env = (1 - localT) / 0.3;
      }
      env = Math.max(0, env);

      // Waveform synthesis per type
      let sample = 0;
      switch (data.musicWave) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * freq * t);
          break;
        case 'triangle':
          sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
          break;
        case 'sawtooth':
          sample = 2 * ((freq * t) % 1) - 1;
          break;
        case 'square':
          sample = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
          break;
        default:
          sample = Math.sin(2 * Math.PI * freq * t);
      }
      ch[i] += sample * env * data.musicGain * 0.4;
    }
  }

  // Loop crossfade
  const fade = Math.floor(sampleRate * 0.5);
  applyHannWindow(ch, 0, fade);
  applyHannWindow(ch, length - fade, fade);

  return buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the complete set of `AudioBuffer`s for a single era from its
 * declarative `SfxEraData`.
 *
 * All buffers are designed to loop seamlessly; the mixer handles playback.
 */
export function generateEraAudioBuffers(ctx: BaseAudioContext, data: SfxEraData): EraAudioBuffers {
  const ambient = generateAmbient(ctx, data);
  const traffic = generateTraffic(ctx, data);
  const events = data.events.map((ev) => generateEvent(ctx, ev));
  const music = generateMusic(ctx, data);
  return { ambient, traffic, events, music };
}

/**
 * Pre-generate every era's audio buffers at once.
 * Call this once after the `AudioContext` is created so that `setEra()`
 * crossfades are instant (no synthesis on the hot path).
 */
export function generateAllEraBuffers(ctx: BaseAudioContext): AllEraAudioBuffers {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    result[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return result;
}
