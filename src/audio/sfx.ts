/**
 * Procedural era audio synthesis.
 *
 * Every buffer is generated at runtime through `AudioContext.createBuffer()`
 * — filtered noise beds, tonal drones, traffic engine loops and one-shot
 * events (bells, horns, sirens, chimes) plus a looping period music bed.
 * There are no external audio files anywhere in the pipeline.
 *
 * All randomness comes from a seeded PRNG keyed by the era id, so generation
 * is fully deterministic: the same era always renders byte-identical buffers.
 */

import { ERA_IDS, SFX_ERA_DATA } from '../eras';
import type { EraId, EventSoundKind, MusicStyle, SfxEraData } from '../eras';

/** Rendered audio assets for one era. */
export interface EraAudioBuffers {
  /** Looping ambient bed: tonal drone + filtered noise wash. */
  readonly ambient: AudioBuffer;
  /** Looping street-traffic loop (engines/tires or EV whine). */
  readonly traffic: AudioBuffer;
  /** One-shot event sounds for this era (bells, horns, sirens, chimes…). */
  readonly events: readonly AudioBuffer[];
  /** Looping period music bed. */
  readonly music: AudioBuffer;
}

const TAU = Math.PI * 2;
const AMBIENT_SECONDS = 6;
const TRAFFIC_SECONDS = 6;
const MUSIC_BEATS_PER_BAR = 4;
const MUSIC_BARS = 4;
const MUSIC_MIN_SECONDS = 6;
const LOOP_FADE_SECONDS = 0.1;
const PEAK_GUARD = 0.97;

type Rng = () => number;
type StereoChannels = [Float32Array, Float32Array];
type WaveKind = 'sine' | 'triangle' | 'saw' | 'square';

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// DSP primitives
// ---------------------------------------------------------------------------

function oscillator(wave: WaveKind, phase: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(TAU * phase);
    case 'triangle':
      return phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
    case 'saw':
      return 2 * phase - 1;
    case 'square':
      return phase < 0.5 ? 0.7 : -0.7;
  }
}

/** RBJ biquad low-pass coefficients: [b0, b1, b2, a1, a2]. */
function biquadLowpassCoeffs(
  cutoffHz: number,
  q: number,
  sr: number,
): readonly [number, number, number, number, number] {
  const w0 = (TAU * Math.min(cutoffHz, sr * 0.45)) / sr;
  const cosW = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return [
    (1 - cosW) / 2 / a0,
    (1 - cosW) / a0,
    (1 - cosW) / 2 / a0,
    (-2 * cosW) / a0,
    (1 - alpha) / a0,
  ];
}

function addDrone(
  ch: Float32Array,
  sr: number,
  freqs: readonly number[],
  level: number,
  amHz: number,
  phaseSeed: number,
): void {
  for (let i = 0; i < ch.length; i++) {
    const t = i / sr;
    const am = 0.72 + 0.28 * Math.sin(TAU * amHz * t + phaseSeed);
    let s = 0;
    for (let k = 0; k < freqs.length; k++) {
      s += Math.sin(TAU * freqs[k] * t + phaseSeed * (k + 1) * 0.37) / (k + 1);
    }
    ch[i] += s * level * am * 0.6;
  }
}

function addFilteredNoise(
  ch: Float32Array,
  sr: number,
  rng: Rng,
  cutoffHz: number,
  q: number,
  level: number,
  swellHz: number,
): void {
  const [b0, b1, b2, a1, a2] = biquadLowpassCoeffs(cutoffHz, q, sr);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < ch.length; i++) {
    const x = rng() * 2 - 1;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const swell = 0.65 + 0.35 * Math.sin(TAU * swellHz * (i / sr));
    ch[i] += y * level * swell;
  }
}

function addEngineThump(
  chans: StereoChannels,
  sr: number,
  startSample: number,
  freqHz: number,
  amp: number,
  decaySec: number,
): void {
  const [L, R] = chans;
  const dur = Math.round(decaySec * 4 * sr);
  for (let i = 0; i < dur; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const env = Math.exp(-i / (decaySec * sr));
    const s = Math.sin((TAU * freqHz * i) / sr) * env * amp;
    L[idx] += s * 0.92;
    R[idx] += s;
  }
}

function addEvWhine(chans: StereoChannels, sr: number, baseHz: number, level: number): void {
  const [L, R] = chans;
  let phaseL = 0;
  let phaseR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const wobble =
      1 + 0.05 * Math.sin(TAU * 0.13 * t) + 0.02 * Math.sin(TAU * 0.47 * t);
    const f = baseHz * wobble;
    phaseL += f / sr;
    phaseR += (f * 1.004) / sr;
    const amp = level * (0.8 + 0.2 * Math.sin(TAU * 0.09 * t));
    L[i] += Math.sin(TAU * phaseL) * amp;
    R[i] +=
      Math.sin(TAU * phaseR) * amp * 0.9 + Math.sin(TAU * phaseL * 2) * amp * 0.12;
  }
}

function addPassBy(
  chans: StereoChannels,
  sr: number,
  startSample: number,
  durSamples: number,
  rng: Rng,
  bright: boolean,
): void {
  const [L, R] = chans;
  const pan = 0.15 + rng() * 0.7;
  const fcBase = bright ? 900 : 320;
  const fcSpan = bright ? 1700 : 650;
  let lp = 0;
  for (let i = 0; i < durSamples; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const p = i / durSamples;
    const env = Math.sin(Math.PI * p) ** 2;
    const fc = fcBase + fcSpan * Math.sin(Math.PI * p);
    const a = Math.exp((-TAU * Math.min(fc, sr * 0.45)) / sr);
    const x = rng() * 2 - 1;
    lp += a * (x - lp);
    const s = lp * env * (bright ? 0.55 : 0.85);
    L[idx] += s * (1 - pan);
    R[idx] += s * pan;
  }
}

function addTone(
  chans: StereoChannels,
  sr: number,
  startSample: number,
  durSamples: number,
  freqHz: number,
  amp: number,
  wave: WaveKind,
  attackSec: number,
  releaseSec: number,
  pan = 0.5,
): void {
  const [L, R] = chans;
  const atk = Math.max(1, Math.round(attackSec * sr));
  const rel = Math.max(1, Math.round(releaseSec * sr));
  const wl = 1 - pan;
  const wr = pan;
  let phase = 0;
  for (let i = 0; i < durSamples; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    let env = 1;
    if (i < atk) env = i / atk;
    const tailStart = durSamples - rel;
    if (i > tailStart) env = Math.min(env, (durSamples - i) / rel);
    phase += freqHz / sr;
    const s = oscillator(wave, phase % 1) * amp * env;
    L[idx] += s * wl;
    R[idx] += s * wr;
  }
}

function addDecayedTone(
  chans: StereoChannels,
  sr: number,
  startSample: number,
  durSamples: number,
  freqHz: number,
  amp: number,
  decayRate: number,
  pan = 0.5,
): void {
  const [L, R] = chans;
  const wl = 1 - pan;
  const wr = pan;
  let phase = 0;
  for (let i = 0; i < durSamples; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const env = Math.exp(-decayRate * (i / sr));
    phase += freqHz / sr;
    const s = Math.sin(TAU * phase) * amp * env;
    L[idx] += s * wl;
    R[idx] += s * wr;
  }
}

function addKick(chans: StereoChannels, sr: number, startSample: number, amp: number): void {
  const [L, R] = chans;
  const dur = Math.round(0.22 * sr);
  let phase = 0;
  for (let i = 0; i < dur; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const p = i / dur;
    const f = 44 + 95 * (1 - p) * (1 - p);
    phase += f / sr;
    const env = (1 - p) * (1 - p);
    const s = Math.sin(TAU * phase) * env * amp;
    L[idx] += s;
    R[idx] += s;
  }
}

function addSnare(
  chans: StereoChannels,
  sr: number,
  startSample: number,
  amp: number,
  rng: Rng,
): void {
  const [L, R] = chans;
  const dur = Math.round(0.16 * sr);
  let prevX = 0;
  let hp = 0;
  for (let i = 0; i < dur; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const p = i / dur;
    const x = rng() * 2 - 1;
    hp = 0.72 * (hp + x - prevX);
    prevX = x;
    const env = Math.pow(1 - p, 1.4);
    const s = (hp * 0.9 + Math.sin((TAU * 190 * i) / sr) * 0.35) * env * amp;
    L[idx] += s * 0.95;
    R[idx] += s;
  }
}

function addHat(chans: StereoChannels, sr: number, startSample: number, amp: number, rng: Rng): void {
  const [L, R] = chans;
  const dur = Math.round(0.05 * sr);
  let prevX = 0;
  let hp = 0;
  for (let i = 0; i < dur; i++) {
    const idx = startSample + i;
    if (idx >= L.length) break;
    const p = i / dur;
    const x = rng() * 2 - 1;
    hp = 0.9 * (hp + x - prevX);
    prevX = x;
    const s = hp * Math.pow(1 - p, 2) * amp * 0.8;
    L[idx] += s * 0.9;
    R[idx] += s;
  }
}

// ---------------------------------------------------------------------------
// Buffer post-processing
// ---------------------------------------------------------------------------

function scaleBuffer(buffer: AudioBuffer, factor: number): void {
  if (factor === 1) return;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= factor;
  }
}

function guardPeak(buffer: AudioBuffer, limit: number): void {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak > limit && peak > 0) scaleBuffer(buffer, limit / peak);
}

/** Crossfade the tail into the head so `loop = true` sources never click. */
function makeSeamlessLoop(buffer: AudioBuffer, fadeSeconds: number): void {
  const fade = Math.max(
    1,
    Math.round(Math.min(fadeSeconds, buffer.duration / 4) * buffer.sampleRate),
  );
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    const n = data.length;
    for (let i = 0; i < fade && i < n; i++) {
      const w = i / fade;
      const tailIdx = n - fade + i;
      data[tailIdx] = data[tailIdx] * (1 - w) + data[i] * w;
    }
  }
}

// ---------------------------------------------------------------------------
// Layer renderers
// ---------------------------------------------------------------------------

function renderAmbient(ctx: BaseAudioContext, data: SfxEraData, rng: Rng): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(2, Math.round(AMBIENT_SECONDS * sr), sr);
  const a = data.ambient;
  const channels = [buf.getChannelData(0), buf.getChannelData(1)];
  for (const [c, ch] of channels.entries()) {
    addDrone(ch, sr, a.droneFrequencies, a.droneLevel, 0.05 + c * 0.028, 0.4 + c * 1.31);
    addFilteredNoise(ch, sr, rng, a.noiseCutoffHz, 0.7, a.noiseLevel, 0.06 + c * 0.045);
  }
  guardPeak(buf, 0.85);
  makeSeamlessLoop(buf, LOOP_FADE_SECONDS);
  return buf;
}

function renderTraffic(ctx: BaseAudioContext, data: SfxEraData, rng: Rng): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(2, Math.round(TRAFFIC_SECONDS * sr), sr);
  const chans: StereoChannels = [buf.getChannelData(0), buf.getChannelData(1)];
  const t = data.traffic;

  if (!t.electric) {
    // Combustion-era streets: idle engine thumps + rolling tire noise.
    const vehicles = Math.max(1, Math.round(t.density * 7));
    for (let v = 0; v < vehicles; v++) {
      const period = (0.3 + rng() * 0.5) / t.pace;
      const offset = rng() * TRAFFIC_SECONDS;
      const freq = 36 + rng() * 46;
      const amp = (0.3 + rng() * 0.35) * (0.35 + t.density);
      for (let time = offset; time < TRAFFIC_SECONDS - 0.05; time += period) {
        addEngineThump(
          chans,
          sr,
          Math.round(time * sr),
          freq * (1 + (rng() - 0.5) * 0.12),
          amp,
          0.06 + rng() * 0.05,
        );
      }
    }
    addFilteredNoise(chans[0], sr, rng, 420 + t.density * 320, 0.8, 0.2 * t.density * (0.8 + 0.4 * t.pace), 0.11);
    addFilteredNoise(chans[1], sr, rng, 380 + t.density * 300, 0.8, 0.18 * t.density * (0.8 + 0.4 * t.pace), 0.09);
  } else {
    // Electric-era streets: near-silent drivetrain whine + aerodynamic bed.
    addEvWhine(chans, sr, 520 + rng() * 240, 0.05 + 0.06 * t.density);
    addFilteredNoise(chans[0], sr, rng, 950, 0.7, 0.09 + 0.07 * t.density, 0.13);
    addFilteredNoise(chans[1], sr, rng, 880, 0.7, 0.08 + 0.07 * t.density, 0.1);
  }

  const passBys = 2 + Math.round(t.density * 4);
  for (let p = 0; p < passBys; p++) {
    const durSamples = Math.round(((1.0 + rng() * 0.7) / t.pace) * sr);
    const start = Math.floor(rng() * Math.max(1, TRAFFIC_SECONDS * sr - durSamples));
    addPassBy(chans, sr, start, durSamples, rng, t.electric);
  }

  scaleBuffer(buf, t.level);
  guardPeak(buf, PEAK_GUARD);
  makeSeamlessLoop(buf, LOOP_FADE_SECONDS);
  return buf;
}

const STYLE_PROGRESSIONS: Record<MusicStyle, readonly number[][]> = {
  bigbandSwing: [
    [0, 4, 7, 11],
    [9, 12, 16, 19],
    [5, 9, 12, 16],
    [7, 11, 14, 17],
  ],
  surfRock: [
    [0, 3, 7],
    [5, 8, 12],
    [7, 10, 14],
    [3, 7, 10],
  ],
  synthwave: [
    [0, 3, 7, 10],
    [8, 12, 15, 19],
    [3, 7, 10, 14],
    [10, 14, 17, 21],
  ],
  popRock: [
    [0, 4, 7],
    [9, 12, 16],
    [5, 9, 12],
    [7, 11, 14],
  ],
  electronicAmbient: [
    [0, 7, 12, 19],
    [5, 12, 17, 24],
    [3, 10, 15, 22],
    [7, 14, 19, 26],
  ],
};

const PENTATONIC = [0, 3, 5, 7, 10];

function renderMusic(ctx: BaseAudioContext, data: SfxEraData, rng: Rng): AudioBuffer {
  const sr = ctx.sampleRate;
  const spb = 60 / data.music.tempoBpm;
  const beats = Math.max(MUSIC_BARS * MUSIC_BEATS_PER_BAR, Math.ceil(MUSIC_MIN_SECONDS / spb));
  const len = Math.round(beats * spb * sr);
  const buf = ctx.createBuffer(2, len, sr);
  const chans: StereoChannels = [buf.getChannelData(0), buf.getChannelData(1)];

  const root = data.music.rootFrequency;
  const prog = STYLE_PROGRESSIONS[data.music.style];
  const bars = Math.ceil(beats / MUSIC_BEATS_PER_BAR);
  const at = (beat: number): number => Math.round(beat * spb * sr);
  const sec = (seconds: number): number => Math.round(seconds * sr);
  const note = (semis: number): number => root * Math.pow(2, semis / 12);

  switch (data.music.style) {
    case 'bigbandSwing': {
      for (let bar = 0; bar < bars; bar++) {
        const b0 = bar * MUSIC_BEATS_PER_BAR;
        const chord = prog[bar % prog.length];
        for (let k = 0; k < MUSIC_BEATS_PER_BAR; k++) {
          addTone(chans, sr, at(b0 + k), sec(0.3), note(chord[k % chord.length] - 12), 0.3, 'triangle', 0.008, 0.06, 0.5);
        }
        for (const off of [1.66, 3.33]) {
          chord.forEach((semi, idx) =>
            addTone(chans, sr, at(b0 + off), sec(0.16), note(semi), 0.1, 'saw', 0.012, 0.06, idx % 2 === 0 ? 0.38 : 0.62),
          );
        }
        for (let e = 0; e < beats * 2 && e < MUSIC_BEATS_PER_BAR * bars * 2; e++) {
          const swing = e % 2 === 1 ? 0.16 : 0;
          addHat(chans, sr, at(b0 + (e % (MUSIC_BEATS_PER_BAR * 2)) * 0.5 + swing), 0.09, rng);
        }
      }
      break;
    }
    case 'surfRock': {
      for (let bar = 0; bar < bars; bar++) {
        const b0 = bar * MUSIC_BEATS_PER_BAR;
        const chord = prog[bar % prog.length];
        for (let e = 0; e < MUSIC_BEATS_PER_BAR * 2; e++) {
          addTone(chans, sr, at(b0 + e * 0.5), sec(0.2), note(chord[0] - 12), 0.26, 'triangle', 0.005, 0.08, 0.5);
          addHat(chans, sr, at(b0 + e * 0.5), 0.07, rng);
        }
        for (let m = 0; m < 4; m++) {
          const semi = PENTATONIC[Math.floor(rng() * PENTATONIC.length)] + 12;
          addTone(chans, sr, at(b0 + m + rng() * 0.5), sec(0.22), note(semi), 0.17, 'triangle', 0.004, 0.1, 0.3 + rng() * 0.4);
        }
        addKick(chans, sr, at(b0), 0.5);
        addKick(chans, sr, at(b0 + 2), 0.5);
        addSnare(chans, sr, at(b0 + 1), 0.4, rng);
        addSnare(chans, sr, at(b0 + 3), 0.4, rng);
      }
      break;
    }
    case 'synthwave': {
      for (let bar = 0; bar < bars; bar++) {
        const b0 = bar * MUSIC_BEATS_PER_BAR;
        const chord = prog[bar % prog.length];
        for (const semi of chord) {
          addTone(chans, sr, at(b0), sec(MUSIC_BEATS_PER_BAR * spb), note(semi), 0.09, 'saw', 0.25, 0.4, 0.5);
        }
        for (let s16 = 0; s16 < MUSIC_BEATS_PER_BAR * 4; s16++) {
          addTone(chans, sr, at(b0 + s16 * 0.25), sec(0.11), note(chord[s16 % chord.length] - 24), 0.2, 'saw', 0.004, 0.05, 0.5);
        }
        addKick(chans, sr, at(b0), 0.55);
        addKick(chans, sr, at(b0 + 2), 0.55);
        addSnare(chans, sr, at(b0 + 1), 0.42, rng);
        addSnare(chans, sr, at(b0 + 3), 0.42, rng);
      }
      break;
    }
    case 'popRock': {
      for (let bar = 0; bar < bars; bar++) {
        const b0 = bar * MUSIC_BEATS_PER_BAR;
        const chord = prog[bar % prog.length];
        for (const off of [0, 1.5, 2, 3.5]) {
          chord.forEach((semi, idx) =>
            addTone(chans, sr, at(b0 + off), sec(0.32), note(semi), 0.13, 'triangle', 0.01, 0.12, idx % 2 === 0 ? 0.4 : 0.6),
          );
        }
        for (let k = 0; k < MUSIC_BEATS_PER_BAR; k++) {
          addTone(chans, sr, at(b0 + k), sec(0.24), note(chord[0] - 12), 0.26, 'sine', 0.006, 0.08, 0.5);
          addKick(chans, sr, at(b0 + k), 0.4);
          addHat(chans, sr, at(b0 + k + 0.5), 0.08, rng);
        }
        addSnare(chans, sr, at(b0 + 1), 0.36, rng);
        addSnare(chans, sr, at(b0 + 3), 0.36, rng);
      }
      break;
    }
    case 'electronicAmbient': {
      addTone(chans, sr, 0, len, note(-24), 0.22, 'sine', 0.6, 0.8, 0.5);
      for (let bar = 0; bar < bars; bar += 2) {
        const groupBeats = Math.min(MUSIC_BEATS_PER_BAR * 2, beats - bar * MUSIC_BEATS_PER_BAR);
        if (groupBeats <= 0) continue;
        const chord = prog[(bar / 2) % prog.length];
        for (const semi of chord) {
          addTone(chans, sr, at(bar * MUSIC_BEATS_PER_BAR), sec(groupBeats * spb), note(semi), 0.07, 'triangle', 1.2, 1.4, 0.5);
        }
      }
      for (let bar = 0; bar < bars; bar++) {
        for (let p = 0; p < 2; p++) {
          const semi = PENTATONIC[Math.floor(rng() * PENTATONIC.length)] + 24;
          const beat = bar * MUSIC_BEATS_PER_BAR + rng() * 3.5;
          addTone(chans, sr, at(beat), sec(0.5), note(semi), 0.12, 'sine', 0.01, 0.3, 0.3 + rng() * 0.4);
          addTone(chans, sr, at(beat + 0.75), sec(0.4), note(semi), 0.05, 'sine', 0.01, 0.25, 0.7);
        }
      }
      break;
    }
  }

  scaleBuffer(buf, data.music.level);
  guardPeak(buf, PEAK_GUARD);
  makeSeamlessLoop(buf, LOOP_FADE_SECONDS);
  return buf;
}

const EVENT_DURATIONS: Record<EventSoundKind, number> = {
  bell: 1.5,
  tramBell: 1.0,
  horn: 0.65,
  siren: 2.2,
  airHorn: 0.9,
  digitalChime: 0.9,
  evChime: 1.1,
};

function renderEventOneShot(ctx: BaseAudioContext, kind: EventSoundKind, rng: Rng): AudioBuffer {
  const sr = ctx.sampleRate;
  const seconds = EVENT_DURATIONS[kind];
  const buf = ctx.createBuffer(2, Math.max(1, Math.round(seconds * sr)), sr);
  const chans: StereoChannels = [buf.getChannelData(0), buf.getChannelData(1)];
  const total = buf.length;

  switch (kind) {
    case 'bell': {
      const partials: readonly (readonly [number, number])[] = [
        [1, 1],
        [2.0, 0.55],
        [2.74, 0.42],
        [4.07, 0.28],
        [5.43, 0.18],
      ];
      for (const [ratio, amp] of partials) {
        addDecayedTone(chans, sr, 0, total, 523.25 * ratio, amp * 0.42, 1.6 + ratio * 0.9, 0.5);
      }
      addHat(chans, sr, 0, 0.25, rng); // strike transient
      break;
    }
    case 'tramBell': {
      const partials: readonly (readonly [number, number])[] = [[1, 1], [2.52, 0.5], [4.05, 0.26]];
      for (const [startSec, amp] of [
        [0, 0.75],
        [0.3, 0.55],
      ] as const) {
        const start = Math.round(startSec * sr);
        for (const [ratio, pAmp] of partials) {
          addDecayedTone(chans, sr, start, total - start, 659.25 * ratio, amp * pAmp * 0.45, 5, 0.5);
        }
      }
      break;
    }
    case 'horn': {
      const tones: readonly (readonly [number, number])[] = [[370, 0.5], [466.16, 0.42]];
      for (const [f, amp] of tones) {
        addTone(chans, sr, 0, total, f, amp, 'saw', 0.02, 0.12, 0.45);
        addTone(chans, sr, 0, total, f * 1.004, amp * 0.55, 'square', 0.02, 0.12, 0.55);
      }
      break;
    }
    case 'siren': {
      const [L, R] = chans;
      let phase = 0;
      for (let i = 0; i < total; i++) {
        const t = i / sr;
        const f = 650 + 260 * Math.sin((TAU * t) / 0.75);
        phase += f / sr;
        const edge = Math.max(0, Math.min(1, t / 0.05, (seconds - t) / 0.05));
        const s = Math.sin(TAU * phase) * 0.55 * edge;
        L[i] += s * 0.9;
        R[i] += s;
      }
      break;
    }
    case 'airHorn': {
      const tones: readonly (readonly [number, number])[] = [
        [233.08, 0.5],
        [231.5, 0.42],
        [235.2, 0.4],
        [466.16, 0.18],
      ];
      for (const [f, amp] of tones) {
        addTone(chans, sr, 0, total, f, amp, 'saw', 0.03, 0.15, 0.5);
      }
      addTone(chans, sr, 0, total, 116.54, 0.3, 'sine', 0.03, 0.15, 0.5);
      break;
    }
    case 'digitalChime': {
      const notes: readonly (readonly [number, number])[] = [[0, 1318.51], [0.16, 1046.5]];
      for (const [startSec, f] of notes) {
        const start = Math.round(startSec * sr);
        let pc = 0;
        let pm = 0;
        for (let i = start; i < total; i++) {
          const t = (i - start) / sr;
          pc += f / sr;
          pm += (f * 2.01) / sr;
          const s =
            Math.sin(TAU * pc + 2.2 * Math.exp(-t * 9) * Math.sin(TAU * pm)) *
            Math.exp(-t * 6) *
            0.5;
          chans[0][i] += s * 0.9;
          chans[1][i] += s;
        }
      }
      break;
    }
    case 'evChime': {
      const notes: readonly (readonly [number, number, number])[] = [
        [0, 1046.5, 0.7],
        [0.14, 1318.5, 0.6],
      ];
      for (const [startSec, f, amp] of notes) {
        const start = Math.round(startSec * sr);
        addDecayedTone(chans, sr, start, total - start, f, amp, 4, 0.5);
        addDecayedTone(chans, sr, start, total - start, f * 2, amp * 0.15, 6, 0.35);
      }
      break;
    }
  }

  return buf;
}

function renderEvents(ctx: BaseAudioContext, data: SfxEraData, rng: Rng): AudioBuffer[] {
  return data.events.kinds.map((kind) => {
    const buf = renderEventOneShot(ctx, kind, rng);
    scaleBuffer(buf, data.events.level);
    guardPeak(buf, PEAK_GUARD);
    return buf;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesize every audio buffer for one era from its {@link SfxEraData}
 * parameters. Deterministic per era id.
 */
export function generateEraAudioBuffers(ctx: BaseAudioContext, data: SfxEraData): EraAudioBuffers {
  const seed = hashString(`city-era:${data.id}`);
  return {
    ambient: renderAmbient(ctx, data, mulberry32(seed ^ 0x9e3779b9)),
    traffic: renderTraffic(ctx, data, mulberry32(seed ^ 0x85ebca6b)),
    events: renderEvents(ctx, data, mulberry32(seed ^ 0xc2b2ae35)),
    music: renderMusic(ctx, data, mulberry32(seed ^ 0x27d4eb2f)),
  };
}

/** Synthesize buffers for every registered era, keyed by EraId. */
export function generateAllEraBuffers(ctx: BaseAudioContext): Record<EraId, EraAudioBuffers> {
  const out = {} as Record<EraId, EraAudioBuffers>;
  for (const id of ERA_IDS) {
    out[id] = generateEraAudioBuffers(ctx, SFX_ERA_DATA[id]);
  }
  return out;
}
