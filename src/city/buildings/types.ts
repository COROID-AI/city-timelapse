/**
 * Data contract of the era building layer.
 *
 * The layer turns the shared, era-neutral parcel grid into five different
 * skylines. Everything that varies with the period lives in a per-era table
 * (`tables.ts`); everything that turns a parcel plus a table into geometry lives
 * in the shared generators (`massing.ts`, `facades.ts`, `roofKits.ts`). Those
 * generators are pure data producers: they emit axis-aligned **primitives**
 * ({@link BoxPrimitive} and {@link QuadPrimitive}) in the layout's frozen
 * coordinate system (metres, `+Y` up, `+X` east, `+Z` south, ground at
 * `y = CURB_HEIGHT`), never three.js objects.
 *
 * That split is what makes the layer verifiable without a GPU:
 *
 * - `planBuildingSet` decides massing, facades, roof kits and construction
 *   states deterministically from the block seed plus the era id;
 * - `buildBuildingSet` (in `BuildingsLayer.tsx`) is the only three.js-aware
 *   step, and it merely converts primitives into merged `BufferGeometry` and
 *   `InstancedMesh` batches;
 * - because both sides read the same primitive lists, the declared
 *   {@link BuildingLayerStats.triangleEstimate} and the mounted geometry are
 *   the same number, which the composition suite asserts.
 */

import type { EraId } from '../../era'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'
import type { CornerName, StreetName, Vec2, Vec3 } from '../layout'

/* ------------------------------------------------------------------------- *
 * States, roles and families
 * ------------------------------------------------------------------------- */

/** Every parcel resolves to exactly one of these. */
export const BUILDING_STATES = ['building', 'vacant-lot', 'construction'] as const

export type BuildingStateKind = (typeof BUILDING_STATES)[number]

/** Position of a parcel on the block; drives how much building it carries. */
export const PARCEL_ROLES = ['corner', 'street', 'interior'] as const

export type ParcelRole = (typeof PARCEL_ROLES)[number]

/** Structural family of an era, in the order the timeline passes through them. */
export const MASSING_FAMILIES = [
  'low-rise-masonry',
  'mid-rise-brick-glass',
  'concrete-tower',
  'glass-mixed-use',
  'contemporary-tower',
] as const

export type MassingFamily = (typeof MASSING_FAMILIES)[number]

/** Role of one stacked volume of a building. */
export const MASS_ROLES = ['base', 'podium', 'tower', 'setback', 'crown'] as const

export type MassRole = (typeof MASS_ROLES)[number]

/** Facade language of an era. */
export const FACADE_STYLES = [
  'masonry-coursed',
  'brick-and-glass',
  'concrete-band-and-mullion',
  'curtain-wall-spandrel',
  'exposed-structure-balcony',
] as const

export type FacadeStyle = (typeof FACADE_STYLES)[number]

/* ------------------------------------------------------------------------- *
 * Rooftop vocabulary
 * ------------------------------------------------------------------------- */

/** Every rooftop, facade and structure add-on the five era kits can place. */
export const ADD_ON_KINDS = [
  'coal-chimney',
  'water-tank',
  'fire-escape',
  'roof-signage',
  'roof-vent',
  'elevator-bulkhead',
  'window-ac',
  'antenna',
  'satellite-dish',
  'roof-ac-unit',
  'mechanical-penthouse',
  'solar-array',
  'green-roof',
  'roof-deck',
  'balcony',
  'exposed-frame',
] as const

export type AddOnKind = (typeof ADD_ON_KINDS)[number]

/** Where an add-on hangs: on the roof kit, on a facade, or on the frame. */
export const ADD_ON_ATTACHMENTS = ['roof', 'facade', 'structure'] as const

export type AddOnAttachment = (typeof ADD_ON_ATTACHMENTS)[number]

/** Rooftop kit identity, one per era. */
export const ROOF_KIT_IDS = [
  'masonry-watertank',
  'signage-frame',
  'mechanical-clutter',
  'penthouse-deck',
  'green-solar',
] as const

export type RoofKitId = (typeof ROOF_KIT_IDS)[number]

/* ------------------------------------------------------------------------- *
 * Materials and scene groups
 * ------------------------------------------------------------------------- */

/** One MeshStandardMaterial-compatible slot per rendered batch. */
export const BUILDING_MATERIAL_KEYS = [
  'mass',
  'glass',
  'trim',
  'detail',
  'roof',
  'lot',
  'construction',
  'add-on',
] as const

export type BuildingMaterialKey = (typeof BUILDING_MATERIAL_KEYS)[number]

/** Scene-graph groups the layer publishes, so harnesses can address batches. */
export const BUILDING_GROUPS = [
  'masses',
  'facades',
  'roof-kits',
  'add-ons',
  'lots',
  'construction',
] as const

export type BuildingGroup = (typeof BUILDING_GROUPS)[number]

/* ------------------------------------------------------------------------- *
 * Budgets (share of the shared quality tiers)
 * ------------------------------------------------------------------------- */

/**
 * Static geometry the whole block of buildings may mount, keyed by the shared
 * quality tier names. The layer merges every repetition into one buffer per
 * building and batches add-ons, so the numbers stay well inside these.
 */
export const BUILDING_TRIANGLE_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 220_000,
  medium: 130_000,
  low: 70_000,
}

/** Draw calls the whole block of buildings may issue, keyed by quality tier. */
export const BUILDING_DRAW_CALL_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 200,
  medium: 150,
  low: 100,
}

/**
 * Repetition count above which a repeated add-on is mounted as one
 * `InstancedMesh` instead of individual meshes.
 */
export const INSTANCING_THRESHOLDS: Readonly<Record<QualityTierName, number>> = {
  high: 20,
  medium: 12,
  low: 8,
}

/** Triangle budget of the building layer for a quality tier. */
export function buildingTriangleBudget(tier: QualityTierName): number {
  return BUILDING_TRIANGLE_BUDGETS[tier]
}

/** Draw-call budget of the building layer for a quality tier. */
export function buildingDrawCallBudget(tier: QualityTierName): number {
  return BUILDING_DRAW_CALL_BUDGETS[tier]
}

/** True when `count` repetitions of one add-on should be instanced. */
export function shouldInstance(count: number, tier: QualityTierName): boolean {
  return count >= INSTANCING_THRESHOLDS[tier]
}

/* ------------------------------------------------------------------------- *
 * Ranges and rectangles
 * ------------------------------------------------------------------------- */

/** Inclusive numeric interval. */
export interface Range {
  readonly min: number
  readonly max: number
}

/** Clamps a value into `[min, max]`. */
export function clampRange(value: number, range: Range): number {
  if (value < range.min) return range.min
  if (value > range.max) return range.max
  return value
}

/**
 * Ground-plane rectangle of the building layer.
 *
 * It mirrors the layout's `FootprintRect` (and is built from a parcel's own
 * footprint), but adds the centre so generators can place edges without
 * recomputing it. Coordinates are metres in the frozen layout frame.
 */
export interface PlotRect {
  readonly minX: number
  readonly minZ: number
  readonly maxX: number
  readonly maxZ: number
  readonly width: number
  readonly depth: number
  readonly area: number
  readonly centreX: number
  readonly centreZ: number
}

/** Rounds to millimetres, which is the resolution every coordinate publishes. */
function mm(value: number): number {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Public millimetre rounding, shared by every generator. */
export function round3(value: number): number {
  return mm(value)
}

/** Add-on counters with every kind present, which keeps stats exhaustive. */
export function emptyAddOnCounts(): Record<AddOnKind, number> {
  const counts = {} as Record<AddOnKind, number>
  for (const kind of ADD_ON_KINDS) {
    counts[kind] = 0
  }
  return counts
}

/** Counts a placed add-on list by kind. */
export function countAddOnKinds(items: readonly { readonly addOn: AddOnKind }[]): Record<AddOnKind, number> {
  const counts = emptyAddOnCounts()
  for (const item of items) {
    counts[item.addOn] += 1
  }
  return counts
}

/** Roof-kit counters with every kit present. */
export function emptyRoofKitCounts(): Record<RoofKitId, number> {
  const counts = {} as Record<RoofKitId, number>
  for (const kit of ROOF_KIT_IDS) {
    counts[kit] = 0
  }
  return counts
}

/** Builds a ground rectangle from opposite corners. */
export function plotRect(minX: number, minZ: number, maxX: number, maxZ: number): PlotRect {
  const width = mm(Math.max(0, maxX - minX))
  const depth = mm(Math.max(0, maxZ - minZ))
  return {
    minX: mm(Math.min(minX, maxX)),
    minZ: mm(Math.min(minZ, maxZ)),
    maxX: mm(Math.max(minX, maxX)),
    maxZ: mm(Math.max(minZ, maxZ)),
    width,
    depth,
    area: mm(width * depth),
    centreX: mm((minX + maxX) / 2),
    centreZ: mm((minZ + maxZ) / 2),
  }
}

/** Shrinks (or grows, for negative insets) a rectangle uniformly per axis. */
export function insetPlotRectSides(
  rect: PlotRect,
  west: number,
  north: number,
  east: number,
  south: number,
): PlotRect {
  return plotRect(rect.minX + west, rect.minZ + north, rect.maxX - east, rect.maxZ - south)
}

/** Shrinks a rectangle by `inset` metres on all four sides. */
export function insetPlotRect(rect: PlotRect, inset: number): PlotRect {
  return insetPlotRectSides(rect, inset, inset, inset, inset)
}

/** Grows a rectangle by `amount` metres on all four sides. */
export function expandPlotRect(rect: PlotRect, amount: number): PlotRect {
  return insetPlotRect(rect, -amount)
}

/** Intersects a rectangle with `bounds`, falling back to `bounds` when empty. */
export function clampPlotRect(rect: PlotRect, bounds: PlotRect): PlotRect {
  const clamped = plotRect(
    Math.max(rect.minX, bounds.minX),
    Math.max(rect.minZ, bounds.minZ),
    Math.min(rect.maxX, bounds.maxX),
    Math.min(rect.maxZ, bounds.maxZ),
  )
  return clamped.width <= 0 || clamped.depth <= 0 ? bounds : clamped
}

/** True when two ground rectangles overlap with positive area. */
export function plotRectsOverlap(a: PlotRect, b: PlotRect): boolean {
  return !(a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ)
}

/** True when `inner` lies inside (or exactly on) `outer`. */
export function plotRectContains(outer: PlotRect, inner: PlotRect, epsilon = 1e-6): boolean {
  return (
    inner.minX >= outer.minX - epsilon &&
    inner.minZ >= outer.minZ - epsilon &&
    inner.maxX <= outer.maxX + epsilon &&
    inner.maxZ <= outer.maxZ + epsilon
  )
}

/* ------------------------------------------------------------------------- *
 * Geometry primitives
 * ------------------------------------------------------------------------- */

/** Axis-aligned box, optionally rotated about the world up axis. */
export interface BoxPrimitive {
  readonly kind: 'box'
  readonly id: string
  readonly group: BuildingGroup
  readonly centre: Vec3
  readonly size: { readonly width: number; readonly height: number; readonly depth: number }
  readonly rotationY: number
}

/** Vertical quad with an axis-aligned outward normal (a facade panel or band). */
export interface QuadPrimitive {
  readonly kind: 'quad'
  readonly id: string
  readonly group: BuildingGroup
  readonly centre: Vec3
  readonly width: number
  readonly height: number
  /** Outward normal on the ground plane; exactly one of `x` / `z` is ±1. */
  readonly normal: Vec2
}

/** Everything the three.js bridge can turn into geometry. */
export type Primitive = BoxPrimitive | QuadPrimitive

/** Triangles per primitive: a box is 6 quads, a quad is 2 triangles. */
export const PRIMITIVE_TRIANGLES = { box: 12, quad: 2 } as const

/** Triangle cost of one primitive. */
export function primitiveTriangles(primitive: Primitive): number {
  return PRIMITIVE_TRIANGLES[primitive.kind]
}

/** Triangle cost of a primitive list. */
export function primitiveListTriangles(primitives: readonly Primitive[]): number {
  return primitives.reduce((total, primitive) => total + primitiveTriangles(primitive), 0)
}

/** Creates a box primitive, rounding every published coordinate. */
export function boxPrimitive(
  id: string,
  group: BuildingGroup,
  centre: Vec3,
  size: { width: number; height: number; depth: number },
  rotationY = 0,
): BoxPrimitive {
  return {
    kind: 'box',
    id,
    group,
    centre: { x: mm(centre.x), y: mm(centre.y), z: mm(centre.z) },
    size: { width: mm(size.width), height: mm(size.height), depth: mm(size.depth) },
    rotationY: mm(rotationY),
  }
}

/** Creates a facade quad primitive, rounding every published coordinate. */
export function quadPrimitive(
  id: string,
  group: BuildingGroup,
  centre: Vec3,
  width: number,
  height: number,
  normal: Vec2,
): QuadPrimitive {
  return {
    kind: 'quad',
    id,
    group,
    centre: { x: mm(centre.x), y: mm(centre.y), z: mm(centre.z) },
    width: mm(width),
    height: mm(height),
    normal: { x: mm(normal.x), z: mm(normal.z) },
  }
}

/* ------------------------------------------------------------------------- *
 * Per-era tables
 * ------------------------------------------------------------------------- */

/** Colours the building layer reads from the era it is rendering. */
export interface BuildingMaterialPalette {
  /** Massed volume colour. */
  readonly mass: string
  /** Secondary panel/cornice colour. */
  readonly accent: string
  /** Window surround, sill and mullion colour. */
  readonly trim: string
  /** Opaque glass tint. */
  readonly glass: string
  /** Roof surface colour. */
  readonly roof: string
  /** Ground-floor and detail colour. */
  readonly detail: string
  /** Colour of lit windows, taken from the era's artificial light. */
  readonly glow: string
}

/** How much building one era puts on a parcel. */
export interface MassingTable {
  readonly family: MassingFamily
  /** Multiplier applied to the parcel's own height capacity. */
  readonly heightScale: number
  /** Absolute height envelope (metres) the era never leaves. */
  readonly heightRange: Range
  readonly floorHeight: Range
  /** Ground floor height (metres); the storefront layer's bays are 4.6 m tall. */
  readonly groundFloorHeight: number
  readonly floorRange: Range
  /** Fraction of the parcel footprint the base volume uses. */
  readonly footprintScale: Range
  /** Height of the retail podium (metres), or `null` for a single-shaft mass. */
  readonly podiumHeight: number | null
  /** Inset (metres) of the tower above a podium, per side. */
  readonly towerInset: Range
  /** Number of stepped setbacks on a shaft without a podium. */
  readonly setbackCount: Range
  /** Inset (metres) of one setback step, per side. */
  readonly setbackInset: Range
  /** Cornice/parapet band height (metres). */
  readonly crownHeight: number
  /** Per-parcel deterministic height jitter, as a fraction of the target. */
  readonly heightJitter: number
  /** Occupancy hint for the block's gross floor area statistics. */
  readonly floorEfficiency: number
}

/** How one era draws its windows and wall detail. */
export interface FacadeTable {
  readonly style: FacadeStyle
  /** Window size the era's proportions produce (metres). */
  readonly windowWidth: number
  readonly windowHeight: number
  /** Height of the sill above the storey floor. */
  readonly sillHeight: number
  /** Horizontal pitch of the window columns. */
  readonly columnPitch: number
  /** Fraction of the wall that is glass, used for the glazing statistic. */
  readonly glazingRatio: number
  /** Masonry course height, or `null` for eras without coursing. */
  readonly masonryCourseHeight: number | null
  /** Height of a horizontal spandrel band, or `null` when the era has none. */
  readonly spandrelBandHeight: number | null
  /** Width of one vertical mullion, or `null` when the era has none. */
  readonly mullionWidth: number | null
  /** Pitch of the vertical mullions. */
  readonly mullionSpacing: number | null
  /** A balcony every N storeys; `null` when the era has no balconies. */
  readonly balconyEveryFloors: number | null
  /** Balcony projection (metres). */
  readonly balconyDepth: number
  /** True when the era exposes its structural frame. */
  readonly exposedFrame: boolean
  /** Extra facade detail multiplier applied on top of the quality tier. */
  readonly detailScale: number
  /** Sill/ledge band height used by the coursed-masonry eras. */
  readonly sillBandHeight: number
}

/** One repeating add-on of an era's kit. */
export interface RoofAddOnTable {
  readonly kind: AddOnKind
  readonly attach: AddOnAttachment
  /** Instances per building. */
  readonly count: Range
  readonly size: { readonly width: Range; readonly height: Range; readonly depth: Range }
  /** Fraction of the roof/parapet the add-on hugs, for edge-mounted items. */
  readonly edgeMount: boolean
}

/** An era's rooftop kit: parapet, surface treatment and add-on list. */
export interface RoofKitTable {
  readonly kit: RoofKitId
  readonly label: string
  readonly parapetHeight: Range
  /** True when the era mounts a raised roof deck/terrace. */
  readonly roofDeck: boolean
  /** Fraction of the roof covered by planting (2025). */
  readonly greenRoofRatio: number
  /** Fraction of the roof covered by solar panels (2025). */
  readonly solarCoverage: number
  /** Fraction of the roof the add-ons may use, keeping a walkable margin. */
  readonly occupancy: number
  readonly addOns: readonly RoofAddOnTable[]
}

/** Everything period-specific about buildings, one record per era. */
export interface BuildingEraTable {
  readonly eraId: EraId
  readonly year: number
  readonly label: string
  /** Era seed tag, mixed into the generator seed so era draws never collide. */
  readonly seedTag: string
  /** Era colours the building materials read. */
  readonly palette: BuildingMaterialPalette
  readonly massing: MassingTable
  readonly facade: FacadeTable
  readonly roof: RoofKitTable
  /** Name of the procedural surface family the texture factory draws. */
  readonly textureSet: string
  /** Fraction of parcels that are a vacant lot in this era. */
  readonly vacancy: number
  /** Fraction of parcels under construction in this era. */
  readonly construction: number
  /** True when the era's lighting is night, so window glow is switched on. */
  readonly night: boolean
  /** Emissive intensity of the window glass (0 by day). */
  readonly windowEmissiveIntensity: number
  /** Fraction of windows the procedural texture paints as lit at night. */
  readonly litWindowFraction: number
  /** Era-specific detail dressing drawn on the roof surface. */
  readonly roofDressing: readonly string[]
}

/* ------------------------------------------------------------------------- *
 * Per-parcel plans
 * ------------------------------------------------------------------------- */

/** One ground-floor bay of the layout kept clear for the storefront layer. */
export interface FrontageClearance {
  /** Layout storefront-bay anchor name, e.g. `parcel:B2:storefront:1`. */
  readonly anchor: string
  readonly street: StreetName
  readonly width: number
  readonly height: number
  readonly centre: Vec2
  readonly normal: Vec2
  /**
   * Distance from the bay line back to the building's ground-floor wall. Zero
   * means the building stands exactly on the storefront line; a positive value
   * leaves the shopfront line completely clear.
   */
  readonly setback: number
}

/** Window grid of one facade edge. */
export interface FacadeWindowGrid {
  readonly windowWidth: number
  readonly windowHeight: number
  readonly spacingX: number
  readonly spacingY: number
  readonly sillHeight: number
  readonly columns: number
  readonly rows: number
  readonly aspect: number
}

/** One vertical facade of a building. */
export interface FacadeEdgePlan {
  readonly id: string
  /** Street the edge faces, or `null` for a courtyard/party-wall edge. */
  readonly street: StreetName | null
  readonly courtyard: boolean
  readonly length: number
  readonly height: number
  readonly centre: Vec2
  readonly normal: Vec2
  readonly columns: number
  readonly rows: number
  readonly windowCount: number
  readonly glazingRatio: number
  /** Layout storefront-bay anchors on this edge. */
  readonly storefrontBays: readonly string[]
  /** Height of the frontage left clear for the storefront layer. */
  readonly frontageClearanceHeight: number
  readonly groundFloorClear: boolean
  readonly mullions: number
  readonly spandrelBands: number
  readonly courses: number
  readonly balconies: number
}

/** Everything about the walls of one building. */
export interface FacadePlan {
  readonly style: FacadeStyle
  readonly grid: FacadeWindowGrid
  readonly edges: readonly FacadeEdgePlan[]
  readonly windowCount: number
  readonly glazingRatio: number
  readonly masonryCourses: number
  readonly spandrelBands: number
  readonly mullions: number
  readonly balconies: number
  readonly exposedFrame: boolean
  readonly groundFloorClear: boolean
  readonly frontage: readonly FrontageClearance[]
  /** Facade-attached add-ons (fire escapes, window AC units, balconies). */
  readonly addOns: readonly PlacedAddOn[]
  readonly primitives: readonly Primitive[]
  readonly triangles: number
}

/** One placed add-on, ready to mount. */
export interface PlacedAddOn extends BoxPrimitive {
  readonly addOn: AddOnKind
  readonly attach: AddOnAttachment
  readonly parcelId: string
}

/** Rooftop kit of one building. */
export interface RooftopPlan {
  readonly kit: RoofKitId
  /** Roof plate the kit stands on. */
  readonly roof: PlotRect
  readonly roofY: number
  readonly parapetHeight: number
  readonly roofDeck: boolean
  readonly greenRoofRatio: number
  readonly solarCoverage: number
  readonly addOns: readonly PlacedAddOn[]
  readonly countsByKind: Readonly<Record<AddOnKind, number>>
  readonly primitives: readonly Primitive[]
  readonly triangles: number
}

/** Vacant-lot or construction dressing of a parcel. */
export interface ParcelStatePlan {
  readonly state: BuildingStateKind
  readonly label: string
  readonly primitives: readonly Primitive[]
  readonly triangles: number
}

/** One parcel's complete resolution for one era. */
export interface BuildingPlot {
  readonly parcelId: string
  readonly eraId: EraId
  readonly state: BuildingStateKind
  readonly role: ParcelRole
  readonly facing: readonly StreetName[]
  readonly corner: CornerName | null
  /** Deck height the building stands on: the layout's curb height. */
  readonly groundY: number
  /** The parcel's own height capacity, before the era scale is applied. */
  readonly capacityHeight: number
  readonly capacityFloors: number
  readonly height: number
  readonly floors: number
  readonly floorHeight: number
  readonly groundFloorHeight: number
  /** Fraction of the parcel footprint the base volume covers. */
  readonly coverage: number
  readonly footprint: PlotRect
  /** Ground floor plate, i.e. the retail podium when the era has one. */
  readonly basePlate: PlotRect
  /** Upper volume plate: the tower above a podium, else the topmost setback. */
  readonly upperPlate: PlotRect
  readonly masses: readonly BoxPrimitive[]
  readonly massRoles: readonly MassRole[]
  readonly podium: { readonly rect: PlotRect; readonly height: number } | null
  readonly setbackCount: number
  readonly facade: FacadePlan
  readonly rooftop: RooftopPlan
  readonly frontage: readonly FrontageClearance[]
  /** Rooftop, frontage and sign anchors this plot attached to, by name. */
  readonly anchorNames: readonly string[]
  readonly addOns: readonly PlacedAddOn[]
  /** Vacant-lot or construction dressing; empty for a standing building. */
  readonly stateDetail: ParcelStatePlan
}

/** Counters published by one era's building plan. */
export interface BuildingLayerStats {
  readonly eraId: EraId
  readonly night: boolean
  readonly parcelCount: number
  readonly buildingCount: number
  readonly vacantLotCount: number
  readonly constructionCount: number
  readonly heightMin: number
  readonly heightMax: number
  readonly heightMean: number
  readonly floorsMin: number
  readonly floorsMax: number
  readonly floorsMean: number
  readonly footprintAreaMean: number
  readonly footprintAreaTotal: number
  readonly coverageMean: number
  readonly floorAreaTotal: number
  readonly windowCount: number
  readonly windowCountPerBuilding: number
  readonly facadeEdgeCount: number
  readonly masonryCourseCount: number
  readonly spandrelBandCount: number
  readonly mullionCount: number
  readonly balconyCount: number
  readonly roofKitCount: number
  readonly roofKitsByKit: Readonly<Record<RoofKitId, number>>
  readonly addOnCount: number
  readonly addOnsByKind: Readonly<Record<AddOnKind, number>>
  readonly addOnMeshCount: number
  readonly instancedAddOnKinds: number
  readonly frontageClearanceCount: number
  readonly anchorCount: number
  readonly primitiveCount: number
  readonly triangleEstimate: number
  readonly meshCount: number
  readonly drawCallEstimate: number
  readonly materialCount: number
  readonly textureRequestCount: number
  readonly windowEmissiveIntensity: number
  readonly triangleBudget: number
  readonly drawCallBudget: number
}

/** The complete, deterministic plan of one era over the shared parcel grid. */
export interface BuildingSetPlan {
  readonly eraId: EraId
  readonly year: number
  readonly seed: Seed
  readonly tier: QualityTierName
  readonly detail: number
  readonly night: boolean
  readonly plots: readonly BuildingPlot[]
  /** Every layout anchor the plan attached to. */
  readonly anchorsUsed: readonly string[]
  readonly stats: BuildingLayerStats
}

/* ------------------------------------------------------------------------- *
 * Layer state and API
 * ------------------------------------------------------------------------- */

/** Requested blend between two eras, as the transition director supplies it. */
export interface EraTransitionRequest {
  readonly from: EraId
  readonly to: EraId
  /** Blend weight, 0 = render `from`, 1 = render `to`. */
  readonly t: number
}

/** What the scene is currently showing. */
export interface BuildingLayerState {
  /** Era the blend is closer to (`t >= 0.5` resolves to `to`). */
  readonly eraId: EraId
  readonly fromEra: EraId
  readonly toEra: EraId
  readonly progress: number
  /** True while two different eras are mounted. */
  readonly transitioning: boolean
  readonly night: boolean
  /** Effective era statistics of the visible blend. */
  readonly stats: BuildingLayerStats
  /** Raw scene totals of the mounted sets, before blending. */
  readonly mounted: {
    readonly fromMeshes: number
    readonly toMeshes: number
    readonly fromTriangles: number
    readonly toTriangles: number
    readonly fromScaleY: number
    readonly toScaleY: number
    readonly fromOpacity: number
    readonly toOpacity: number
  }
}
