/**
 * Sampling/interpolation for continuous era parameters.
 *
 * Pure functions, no THREE dependency, fully unit-tested. The scene reads a
 * single `eraProgress` (0..5) and calls `sampleEraConfig` each frame to get the
 * current continuous light/sky/fog/FX state.
 */

import { lerp } from './math'
import {
  ContinuousSceneConfig,
  ERA_COUNT,
  SCENE_CONFIG,
} from './config'

/** Extract the red channel (0..255) from a 0xRRGGBB number. */
export function r(hex: number): number {
  return (hex >> 16) & 0xff
}
/** Extract the green channel (0..255) from a 0xRRGGBB number. */
export function g(hex: number): number {
  return (hex >> 8) & 0xff
}
/** Extract the blue channel (0..255) from a 0xRRGGBB number. */
export function b(hex: number): number {
  return hex & 0xff
}

/** Component-wise lerp of two 0xRRGGBB colours, returning a 0xRRGGBB number. */
export function lerpColor(a: number, c: number, t: number): number {
  const rr = Math.round(lerp(r(a), r(c), t))
  const gg = Math.round(lerp(g(a), g(c), t))
  const bb = Math.round(lerp(b(a), b(c), t))
  return (rr << 16) | (gg << 8) | bb
}

/** Array element lerp between two equally-lengthed number[] palettes. */
export function lerpPalette(a: number[], c: number[], t: number): number[] {
  const len = Math.max(a.length, c.length)
  const out = new Array<number>(len)
  for (let i = 0; i < len; i++) {
    out[i] = lerpColor(a[i % a.length] ?? 0, c[i % c.length] ?? 0, t)
  }
  return out
}

/**
 * Linearly sample a numeric field across all eras given a fractional era index.
 * Each adjacent pair is connected with a straight line (standard lerp).
 */
function sampleField(
  eraProgress: number,
  get: (c: ContinuousSceneConfig) => number,
): number {
  const i = Math.floor(eraProgress)
  const f = eraProgress - i
  const a = SCENE_CONFIG[clampIndex(i)]
  const bb = SCENE_CONFIG[clampIndex(i + 1)]
  if (a === bb) return get(a)
  return lerp(get(a), get(bb), f)
}

/**
 * Linearly sample a colour field across all eras given a fractional era index.
 */
function sampleColorField(
  eraProgress: number,
  get: (c: ContinuousSceneConfig) => number,
): number {
  const i = Math.floor(eraProgress)
  const f = eraProgress - i
  const a = SCENE_CONFIG[clampIndex(i)]
  const bb = SCENE_CONFIG[clampIndex(i + 1)]
  if (a === bb) return get(a)
  return lerpColor(get(a), get(bb), f)
}

function clampIndex(i: number): number {
  if (i < 0) return 0
  if (i > ERA_COUNT - 1) return ERA_COUNT - 1
  return i
}

/**
 * Sample the full continuous scene config at a fractional era index.
 *
 * `eraProgress` is clamped to [0, ERA_COUNT - 1]. Colours interpolate
 * component-wise; everything else interpolates linearly.
 */
export function sampleEraConfig(
  eraProgress: number,
): ContinuousSceneConfig {
  const p = clampIndex(eraProgress)
  return {
    skyTop: sampleColorField(p, (c) => c.skyTop),
    skyBottom: sampleColorField(p, (c) => c.skyBottom),
    sunColor: sampleColorField(p, (c) => c.sunColor),
    sunIntensity: sampleField(p, (c) => c.sunIntensity),
    sunAzimuth: sampleField(p, (c) => c.sunAzimuth),
    sunElevation: sampleField(p, (c) => c.sunElevation),
    ambientColor: sampleColorField(p, (c) => c.ambientColor),
    ambientIntensity: sampleField(p, (c) => c.ambientIntensity),
    fogColor: sampleColorField(p, (c) => c.fogColor),
    fogNear: sampleField(p, (c) => c.fogNear),
    fogFar: sampleField(p, (c) => c.fogFar),
    groundColor: sampleColorField(p, (c) => c.groundColor),
    bloom: sampleField(p, (c) => c.bloom),
    vignette: sampleField(p, (c) => c.vignette),
    exposure: sampleField(p, (c) => c.exposure),
  }
}

/**
 * Fractional indices for the two dominant eras at a given progress and their
 * weights (summing to 1). Used by discrete crossfaders that need to know which
 * two variants are "live".
 */
export function dominantEras(
  eraProgress: number,
): { lo: number; hi: number; weight: number } {
  const p = clampIndex(eraProgress)
  const lo = Math.floor(p)
  const hi = Math.min(lo + 1, ERA_COUNT - 1)
  const weight = 1 - (p - lo) // weight on `lo`
  return { lo, hi, weight }
}
