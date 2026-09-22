/**
 * Era timeline core — the shared, pure five-year time model for the city.
 *
 * This module owns:
 * - the ordered era years (1945, 1965, 1985, 2005, 2025);
 * - a timeline state with a continuous 0..1 slider position, plus discrete
 *   snap-to-year selection for the slider's named stops;
 * - pure blend math that maps any position to the adjacent era pair and a
 *   0..1 crossfade fraction, clamped at both ends;
 * - an ease-in-out transition driver that animates between any two years over
 *   1..2 seconds, producing one continuous frame per tick.
 *
 * Deliberately free of renderer, DOM, and city domain knowledge: every export
 * here is deterministic and unit-testable without a GPU. Domain modules consume
 * the frames this core produces through `src/era/contracts.ts`.
 */

/** Ordered era years offered by the timeline slider. */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

/** One of the five era stops. */
export type EraYear = (typeof ERA_YEARS)[number];

/** First era stop (timeline clamps below this). */
export const ERA_MIN_YEAR: number = ERA_YEARS[0];

/** Last era stop (timeline clamps above this). */
export const ERA_MAX_YEAR: number = ERA_YEARS[ERA_YEARS.length - 1];

/**
 * Index of the final era segment. Segments run from `ERA_YEARS[i]` to
 * `ERA_YEARS[i + 1]`, so five stops yield four segments (indices 0..3).
 */
const FINAL_SEGMENT = ERA_YEARS.length - 2;

/** Equal position spans between consecutive era stops (five stops -> four). */
const POSITION_SEGMENTS = ERA_YEARS.length - 1;

/**
 * A crossfade between two adjacent eras.
 *
 * `fraction` is the weight of `to`; `from` carries the remaining `1 - fraction`
 * weight, so era weights always sum to 1. At an interior stop the blend is the
 * stop itself (`fraction` 0 on the outgoing segment); at the final stop the
 * blend is `{ from: 2005, to: 2025, fraction: 1 }` so the last era carries
 * full weight.
 */
export interface EraBlend {
  readonly from: EraYear;
  readonly to: EraYear;
  readonly fraction: number;
}

/** Immutable view of the timeline state, delivered to subscribers. */
export interface EraTimelineSnapshot {
  readonly position: number;
  readonly year: number;
  readonly selectedYear: EraYear;
  readonly blend: EraBlend;
  readonly transitioning: boolean;
}

/** One tick of the transition driver: where the timeline is and how far along. */
export interface EraFrame {
  /** Continuous slider position in 0..1 (clamped). */
  readonly position: number;
  /** Continuous year implied by `position` (may fall between era stops). */
  readonly year: number;
  /** Adjacent-era crossfade at this position. */
  readonly blend: EraBlend;
  /** Eased transition progress in 0..1; 1 while idle (fully applied). */
  readonly progress: number;
  /** True while an animated transition is still running. */
  readonly transitioning: boolean;
}

/** Listener signature for `EraTimelineCore.subscribe`. */
export type EraTimelineListener = (snapshot: EraTimelineSnapshot) => void;

/** Active animation between two slider positions. */
interface ActiveTransition {
  readonly from: number;
  readonly to: number;
  readonly durationSeconds: number;
  elapsedSeconds: number;
}

/**
 * Clamp to 0..1. Non-finite input (NaN) falls back to 0 so blend math can
 * never emit `NaN` fractions; infinities clamp to the matching end.
 */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Symmetric ease-in-out (cubic): slow start, fast middle, slow end.
 * Monotonic on [0, 1], with `f(0) = 0`, `f(0.5) = 0.5`, `f(1) = 1`.
 */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  if (x < 0.5) return 4 * x * x * x;
  const inv = -2 * x + 2;
  return 1 - (inv * inv * inv) / 2;
}

/**
 * Map a continuous slider position (0..1, clamped) to a continuous year.
 * Each era segment occupies an equal position span, so the five stops sit at
 * positions 0, 0.25, 0.5, 0.75 and 1.
 */
export function positionToYear(position: number): number {
  const t = clamp01(position);
  const scaled = t * POSITION_SEGMENTS;
  let index = Math.floor(scaled);
  if (index > FINAL_SEGMENT) index = FINAL_SEGMENT;
  const local = scaled - index;
  const start = ERA_YEARS[index];
  const end = ERA_YEARS[index + 1];
  return start + (end - start) * local;
}

/**
 * Map a continuous year to its slider position (0..1). Years below the first
 * stop clamp to 0, years at or above the last stop clamp to 1, and non-finite
 * input falls back to 0.
 */
export function yearToPosition(year: number): number {
  if (Number.isNaN(year)) return 0;
  if (year >= ERA_MAX_YEAR) return 1; // covers +Infinity
  if (year <= ERA_MIN_YEAR) return 0; // covers -Infinity
  let index = 0;
  while (index < FINAL_SEGMENT && year >= ERA_YEARS[index + 1]) index += 1;
  const start = ERA_YEARS[index];
  const end = ERA_YEARS[index + 1];
  const local = (year - start) / (end - start);
  return clamp01((index + local) / POSITION_SEGMENTS);
}

/**
 * Pure blend math for any slider position: returns the adjacent era pair and
 * a 0..1 crossfade fraction, clamped at both ends.
 *
 * - Position 0          -> { 1945, 1965, 0 }   (fully 1945)
 * - Position 0.125      -> { 1945, 1965, 0.5 } (midpoint crossfade)
 * - Position 0.25       -> { 1965, 1985, 0 }   (fully 1965)
 * - Position 1          -> { 2005, 2025, 1 }   (fully 2025)
 */
export function blendForPosition(position: number): EraBlend {
  const t = clamp01(position);
  const scaled = t * POSITION_SEGMENTS;
  let index = Math.floor(scaled);
  if (index > FINAL_SEGMENT) index = FINAL_SEGMENT;
  const fraction = clamp01(scaled - index);
  return { from: ERA_YEARS[index], to: ERA_YEARS[index + 1], fraction };
}

/**
 * Blend math for a continuous year value, clamped to [1945, 2025].
 *
 * Interior stops resolve to the outgoing segment with fraction 0 (the stop
 * era carries full weight); the final stop resolves to fraction 1 so 2025
 * carries full weight.
 */
export function blendForYear(year: number): EraBlend {
  const y = Number.isNaN(year) ? ERA_MIN_YEAR : Math.min(Math.max(year, ERA_MIN_YEAR), ERA_MAX_YEAR);
  if (y >= ERA_MAX_YEAR) {
    return { from: ERA_YEARS[FINAL_SEGMENT], to: ERA_YEARS[FINAL_SEGMENT + 1], fraction: 1 };
  }
  let index = 0;
  while (index < FINAL_SEGMENT && y >= ERA_YEARS[index + 1]) index += 1;
  const start = ERA_YEARS[index];
  const end = ERA_YEARS[index + 1];
  const fraction = end > start ? (y - start) / (end - start) : 0;
  return { from: start, to: end, fraction: clamp01(fraction) };
}

/** Closest era stop for a continuous year (ties resolve to the earlier stop). */
export function nearestEraYear(year: number): EraYear {
  const y = Number.isNaN(year)
    ? ERA_MIN_YEAR
    : Math.min(Math.max(year, ERA_MIN_YEAR), ERA_MAX_YEAR);
  let best: EraYear = ERA_YEARS[0];
  let bestDistance = Math.abs(y - best);
  for (const candidate of ERA_YEARS) {
    const distance = Math.abs(y - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Per-era crossfade weights for a blend, keyed by every era stop (absent eras
 * weigh 0). Weights always sum to 1, which lets consumers crossfade adjacent
 * eras without special-casing segment boundaries.
 */
export function eraWeights(blend: EraBlend): Map<EraYear, number> {
  const weights = new Map<EraYear, number>(ERA_YEARS.map((year) => [year, 0] as [EraYear, number]));
  const fraction = clamp01(blend.fraction);
  weights.set(blend.from, (weights.get(blend.from) ?? 0) + (1 - fraction));
  weights.set(blend.to, (weights.get(blend.to) ?? 0) + fraction);
  return weights;
}

/**
 * Timeline state plus the staged, eased transition driver.
 *
 * The state supports both discrete snap-to-year selection (`selectYear`) and
 * continuous blending at intermediate slider positions (`setPosition`).
 * `transitionTo` + `advance` animate between any two years over 1..2 seconds,
 * emitting one continuous eased frame per tick instead of snapping.
 */
export class EraTimelineCore {
  /** Ordered era stops this core models. */
  static readonly YEARS = ERA_YEARS;
  /** Shortest allowed transition (seconds); guards against snap-through. */
  static readonly MIN_TRANSITION_SECONDS = 1;
  /** Longest allowed transition (seconds). */
  static readonly MAX_TRANSITION_SECONDS = 2;
  /** Default transition length: a comfortably visible morph. */
  static readonly DEFAULT_TRANSITION_SECONDS = 1.5;

  /** Clamp a requested duration into the supported 1..2 second window. */
  static clampTransitionSeconds(durationSeconds: number): number {
    if (!Number.isFinite(durationSeconds)) return EraTimelineCore.DEFAULT_TRANSITION_SECONDS;
    return Math.min(
      EraTimelineCore.MAX_TRANSITION_SECONDS,
      Math.max(EraTimelineCore.MIN_TRANSITION_SECONDS, durationSeconds),
    );
  }

  #position = 0;
  #selectedYear: EraYear = ERA_YEARS[0];
  #transition: ActiveTransition | null = null;
  readonly #listeners = new Set<EraTimelineListener>();

  /** Continuous slider position in 0..1 (animated while transitioning). */
  get position(): number {
    return this.#position;
  }

  /** Continuous year implied by the current position. */
  get year(): number {
    return positionToYear(this.#position);
  }

  /** Discrete era stop selected on the timeline (transition target when animating). */
  get selectedYear(): EraYear {
    return this.#selectedYear;
  }

  /** Adjacent-era crossfade at the current position. */
  get blend(): EraBlend {
    return blendForPosition(this.#position);
  }

  /** True while an animated transition is running. */
  get isTransitioning(): boolean {
    return this.#transition !== null;
  }

  /** Eased progress of the active transition (1 while idle). */
  get transitionProgress(): number {
    const transition = this.#transition;
    if (!transition) return 1;
    return easeInOutCubic(Math.min(1, transition.elapsedSeconds / transition.durationSeconds));
  }

  /** Duration of the active transition in seconds, or null while idle. */
  get transitionDurationSeconds(): number | null {
    return this.#transition ? this.#transition.durationSeconds : null;
  }

  /** Immutable snapshot of the current state. */
  snapshot(): EraTimelineSnapshot {
    return {
      position: this.#position,
      year: this.year,
      selectedYear: this.#selectedYear,
      blend: this.blend,
      transitioning: this.isTransitioning,
    };
  }

  /**
   * Set the continuous slider position directly (dragging between stops).
   * Clamped to 0..1, snaps `selectedYear` to the nearest stop, cancels any
   * running transition, and notifies subscribers.
   */
  setPosition(position: number): void {
    this.#transition = null;
    this.#position = clamp01(position);
    this.#selectedYear = nearestEraYear(this.year);
    this.#emit();
  }

  /**
   * Discrete snap-to-year selection: jump exactly to an era stop. Cancels any
   * running transition and notifies subscribers. Scene morphing is the morph
   * driver's job (`transitionTo`); this method only moves timeline state.
   */
  selectYear(year: number): EraYear {
    this.#transition = null;
    this.#selectedYear = nearestEraYear(year);
    this.#position = yearToPosition(this.#selectedYear);
    this.#emit();
    return this.#selectedYear;
  }

  /**
   * Animate from the current position to the era stop nearest `year` over a
   * clamped 1..2 second ease-in-out. Retargeting mid-flight starts a new
   * transition from the current animated position; selecting the exact current
   * position completes immediately. Notifies subscribers once (the target
   * change); per-frame values are read via `advance`/`frame`.
   */
  transitionTo(year: number, durationSeconds?: number): EraYear {
    const target = nearestEraYear(year);
    const from = this.#position;
    const to = yearToPosition(target);
    const duration = EraTimelineCore.clampTransitionSeconds(
      durationSeconds ?? EraTimelineCore.DEFAULT_TRANSITION_SECONDS,
    );
    this.#selectedYear = target;
    if (from === to) {
      this.#transition = null;
      this.#position = to;
      this.#emit();
      return target;
    }
    this.#transition = { from, to, durationSeconds: duration, elapsedSeconds: 0 };
    this.#emit();
    return target;
  }

  /**
   * Advance the active transition by `deltaSeconds` and return the resulting
   * continuous frame. Progress is eased (ease-in-out), so early and late frames
   * move slowly while the middle moves quickly — the scene morphs instead of
   * snapping. Idle calls return the settled frame without side effects.
   */
  advance(deltaSeconds: number): EraFrame {
    const transition = this.#transition;
    if (!transition) return this.frame();
    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    transition.elapsedSeconds += dt;
    const t = Math.min(1, transition.elapsedSeconds / transition.durationSeconds);
    const eased = easeInOutCubic(t);
    this.#position = transition.from + (transition.to - transition.from) * eased;
    if (t >= 1) {
      this.#position = transition.to;
      this.#transition = null;
      this.#emit();
    }
    return this.frame();
  }

  /** Current frame without advancing time. */
  frame(): EraFrame {
    return {
      position: this.#position,
      year: this.year,
      blend: this.blend,
      progress: this.transitionProgress,
      transitioning: this.isTransitioning,
    };
  }

  /**
   * Observe state changes. Listeners fire on `setPosition`, `selectYear`,
   * `transitionTo`, and transition completion — not on every `advance` tick —
   * so per-frame consumers should poll `frame()` from their render loop.
   * Returns an unsubscribe function.
   */
  subscribe(listener: EraTimelineListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(): void {
    if (this.#listeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
