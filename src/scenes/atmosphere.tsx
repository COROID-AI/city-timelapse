/**
 * Per-era atmosphere, lighting & sky (1945 -> 2025).
 *
 * This scene subsystem renders the sky, sun angle, fog, ambient light and
 * street light for whatever era the city timelapse is currently in. It consumes
 * the shared era registry read-only and delegates all interpolation to the era
 * module's `interpolateEra` engine, so lighting and fog blend continuously
 * across era transitions.
 *
 * The shared `Atmosphere` data type already encodes the era-authentic profile
 * (sky tint, sun glow, light warmth, sky exposure, haze, dust, contrast,
 * saturation, shadow softness). This module derives the concrete render values
 * (sun elevation angle, street-light colour/level, ambient light) from that
 * shared data, keeping the era domain the single owner of era year lists and
 * interpolation.
 */

import {
  EraData,
  Rgb,
  getEra,
  getEraYears,
  interpolateEra,
} from './eras';

/** Clamp a value into [0, 1]. */
const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Linear blend between two numbers. */
const lerp = (a: number, b: number, t: number): number =>
  t <= 0 ? a : t >= 1 ? b : a + (b - a) * t;

/**
 * Thin typed wrapper that delegates to the shared interpolation engine.
 *
 * Preserves the reviewed `fc38c708` typing fix: the return type is the typed
 * `EraData` (never `any`), and all interpolation logic lives in the era module.
 *
 * @param year a registered era year (one of 1945/1965/1985/2005/2025)
 * @param t    progress in [0, 1] toward the next era
 */
export function getInterpolatedEra(year: number, t: number): EraData {
  const years = getEraYears();
  const idx = years.indexOf(year);
  if (idx === -1) {
    throw new Error(
      `Unknown era year ${year}; expected one of ${years.join(', ')}`,
    );
  }
  const from = getEra(year);
  const to = years[idx + 1] !== undefined ? getEra(years[idx + 1]) : from;
  return interpolateEra(from, to, t);
}

/**
 * Concrete render profile for the atmosphere at an instant of the timeline.
 * All values are derived from the shared, interpolated era data.
 */
export interface AtmosphereState {
  /** Canonical era atmosphere profile id (e.g. `'golden-age-haze'`). */
  profileId: string;
  /** Blend of sky tint across the era's endpoints (0..255 RGB). */
  skyTint: Rgb;
  /** Sun elevation angle in degrees (higher = brighter, higher sun). */
  sunAngleDeg: number;
  /** Atmospheric haze / pollution fog (0 clear .. 1 dense soot). */
  fog: number;
  /** Ambient daylight / sky exposure level (0..1). */
  ambientLight: number;
  /** Street-light colour, derived from light warmth (warm tungsten -> cool LED). */
  streetLight: Rgb;
  /** Street-light intensity (0 dark .. 1 fully lit). */
  streetLightLevel: number;
  /** Dust / particle shimmer (0..1). */
  dust: number;
  /** Global contrast (0..1). */
  contrast: number;
  /** Global colour saturation (0..1). */
  saturation: number;
  /** Shadow softness (0 hard .. 1 soft). */
  shadowSoftness: number;
}

/**
 * Map light warmth (higher = warmer tungsten, lower = cooler white/LED) to an
 * RGB street-light colour. Period-authentic: 1945 dim tungsten is warm orange;
 * 2005/2025 LED street lights are cool white.
 */
function warmthToRgb(warmth: number): Rgb {
  const t = clamp01(warmth);
  return {
    r: Math.round(lerp(235, 255, t)),
    g: Math.round(lerp(190, 240, t)),
    b: Math.round(lerp(255, 100, t)),
  };
}

/**
 * Derive the concrete render state for an instant of the timeline from the
 * shared interpolated era data.
 */
function deriveState(era: EraData): AtmosphereState {
  const a = era.atmosphere;
  return {
    profileId: a.profileId,
    skyTint: { r: a.skyTint.r, g: a.skyTint.g, b: a.skyTint.b },
    // Higher sun glow = a higher, brighter sun in the sky.
    sunAngleDeg: Math.round(15 + a.sunGlow * 70),
    fog: a.haze,
    ambientLight: a.skyExposure,
    streetLight: warmthToRgb(a.lightWarmth),
    // Warmer (older) light reads as dimmer; cooler modern light as brighter.
    streetLightLevel: clamp01(1 - a.lightWarmth),
    dust: a.dust,
    contrast: a.contrast,
    saturation: a.saturation,
    shadowSoftness: a.shadowSoftness,
  };
}

/**
 * Per-era atmosphere/lighting/sky renderer.
 *
 * Lifecycle: `instantiate` -> `attach` -> `update` (per frame / era) -> `dispose`.
 * `update` re-derives the render state from the shared interpolated era data, so
 * lighting and fog blend continuously during era transitions.
 */
export class Atmosphere {
  private state: AtmosphereState | null = null;

  /** Create the initial render state for a year (defaults to the era root). */
  instantiate(year: number, t = 0): this {
    this.state = deriveState(getInterpolatedEra(year, t));
    return this;
  }

  /** Attach to the scene. No-op for the data-driven renderer (idempotent). */
  attach(): this {
    return this;
  }

  /** Advance to an instant of the timeline, re-deriving light/fog/sky. */
  update(year: number, t = 0): this {
    this.state = deriveState(getInterpolatedEra(year, t));
    return this;
  }

  /** Release any held render state. */
  dispose(): void {
    this.state = null;
  }

  /** The current derived atmosphere render state. */
  get current(): AtmosphereState {
    if (this.state === null) {
      throw new Error('Atmosphere has not been instantiated');
    }
    return this.state;
  }
}