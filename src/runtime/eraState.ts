/**
 * Module-level runtime state — the single coordination point.
 *
 * `eraFloat` is the continuous (eased) era index that every 3D subsystem reads
 * each frame. It lives outside React so animating it never triggers re-renders.
 * The coordinator component eases it toward `targetEra` every frame (clamped
 * delta), and reduced-motion snaps it instantly to the exact target.
 */

import { useAppStore } from "../state/store";
import { ERAS } from "../data/eras";

export interface EraRuntimeState {
  /** continuous eased era index, clamped to [0, ERAS.length-1] */
  eraFloat: number;
  /** integer target era the user selected */
  targetEra: number;
  /** last integer era a motif was fired for (avoids duplicate SFX) */
  lastMotifEra: number;
  /** whether a transition is currently in progress */
  moving: boolean;
}

export const eraState: EraRuntimeState = {
  eraFloat: 4,
  targetEra: 4,
  lastMotifEra: 4,
  moving: false,
};

/** Speed of the eased sweep (eras per second). ~0.9s for an adjacent step. */
const ERA_SPEED = 2.6;
/** Snap threshold: when this close to target, lock exactly. */
const EPS = 0.0005;

/**
 * Advance the eased era toward the target by `dt` seconds (already clamped).
 * Returns the new eraFloat. Honors reduced-motion by snapping instantly.
 */
export function advanceEra(dt: number): number {
  const target = eraState.targetEra;
  const reduced = useAppStore.getState().reducedMotion;

  if (reduced) {
    eraState.eraFloat = target;
    eraState.moving = false;
    return eraState.eraFloat;
  }

  const cur = eraState.eraFloat;
  const diff = target - cur;
  if (Math.abs(diff) <= EPS) {
    eraState.eraFloat = target;
    eraState.moving = false;
    return target;
  }
  // Exponential ease toward target, bounded by a linear max speed so a
  // non-adjacent jump (e.g. 1945 -> 2055) sweeps through every intermediate era
  // rather than teleporting.
  const step = Math.sign(diff) * Math.min(Math.abs(diff) * 6, ERA_SPEED) * dt;
  let next = cur + step;
  // clamp to not overshoot
  if ((diff > 0 && next > target) || (diff < 0 && next < target)) {
    next = target;
  }
  eraState.eraFloat = next;
  eraState.moving = Math.abs(target - next) > EPS;
  return next;
}

export function setTargetEra(index: number): void {
  const clamped = Math.max(0, Math.min(ERAS.length - 1, index));
  eraState.targetEra = clamped;
}

export function syncTargetFromStore(): void {
  eraState.targetEra = useAppStore.getState().targetEra;
}
