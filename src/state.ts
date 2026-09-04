/**
 * Domain state for the timelapse, decoupled from Three.js objects.
 *
 * The scene animates a continuous `eraFloat` (0..4) that eases toward the
 * selected `eraIndex`. Every module interpolates between the two neighbouring
 * era specs using this float, which gives the "transform in front of your eyes"
 * effect while keeping endpoints deterministic.
 */

import { ERA_IDS, getEraIndex } from './eras';
import type { EraId } from './eras';

/** Quality level — used to scale instancing counts & shadows. */
export type QualityMode = 'high' | 'low';

export interface AppState {
  /** Discrete selected era index (0..4). */
  eraIndex: number;
  /** Continuous eased era coordinate (0..4). */
  eraFloat: number;
  /** Whether audio has been unlocked by a user gesture. */
  audioUnlocked: boolean;
  /** Master mute for SFX. */
  muted: boolean;
  /** Quality toggle. */
  quality: QualityMode;
  /** Reduced-motion preference captured at startup (shortens tweens). */
  reducedMotion: boolean;
  /** Wall-clock seconds since the scene started (drives ambient animation). */
  elapsed: number;
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createInitialState(): AppState {
  return {
    eraIndex: 0,
    eraFloat: 0,
    audioUnlocked: false,
    muted: false,
    quality: 'high',
    reducedMotion: detectReducedMotion(),
    elapsed: 0,
  };
}

export function setEra(state: AppState, era: EraId | number): void {
  const index = typeof era === 'number' ? era : getEraIndex(era);
  const clamped = Math.max(0, Math.min(ERA_IDS.length - 1, Math.round(index)));
  state.eraIndex = clamped;
}

export function getEraId(state: AppState): EraId {
  return ERA_IDS[state.eraIndex];
}

/** Interpolate between two numbers with clamping. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Interpolate between two THREE.Color-like {r,g,b} objects. */
export function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const k = Math.max(0, Math.min(1, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

/** Ease a progress value with smoothstep. */
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}