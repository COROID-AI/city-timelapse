/**
 * Data contract of the era pedestrian crowd.
 *
 * The layer is split into data and behaviour so that the whole crowd can be
 * reasoned about — and tested — without a renderer:
 *
 * - {@link EraCrowdTable} is the *per-era outfit table*: garment shapes, colour
 *   palette, hair, headwear, accessories, carried props, population density and
 *   gait. One record per era lives in `tables.ts`, so adding a period is a data
 *   edit rather than a branch inside geometry or animation code.
 * - {@link BodyProfile} / {@link GaitProfile} describe one *person*: height,
 *   build, stride and pace, generated deterministically from the block seed,
 *   the era id and the pedestrian index (`bodies.ts`).
 * - {@link PedestrianPose} is the animated result: a transform per skeletal
 *   part, produced by the walk/idle generators in `bodies.ts` from a
 *   caller-supplied clock.
 * - {@link Crowd} is the mutable simulation state (`crowd.ts`): the visible
 *   pedestrians, their spline position, crossing state and the era blend.
 *
 * Everything is a plain number, string or array, so a crowd can be serialised,
 * diffed and hashed by tests and by the browser harness.
 *
 * ## Units
 *
 * One world unit is one metre, `+Y` is up, `+X` east and `+Z` south — the frozen
 * convention of the block layout (`src/city/layout/types.ts`). Garment shapes
 * and part origins are authored for the layout's *reference figure*: a 1.75 m
 * adult standing on `y = 0` with the origin between the feet. `bodies.ts` scales
 * every shape by the pedestrian's own height and build, so one shape library
 * dresses a crowd of children, adults and everyone in between.
 */

import type { EraId } from '../../era'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'
import type { CityLayout, Vec3 } from '../layout'

/** `#rrggbb` colour string, the shared currency of era palettes. */
export type HexColor = string

/* ------------------------------------------------------------------------- *
 * Skeleton
 * ------------------------------------------------------------------------- */

/**
 * Skeletal parts of one figure, in hierarchy order (root first).
 *
 * The ids are the only anchors garments know about: a coat is "a box on
 * `torso`", a trouser leg is "a cylinder on `shinL`", which keeps geometry and
 * animation free of period-specific code.
 */
export const PART_IDS = [
  'hips',
  'torso',
  'head',
  'upperArmL',
  'upperArmR',
  'forearmL',
  'forearmR',
  'handL',
  'handR',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'footL',
  'footR',
] as const

/** One skeletal part id. */
export type PartId = (typeof PART_IDS)[number]

/** Parts that exist on both sides of the body, with their mirrored sibling. */
export const MIRRORED_PART: Readonly<Partial<Record<PartId, PartId>>> = {
  upperArmL: 'upperArmR',
  upperArmR: 'upperArmL',
  forearmL: 'forearmR',
  forearmR: 'forearmL',
  handL: 'handR',
  handR: 'handL',
  thighL: 'thighR',
  thighR: 'thighL',
  shinL: 'shinR',
  shinR: 'shinL',
  footL: 'footR',
  footR: 'footL',
}

/* ------------------------------------------------------------------------- *
 * Procedural shapes
 * ------------------------------------------------------------------------- */

/** Primitive volumes every garment, hairstyle and prop is built from. */
export const PRIMITIVE_KINDS = [
  'box',
  'cylinder',
  'tapered-cylinder',
  'sphere',
  'cone',
  'torus',
] as const

/** One primitive volume kind. */
export type PrimitiveKind = (typeof PRIMITIVE_KINDS)[number]

/**
 * A procedural volume plus its placement on a skeletal part.
 *
 * `size` is the *final* bounding box in metres: the builder makes the unit
 * primitive and bakes this scale into the vertices, so a squashed sphere is an
 * ellipsoid (a hood, a beehive) without a second geometry kind. `segments` is
 * the resolution of the round kind and is what quality tiers scale; `taper` is
 * the top/bottom radius ratio of a tapered cylinder (`0` = a cone).
 *
 * `offset` and `rotation` place the volume relative to its part's origin and are
 * applied through the instance matrix, never through the geometry — two shapes
 * that differ only in placement share one geometry and one draw call.
 */
export interface PrimitiveShape {
  readonly kind: PrimitiveKind
  /** Final size in metres: width (`x`), height (`y`), depth (`z`). */
  readonly size: readonly [number, number, number]
  /** Resolution of the round kinds; quality tiers scale this value. */
  readonly segments: number
  /** Top/bottom radius ratio for `tapered-cylinder`; `1` is a straight tube. */
  readonly taper: number
  /** Local offset from the part origin, in metres. */
  readonly offset: readonly [number, number, number]
  /** Local rotation in radians, applied in `xyz` euler order. */
  readonly rotation: readonly [number, number, number]
}

/* ------------------------------------------------------------------------- *
 * Outfit table
 * ------------------------------------------------------------------------- */

/** Layer a garment occupies in a look, from skin outwards. */
export const GARMENT_SLOTS = [
  'underlayer',
  'top',
  'outerwear',
  'bottom',
  'dress',
  'legwear',
  'footwear',
  'headwear',
  'accessory',
  'prop',
] as const

/** One garment layer. */
export type GarmentSlot = (typeof GARMENT_SLOTS)[number]

/**
 * Colour reference: an index into the era palette, or a fixed hex colour for
 * things that are not made of cloth (hair, leather, chrome, phone glass).
 */
export type ColourRef = number | HexColor

/** One garment piece: a shape on a part, plus the colour it draws with. */
export interface GarmentPiece {
  readonly id: string
  readonly slot: GarmentSlot
  readonly part: PartId
  readonly shape: PrimitiveShape
  /** Index into the outfit palette, or a fixed hex colour. */
  readonly colour: ColourRef
}

/** A hairstyle: a shape on the head plus a fixed hair colour. */
export interface HairStyle {
  readonly id: string
  readonly label: string
  readonly shape: PrimitiveShape
  readonly colour: HexColor
}

/** A headwear item, accessory or carried prop: a shape on a part, with colour. */
export interface OutfitItem {
  readonly id: string
  readonly label: string
  readonly part: PartId
  readonly shape: PrimitiveShape
  readonly colour: ColourRef
}

/** Overall body build an outfit is cut for. */
export type BodyBuild = 'slim' | 'regular' | 'broad'

/** Characteristic stance of an era's walk. */
export type Posture = 'upright' | 'relaxed' | 'slouched' | 'brisk' | 'purposeful'

/** Era-typical gait: the mean every pedestrian's own walk derives from. */
export interface GaitProfile {
  /** Mean walking speed in metres per second. */
  readonly speedMps: number
  /** Mean distance covered by one step, in metres. */
  readonly strideLengthM: number
  /** Steps per minute at the mean speed. */
  readonly cadenceStepsPerMin: number
  /** Peak shoulder rotation of the swing, in radians. */
  readonly armSwingRad: number
  /** Peak hip rotation of the swing, in radians. */
  readonly hipSwayRad: number
  /** Vertical travel of the hips over one cycle, in metres. */
  readonly bobM: number
  /** Forward lean of the torso, in radians. */
  readonly leanRad: number
  /** Stance the era's walk reads as. */
  readonly posture: Posture
}

/**
 * One complete look: a garment layer stack plus the pools it draws hair,
 * headwear, accessories and carried props from.
 *
 * `key` is the era's own outfit model key (`EraPopulation.modelKeys`), so the
 * pedestrian layer stays keyed off the era registry rather than inventing a
 * parallel vocabulary.
 */
export interface OutfitSet {
  readonly key: string
  readonly label: string
  readonly build: BodyBuild
  /** Garment layers, ordered skin-outwards. */
  readonly layers: readonly GarmentPiece[]
  /** Hair styles this look may wear; ids from the era's hair pool. */
  readonly hairIds: readonly string[]
  /** Headwear this look may wear; empty means bare-headed. */
  readonly headwearIds: readonly string[]
  /** Accessories this look may wear. */
  readonly accessoryIds: readonly string[]
  /** Props this look may carry. */
  readonly propIds: readonly string[]
}

/**
 * The per-era crowd table.
 *
 * `density`, `outfitEraTag` and the first colours of `palette` mirror the era
 * registry's `EraPopulation`; the unit suite asserts that they agree, so the era
 * model stays the single source of truth while the layer still owns the shapes.
 */
export interface EraCrowdTable {
  readonly eraId: EraId
  /** Mirrors `EraPopulation.outfitEraTag`. */
  readonly outfitEraTag: string
  readonly label: string
  /** Mirrors `EraPopulation.pedestrianDensity`. */
  readonly density: number
  /** Era-typical walk every pedestrian's own gait derives from. */
  readonly gait: GaitProfile
  /** Garment colours; starts with `EraPopulation.outfitPalette`. */
  readonly palette: readonly HexColor[]
  readonly hair: readonly HairStyle[]
  readonly headwear: readonly OutfitItem[]
  readonly accessories: readonly OutfitItem[]
  readonly props: readonly OutfitItem[]
  /** One look per era model key, in registry order. */
  readonly outfits: readonly OutfitSet[]
}

/* ------------------------------------------------------------------------- *
 * Resolved appearance
 * ------------------------------------------------------------------------- */

/** A garment resolved for one pedestrian: palette index turned into a colour. */
export interface ResolvedGarment {
  readonly id: string
  readonly slot: GarmentSlot
  readonly part: PartId
  readonly shape: PrimitiveShape
  readonly colour: HexColor
}

/** A hairstyle, headwear item, accessory or prop resolved for one pedestrian. */
export interface ResolvedItem {
  readonly id: string
  readonly label: string
  readonly part: PartId
  readonly shape: PrimitiveShape
  readonly colour: HexColor
}

/** Everything one pedestrian wears in one era. */
export interface ResolvedOutfit {
  readonly eraId: EraId
  readonly outfitKey: string
  readonly label: string
  readonly build: BodyBuild
  readonly palette: readonly HexColor[]
  /** Garment layers, ordered skin-outwards. */
  readonly garments: readonly ResolvedGarment[]
  readonly hair: ResolvedItem
  readonly headwear: ResolvedItem | null
  readonly accessories: readonly ResolvedItem[]
  readonly props: readonly ResolvedItem[]
  /** Stable digest of the look, used to prove eras differ. */
  readonly signature: string
}

/* ------------------------------------------------------------------------- *
 * Bodies and animation
 * ------------------------------------------------------------------------- */

/** One person's proportions, scaled from the layout's reference figure. */
export interface BodyProfile {
  readonly heightM: number
  readonly build: BodyBuild
  readonly isChild: boolean
  /** `heightM / 1.75`: uniform vertical scale for every shape. */
  readonly heightScale: number
  /** Shoulder width relative to the reference figure, used as the width scale. */
  readonly widthScale: number
  readonly shoulderWidthM: number
  readonly hipWidthM: number
  readonly chestDepthM: number
  readonly limbThicknessM: number
  readonly headScale: number
  /** Stride multiplier of this person's build. */
  readonly strideScale: number
  /** Rest position of every part, in metres above the ground plane. */
  readonly origins: Readonly<Record<PartId, Vec3>>
  /** Joint lengths used by the forward kinematics of the walk cycle. */
  readonly limbs: {
    readonly thigh: number
    readonly shin: number
    readonly upperArm: number
    readonly forearm: number
  }
}

/** Position and rotation of one skeletal part in the pedestrian's own frame. */
export interface PartTransform {
  readonly position: Vec3
  readonly rotation: Vec3
}

/** A complete pose: one transform per part, feet on the pedestrian's origin. */
export type PoseFrame = Readonly<Record<PartId, PartTransform>>

/** What a pedestrian is doing right now. */
export type PedestrianState = 'walking' | 'waiting' | 'crossing'

/**
 * Animation level of detail.
 *
 * `0` full rate and full detail, `1` reduced update rate with props and
 * accessories dropped, `2` a static silhouette driven by the era palette only.
 */
export type AnimationLod = 0 | 1 | 2

/** One pedestrian's world pose at one instant. */
export interface PedestrianPose {
  /** Root position: the point between the feet, on the walked surface. */
  readonly position: Vec3
  /** Unit horizontal forward vector the pedestrian faces. */
  readonly heading: Vec3
  readonly state: PedestrianState
  readonly parts: PoseFrame
  /** Walk-cycle phase in `[0, 1)`; one cycle is two steps. */
  readonly gaitPhase: number
  readonly animationLod: AnimationLod
}

/** Where a pedestrian is and which way it faces, without any limb animation. */
export interface PedestrianPlacement {
  /** Root position: the point between the feet, on the walked surface. */
  readonly position: Vec3
  /** Unit horizontal forward vector the pedestrian faces. */
  readonly heading: Vec3
  readonly state: PedestrianState
  /** Ground speed right now, in metres per second; 0 while waiting. */
  readonly speedMps: number
}

/* ------------------------------------------------------------------------- *
 * Crowd
 * ------------------------------------------------------------------------- */

/** A blend between two eras staged by the transition director. */
export interface EraBlend {
  readonly from: EraId
  readonly to: EraId
  /** Blend weight in `[0, 1]`: 0 is `from`, 1 is `to`. */
  readonly t: number
  /** When true the blend is applied instantly, for reduced-motion viewers. */
  readonly reducedMotion?: boolean
}

/** Where a crossing meets the sidewalk loop, and where its walkers wait. */
export interface CrossingAnchor {
  /** Index into `CityLayout.crossings`. */
  readonly crossingIndex: number
  /** Crossing name, e.g. `crosswalk:north-east:north`. */
  readonly crossingName: string
  /** Index into `CityLayout.pedestrianSplines` of the crossing loop. */
  readonly splineIndex: number
  /** Arc distance on the sidewalk loop where the crossing is entered. */
  readonly anchorDistance: number
  /** Block-side waiting point the layout publishes for this crossing. */
  readonly waitingPoint: Vec3
  /** Unit vector across the carriageway, the direction a waiter faces. */
  readonly crossingHeading: Vec3
}

/**
 * One pedestrian.
 *
 * Identity, proportions, gait and the five era outfits are fixed at spawn and
 * derived from the block seed, the era id and the index, so two runs of the same
 * seed produce the same crowd; only the fields below the marker change as the
 * clock advances.
 */
export interface Pedestrian {
  readonly index: number
  readonly body: BodyProfile
  readonly gait: GaitProfile
  /** Position of this person inside the era's cross-dress sweep, in `[0, 1)`. */
  readonly dressWeight: number
  /** Skin colour of the figure, deterministic per person. */
  readonly skinTone: HexColor
  /** True when this person uses the crosswalk instead of walking past it. */
  readonly crosses: boolean
  /** Index into `CityLayout.crossings`, or `-1` when this person never crosses. */
  readonly crossingIndex: number
  /** The five era looks, resolved once so an era switch never resamples. */
  readonly outfits: ReadonlyMap<EraId, ResolvedOutfit>
  /** Lateral offset from the walk line, in metres, inside the sidewalk. */
  readonly lateralOffsetM: number
  /**
   * Deterministic position of this person inside the crowd's spawn order.
   *
   * It places the figure along the sidewalk loop and ranks it for visibility,
   * so a denser era shows a spread crowd rather than the first N people.
   */
  readonly spawnFraction: number
  /** Phase offset of this person's idle sway, in cycles. */
  readonly idlePhase: number
  /** Phase offset of this person's head look direction, in cycles. */
  readonly lookPhase: number

  /* ----- mutable simulation state ----- */
  /** False when the era's density leaves this person out of the crowd. */
  visible: boolean
  state: PedestrianState
  /** Index into `CityLayout.pedestrianSplines` this person walks along. */
  splineIndex: number
  /** Arc distance along `splineIndex`, in metres. */
  distance: number
  /** Travel direction along the spline: `1` forward, `-1` reversed. */
  direction: 1 | -1
  /** Walk-cycle phase in `[0, 1)`. */
  gaitPhase: number
  /** Metres walked since the last crossing; gates re-entering the crosswalk. */
  walkedSinceCrossing: number
  /** Seconds spent in the current state. */
  stateSeconds: number
  /** True once the walker has left the kerb on this crossing. */
  crossingStarted: boolean
}

/** The whole crowd: configuration plus the pedestrian pool. */
export interface Crowd {
  readonly layout: CityLayout
  readonly seed: string
  readonly tier: QualityTierName
  /** Index into `CityLayout.pedestrianSplines` of the sidewalk loop. */
  readonly sidewalkSplineIndex: number
  readonly sidewalkLength: number
  readonly anchors: readonly CrossingAnchor[]
  /** Stable pool of people; `activeCount` of them are visible. */
  readonly pedestrians: readonly Pedestrian[]
  /** Size of the pool: the crowd at unit density on the high tier. */
  readonly capacity: number
  /** Child share the pool was spawned with, from the era it was created for. */
  readonly childShare: number
  /** Pedestrian indices ordered by spawn fraction: the visibility order. */
  readonly visibilityOrder: readonly number[]
  /** Era currently applied (the target era during a staged blend). */
  eraId: EraId
  /** Set while a staged era change is in flight, `null` when settled. */
  blend: EraBlend | null
  /** Completed fixed simulation steps since the crowd was created. */
  steps: number
  /** Sub-step seconds carried over between advances, in `[0, step)`. */
  remainder: number
  /** Number of visible pedestrians for the current era and tier. */
  activeCount: number
}

/** Per-state population of the crowd at one instant. */
export interface CrowdStateCounts {
  readonly walking: number
  readonly waiting: number
  readonly crossing: number
  readonly hidden: number
}

/** Snapshot of a crowd, cheap enough to publish every frame. */
export interface CrowdStats {
  readonly eraId: EraId
  readonly blend: EraBlend | null
  readonly tier: QualityTierName
  readonly activeCount: number
  readonly capacity: number
  readonly timeSeconds: number
  readonly states: CrowdStateCounts
  /** Distinct outfit keys in the visible crowd. */
  readonly outfitKeys: readonly string[]
  /** Distinct carried-prop ids in the visible crowd. */
  readonly propIds: readonly string[]
  /** Digest of the whole visible crowd, for determinism assertions. */
  readonly signature: string
}

/** Triangle, draw-call and geometry budget of the crowd, per quality tier. */
export interface CrowdCostEstimate {
  readonly tier: QualityTierName
  readonly pedestrians: number
  /** Triangles submitted for this frame (instances x shared geometry). */
  readonly triangles: number
  /** Distinct instanced meshes drawn: one per shared geometry in use. */
  readonly drawCalls: number
  /** Triangles of the shared geometry pool itself, counted once. */
  readonly poolTriangles: number
  /** Instances written this frame. */
  readonly instances: number
  readonly triangleBudget: number
  readonly drawCallBudget: number
  readonly geometryBudget: number
  readonly lodCounts: readonly [number, number, number]
  readonly withinBudget: boolean
}

/* ------------------------------------------------------------------------- *
 * Integration surface
 * ------------------------------------------------------------------------- */

/** Options for {@link createPedestrianLayer}. */
export interface PedestrianLayerOptions {
  /** Block the crowd walks; defaults to the canonical layout. */
  readonly layout?: CityLayout
  /** Block seed; the crowd is deterministic from it. */
  readonly seed?: Seed
  /** Era applied at creation; defaults to the first era. */
  readonly eraId?: EraId
  /** Quality tier; defaults to the shared default tier. */
  readonly tier?: QualityTierName
}

/**
 * Handle the transition director drives.
 *
 * It bundles the mutable {@link Crowd} with the layout, seed and tier it was
 * built from, which is exactly the `ctx` argument of `applyEra` and
 * `applyEraTransition`: a director can stage and interpolate era changes per
 * layer without owning any layer internals.
 */
export interface PedestrianLayerContext {
  readonly crowd: Crowd
  readonly layout: CityLayout
  readonly seed: string
  readonly tier: QualityTierName
}

/** Handle plus the current era table, returned by `createPedestrianLayer`. */
export interface PedestrianLayerHandle extends PedestrianLayerContext {
  readonly table: EraCrowdTable
}
