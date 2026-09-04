/**
 * Domain state for the City Time Period Timelapse.
 * Kept completely decoupled from Three.js objects so UI, audio, tests and
 * rendering share one typed contract.
 */
import { EraId, ERA_IDS, eraIndexOf } from './eras';

export interface AppState {
  /** Discrete target era selected by the timeline slider. */
  era: EraId;
  /** Continuous eased position along the era axis (0..ERA_IDS.length-1). */
  eraFloat: number;
  /** True once audio has been unlocked by a user gesture. */
  audioUnlocked: boolean;
  /** Master mute toggle. */
  muted: boolean;
  /** True while a transition tween is running. */
  transitioning: boolean;
  /** Seconds remaining in the current transition. */
  transitionSecondsLeft: number;
  /** Total transition duration for the current change. */
  transitionDuration: number;
  /** Quality preset: 0 = high, 1 = balanced, 2 = low. */
  quality: number;
  /** True when the user prefers reduced motion. */
  reducedMotion: boolean;
  /** True when the scene failed to initialize (WebGL unavailable). */
  failed: boolean;
  /** Human-readable failure message when failed is true. */
  failureMessage: string;
}

export function createInitialState(): AppState {
  return {
    era: ERA_IDS[0],
    eraFloat: 0,
    audioUnlocked: false,
    muted: false,
    transitioning: false,
    transitionSecondsLeft: 0,
    transitionDuration: 0,
    quality: 0,
    reducedMotion: false,
    failed: false,
    failureMessage: '',
  };
}

/** Clamp a value into [0,1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Linear interpolation helper. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map the continuous era float to a 0..1 transition progress across the whole timeline. */
export function eraFloatToProgress(eraFloat: number): number {
  return clamp01(eraFloat / (ERA_IDS.length - 1));
}

/** Index of the era immediately below the float (floor). */
export function eraIndexBelow(eraFloat: number): number {
  return Math.max(0, Math.min(ERA_IDS.length - 1, Math.floor(eraFloat)));
}

/** Index of the era immediately above the float (ceil). */
export function eraIndexAbove(eraFloat: number): number {
  return Math.max(0, Math.min(ERA_IDS.length - 1, Math.ceil(eraFloat)));
}

/** Fractional position between the two surrounding eras. */
export function eraBlend(eraFloat: number): number {
  const below = Math.floor(eraFloat);
  return clamp01(eraFloat - below);
}

/** Ease-in-out cubic for smooth transitions. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Convert a hex color like '#rrggbb' to a THREE.Color representation. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const int = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Blend two hex colors by t (0..1) and return a new hex string. */
export function blendHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Format an era float index into a human-readable year label. */
export function eraFloatToYearLabel(eraFloat: number): string {
  const below = Math.max(0, Math.floor(eraFloat));
  const above = Math.min(ERA_IDS.length - 1, Math.ceil(eraFloat));
  const frac = eraBlend(eraFloat);
  const y0 = ERA_IDS[below] === undefined ? 1945 : eraYear(ERA_IDS[below]);
  const y1 = ERA_IDS[above] === undefined ? 1945 : eraYear(ERA_IDS[above]);
  return String(Math.round(lerp(y0, y1, frac)));
}

function eraYear(id: EraId): number {
  return parseInt(id, 10);
}

/** Convenience accessor used by UI code. */
export function eraIndex(id: EraId): number {
  return eraIndexOf(id);
}