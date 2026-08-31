/**
 * Domain state, decoupled from Three.js objects.
 * The continuous `eraIndex` drives every interpolation in the scene.
 */

import { ERA_IDS, type EraId } from './eras';

export interface AppState {
  /** Current discrete era selected on the timeline. */
  era: EraId;
  /** Continuously eased era index, 0 .. ERA_IDS.length-1. */
  eraIndex: number;
  /** Seconds since the loop started. */
  time: number;
  muted: boolean;
  lowQuality: boolean;
  /** prefers-reduced-motion => shorter transitions. */
  reducedMotion: boolean;
}

export function createInitialState(): AppState {
  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    era: '1945' as EraId,
    eraIndex: 0,
    time: 0,
    muted: false,
    lowQuality: false,
    reducedMotion: reduced,
  };
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Which adjacent era pair a continuous index sits between. */
export function getEraSegment(eraIndex: number): {
  lo: number;
  hi: number;
  t: number;
} {
  const i = clamp(eraIndex, 0, ERA_IDS.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, ERA_IDS.length - 1);
  return { lo, hi, t: i - lo };
}

/**
 * True while the continuous era cursor is mid-flight. Scene modules use this
 * to skip color/texture/material rewrites when the block is at rest, keeping
 * the steady-state render loop allocation-free.
 */
export function eraTransitionActive(eraIndex: number, transitionEpsilon = 0.0001): boolean {
  return Math.abs(eraIndex - Math.round(eraIndex)) > transitionEpsilon;
}