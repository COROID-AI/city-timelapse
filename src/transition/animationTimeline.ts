/**
 * AnimationTimeline: the timing backbone of the era transition engine.
 *
 * Owns a configurable duration (default ~1.8s) and an easing function
 * (default cubic in-out) and turns elapsed wall-clock time into a normalized
 * progress value in [0, 1]. The `TransitionDirector` drives one timeline per
 * handoff; rapid era switching simply calls `start()` again to cancel and
 * retarget the in-flight animation.
 */

/** Clamp a value into [0, 1]. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Easing function: maps linear progress [0,1] to eased progress [0,1]. */
export type Easing = (t: number) => number;

/** Cubic ease-in-out. Smooth, symmetric acceleration/deceleration. */
export function cubicInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Build-in easing with a slight overshoot: the incoming era's meshes rise
 * from the ground, overshooting their resting height by a small amount before
 * settling. Returns values that may briefly exceed 1 (the caller clamps the
 * final resting pose).
 */
export function buildInOvershoot(t: number, overshoot = 0.12): number {
  const x = clamp01(t);
  const base = cubicInOut(x);
  // A decaying sine bump pushes the curve above 1 mid-flight, then returns to
  // exactly 1 at t = 1 so the settled pose is exact.
  const bump = overshoot * Math.sin(x * Math.PI) * (1 - x);
  return Math.min(1 + overshoot, base + bump);
}

/** The default transition duration in seconds. */
export const DEFAULT_DURATION = 1.8;

/** Options for constructing an AnimationTimeline. */
export interface TimelineOptions {
  /** Transition duration in seconds. Defaults to ~1.8s. */
  duration?: number;
  /** Easing function. Defaults to cubic in-out. */
  easing?: Easing;
}

/**
 * A resettable animation timeline.
 *
 * Lifecycle: instantiate -> start() -> update(dt) repeatedly ->
 * `done` becomes true. `start()` may be called again mid-flight to cancel and
 * retarget, which is how rapid era switching is handled.
 */
export class AnimationTimeline {
  private _duration: number;
  private _easing: Easing;
  private _elapsed = 0;

  constructor(options: TimelineOptions = {}) {
    this._duration = options.duration ?? DEFAULT_DURATION;
    this._easing = options.easing ?? cubicInOut;
  }

  /** The transition duration in seconds. */
  get duration(): number {
    return this._duration;
  }

  /** The easing function. */
  get easing(): Easing {
    return this._easing;
  }

  /** Elapsed time since the last `start()` in seconds. */
  get elapsed(): number {
    return this._elapsed;
  }

  /** Linear (un-eased) progress in [0, 1]. */
  get progress(): number {
    if (this._duration <= 0) return 1;
    return clamp01(this._elapsed / this._duration);
  }

  /** Eased progress in [0, 1]. */
  get eased(): number {
    return this._easing(this.progress);
  }

  /** Whether the timeline has reached its end. */
  get done(): boolean {
    return this.progress >= 1;
  }

  /**
   * Reset the timeline. Optionally overrides the duration. Calling this
   * mid-flight cancels the current animation (used for rapid retargeting).
   */
  start(duration?: number): void {
    if (duration !== undefined && duration >= 0) {
      this._duration = duration;
    }
    this._elapsed = 0;
  }

  /**
   * Advance by `dt` seconds and return the eased progress in [0, 1]. Negative
   * dt is ignored (a stopped clock never moves backwards).
   */
  update(dt: number): number {
    if (dt > 0) this._elapsed += dt;
    return this.eased;
  }
}