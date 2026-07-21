import * as THREE from 'three';
import type { RGB, Vec3 } from '../types';

// ---------------------------------------------------------------------------
// eraFloat coordinate system
// ---------------------------------------------------------------------------
// The whole experience is driven by a single scalar `eraFloat` in [0, ERA_MAX].
// Integer values correspond exactly to an era index. ERA_COUNT === 6 eras =>
// indices 0..5, ERA_MAX === 5.
//
//   eraFloat  0.0  =>  era 0 (1945)
//   eraFloat  1.0  =>  era 1 (1965)
//   ...
//   eraFloat  5.0  =>  era 5 (2055)
//
// All visual + audio state is a pure function of this scalar, which makes the
// transition engine trivial and fully deterministic.

export const ERA_COUNT = 6;
export const ERA_MAX = ERA_COUNT - 1; // 5

export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clampEra = (eraFloat: number): number => clamp(eraFloat, 0, ERA_MAX);

/**
 * Resolve a float era coordinate into the bracketing integer era indices and
 * the fractional blend `t` in [0,1] from the lower era toward the upper era.
 * At an exact integer, t === 0 and upper === lower (clamped) so sampling the
 * lower era reproduces the endpoint exactly.
 */
export function resolveEra(eraFloat: number): {
  lower: number;
  upper: number;
  t: number;
} {
  const f = clampEra(eraFloat);
  const lower = Math.floor(f + 1e-6);
  // Guard against float dust: when f is essentially an integer, t must be 0.
  let t = f - lower;
  if (t < 1e-6) t = 0;
  if (t > 1 - 1e-6) {
    // Near the upper boundary — snap to the upper era so both brackets agree.
    const upper = Math.min(lower + 1, ERA_MAX);
    return { lower: upper, upper, t: 0 };
  }
  if (t === 0) {
    // Exact integer: both brackets point at the same era (no blend).
    return { lower, upper: lower, t: 0 };
  }
  const upper = Math.min(lower + 1, ERA_MAX);
  return { lower, upper, t };
}

// ---------------------------------------------------------------------------
// Lerp primitives
// ---------------------------------------------------------------------------
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smoothstep easing for natural-feeling crossfades. */
export const smooth = (t: number): number => t * t * (3 - 2 * t);

export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * HSL-aware lerp in RGB space but gamma-corrected so colours do not mud out
 * through the mid-range. Cheap and good enough for realtime.
 */
export function lerpColorGamma(a: RGB, b: RGB, t: number): RGB {
  const r = Math.sqrt(lerp(a[0] * a[0], b[0] * b[0], t));
  const g = Math.sqrt(lerp(a[1] * a[1], b[1] * b[1], t));
  const bl = Math.sqrt(lerp(a[2] * a[2], b[2] * b[2], t));
  return [r, g, bl];
}

/** Spherical lerp for sun direction so the sun arcs rather than cuts a line. */
export function slerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const va = new THREE.Vector3(...a).normalize();
  const vb = new THREE.Vector3(...b).normalize();
  let dot = THREE.MathUtils.clamp(va.dot(vb), -1, 1);
  if (dot > 0.9995) {
    // nearly parallel — plain lerp is fine and avoids div-by-zero
    return lerpVec3(a, b, t);
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinTheta;
  const w2 = Math.sin(t * theta) / sinTheta;
  return [va.x * w1 + vb.x * w2, va.y * w1 + vb.y * w2, va.z * w1 + vb.z * w2];
}

// ---------------------------------------------------------------------------
// Generic per-era field samplers
// ---------------------------------------------------------------------------
/**
 * Sample any numeric/RGB/Vec3 field across the two bracketing eras. `getField`
 * extracts the value for a given era index. Continuous fields are interpolated;
 * discrete fields (strings/booleans) snap to the lower era unless t>0.5.
 */
export function sampleField<T>(
  eraFloat: number,
  getField: (eraIndex: number) => T,
): { value: T; lower: number; upper: number; t: number } {
  const { lower, upper, t } = resolveEra(eraFloat);
  const a = getField(lower);
  const b = getField(upper);
  return { value: t < 0.5 ? a : b, lower, upper, t };
}

// ---------------------------------------------------------------------------
// Crossfade / opacity math for discrete (non-morphable) content
// ---------------------------------------------------------------------------
// Vehicles, pedestrians and signage change silhouette too much to morph, so we
// render both the lower and upper era's content simultaneously and crossfade
// their opacities. This module computes, for a given era and its neighbour,
// the opacity weight each should draw with so the total is always ~1 and an
// exact integer era yields opacity 1 for that era and 0 for all others.

/**
 * The opacity weight assigned to era `i` when the scene is at `eraFloat`.
 *
 * - At an exact integer eraFloat === i, weight(i) === 1 and all others === 0.
 * - Between eras, only the two bracketing eras have non-zero weight, summing
 *   to 1, eased with smoothstep so the crossfade feels natural.
 */
export function eraOpacity(eraFloat: number, eraIndex: number): number {
  const { lower, upper, t } = resolveEra(eraFloat);
  if (eraIndex === lower && eraIndex === upper) return 1;
  if (eraIndex === lower) return 1 - smooth(t);
  if (eraIndex === upper) return smooth(t);
  return 0;
}

/**
 * Convenience: returns the two era indices that currently carry any opacity,
 * with their weights. Everything else should be skipped (opacity 0) for perf.
 */
export function activeEras(
  eraFloat: number,
): Array<{ index: number; opacity: number }> {
  const { lower, upper, t } = resolveEra(eraFloat);
  if (lower === upper) return [{ index: lower, opacity: 1 }];
  const s = smooth(t);
  return [
    { index: lower, opacity: 1 - s },
    { index: upper, opacity: s },
  ];
}

/**
 * Total opacity budget — useful in tests to prove the crossfade is conservative
 * (never exceeds 1, so layered content never overblows the scene).
 */
export function totalOpacity(eraFloat: number): number {
  let sum = 0;
  for (let i = 0; i < ERA_COUNT; i++) sum += eraOpacity(eraFloat, i);
  return sum;
}

// ---------------------------------------------------------------------------
// Distance-based fade helpers (for billboard / sign pop)
// ---------------------------------------------------------------------------
/** Returns opacity 0..1 using a smooth ramp over [edge0, edge1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return smooth(t);
}
