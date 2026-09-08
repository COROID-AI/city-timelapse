/**
 * Per-era ambient audio layer definitions.
 *
 * Each era profile from the shared era registry is mapped onto a set of Web
 * Audio oscillator layers (beds + accents). The mapping is data-driven from
 * `SfxProfile` so the audio module stays a pure consumer of the era domain.
 */

import type { SfxProfile } from '../eras/types';

/** Oscillator waveform families used across the era soundbeds. */
export type OscillatorShape =
  | 'sine'
  | 'triangle'
  | 'sawtooth'
  | 'square';

/** A single oscillator layer contributing to an era's ambience. */
export interface OscillatorLayer {
  /** Human-readable role, e.g. `'traffic-bed'`. */
  id: string;
  /** Waveform family for the oscillator. */
  shape: OscillatorShape;
  /** Base frequency in Hertz. */
  frequency: number;
  /** Detune in cents (period-specific shimmer / vintage wobble). */
  detune: number;
  /** Gain (0..1) applied through the shared master gain. */
  gain: number;
}

/**
 * The complete per-era ambient profile: an ordered list of oscillator layers
 * plus the master ambience level that scales them all.
 */
export interface EraAmbientProfile {
  /** Canonical era year, e.g. `1945`. */
  year: number;
  /** Soundbank id from the era registry (e.g. `'sfx-1945'`). */
  soundbankId: string;
  /** Master ambience gain (0..1) from the era registry. */
  ambienceLevel: number;
  /** The oscillator layers that make up this era's soundbed. */
  layers: OscillatorLayer[];
}

/**
 * Build the ambient profile for one era from its shared `SfxProfile`.
 *
 * The oscillator set is derived deterministically from the era's SFX fields so
 * each of the five eras renders a distinct profile:
 * - `traffic` / `engineNoise` drive a low traffic-bed oscillator.
 * - `electricalHum` / `digitalLevel` drive a high electrical/digital hum.
 * - `wind` drives a drifting air bed.
 * - `dayChime` / `glassHum` / `reelTape` add period accents (chime, glass
 *   resonance, tape wobble).
 */
export function buildEraAmbientProfile(
  year: number,
  sfx: SfxProfile,
): EraAmbientProfile {
  const layers: OscillatorLayer[] = [];

  // Traffic bed: low rumble whose level tracks the era's traffic density.
  if (sfx.traffic > 0) {
    layers.push({
      id: 'traffic-bed',
      shape: 'sawtooth',
      frequency: 55 + sfx.traffic * 30,
      detune: 6,
      gain: sfx.traffic * 0.5,
    });
  }

  // Engine / motor layer: heavier in engine-dominant eras (1945/1965).
  if (sfx.engineNoise > 0) {
    layers.push({
      id: 'engine-motor',
      shape: 'triangle',
      frequency: 90 + sfx.engineNoise * 60,
      detune: -4,
      gain: sfx.engineNoise * 0.45,
    });
  }

  // Electrical / mains hum: rises toward the modern digital eras.
  if (sfx.electricalHum > 0) {
    layers.push({
      id: 'electrical-hum',
      shape: 'sine',
      frequency: 120 + sfx.electricalHum * 140,
      detune: 0,
      gain: sfx.electricalHum * 0.4,
    });
  }

  // Wind / air movement bed.
  if (sfx.wind > 0) {
    layers.push({
      id: 'wind-bed',
      shape: 'sine',
      frequency: 220 + sfx.wind * 80,
      detune: 12,
      gain: sfx.wind * 0.18,
    });
  }

  // Day chime: a retro clock / harmonic accent (strongest in early eras).
  if (sfx.dayChime > 0) {
    layers.push({
      id: 'day-chime',
      shape: 'triangle',
      frequency: 440 + sfx.dayChime * 220,
      detune: 2,
      gain: sfx.dayChime * 0.12,
    });
  }

  // Glass resonance: modern glass/panelling hum (rises toward 2025).
  if (sfx.glassHum > 0) {
    layers.push({
      id: 'glass-hum',
      shape: 'sine',
      frequency: 660 + sfx.glassHum * 340,
      detune: 5,
      gain: sfx.glassHum * 0.2,
    });
  }

  // Reel / tape wobble: vintage analogue texture strongest in the digital era.
  if (sfx.reelTape > 0) {
    layers.push({
      id: 'reel-tape',
      shape: 'square',
      frequency: 55 + sfx.reelTape * 40,
      detune: 18,
      gain: sfx.reelTape * 0.08,
    });
  }

  return {
    year,
    soundbankId: sfx.id,
    ambienceLevel: sfx.ambienceLevel,
    layers,
  };
}
