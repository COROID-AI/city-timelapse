/**
 * Quality tiers for City Time Period Timelapse.
 *
 * Low / Medium / High control the three heaviest render costs:
 *
 * - `pixelRatio`   — renderer pixel scaling (drawing-buffer resolution).
 * - `shadowMapSize`— per-light directional shadow-map resolution (powers of
 *   two; the engine allocates one render target per shadow-casting light).
 * - `bloom`        — UnrealBloom threshold / intensity budget for the
 *   post-processing pass (0 disables the bloom effect entirely).
 *
 * Tiers are intentionally coarse so switching is a cheap, deterministic
 * lookup. The composed app (`src/fx/postProcessing.ts`) owns the renderer
 * and light objects; it consumes these constants and exposes
 * `setQuality(tier)`.
 *
 * Pure data + tiny math only — no THREE imports, no DOM access.
 */

/** Canonical quality tiers. `'ultra'` maps to High for API compatibility. */
export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

/** Stable vertical order used by FPS-based automatic selection. */
export const TIER_ORDER: readonly QualityTier[] = ['low', 'medium', 'high'];

/** Target FPS used by the automatic tier controller. */
export const TARGET_FPS = 60;

/** FPS readings below this threshold trigger a downgrade. */
export const LOW_FPS_THRESHOLD = 48;

/** FPS readings at/above this threshold allow an upgrade. */
export const HIGH_FPS_THRESHOLD = 58;

/**
 * Hysteresis: consecutive readings must agree before the tier changes, so a
 * single dropped frame never causes flapping between tiers.
 */
export const HYSTERESIS_FRAMES = 30;

/** Evaluation period in seconds for the rolling FPS measurement window. */
export const FPS_WINDOW_SECONDS = 1.0;

/** Bounds for tuning without changing the tier table. */
export const TIER_TUNING_BOUNDS = Object.freeze({
  minPixelRatio: 0.75,
  maxPixelRatio: 3,
  minShadowMapSize: 128,
  maxShadowMapSize: 4096,
  minBloomScore: 0,
  maxBloomScore: 1,
});

/** One tier's render settings. */
export interface QualitySettings {
  readonly pixelRatio: number;
  readonly shadowMapSize: number;
  readonly bloom: number;
}

/** The full tier table, frozen for determinism. */
export const QUALITY_TIERS: Readonly<Record<'low' | 'medium' | 'high', QualitySettings>> =
  Object.freeze({
    low: Object.freeze({
      pixelRatio: 1,
      shadowMapSize: 256,
      bloom: 0,
    }),
    medium: Object.freeze({
      pixelRatio: 1.25,
      shadowMapSize: 512,
      bloom: 0.55,
    }),
    high: Object.freeze({
      pixelRatio: 1.5,
      shadowMapSize: 1024,
      bloom: 1,
    }),
  });

/** Maps the legacy 'ultra' alias onto the high tier. */
export function normalizeTier(tier: QualityTier): 'low' | 'medium' | 'high' {
  return tier === 'ultra' ? 'high' : tier;
}

/** Returns the frozen settings for a tier. */
export function getQualitySettings(tier: QualityTier): QualitySettings {
  return QUALITY_TIERS[normalizeTier(tier)];
}

/** Maps a canonical tier back to a QualitySettings row. */
export function settingsForTier(tier: CanonicalTier): QualitySettings {
  return QUALITY_TIERS[tier];
}

/**
 * Applies a safe, bounded tuning factor to a tier setting.
 * Used by the FPS controller to fine-tune within a tier before changing it.
 */
export function scaleSetting(value: number, factor: number, min: number, max: number): number {
  const scaled = value * factor;
  return Math.max(min, Math.min(max, scaled));
}

/**
 * Clamps a shadow-map size to the engine's power-of-two requirement.
 */
export function clampShadowMapSize(size: number): number {
  if (size <= 1) return 1;
  let p = 1;
  while (p < size) p *= 2;
  return Math.min(4096, p);
}

/**
 * Selects a tier from a rolling FPS average using hysteresis.
 *
 * - `fps <= LOW_FPS_THRESHOLD`  → step one tier down (capped at low).
 * - `fps >= HIGH_FPS_THRESHOLD` → step one tier up (capped at high).
 * - otherwise the tier is kept; `reducedMotion` only ever *keeps* the current
 *   tier (it never downgrades the visual resolution).
 *
 * @param currentTier  the active tier ('low' | 'medium' | 'high').
 * @param fps          measured frames per second over the evaluation window.
 * @returns the tier the controller should switch to.
 */
export function selectTierForFps(currentTier: 'low' | 'medium' | 'high', fps: number): 'low' | 'medium' | 'high' {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (!Number.isFinite(fps)) return currentTier;
  if (fps <= LOW_FPS_THRESHOLD) {
    return TIER_ORDER[Math.max(0, idx - 1)];
  }
  if (fps >= HIGH_FPS_THRESHOLD) {
    return TIER_ORDER[Math.min(TIER_ORDER.length - 1, idx + 1)];
  }
  return currentTier;
}

/** Internal alias so callers can index the tier table with a canonical tier. */
export type CanonicalTier = 'low' | 'medium' | 'high';