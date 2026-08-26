import {
  ERA_IDS,
  SFX_ERA_DATA,
  type EraId,
  type SfxEraData,
  type SfxEventType,
} from '../eras';

/**
 * Procedural audio buffer generator.
 *
 * Every sound the mixer needs is synthesized here directly into
 * `AudioBuffer`s using `AudioContext.createBuffer()` — no external files, no
 * network. Each era gets a looping ambient bed (filtered noise + tonal drone),
 * a looping traffic rumble bed, a looping procedural music bed, and a set of
 * one-shot event buffers (horns, bells, sirens, trolleys, chimes, sweeps).
 *
 * A shared `generateWhoosh()` produces the transition whoosh played whenever
 * the era changes.
 */

/** The set of buffers synthesized for a single era. */
export interface EraAudioBuffers {
  /** Looping ambient bed (filtered noise + tonal drone). */
  ambient: AudioBuffer;
  /** Looping traffic rumble bed. */
  traffic: AudioBuffer;
  /** Looping procedural music bed. */
  music: AudioBuffer;
  /** One-shot event sound buffers. */
  events: AudioBuffer[];
}

type SampleWriter = (ch: Float32Array, n: number, dt: number) => void;

/** Allocate a mono AudioBuffer and fill it via `write`. */
function createBuffer(
  ctx: AudioContext,
  seconds: number,
  write: SampleWriter,
): AudioBuffer {
  const len = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  write(buffer.getChannelData(0), len, 1 / ctx.sampleRate);
  return buffer;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Sample a periodic waveform given a frequency and time. */
function wave(freq: number, t: number, type: OscillatorType): number {
  const phase = t * freq;
  switch (type) {
    case 'sawtooth':
      return 2 * (phase - Math.floor(phase + 0.5));
    case 'square':
      return Math.sin(2 * Math.PI * phase) >= 0 ? 1 : -1;
    case 'triangle':
      return 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1;
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

/** Ambient bed: filtered noise + tonal drone with overtone. */
function makeAmbient(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  return createBuffer(ctx, seconds, (ch, n, dt) => {
    const a = 1 - Math.exp(-2 * Math.PI * data.noiseFilterHz * dt);
    let state = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const white = Math.random() * 2 - 1;
      state += a * (white - state);
      const drone =
        wave(data.droneHz, t, data.droneWaveform) +
        0.35 * wave(data.droneHz * 2, t, data.droneWaveform);
      ch[i] = clamp(state * data.noiseGain + drone * data.droneGain, -1, 1);
    }
  });
}

/** Traffic rumble bed with slow amplitude modulation for passing vehicles. */
function makeTraffic(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  return createBuffer(ctx, seconds, (ch, n, dt) => {
    const a = 1 - Math.exp(-2 * Math.PI * data.trafficLowHz * dt);
    let state = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const white = Math.random() * 2 - 1;
      state += a * (white - state);
      const mod = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.4 * t + Math.sin(2 * Math.PI * 0.11 * t));
      ch[i] = clamp(state * mod * data.trafficIntensity * 1.1, -1, 1);
    }
  });
}

/** Note scales per music style. */
const SCALES: Record<string, number[]> = {
  swing: [220, 261.6, 329.6, 392],
  pop: [196, 246.9, 293.7, 392],
  synthwave: [110, 164.8, 220, 329.6],
  modern: [147, 196, 220, 293.7],
  tech: [130.8, 174.6, 196, 261.6],
};

/** Rhythmic procedural music bed (bass + lead arpeggio). */
function makeMusic(ctx: AudioContext, data: SfxEraData, seconds = 8): AudioBuffer {
  const notes = SCALES[data.musicStyle] ?? SCALES.modern;
  const beatLen = seconds / 8;
  return createBuffer(ctx, seconds, (ch, n, dt) => {
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const beatIdx = Math.floor(t / beatLen);
      const note = notes[beatIdx % notes.length];
      const noteT = t - beatIdx * beatLen;
      const env = Math.exp(-noteT * 3.5) * Math.min(1, noteT / 0.02);
      const bass = Math.sin(2 * Math.PI * note * 0.5 * t);
      const lead = Math.sin(2 * Math.PI * note * t);
      ch[i] = clamp((lead * 0.5 + bass * 0.6) * env * data.musicGain * 0.8, -1, 1);
    }
  });
}

/** A short car-horn burst. */
function makeHorn(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.4, (ch, n, dt) => {
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const env =
        Math.min(1, t / 0.03) * (1 - Math.min(1, Math.max(0, (t - 0.32) / 0.08)));
      const f = 390 + 25 * Math.sin(2 * Math.PI * 28 * t);
      ch[i] = Math.sin(2 * Math.PI * f * t) * env * 0.5;
    }
  });
}

/** A decaying bell tone. */
function makeBell(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.5, (ch, n, dt) => {
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const s = Math.sin(2 * Math.PI * 980 * t) + 0.4 * Math.sin(2 * Math.PI * 1960 * t);
      ch[i] = s * Math.exp(-t * 5) * 0.4;
    }
  });
}

/** A rising/falling emergency siren sweep. */
function makeSiren(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 2.2, (ch, n, dt) => {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const cycle = 1.1;
      const pp = (t % cycle) / cycle;
      const f = pp < 0.5 ? 600 + pp * 2 * 600 : 1200 - (pp - 0.5) * 2 * 600;
      phase += 2 * Math.PI * f * dt;
      const env = Math.min(1, t / 0.2) * Math.min(1, (2.2 - t) / 0.3);
      ch[i] = Math.sin(phase) * env * 0.35;
    }
  });
}

/** A trolley rumble with a closing ding. */
function makeTrolley(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.9, (ch, n, dt) => {
    const a = 1 - Math.exp(-2 * Math.PI * 85 * dt);
    let state = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const white = Math.random() * 2 - 1;
      state += a * (white - state);
      const rumble = state * 0.6;
      const ding =
        t > 0.68
          ? (Math.sin(2 * Math.PI * 1100 * t) + 0.3 * Math.sin(2 * Math.PI * 2200 * t)) *
            Math.exp(-(t - 0.68) * 8) *
            0.4
          : 0;
      ch[i] = clamp(rumble + ding, -1, 1);
    }
  });
}

/** A bright chime. */
function makeChime(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.45, (ch, n, dt) => {
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const s =
        Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 7) * 0.4 +
        Math.sin(2 * Math.PI * 2640 * t) * Math.exp(-t * 9) * 0.15;
      ch[i] = s;
    }
  });
}

/** A quick rising sweep (synth blip). */
function makeSweep(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.5, (ch, n, dt) => {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const f = 300 + (t / 0.5) * 600;
      phase += 2 * Math.PI * f * dt;
      const env = Math.min(1, t / 0.05) * Math.min(1, (0.5 - t) / 0.15);
      ch[i] = Math.sin(phase) * env * 0.3;
    }
  });
}

function makeEvent(ctx: AudioContext, type: SfxEventType): AudioBuffer {
  switch (type) {
    case 'horn':
      return makeHorn(ctx);
    case 'siren':
      return makeSiren(ctx);
    case 'trolley':
      return makeTrolley(ctx);
    case 'chime':
      return makeChime(ctx);
    case 'sweep':
      return makeSweep(ctx);
    case 'bell':
    default:
      return makeBell(ctx);
  }
}

/** Generate the full set of buffers for one era from its SFX parameters. */
export function generateEraAudioBuffers(
  ctx: AudioContext,
  data: SfxEraData,
): EraAudioBuffers {
  return {
    ambient: makeAmbient(ctx, data),
    traffic: makeTraffic(ctx, data),
    music: makeMusic(ctx, data),
    events: data.events.map((e) => makeEvent(ctx, e)),
  };
}

/** Generate buffers for every era keyed by EraId. */
export function generateAllEraBuffers(
  ctx: AudioContext,
): Record<EraId, EraAudioBuffers> {
  const out = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    out[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return out;
}

/** The transition whoosh played whenever the era changes. */
export function generateWhoosh(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.9, (ch, n, dt) => {
    const dur = 0.9;
    let state = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const p = t / dur;
      const a = 1 - Math.exp(-2 * Math.PI * (200 + 3300 * p) * dt);
      const white = Math.random() * 2 - 1;
      state += a * (white - state);
      const env = Math.sin(Math.PI * Math.min(1, p));
      ch[i] = state * env * 0.9;
    }
  });
}