import type { EraId } from '../types';

/**
 * Era-tuned post-processing presets.
 *
 * Each era gets a subtle cinematic look that reinforces its period without
 * sacrificing frame budget. Per the plan's Phase 1 recommendation, bloom and
 * grain are kept deliberately subtle — heavy post-processing is the most
 * common cause of cheap-looking 3D scenes.
 *
 * The two anchor eras define the spectrum:
 *  - 1945 — softer, filmic bloom (lower strength, lower threshold so more of
 *    the frame glows gently) plus stronger vignette and heavier film grain.
 *  - 2025 — crisp, modern bloom (higher threshold so only true highlights
 *    bloom) with minimal grain and a lighter vignette.
 *
 * The intermediate eras interpolate between these two poles so the whole
 * timeline shifts coherently.
 */

/** A single era's post-processing look. */
export interface EraPostPreset {
  /** UnrealBloomPass strength — how pronounced the bloom is. */
  bloomStrength: number;
  /** UnrealBloomPass luminance threshold — brighter = only highlights bloom. */
  bloomThreshold: number;
  /** Vignette amount (0 = none, 1 = heavy corner darkening). */
  vignette: number;
  /** Film grain amount (0 = none, 1 = heavy grain). */
  grain: number;
}

/**
 * Per-era presets, keyed by {@link EraId}. Values are tuned to stay subtle:
 * bloom strength stays well under 1.0 and grain under ~0.3.
 */
export const ERA_PRESETS: Readonly<Record<EraId, EraPostPreset>> = {
  '1945': { bloomStrength: 0.55, bloomThreshold: 0.55, vignette: 0.45, grain: 0.3 },
  '1965': { bloomStrength: 0.5, bloomThreshold: 0.6, vignette: 0.4, grain: 0.24 },
  '1985': { bloomStrength: 0.5, bloomThreshold: 0.66, vignette: 0.32, grain: 0.18 },
  '2005': { bloomStrength: 0.45, bloomThreshold: 0.72, vignette: 0.24, grain: 0.12 },
  '2025': { bloomStrength: 0.4, bloomThreshold: 0.8, vignette: 0.18, grain: 0.06 },
};

/**
 * Resolve the preset for an era, falling back to a neutral default for
 * unknown ids so callers never receive `undefined` mid-lifecycle.
 */
export function presetForEra(era: EraId): EraPostPreset {
  return ERA_PRESETS[era] ?? { bloomStrength: 0.45, bloomThreshold: 0.7, vignette: 0.25, grain: 0.15 };
}