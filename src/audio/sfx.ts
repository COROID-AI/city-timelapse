/**
 * Procedural audio buffer generator.
 *
 * Synthesizes every era's ambient bed, traffic loop, one-shot events and
 * music loop entirely in code as Float32Array sample buffers — no external
 * files, no network. The mixer (src/audio/mixer.ts) plays these through the
 * native Web Audio API (AudioBufferSourceNode / GainNode) with crossfades.
 */
import { EraId, ERA_IDS, SFX_ERA_DATA, SfxEraData, SfxEventType } from '../eras';

/** Sample rate used for all generated buffers (compact but clean). */
export const SAMPLE_RATE = 22050;
const TWO_PI = Math.PI * 2;

/** A sample buffer of raw PCM frames. */
export type SampleBuffer = Float32Array;

export interface EraAudioBuffers {
  /** Continuous filtered noise bed + tonal drone, looped by the mixer. */
  ambient: SampleBuffer;
  /** Engine rumble / road traffic loop. */
  traffic: SampleBuffer;
  /** Music loop for the era, or null when the era has no music. */
  music: SampleBuffer | null;
  /** One-shot event samples (horn, bell, siren, tick...). */
  events: SampleBuffer[];
}

export type Waveform = 'sine' | 'tri' | 'square' | 'saw' | 'pluck';

/* ------------------------------------------------------------------ */
/* Low-level synthesis helpers                                         */
/* ------------------------------------------------------------------ */

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** One-pole lowpass filter applied in place. */
function lowpassInPlace(data: Float32Array, fc: number, fs: number): void {
  const a = 1 - Math.exp((-TWO_PI * fc) / fs);
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    y += a * (data[i] - y);
    data[i] = y;
  }
}

/** One-pole highpass filter applied in place (removes DC / rumble). */
function highpassInPlace(data: Float32Array, fc: number, fs: number): void {
  const rc = 1 / (TWO_PI * fc);
  const a = rc / (rc + 1 / fs);
  let prev = 0;
  let prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const out = a * (prevOut + x - prev);
    prev = x;
    prevOut = out;
    data[i] = out;
  }
}

/** White noise Float32Array in [-1,1]. */
function whiteNoise(frames: number, seed = 1): Float32Array {
  const out = new Float32Array(frames);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < frames; i++) {
    s = (s * 9301 + 49297) % 233280;
    out[i] = (s / 233280) * 2 - 1;
  }
  return out;
}

/** Add an oscillating tone into a buffer with envelope shaping. */
function addTone(
  out: Float32Array,
  fs: number,
  startSec: number,
  durSec: number,
  freq: number,
  amp: number,
  waveform: Waveform,
  opts: {
    attack?: number;
    release?: number;
    decay?: number;
    detune?: number;
    vibratoHz?: number;
    vibratoDepth?: number;
  } = {},
): void {
  const start = Math.max(0, Math.floor(startSec * fs));
  const frames = Math.min(out.length - start, Math.max(0, Math.floor(durSec * fs)));
  if (frames <= 0 || amp <= 0) {
    return;
  }
  const attack = Math.max(0, (opts.attack ?? 0.005) * fs);
  const release = Math.max(0, (opts.release ?? 0.05) * fs);
  const decay = opts.decay ?? 1;
  const detune = opts.detune ?? 0;
  const vibHz = opts.vibratoHz ?? 0;
  const vibDepth = opts.vibratoDepth ?? 0;
  const harmonicCap = Math.max(1, Math.floor(fs / (2 * freq)));

  for (let i = 0; i < frames; i++) {
    const t = i / fs;
    const vib = vibDepth > 0 ? 1 + vibDepth * Math.sin(TWO_PI * vibHz * t) : 1;
    const f = freq * vib * (1 + detune * Math.sin(TWO_PI * 0.13 * t + 1.7));
    const phase = TWO_PI * f * t;
    let v = 0;
    switch (waveform) {
      case 'sine':
        v = Math.sin(phase);
        break;
      case 'tri':
        v = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case 'square': {
        const n = Math.min(12, harmonicCap);
        for (let h = 1; h <= n; h += 2) {
          v += Math.sin(phase * h) / h;
        }
        v *= 4 / Math.PI;
        break;
      }
      case 'saw': {
        const n = Math.min(16, harmonicCap);
        for (let h = 1; h <= n; h++) {
          v += Math.sin(phase * h) / h;
        }
        v *= 2 / Math.PI;
        break;
      }
      case 'pluck':
        v = Math.sin(phase) * Math.exp(-t * 9);
        break;
    }
    // Envelope: attack ramp, exponential decay, release ramp.
    let env = 1;
    if (i < attack) {
      env = i / attack;
    }
    const remaining = frames - i;
    if (remaining < release) {
      env *= remaining / release;
    }
    env *= Math.exp(-t * decay);
    out[start + i] += v * amp * env;
  }
}

/** Add a soft sine kick drum (pitch sweep + fast decay). */
function addKick(out: Float32Array, fs: number, startSec: number, amp = 0.9): void {
  const start = Math.floor(startSec * fs);
  const frames = Math.floor(0.3 * fs);
  if (start + frames > out.length) {
    return;
  }
  for (let i = 0; i < frames; i++) {
    const t = i / fs;
    const f = 120 * Math.exp(-t * 22) + 45;
    const env = Math.exp(-t * 14);
    out[start + i] += Math.sin(TWO_PI * f * t) * amp * env;
  }
}

/** Add a short filtered-noise hi-hat / snare burst. */
function addNoiseHit(
  out: Float32Array,
  fs: number,
  startSec: number,
  durSec: number,
  amp: number,
  lowpassHz: number,
): void {
  const start = Math.floor(startSec * fs);
  const frames = Math.min(out.length - start, Math.floor(durSec * fs));
  if (frames <= 0) {
    return;
  }
  const noise = whiteNoise(frames, 7 + start);
  lowpassInPlace(noise, lowpassHz, fs);
  for (let i = 0; i < frames; i++) {
    out[start + i] += noise[i] * amp * Math.exp(-i / fs * 22);
  }
}

/* ------------------------------------------------------------------ */
/* Per-layer generators                                                */
/* ------------------------------------------------------------------ */

function generateAmbient(data: SfxEraData, fs: number): Float32Array {
  const seconds = 3.2;
  const frames = Math.floor(seconds * fs);
  const out = new Float32Array(frames);

  // Filtered noise bed (city air / wind / dust).
  const bed = whiteNoise(frames, 11);
  lowpassInPlace(bed, data.noiseLowpass, fs);
  for (let i = 0; i < frames; i++) {
    out[i] += bed[i] * data.noiseGain * 0.8;
  }

  // Tonal drone with slow amplitude breathing (electric hum / distant organ).
  addTone(out, fs, 0, seconds, data.baseFrequency, data.droneGain * 0.9, 'tri', {
    detune: 0.004,
    vibratoHz: 0.11,
    vibratoDepth: 0.02,
    attack: 0.4,
    release: 0.4,
    decay: 0.08,
  });
  addTone(out, fs, 0, seconds, data.baseFrequency * 1.5, data.droneGain * 0.35, 'sine', {
    detune: 0.01,
    vibratoHz: 0.09,
    vibratoDepth: 0.015,
    attack: 0.6,
    release: 0.6,
    decay: 0.04,
  });

  // Airy high component (wind amount).
  if (data.windAmount > 0) {
    const wind = whiteNoise(frames, 23);
    lowpassInPlace(wind, 2600, fs);
    for (let i = 0; i < frames; i++) {
      const lfo = 0.6 + 0.4 * Math.sin(TWO_PI * 0.05 * (i / fs) + 1.2);
      out[i] += wind[i] * data.windAmount * 0.16 * lfo;
    }
  }

  // Fade edges so the loop is click-free.
  const fade = Math.floor(0.05 * fs);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[frames - 1 - i] *= g;
  }
  return out;
}

function generateTraffic(data: SfxEraData, fs: number): Float32Array {
  const seconds = 3.4;
  const frames = Math.floor(seconds * fs);
  const out = new Float32Array(frames);

  // Brown-ish engine rumble: integrated noise, highpassed, amplitude-modulated.
  const rumble = whiteNoise(frames, 31);
  let acc = 0;
  for (let i = 0; i < frames; i++) {
    acc += rumble[i] * 0.02;
    acc *= 0.985;
    rumble[i] = acc;
  }
  highpassInPlace(rumble, 28, fs);
  for (let i = 0; i < frames; i++) {
    const t = i / fs;
    const lfo = 0.55 + 0.45 * Math.sin(TWO_PI * 9 * t + 0.4);
    out[i] += rumble[i] * data.trafficDensity * 0.9 * lfo;
  }

  // Passing-vehicle whoosh: band-passed noise events at pseudo-random offsets.
  const whooshCount = Math.max(1, Math.round(2.2 * data.trafficDensity));
  for (let w = 0; w < whooshCount; w++) {
    const startSec = 0.35 + ((w * 1.13 + 0.31) % 1.0) * (seconds - 1.3);
    const dur = 0.55 + 0.35 * ((w * 0.77) % 1);
    const start = Math.floor(startSec * fs);
    const framesLen = Math.min(out.length - start, Math.floor(dur * fs));
    if (framesLen <= 0) {
      continue;
    }
    const whoosh = whiteNoise(framesLen, 41 + w * 17);
    lowpassInPlace(whoosh, 700 + (w % 3) * 500, fs);
    for (let i = 0; i < framesLen; i++) {
      const t = i / framesLen;
      const envelope = Math.sin(Math.PI * t); // smooth pass-by shape
      out[start + i] += whoosh[i] * data.trafficDensity * 0.5 * envelope;
    }
  }

  // Faint tire hiss (higher noise, steady).
  const hiss = whiteNoise(frames, 53);
  lowpassInPlace(hiss, 5200, fs);
  for (let i = 0; i < frames; i++) {
    out[i] += hiss[i] * data.trafficDensity * 0.06;
  }

  const fade = Math.floor(0.05 * fs);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[frames - 1 - i] *= g;
  }
  return out;
}

function generateEvent(kind: SfxEventType, fs: number): Float32Array {
  switch (kind) {
    case 'horn': {
      // Two-tone vintage car horn.
      const frames = Math.floor(0.65 * fs);
      const out = new Float32Array(frames);
      addTone(out, fs, 0, 0.6, 311, 0.5, 'saw', { attack: 0.02, release: 0.08, decay: 2.2 });
      addTone(out, fs, 0.08, 0.52, 466, 0.42, 'saw', { attack: 0.02, release: 0.08, decay: 2.2 });
      return out;
    }
    case 'bell': {
      // Church / trolley bell with inharmonic partials.
      const frames = Math.floor(1.6 * fs);
      const out = new Float32Array(frames);
      const partials: Array<[number, number]> = [
        [1.0, 0.8],
        [2.76, 0.35],
        [5.4, 0.18],
        [8.9, 0.07],
      ];
      for (const [ratio, amp] of partials) {
        addTone(out, fs, 0, 1.5, 392 * ratio, amp * 0.34, 'sine', { decay: 2.6 });
      }
      return out;
    }
    case 'siren': {
      // Police siren sweep (1985 neon night).
      const frames = Math.floor(1.9 * fs);
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const t = i / fs;
        const sweep = 0.5 + 0.5 * Math.sin(TWO_PI * 0.72 * t);
        const f = 480 + sweep * 420;
        const phase = TWO_PI * (480 * t + sweep * 420 * t);
        out[i] += Math.sin(phase) * 0.38;
        out[i] += Math.sin(phase * 2) * 0.1;
      }
      const fade = Math.floor(0.02 * fs);
      for (let i = 0; i < fade; i++) {
        out[i] *= i / fade;
        out[frames - 1 - i] *= i / fade;
      }
      return out;
    }
    case 'tick':
    default: {
      // LED crosswalk tick.
      const frames = Math.floor(0.09 * fs);
      const out = new Float32Array(frames);
      const noise = whiteNoise(frames, 67);
      lowpassInPlace(noise, 2400, fs);
      for (let i = 0; i < frames; i++) {
        out[i] = noise[i] * 0.6 * Math.exp(-i / fs * 60);
      }
      return out;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Music generation (procedural loop per era style)                    */
/* ------------------------------------------------------------------ */

const SIXTEENTH = 0.14; // seconds per sixteenth note (~107 BPM quarter)

/** Render a 2-bar music loop for the given style. */
function generateMusic(style: string, fs: number): Float32Array | null {
  const bars = 2;
  const totalSixteenths = bars * 16;
  const seconds = totalSixteenths * SIXTEENTH;
  const frames = Math.floor(seconds * fs);
  const out = new Float32Array(frames);

  const beatAt = (s: number) => s * SIXTEENTH;

  switch (style) {
    case 'jazz': {
      // Walking bass 8ths over C / F / G, sparse brushed hats, soft trumpet lead.
      const bassRoots = [48, 53, 55, 48]; // C2 F2 G2 C2 per bar
      for (let bar = 0; bar < bars; bar++) {
        const root = bassRoots[bar % bassRoots.length];
        const walk = [0, 7, 8, 7, 12, 7, 8, 7];
        for (let e = 0; e < 8; e++) {
          const m = root + walk[e % walk.length];
          addTone(out, fs, beatAt(bar * 16 + e * 2), 0.24, midiToFreq(m), 0.34, 'tri', {
            attack: 0.01,
            release: 0.04,
          });
        }
        // Brushed hat on 2 & 4.
        addNoiseHit(out, fs, beatAt(bar * 16 + 4), 0.05, 0.16, 5200);
        addNoiseHit(out, fs, beatAt(bar * 16 + 12), 0.05, 0.16, 5200);
      }
      // Lead phrase.
      const lead = [72, 76, 79, 76, 74, 79, 81, 79];
      for (let e = 0; e < lead.length; e++) {
        addTone(out, fs, beatAt(2 + e * 2), 0.3, midiToFreq(lead[e]), 0.22, 'square', {
          attack: 0.02,
          release: 0.06,
          decay: 1.6,
        });
      }
      break;
    }
    case 'synthwave': {
      // A-minor 16th arp + driving kick + off-beat hats.
      const roots = [45, 41, 48, 43]; // A2 F2 C3 G2
      for (let bar = 0; bar < bars; bar++) {
        const root = roots[bar % roots.length];
        const arp = [0, 12, 7, 12, 3, 12, 7, 12];
        for (let s = 0; s < 16; s++) {
          addKick(out, fs, beatAt(bar * 16 + s), 0.5);
          if (s % 2 === 1) {
            addNoiseHit(out, fs, beatAt(bar * 16 + s), 0.04, 0.12, 7200);
          }
          const idx = s % arp.length;
          addTone(out, fs, beatAt(bar * 16 + s), 0.13, midiToFreq(root + arp[idx]), 0.16, 'square', {
            attack: 0.005,
            release: 0.03,
            decay: 3,
          });
        }
        // Bass root on 1 & 3.
        addTone(out, fs, beatAt(bar * 16), 0.5, midiToFreq(root), 0.3, 'saw', { attack: 0.01, release: 0.05 });
        addTone(out, fs, beatAt(bar * 16 + 8), 0.5, midiToFreq(root), 0.3, 'saw', { attack: 0.01, release: 0.05 });
      }
      break;
    }
    case 'house': {
      // Four-on-the-floor, off-beat hats, driving bass.
      for (let bar = 0; bar < bars; bar++) {
        for (let s = 0; s < 16; s++) {
          if (s % 4 === 0) {
            addKick(out, fs, beatAt(bar * 16 + s), 0.8);
          }
          if (s % 4 === 2) {
            addNoiseHit(out, fs, beatAt(bar * 16 + s), 0.05, 0.2, 6800);
          }
          if (s % 2 === 1) {
            addNoiseHit(out, fs, beatAt(bar * 16 + s), 0.03, 0.08, 9200);
          }
        }
        const root = 45 + (bar % 2) * 2; // A2 / B2
        for (let s = 0; s < 16; s += 2) {
          addTone(out, fs, beatAt(bar * 16 + s), 0.22, midiToFreq(root + (s % 8 === 6 ? 7 : 0)), 0.3, 'saw', {
            attack: 0.005,
            release: 0.04,
            decay: 2.4,
          });
        }
      }
      break;
    }
    case 'chill': {
      // Slow ambient pad + soft plucked arp.
      const roots = [57, 60, 64, 60]; // A3 C4 E4 C4
      for (let bar = 0; bar < bars; bar++) {
        const root = roots[bar % roots.length];
        for (const off of [0, 7, 12]) {
          addTone(out, fs, beatAt(bar * 16), 3.8, midiToFreq(root + off), 0.1, 'tri', {
            attack: 0.8,
            release: 0.9,
            decay: 0.05,
          });
        }
        const arp = [0, 12, 16, 12, 7, 12, 16, 12];
        for (let e = 0; e < 8; e++) {
          addTone(out, fs, beatAt(bar * 16 + e * 2), 0.5, midiToFreq(root + arp[e % arp.length]), 0.16, 'pluck', {
            attack: 0.005,
            release: 0.1,
          });
        }
      }
      break;
    }
    default:
      return null;
  }

  // Normalize peaks to ~0.9 and fade loop edges.
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const a = Math.abs(out[i]);
    if (a > peak) {
      peak = a;
    }
  }
  if (peak > 0.001) {
    const g = Math.min(1, 0.9 / peak);
    for (let i = 0; i < frames; i++) {
      out[i] *= g;
    }
  }
  const fade = Math.floor(0.03 * fs);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[frames - 1 - i] *= g;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Generate all buffers for one era from its SfxEraData parameters.
 * Pure synthesis — no Web Audio context required; the mixer converts the
 * Float32Arrays into playable AudioBuffers on demand.
 */
export function generateEraAudioBuffers(data: SfxEraData): EraAudioBuffers {
  const ambient = generateAmbient(data, SAMPLE_RATE);
  const traffic = generateTraffic(data, SAMPLE_RATE);
  const musicData = generateMusic(data.musicStyle, SAMPLE_RATE);
  const music = musicData ? musicData : null;
  const events = data.events.map((kind) => generateEvent(kind, SAMPLE_RATE));
  return { ambient, traffic, music, events };
}

/** Generate buffers for every era in the registry. */
export function generateAllEraBuffers(): Record<EraId, EraAudioBuffers> {
  const out: Record<EraId, EraAudioBuffers> = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    out[id] = generateEraAudioBuffers(SFX_ERA_DATA[id]);
  }
  return out;
}