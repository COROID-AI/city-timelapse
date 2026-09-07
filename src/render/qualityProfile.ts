/**
 * qualityProfile.ts
 *
 * Adaptive quality ladder for the performance safeguard.
 *
 * Defines three quality tiers (high / medium / low), each carrying a pixel
 * ratio, a shadow-map resolution, and a draw distance. The FPS monitor walks
 * this ladder using hysteresis thresholds so the renderer degrades gracefully
 * on weak devices and re-upgrades when headroom returns, without ever
 * oscillating between tiers on borderline frame rates.
 *
 * This module is pure data + transition logic: it holds no DOM or render-loop
 * state, which keeps the hysteresis and profile-transition behaviour directly
 * unit-testable.
 */

/** The three supported quality tiers, from best to worst. */
export type QualityTier = 'high' | 'medium' | 'low';

/** The render-quality knobs exposed to the render loop for one tier. */
export interface QualityProfile {
  readonly tier: QualityTier;
  /** Fraction of native render resolution to render at (1.0 = full). */
  readonly pixelRatio: number;
  /** Shadow-map resolution in pixels (power of two). */
  readonly shadowMapResolution: number;
  /** Maximum draw distance in world units. */
  readonly drawDistance: number;
}

/** The complete three-tier ladder. */
export interface QualityLadder {
  readonly high: QualityProfile;
  readonly medium: QualityProfile;
  readonly low: QualityProfile;
}

/** Default ladder values. High = full quality; low = heavily reduced. */
export const QUALITY_LADDER: QualityLadder = Object.freeze({
  high: Object.freeze({
    tier: 'high',
    pixelRatio: 1.0,
    shadowMapResolution: 2048,
    drawDistance: 120,
  }),
  medium: Object.freeze({
    tier: 'medium',
    pixelRatio: 0.75,
    shadowMapResolution: 1024,
    drawDistance: 90,
  }),
  low: Object.freeze({
    tier: 'low',
    pixelRatio: 0.5,
    shadowMapResolution: 512,
    drawDistance: 60,
  }),
});

/** Tiers in descending quality order (used for ordering/stepping). */
export const TIER_ORDER: readonly QualityTier[] = Object.freeze([
  'high',
  'medium',
  'low',
]);

/**
 * Hysteresis thresholds, in frames per second.
 *
 * The step-down and step-up thresholds are separated by a dead band. While the
 * smoothed FPS sits inside the band the current tier is retained, which
 * prevents oscillation when frame rate hovers near a single threshold.
 */
export interface HysteresisThresholds {
  /** Below this FPS the quality tier steps down. */
  readonly stepDownFps: number;
  /** Above this FPS the quality tier steps up. */
  readonly stepUpFps: number;
}

/** Default hysteresis band: step down below 45 FPS, step up above 55 FPS. */
export const DEFAULT_HYSTERESIS: HysteresisThresholds = Object.freeze({
  stepDownFps: 45,
  stepUpFps: 55,
});

/** Look up the profile for a tier, defaulting to the built-in ladder. */
export function profileForTier(
  tier: QualityTier,
  ladder: QualityLadder = QUALITY_LADDER,
): QualityProfile {
  return ladder[tier];
}

/**
 * Decide the next tier from the current tier and the current smoothed FPS.
 *
 * Uses the hysteresis dead band so the tier only changes when FPS is clearly
 * above or below the thresholds, never on a borderline value. This guarantees
 * a single step per crossing (high -> medium -> low and back), never a jump
 * straight from high to low.
 */
export function nextTier(
  current: QualityTier,
  fps: number,
  hysteresis: HysteresisThresholds = DEFAULT_HYSTERESIS,
): QualityTier {
  switch (current) {
    case 'high':
      return fps < hysteresis.stepDownFps ? 'medium' : 'high';
    case 'medium':
      if (fps < hysteresis.stepDownFps) return 'low';
      if (fps > hysteresis.stepUpFps) return 'high';
      return 'medium';
    case 'low':
      return fps > hysteresis.stepUpFps ? 'medium' : 'low';
  }
}

/**
 * True when the FPS sits inside the hysteresis dead band for the current
 * tier, i.e. the tier should be retained to avoid oscillation.
 */
export function inDeadBand(
  _current: QualityTier,
  fps: number,
  hysteresis: HysteresisThresholds = DEFAULT_HYSTERESIS,
): boolean {
  return fps >= hysteresis.stepDownFps && fps <= hysteresis.stepUpFps;
}