/**
 * Scene-side quality resolution.
 *
 * `src/lib/quality.ts` owns the *numbers* every subsystem shares (density
 * multipliers, shadow resolutions, effect switches, frame budget). This module
 * turns one of those tier records into the concrete settings a running pipeline
 * needs — clamped device pixel ratio, MSAA sample count, shadow configuration
 * and the resolved post-processing chain — and knows how to apply them to a
 * renderer and when to recommend a tier change.
 *
 * Keeping the mapping pure means the tiers can be asserted without a GPU, and
 * the adaptive controller stays a small function instead of a state machine
 * buried in the render loop.
 */

import { ACESFilmicToneMapping, NoToneMapping, PCFShadowMap, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import type { ShadowMapType, ToneMapping } from 'three'
import {
  FRAME_BUDGET_TOLERANCE,
  QUALITY_TIERS,
  downgradeQualityTier,
  isQualityTierName,
  resolveQualityTier,
  upgradeQualityTier,
  type DensitySettings,
  type QualityTier,
  type QualityTierName,
} from '../lib/quality'
import { clamp } from './controls'
import {
  POST_EFFECT_ORDER,
  type EffectChainEntry,
  type PostEffectName,
  type QualityRecommendation,
  type SceneQuality,
} from './types'

/** Density fields that scale a population count. */
export type DensityKey = keyof DensitySettings

/** Frames that must be measured before an adaptive change is allowed. */
export const MIN_ADAPTIVE_SAMPLES = 24

/** Consecutive over-budget frames that trigger an automatic downgrade. */
export const OVER_BUDGET_STREAK = 30

/** Head-room below the budget that justifies climbing a tier again. */
export const UPGRADE_HEADROOM = 0.62

/** MSAA samples per tier; `0` disables multisampling. */
const MULTISAMPLING_BY_TIER: Readonly<Record<QualityTierName, number>> = {
  high: 4,
  medium: 2,
  low: 0,
}

/** Clamps a device pixel ratio into the tier's allowed range. */
export function clampPixelRatio(tier: QualityTier, devicePixelRatio: number): number {
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return clamp(requested, tier.pixelRatio.min, tier.pixelRatio.max)
}

/**
 * Effects a tier can afford, in canonical pass order.
 *
 * Colour grading and the vignette are part of the pipeline's signature look, so
 * they survive every tier that keeps post-processing at all; bloom and depth of
 * field are the expensive ones the lower tiers drop. A tier with
 * `effects.postprocessing === false` resolves to an empty chain, which the
 * post-processing module renders directly.
 */
export function effectsForTier(tier: QualityTier): PostEffectName[] {
  if (!tier.effects.postprocessing) {
    return []
  }
  return POST_EFFECT_ORDER.filter((name) => {
    if (name === 'bloom') {
      return tier.effects.bloom
    }
    if (name === 'depthOfField') {
      return tier.effects.depthOfField
    }
    return true
  })
}

/** Expands effect names into ordered chain entries. */
export function describeEffectChain(ids: readonly PostEffectName[]): EffectChainEntry[] {
  return POST_EFFECT_ORDER.map((name, order) => ({ name, order, enabled: ids.includes(name) })).filter(
    (entry) => entry.enabled,
  )
}

/** Density multiplier of a population for a tier. */
export function densityFor(tier: QualityTier, key: DensityKey): number {
  return tier.density[key]
}

/**
 * Scales a population count for a tier.
 *
 * A non-empty population never scales to zero — a street keeps its facades and
 * its people even on the cheapest tier — while an empty one stays empty so the
 * caller's own intent is preserved.
 */
export function scaleDensity(count: number, key: DensityKey, tier: QualityTier): number {
  if (!(count > 0)) {
    return 0
  }
  const scaled = Math.round(count * tier.density[key])
  return Math.max(1, scaled)
}

/** True when a tier can afford the given effect. */
export function tierSupportsEffect(tier: QualityTier, name: PostEffectName): boolean {
  return effectsForTier(tier).includes(name)
}

/** Resolves a tier name (or record) into the pipeline's settings record. */
export function resolveSceneQuality(
  tier: QualityTierName | QualityTier,
  options: {
    readonly devicePixelRatio?: number
    /** Overrides the effect chain, e.g. after a WebGL extension failure. */
    readonly effects?: readonly PostEffectName[]
  } = {},
): SceneQuality {
  const resolved = typeof tier === 'string' ? resolveQualityTier(tier) : tier
  return {
    tier: resolved,
    name: resolved.name,
    pixelRatio: clampPixelRatio(resolved, options.devicePixelRatio ?? 1),
    shadowMapSize: resolved.effects.shadowMapSize,
    shadows: resolved.effects.shadows,
    multisampling: MULTISAMPLING_BY_TIER[resolved.name],
    effects: options.effects ?? effectsForTier(resolved),
    density: resolved.density,
    frameBudgetMs: resolved.frameBudgetMs,
  }
}

/** Renderer surface the quality applier touches (structural, for tests). */
export interface RendererQualityTarget {
  setPixelRatio(value: number): void
  shadowMap: { enabled: boolean; type: ShadowMapType; autoUpdate?: boolean; needsUpdate?: boolean }
  toneMapping: ToneMapping
  toneMappingExposure?: number
  outputColorSpace?: string
}

/**
 * Applies resolved quality settings to a renderer.
 *
 * Tone mapping follows the chain: when the post-processing chain is active it
 * tone-maps after bloom (so bright signage can bloom in HDR), and when the
 * chain is absent the renderer tone-maps directly. Either way the image keeps
 * the same filmic response.
 */
export function applyQualityToRenderer(
  renderer: RendererQualityTarget,
  quality: SceneQuality,
): void {
  const postProcessingActive = quality.effects.length > 0
  renderer.setPixelRatio(quality.pixelRatio)
  renderer.shadowMap.enabled = quality.shadows
  renderer.shadowMap.type = quality.multisampling > 0 && quality.shadows ? PCFSoftShadowMap : PCFShadowMap
  renderer.shadowMap.needsUpdate = true
  renderer.toneMapping = postProcessingActive ? NoToneMapping : ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace
}

/** Inputs of the adaptive quality recommendation. */
export interface QualityRecommendationInput {
  /** Tier currently in use. */
  readonly current: QualityTierName
  /** Rolling average frame time in milliseconds. */
  readonly averageFrameTimeMs: number
  /** Consecutive frames that missed the budget. */
  readonly consecutiveOverBudgetFrames: number
  /** Frames measured so far (the controller waits for a usable sample). */
  readonly samples: number
}

/**
 * Recommends the next quality tier from measured frame time.
 *
 * The pipeline only applies the recommendation when `adaptiveQuality` is on, so
 * demos and tests keep full control of the tier while the QA/perf task can rely
 * on the same pure function.
 */
export function recommendQualityTier(input: QualityRecommendationInput): QualityRecommendation {
  const { current, averageFrameTimeMs, consecutiveOverBudgetFrames, samples } = input
  if (samples < MIN_ADAPTIVE_SAMPLES || !Number.isFinite(averageFrameTimeMs)) {
    return { tier: current, changed: false, reason: 'holding' }
  }
  const budget = QUALITY_TIERS[current].frameBudgetMs
  if (
    averageFrameTimeMs > budget * (1 + FRAME_BUDGET_TOLERANCE) &&
    consecutiveOverBudgetFrames >= OVER_BUDGET_STREAK
  ) {
    const next = downgradeQualityTier(current)
    return next === current
      ? { tier: current, changed: false, reason: 'holding' }
      : { tier: next, changed: true, reason: 'over-budget' }
  }
  if (averageFrameTimeMs < budget * UPGRADE_HEADROOM && consecutiveOverBudgetFrames === 0) {
    const next = upgradeQualityTier(current)
    return next === current
      ? { tier: current, changed: false, reason: 'steady' }
      : { tier: next, changed: true, reason: 'under-budget' }
  }
  return { tier: current, changed: false, reason: 'steady' }
}

/** Narrows an untrusted quality name (re-exported for consumers). */
export { isQualityTierName }
