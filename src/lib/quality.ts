/**
 * Frame-budget and quality-tier constants shared by the scene pipeline, the
 * overlay UI and the QA/perf tasks.
 *
 * The renderer picks one tier, then every generator scales its density and
 * effect switches from that tier. Keeping the numbers in one place means a
 * quality change is a data edit, not a code change, and tests can assert the
 * tiers stay ordered (high >= medium >= low).
 */

/** Frames-per-second goal of the interactive scene. */
export const TARGET_FPS = 60

/** Milliseconds a single frame may spend before the budget is exceeded. */
export const FRAME_BUDGET_MS = 1000 / TARGET_FPS

/** Relaxed goal used when a device cannot hold the primary budget. */
export const DEGRADED_TARGET_FPS = 30

/** Milliseconds per frame for the degraded goal. */
export const DEGRADED_FRAME_BUDGET_MS = 1000 / DEGRADED_TARGET_FPS

/** Fraction of the budget that may be treated as measurement noise. */
export const FRAME_BUDGET_TOLERANCE = 0.25

/** Named quality levels, from richest to cheapest. */
export const QUALITY_TIER_NAMES = ['high', 'medium', 'low'] as const

export type QualityTierName = (typeof QUALITY_TIER_NAMES)[number]

/** Ascending cost order, handy for adaptive downgrades. */
export const QUALITY_TIER_ORDER = ['low', 'medium', 'high'] as const satisfies readonly QualityTierName[]

/** Density multipliers (0..1) applied to every procedural population. */
export interface DensitySettings {
  /** Fraction of city parcels that receive a building. */
  readonly buildings: number
  /** Facade/window subdivision multiplier. */
  readonly facadeDetail: number
  /** Storefront, signage and advertisement detail multiplier. */
  readonly storefrontDetail: number
  /** Street furniture and prop multiplier. */
  readonly props: number
  /** Vehicle population multiplier. */
  readonly vehicles: number
  /** Pedestrian population multiplier. */
  readonly pedestrians: number
  /** VFX/particle emission multiplier. */
  readonly particles: number
  /** Camera far plane in world units. */
  readonly drawDistance: number
}

/** Toggles and resolutions for the expensive rendering features. */
export interface EffectSettings {
  /** MSAA on the renderer. */
  readonly antialias: boolean
  /** Shadow map rendering. */
  readonly shadows: boolean
  /** Contact-hardening / soft shadow filtering. */
  readonly softShadows: boolean
  /** Shadow map edge length in pixels. */
  readonly shadowMapSize: number
  /** Bloom pass, used for era-correct neon and signage glow. */
  readonly bloom: boolean
  /** Screen-space ambient occlusion. */
  readonly ssao: boolean
  /** Depth of field used for the tilt-shift look. */
  readonly depthOfField: boolean
  /** Planar/env reflections on glass and wet asphalt. */
  readonly reflections: boolean
  /** Motion blur/velocity pass for vehicles. */
  readonly motionBlur: boolean
  /** Distance fog for depth cues. */
  readonly fog: boolean
  /** Master switch for the post-processing chain. */
  readonly postprocessing: boolean
  /** Edge length in pixels of procedurally generated textures. */
  readonly textureResolution: number
}

/** Complete, self-describing settings record for one quality level. */
export interface QualityTier {
  readonly name: QualityTierName
  /** Short label for the overlay UI. */
  readonly label: string
  readonly targetFps: number
  readonly frameBudgetMs: number
  /** Allowed device pixel ratio range. */
  readonly pixelRatio: { readonly min: number; readonly max: number }
  readonly density: DensitySettings
  readonly effects: EffectSettings
}

/**
 * The three tiers. Numeric values are ordered so `low <= medium <= high` for
 * every density entry, which the unit suite asserts.
 */
export const QUALITY_TIERS: Readonly<Record<QualityTierName, QualityTier>> = {
  high: {
    name: 'high',
    label: 'High',
    targetFps: TARGET_FPS,
    frameBudgetMs: FRAME_BUDGET_MS,
    pixelRatio: { min: 1, max: 2 },
    density: {
      buildings: 1,
      facadeDetail: 1,
      storefrontDetail: 1,
      props: 1,
      vehicles: 1,
      pedestrians: 1,
      particles: 1,
      drawDistance: 400,
    },
    effects: {
      antialias: true,
      shadows: true,
      softShadows: true,
      shadowMapSize: 2048,
      bloom: true,
      ssao: true,
      depthOfField: true,
      reflections: true,
      motionBlur: true,
      fog: true,
      postprocessing: true,
      textureResolution: 512,
    },
  },
  medium: {
    name: 'medium',
    label: 'Medium',
    targetFps: TARGET_FPS,
    frameBudgetMs: FRAME_BUDGET_MS,
    pixelRatio: { min: 1, max: 1.5 },
    density: {
      buildings: 1,
      facadeDetail: 0.7,
      storefrontDetail: 0.75,
      props: 0.65,
      vehicles: 0.7,
      pedestrians: 0.6,
      particles: 0.6,
      drawDistance: 280,
    },
    effects: {
      antialias: true,
      shadows: true,
      softShadows: false,
      shadowMapSize: 1024,
      bloom: true,
      ssao: true,
      depthOfField: false,
      reflections: false,
      motionBlur: false,
      fog: true,
      postprocessing: true,
      textureResolution: 256,
    },
  },
  low: {
    name: 'low',
    label: 'Low',
    targetFps: DEGRADED_TARGET_FPS,
    frameBudgetMs: DEGRADED_FRAME_BUDGET_MS,
    pixelRatio: { min: 0.75, max: 1 },
    density: {
      buildings: 0.9,
      facadeDetail: 0.4,
      storefrontDetail: 0.45,
      props: 0.35,
      vehicles: 0.4,
      pedestrians: 0.3,
      particles: 0.3,
      drawDistance: 180,
    },
    effects: {
      antialias: false,
      shadows: true,
      softShadows: false,
      shadowMapSize: 512,
      bloom: false,
      ssao: false,
      depthOfField: false,
      reflections: false,
      motionBlur: false,
      fog: true,
      postprocessing: false,
      textureResolution: 128,
    },
  },
}

/** Tier used before an adaptive quality controller has measured anything. */
export const DEFAULT_QUALITY_TIER: QualityTierName = 'high'

/** Narrows an untrusted value (URL flag, stored setting) to a tier name. */
export function isQualityTierName(value: unknown): value is QualityTierName {
  return typeof value === 'string' && (QUALITY_TIER_NAMES as readonly string[]).includes(value)
}

/** Resolves a tier name, falling back to the default for unknown input. */
export function resolveQualityTier(name?: string | null): QualityTier {
  return QUALITY_TIERS[isQualityTierName(name) ? name : DEFAULT_QUALITY_TIER]
}

/** Next cheaper tier (or the same tier at the bottom of the ladder). */
export function downgradeQualityTier(name: QualityTierName, steps = 1): QualityTierName {
  const index = QUALITY_TIER_ORDER.indexOf(name)
  const target = Math.max(0, index - Math.max(0, steps))
  return QUALITY_TIER_ORDER[target] ?? 'low'
}

/** Next richer tier (or the same tier at the top of the ladder). */
export function upgradeQualityTier(name: QualityTierName, steps = 1): QualityTierName {
  const index = QUALITY_TIER_ORDER.indexOf(name)
  const target = Math.min(QUALITY_TIER_ORDER.length - 1, index + Math.max(0, steps))
  return QUALITY_TIER_ORDER[target] ?? 'high'
}

/** True when a measured frame time fits the tier budget plus tolerance. */
export function isWithinFrameBudget(frameTimeMs: number, name: QualityTierName = DEFAULT_QUALITY_TIER): boolean {
  const budget = QUALITY_TIERS[name].frameBudgetMs
  return frameTimeMs <= budget * (1 + FRAME_BUDGET_TOLERANCE)
}
