/**
 * Shared vocabulary of the era buildings layer.
 *
 * The layer is split the way the block is: a *plan* (plain, serialisable data,
 * one entry per parcel) and a *painter* (three.js, see `BuildingsLayer.tsx`).
 * Everything in this file describes the plan:
 *
 * - {@link BuildingEraData} — the period table entry: massing envelope, facade
 *   proportions, roof kit, vacancy and construction rates and the archetype
 *   vocabulary the registry publishes for the era.
 * - {@link BuildingInstance} — one parcel resolved to exactly one of the three
 *   states: a built mass, a vacant lot or a construction site. The state carries
 *   the footprint, height, floor count, facade grid and roof kit of the parcel.
 * - {@link BuildingPlan} — one era's whole block: sixteen instances plus the
 *   counters the composition publishes and QA compares per era.
 *
 * Every value is `JSON.stringify`-safe (numbers, strings, arrays and plain
 * objects), so the unit suite can hash a whole era's plan and prove the
 * generator is reproducible from its seed.
 */

import type { EraId, EraLighting, EraPalette, HexColor } from '../../era'
import type { BlockLayout, CornerName, FootprintRect, StreetName } from '../layout'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'

export type {
  EraId,
  EraLighting,
  EraPalette,
  HexColor,
  BlockLayout,
  CornerName,
  FootprintRect,
  StreetName,
  QualityTierName,
  Seed,
}

/* ------------------------------------------------------------------------- *
 * Vocabulary
 * ------------------------------------------------------------------------- */

/** Constructive family of one era, in historical order. */
export const BUILDING_STYLES = [
  'masonry',
  'brick-glass',
  'concrete',
  'glass-mixed',
  'contemporary',
] as const

export type BuildingStyleKind = (typeof BUILDING_STYLES)[number]

/** Every parcel ends up in exactly one of these states. */
export const BUILDING_STATES = ['building', 'vacant-lot', 'construction'] as const

export type BuildingStateKind = (typeof BUILDING_STATES)[number]

/** Roof add-ons a period hangs on its buildings. */
export const ROOF_ITEM_KINDS = [
  'chimney',
  'water-tank',
  'fire-escape',
  'sign-frame',
  'vent',
  'ac-box',
  'antenna',
  'satellite-dish',
  'mechanical-penthouse',
  'solar-array',
  'green-roof',
  'roof-deck',
] as const

export type RoofItemKind = (typeof ROOF_ITEM_KINDS)[number]

/** Discriminant of every plan this layer produces. */
export const BUILDING_PLAN_KIND = 'building-plan'

/** Discriminant of every staged transition this layer produces. */
export const BUILDING_TRANSITION_KIND = 'building-transition'

/* ------------------------------------------------------------------------- *
 * Era tables
 * ------------------------------------------------------------------------- */

/** How much building one era's parcels carry. */
export interface MassingProfile {
  readonly minFloors: number
  readonly maxFloors: number
  readonly floorHeight: number
  readonly groundFloorHeight: number
  /** Fraction of the parcel footprint the mass covers (0.3 … 0.95). */
  readonly footprintScale: number
  /** Chance a parcel becomes a tower carrying {@link towerBonusFloors}. */
  readonly towerChance: number
  readonly towerBonusFloors: number
  /** Chance a parcel is an empty lot in this period. */
  readonly vacancyRate: number
  /** Chance a parcel is a building site in this period. */
  readonly constructionRate: number
  /** Emissive strength of a lit window at night, before the era's own lamps. */
  readonly windowEmissive: number
}

/** Window proportions and facade detail one era's buildings are drawn with. */
export interface FacadeProfile {
  readonly style: BuildingStyleKind
  readonly windowWidth: number
  readonly windowHeight: number
  /** Pier width between two windows of the same row. */
  readonly windowSpacingX: number
  /** Spandrel/lintel height between two floors. */
  readonly windowSpacingY: number
  /** Height of the sill above the floor plane. */
  readonly sillHeight: number
  readonly masonryCoursing: boolean
  readonly spandrelBands: boolean
  readonly mullions: boolean
  readonly exposedStructure: boolean
  /** Chance a street-facing stack carries a balcony on a given floor. */
  readonly balconyChance: number
  /** Height of the storefront-ready band left clear above the ground floor. */
  readonly storefrontBandHeight: number
}

/** One roof add-on: how many, how often and how big. */
export interface RoofItemSpec {
  readonly kind: RoofItemKind
  /** Minimum count when the item is present. */
  readonly min: number
  /** Maximum count when the item is present. */
  readonly max: number
  /** Chance the item appears at all on one building. */
  readonly chance: number
  readonly height: number
  readonly width: number
  readonly depth: number
}

/** One period's building table: massing, facade and roof kit. */
export interface BuildingEraData {
  readonly eraId: EraId
  readonly label: string
  readonly style: BuildingStyleKind
  /** Archetype names from the registry's `contentTags.buildings`. */
  readonly archetypes: readonly string[]
  readonly massing: MassingProfile
  readonly facade: FacadeProfile
  readonly roof: readonly RoofItemSpec[]
}

/* ------------------------------------------------------------------------- *
 * Plan
 * ------------------------------------------------------------------------- */

/** The window grid measured on the street-facing facades of one building. */
export interface WindowGrid {
  /** Widest of the two per-axis column counts (reported for the census). */
  readonly columns: number
  /** Columns on the north/south (width-spanning) facades. */
  readonly columnsX: number
  /** Columns on the east/west (depth-spanning) facades. */
  readonly columnsZ: number
  readonly rows: number
  readonly width: number
  readonly height: number
  readonly sillHeight: number
  readonly spacingX: number
  readonly spacingY: number
}

/** Facade geometry description of one building, sized to the era proportions. */
export interface FacadePlan {
  readonly style: BuildingStyleKind
  readonly window: WindowGrid
  readonly windowCount: number
  /** Number of street-facing edges the grid is laid out on. */
  readonly facingEdges: number
  readonly masonryCourses: number
  readonly hasMasonryCoursing: boolean
  readonly hasSpandrelBands: boolean
  readonly hasMullions: boolean
  readonly hasExposedStructure: boolean
  readonly balconyCount: number
  /** Ground-floor frontage left clear for the storefront layer, in metres. */
  readonly storefrontBandHeight: number
}

/** One roof kit entry: how many of a kind this building carries. */
export interface RoofItemPlan {
  readonly kind: RoofItemKind
  readonly count: number
}

/** The roof add-ons of one building. */
export interface RoofKitPlan {
  readonly items: readonly RoofItemPlan[]
  readonly kinds: readonly RoofItemKind[]
  readonly total: number
}

/** One parcel resolved to exactly one state, with its massing and detail. */
export interface BuildingInstance {
  /** Parcel id, e.g. `B2`; the plan has one instance per parcel. */
  readonly id: string
  readonly parcelId: string
  readonly state: BuildingStateKind
  readonly archetype: string
  readonly footprint: FootprintRect
  readonly height: number
  readonly floors: number
  readonly floorHeight: number
  readonly groundFloorHeight: number
  readonly corner: CornerName | null
  readonly facing: readonly StreetName[]
  readonly facade: FacadePlan
  readonly roof: RoofKitPlan
  /** Non-zero when the era is a night scene. */
  readonly windowEmissive: number
  /** Ground-floor frontage deliberately left clear for the storefront layer. */
  readonly storefrontClearance: number
}

/** Building colours of one era, resolved from the era palette. */
export interface BuildingPalette {
  readonly base: HexColor
  readonly accent: HexColor
  readonly trim: HexColor
  readonly roof: HexColor
  readonly glass: HexColor
}

/** Counters the composition publishes and the acceptance suite compares. */
export interface BuildingStats {
  readonly parcelCount: number
  readonly buildingCount: number
  readonly vacantLotCount: number
  readonly constructionSiteCount: number
  readonly totalFloors: number
  readonly minHeight: number
  readonly maxHeight: number
  readonly averageHeight: number
  readonly averageFloors: number
  readonly footprintArea: number
  readonly footprintCoverage: number
  readonly windowCount: number
  readonly facadeEdges: number
  readonly masonryCourses: number
  readonly balconyCount: number
  readonly roofItemCount: number
  readonly roofKitKinds: number
  readonly chimneyCount: number
  readonly waterTankCount: number
  readonly fireEscapeCount: number
  readonly signFrameCount: number
  readonly ventCount: number
  readonly acBoxCount: number
  readonly antennaCount: number
  readonly satelliteDishCount: number
  readonly penthouseCount: number
  readonly solarArrayCount: number
  readonly greenRoofCount: number
  readonly roofDeckCount: number
  readonly litWindowCount: number
  readonly hasMasonryCoursing: boolean
  readonly hasSpandrelBands: boolean
  readonly hasMullions: boolean
  readonly hasExposedStructure: boolean
  readonly night: boolean
}

/** One era's dressed block. */
export interface BuildingPlan {
  readonly kind: typeof BUILDING_PLAN_KIND
  readonly eraId: EraId
  readonly year: number
  readonly seed: Seed
  readonly qualityTier: QualityTierName
  readonly detail: number
  readonly night: boolean
  readonly reducedMotion: boolean
  readonly style: BuildingStyleKind
  readonly palette: BuildingPalette
  readonly lighting: {
    readonly artificialLightColor: HexColor
    readonly artificialLightIntensity: number
    readonly windowEmissive: number
    readonly night: boolean
  }
  readonly buildings: readonly BuildingInstance[]
  readonly stats: BuildingStats
}

/** Staged era change handed to {@link applyEraTransition}. */
export interface BuildingTransitionInput {
  readonly from: EraId
  readonly to: EraId
  readonly t: number
}

/** One frame of a staged building change. */
export interface BuildingTransitionPlan {
  readonly kind: typeof BUILDING_TRANSITION_KIND
  readonly from: EraId
  readonly to: EraId
  /** Requested blend position, clamped to `0..1`. */
  readonly t: number
  /** Blend depth after the reduced-motion collapse. */
  readonly mix: number
  readonly instant: boolean
  readonly resolvedEra: EraId
  readonly plan: BuildingPlan
  readonly fromPlan: BuildingPlan
  readonly toPlan: BuildingPlan
}

/** Everything {@link buildBuildingPlan} needs. */
export interface BuildingContext {
  readonly layout: BlockLayout
  readonly qualityTier?: QualityTierName
  readonly seed?: Seed
  readonly night?: boolean
  readonly reducedMotion?: boolean
}
