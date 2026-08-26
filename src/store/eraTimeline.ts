import { create } from 'zustand';
import { ERA_IDS, getEraSpec, type EraId, type EraSpec } from '../eras';

/**
 * Era timeline store.
 *
 * This is the single coordination point for era selection and interpolation.
 * Every subsystem (scene modules, audio mixer, particles) reads `transitionProgress`
 * from this store so the entire scene morphs in sync on a shared transition clock.
 *
 * State model:
 *  - `currentEra`  : the era the scene is currently rendered as.
 *  - `targetEra`   : the era the scene is interpolating toward.
 *  - `transitionProgress` — normalized 0..1; 0 means "still at currentEra",
 *   1 means "fully at targetEra". It advances via `transitionTick(dt)` each frame.
 *
 * Because interpolation is continuous across adjacent eras, `currentEra` is the
 * floor index and `targetEra` is the ceiling index of the running tween.
 */

/** Duration (seconds) of a full era transition. */
export const TRANSITION_DURATION = 2.0;

interface EraTimelineState {
  currentEra: EraId;
  targetEra: EraId;
  /** Normalized 0..1 progress toward the target era. */
  transitionProgress: number;

  /** Select an era (e.g. from the slider). Restarts the transition. */
  setEra: (id: EraId) => void;

  /**
   * Advance the transition clock by `dt` seconds. Call once per frame from the
   * render loop. Moves `transitionProgress` from 0 toward 1 (eased).
   */
  transitionTick: (dt: number) => void;

  /**
   * Interpolate between the current and target era specs for a given progress.
   * Returns a resolved spec whose id is whichever era is currently dominant.
   */
  interpolateEra: (progress?: number) => EraSpec;

  /**
   * Interpolate an arbitrary continuous value defined per-era, using the
   * transition progress. `from` corresponds to the current era, `to` to the
   * target era.
   */
  lerpEraValue: (from: number, to: number, progress?: number) => number;

  /** Continuous float position along the era timeline (0..ERA_IDS.length-1). */
  eraFloat: (progress?: number) => number;
}

/** Simple linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a normalized progress into 0..1. */
function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Smoothstep easing for a natural, non-linear morph. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

export const useEraTimeline = create<EraTimelineState>((set, get) => ({
  currentEra: ERA_IDS[0],
  targetEra: ERA_IDS[0],
  transitionProgress: 1,

  setEra: (id) => {
    const { currentEra, targetEra, transitionProgress } = get();
    if (id === targetEra) return;

    // If we are mid-transition, fold the current progress into the starting era
    // so the new transition continues smoothly from where we are.
    const resolvedCurrent =
      transitionProgress > 0.5 ? targetEra : currentEra;

    set({ currentEra: resolvedCurrent, targetEra: id, transitionProgress: 0 });
  },

  transitionTick: (dt) => {
    const { transitionProgress, currentEra, targetEra } = get();
    if (transitionProgress >= 1) return;

    const next = Math.min(1, transitionProgress + dt / TRANSITION_DURATION);
    const nextState: Partial<EraTimelineState> = { transitionProgress: next };

    // Once fully transitioned, promote the target to current.
    if (next >= 1 && currentEra !== targetEra) {
      // Bypass setEra (which resets progress) and settle directly.
      nextState.currentEra = targetEra;
    }
    set(nextState);
  },

  interpolateEra: (progress) => {
    const { currentEra, targetEra, transitionProgress } = get();
    const t = clamp01(
      progress === undefined ? transitionProgress : progress,
    );

    // The dominant era is whichever side of the halfway point we are on.
    const dominant = t >= 0.5 ? targetEra : currentEra;
    return getEraSpec(dominant);
  },

  lerpEraValue: (from, to, progress) => {
    const { transitionProgress } = get();
    const t = easeInOut(clamp01(progress ?? transitionProgress));
    return lerp(from, to, t);
  },

  eraFloat: (progress) => {
    const { currentEra, targetEra, transitionProgress } = get();
    const p = clamp01(progress ?? transitionProgress);
    const fromIdx = ERA_IDS.indexOf(currentEra);
    const toIdx = ERA_IDS.indexOf(targetEra);
    return lerp(fromIdx, toIdx, easeInOut(p));
  },
}));