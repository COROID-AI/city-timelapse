/**
 * Easing, interpolation and crossfade maths of the transition director.
 *
 * Every function here is pure and total: it clamps its input, never returns
 * `NaN`, and returns exactly `0` at `t <= 0` and exactly `1` at `t >= 1` so a
 * completed stage is bit-for-bit the destination era. The functions are the
 * "crossfade and interpolation helpers over the layer contracts" the schedule
 * and the director are built from:
 *
 * - {@link ease} maps a schedule entry's easing name to `0..1 → 0..1`;
 * - {@link crossfadeWeights} / {@link crossfadeValue} are the classic two-source
 *   blend the layer requests are expressed in;
 * - {@link resumeProgress} continues a stage from the progress it had reached
 *   when the viewer retargeted, which is what makes a retarget monotone;
 * - {@link resolveDominantEra} names the era the block visually resembles most,
 *   so a retarget can start from it instead of restarting from zero.
 */

import type { EraId } from '../era'
import { EASING_NAMES, type EasingName } from './types'

/* -------------------------------------------------------------------------- */
/* Clamping                                                                   */
/* -------------------------------------------------------------------------- */

/** Clamps any number into the closed interval 0..1; `NaN` becomes 0. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  if (value <= 0) {
    return 0
  }
  return value >= 1 ? 1 : value
}

/** Clamps any number into an arbitrary closed interval; `NaN` becomes `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min
  }
  if (value <= min) {
    return min
  }
  return value >= max ? max : value
}

/* -------------------------------------------------------------------------- */
/* Easing                                                                     */
/* -------------------------------------------------------------------------- */

/** Raw curves, each mapping `[0, 1]` onto `[0, 1]` monotonically. */
export const EASING_FUNCTIONS: Readonly<Record<EasingName, (t: number) => number>> = Object.freeze({
  /** No shaping at all; used by stages that must feel mechanical. */
  linear: (t: number): number => t,
  /** Hermite smoothstep: slow, quick, slow. The default story rhythm. */
  smoothstep: (t: number): number => t * t * (3 - 2 * t),
  /** Half-cosine S-curve lifted from the pipeline's camera easing. */
  easeInOutSine: (t: number): number => 0.5 - Math.cos(Math.PI * t) / 2,
  /** Fast start, long settle: buildings and crowds land softly. */
  easeOutCubic: (t: number): number => 1 - (1 - t) ** 3,
  /** Symmetric cubic S-curve for shifts that must read as "deliberate". */
  easeInOutCubic: (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
})

/**
 * Applies one named curve.
 *
 * Unknown names fall back to `smoothstep` and out-of-range input is clamped, so
 * a malformed table row can never produce a jumpy or non-monotone stage.
 */
export function ease(name: EasingName, t: number): number {
  const curve = EASING_FUNCTIONS[name] ?? EASING_FUNCTIONS.smoothstep
  return clamp01(curve(clamp01(t)))
}

/** True when `name` is one of {@link EASING_NAMES}. */
export function isEasingName(name: unknown): name is EasingName {
  return typeof name === 'string' && (EASING_NAMES as readonly string[]).includes(name)
}

/* -------------------------------------------------------------------------- */
/* Interpolation                                                              */
/* -------------------------------------------------------------------------- */

/** Linear interpolation, clamped: `lerp(a, b, 0) === a`, `lerp(a, b, 1) === b`. */
export function lerp(from: number, to: number, t: number): number {
  const weight = clamp01(t)
  return from + (to - from) * weight
}

/** Alias of {@link lerp} for callers that read the frame "interpolated". */
export function interpolate(from: number, to: number, t: number): number {
  return lerp(from, to, t)
}

/** The two weights a crossfade between `from` and `to` uses; they sum to 1. */
export interface CrossfadeWeights {
  /** Weight of the outgoing source, `1 - w`. */
  readonly departing: number
  /** Weight of the incoming source, `w`. */
  readonly arriving: number
}

/**
 * Crossfade weights for a blend at `t`, optionally shaped by a curve.
 *
 * This is the helper layer adapters are documented against: the outgoing era
 * keeps `departing`, the incoming era takes `arriving`, and a completed blend has
 * `departing === 0` exactly.
 */
export function crossfadeWeights(t: number, easing: EasingName = 'linear'): CrossfadeWeights {
  const arriving = ease(easing, t)
  return { departing: 1 - arriving, arriving }
}

/** Blends two values with the weights of {@link crossfadeWeights}. */
export function crossfadeValue(
  from: number,
  to: number,
  t: number,
  easing: EasingName = 'linear',
): number {
  const { arriving, departing } = crossfadeWeights(t, easing)
  return from * departing + to * arriving
}

/**
 * Continues a stage from the progress it had already reached.
 *
 * `offset` is the progress at the moment of a retarget and `eased` is the new
 * window's eased progress. The result equals `offset` at `eased === 0` and `1` at
 * `eased === 1`, so a retargeted stage neither restarts from zero nor overshoots.
 */
export function resumeProgress(offset: number, eased: number): number {
  const start = clamp01(offset)
  return clamp01(start + (1 - start) * clamp01(eased))
}

/* -------------------------------------------------------------------------- */
/* Era bookkeeping                                                            */
/* -------------------------------------------------------------------------- */

/** Blend weight at or above which the destination era reads as dominant. */
export const DOMINANT_ERA_THRESHOLD = 0.5

/**
 * The era the block visually resembles most.
 *
 * Below the threshold the outgoing era still dominates; at or above it the
 * incoming era does. A settled pair (`from === to`) is its own dominant era.
 */
export function resolveDominantEra(from: EraId, to: EraId, progress: number): EraId {
  if (from === to) {
    return to
  }
  return clamp01(progress) >= DOMINANT_ERA_THRESHOLD ? to : from
}

/** Mean of stage progresses, clamped into 0..1; the empty case is "done". */
export function meanProgress(values: readonly number[]): number {
  if (values.length === 0) {
    return 1
  }
  let total = 0
  for (const value of values) {
    total += clamp01(value)
  }
  return clamp01(total / values.length)
}

/** True when a progress sequence never decreases (allowing exact repeats). */
export function isMonotonic(sequence: readonly number[]): boolean {
  for (let index = 1; index < sequence.length; index += 1) {
    const previous = sequence[index - 1]
    const current = sequence[index]
    if (previous === undefined || current === undefined) {
      continue
    }
    if (current < previous) {
      return false
    }
  }
  return true
}
