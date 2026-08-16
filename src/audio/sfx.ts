// ── src/audio/sfx.ts ────────────────────────────────────────────────
// Procedural SFX buffer synthesis — zero external audio assets.
// Pure-function DSP + AudioContext.createBuffer surface.
// Chunked / lazy-capable: every generator accepts { sampleRate, duration }
// and returns Float32Array, so callers can batch or stream as needed.

import type { EraId, EraData } from '../eras.ts';

// ═══════════════════════════════════════════════════════════════════════
// Public interfaces
// ═══════════════════════════════════════════════════════════════════════

/** A single generated era sound set. */
export interface EraAudioBuffers {
  /** Continuous ambient bed (noise + drones). */
  ambient: Float32Array;
  /** Traffic / engine layer. */
  traffic: Float32Array;
  /** One-shot events (horns, bells, sirens, bleeps …). */
  events: Float32Array[];
}

/** All five eras keyed by EraId. */
export type AllEraBuffers = Record<EraId, EraAudioBuffers>;

// ═══════════════════════════════════════════════════════════════════════
// Pure DSP primitives  (no browser APIs — pure JS → Float32Array)
// ═══════════════════════════════════════════════════════════════════════

/** Fill `buf` with uniformly-distributed white noise. */
export function generateWhiteNoise(
  buf: Float32Array,
  seed: number = 0,
): void {
  for (let i = 0; i < buf.length; i++) {
    // LCG PRNG so results are deterministic per seed
    seed = (seed * 1664525 + 1013904223) | 0;
    buf[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
}

/** Apply a first-order low-pass filter in-place. */
export function applyLowPass(buf: Float32Array, cutoffRatio: number): void {
  if (cutoffRatio >= 1) return;
  const alpha = cutoffRatio; // 0 < alpha <= 1
  let prev = buf[0];
  for (let i = 1; i < buf.length; i++) {
    const v = buf[i];
    buf[i] = prev + alpha * (v - prev);
    prev = buf[i];
  }
}

/** Apply a first-order high-pass filter in-place. */
export function applyHighPass(buf: Float32Array, cutoffRatio: number): void {
  if (cutoffRatio >= 1) return;
  const hp = new Float32Array(buf.length);
  hp[0] = buf[0];
  for (let i = 1; i < buf.length; i++) {
    hp[i] = buf[i] - buf[i - 1] + cutoffRatio * hp[i - 1];
  }
  buf.set(hp);
}

/** Generate a sine-wave tone into `dst`. */
export function generateSineTone(
  dst: Float32Array,
  freqHz: number,
  sampleRate: number,
  amplitude: number = 1,
  phaseOffset: number = 0,
): void {
  const twoPi = Math.PI * 2;
  for (let i = 0; i < dst.length; i++) {
    dst[i] = amplitude * Math.sin(twoPi * freqHz * (i + phaseOffset) / sampleRate);
  }
}

/** Generate a sawtooth wave. */
export function generateSawtoothTone(
  dst: Float32Array,
  freqHz: number,
  sampleRate: number,
  amplitude: number = 1,
): void {
  const twoPi = Math.PI * 2;
  for (let i = 0; i < dst.length; i++) {
    const t = twoPi * freqHz * i / sampleRate;
    dst[i] = amplitude * (2 * (t / twoPi - Math.floor(0.5 + t / twoPi)));
  }
}

/** Band-limited pulse-width-modulated square wave. */
export function generatePulseTone(
  dst: Float32Array,
  freqHz: number,
  sampleRate: number,
  amplitude: number = 1,
  dutyCycle: number = 0.5,
): void {
  const twoPi = Math.PI * 2;
  for (let i = 0; i < dst.length; i++) {
    const t = (twoPi * freqHz * i / sampleRate) % twoPi;
    dst[i] = amplitude * (t < dutyCycle * twoPi ? 1 : -1);
  }
}

/** Convolve `src` with an impulse response `ir`, writing result into `out`. */
export function convolve(src: Float32Array, ir: Float32Array, out: Float32Array): void {
  const irLen = ir.length;
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < irLen && (i - j) >= 0; j++) {
      sum += src[i - j] * ir[j];
    }
    out[i] = sum;
  }
}

/** Simple comb-filter delay (for reverb-like texture). */
export function applyCombDelay(
  buf: Float32Array,
  delaySamples: number,
  feedback: number,
): void {
  const copy = new Float32Array(buf);
  for (let i = delaySamples; i < buf.length; i++) {
    buf[i] = copy[i] + feedback * buf[i - delaySamples];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Composite generators
// ═══════════════════════════════════════════════════════════════════════

/** Layered filtered noise bed — era-specific spectral character. */
export function generateFilteredNoiseBed(
  length: number,
  sampleRate: number,
  centerFreqHz: number,
  bandwidthFraction: number = 0.3,
  amplitude: number = 0.15,
): Float32Array {
  const buf = new Float32Array(length);
  generateWhiteNoise(buf, 42);

  const lpRatio = Math.min(centerFreqHz / (sampleRate / 2), 0.99);
  const hpRatio = Math.max((centerFreqHz * (1 - bandwidthFraction)) / (sampleRate / 2), 0.001);
  applyHighPass(buf, hpRatio);
  applyLowPass(buf, lpRatio);

  // Normalize & scale
  let peak = 0;
  for (let i = 0; i < length; i++) { if (Math.abs(buf[i]) > peak) peak = Math.abs(buf[i]); }
  if (peak > 0) {
    const scale = amplitude / peak;
    for (let i = 0; i < length; i++) buf[i] *= scale;
  }
  return buf;
}

/** Detuned tonal drone — multiple oscillators layered. */
export function generateDetunedDrone(
  length: number,
  sampleRate: number,
  baseFreqs: number[],
  detuneCents: number[] = [],
  amplitudes: number[] = [],
): Float32Array {
  const buf = new Float32Array(length);
  const n = baseFreqs.length;
  const amps = amplitudes.length === n ? amplitudes : Array(n).fill(1 / n);
  const dts = detuneCents.length === n ? detuneCents : Array(n).fill(0);

  for (let o = 0; o < n; o++) {
    const tmp = new Float32Array(length);
    // Use slight frequency offset for "detune" effect
    const detunedFreq = baseFreqs[o] * (1 + dts[o] / 1200);
    generateSineTone(tmp, detunedFreq, sampleRate, amps[o]);
    for (let i = 0; i < length; i++) buf[i] += tmp[i];
  }

  // Soft clip
  for (let i = 0; i < length; i++) {
    buf[i] = buf[i] > 0.8 ? 0.8 + 0.2 * Math.sign(buf[i]) * (1 - (1.25 - buf[i] * 1.25) ** 3) : buf[i];
  }
  return buf;
}

/** Engine profile — idle / rush / night based on traffic density. */
export function generateEngineProfile(
  length: number,
  sampleRate: number,
  idleRPM: number,
  harmonicSeries: number[],
  noiseMix: number,
  pitchWobble: number = 0.002,
): Float32Array {
  const buf = new Float32Array(length);

  // Tonal component — harmonics of fundamental engine RPM
  const fundFreq = idleRPM / 60;
  for (let h = 0; h < harmonicSeries.length; h++) {
    const tmp = new Float32Array(length);
    generateSawtoothTone(tmp, fundFreq * harmonicSeries[h], sampleRate, 0.15);
    for (let i = 0; i < length; i++) {
      const wobble = Math.sin(i * pitchWobble * (h + 1)) * 0.01;
      buf[i] += tmp[i] * (1 + wobble);
    }
  }

  // Noise component — mechanical rumble
  const noise = new Float32Array(length);
  generateWhiteNoise(noise, 137);
  applyLowPass(noise, Math.min(fundFreq * 4 / (sampleRate / 2), 0.9));
  for (let i = 0; i < length; i++) {
    buf[i] += noise[i] * noiseMix;
  }

  return buf;
}

/** Brass-like horn event (trumpet/trombone style). */
export function generateHorn(
  durationSec: number,
  sampleRate: number,
  fundamentalHz: number,
  attackMs: number = 30,
  releaseMs: number = 80,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Sawtooth harmonics → brass-like spectrum
  const harmonics = [1, 2, 3, 4, 5, 6];
  const weights = [1, 0.7, 0.5, 0.35, 0.2, 0.1];
  for (let h = 0; h < harmonics.length; h++) {
    const tmp = new Float32Array(len);
    generateSawtoothTone(tmp, fundamentalHz * harmonics[h], sampleRate, weights[h] * 0.12);
    for (let i = 0; i < len; i++) buf[i] += tmp[i];
  }

  // Vibrato
  for (let i = 0; i < len; i++) {
    const vib = 1 + 0.008 * Math.sin(i * 5.5 / sampleRate);
    buf[i] *= vib;
  }

  // ADSR envelope
  const atkSamples = Math.round(sampleRate * attackMs / 1000);
  const relSamples = Math.round(sampleRate * releaseMs / 1000);
  for (let i = 0; i < len; i++) {
    let env = 1;
    if (i < atkSamples) env = i / atkSamples;
    else if (i > len - relSamples) env = (len - i) / relSamples;
    buf[i] *= env;
  }

  return buf;
}

/** Metal bell / chime one-shot. */
export function generateBell(
  durationSec: number,
  sampleRate: number,
  strikeFreqHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Multiple inharmonic partials (bell characteristic)
  const partials = [1, 2.756, 4.078, 5.404, 7.86];
  const amps = [1, 0.5, 0.3, 0.15, 0.08];
  for (let p = 0; p < partials.length; p++) {
    const tmp = new Float32Array(len);
    generateSineTone(tmp, strikeFreqHz * partials[p], sampleRate, amps[p]);
    for (let i = 0; i < len; i++) buf[i] += tmp[i];
  }

  // Exponential decay
  const decayRate = 3 / durationSec;
  for (let i = 0; i < len; i++) {
    buf[i] *= Math.exp(-decayRate * i / sampleRate);
  }

  return buf;
}

/** Siren — alternating two-frequency wail. */
export function generateSiren(
  durationSec: number,
  sampleRate: number,
  lowHz: number,
  highHz: number,
  cycleDurationSec: number = 1.0,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const cyclePos = (t % cycleDurationSec) / cycleDurationSec;
    const freq = lowHz + (highHz - lowHz) * Math.sin(cyclePos * Math.PI);
    buf[i] = 0.3 * Math.sin(2 * Math.PI * freq * t);
  }

  // Envelope
  for (let i = 0; i < len; i++) {
    const env = Math.min(i / (sampleRate * 0.05), 1) * Math.min((len - i) / (sampleRate * 0.1), 1);
    buf[i] *= env;
  }

  return buf;
}

/** Arcade-style bleep — short frequency sweep. */
export function generateBleep(
  durationSec: number,
  sampleRate: number,
  startHz: number,
  endHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const frac = t / durationSec;
    const freq = startHz + (endHz - startHz) * frac;
    buf[i] = 0.4 * Math.sin(2 * Math.PI * freq * t);
  }

  return buf;
}

/** Notification ping — clean digital chirp. */
export function generatePing(
  durationSec: number,
  sampleRate: number,
  freqHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  generateSineTone(buf, freqHz, sampleRate, 0.5);

  // Fast attack + exponential decay
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    buf[i] *= Math.exp(-t * 12) * (1 + 0.3 * Math.sin(2 * Math.PI * freqHz * 3 * t));
  }

  return buf;
}

/** Pop beat — kick drum sample (half-sine burst). */
export function generateKickDrum(sampleRate: number): Float32Array {
  const len = Math.round(sampleRate * 0.15);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    buf[i] = 0.8 * Math.sin(2 * Math.PI * 60 * Math.exp(-t * 30) * t);
    buf[i] *= Math.exp(-t * 40);
  }
  return buf;
}

/** Hi-hat click. */
export function generateHiHat(sampleRate: number): Float32Array {
  const len = Math.round(sampleRate * 0.04);
  const buf = new Float32Array(len);
  generateWhiteNoise(buf, 99);
  applyHighPass(buf, 0.6);
  const peak = Math.max(...Array.from(buf).map(Math.abs));
  if (peak > 0) for (let i = 0; i < len; i++) buf[i] /= peak * 2.5;
  for (let i = 0; i < len; i++) buf[i] *= Math.exp(-i / (sampleRate * 0.008));
  return buf;
}

/** Ringtone chirp — two-tone sequence. */
export function generateRingtoneChirp(sampleRate: number): Float32Array {
  const dur = 0.15;
  const len = Math.round(sampleRate * dur);
  const buf = new Float32Array(len);
  const half = Math.round(len / 2);
  for (let i = 0; i < half; i++) {
    buf[i] = 0.3 * Math.sin(2 * Math.PI * 880 * i / sampleRate);
  }
  for (let i = half; i < len; i++) {
    buf[i] = 0.3 * Math.sin(2 * Math.PI * 1108 * i / sampleRate);
  }
  // Envelope
  for (let i = 0; i < len; i++) {
    buf[i] *= (i < half ? i / (sampleRate * 0.01) : 1) *
              (i > len - sampleRate * 0.02 ? (len - i) / (sampleRate * 0.02) : 1);
  }
  return buf;
}

/** EV whine — smooth rising/falling electric motor tone. */
export function generateEVWhine(
  durationSec: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const frac = (Math.sin(t * 0.5) + 1) / 2; // slow oscillation
    const freq = minHz + (maxHz - minHz) * frac;
    buf[i] = 0.15 * Math.sin(2 * Math.PI * freq * t);
  }
  return buf;
}

/** Wind noise — broad bandpass filtered noise. */
export function generateWind(
  durationSec: number,
  sampleRate: number,
  centerFreqHz: number = 400,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  generateWhiteNoise(buf, 256);
  applyLowPass(buf, Math.min(centerFreqHz * 1.5 / (sampleRate / 2), 0.95));
  applyHighPass(buf, Math.max(centerFreqHz * 0.3 / (sampleRate / 2), 0.005));
  // Slow amplitude modulation
  for (let i = 0; i < len; i++) {
    buf[i] *= 0.5 + 0.5 * Math.sin(i * 0.003 / sampleRate);
  }
  return buf;
}

/** Synth arpeggio pattern — repeated short note sequence. */
export function generateSynthArpeggio(
  durationSec: number,
  sampleRate: number,
  rootHz: number,
  intervals: number[] = [1, 1.25, 1.5, 2, 2.5, 3], // major-scale ratios
  noteDurFraction: number = 0.15,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  const noteDur = Math.max(Math.round(sampleRate * noteDurFraction), 1);
  const numNotes = Math.floor(len / noteDur);

  for (let n = 0; n < numNotes; n++) {
    const idx = n % intervals.length;
    const freq = rootHz * intervals[idx];
    const offset = n * noteDur;
    const chunkLen = Math.min(noteDur, len - offset);
    if (chunkLen <= 0) break;

    // Square-ish synth lead
    for (let i = 0; i < chunkLen; i++) {
      const t = (offset + i) / sampleRate;
      const phase = 2 * Math.PI * freq * t;
      const pulse = (phase % (2 * Math.PI)) < Math.PI ? 1 : -1;
      const amp = 0.12 * Math.exp(-i / (noteDur * 0.6));
      buf[offset + i] += pulse * amp;
    }
  }

  // Add subtle sub-bass
  for (let i = 0; i < len; i++) {
    buf[i] += 0.08 * Math.sin(2 * Math.PI * rootHz * 0.5 * i / sampleRate);
  }

  return buf;
}

/** Jukebox doo-wop stab — piano-like chord hit. */
export function generateDooWopStab(
  durationSec: number,
  sampleRate: number,
  chordRootHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Major triad: root, third, fifth
  const ratios = [1, 1.2599, 1.4983];
  for (const r of ratios) {
    const freq = chordRootHz * r;
    const tmp = new Float32Array(len);
    generateSineTone(tmp, freq, sampleRate, 0.25);
    for (let i = 0; i < len; i++) buf[i] += tmp[i];
  }

  // Percussive envelope (fast attack, medium decay)
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.min(t / 0.005, 1) * Math.exp(-t * 6);
    buf[i] *= env;
  }

  return buf;
}

/** Big-band horn stab — muted brass chord. */
export function generateBigBandHorn(
  durationSec: number,
  sampleRate: number,
  rootHz: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Minor-ish chord with muted character
  const ratios = [1, 1.189, 1.414, 1.682];
  for (const r of ratios) {
    const tmp = new Float32Array(len);
    generateSawtoothTone(tmp, rootHz * r, sampleRate, 0.06);
    // Low-pass for "muted" quality
    for (let i = 0; i < len; i++) {
      // Simple moving-average smoothing
      const localSum = tmp[Math.max(0, i - 3)] + tmp[i] + tmp[Math.min(len - 1, i + 3)];
      buf[i] += localSum / 5;
    }
  }

  // Envelope
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.min(t / 0.02, 1) * Math.exp(-t * 3);
    buf[i] *= env;
  }

  return buf;
}

/** Coal hiss — broadband crackle noise. */
export function generateCoalHiss(durationSec: number, sampleRate: number): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  generateWhiteNoise(buf, 777);
  applyHighPass(buf, 0.3);
  applyLowPass(buf, 0.7);
  // Crackly amplitude modulation
  for (let i = 0; i < len; i++) {
    const crackle = Math.random() < 0.02 ? 2 : 1; // sparse spikes
    buf[i] *= crackle * 0.08;
  }
  return buf;
}

/** Boombox bass drop — deep sub-bass pulse. */
export function generateBoomboxBass(
  durationSec: number,
  sampleRate: number,
  rootHz: number = 55,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Sub bass sine
  generateSineTone(buf, rootHz, sampleRate, 0.4);
  // Octave up for presence
  const tmp = new Float32Array(len);
  generateSineTone(tmp, rootHz * 2, sampleRate, 0.15);
  for (let i = 0; i < len; i++) buf[i] += tmp[i];

  // Envelope — punchy attack, fast decay
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    buf[i] *= Math.exp(-t * 5) * Math.min(t * 200, 1);
  }

  return buf;
}

/** Train whistle — sustained high tone with vibrato. */
export function generateTrainWhistle(
  durationSec: number,
  sampleRate: number,
  freqHz: number = 1200,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  generateSineTone(buf, freqHz, sampleRate, 0.2);
  // Vibrato
  for (let i = 0; i < len; i++) {
    const vib = 1 + 0.015 * Math.sin(i * 6 / sampleRate);
    buf[i] *= vib;
  }
  // Envelope
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const env = Math.min(t / 0.1, 1) * (i < len - sampleRate * 0.3 ? 1 : (len - i) / (sampleRate * 0.3));
    buf[i] *= env;
  }
  return buf;
}

/** Radio static — AM-style noise burst. */
export function generateRadioStatic(durationSec: number, sampleRate: number): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);
  generateWhiteNoise(buf, 555);
  // AM modulation at broadcast band frequencies
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 500 * t);
    buf[i] *= mod * 0.1;
  }
  return buf;
}

// ═══════════════════════════════════════════════════════════════════════
// Era-specific composition
// ═══════════════════════════════════════════════════════════════════════

/** Generate the ambient bed for a specific era. */
function composeAmbient(
  data: EraData,
  sampleRate: number,
  durationSec: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // 1. Tonal drone from era ambient tones
  const drone = generateDetunedDrone(
    len,
    sampleRate,
    data.ambientTones,
    data.detuneCents ?? Array(data.ambientTones.length).fill(5),
    data.ambientAmplitudes ?? Array(data.ambientTones.length).fill(0.3),
  );
  for (let i = 0; i < len; i++) buf[i] += drone[i];

  // 2. Filtered noise bed for atmospheric texture
  const noiseBed = generateFilteredNoiseBed(
    len,
    sampleRate,
    data.noiseCenterHz ?? 200,
    data.noiseBandwidth ?? 0.25,
    data.noiseAmplitude ?? 0.08,
  );
  for (let i = 0; i < len; i++) buf[i] += noiseBed[i];

  // 3. Secondary wind/atmospheric layer for later eras
  if (data.windLayer) {
    const wind = generateWind(durationSec, sampleRate, data.windCenterHz ?? 400);
    for (let i = 0; i < len; i++) buf[i] += wind[i] * 0.3;
  }

  // Global fade-in to avoid clicks
  for (let i = 0; i < len; i++) {
    const fadeIn = Math.min(i / (sampleRate * 0.1), 1);
    buf[i] *= fadeIn;
  }

  return buf;
}

/** Generate the traffic/engine layer for a specific era. */
function composeTraffic(
  data: EraData,
  sampleRate: number,
  durationSec: number,
): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const buf = new Float32Array(len);

  // Primary engine profile
  const engine = generateEngineProfile(
    len,
    sampleRate,
    data.engineIdleRPM ?? 600,
    data.engineHarmonics ?? [1, 2, 3, 4],
    data.engineNoiseMix ?? 0.3,
  );
  for (let i = 0; i < len; i++) buf[i] += engine[i];

  // Era-specific secondary engine sounds
  if (data.extraEngineSound === 'ev_whine') {
    const ev = generateEVWhine(durationSec, sampleRate, data.evMinHz ?? 80, data.evMaxHz ?? 300);
    for (let i = 0; i < len; i++) buf[i] += ev[i];
  }

  return buf;
}

/** Compose all one-shot events for a given era. */
function composeEvents(
  data: EraData,
  sampleRate: number,
): Float32Array[] {
  const events: Float32Array[] = [];

  for (const evt of data.events) {
    switch (evt.type) {
      case 'horn': {
        const dur = evt.durationSec ?? 1.5;
        events.push(generateHorn(dur, sampleRate, evt.freqHz ?? 440, evt.attackMs, evt.releaseMs));
        break;
      }
      case 'bell': {
        const dur = evt.durationSec ?? 2;
        events.push(generateBell(dur, sampleRate, evt.freqHz ?? 1800));
        break;
      }
      case 'siren': {
        const dur = evt.durationSec ?? 3;
        events.push(generateSiren(dur, sampleRate, evt.lowHz ?? 600, evt.highHz ?? 1200, evt.cycleSec));
        break;
      }
      case 'bleep': {
        const dur = evt.durationSec ?? 0.08;
        events.push(generateBleep(dur, sampleRate, evt.startHz ?? 800, evt.endHz ?? 1600));
        break;
      }
      case 'ping': {
        const dur = evt.durationSec ?? 0.2;
        events.push(generatePing(dur, sampleRate, evt.freqHz ?? 1200));
        break;
      }
      case 'kick':
        events.push(generateKickDrum(sampleRate));
        break;
      case 'hihat':
        events.push(generateHiHat(sampleRate));
        break;
      case 'ringtone_chirp':
        events.push(generateRingtoneChirp(sampleRate));
        break;
      case 'doo_wop_stab':
        events.push(generateDooWopStab(evt.durationSec ?? 0.5, sampleRate, evt.freqHz ?? 220));
        break;
      case 'big_band_horn':
        events.push(generateBigBandHorn(evt.durationSec ?? 1.0, sampleRate, evt.freqHz ?? 260));
        break;
      case 'coal_hiss':
        events.push(generateCoalHiss(evt.durationSec ?? 2, sampleRate));
        break;
      case 'boombox_bass':
        events.push(generateBoomboxBass(evt.durationSec ?? 0.4, sampleRate, evt.freqHz ?? 55));
        break;
      case 'train_whistle':
        events.push(generateTrainWhistle(evt.durationSec ?? 1.5, sampleRate, evt.freqHz ?? 1200));
        break;
      case 'radio_static':
        events.push(generateRadioStatic(evt.durationSec ?? 1, sampleRate));
        break;
      case 'synth_arpeggio':
        events.push(generateSynthArpeggio(evt.durationSec ?? 2, sampleRate, evt.freqHz ?? 220, evt.intervals, evt.noteDurFrac));
        break;
      default: {
        // Fallback: simple tone
        const fallbackLen = Math.round(sampleRate * (evt.durationSec ?? 0.5));
        const fallback = new Float32Array(fallbackLen);
        generateSineTone(fallback, evt.freqHz ?? 440, sampleRate, 0.3);
        events.push(fallback);
        break;
      }
    }
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

/** Default duration in seconds for generated buffers. */
const DEFAULT_DURATION_SEC = 6;

/**
 * Generate all audio buffers for a single era from its configuration data.
 *
 * @param ctx   Optional AudioContext used to wrap Float32Arrays into AudioBuffers.
 *               When omitted (e.g., Node.js shim), raw Float32Arrays are returned.
 * @param data  The era's SFX configuration (from SFX_ERA_DATA).
 * @returns EraAudioBuffers with typed arrays matching the era's sonic signature.
 */
export function generateEraAudioBuffers(
  data: EraData,
  sampleRate: number = 44100,
  durationSec: number = DEFAULT_DURATION_SEC,
): EraAudioBuffers {
  return {
    ambient: composeAmbient(data, sampleRate, durationSec),
    traffic: composeTraffic(data, sampleRate, durationSec),
    events: composeEvents(data, sampleRate),
  };
}

/**
 * Generate era audio buffers for ALL configured eras.
 *
 * Returns a plain Record<EraId, EraAudioBuffers> suitable for caching
 * in the mixer's state. Each era's buffers are independently synthesized
 * and thus measurably distinct in RMS, spectral content, and event palette.
 *
 * @param sampleRate Output sample rate (default 44100 Hz).
 * @param durationSec Duration of continuous beds (default 6 s).
 */
export function generateAllEraBuffers(
  sampleRate: number = 44100,
  durationSec: number = DEFAULT_DURATION_SEC,
): AllEraBuffers {
  const result = {} as AllEraBuffers;
  for (const id of ERA_IDS) {
    result[id] = generateEraAudioBuffers(SFX_ERA_DATA[id], sampleRate, durationSec);
  }
  return result;
}

// Re-export the constants the public API depends on
import { ERA_IDS, SFX_ERA_DATA } from '../eras.ts';
