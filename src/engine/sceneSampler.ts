import type {
  EraData,
  BuildingLot,
  BuildingEraProps,
  SkyEra,
  GroundEra,
  VehicleDef,
  PedestrianDef,
  SignageDef,
  StreetPropEra,
  AmbientAudioDef,
  RGB,
} from '../types';
import { ERAS } from '../data/eras';
import {
  resolveEra,
  lerp,
  lerpColorGamma,
  lerpVec3,
  slerpVec3,
  smooth,
  activeEras,
  ERA_COUNT,
} from './eraSampler';

// ---------------------------------------------------------------------------
// Continuous samplers — given eraFloat, produce the interpolated visual state.
// These are pure functions of eraFloat (+ the data tables). Components call
// them inside useFrame to update materials/transforms without React re-renders.
// ---------------------------------------------------------------------------

export function sampleSky(eraFloat: number, eras: EraData[] = ERAS): SkyEra {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = eras[lower].sky;
  const b = eras[upper].sky;
  return {
    topColor: lerpColorGamma(a.topColor, b.topColor, t),
    horizonColor: lerpColorGamma(a.horizonColor, b.horizonColor, t),
    fogColor: lerpColorGamma(a.fogColor, b.fogColor, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    sunPosition: slerpVec3(a.sunPosition, b.sunPosition, t),
    sunColor: lerpColorGamma(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    ambientColor: lerpColorGamma(a.ambientColor, b.ambientColor, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    hemiSkyColor: lerpColorGamma(a.hemiSkyColor, b.hemiSkyColor, t),
    hemiGroundColor: lerpColorGamma(a.hemiGroundColor, b.hemiGroundColor, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    starIntensity: lerp(a.starIntensity, b.starIntensity, t),
    cloudiness: lerp(a.cloudiness, b.cloudiness, t),
    exposure: lerp(a.exposure, b.exposure, t),
  };
}

export function sampleGround(eraFloat: number, eras: EraData[] = ERAS): GroundEra {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = eras[lower].ground;
  const b = eras[upper].ground;
  return {
    roadColor: lerpColorGamma(a.roadColor, b.roadColor, t),
    sidewalkColor: lerpColorGamma(a.sidewalkColor, b.sidewalkColor, t),
    grassColor: lerpColorGamma(a.grassColor, b.grassColor, t),
    wetness: lerp(a.wetness, b.wetness, t),
  };
}

export function sampleBuilding(
  eraFloat: number,
  lot: BuildingLot,
): BuildingEraProps & { height: number } {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = lot.eras[lower];
  const b = lot.eras[upper];
  return {
    height: lerp(a.height, b.height, smooth(t)),
    facadeColor: lerpColorGamma(a.facadeColor, b.facadeColor, t),
    roofColor: lerpColorGamma(a.roofColor, b.roofColor, t),
    windowColor: lerpColorGamma(a.windowColor, b.windowColor, t),
    windowEmissive: lerpColorGamma(a.windowEmissive, b.windowEmissive, t),
    windowDensity: lerp(a.windowDensity, b.windowDensity, t),
    windowGlow: lerp(a.windowGlow, b.windowGlow, t),
    style: t < 0.5 ? a.style : b.style,
    hasAntenna: t < 0.5 ? a.hasAntenna : b.hasAntenna,
    hasBillboard: t < 0.5 ? a.hasBillboard : b.hasBillboard,
  };
}

export function sampleStreetProp(
  eraFloat: number,
  eras: EraData[] = ERAS,
): StreetPropEra {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = eras[lower].streetProp;
  const b = eras[upper].streetProp;
  return {
    lampColor: lerpColorGamma(a.lampColor, b.lampColor, t),
    lampIntensity: lerp(a.lampIntensity, b.lampIntensity, t),
    lampStyle: t < 0.5 ? a.lampStyle : b.lampStyle,
    benchColor: lerpColorGamma(a.benchColor, b.benchColor, t),
    treeFoliage: lerpColorGamma(a.treeFoliage, b.treeFoliage, t),
    treeDensity: lerp(a.treeDensity, b.treeDensity, t),
  };
}

export function sampleAmbient(
  eraFloat: number,
  eras: EraData[] = ERAS,
): AmbientAudioDef {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = eras[lower].ambient;
  const b = eras[upper].ambient;
  return {
    drone: a.drone.map((v, i) => lerp(v, b.drone[i] ?? v, t)),
    rumble: lerp(a.rumble, b.rumble, t),
    transient: lerp(a.transient, b.transient, t),
    gain: lerp(a.gain, b.gain, t),
  };
}

// ---------------------------------------------------------------------------
// Crossfaded-content helpers — for discrete items (vehicles/peds/signs) we
// return both the definition and its opacity weight so components can render
// the two bracketing eras and crossfade them.
// ---------------------------------------------------------------------------

export type CrossfadedItem<T> = { eraIndex: number; opacity: number; items: T[] };

export function crossfadedVehicles(
  eraFloat: number,
  eras: EraData[] = ERAS,
): CrossfadedItem<VehicleDef>[] {
  return activeEras(eraFloat).map(({ index, opacity }) => ({
    eraIndex: index,
    opacity,
    items: eras[index].vehicles,
  }));
}

export function crossfadedPedestrians(
  eraFloat: number,
  eras: EraData[] = ERAS,
): CrossfadedItem<PedestrianDef>[] {
  return activeEras(eraFloat).map(({ index, opacity }) => ({
    eraIndex: index,
    opacity,
    items: eras[index].pedestrians,
  }));
}

export function crossfadedSignage(
  eraFloat: number,
  eras: EraData[] = ERAS,
): CrossfadedItem<SignageDef>[] {
  return activeEras(eraFloat).map(({ index, opacity }) => ({
    eraIndex: index,
    opacity,
    items: eras[index].signage,
  }));
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export { ERA_COUNT };

/** Deterministic small PRNG so the scene looks identical every load. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export type { RGB };
export { lerp, lerpVec3 };
