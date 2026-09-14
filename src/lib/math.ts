/**
 * Small deterministic math helpers shared by the procedural generation code
 * and era-transition logic. No randomness lives here — see src/lib/rng.ts.
 */

/** Linear interpolation between `a` and `b`; `t` is typically in [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Map `value` from [inMin, inMax] into [outMin, outMax]. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

/** Smoothstep S-curve; `t` is clamped to [0, 1]. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Euclidean distance between two 2D points. */
export function distance2(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Convert degrees to radians (Three.js angles are in radians). */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}