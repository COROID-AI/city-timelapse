/**
 * Math + color interpolation utilities.
 *
 * The central idea: an `eraFloat` (a continuous value 0..N-1 across the era
 * table) is the single coordination point. We interpolate every numeric field
 * of an EraConfig between the two adjacent eras that `eraFloat` lies between,
 * using a smooth easing so non-adjacent jumps sweep through history.
 */

import * as THREE from "three";
import { ERA_COUNT, ERAS, type EraConfig } from "../data/eras";

/** Clamp v into [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolate. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing (cubic Hermite) on t in [0,1]. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Smootherstep (Ken Perlin) for an even creamier transition. */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Clamp delta time to avoid jumps after tab suspension. */
export function clampDelta(dt: number): number {
  // NaN is truly invalid -> no movement. Negative is invalid -> no movement.
  // Infinity / huge finite values represent a resumed tab -> clamp to max gap.
  if (Number.isNaN(dt) || dt < 0) return 0;
  return Math.min(dt, 0.1);
}

export interface EraSample {
  /** lower era index */
  i0: number;
  /** upper era index (wraps allowed but normally i0+1) */
  i1: number;
  /** fractional position 0..1 between them (already eased) */
  t: number;
}

/**
 * Decompose a floating era index into the two adjacent eras + eased fraction.
 * `eraFloat` outside [0, COUNT-1] is clamped (camera never escapes the era axis).
 */
export function sampleEra(eraFloat: number, eased = true): EraSample {
  const clamped = clamp(eraFloat, 0, ERA_COUNT - 1);
  const i0 = Math.floor(clamped);
  const i1 = Math.min(i0 + 1, ERA_COUNT - 1);
  const raw = clamped - i0;
  const t = eased ? smootherstep(raw) : raw;
  return { i0, i1, t };
}

export interface InterpolatedEra {
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  sun: number;
  ambient: number;
  sunColor: THREE.Color;
  sunAzimuth: number;
  sunElevation: number;
  windowGlow: number;
  buildingHue: number;
  buildingSat: number;
  buildingLight: number;
  heightFactor: number;
  windowDensity: number;
  windowColor: THREE.Color;
  skylineDensity: number;
  asphalt: THREE.Color;
  marking: THREE.Color;
  sidewalk: THREE.Color;
  wetness: number;
  grime: number;
  vehicleBody: THREE.Color;
  vehicleRoof: THREE.Color;
  vehicleDensity: number;
  vehicleScale: number;
  vehicleEmissive: THREE.Color;
  pedTorso: THREE.Color;
  pedLegs: THREE.Color;
  pedHair: THREE.Color;
  pedDensity: number;
  billboardEmissive: number;
  billboardDensity: number;
  lampColor: THREE.Color;
  lampIntensity: number;
  skyTraffic: number;
  i0: number;
  i1: number;
  t: number;
  /** the two adjacent raw era configs, for discrete-variant logic */
  eraA: EraConfig;
  eraB: EraConfig;
  /** raw (un-eased) fractional position */
  rawT: number;
}

function C(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function blendEra(
  a: EraConfig,
  b: EraConfig,
  t: number,
  i0: number,
  i1: number,
  rawT: number
): InterpolatedEra {
  return {
    skyTop: C(a.sky.top).lerp(C(b.sky.top), t),
    skyBottom: C(a.sky.bottom).lerp(C(b.sky.bottom), t),
    fog: C(a.sky.fog).lerp(C(b.sky.fog), t),
    sun: lerp(a.lighting.sun, b.lighting.sun, t),
    ambient: lerp(a.lighting.ambient, b.lighting.ambient, t),
    sunColor: C(a.lighting.sunColor).lerp(C(b.lighting.sunColor), t),
    sunAzimuth: lerp(a.lighting.sunAzimuth, b.lighting.sunAzimuth, t),
    sunElevation: lerp(a.lighting.sunElevation, b.lighting.sunElevation, t),
    windowGlow: lerp(a.lighting.windowGlow, b.lighting.windowGlow, t),
    buildingHue: lerp(a.buildings.hue, b.buildings.hue, t),
    buildingSat: lerp(a.buildings.saturation, b.buildings.saturation, t),
    buildingLight: lerp(a.buildings.lightness, b.buildings.lightness, t),
    heightFactor: lerp(a.buildings.heightFactor, b.buildings.heightFactor, t),
    windowDensity: lerp(a.buildings.windowDensity, b.buildings.windowDensity, t),
    windowColor: C(a.buildings.windowColor).lerp(C(b.buildings.windowColor), t),
    skylineDensity: lerp(a.buildings.skylineDensity, b.buildings.skylineDensity, t),
    asphalt: C(a.ground.asphalt).lerp(C(b.ground.asphalt), t),
    marking: C(a.ground.marking).lerp(C(b.ground.marking), t),
    sidewalk: C(a.ground.sidewalk).lerp(C(b.ground.sidewalk), t),
    wetness: lerp(a.ground.wetness, b.ground.wetness, t),
    grime: lerp(a.ground.grime, b.ground.grime, t),
    vehicleBody: C(a.vehicles.body).lerp(C(b.vehicles.body), t),
    vehicleRoof: C(a.vehicles.roof).lerp(C(b.vehicles.roof), t),
    vehicleDensity: lerp(a.vehicles.density, b.vehicles.density, t),
    vehicleScale: lerp(a.vehicles.scale, b.vehicles.scale, t),
    vehicleEmissive: C(a.vehicles.emissive).lerp(C(b.vehicles.emissive), t),
    pedTorso: C(a.pedestrians.torso).lerp(C(b.pedestrians.torso), t),
    pedLegs: C(a.pedestrians.legs).lerp(C(b.pedestrians.legs), t),
    pedHair: C(a.pedestrians.hair).lerp(C(b.pedestrians.hair), t),
    pedDensity: lerp(a.pedestrians.density, b.pedestrians.density, t),
    billboardEmissive: lerp(a.billboards.emissive, b.billboards.emissive, t),
    billboardDensity: lerp(a.billboards.density, b.billboards.density, t),
    lampColor: C(a.props.lampColor).lerp(C(b.props.lampColor), t),
    lampIntensity: lerp(a.props.lampIntensity, b.props.lampIntensity, t),
    skyTraffic: lerp(a.props.skyTraffic, b.props.skyTraffic, t),
    i0,
    i1,
    t,
    eraA: a,
    eraB: b,
    rawT,
  };
}

export function eraConfigAt(eraFloat: number): InterpolatedEra {
  const { i0, i1, t } = sampleEra(eraFloat);
  return blendEra(ERAS[i0], ERAS[i1], t, i0, i1, t);
}

/**
 * Crossfade weight for a discrete era variant. Returns opacity [0..1] for the
 * variant of era index `variantIndex` given the current continuous eraFloat.
 *
 * A variant is fully visible when eraFloat === variantIndex, and fades out as
 * eraFloat moves toward a neighbor, reaching 0 at distance >= 1 era. Two
 * adjacent variants therefore crossfade smoothly with no hard pop.
 */
export function variantOpacity(eraFloat: number, variantIndex: number): number {
  const d = Math.abs(eraFloat - variantIndex);
  return clamp(1 - d, 0, 1);
}

/** Repeatable pseudo-random in [0,1) from an integer seed (no allocation). */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Seeded value in [-1,1]. */
export function hash11(n: number): number {
  return hash01(n) * 2 - 1;
}

/** A tiny deterministic PRNG factory so layouts are stable across renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
