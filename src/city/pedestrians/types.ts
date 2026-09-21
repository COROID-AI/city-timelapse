/**
 * Shared vocabulary of the era pedestrian layer.
 *
 * The layer is split like every other content layer: a *plan* (plain data — one
 * entry per person, each bound to a real sidewalk spline or a real crosswalk
 * waypoint) and a *painter* (`bodies.ts`, instanced three.js figures).
 *
 * - {@link OutfitSet} — a complete period outfit: garment shape, colours, hair,
 *   headwear, accessories and carried props. Nothing is fetched; the painter
 *   builds the figure from boxes, so an outfit is data plus a tint palette.
 * - {@link Pedestrian} — one person: outfit, body proportions, pace, the spline
 *   or crossing they belong to, and their own gait phase.
 * - {@link PedestrianPlan} — one era's whole crowd plus the counters the
 *   composition publishes and QA compares per era.
 *
 * Every value is `JSON.stringify`-safe, so a plan can be hashed for determinism
 * and published by the browser harness without a serialiser.
 */

import type { EraId, HexColor } from '../../era'
import type { BlockLayout, CornerName, PathSpline, StreetName, Vec3 } from '../layout'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'

export type {
  EraId,
  HexColor,
  BlockLayout,
  CornerName,
  PathSpline,
  StreetName,
  Vec3,
  QualityTierName,
  Seed,
}

/* ------------------------------------------------------------------------- *
 * Outfit vocabulary
 * ------------------------------------------------------------------------- */

/** Garment silhouettes the box-figure painter imitates. */
export const GARMENT_SHAPES = [
  'overcoat',
  'suit',
  'dress',
  'uniform',
  'jacket',
  'puffer',
  'hoodie',
  'trench',
] as const

export type GarmentShape = (typeof GARMENT_SHAPES)[number]

/** Hair silhouettes the painter draws around the head. */
export const HAIR_STYLES = ['short', 'bun', 'long', 'bald', 'curly', 'ponytail', 'pompadour'] as const

export type HairStyle = (typeof HAIR_STYLES)[number]

/** Headwear of the period; `none` is a bare or hatless head. */
export const HEADWEAR_KINDS = [
  'none',
  'newsboy-cap',
  'fedora',
  'flat-cap',
  'cap',
  'beanie',
  'hood',
  'sunhat',
  'helmet',
] as const

export type HeadwearKind = (typeof HEADWEAR_KINDS)[number]

/**
 * One complete period outfit.
 *
 * Colours are resolved from the era's own `population.outfitPalette`, so the
 * crowd of a period is tinted by the registry rather than by a second table.
 */
export interface OutfitSet {
  /** Stable id such as `1945-wool-overcoat`. */
  readonly id: string
  readonly label: string
  /** Model key from the registry's `population.modelKeys`. */
  readonly modelKey: string
  readonly garment: GarmentShape
  readonly hair: HairStyle
  readonly headwear: HeadwearKind
  readonly accessories: readonly string[]
  readonly carried: readonly string[]
  readonly upperColor: HexColor
  readonly lowerColor: HexColor
  readonly hairColor: HexColor
  readonly skinColor: HexColor
  readonly accessoryColor: HexColor
  /** Height multiplier applied to the base figure. */
  readonly heightScale: number
  /** Build multiplier (shoulder/limb thickness). */
  readonly build: number
}

/** One period's crowd table. */
export interface PedestrianEraData {
  readonly eraId: EraId
  readonly label: string
  readonly outfitEraTag: string
  readonly modelKeys: readonly string[]
  readonly outfits: readonly OutfitSet[]
  readonly densityScale: number
  readonly walkSpeedScale: number
  readonly childRatio: number
  readonly groupSizeRange: readonly [number, number]
  readonly palette: readonly HexColor[]
}

/* ------------------------------------------------------------------------- *
 * Plan
 * ------------------------------------------------------------------------- */

/** One person of one era's crowd. */
export interface Pedestrian {
  readonly id: string
  readonly modelKey: string
  readonly outfitId: string
  /** Index of the outfit inside its era table; the painter's tint index. */
  readonly outfitIndex: number
  readonly child: boolean
  /** Sidewalk-loop spline the walker follows, or the crossing spline of a waiter. */
  readonly splineName: string
  /** Arc-length position at `t = 0`, in metres. */
  readonly distance: number
  /** `+1` walks with the spline tangent, `-1` against it. */
  readonly direction: 1 | -1
  readonly speedMps: number
  readonly strideM: number
  readonly gaitPhase: number
  readonly heightM: number
  readonly build: number
  readonly pace: number
  /** True for a person waiting at a crosswalk waypoint rather than walking. */
  readonly waiting: boolean
}

/** Counters the composition publishes and the acceptance suite compares. */
export interface CrowdStats {
  readonly pedestrianCount: number
  readonly adultCount: number
  readonly childCount: number
  readonly walkerCount: number
  readonly waiterCount: number
  readonly uniqueOutfits: number
  readonly outfitVariants: number
  readonly hairVariants: number
  readonly headwearVariants: number
  readonly carriedVariants: number
  readonly sidewalkLengthM: number
  readonly density: number
  readonly averageSpeedMps: number
  readonly averageHeightM: number
  readonly minHeightM: number
  readonly maxHeightM: number
  readonly averageStrideM: number
  readonly childRatio: number
  readonly groupCount: number
}

/** One era's crowd. */
export interface PedestrianPlan {
  readonly kind: typeof CROWD_PLAN_KIND
  readonly eraId: EraId
  readonly year: number
  readonly seed: Seed
  readonly qualityTier: QualityTierName
  readonly detail: number
  readonly night: boolean
  readonly reducedMotion: boolean
  readonly outfitEraTag: string
  /** Real sidewalk length the crowd is sized against, in metres. */
  readonly sidewalkLengthM: number
  readonly density: number
  readonly pedestrians: readonly Pedestrian[]
  readonly stats: CrowdStats
}

/** Staged era change handed to {@link applyEraTransition}. */
export interface PedestrianTransitionInput {
  readonly from: EraId
  readonly to: EraId
  readonly t: number
}

/** One frame of a staged crowd change. */
export interface PedestrianTransitionPlan {
  readonly kind: typeof CROWD_TRANSITION_KIND
  readonly from: EraId
  readonly to: EraId
  readonly t: number
  readonly mix: number
  readonly instant: boolean
  readonly resolvedEra: EraId
  readonly plan: PedestrianPlan
  readonly fromPlan: PedestrianPlan
  readonly toPlan: PedestrianPlan
}

/** Everything {@link buildCrowdPlan} needs. */
export interface PedestrianContext {
  readonly layout: BlockLayout
  readonly qualityTier?: QualityTierName
  readonly seed?: Seed
  readonly night?: boolean
  readonly reducedMotion?: boolean
}

/** Discriminant of every crowd plan this layer produces. */
export const CROWD_PLAN_KIND = 'crowd-plan'

/** Discriminant of every staged crowd change this layer produces. */
export const CROWD_TRANSITION_KIND = 'crowd-transition'

/** World pose of one pedestrian at one clock reading. */
export interface PedestrianPose {
  readonly id: string
  readonly position: Vec3
  /** Yaw in radians: `0` faces `+z`, matching three.js `rotation.y`. */
  readonly heading: number
  /** Gait phase in radians; idle sway for a waiting person. */
  readonly phase: number
  readonly speedMps: number
  readonly waiting: boolean
  readonly heightM: number
  readonly build: number
  readonly outfitIndex: number
  readonly child: boolean
  readonly splineName: string
}
