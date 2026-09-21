/**
 * Per-era colour grade and emissive/neon tuning.
 *
 * The era record already carries a full grade (`atmosphere.colourGrade`): a
 * lift/gamma/gain film response, saturation, contrast, white balance, vignette,
 * grain and a bloom pair. This module maps those onto the values the render
 * pipeline's grade pass and bloom pass can actually execute
 * (`exposure`/`contrast`/`saturation`/`temperature`/`tint`, bloom strength and
 * threshold, vignette offset/darkness, optional depth of field), and derives the
 * emissive tuning that decides how strongly neon, signage, headlights and the
 * layer's own glow accents bloom under that grade.
 *
 * The mapping is pure: `gradeToPostProcessingPatch` is what the composition test
 * asserts against the pipeline's real `createPostProcessingParams` builder.
 */

import type { ColourChannel, EraDefinition } from '../era'
import type { PostProcessingParamsPatch } from '../scene'
import { mixHexColors, mixNumber } from './sky'
import type { EmissiveTuning, GradeConfig, VfxEraTable } from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Glow floor, so even a daylight era keeps a readable lamp. */
export const EMISSIVE_GLOW_BASE = 1.2

/** Gain applied to `lighting.artificialLightIntensity` for the glow material. */
export const EMISSIVE_GLOW_GAIN = 5

/** Upper bound of the glow material's `emissiveIntensity`. */
export const MAX_EMISSIVE_GLOW = 12

/** Where the vignette starts at zero darkness and at full darkness. */
export const VIGNETTE_OFFSET_AT_NONE = 0.6
export const VIGNETTE_OFFSET_AT_FULL = 0.16

/** Which passes the running quality tier can afford. */
export interface GradeAvailability {
  /** False disables the whole chain: the pipeline renders directly. */
  readonly postprocessing: boolean
  readonly bloom: boolean
  readonly depthOfField: boolean
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

function mixChannels(from: ColourChannel, to: ColourChannel, t: number): ColourChannel {
  return [
    mixNumber(from[0], to[0], t),
    mixNumber(from[1], to[1], t),
    mixNumber(from[2], to[2], t),
  ]
}

/** Vignette start radius for a darkness value. */
export function vignetteOffsetFor(darkness: number): number {
  const amount = Math.min(1, Math.max(0, darkness))
  const offset = VIGNETTE_OFFSET_AT_NONE + (VIGNETTE_OFFSET_AT_FULL - VIGNETTE_OFFSET_AT_NONE) * amount
  return Math.min(VIGNETTE_OFFSET_AT_NONE, Math.max(VIGNETTE_OFFSET_AT_FULL, offset))
}

/**
 * Resolves the colour grade of one era.
 *
 * Era values pass through unchanged wherever the pipeline can execute them; the
 * per-era table only scales bloom and chooses the depth-of-field look.
 */
export function resolveGradeConfig(era: EraDefinition, table: VfxEraTable): GradeConfig {
  const grade = era.atmosphere.colourGrade
  return {
    lift: grade.lift,
    gamma: grade.gamma,
    gain: grade.gain,
    exposure: era.lighting.exposure,
    contrast: grade.contrast,
    saturation: grade.saturation,
    temperature: grade.temperature,
    tint: grade.tint,
    vignette: grade.vignette,
    vignetteOffset: vignetteOffsetFor(grade.vignette),
    grain: grade.grain,
    bloomIntensity: grade.bloomIntensity * table.grade.bloomScale,
    bloomThreshold: grade.bloomThreshold,
    bloomSmoothing: table.grade.bloomSmoothing,
    bloomRadius: table.grade.bloomRadius,
    depthOfField: table.grade.depthOfField,
  }
}

/** Interpolates two resolved grades; drives a staged era change. */
export function blendGradeConfig(from: GradeConfig, to: GradeConfig, t: number): GradeConfig {
  if (t <= 0) {
    return from
  }
  if (t >= 1) {
    return to
  }
  return {
    lift: mixChannels(from.lift, to.lift, t),
    gamma: mixChannels(from.gamma, to.gamma, t),
    gain: mixChannels(from.gain, to.gain, t),
    exposure: mixNumber(from.exposure, to.exposure, t),
    contrast: mixNumber(from.contrast, to.contrast, t),
    saturation: mixNumber(from.saturation, to.saturation, t),
    temperature: mixNumber(from.temperature, to.temperature, t),
    tint: mixNumber(from.tint, to.tint, t),
    vignette: mixNumber(from.vignette, to.vignette, t),
    vignetteOffset: mixNumber(from.vignetteOffset, to.vignetteOffset, t),
    grain: mixNumber(from.grain, to.grain, t),
    bloomIntensity: mixNumber(from.bloomIntensity, to.bloomIntensity, t),
    bloomThreshold: mixNumber(from.bloomThreshold, to.bloomThreshold, t),
    bloomSmoothing: mixNumber(from.bloomSmoothing, to.bloomSmoothing, t),
    bloomRadius: mixNumber(from.bloomRadius, to.bloomRadius, t),
    depthOfField: {
      // The focus look is a discrete choice per era; the nearer era wins.
      ...(t < 0.5 ? from.depthOfField : to.depthOfField),
    },
  }
}

/**
 * Resolves the emissive/neon tuning of one era.
 *
 * `glowIntensity` follows the era's artificial light: a 1945 block has lamps
 * that barely glow, a 1985 block is lit by neon, and 2025 mixes bright LED
 * signage with a dimmer, cleaner sky.
 */
export function resolveEmissiveTuning(
  era: EraDefinition,
  table: VfxEraTable,
  grade: GradeConfig,
): EmissiveTuning {
  const glow = EMISSIVE_GLOW_BASE + era.lighting.artificialLightIntensity * table.emissive.glowScale * EMISSIVE_GLOW_GAIN
  return {
    color: era.lighting.artificialLightColor,
    glowIntensity: Math.min(MAX_EMISSIVE_GLOW, Math.max(0, glow)),
    neonBoost: table.emissive.neonBoost,
    headlightScale: era.traffic.headlightIntensity,
    bloomIntensity: grade.bloomIntensity,
    bloomThreshold: grade.bloomThreshold,
  }
}

/** Interpolates two emissive tunings; drives a staged era change. */
export function blendEmissiveTuning(
  from: EmissiveTuning,
  to: EmissiveTuning,
  t: number,
): EmissiveTuning {
  if (t <= 0) {
    return from
  }
  if (t >= 1) {
    return to
  }
  return {
    color: mixHexColors(from.color, to.color, t),
    glowIntensity: mixNumber(from.glowIntensity, to.glowIntensity, t),
    neonBoost: mixNumber(from.neonBoost, to.neonBoost, t),
    headlightScale: mixNumber(from.headlightScale, to.headlightScale, t),
    bloomIntensity: mixNumber(from.bloomIntensity, to.bloomIntensity, t),
    bloomThreshold: mixNumber(from.bloomThreshold, to.bloomThreshold, t),
  }
}

/**
 * Maps a resolved grade onto the pipeline's post-processing patch.
 *
 * Passes the running tier cannot afford are switched off here (and the whole
 * chain is disabled when the tier has no post-processing at all), which is how
 * the layer degrades to the plain pipeline on cheap hardware instead of
 * throwing or asking for effects the tier does not have.
 */
export function gradeToPostProcessingPatch(
  grade: GradeConfig,
  emissive: EmissiveTuning,
  availability: GradeAvailability,
): PostProcessingParamsPatch {
  const depthOfField = grade.depthOfField
  return {
    enabled: availability.postprocessing,
    grade: {
      enabled: true,
      exposure: grade.exposure,
      contrast: grade.contrast,
      saturation: grade.saturation,
      temperature: grade.temperature,
      tint: grade.tint,
    },
    bloom: {
      enabled: availability.bloom,
      intensity: emissive.bloomIntensity,
      threshold: emissive.bloomThreshold,
      smoothing: grade.bloomSmoothing,
      radius: grade.bloomRadius,
    },
    vignette: {
      enabled: true,
      offset: grade.vignetteOffset,
      darkness: grade.vignette,
    },
    depthOfField: {
      enabled: availability.depthOfField && depthOfField.enabled,
      focusDistance: depthOfField.focusDistance,
      focusRange: depthOfField.focusRange,
      bokehScale: depthOfField.bokehScale,
    },
  }
}
