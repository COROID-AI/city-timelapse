// ─── Procedural Era SFX Buffer Generator ──────────────────────────────
// Generates all audio buffers entirely via AudioContext.createBuffer().
// Zero external audio files — pure Web Audio API synthesis.

import type { EraId, SfxEraData } from '../eras.js';
import { ERA_IDS, SFX_ERA_DATA } from '../eras.js';

/** Buffers produced for a single era */
export interface EraAudioBuffers {
  /** Filtered-noise ambient bed (mono or stereo) */
  ambient: AudioBuffer;
  /** Traffic / city hum loop */
  traffic: AudioBuffer;
  /** One-shot event buffers keyed by event name */
  events: Record<string, AudioBuffer>;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Fill an AudioBuffer with samples using a callback */
function fillBuffer(
  ctx: AudioContext,
  channelCount: number,
  length: number,
  fn: (i: number, ch: number) => number,
): AudioBuffer {
  const buf = ctx.createBuffer(channelCount, length, ctx.sampleRate);
  for (let ch = 0; ch < channelCount; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = fn(i, ch);
    }
  }
  return buf;
}

/** White noise sample */
function whiteNoise(): number {
  return Math.random() * 2 - 1;
}

/** Generate a filtered-noise ambient bed from era data using biquad band-pass */
function generateAmbientBed(ctx: AudioContext, data: SfxEraData): AudioBuffer {
  const duration = 4;
  const length = Math.round(ctx.sampleRate * duration);
  const channels = 2;

  const [lo, hi] = data.ambientFreqRange;
  const center = Math.sqrt(lo * hi);
  const Q = center / (hi - lo || 1);
  const w = 2 * Math.PI * center / ctx.sampleRate;

  const cosW = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Q);

  // Biquad band-pass coefficients (normalized by a0 = 1 + alpha)
  const b0 = alpha / (1 + alpha);
  const b1 = 0;
  const b2 = -alpha / (1 + alpha);
  const aa1 = (-2 * cosW) / (1 + alpha);
  const aa2 = (1 - alpha) / (1 + alpha);

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  return fillBuffer(ctx, channels, length, (_i, ch) => {
    const x = whiteNoise();
    const y = b0 * x + b1 * x1 + b2 * x2 - aa1 * y1 - aa2 * y2;

    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;

    return y * data.ambientVolume * (ch === 0 ? 1 : 0.98);
  });
}

/** Generate traffic/engine noise loop */
function generateTrafficLoop(ctx: AudioContext, density: number): AudioBuffer {
  const duration = 3;
  const length = Math.round(ctx.sampleRate * duration);
  const channels = 2;

  // Low rumble + periodic engine pulses
  const engineRpm = 800 + density * 400;
  const pulseInterval = ctx.sampleRate / (engineRpm / 60);

  let enginePhase = 0;

  return fillBuffer(ctx, channels, length, (i, ch) => {
    const rumble = Math.sin((2 * Math.PI * 40 * i) / ctx.sampleRate) * 0.4
                 + Math.sin((2 * Math.PI * 80 * i) / ctx.sampleRate) * 0.2
                 + whiteNoise() * 0.08;

    enginePhase = (enginePhase + 1) % pulseInterval;
    const pulseEnv = Math.exp(-enginePhase / (pulseInterval * 0.15));
    const enginePulse = Math.sin((2 * Math.PI * 60 * i) / ctx.sampleRate) * pulseEnv * density;

    const wind = whiteNoise() * 0.03 * density;

    const sweep = Math.sin((2 * Math.PI * (200 + 300 * Math.sin(i * 0.001)) * i) / ctx.sampleRate)
                  * 0.02 * density;

    const base = (rumble + enginePulse + wind + sweep) * 0.6;
    return base * (ch === 0 ? 1 : 0.95);
  });
}

// ── One-shot event synthesizers ────────────────────────────────────────

function generateHorn(ctx: AudioContext): AudioBuffer {
  const duration = 0.8;
  const length = Math.round(ctx.sampleRate * duration);
  const fundamental = 440;
  const harmonics = [1, 2, 3, 4, 5, 6];
  const gains = [1, 0.6, 0.4, 0.25, 0.15, 0.08];

  return fillBuffer(ctx, 1, length, (i) => {
    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const freq = fundamental * harmonics[h];
      const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
      sample += Math.sin(phase) * gains[h];
    }
    const t = i / ctx.sampleRate;
    const attack = Math.min(t / 0.05, 1);
    const decay = t > 0.6 ? 1 - (t - 0.6) / 0.2 : 1;
    const env = Math.max(attack * decay, 0);
    return sample * env * 0.3;
  });
}

function generateBell(ctx: AudioContext): AudioBuffer {
  const duration = 2.5;
  const length = Math.round(ctx.sampleRate * duration);
  const partials = [1, 2.756, 3.469, 4.078, 5.47];
  const gains = [1, 0.4, 0.3, 0.2, 0.15];
  const freq = 800;

  return fillBuffer(ctx, 1, length, (i) => {
    let sample = 0;
    for (let p = 0; p < partials.length; p++) {
      const phase = (2 * Math.PI * freq * partials[p] * i) / ctx.sampleRate;
      sample += Math.sin(phase) * gains[p];
    }
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 2.5) * Math.min(t / 0.01, 1);
    return sample * env * 0.25;
  });
}

function generateSiren(ctx: AudioContext): AudioBuffer {
  const duration = 1.5;
  const length = Math.round(ctx.sampleRate * duration);
  const baseFreq = 600;
  const swing = 300;
  const speed = 3;

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const freq = baseFreq + swing * Math.sin(2 * Math.PI * speed * t);
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.5 + Math.sin(phase * 1.5) * 0.2;
    const env = Math.min(t / 0.1, 1) * (t > 1.3 ? 1 - (t - 1.3) / 0.2 : 1);
    return sample * env * 0.2;
  });
}

function generateAirRaidSiren(ctx: AudioContext): AudioBuffer {
  const duration = 2;
  const length = Math.round(ctx.sampleRate * duration);
  const baseFreq = 300;
  const swing = 200;
  const speed = 2;

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const freq = baseFreq + swing * Math.sin(2 * Math.PI * speed * t);
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.4 + Math.sin(phase * 0.5) * 0.3;
    const env = Math.min(t / 0.15, 1) * (t > 1.8 ? 1 - (t - 1.8) / 0.2 : 1);
    return sample * env * 0.2;
  });
}

function generateMarchingBoots(ctx: AudioContext): AudioBuffer {
  const duration = 1.5;
  const length = Math.round(ctx.sampleRate * duration);
  const bpm = 120;
  const beatInterval = ctx.sampleRate / (bpm / 60);

  return fillBuffer(ctx, 1, length, (i) => {
    const beatPos = i % beatInterval;
    const env = Math.exp(-beatPos / (beatInterval * 0.08));
    const stomp = Math.sin(2 * Math.PI * 80 * i / ctx.sampleRate) * env;
    const sub = Math.sin(2 * Math.PI * 40 * i / ctx.sampleRate) * env * 0.5;
    return (stomp + sub) * 0.25;
  });
}

function generateWarBondsSpeaker(ctx: AudioContext): AudioBuffer {
  const duration = 1;
  const length = Math.round(ctx.sampleRate * duration);
  const formants = [500, 1500, 2500];
  const formGains = [1, 0.6, 0.3];

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const mod = 1 + 0.5 * Math.sin(2 * Math.PI * 200 * t)
                      + 0.3 * Math.sin(2 * Math.PI * 540 * t);
    const carrierWave = Math.sin(2 * Math.PI * 1000 * t * mod);
    let voiced = 0;
    for (let f = 0; f < formants.length; f++) {
      voiced += Math.sin(2 * Math.PI * formants[f] * t) * formGains[f];
    }
    const noise = whiteNoise() * 0.15;
    const env = Math.sin(Math.PI * t / duration);
    return (carrierWave * 0.1 + voiced * 0.3 + noise) * env * 0.2;
  });
}

function generateDooWopHarmony(ctx: AudioContext): AudioBuffer {
  const duration = 1.2;
  const length = Math.round(ctx.sampleRate * duration);
  const root = 330;
  const chords = [[1, 1.25, 1.5], [1, 1.25, 1.5, 2]];

  return fillBuffer(ctx, 1, length, (i) => {
    let sample = 0;
    for (const chord of chords) {
      for (const ratio of chord) {
        const freq = root * ratio;
        const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
        sample += Math.sin(phase) * 0.3;
      }
    }
    const env = Math.sin(Math.PI * i / length);
    return sample * env * 0.2;
  });
}

function generateDriveInJingle(ctx: AudioContext): AudioBuffer {
  const duration = 0.8;
  const length = Math.round(ctx.sampleRate * duration);
  const notes = [523, 659, 784, 1047];

  return fillBuffer(ctx, 1, length, (i) => {
    const noteIdx = Math.floor((i / ctx.sampleRate) / (duration / notes.length));
    const freq = notes[Math.min(noteIdx, notes.length - 1)];
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.4 + Math.sin(phase * 2) * 0.15;
    const localT = (i / ctx.sampleRate) % (duration / notes.length);
    const env = Math.exp(-localT * 6);
    return sample * env * 0.25;
  });
}

function generateRockNRollRiff(ctx: AudioContext): AudioBuffer {
  const duration = 0.6;
  const length = Math.round(ctx.sampleRate * duration);
  const notes = [330, 392, 440, 392, 330, 294];

  return fillBuffer(ctx, 1, length, (i) => {
    const noteDur = duration / notes.length;
    const noteIdx = Math.floor((i / ctx.sampleRate) / noteDur);
    const freq = notes[Math.min(noteIdx, notes.length - 1)];
    const localT = (i / ctx.sampleRate) % noteDur;
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const raw = Math.sin(phase) * 0.5;
    const dist = Math.tanh(raw * 3);
    const env = Math.exp(-localT * 12);
    return dist * env * 0.2;
  });
}

function generateArcadeCoinDrop(ctx: AudioContext): AudioBuffer {
  const duration = 0.3;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const freq = 2000 + 1000 * Math.exp(-t * 30);
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.5 + Math.sin(phase * 2.5) * 0.2;
    const env = Math.exp(-t * 20);
    return sample * env * 0.3;
  });
}

function generateCassetteEject(ctx: AudioContext): AudioBuffer {
  const duration = 0.8;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const motorFreq = 100 + 200 * Math.exp(-t * 5);
    const motor = Math.sin(2 * Math.PI * motorFreq * t) * 0.3 * Math.exp(-t * 3);
    const click = Math.exp(-((i % 500) / 20)) * (i % 500 < 10 ? 1 : 0) * 0.5;
    return (motor + click) * 0.2;
  });
}

function generateSynthStab(ctx: AudioContext): AudioBuffer {
  const duration = 0.5;
  const length = Math.round(ctx.sampleRate * duration);
  const notes = [220, 277, 330, 440];

  return fillBuffer(ctx, 1, length, (i) => {
    let sample = 0;
    for (const freq of notes) {
      const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
      const saw = ((phase % (2 * Math.PI)) / Math.PI) - 1;
      sample += saw * 0.15;
    }
    const env = Math.exp(-i / (ctx.sampleRate * 0.15));
    return sample * env * 0.3;
  });
}

function generateCellPhoneRing(ctx: AudioContext): AudioBuffer {
  const duration = 1;
  const length = Math.round(ctx.sampleRate * duration);
  const tones = [697, 770, 852, 941, 1209, 1336, 1477];
  const pattern = [tones[0], tones[3], tones[1], tones[4], tones[2], tones[5]];

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const toneIdx = Math.floor(t / (duration / pattern.length));
    const freq = pattern[Math.min(toneIdx, pattern.length - 1)];
    const localT = (t % (duration / pattern.length));
    const env = Math.exp(-localT * 5);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4;
    return sample * env * 0.25;
  });
}

function generateGPSVoice(ctx: AudioContext): AudioBuffer {
  const duration = 0.7;
  const length = Math.round(ctx.sampleRate * duration);
  const formants = [700, 1200, 2500, 3500];
  const gains = [1, 0.7, 0.4, 0.2];

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const env = Math.sin(Math.PI * t / duration);
    let sample = 0;
    for (let f = 0; f < formants.length; f++) {
      const mod = 1 + 0.3 * Math.sin(2 * Math.PI * 5 * t);
      sample += Math.sin(2 * Math.PI * formants[f] * mod * t) * gains[f];
    }
    return sample * env * 0.15;
  });
}

function generateFlipOpenClick(ctx: AudioContext): AudioBuffer {
  const duration = 0.15;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 100);
    const click = whiteNoise() * env;
    const tone = Math.sin(2 * Math.PI * 3000 * t) * env * 0.5;
    return (click * 0.3 + tone) * 0.3;
  });
}

function generateAutonomousDroneBeep(ctx: AudioContext): AudioBuffer {
  const duration = 0.4;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const freq = 1200 + 400 * Math.sin(2 * Math.PI * 5 * t);
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.4;
    const env = Math.exp(-t * 8);
    return sample * env * 0.2;
  });
}

function generateEVChirp(ctx: AudioContext): AudioBuffer {
  const duration = 0.5;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const freq = 800 + 600 * (t / duration);
    const phase = (2 * Math.PI * freq * i) / ctx.sampleRate;
    const sample = Math.sin(phase) * 0.3;
    const env = Math.sin(Math.PI * t / duration) * Math.exp(-t * 3);
    return sample * env * 0.25;
  });
}

function generateSmartwatchHaptic(ctx: AudioContext): AudioBuffer {
  const duration = 0.1;
  const length = Math.round(ctx.sampleRate * duration);

  return fillBuffer(ctx, 1, length, (i) => {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 80);
    return whiteNoise() * env * 0.15;
  });
}

// ── Event synthesizer registry ─────────────────────────────────────────

type EventSynthFn = (ctx: AudioContext) => AudioBuffer;

const EVENT_SYNTHS: Record<string, EventSynthFn> = {
  'airraid_siren': generateAirRaidSiren,
  'marching_boots': generateMarchingBoots,
  'war_bonds_speaker': generateWarBondsSpeaker,
  'doo_wop_harmony': generateDooWopHarmony,
  'drive_in_jingle': generateDriveInJingle,
  'rock_n_roll_riff': generateRockNRollRiff,
  'arcade_coin_drop': generateArcadeCoinDrop,
  'cassette_eject': generateCassetteEject,
  'synth_stab': generateSynthStab,
  'cell_phone_ring': generateCellPhoneRing,
  'gps_voice': generateGPSVoice,
  'flip_open_click': generateFlipOpenClick,
  'autonomous_drone_beep': generateAutonomousDroneBeep,
  'ev_chirp': generateEVChirp,
  'smartwatch_haptic': generateSmartwatchHaptic,
};

const GENERIC_EVENTS: Record<string, EventSynthFn> = {
  'horn': generateHorn,
  'bell': generateBell,
  'siren': generateSiren,
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Generate all AudioBuffers for a single era from its SfxEraData.
 * Produces ambient bed (filtered noise), traffic loop, and era-specific events.
 */
export function generateEraAudioBuffers(
  ctx: AudioContext,
  data: SfxEraData,
): EraAudioBuffers {
  const ambient = generateAmbientBed(ctx, data);
  const traffic = generateTrafficLoop(ctx, data.trafficDensity);

  const events: Record<string, AudioBuffer> = {};
  for (const eventName of data.events) {
    const synth = EVENT_SYNTHS[eventName];
    if (synth) {
      events[eventName] = synth(ctx);
    } else {
      const fallback = GENERIC_EVENTS[eventName.split('_')[0]] ?? generateBell;
      events[eventName] = fallback(ctx);
    }
  }

  return { ambient, traffic, events };
}

/**
 * Generate AudioBuffers for every era defined in SFX_ERA_DATA.
 * Returns Record<EraId, EraAudioBuffers>.
 */
export function generateAllEraBuffers(
  ctx: AudioContext,
): Record<EraId, EraAudioBuffers> {
  const result = {} as Record<EraId, EraAudioBuffers>;
  for (const eraId of ERA_IDS) {
    result[eraId] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[eraId]);
  }
  return result;
}
