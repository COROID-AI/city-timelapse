/**
 * Deterministic massing of the era buildings layer.
 *
 * `buildBuildingPlan` resolves every parcel of the frozen block to exactly one
 * state — a built mass, a vacant lot or a construction site — and gives the
 * built parcels their height, floor count, footprint, facade grid and roof kit
 * from the era's own table ({@link ERA_BUILDING_TABLES}).
 *
 * Determinism is the contract: the generator is forked from the layout seed with
 * the era id, every draw is taken in a fixed parcel order, and nothing reads the
 * clock or `Math.random`. Two runs of `applyEra('1985', ctx)` therefore produce
 * byte-identical plans, while two eras share no massing, facade or roof kit.
 */

import { getEra, type EraId } from '../../era'
import { resolveQualityTier } from '../../lib/quality'
import type { QualityTierName } from '../../lib/quality'
import { createRng, type Rng, type Seed } from '../../lib/rng'
import { clamp } from '../layout'
import type { FootprintRect, Parcel } from '../layout'
import { computeFacadePlan } from './facades'
import { buildingEraData } from './tables'
import {
  BUILDING_PLAN_KIND,
  BUILDING_TRANSITION_KIND,
  type BuildingContext,
  type BuildingEraData,
  type BuildingInstance,
  type BuildingPlan,
  type BuildingStats,
  type BuildingTransitionInput,
  type BuildingTransitionPlan,
  type RoofItemPlan,
  type RoofKitPlan,
} from './types'

/* -------------------------------------------------------------------------- */
/* Quality                                                                    */
/* -------------------------------------------------------------------------- */

/** Quality tier and its facade-detail multiplier, resolved once per plan. */
export interface BuildingQualitySelection {
  readonly tier: QualityTierName
  readonly detail: number
}

/** Resolves the tier (and the facade detail it draws at) a plan is built with. */
export function resolveBuildingQuality(tier?: QualityTierName): BuildingQualitySelection {
  const resolved = resolveQualityTier(tier)
  return { tier: resolved.name, detail: resolved.density.facadeDetail }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Scales a ground rectangle about its centre, clamped to the block. */
function scaleRect(rect: FootprintRect, scale: number): FootprintRect {
  const width = rect.width * scale
  const depth = rect.depth * scale
  const cx = (rect.min.x + rect.max.x) / 2
  const cz = (rect.min.z + rect.max.z) / 2
  const min = { x: cx - width / 2, z: cz - depth / 2 }
  const max = { x: cx + width / 2, z: cz + depth / 2 }
  return { min, max, width, depth, area: width * depth }
}

/** Builds the roof kit of one building from its era table and its own draws. */
function buildRoofKit(data: BuildingEraData, rng: Rng): RoofKitPlan {
  const items: RoofItemPlan[] = []
  for (const spec of data.roof) {
    if (!rng.bool(spec.chance)) {
      continue
    }
    const count = rng.int(spec.min, spec.max + 1)
    if (count > 0) {
      items.push({ kind: spec.kind, count })
    }
  }
  return {
    items,
    kinds: items.map((item) => item.kind),
    total: items.reduce((total, item) => total + item.count, 0),
  }
}

/** One parcel resolved to its state, with massing and facade detail. */
function buildInstance(
  parcel: Parcel,
  data: BuildingEraData,
  detail: number,
  night: boolean,
  rng: Rng,
  forced?: BuildingInstance['state'],
): BuildingInstance {
  const { massing, facade } = data
  const vacancy = rng.bool(massing.vacancyRate)
  const construction = !vacancy && rng.bool(massing.constructionRate)
  const state: BuildingInstance['state'] =
    forced ??
    (vacancy
      ? 'vacant-lot'
      : construction
        ? 'construction'
        : 'building')

  const footprintScale = clamp(massing.footprintScale * rng.float(0.92, 1.05), 0.3, 0.96)
  const footprint = scaleRect(parcel.footprint, footprintScale)
  const tower = rng.bool(massing.towerChance)
  const floors = Math.max(
    massing.minFloors,
    Math.min(60, rng.int(massing.minFloors, massing.maxFloors + 1) + (tower ? massing.towerBonusFloors : 0)),
  )
  const groundFloorHeight = massing.groundFloorHeight
  const height =
    state === 'building' ? groundFloorHeight + (floors - 1) * massing.floorHeight : 0
  const facadePlan = computeFacadePlan({
    footprint,
    floors,
    height,
    groundFloorHeight,
    detail,
    profile: facade,
    facingEdges: Math.max(1, parcel.facing.length),
  })

  return {
    id: parcel.id,
    parcelId: parcel.id,
    state,
    archetype: state === 'building' ? rng.pick(data.archetypes) : state,
    footprint,
    height,
    floors: state === 'building' ? floors : 0,
    floorHeight: massing.floorHeight,
    groundFloorHeight,
    corner: parcel.corner,
    facing: [...parcel.facing],
    facade: facadePlan,
    roof: state === 'building' ? buildRoofKit(data, rng) : { items: [], kinds: [], total: 0 },
    windowEmissive: state === 'building' && night ? massing.windowEmissive : 0,
    storefrontClearance: parcel.facing.length > 0 ? groundFloorHeight : 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Census                                                                     */
/* -------------------------------------------------------------------------- */

/** Folds the built instances into the counters the composition publishes. */
function buildStats(instances: readonly BuildingInstance[], night: boolean): BuildingStats {
  const built = instances.filter((instance) => instance.state === 'building')
  const heights = built.map((instance) => instance.height)
  const floors = built.map((instance) => instance.floors)
  const totalFloors = floors.reduce((total, value) => total + value, 0)
  const footprintArea = built.reduce((total, instance) => total + instance.footprint.area, 0)
  const roofItems = built.flatMap((instance) => instance.roof.items)
  const countOf = (kind: string): number =>
    roofItems.reduce((total, item) => total + (item.kind === kind ? item.count : 0), 0)
  const windowCount = built.reduce((total, instance) => total + instance.facade.windowCount, 0)

  return {
    parcelCount: instances.length,
    buildingCount: built.length,
    vacantLotCount: instances.filter((instance) => instance.state === 'vacant-lot').length,
    constructionSiteCount: instances.filter((instance) => instance.state === 'construction').length,
    totalFloors,
    minHeight: heights.length === 0 ? 0 : Math.min(...heights),
    maxHeight: heights.length === 0 ? 0 : Math.max(...heights),
    averageHeight: heights.length === 0 ? 0 : heights.reduce((total, value) => total + value, 0) / heights.length,
    averageFloors: floors.length === 0 ? 0 : totalFloors / floors.length,
    footprintArea,
    footprintCoverage: footprintArea / Math.max(1, instances.length * 28 * 28),
    windowCount,
    facadeEdges: built.reduce((total, instance) => total + instance.facade.facingEdges, 0),
    masonryCourses: built.reduce((total, instance) => total + instance.facade.masonryCourses, 0),
    balconyCount: built.reduce((total, instance) => total + instance.facade.balconyCount, 0),
    roofItemCount: built.reduce((total, instance) => total + instance.roof.total, 0),
    roofKitKinds: new Set(built.flatMap((instance) => instance.roof.kinds)).size,
    chimneyCount: countOf('chimney'),
    waterTankCount: countOf('water-tank'),
    fireEscapeCount: countOf('fire-escape'),
    signFrameCount: countOf('sign-frame'),
    ventCount: countOf('vent'),
    acBoxCount: countOf('ac-box'),
    antennaCount: countOf('antenna'),
    satelliteDishCount: countOf('satellite-dish'),
    penthouseCount: countOf('mechanical-penthouse'),
    solarArrayCount: countOf('solar-array'),
    greenRoofCount: countOf('green-roof'),
    roofDeckCount: countOf('roof-deck'),
    litWindowCount: night ? windowCount : 0,
    hasMasonryCoursing: built.some((instance) => instance.facade.hasMasonryCoursing),
    hasSpandrelBands: built.some((instance) => instance.facade.hasSpandrelBands),
    hasMullions: built.some((instance) => instance.facade.hasMullions),
    hasExposedStructure: built.some((instance) => instance.facade.hasExposedStructure),
    night,
  }
}

/** Flattens the census into the numeric record the composition publishes. */
export function buildingStatsRecord(stats: BuildingStats): Readonly<Record<string, number>> {
  return {
    parcelCount: stats.parcelCount,
    buildingCount: stats.buildingCount,
    vacantLotCount: stats.vacantLotCount,
    constructionSiteCount: stats.constructionSiteCount,
    totalFloors: stats.totalFloors,
    minHeight: stats.minHeight,
    maxHeight: stats.maxHeight,
    averageHeight: stats.averageHeight,
    averageFloors: stats.averageFloors,
    footprintArea: stats.footprintArea,
    footprintCoverage: stats.footprintCoverage,
    windowCount: stats.windowCount,
    facadeEdges: stats.facadeEdges,
    masonryCourses: stats.masonryCourses,
    balconyCount: stats.balconyCount,
    roofItemCount: stats.roofItemCount,
    roofKitKinds: stats.roofKitKinds,
    chimneyCount: stats.chimneyCount,
    waterTankCount: stats.waterTankCount,
    fireEscapeCount: stats.fireEscapeCount,
    signFrameCount: stats.signFrameCount,
    ventCount: stats.ventCount,
    acBoxCount: stats.acBoxCount,
    antennaCount: stats.antennaCount,
    satelliteDishCount: stats.satelliteDishCount,
    penthouseCount: stats.penthouseCount,
    solarArrayCount: stats.solarArrayCount,
    greenRoofCount: stats.greenRoofCount,
    roofDeckCount: stats.roofDeckCount,
    litWindowCount: stats.litWindowCount,
    hasMasonryCoursing: stats.hasMasonryCoursing ? 1 : 0,
    hasSpandrelBands: stats.hasSpandrelBands ? 1 : 0,
    hasMullions: stats.hasMullions ? 1 : 0,
    hasExposedStructure: stats.hasExposedStructure ? 1 : 0,
    night: stats.night ? 1 : 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Dresses the whole block for one era.
 *
 * The instance list follows the layout's own parcel order, so the same seed
 * always writes the same plan and the digest is stable across runs and machines.
 */
export function buildBuildingPlan(eraId: EraId, context: BuildingContext): BuildingPlan {
  const era = getEra(eraId)
  const data = buildingEraData(era.id)
  const quality = resolveBuildingQuality(context.qualityTier)
  const night = context.night ?? era.lighting.sunElevationDeg <= 0
  const reducedMotion = context.reducedMotion ?? false
  const seed: Seed = context.seed ?? context.layout.seedInput
  const rng = createRng(seed, `buildings:${era.id}`).fork(era.id)

  // Eras that request vacancy or construction always show at least one, so the
  // state is a visible fact of the period rather than a coin flip that could
  // come up empty on one seed.
  const forced = new Map<string, BuildingInstance['state']>()
  const parcels = context.layout.parcels
  if (data.massing.vacancyRate > 0 && parcels.length > 0) {
    const pick = parcels[rng.int(0, parcels.length)]
    if (pick !== undefined) {
      forced.set(pick.id, 'vacant-lot')
    }
  }
  if (data.massing.constructionRate > 0 && parcels.length > 0) {
    const index = rng.int(0, parcels.length)
    const pick = parcels[index]
    if (pick !== undefined && !forced.has(pick.id)) {
      forced.set(pick.id, 'construction')
    } else {
      const fallback = parcels[(index + 1) % parcels.length]
      if (fallback !== undefined) {
        forced.set(fallback.id, 'construction')
      }
    }
  }

  const buildings = parcels.map((parcel) =>
    buildInstance(parcel, data, quality.detail, night, rng, forced.get(parcel.id)),
  )

  return {
    kind: BUILDING_PLAN_KIND,
    eraId: era.id,
    year: era.year,
    seed,
    qualityTier: quality.tier,
    detail: quality.detail,
    night,
    reducedMotion,
    style: data.style,
    palette: {
      base: era.palette.buildingBase,
      accent: era.palette.buildingAccent,
      trim: era.palette.facadeTrim,
      roof: era.palette.buildingAccent,
      glass: era.palette.windowGlass,
    },
    lighting: {
      artificialLightColor: era.lighting.artificialLightColor,
      artificialLightIntensity: era.lighting.artificialLightIntensity,
      windowEmissive: night ? data.massing.windowEmissive : 0,
      night,
    },
    buildings,
    stats: buildStats(buildings, night),
  }
}

/** Plan for one era — the entry point the composition and the director call. */
export function applyEra(eraId: EraId, context: BuildingContext): BuildingPlan {
  return buildBuildingPlan(eraId, context)
}

/**
 * Plan for a staged era change.
 *
 * `mix` runs 0 → 1 as the block grows from `from` to `to`. Under reduced motion
 * the change is one step: `mix` snaps to 0 or 1, so nothing animates. At `t = 1`
 * the resolved plan is exactly `applyEra(to, context)`.
 */
export function applyEraTransition(
  transition: BuildingTransitionInput,
  context: BuildingContext,
): BuildingTransitionPlan {
  const from = getEra(transition.from).id
  const to = getEra(transition.to).id
  const t = clamp(Number.isFinite(transition.t) ? transition.t : 0, 0, 1)
  const reducedMotion = context.reducedMotion ?? false
  const settled = from === to
  const fromPlan = applyEra(from, { ...context, reducedMotion })
  const toPlan = settled ? fromPlan : applyEra(to, { ...context, reducedMotion })
  const instant = reducedMotion && !settled
  const mix = settled ? 0 : instant ? (t >= 0.5 ? 1 : 0) : t
  const resolvedEra: EraId = settled ? to : mix >= 0.5 ? to : from
  const resolvedPlan = resolvedEra === to ? toPlan : fromPlan

  return {
    kind: BUILDING_TRANSITION_KIND,
    from,
    to,
    t,
    mix,
    instant,
    resolvedEra,
    plan: resolvedPlan,
    fromPlan,
    toPlan,
  }
}
