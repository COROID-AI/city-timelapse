/**
 * Procedural audio buffer generator for era-appropriate soundscapes.
 *
 * All sounds are synthesised at runtime using `AudioContext.createBuffer()` —
 * no external audio files are loaded. Each generator reads parameters from an
 * era's {@link SfxEraData} and produces `AudioBuffer` instances for the
 * ambient bed, traffic loop, and one-shot events.
 *
 * The buffers are cached per-era so that switching back to a previously
 * visited era does not re-synthesise the audio.
 */

import type { EraId, EraSpec, SfxEraData } from '../eras/types.js';
import { getEra, getAllEras } from '../eras/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A complete set of audio buffers for one era.
 *
 * - `ambient`: a looping low-frequency drone bed (2–4 seconds).
 * - `traffic`: a looping engine/traffic sound (2–3 seconds).
 * - `events`: an array of short one-shot event buffers (horns, bells, etc.).
 * - `music`: a short looping musical motif (2–4 seconds).
 */
export interface EraAudioBuffers {
  /** Looping ambient drone bed. */
  ambient: AudioBuffer;
  /** Looping traffic / engine sound. */
  traffic: AudioBuffer;
  /** One-shot event sounds. */
  events: AudioBuffer[];
  /** Looping music bed. */
  music: AudioBuffer;
}

// ---------------------------------------------------------------------------
// Buffer cache
// ---------------------------------------------------------------------------

/** Per-era audio buffer cache. Keyed by `EraId`. */
const bufferCache = new Map<EraId, EraAudioBuffers>();

// ---------------------------------------------------------------------------
// Synthesis helpers
// ---------------------------------------------------------------------------

/**
 * Create an `AudioBuffer` with the given duration and channel count.
 * @param ctx    The AudioContext (determines sample rate).
 * @param seconds  Duration in seconds.
 * @param channels  Number of channels (1 = mono, 2 = stereo).
 */
function createBuffer(ctx: BaseAudioContext, seconds: number, channels = 2): AudioBuffer {
  const length = Math.ceil(seconds * ctx.sampleRate);
  return ctx.createBuffer(channels, length, ctx.sampleRate);
}

/**
 * Fill a mono channel with white noise.
 * @param buffer  The target AudioBuffer.
 * @param channel  Channel index to fill.
 * @param amplitude  Peak amplitude (0–1).
 */
function fillNoise(buffer: AudioBuffer, channel: number, amplitude = 1): void {
  const data = buffer.getChannelData(channel);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * amplitude;
  }
}



/**
 * Apply a simple one-pole low-pass filter to a channel in-place.
 * @param buffer  The AudioBuffer.
 * @param channel  Channel index.
 * @param cutoff  Cutoff frequency in Hz.
 */
function lowPassInPlace(buffer: AudioBuffer, channel: number, cutoff: number): void {
  const data = buffer.getChannelData(channel);
  const sr = buffer.sampleRate;
  const dt = 1 / sr;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);
  let prev = data[0] ?? 0;
  for (let i = 1; i < data.length; i++) {
    prev = prev + alpha * ((data[i] ?? 0) - prev);
    data[i] = prev;
  }
}

/**
 * Apply an exponential decay envelope to a channel in-place.
 * @param buffer   The AudioBuffer.
 * @param channel  Channel index.
 * @param decay    Time constant (seconds) — amplitude falls to ~37% after this.
 * @param startAmp  Starting amplitude multiplier.
 */
function applyDecay(buffer: AudioBuffer, channel: number, decay: number, startAmp = 1): void {
  const data = buffer.getChannelData(channel);
  const sr = buffer.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = startAmp * Math.exp(-t / decay);
    data[i] *= env;
  }
}

/**
 * Mix two channels into a stereo buffer: left = data0, right = data1.
 */
function mixStereo(buffer: AudioBuffer, left: Float32Array, right: Float32Array): void {
  const lData = buffer.getChannelData(0);
  const rData = buffer.getChannelData(1);
  const len = Math.min(lData.length, left.length, right.length);
  for (let i = 0; i < len; i++) {
    lData[i] = left[i] ?? 0;
    rData[i] = right[i] ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Ambient bed synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesise a looping ambient drone bed.
 *
 * The bed is a stack of low-frequency sine tones (from `ambientTones`) mixed
 * with filtered noise to create an atmospheric hum. The result is stereo with
 * slight detuning between channels for a spacious feel.
 *
 * @param ctx   The AudioContext.
 * @param data  The era's SFX data.
 * @returns A 4-second looping `AudioBuffer`.
 */
function generateAmbient(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const duration = 4;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;

  // Temporary mono buffers
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Add sine tones with slight stereo detuning
  for (const tone of data.ambientTones) {
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // Slow amplitude modulation for organic feel
      const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.1 * t);
      left[i] += Math.sin(2 * Math.PI * tone * t) * 0.15 * am;
      right[i] += Math.sin(2 * Math.PI * (tone * 1.003) * t) * 0.15 * am;
    }
  }

  // Add filtered noise for texture
  const noiseBuffer = createBuffer(ctx, duration, 1);
  fillNoise(noiseBuffer, 0, 0.3);
  lowPassInPlace(noiseBuffer, 0, 400);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    left[i] += noiseData[i] ?? 0;
    right[i] += noiseData[i] ?? 0;
  }

  // Normalize and apply gain
  const gain = data.ambientGain;
  for (let i = 0; i < len; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }

  mixStereo(buffer, left, right);

  // Apply a crossfade at the loop boundary for seamless looping
  applyLoopCrossfade(buffer, sr);

  return buffer;
}

// ---------------------------------------------------------------------------
// Traffic synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesise a looping traffic/engine sound.
 *
 * The sound character depends on `trafficProfile`:
 * - `horse-clop`: rhythmic clopping on a hard surface.
 * - `straight-six`: smooth engine hum with slight idle variation.
 * - `small-block`: rougher V8-ish rumble.
 * - `electric-hum`: quiet high-frequency whine.
 * - `mixed-quiet`: low-level mixed road noise.
 *
 * @param ctx   The AudioContext.
 * @param data  The era's SFX data.
 * @returns A 3-second looping `AudioBuffer`.
 */
function generateTraffic(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const duration = 3;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;

  const left = new Float32Array(len);
  const right = new Float32Array(len);

  switch (data.trafficProfile) {
    case 'horse-clop': {
      // Periodic clop sounds
      const clopInterval = 0.45; // seconds between clops
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const phase = (t % clopInterval) / clopInterval;
        if (phase < 0.15) {
          // Clop: short filtered noise burst
          const env = Math.exp(-phase * 30);
          left[i] = (Math.random() * 2 - 1) * env * 0.4;
          right[i] = (Math.random() * 2 - 1) * env * 0.4;
        }
      }
      break;
    }
    case 'straight-six': {
      // Smooth engine hum: fundamental + harmonics
      const fundamental = 45;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const am = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.3 * t);
        left[i] =
          (Math.sin(2 * Math.PI * fundamental * t) * 0.3 +
            Math.sin(2 * Math.PI * fundamental * 2 * t) * 0.15 +
            Math.sin(2 * Math.PI * fundamental * 3 * t) * 0.08) *
          am;
        right[i] = left[i]! * 0.95; // slight stereo offset
      }
      break;
    }
    case 'small-block': {
      // Rougher rumble: lower fundamental + noise
      const fundamental = 38;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const am = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t);
        left[i] =
          (Math.sin(2 * Math.PI * fundamental * t) * 0.25 +
            Math.sin(2 * Math.PI * fundamental * 1.5 * t) * 0.12 +
            (Math.random() * 2 - 1) * 0.08) * am;
        right[i] = left[i]! * 0.9;
      }
      break;
    }
    case 'electric-hum': {
      // High-frequency electric whine
      const fundamental = 120;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.2 * t);
        left[i] = Math.sin(2 * Math.PI * fundamental * t) * 0.08 * am;
        right[i] = Math.sin(2 * Math.PI * fundamental * 1.01 * t) * 0.08 * am;
      }
      break;
    }
    case 'mixed-quiet': {
      // Low-level mixed road noise
      const noiseBuffer = createBuffer(ctx, duration, 1);
      fillNoise(noiseBuffer, 0, 0.15);
      lowPassInPlace(noiseBuffer, 0, 800);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const am = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.15 * t);
        left[i] = (noiseData[i] ?? 0) * am;
        right[i] = (noiseData[i] ?? 0) * am * 0.95;
      }
      break;
    }
  }

  // Apply gain
  const gain = data.trafficGain;
  for (let i = 0; i < len; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }

  mixStereo(buffer, left, right);
  applyLoopCrossfade(buffer, sr);

  return buffer;
}
// ---------------------------------------------------------------------------
// Event one-shot synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesise a short one-shot event sound based on the event type.
 *
 * Each event type has a distinct character:
 * - `trolley-bell`: two quick bell strikes.
 * - `horn`: a car horn — two-tone square wave.
 * - `siren`: a rising/falling wail.
 * - `church-bell`: a deep bell with harmonics and long decay.
 * - `jackhammer`: rapid percussive bursts.
 * - `bus-kneel`: air-brake release hiss.
 * - `notification`: a short digital chime (two ascending notes).
 * - `drone-buzz`: a buzzing drone flyby.
 *
 * @param ctx        The AudioContext.
 * @param eventType  The event label.
 * @param gain       Output gain (0–1).
 * @returns A short `AudioBuffer` (0.5–2 seconds).
 */
function generateEvent(
  ctx: BaseAudioContext,
  eventType: string,
  gain: number,
): AudioBuffer {
  switch (eventType) {
    case 'trolley-bell': {
      return generateBell(ctx, 880, 0.4, gain, 2);
    }
    case 'horn': {
      return generateHorn(ctx, gain);
    }
    case 'siren': {
      return generateSiren(ctx, gain);
    }
    case 'church-bell': {
      return generateBell(ctx, 220, 2.0, gain, 1);
    }
    case 'jackhammer': {
      return generateJackhammer(ctx, gain);
    }
    case 'bus-kneel': {
      return generateAirBrake(ctx, gain);
    }
    case 'notification': {
      return generateChime(ctx, gain);
    }
    case 'drone-buzz': {
      return generateDroneBuzz(ctx, gain);
    }
    default: {
      // Fallback: short noise burst
      const buf = createBuffer(ctx, 0.3, 1);
      fillNoise(buf, 0, gain * 0.5);
      applyDecay(buf, 0, 0.1, 1);
      return buf;
    }
  }
}

/** Generate a bell strike with harmonics and decay. */
function generateBell(
  ctx: BaseAudioContext,
  fundamental: number,
  duration: number,
  gain: number,
  strikes: number,
): AudioBuffer {
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  const harmonics = [1, 2, 2.4, 3.2, 4.5];
  const amps = [1, 0.5, 0.3, 0.2, 0.1];

  for (let s = 0; s < strikes; s++) {
    const strikeTime = s * 0.15;
    const strikeOffset = Math.floor(strikeTime * sr);
    for (let i = strikeOffset; i < len; i++) {
      const t = (i - strikeOffset) / sr;
      const env = Math.exp(-t / (duration * 0.3));
      let sample = 0;
      for (let h = 0; h < harmonics.length; h++) {
        const freq = fundamental * harmonics[h]!;
        const amp = amps[h] ?? 0;
        sample += Math.sin(2 * Math.PI * freq * t) * amp;
      }
      left[i] += sample * env * gain * 0.2;
      right[i] += sample * env * gain * 0.2;
    }
  }

  mixStereo(buffer, left, right);
  return buffer;
}

/** Generate a car horn — two-tone square wave. */
function generateHorn(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 0.5;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  const f1 = 400;
  const f2 = 500;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Attack envelope
    const attack = Math.min(1, t / 0.02);
    const release = Math.min(1, (duration - t) / 0.05);
    const env = Math.min(attack, release);
    const sample =
      (Math.sign(Math.sin(2 * Math.PI * f1 * t)) * 0.3 +
        Math.sign(Math.sin(2 * Math.PI * f2 * t)) * 0.3) *
      env *
      gain;
    left[i] = sample;
    right[i] = sample * 0.95;
  }

  mixStereo(buffer, left, right);
  return buffer;
}

/** Generate a siren wail — rising and falling frequency. */
function generateSiren(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 1.5;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Frequency sweeps from 600 to 1200 Hz and back
    const sweep = 600 + 300 * (1 + Math.sin(2 * Math.PI * 0.7 * t));
    const phase = 2 * Math.PI * sweep * t;
    left[i] = Math.sin(phase) * gain * 0.3;
    right[i] = Math.sin(phase + 0.5) * gain * 0.3;
  }

  mixStereo(buffer, left, right);
  return buffer;
}

/** Generate a jackhammer — rapid percussive bursts. */
function generateJackhammer(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 0.8;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  const burstInterval = 0.08; // seconds
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const phase = (t % burstInterval) / burstInterval;
    if (phase < 0.1) {
      const env = Math.exp(-phase * 50);
      const sample = (Math.random() * 2 - 1) * env * gain * 0.5;
      left[i] = sample;
      right[i] = sample;
    }
  }

  mixStereo(buffer, left, right);
  return buffer;
}

/** Generate an air-brake release hiss. */
function generateAirBrake(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 0.6;
  const buffer = createBuffer(ctx, duration, 2);
  fillNoise(buffer, 0, gain * 0.2);
  fillNoise(buffer, 1, gain * 0.2);
  lowPassInPlace(buffer, 0, 2000);
  lowPassInPlace(buffer, 1, 2000);
  applyDecay(buffer, 0, 0.3, 1);
  applyDecay(buffer, 1, 0.3, 1);
  return buffer;
}

/** Generate a digital notification chime — two ascending notes. */
function generateChime(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 0.4;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  const notes = [880, 1320]; // A5, E6
  const noteDur = 0.15;
  for (let n = 0; n < notes.length; n++) {
    const startTime = n * noteDur;
    const startOffset = Math.floor(startTime * sr);
    const freq = notes[n]!;
    for (let i = startOffset; i < len; i++) {
      const t = (i - startOffset) / sr;
      const env = Math.exp(-t / 0.1);
      const sample = Math.sin(2 * Math.PI * freq * t) * env * gain * 0.3;
      left[i] += sample;
      right[i] += sample;
    }
  }

  mixStereo(buffer, left, right);
  return buffer;
}

/** Generate a drone buzz flyby. */
function generateDroneBuzz(ctx: BaseAudioContext, gain: number): AudioBuffer {
  const duration = 1.2;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Amplitude swells as the drone approaches and recedes
    const am = Math.sin(Math.PI * (t / duration));
    const buzz = Math.sign(Math.sin(2 * Math.PI * 180 * t)) * 0.15;
    const whine = Math.sin(2 * Math.PI * 360 * t) * 0.05;
    // Stereo pan sweeps left to right
    const pan = t / duration;
    left[i] = (buzz + whine) * am * gain * Math.cos(pan * Math.PI / 2);
    right[i] = (buzz + whine) * am * gain * Math.sin(pan * Math.PI / 2);
  }

  mixStereo(buffer, left, right);
  return buffer;
}

// ---------------------------------------------------------------------------
// Music bed synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesise a short looping musical motif based on the era's music style.
 *
 * Each style is a simple chord progression or melodic pattern rendered with
 * sine/triangle oscillators — just enough to establish a period mood.
 *
 * - `big-band`: brassy stabs on a ii–V–I.
 * - `motown`: soulful minor groove.
 * - `synthpop`: bright sawtooth arpeggio.
 * - `crunk`: deep 808-style bass hits.
 * - `hyperpop`: glitchy high-frequency bleeps.
 *
 * @param ctx   The AudioContext.
 * @param data  The era's SFX data.
 * @returns A 2–4 second looping `AudioBuffer`.
 */
function generateMusic(ctx: BaseAudioContext, data: SfxEraData): AudioBuffer {
  const duration = 3;
  const buffer = createBuffer(ctx, duration, 2);
  const sr = ctx.sampleRate;
  const len = buffer.length;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const gain = data.musicGain;

  switch (data.musicStyle) {
    case 'big-band': {
      // ii–V–I in C: Dm7, G7, Cmaj7 — brassy stabs
      const chords = [
        [146.83, 174.61, 220.0, 261.63], // Dm7
        [196.0, 246.94, 293.66, 349.23], // G7
        [130.81, 164.81, 196.0, 246.94], // Cmaj7
      ];
      const chordDur = duration / chords.length;
      for (let c = 0; c < chords.length; c++) {
        const chord = chords[c]!;
        const start = Math.floor(c * chordDur * sr);
        for (let i = start; i < len; i++) {
          const t = (i - start) / sr;
          const env = Math.exp(-t / 0.3) * (t < 0.05 ? t / 0.05 : 1);
          let s = 0;
          for (const freq of chord) {
            s += Math.sin(2 * Math.PI * freq * (i / sr)) * 0.1;
          }
          left[i] += s * env * gain;
          right[i] += s * env * gain;
        }
      }
      break;
    }
    case 'motown': {
      // Soulful minor groove — Am, Dm pattern with a bassline
      const bassNotes = [110, 110, 146.83, 110, 73.42, 73.42, 98.0, 73.42];
      const noteDur = duration / bassNotes.length;
      for (let n = 0; n < bassNotes.length; n++) {
        const freq = bassNotes[n]!;
        const start = Math.floor(n * noteDur * sr);
        for (let i = start; i < len; i++) {
          const t = (i - start) / sr;
          const env = Math.min(1, t / 0.02) * Math.min(1, (noteDur - t) / 0.05);
          left[i] += Math.sin(2 * Math.PI * freq * (i / sr)) * env * gain * 0.4;
          right[i] += Math.sin(2 * Math.PI * freq * 1.005 * (i / sr)) * env * gain * 0.4;
        }
      }
      break;
    }
    case 'synthpop': {
      // Bright arpeggio in A minor
      const arp = [220, 261.63, 329.63, 440, 329.63, 261.63];
      const noteDur = duration / arp.length / 2;
      for (let rep = 0; rep < 2; rep++) {
        for (let n = 0; n < arp.length; n++) {
          const freq = arp[n]!;
          const start = Math.floor((rep * arp.length + n) * noteDur * sr);
          for (let i = start; i < len; i++) {
            const t = (i - start) / sr;
            const env = Math.exp(-t / 0.15);
            // Sawtooth approximation
            const phase = (freq * (i / sr)) % 1;
            const saw = 2 * phase - 1;
            left[i] += saw * env * gain * 0.15;
            right[i] += saw * env * gain * 0.15;
          }
        }
      }
      break;
    }
    case 'crunk': {
      // Deep bass hits on a simple pattern
      const pattern = [55, 0, 55, 73.42, 0, 55, 0, 49];
      const noteDur = duration / pattern.length;
      for (let n = 0; n < pattern.length; n++) {
        const freq = pattern[n]!;
        if (freq === 0) continue;
        const start = Math.floor(n * noteDur * sr);
        for (let i = start; i < len; i++) {
          const t = (i - start) / sr;
          const env = Math.exp(-t / 0.2);
          const s = Math.sin(2 * Math.PI * freq * (i / sr)) * env * gain * 0.5;
          left[i] += s;
          right[i] += s;
        }
      }
      break;
    }
    case 'hyperpop': {
      // Glitchy high-frequency bleeps
      const bleeps = [880, 1320, 1760, 2200, 1760, 1320, 2640, 880];
      const noteDur = duration / bleeps.length;
      for (let n = 0; n < bleeps.length; n++) {
        const freq = bleeps[n]!;
        const start = Math.floor(n * noteDur * sr);
        for (let i = start; i < len; i++) {
          const t = (i - start) / sr;
          const env = Math.exp(-t / 0.08);
          const s = Math.sin(2 * Math.PI * freq * (i / sr)) * env * gain * 0.2;
          left[i] += s;
          right[i] += s * (n % 2 === 0 ? 1 : -1); // alternate pan
        }
      }
      break;
    }
  }

  mixStereo(buffer, left, right);
  applyLoopCrossfade(buffer, sr);
  return buffer;
}

// ---------------------------------------------------------------------------
// Loop crossfade helper
// ---------------------------------------------------------------------------

/**
 * Apply a short crossfade at the loop boundary of a buffer to ensure
 * seamless looping. The first and last `crossfadeLen` samples are blended.
 */
function applyLoopCrossfade(buffer: AudioBuffer, sampleRate: number): void {
  const crossfadeMs = 50;
  const crossfadeLen = Math.floor((crossfadeMs / 1000) * sampleRate);
  const totalLen = buffer.length;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < crossfadeLen; i++) {
      const fadeOut = data[totalLen - crossfadeLen + i] ?? 0;
      const fadeIn = data[i] ?? 0;
      const t = i / crossfadeLen;
      data[i] = fadeIn * t + fadeOut * (1 - t);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the complete set of audio buffers for one era.
 *
 * @param ctx  The AudioContext to create buffers for.
 * @param data The era's SFX data.
 * @returns An {@link EraAudioBuffers} set.
 */
export function generateEraAudioBuffers(ctx: BaseAudioContext, data: SfxEraData): EraAudioBuffers {
  const ambient = generateAmbient(ctx, data);
  const traffic = generateTraffic(ctx, data);
  const music = generateMusic(ctx, data);

  const events: AudioBuffer[] = [];
  for (const eventType of data.eventTypes) {
    events.push(generateEvent(ctx, eventType, data.eventGain));
  }

  return { ambient, traffic, events, music };
}

/**
 * Generate (or fetch from cache) audio buffers for a specific era.
 *
 * @param ctx    The AudioContext.
 * @param eraId  The era to generate buffers for.
 * @returns A cached {@link EraAudioBuffers} set.
 */
export function getEraAudioBuffers(ctx: BaseAudioContext, eraId: EraId): EraAudioBuffers {
  const cached = bufferCache.get(eraId);
  if (cached) return cached;

  const era = getEra(eraId);
  const buffers = generateEraAudioBuffers(ctx, era.sfx);
  bufferCache.set(eraId, buffers);
  return buffers;
}

/**
 * Generate audio buffers for all eras at once.
 *
 * @param ctx  The AudioContext.
 * @returns A `Record<EraId, EraAudioBuffers>`.
 */
export function generateAllEraBuffers(ctx: BaseAudioContext): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const era of getAllEras()) {
    result[era.id] = getEraAudioBuffers(ctx, era.id);
  }
  return result;
}

/**
 * Clear the audio buffer cache for a specific era.
 * @param eraId  The era to evict.
 */
export function clearEraAudioBuffers(eraId: EraId): void {
  bufferCache.delete(eraId);
}

/** Clear all cached audio buffers. */
export function clearAllAudioBuffers(): void {
  bufferCache.clear();
}

/**
 * Get the number of event buffers for an era (for scheduling reference).
 * @param eraId  The era id.
 */
export function getEventCount(eraId: EraId): number {
  const era = getEra(eraId);
  return era.sfx.eventTypes.length;
}

/**
 * Get the mean event interval for an era (for scheduler timing).
 * @param era  The era spec.
 */
export function getEventInterval(era: EraSpec): number {
  return era.sfx.eventInterval;
}
