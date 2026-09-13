/**
 * Per-era atmosphere presets backed by the EraTheme palette.
 *
 * Every era gets a complete `AtmospherePreset` (sky gradient, fog color and
 * density, sun direction/color/intensity, ambient fill) derived from its
 * `EraPalette` tokens plus a small era-character table (air quality, daylight
 * mood, haze). The presets are applied **only** through SceneEngine's public
 * atmosphere hooks (`engine.setAtmosphere` / the constructor's atmosphere
 * option) — this module never touches engine internals.
 *
 * Pure data + pure functions, so presets can be unit-tested headlessly and
 * every era builds deterministically.
 */

import type { Color3, Vec3, AtmospherePreset } from '../../core/lighting';
import type { ColorHex, EraId } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';

/** All supported weather characters (matches the EraAtmosphere schema). */
export type PrecipitationKind = 'none' | 'drizzle' | 'rain' | 'snow';

/** Complete per-era atmosphere descriptor returned by the builder. */
export interface EraAtmosphereData {
  era: EraId;
  /** The engine-ready preset consumed by `SceneEngine.setAtmosphere`. */
  preset: AtmospherePreset;
  airQuality: string;
  daylightMood: string;
  haze: number;
  precipitation: PrecipitationKind;
}

/** Era-character table (structural atmosphere metadata). */
interface EraAtmosphereSpec {
  airQuality: string;
  daylightMood: string;
  haze: number;
  precipitation: PrecipitationKind;
  /** Ray direction toward the sun (not yet normalized; engine normalizes). */
  sunDirection: Vec3;
  fogDensity: number;
  /** How much the horizon is lifted toward white for daylight glare. */
  horizonMix: number;
  ambientIntensity: number;
}

const ERA_ATMOSPHERE_SPECS: Record<EraId, EraAtmosphereSpec> = {
  // Dusty wartime skies: low warm sun, mild haze, tired amber cast.
  1945: {
    airQuality: 'dusty-war-smog',
    daylightMood: 'soft-warm',
    haze: 0.35,
    precipitation: 'none',
    sunDirection: { x: -0.35, y: 0.42, z: -0.22 },
    fogDensity: 0.22,
    horizonMix: 0.34,
    ambientIntensity: 0.32,
  },
  // Optimistic pastel 1965: high bright sun in a clean mint sky.
  1965: {
    airQuality: 'clear-pastel',
    daylightMood: 'bright-clean',
    haze: 0.1,
    precipitation: 'none',
    sunDirection: { x: -0.25, y: 0.82, z: -0.14 },
    fogDensity: 0.08,
    horizonMix: 0.38,
    ambientIntensity: 0.4,
  },
  // Smoggy neon 1985: amber haze that eats the horizon, low dusty sun.
  1985: {
    airQuality: 'smog-heavy',
    daylightMood: 'harsh-smog',
    haze: 0.62,
    precipitation: 'drizzle',
    sunDirection: { x: -0.24, y: 0.52, z: -0.26 },
    fogDensity: 0.55,
    horizonMix: 0.5,
    ambientIntensity: 0.3,
  },
  // Crisp glass 2005: tall clean sun, barely any haze.
  2005: {
    airQuality: 'clear-sharp',
    daylightMood: 'crisp-blue',
    haze: 0.05,
    precipitation: 'none',
    sunDirection: { x: -0.18, y: 0.9, z: -0.12 },
    fogDensity: 0.04,
    horizonMix: 0.36,
    ambientIntensity: 0.42,
  },
  // Verdant EV era 2025: highest clean sun, greenhouse-fresh air.
  2025: {
    airQuality: 'fresh-verdant',
    daylightMood: 'bright-green',
    haze: 0.03,
    precipitation: 'none',
    sunDirection: { x: -0.12, y: 0.92, z: -0.1 },
    fogDensity: 0.03,
    horizonMix: 0.32,
    ambientIntensity: 0.46,
  },
};

/** Convert a `#rrggbb` token into an sRGB Color3 (components in [0,1]). */
export function hexToColor3(hex: ColorHex): Color3 {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function scale(color: Color3, factor: number): Color3 {
  return { r: color.r * factor, g: color.g * factor, b: color.b * factor };
}

/** Linear mix toward `target` by `amount` in [0,1]. */
function mix(color: Color3, target: Color3, amount: number): Color3 {
  const t = Math.min(1, Math.max(0, amount));
  return {
    r: color.r + (target.r - color.r) * t,
    g: color.g + (target.g - color.g) * t,
    b: color.b + (target.b - color.b) * t,
  };
}

/** Build the complete atmosphere preset for one era from its palette. */
export function buildAtmospherePreset(era: EraId): EraAtmosphereData {
  const palette = ERA_PALETTES[era];
  const spec = ERA_ATMOSPHERE_SPECS[era];
  const sky = hexToColor3(palette.sky);
  const fogColor = hexToColor3(palette.fog);
  const white: Color3 = { r: 1, g: 1, b: 1 };

  // Sky: slightly deepened zenith from the palette token, horizon lifted
  // toward white — except smog eras, where the horizon dissolves into the fog.
  let horizon: Color3;
  if (era === 1985) {
    horizon = mix(sky, fogColor, spec.horizonMix);
  } else {
    horizon = mix(sky, white, spec.horizonMix);
  }

  const preset: AtmospherePreset = {
    sky: {
      top: scale(sky, 0.84),
      horizon,
    },
    fog: {
      color: fogColor,
      density: spec.fogDensity,
    },
    sun: {
      direction: spec.sunDirection,
      color: hexToColor3(palette.sun.color),
      intensity: palette.sun.intensity,
    },
    ambient: {
      color: mix(sky, white, 0.45),
      intensity: spec.ambientIntensity,
    },
  };

  return {
    era,
    preset,
    airQuality: spec.airQuality,
    daylightMood: spec.daylightMood,
    haze: spec.haze,
    precipitation: spec.precipitation,
  };
}

/** Registry of every era preset (scene-integration consumes this directly). */
export const ERA_ATMOSPHERE_PRESETS: Record<EraId, EraAtmosphereData> = {
  1945: buildAtmospherePreset(1945),
  1965: buildAtmospherePreset(1965),
  1985: buildAtmospherePreset(1985),
  2005: buildAtmospherePreset(2005),
  2025: buildAtmospherePreset(2025),
};