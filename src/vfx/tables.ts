/**
 * The shipped per-era atmosphere table, and the entry points that turn one era
 * into an applied atmosphere.
 *
 * This module is the composition point of the layer: it reads an era record from
 * the registry, resolves every domain (sky, fog, grade, emissive tuning, weather
 * particles, plumes) with the shared generators of the sibling modules, folds the
 * result into the render pipeline's public parameter surface with the pipeline's
 * *own* builders (`createLightingParams`, `createPostProcessingParams`) and writes
 * it through the target.
 *
 * Effect code never branches on a year: adding a period is one record in the era
 * registry plus one entry in {@link VFX_ERA_TABLES}, and everything else follows.
 */

import { ERA_REGISTRY, isEraId } from '../era'
import type { EraDefinition, EraId, EraRegistry } from '../era'
import { DEFAULT_QUALITY_TIER } from '../lib/quality'
import type { QualityTierName } from '../lib/quality'
import {
  createLightingParams,
  createPostProcessingParams,
  degreesToRadians,
  resolveSceneQuality,
} from '../scene'
import type { LightingParams, PostProcessingParams, SceneQuality } from '../scene'
import { blendFogConfig, resolveFogConfig } from './fog'
import {
  blendEmissiveTuning,
  gradeToPostProcessingPatch,
  resolveEmissiveTuning,
  resolveGradeConfig,
  blendGradeConfig,
} from './grade'
import type { GradeAvailability } from './grade'
import { blendParticlePlans, resolveParticlePlan } from './particles'
import { blendPlumePlans, resolvePlumePlan } from './plumes'
import {
  blendSkyConfig,
  hexToChannels,
  isNightEra,
  mixHexColors,
  mixNumber,
  resolveSkyConfig,
} from './sky'
import type {
  EmissiveTuning,
  FogConfig,
  GradeConfig,
  SkyConfig,
  VfxContext,
  VfxEraTable,
  VfxSnapshot,
  VfxTarget,
  VfxTransitionRequest,
} from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ambient lift applied when an era's key light sits at or below the horizon.
 *
 * The era tables already describe their own night (dark gradients, low sun
 * intensity, strong artificial light), so the lighting rig's night simplification
 * stays off and this lift stands in for its city glow.
 */
export const NIGHT_AMBIENT_FACTOR = 1.35

/** Atmosphere distance at or above which two eras are "measurably different". */
export const MEASURABLE_ATMOSPHERE_DISTANCE = 0.02

/* -------------------------------------------------------------------------- */
/* Per-era table                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The shipped atmosphere table.
 *
 * Every value here is data. The fields mirror `VfxEraTable`; haze density, fog
 * colour, sun position and the whole colour grade are *not* repeated, because
 * they already live in the era registry — the table only carries what the era
 * model leaves to the atmosphere layer.
 */
export const VFX_ERA_TABLES: Readonly<Record<EraId, VfxEraTable>> = Object.freeze({
  '1945': {
    eraId: '1945',
    sky: {
      sunDiscSizeDeg: 1.5,
      sunGlow: 0.4,
      horizonSharpness: 0.55,
      groundColor: '#4b4237',
      cloudOpacity: 0.62,
      starOpacity: 0.15,
    },
    haze: { densityScale: 0.32, groundHazeOpacity: 0.55, wetSurfaceLift: 0.22 },
    grade: {
      bloomScale: 0.85,
      bloomSmoothing: 0.3,
      bloomRadius: 0.5,
      depthOfField: { enabled: false, focusDistance: 32, focusRange: 18, bokehScale: 1.8 },
    },
    emissive: { glowScale: 0.6, neonBoost: 0.7 },
    particles: {
      countScale: 1,
      sizeScale: 1,
      speedScale: 1,
      ambientStrength: { leaves: 0.8, dust: 1 },
    },
    plumes: {
      rates: { exhaust: 4, steam: 2.2, smoke: 6, evGlow: 0 },
      sizeScale: 1,
      riseScale: 1,
      lifetimeScale: 1.15,
      baseline: [
        { id: 'coal-vent-north', kind: 'smoke', position: [-18, 9, -14], intensity: 0.8 },
        { id: 'chimney-row', kind: 'smoke', position: [14, 12, -20], intensity: 0.65 },
        { id: 'baker-flue', kind: 'steam', position: [-6, 7, 16], intensity: 0.45 },
      ],
      ambient: { birds: 14, aircraft: 0, orbitRadius: 50, altitude: 16 },
    },
  },
  '1965': {
    eraId: '1965',
    sky: {
      sunDiscSizeDeg: 0.9,
      sunGlow: 0.18,
      horizonSharpness: 1.45,
      groundColor: '#6d7472',
      cloudOpacity: 0.18,
      starOpacity: 0,
    },
    haze: { densityScale: 0.26, groundHazeOpacity: 0.32, wetSurfaceLift: 0.12 },
    grade: {
      bloomScale: 1,
      bloomSmoothing: 0.2,
      bloomRadius: 0.7,
      depthOfField: { enabled: false, focusDistance: 34, focusRange: 20, bokehScale: 1.6 },
    },
    emissive: { glowScale: 0.7, neonBoost: 0.9 },
    particles: {
      countScale: 0.85,
      sizeScale: 0.85,
      speedScale: 1.05,
      ambientStrength: { leaves: 0.45, dust: 0.6 },
    },
    plumes: {
      rates: { exhaust: 7, steam: 3.5, smoke: 4.5, evGlow: 0.05 },
      sizeScale: 0.85,
      riseScale: 1.15,
      lifetimeScale: 0.85,
      baseline: [
        { id: 'workshop-stack', kind: 'smoke', position: [20, 10, -10], intensity: 0.5 },
        { id: 'diner-flue', kind: 'steam', position: [-16, 6, 12], intensity: 0.55 },
      ],
      ambient: { birds: 9, aircraft: 0, orbitRadius: 56, altitude: 20 },
    },
  },
  '1985': {
    eraId: '1985',
    sky: {
      sunDiscSizeDeg: 1.8,
      sunGlow: 0.55,
      horizonSharpness: 2.2,
      groundColor: '#0d0f1c',
      cloudOpacity: 0.45,
      starOpacity: 0.9,
    },
    haze: { densityScale: 0.3, groundHazeOpacity: 0.7, wetSurfaceLift: 0.26 },
    grade: {
      bloomScale: 1.3,
      bloomSmoothing: 0.34,
      bloomRadius: 0.95,
      depthOfField: { enabled: true, focusDistance: 26, focusRange: 14, bokehScale: 2.4 },
    },
    emissive: { glowScale: 1.5, neonBoost: 1.8 },
    particles: {
      countScale: 1.15,
      sizeScale: 1.1,
      speedScale: 1.15,
      ambientStrength: { leaves: 0.35, dust: 0.8 },
    },
    plumes: {
      rates: { exhaust: 6, steam: 6.5, smoke: 4, evGlow: 0.15 },
      sizeScale: 1.1,
      riseScale: 1,
      lifetimeScale: 1.05,
      baseline: [
        { id: 'subway-grate', kind: 'steam', position: [2, 1.2, -8], intensity: 0.7 },
        { id: 'laundry-vent', kind: 'steam', position: [-20, 8, 6], intensity: 0.6 },
        { id: 'roof-stack', kind: 'smoke', position: [18, 11, 12], intensity: 0.4 },
      ],
      ambient: { birds: 3, aircraft: 1, orbitRadius: 44, altitude: 24 },
    },
  },
  '2005': {
    eraId: '2005',
    sky: {
      sunDiscSizeDeg: 1.1,
      sunGlow: 0.22,
      horizonSharpness: 1.15,
      groundColor: '#5d6168',
      cloudOpacity: 0.38,
      starOpacity: 0,
    },
    haze: { densityScale: 0.28, groundHazeOpacity: 0.42, wetSurfaceLift: 0.14 },
    grade: {
      bloomScale: 1.05,
      bloomSmoothing: 0.22,
      bloomRadius: 0.75,
      depthOfField: { enabled: false, focusDistance: 36, focusRange: 22, bokehScale: 1.8 },
    },
    emissive: { glowScale: 0.8, neonBoost: 1.1 },
    particles: {
      countScale: 0.9,
      sizeScale: 0.9,
      speedScale: 1,
      ambientStrength: { leaves: 0.34, dust: 0.5 },
    },
    plumes: {
      rates: { exhaust: 5, steam: 4.2, smoke: 3.2, evGlow: 0.6 },
      sizeScale: 0.95,
      riseScale: 1.05,
      lifetimeScale: 0.95,
      baseline: [
        { id: 'hvac-outlet', kind: 'steam', position: [10, 5, -16], intensity: 0.4 },
        { id: 'cafe-flue', kind: 'smoke', position: [-12, 6, 10], intensity: 0.35 },
      ],
      ambient: { birds: 11, aircraft: 1, orbitRadius: 60, altitude: 26 },
    },
  },
  '2025': {
    eraId: '2025',
    sky: {
      sunDiscSizeDeg: 1,
      sunGlow: 0.16,
      horizonSharpness: 1.7,
      groundColor: '#5a5f66',
      cloudOpacity: 0.24,
      starOpacity: 0.05,
    },
    haze: { densityScale: 0.24, groundHazeOpacity: 0.3, wetSurfaceLift: 0.1 },
    grade: {
      bloomScale: 1.15,
      bloomSmoothing: 0.18,
      bloomRadius: 0.8,
      depthOfField: { enabled: true, focusDistance: 30, focusRange: 16, bokehScale: 2 },
    },
    emissive: { glowScale: 1.2, neonBoost: 1.4 },
    particles: {
      countScale: 0.8,
      sizeScale: 0.95,
      speedScale: 0.95,
      ambientStrength: { leaves: 0.22, dust: 0.45 },
    },
    plumes: {
      // The 2025 fleet is all-electric (see the era record's `traffic.modelKeys`),
      // so the period has no exhaust of its own: its vehicle accent is the
      // EV-whine glow, plus steam and vent smoke from the block itself.
      rates: { exhaust: 0, steam: 3.2, smoke: 2.6, evGlow: 1.6 },
      sizeScale: 0.9,
      riseScale: 1.1,
      lifetimeScale: 0.9,
      baseline: [
        { id: 'heat-pump-vent', kind: 'steam', position: [12, 4.5, -14], intensity: 0.3 },
        { id: 'kitchen-extract', kind: 'smoke', position: [-14, 6.5, 9], intensity: 0.28 },
        { id: 'charging-bay', kind: 'evGlow', position: [22, 2, 4], intensity: 0.35 },
      ],
      ambient: { birds: 16, aircraft: 2, orbitRadius: 64, altitude: 30 },
    },
  },
})

/** Thrown when an era has no atmosphere table, which is always a data mistake. */
export class MissingVfxTableError extends Error {
  readonly eraId: unknown

  constructor(eraId: unknown) {
    super(`No VFX atmosphere table for era ${String(eraId)}. Add one to VFX_ERA_TABLES.`)
    this.name = 'MissingVfxTableError'
    this.eraId = eraId
  }
}

/** Atmosphere table of an era. Throws {@link MissingVfxTableError} when absent. */
export function vfxTableFor(eraId: EraId): VfxEraTable {
  const table = isEraId(eraId) ? VFX_ERA_TABLES[eraId] : undefined
  if (table === undefined) {
    throw new MissingVfxTableError(eraId)
  }
  return table
}

/* -------------------------------------------------------------------------- */
/* Snapshot resolution                                                         */
/* -------------------------------------------------------------------------- */

/** Inputs of {@link resolveVfxSnapshot}. */
export interface ResolveVfxSnapshotInput {
  readonly era: EraDefinition
  readonly table: VfxEraTable
  /** Resolved quality of the pipeline the snapshot will be written into. */
  readonly quality: SceneQuality
  /** Lowers particle counts for the reduced-motion path. */
  readonly reducedMotion?: boolean
}

/** Lighting parameters an era writes into the pipeline. */
export function resolveLightingParams(
  era: EraDefinition,
  sky: SkyConfig,
  fog: FogConfig,
  night: boolean,
): LightingParams {
  return createLightingParams({
    sunAzimuth: degreesToRadians(era.lighting.sunAzimuthDeg),
    sunElevation: degreesToRadians(era.lighting.sunElevationDeg),
    sunColor: era.lighting.sunColor,
    sunIntensity: era.lighting.sunIntensity,
    ambientIntensity: era.lighting.ambientIntensity * (night ? NIGHT_AMBIENT_FACTOR : 1),
    skyTint: era.lighting.skyTopColor,
    groundTint: era.palette.roadSurface,
    // See NIGHT_AMBIENT_FACTOR: the era's own colours are the night look.
    night: false,
    fogColor: fog.color,
    fogDensity: fog.density,
    backgroundColor: sky.horizonColor,
  })
}

/** Passes the running tier can afford, read from its resolved effect chain. */
export function gradeAvailabilityFor(quality: SceneQuality): GradeAvailability {
  return {
    postprocessing: quality.effects.length > 0,
    bloom: quality.effects.includes('bloom'),
    depthOfField: quality.effects.includes('depthOfField'),
  }
}

/** Post-processing parameters an era writes into the pipeline. */
export function resolvePostProcessingParams(
  grade: GradeConfig,
  emissive: EmissiveTuning,
  quality: SceneQuality,
): PostProcessingParams {
  return createPostProcessingParams(gradeToPostProcessingPatch(grade, emissive, gradeAvailabilityFor(quality)))
}

/**
 * Resolves a complete atmosphere snapshot.
 *
 * Pure: no three.js object, no renderer and no global state is touched, which is
 * why the unit suite can compare five eras and the composition suite can assert
 * the exact values handed to the pipeline's builders.
 */
export function resolveVfxSnapshot(input: ResolveVfxSnapshotInput): VfxSnapshot {
  const { era, table, quality } = input
  const sky = resolveSkyConfig(era, table)
  const fog = resolveFogConfig(era, table)
  const grade = resolveGradeConfig(era, table)
  const emissive = resolveEmissiveTuning(era, table, grade)
  const particles = resolveParticlePlan({
    era,
    table,
    quality: quality.tier,
    reducedMotion: input.reducedMotion === true,
  })
  const plumes = resolvePlumePlan(era, table)
  const night = isNightEra(era)

  return {
    eraId: era.id,
    year: era.year,
    eraLabel: era.label,
    night,
    qualityTier: quality.name,
    sky,
    fog,
    grade,
    emissive,
    particles,
    plumes,
    lighting: resolveLightingParams(era, sky, fog, night),
    postProcessing: resolvePostProcessingParams(grade, emissive, quality),
  }
}

function blendQuality(
  from: VfxSnapshot,
  to: VfxSnapshot,
  t: number,
): SceneQuality {
  // The destination tier wins: a transition always lands on the era being
  // selected, and both ends of a staged change share one running pipeline.
  return resolveSceneQuality(t < 0.5 ? from.qualityTier : to.qualityTier, { devicePixelRatio: 1 })
}

/**
 * Interpolates two snapshots for a staged era change.
 *
 * `t <= 0` and `t >= 1` return their argument *unchanged*, so a transition lands
 * on exactly the era's own values rather than on a floating-point approximation
 * of them — that exactness is what the director and the composition suite rely on.
 * Sun, fog, grade and glow interpolate; the discrete families (weather pools and
 * emitters) switch at the midpoint.
 */
export function blendVfxSnapshots(from: VfxSnapshot, to: VfxSnapshot, t: number): VfxSnapshot {
  if (t <= 0) {
    return from
  }
  if (t >= 1) {
    return to
  }
  const sky = blendSkyConfig(from.sky, to.sky, t)
  const fog = blendFogConfig(from.fog, to.fog, t)
  const grade = blendGradeConfig(from.grade, to.grade, t)
  const emissive = blendEmissiveTuning(from.emissive, to.emissive, t)
  const particles = blendParticlePlans(from.particles, to.particles, t)
  const plumes = blendPlumePlans(from.plumes, to.plumes, t)
  const quality = blendQuality(from, to, t)
  const era = t < 0.5 ? from : to

  return {
    eraId: era.eraId,
    year: era.year,
    eraLabel: era.eraLabel,
    night: era.night,
    qualityTier: quality.name,
    sky,
    fog,
    grade,
    emissive,
    particles,
    plumes,
    lighting: blendLighting(sky, fog, from, to, t),
    postProcessing: resolvePostProcessingParams(grade, emissive, quality),
  }
}

/**
 * Blends the two ends' lighting parameters.
 *
 * The blend runs on the pipeline's own parameter record (`LightingParams`), so a
 * staged change produces the same shape of value an era switch does, and the
 * era's identity fields (sun angles, intensity, tints) interpolate from one to
 * the other; the fog and background colours come from the already-blended sky and
 * fog configs so every surface agrees on the same intermediate atmosphere.
 */
function blendLighting(
  sky: SkyConfig,
  fog: FogConfig,
  from: VfxSnapshot,
  to: VfxSnapshot,
  t: number,
): LightingParams {
  const start = from.lighting
  const end = to.lighting
  return createLightingParams({
    sunAzimuth: mixNumber(start.sunAzimuth, end.sunAzimuth, t),
    sunElevation: mixNumber(start.sunElevation, end.sunElevation, t),
    sunColor: sky.sunColor,
    sunIntensity: mixNumber(start.sunIntensity, end.sunIntensity, t),
    ambientIntensity: mixNumber(start.ambientIntensity, end.ambientIntensity, t),
    skyTint: mixHexColors(from.lighting.skyTint, to.lighting.skyTint, t),
    groundTint: mixHexColors(from.lighting.groundTint, to.lighting.groundTint, t),
    // The era tables carry their own night look; see NIGHT_AMBIENT_FACTOR.
    night: false,
    fogColor: fog.color,
    fogDensity: fog.density,
    backgroundColor: sky.horizonColor,
  })
}

/* -------------------------------------------------------------------------- */
/* Applying to a target                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Writes a snapshot into the pipeline's public parameter surface.
 *
 * Both writes are individually guarded: a pipeline whose post-processing chain is
 * unavailable (no extensions, a lost context, a tier without the chain) must not
 * take the atmosphere — or the application — down with it, so the layer falls
 * back to rendering with whatever surface still works.
 */
export function applyVfxSnapshot(snapshot: VfxSnapshot, target: VfxTarget): VfxSnapshot {
  try {
    target.applyLighting(snapshot.lighting)
  } catch {
    // Direct-render fallback: keep the snapshot, drop the failed write.
  }
  try {
    target.applyPostProcessing(snapshot.postProcessing)
  } catch {
    // See above: the plain pipeline is a valid atmosphere-less fallback.
  }
  return snapshot
}

/** Resolved quality of the target the context drives. */
function qualityForContext(ctx: VfxContext): SceneQuality {
  const live = ctx.target.quality
  if (ctx.quality !== undefined) {
    return resolveSceneQuality(ctx.quality, { devicePixelRatio: 1 })
  }
  const name: QualityTierName = ctx.qualityTier ?? live?.name ?? DEFAULT_QUALITY_TIER
  if (ctx.qualityTier === undefined && live !== undefined) {
    // Mirror the running pipeline, including any effect chain it had to drop.
    return resolveSceneQuality(name, { devicePixelRatio: 1, effects: live.effects })
  }
  return resolveSceneQuality(name, { devicePixelRatio: 1 })
}

function resolveSnapshotFor(eraId: EraId, ctx: VfxContext): VfxSnapshot {
  const registry: EraRegistry = ctx.registry ?? ERA_REGISTRY
  return resolveVfxSnapshot({
    era: registry.get(eraId),
    table: vfxTableFor(eraId),
    quality: qualityForContext(ctx),
    reducedMotion: ctx.reducedMotion,
  })
}

/**
 * Applies an era immediately and returns the applied snapshot.
 *
 * This is the reduced-motion path as well as the normal selection path: the
 * atmosphere never has to be animated to be correct.
 */
export function applyEra(eraId: EraId, ctx: VfxContext): VfxSnapshot {
  const snapshot = resolveSnapshotFor(eraId, ctx)
  return applyVfxSnapshot(snapshot, ctx.target)
}

/**
 * Applies a staged era change.
 *
 * `instant` (or `t >= 1`) snaps to the destination era exactly, `t <= 0` restores
 * the source era exactly, and anything between interpolates the continuous look
 * while the weather and emitter families switch at the midpoint. The snapshot
 * returned is always the snapshot that was written.
 */
export function applyEraTransition(request: VfxTransitionRequest, ctx: VfxContext): VfxSnapshot {
  const { from, to, t, instant } = request
  if (instant === true || t >= 1) {
    return applyEra(to, ctx)
  }
  if (t <= 0) {
    return applyEra(from, ctx)
  }
  const blended = blendVfxSnapshots(resolveSnapshotFor(from, ctx), resolveSnapshotFor(to, ctx), t)
  return applyVfxSnapshot(blended, ctx.target)
}

/* -------------------------------------------------------------------------- */
/* Comparison helpers                                                          */
/* -------------------------------------------------------------------------- */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Canonical signature of an era's *atmosphere* (not its identity fields). */
export function vfxAtmosphereSignature(snapshot: VfxSnapshot): string {
  return JSON.stringify({
    sky: [
      snapshot.sky.topColor,
      snapshot.sky.horizonColor,
      snapshot.sky.groundColor,
      round(snapshot.sky.sunDiscSizeRad),
      round(snapshot.sky.horizonSharpness),
      round(snapshot.sky.cloudOpacity),
      round(snapshot.sky.starOpacity),
    ],
    sun: [
      round(snapshot.lighting.sunAzimuth),
      round(snapshot.lighting.sunElevation),
      snapshot.lighting.sunColor,
      round(snapshot.lighting.sunIntensity),
    ],
    fog: [
      snapshot.fog.color,
      round(snapshot.fog.density, 6),
      round(snapshot.fog.groundHazeOpacity),
      round(snapshot.fog.groundHazeHeight),
    ],
    grade: [
      round(snapshot.grade.exposure),
      round(snapshot.grade.contrast),
      round(snapshot.grade.saturation),
      round(snapshot.grade.temperature),
      round(snapshot.grade.tint),
      round(snapshot.grade.vignette),
      round(snapshot.grade.bloomIntensity),
      round(snapshot.grade.bloomThreshold),
      snapshot.grade.depthOfField.enabled,
    ],
    emissive: [snapshot.emissive.color, round(snapshot.emissive.glowIntensity)],
    particles: snapshot.particles.kinds.map((kind) => [kind.kind, kind.enabled, kind.count]),
    plumes: [
      snapshot.plumes.kinds.map((kind) => round(kind.ratePerSecond, 3)),
      snapshot.plumes.baseline.map((source) => source.id),
      snapshot.plumes.ambient.birds,
      snapshot.plumes.ambient.aircraft,
    ],
  })
}

/** True when two eras do not share an identical atmosphere. */
export function atmosphereSnapshotsDiffer(left: VfxSnapshot, right: VfxSnapshot): boolean {
  return vfxAtmosphereSignature(left) !== vfxAtmosphereSignature(right)
}

/** Largest per-channel difference between two `#rrggbb` colours, in `0..1`. */
export function colorDistance(left: string, right: string): number {
  const a = hexToChannels(left)
  const b = hexToChannels(right)
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

/**
 * Normalised distance between two atmospheres, in `0..1`.
 *
 * A blunt but honest metric for "do these two eras read differently": colour
 * distances, sun position, fog, grade, bloom, particle counts and plume rates are
 * each normalised to a plausible range and averaged. The unit suite uses it to
 * assert adjacent eras differ measurably instead of merely differing in one field.
 */
export function atmosphereDistance(left: VfxSnapshot, right: VfxSnapshot): number {
  const terms: number[] = [
    colorDistance(left.sky.topColor, right.sky.topColor),
    colorDistance(left.sky.horizonColor, right.sky.horizonColor),
    colorDistance(left.sky.groundColor, right.sky.groundColor),
    colorDistance(left.fog.color, right.fog.color),
    colorDistance(left.lighting.sunColor, right.lighting.sunColor),
    Math.abs(left.lighting.sunAzimuth - right.lighting.sunAzimuth) / Math.PI,
    Math.abs(left.lighting.sunElevation - right.lighting.sunElevation) / (Math.PI / 2),
    Math.abs(left.lighting.sunIntensity - right.lighting.sunIntensity) / 4,
    Math.abs(left.fog.density - right.fog.density) / 0.02,
    Math.abs(left.fog.groundHazeOpacity - right.fog.groundHazeOpacity),
    Math.abs(left.grade.contrast - right.grade.contrast) / 0.6,
    Math.abs(left.grade.saturation - right.grade.saturation) / 0.7,
    Math.abs(left.grade.temperature - right.grade.temperature) / 0.4,
    Math.abs(left.grade.exposure - right.grade.exposure) / 0.4,
    Math.abs(left.grade.vignette - right.grade.vignette) / 0.5,
    Math.abs(left.grade.bloomIntensity - right.grade.bloomIntensity) / 1.2,
    Math.abs(left.emissive.glowIntensity - right.emissive.glowIntensity) / 12,
    Math.abs(left.particles.totalCount - right.particles.totalCount) / 600,
  ]
  const total = terms.reduce((sum, term) => sum + Math.min(1, Math.max(0, term)), 0)
  return total / terms.length
}

