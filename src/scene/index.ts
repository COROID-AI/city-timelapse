/**
 * Public surface of the era-agnostic render pipeline.
 *
 * This barrel is the *only* module other owners may import: era content layers,
 * the transition director, the overlay UI and the QA harness all consume the
 * pipeline through it, so internal file layout stays free to change.
 *
 * The contract in one place:
 *
 * - `createRenderPipeline({ canvas, ... })` builds the imperative pipeline
 *   (renderer, scene, world group, camera rig, lighting rig, post-processing
 *   chain, quality setting, instrumentation).
 * - `<SceneCanvas>` mounts that pipeline into React and hands it to children
 *   through `useScenePipeline()`; `<CameraRig>` applies camera presets.
 * - `resolveSceneQuality`, `effectsForTier` and `recommendQualityTier` are the
 *   quality policy; `createFrameInstrumentation` is the frame-time signal.
 * - `POST_EFFECT_ORDER` documents the single pass order the chain builds.
 *
 * Everything is a plain value in and a plain value out: the pipeline imports no
 * era data, creates no global state and can be mounted outside React (the demo
 * harness page does exactly that).
 */

export * from './types'
export * from './controls'
export * from './lighting'
export * from './quality'
export * from './postprocessing'
export * from './instrumentation'
export * from './CameraRig'
export * from './SceneCanvas'

/**
 * Shared quality constants from `src/lib/quality.ts`, re-exported so consumers
 * of the pipeline never need a second import path to read the numbers the
 * pipeline itself is configured with.
 */
export {
  DEFAULT_QUALITY_TIER,
  DEGRADED_FRAME_BUDGET_MS,
  DEGRADED_TARGET_FPS,
  FRAME_BUDGET_MS,
  FRAME_BUDGET_TOLERANCE,
  QUALITY_TIERS,
  QUALITY_TIER_NAMES,
  QUALITY_TIER_ORDER,
  TARGET_FPS,
  downgradeQualityTier,
  isQualityTierName,
  isWithinFrameBudget,
  resolveQualityTier,
  upgradeQualityTier,
} from '../lib/quality'
export type { EffectSettings, QualityTier, QualityTierName } from '../lib/quality'
