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

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep, t clamped to [0,1]. */
export function smoothstep(t: number): number {
  const u = clamp(t);
  return u * u * (3 - 2 * u);
}

export function easeInOutCubic(t: number): number {
  const u = clamp(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
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

/** Focus factor of the era the cursor is currently closest to (0..1). */
export function eraFocus(eraIndex: number): number {
  const seg = getEraSegment(eraIndex);
  return seg.t === 0 ? 1 - Math.abs(eraIndex - seg.lo) : 1 - seg.t;
}