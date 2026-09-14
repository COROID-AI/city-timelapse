/**
 * Easing curves and stagger helpers for the era transition controller.
 *
 * Every curve is a pure, deterministic, allocation-free function: it maps a
 * raw timeline fraction `t` (clamped to [0, 1]) to an eased value in [0, 1]
 * so the controller can call it inside the `update(dt)` hot path without
 * creating garbage. Timing tables (durations, windows, stagger density) are
 * data-driven and live in transitionController.ts; this module only defines
 * the curves and the stagger arithmetic they are fed with.
 */

/** A normalized easing curve: `t` in [0, 1] in, eased value in [0, 1] out. */
export type Easing = (t: number) => number;

/** Clamp `t` into [0, 1] (NaN passes through unchanged). */
export function clamp01(t: number): number {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  return t;
}

/** Identity curve. */
export const easeLinear: Easing = (t) => clamp01(t);

/** Quadratic ease-in (accelerate). */
export const easeInQuad: Easing = (t) => {
  const x = clamp01(t);
  return x * x;
};

/** Quadratic ease-out (decelerate). */
export const easeOutQuad: Easing = (t) => {
  const x = clamp01(t);
  const y = 1 - x;
  return 1 - y * y;
};

/** Quadratic ease-in-out (smooth S). */
export const easeInOutQuad: Easing = (t) => {
  const x = clamp01(t);
  if (x < 0.5) {
    return 2 * x * x;
  }
  const y = -2 * x + 2;
  return 1 - (y * y) / 2;
};

/** Cubic ease-in (slow start, fast finish — the demolish-wave tail). */
export const easeInCubic: Easing = (t) => {
  const x = clamp01(t);
  return x * x * x;
};

/** Cubic ease-out (fast start, settling finish — the build-in landing). */
export const easeOutCubic: Easing = (t) => {
  const x = clamp01(t);
  const y = 1 - x;
  return 1 - y * y * y;
};

/** Cubic ease-in-out. */
export const easeInOutCubic: Easing = (t) => {
  const x = clamp01(t);
  if (x < 0.5) {
    return 4 * x * x * x;
  }
  const y = -2 * x + 2;
  return 1 - (y * y * y) / 2;
};

/** Sine ease-in-out (soft S). */
export const easeInOutSine: Easing = (t) => {
  const x = clamp01(t);
  return -(Math.cos(Math.PI * x) - 1) / 2;
};

/**
 * Map the timeline fraction `t` into the choreography window `[start, end]`
 * (both fractions of the total morph duration). Returns a value clamped to
 * [0, 1].
 */
export function windowProgress(t: number, start: number, end: number): number {
  const span = end - start;
  if (span <= 0) {
    return clamp01(t);
  }
  return clamp01((t - start) / span);
}

/**
 * Per-element progress for element `index` of `count`, with the elements
 * spread evenly ("wave") across the choreography window `[start, end]`:
 * element 0 leads the wave and the last element finishes exactly at `end`.
 * Passing `count = 1` collapses the wave into plain {@link windowProgress},
 * which is how reduced-motion crossfades disable stagger.
 */
export function staggerProgress(index: number, count: number, start: number, end: number, t: number): number {
  const n = Math.max(1, count);
  const span = end - start;
  if (span <= 0) {
    return clamp01(t);
  }
  const step = span / n;
  return clamp01((t - start - step * index) / step);
}