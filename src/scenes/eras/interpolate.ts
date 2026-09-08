import { EraData, Rgb } from './types';
import { getEra, getEraYears } from './data';

/**
 * Canonical typed interpolation engine for the era domain.
 *
 * `interpolateEra(from, to, t)` blends every numeric aspect value linearly so
 * that downstream scene subsystems can transform the block continuously across
 * the timeline. Discrete (string/array) aspects are resolved deterministically:
 * at t === 0 they come from `from`, at t === 1 from `to`, and in between they
 * follow the `from` era up to the midpoint and then the `to` era (clamped to
 * the endpoint on the interior). This keeps results fully typed (`EraData`,
 * no `any`) and deterministic for the same `(from, to, t)` triple.
 */

const clampT = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

const lerp = (a: number, b: number, t: number): number =>
  t <= 0 ? a : t >= 1 ? b : a + (b - a) * t;

const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(lerp(a.r, b.r, t)),
  g: Math.round(lerp(a.g, b.g, t)),
  b: Math.round(lerp(a.b, b.b, t)),
});

/** Nearest endpoint selection for discrete values on the interpolated timeline. */
function discrete<T>(from: T, to: T, t: number): T {
  return t < 0.5 ? from : to;
}

/**
 * Interpolate two complete era profiles.
 * @param from the era at t = 0
 * @param to   the era at t = 1
 * @param t    progress in [0, 1]
 */
export function interpolateEra(from: EraData, to: EraData, t: number): EraData {
  const tC = clampT(t);

  return {
    year: Math.round(lerp(from.year, to.year, tC)),
    architecture: {
      styleId: discrete(from.architecture.styleId, to.architecture.styleId, tC),
      facadePalette: pickPalette(
        from.architecture.facadePalette,
        to.architecture.facadePalette,
        tC,
      ),
      roofStyle: discrete(from.architecture.roofStyle, to.architecture.roofStyle, tC),
      minHeightM: lerp(from.architecture.minHeightM, to.architecture.minHeightM, tC),
      maxHeightM: lerp(from.architecture.maxHeightM, to.architecture.maxHeightM, tC),
      blockDensity: lerp(from.architecture.blockDensity, to.architecture.blockDensity, tC),
      windowChance: lerp(from.architecture.windowChance, to.architecture.windowChance, tC),
      glassRatio: lerp(from.architecture.glassRatio, to.architecture.glassRatio, tC),
      roofLighting: lerp(from.architecture.roofLighting, to.architecture.roofLighting, tC),
      masonry: lerp(from.architecture.masonry, to.architecture.masonry, tC),
      setbackStyle: discrete(
        from.architecture.setbackStyle,
        to.architecture.setbackStyle,
        tC,
      ),
    },
    vehicles: {
      fleet: discrete(from.vehicles.fleet, to.vehicles.fleet, tC),
      trafficDensity: lerp(from.vehicles.trafficDensity, to.vehicles.trafficDensity, tC),
      electricRatio: lerp(from.vehicles.electricRatio, to.vehicles.electricRatio, tC),
      bodyGloss: lerp(from.vehicles.bodyGloss, to.vehicles.bodyGloss, tC),
      chrome: lerp(from.vehicles.chrome, to.vehicles.chrome, tC),
      headlightCool: lerp(from.vehicles.headlightCool, to.vehicles.headlightCool, tC),
      engineNoise: lerp(from.vehicles.engineNoise, to.vehicles.engineNoise, tC),
      hornLevel: lerp(from.vehicles.hornLevel, to.vehicles.hornLevel, tC),
    },
    storefronts: {
      styleId: discrete(from.storefronts.styleId, to.storefronts.styleId, tC),
      awning: discrete(from.storefronts.awning, to.storefronts.awning, tC),
      signageLighting: lerp(from.storefronts.signageLighting, to.storefronts.signageLighting, tC),
      glassFront: lerp(from.storefronts.glassFront, to.storefronts.glassFront, tC),
      doorClosure: discrete(
        from.storefronts.doorClosure,
        to.storefronts.doorClosure,
        tC,
      ),
      neonLevel: lerp(from.storefronts.neonLevel, to.storefronts.neonLevel, tC),
      windowDressing: lerp(
        from.storefronts.windowDressing,
        to.storefronts.windowDressing,
        tC,
      ),
    },
    advertisements: {
      medium: discrete(from.advertisements.medium, to.advertisements.medium, tC),
      count: Math.round(lerp(from.advertisements.count, to.advertisements.count, tC)),
      intensity: lerp(from.advertisements.intensity, to.advertisements.intensity, tC),
      neonToLed: lerp(from.advertisements.neonToLed, to.advertisements.neonToLed, tC),
      posterSaturation: lerp(
        from.advertisements.posterSaturation,
        to.advertisements.posterSaturation,
        tC,
      ),
      animatedRatio: lerp(
        from.advertisements.animatedRatio,
        to.advertisements.animatedRatio,
        tC,
      ),
      panelPalette: pickStrings(
        from.advertisements.panelPalette,
        to.advertisements.panelPalette,
        tC,
      ),
    },
    pedestrians: {
      styleId: discrete(from.pedestrians.styleId, to.pedestrians.styleId, tC),
      variety: lerp(from.pedestrians.variety, to.pedestrians.variety, tC),
      colorfulness: lerp(from.pedestrians.colorfulness, to.pedestrians.colorfulness, tC),
      hatLevel: lerp(from.pedestrians.hatLevel, to.pedestrians.hatLevel, tC),
      formality: lerp(from.pedestrians.formality, to.pedestrians.formality, tC),
      materialShine: lerp(from.pedestrians.materialShine, to.pedestrians.materialShine, tC),
      palette: pickStrings(from.pedestrians.palette, to.pedestrians.palette, tC),
    },
    atmosphere: {
      profileId: discrete(from.atmosphere.profileId, to.atmosphere.profileId, tC),
      skyTint: lerpRgb(from.atmosphere.skyTint, to.atmosphere.skyTint, tC),
      sunGlow: lerp(from.atmosphere.sunGlow, to.atmosphere.sunGlow, tC),
      lightWarmth: lerp(from.atmosphere.lightWarmth, to.atmosphere.lightWarmth, tC),
      skyExposure: lerp(from.atmosphere.skyExposure, to.atmosphere.skyExposure, tC),
      haze: lerp(from.atmosphere.haze, to.atmosphere.haze, tC),
      dust: lerp(from.atmosphere.dust, to.atmosphere.dust, tC),
      contrast: lerp(from.atmosphere.contrast, to.atmosphere.contrast, tC),
      saturation: lerp(from.atmosphere.saturation, to.atmosphere.saturation, tC),
      shadowSoftness: lerp(
        from.atmosphere.shadowSoftness,
        to.atmosphere.shadowSoftness,
        tC,
      ),
    },
    sfx: {
      id: discrete(from.sfx.id, to.sfx.id, tC),
      ambient: discrete(from.sfx.ambient, to.sfx.ambient, tC),
      ambienceLevel: lerp(from.sfx.ambienceLevel, to.sfx.ambienceLevel, tC),
      traffic: lerp(from.sfx.traffic, to.sfx.traffic, tC),
      engineNoise: lerp(from.sfx.engineNoise, to.sfx.engineNoise, tC),
      electricalHum: lerp(from.sfx.electricalHum, to.sfx.electricalHum, tC),
      wind: lerp(from.sfx.wind, to.sfx.wind, tC),
      birds: lerp(from.sfx.birds, to.sfx.birds, tC),
      dayChime: lerp(from.sfx.dayChime, to.sfx.dayChime, tC),
      glassHum: lerp(from.sfx.glassHum, to.sfx.glassHum, tC),
      digitalLevel: lerp(from.sfx.digitalLevel, to.sfx.digitalLevel, tC),
      reelTape: lerp(from.sfx.reelTape, to.sfx.reelTape, tC),
    },
  };
}

/** Deterministic palette blend: pick from `from` below 0.5, else `to`. */
function pickStrings(from: string[], to: string[], t: number): string[] {
  return t < 0.5 ? from.slice() : to.slice();
}

/** Deterministic palette blend for facade palettes (same endpoint rule). */
function pickPalette(from: string[], to: string[], t: number): string[] {
  return pickStrings(from, to, t);
}

/**
 * Convenience wrapper that interpolates between two consecutive era years by
 * index. Given a year in the canonical registry, returns the interpolated
 * `EraData` at the requested `t` between that year and the next one.
 *
 * This preserves the reviewed typed `getInterpolatedEra(): EraData` contract
 * (no `any`) exposed to scene subsystems.
 *
 * @param year a registered era year (must be one of the five canonical years)
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