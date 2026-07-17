/**
 * Pure math helpers for era interpolation.
 *
 * The entire timelapse is driven by a single continuous value `eraProgress`
 * (a float in the 0..5 era-index space). Continuous scene parameters
 * (lighting, sky, fog, post FX) are sampled via `sampleEraConfig`, while
 * discrete objects (buildings, vehicles, pedestrians, signs) use
 * `variantAlpha` to crossfade between era variants.
 *
 * Everything here is framework-agnostic and fully unit-tested.
 */

/** Clamp `x` to the inclusive range [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  if (x < min) return min
  if (x > max) return max
  return x
}

/** Linear interpolation. Unclamped (use `clamp` on `t` when you need a bound). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Hermite smoothstep. Returns 0 for `x <= edge0`, 1 for `x >= edge1`, and a
 * smooth C1-continuous curve in between. `edge0` must be < `edge1`.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Inverse smoothstep (1 - smoothstep). Convenience for "fade out" ramps. */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Map a value from one range to another, clamped to the output range. */
export function remap(
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = clamp((x - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}

/**
 * Frame-rate-independent exponential approach toward a target.
 *
 * `speed` is in "fraction of remaining distance per second". At ~6 it reaches
 * the target in well under a second which reads as a deliberate timelapse
 * morph rather than an instant cut, while still settling cleanly so the
 * frameloop can drop back to demand rendering.
 */
export function approach(
  current: number,
  target: number,
  speed: number,
  dt: number,
  epsilon = 0.0005,
): { value: number; done: boolean } {
  const remaining = target - current
  if (Math.abs(remaining) <= epsilon) return { value: target, done: true }
  const factor = 1 - Math.exp(-speed * dt)
  const value = current + remaining * factor
  if (Math.abs(target - value) <= epsilon) return { value: target, done: true }
  return { value, done: false }
}

/**
 * Per-variant visibility for a discrete object that belongs to a specific era.
 *
 * A variant is fully visible at `eraProgress === eraIndex`, and crossfades to
 * zero at the neighbouring era indices (eraIndex ± 1). This means that as the
 * continuous progress glides between two eras the two adjacent variants both
 * sit at ~0.5 opacity in the middle — a dissolve/morph rather than a hard cut.
 *
 * End eras clamp naturally because the out-of-range ramp evaluates to a
 * constant 1 on the closed side.
 */
export function variantAlpha(
  eraProgress: number,
  eraIndex: number,
  /** How wide each ramp is, in era units. 1.0 = full neighbour crossfade. */
  halfWidth = 1,
): number {
  const rise = smoothstep(eraIndex - halfWidth, eraIndex, eraProgress)
  const fall = 1 - smoothstep(eraIndex, eraIndex + halfWidth, eraProgress)
  return clamp(Math.min(rise, fall), 0, 1)
}
