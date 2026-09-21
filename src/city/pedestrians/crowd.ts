/**
 * Deterministic crowd of the era pedestrian layer.
 *
 * `buildCrowdPlan` sizes a period's crowd against the *real* sidewalk length the
 * layout publishes, then binds every person to real geometry: walkers to a
 * sampled sidewalk-loop spline at an arc-length position, and waiting people to
 * a real crosswalk waypoint. Nobody stands in the road and nobody walks off the
 * pavement, because positions only ever come from the layout's own splines.
 *
 * `posePedestrians` is the animation contract: given a plan, the block and a
 * clock reading it returns every person's world position, heading and gait
 * phase, so the painter and the tests share one motion model and the layer never
 * reads a wall clock.
 */

import { getEra, type EraId } from '../../era'
import { clamp, splinePoseAt, type BlockLayout, type CrossingPath, type PathSpline, type Vec3 } from '../layout'
import { resolveQualityTier } from '../../lib/quality'
import type { QualityTierName } from '../../lib/quality'
import { createRng, type Rng, type Seed } from '../../lib/rng'
import { outfitEraData } from './tables'
import {
  CROWD_PLAN_KIND,
  CROWD_TRANSITION_KIND,
  type CrowdStats,
  type Pedestrian,
  type PedestrianContext,
  type PedestrianEraData,
  type PedestrianPlan,
  type PedestrianPose,
  type PedestrianTransitionInput,
  type PedestrianTransitionPlan,
} from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Metres of sidewalk one person occupies at density 1. */
export const METRES_PER_PEDESTRIAN = 5.5

/** Fraction of the crowd that waits at a crosswalk rather than walking. */
export const WAITING_FRACTION = 0.18

/** Hard cap on a single era's authored crowd, whatever the tier. */
export const MAX_CROWD = 240

/** Below this the pavement reads as empty; every era keeps at least this many. */
export const MIN_CROWD = 4

/* -------------------------------------------------------------------------- */
/* Quality                                                                    */
/* -------------------------------------------------------------------------- */

/** Quality tier and its crowd-density multiplier, resolved once per plan. */
export interface CrowdQualitySelection {
  readonly tier: QualityTierName
  readonly density: number
}

/** Resolves the tier (and its crowd density) a plan is built at. */
export function resolveCrowdQuality(tier?: QualityTierName): CrowdQualitySelection {
  const resolved = resolveQualityTier(tier)
  return { tier: resolved.name, density: resolved.density.pedestrians }
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                       */
/* -------------------------------------------------------------------------- */

/** The sidewalk loops and crossings a crowd can use. */
export interface CrowdRoutes {
  readonly loops: readonly PathSpline[]
  readonly crossings: readonly CrossingPath[]
  readonly sidewalkLengthM: number
}

/** Collects the walkable loops and the crosswalk waypoints from the block. */
export function crowdRoutes(layout: BlockLayout): CrowdRoutes {
  const loops = layout.pedestrianSplines.filter((spline) => spline.role === 'sidewalk-loop')
  return {
    loops,
    crossings: layout.crossings,
    sidewalkLengthM: loops.reduce((total, spline) => total + spline.length, 0),
  }
}

/** Number of walkers and waiters one era authors against a real sidewalk. */
export interface CrowdCensus {
  readonly density: number
  readonly walkers: number
  readonly waiters: number
  readonly total: number
}

/** Sizes one era's crowd from its density against the real sidewalk length. */
export function crowdCensus(
  eraId: EraId,
  routes: CrowdRoutes,
  tierDensity: number,
): CrowdCensus {
  const era = getEra(eraId)
  const data = outfitEraData(era.id)
  const density = era.population.pedestrianDensity * data.densityScale
  const raw = routes.sidewalkLengthM * (density * tierDensity) / METRES_PER_PEDESTRIAN
  const total = Math.round(clamp(raw, MIN_CROWD, MAX_CROWD))
  const waiters = Math.min(
    routes.crossings.length * 2,
    Math.max(1, Math.round(total * WAITING_FRACTION)),
  )
  const walkers = Math.max(1, total - waiters)
  return { density, walkers, waiters, total: walkers + waiters }
}

function buildStats(pedestrians: readonly Pedestrian[], data: PedestrianEraData, routes: CrowdRoutes, density: number): CrowdStats {
  const heights = pedestrians.map((person) => person.heightM)
  const speeds = pedestrians.map((person) => person.speedMps)
  const strides = pedestrians.map((person) => person.strideM)
  const outfits = new Set(pedestrians.map((person) => person.outfitId))
  const hairs = new Set(pedestrians.map((person) => data.outfits[person.outfitIndex]?.hair ?? 'short'))
  const headwear = new Set(
    pedestrians.map((person) => data.outfits[person.outfitIndex]?.headwear ?? 'none'),
  )
  const carried = new Set(pedestrians.flatMap((person) => data.outfits[person.outfitIndex]?.carried ?? []))
  const children = pedestrians.filter((person) => person.child).length
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

  return {
    pedestrianCount: pedestrians.length,
    adultCount: pedestrians.length - children,
    childCount: children,
    walkerCount: pedestrians.filter((person) => !person.waiting).length,
    waiterCount: pedestrians.filter((person) => person.waiting).length,
    uniqueOutfits: outfits.size,
    outfitVariants: data.outfits.length,
    hairVariants: hairs.size,
    headwearVariants: headwear.size,
    carriedVariants: carried.size,
    sidewalkLengthM: routes.sidewalkLengthM,
    density,
    averageSpeedMps: mean(speeds),
    averageHeightM: mean(heights),
    minHeightM: heights.length === 0 ? 0 : Math.min(...heights),
    maxHeightM: heights.length === 0 ? 0 : Math.max(...heights),
    averageStrideM: mean(strides),
    childRatio: pedestrians.length === 0 ? 0 : children / pedestrians.length,
    groupCount: pedestrians.length === 0 ? 0 : Math.max(1, Math.round(pedestrians.length / 2.4)),
  }
}

/** Creates one walker bound to a sidewalk loop at an arc-length position. */
function walker(
  index: number,
  loop: PathSpline,
  perLoopIndex: number,
  perLoopCount: number,
  data: PedestrianEraData,
  childRatio: number,
  averageSpeedMps: number,
  walkSpeedScale: number,
  rng: Rng,
): Pedestrian {
  const outfitIndex = rng.int(0, data.outfits.length)
  const outfit = data.outfits[outfitIndex] ?? data.outfits[0]
  const child = rng.bool(childRatio)
  const pace = rng.float(0.85, 1.15)
  const base = (perLoopCount <= 0 ? 0 : loop.length / perLoopCount) * perLoopIndex
  const distance = (base + rng.float(0, loop.length / Math.max(1, perLoopCount))) % loop.length
  const speedMps = averageSpeedMps * walkSpeedScale * pace * (child ? 0.82 : 1)
  return {
    id: `ped:${index}`,
    modelKey: outfit?.modelKey ?? 'pedestrian',
    outfitId: outfit?.id ?? 'pedestrian',
    outfitIndex,
    child,
    splineName: loop.name,
    distance,
    direction: rng.bool(0.5) ? 1 : -1,
    speedMps,
    strideM: Math.max(0.35, speedMps * 0.55) * (child ? 0.7 : 1),
    gaitPhase: rng.float(0, Math.PI * 2),
    heightM: 1.75 * (outfit?.heightScale ?? 1) * (child ? 0.72 : 1) * rng.float(0.95, 1.05),
    build: (outfit?.build ?? 1) * rng.float(0.9, 1.1),
    pace,
    waiting: false,
  }
}

/** Creates one person waiting at a real crosswalk waypoint. */
function waiter(
  index: number,
  crossing: CrossingPath,
  data: PedestrianEraData,
  childRatio: number,
  averageSpeedMps: number,
  rng: Rng,
): Pedestrian {
  const outfitIndex = rng.int(0, data.outfits.length)
  const outfit = data.outfits[outfitIndex] ?? data.outfits[0]
  const child = rng.bool(childRatio)
  const pace = rng.float(0.9, 1.1)
  return {
    id: `ped:${index}`,
    modelKey: outfit?.modelKey ?? 'pedestrian',
    outfitId: outfit?.id ?? 'pedestrian',
    outfitIndex,
    child,
    splineName: crossing.spline,
    distance: 0,
    direction: 1,
    speedMps: averageSpeedMps * 0.25 * pace,
    strideM: Math.max(0.3, averageSpeedMps * 0.4) * (child ? 0.7 : 1),
    gaitPhase: rng.float(0, Math.PI * 2),
    heightM: 1.75 * (outfit?.heightScale ?? 1) * (child ? 0.72 : 1) * rng.float(0.95, 1.05),
    build: (outfit?.build ?? 1) * rng.float(0.9, 1.1),
    pace,
    waiting: true,
  }
}

/**
 * Dresses the pavement for one era.
 *
 * Determinism: the generator is forked from the layout seed with the era id,
 * every draw is taken in a fixed person order, and nothing reads the clock, so
 * `applyEra('1985', ctx)` is byte-identical on every run and machine.
 */
export function buildCrowdPlan(eraId: EraId, context: PedestrianContext): PedestrianPlan {
  const era = getEra(eraId)
  const data = outfitEraData(era.id)
  const quality = resolveCrowdQuality(context.qualityTier)
  const night = context.night ?? era.lighting.sunElevationDeg <= 0
  const reducedMotion = context.reducedMotion ?? false
  const seed: Seed = context.seed ?? context.layout.seedInput
  const rng = createRng(seed, `pedestrians:${era.id}`).fork(era.id)
  const routes = crowdRoutes(context.layout)
  const census = crowdCensus(era.id, routes, quality.density)
  const loops = routes.loops.length === 0 ? [] : routes.loops
  const averageSpeed = era.population.averageSpeedMps

  const pedestrians: Pedestrian[] = []
  const perLoopCount = loops.length === 0 ? 0 : Math.ceil(census.walkers / loops.length)
  for (let index = 0; index < census.walkers; index += 1) {
    const loop = loops[index % Math.max(1, loops.length)]
    if (loop === undefined) {
      break
    }
    pedestrians.push(
      walker(
        index,
        loop,
        Math.floor(index / Math.max(1, loops.length)),
        perLoopCount,
        data,
        data.childRatio,
        averageSpeed,
        data.walkSpeedScale,
        rng,
      ),
    )
  }

  const crossings = routes.crossings
  for (let index = 0; index < census.waiters; index += 1) {
    const crossing = crossings[index % Math.max(1, crossings.length)]
    if (crossing === undefined) {
      break
    }
    pedestrians.push(
      waiter(census.walkers + index, crossing, data, data.childRatio, averageSpeed, rng),
    )
  }

  return {
    kind: CROWD_PLAN_KIND,
    eraId: era.id,
    year: era.year,
    seed,
    qualityTier: quality.tier,
    detail: quality.density,
    night,
    reducedMotion,
    outfitEraTag: data.outfitEraTag,
    sidewalkLengthM: routes.sidewalkLengthM,
    density: census.density,
    pedestrians,
    stats: buildStats(pedestrians, data, routes, census.density),
  }
}

/** Plan for one era — the entry point the composition and the director call. */
export function applyEra(eraId: EraId, context: PedestrianContext): PedestrianPlan {
  return buildCrowdPlan(eraId, context)
}

/**
 * Plan for a staged era change.
 *
 * `mix` runs 0 → 1 as the crowd cross-dresses from `from` to `to`; the painter
 * swaps outfits, density and carried props at that depth. Under reduced motion
 * the change is one step: `mix` snaps to 0 or 1.
 */
export function applyEraTransition(
  transition: PedestrianTransitionInput,
  context: PedestrianContext,
): PedestrianTransitionPlan {
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
    kind: CROWD_TRANSITION_KIND,
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

/* -------------------------------------------------------------------------- */
/* Motion                                                                     */
/* -------------------------------------------------------------------------- */

/** Wraps an angle into `(-π, π]`, so headings interpolate cleanly. */
export function wrapAngle(angle: number): number {
  const wrapped = angle % (Math.PI * 2)
  if (wrapped <= -Math.PI) {
    return wrapped + Math.PI * 2
  }
  if (wrapped > Math.PI) {
    return wrapped - Math.PI * 2
  }
  return wrapped
}

/** Yaw that faces a walker along a tangent; `direction` reverses it. */
export function headingFromTangent(tangent: Vec3, direction: 1 | -1): number {
  return wrapAngle(Math.atan2(tangent.x * direction, tangent.z * direction))
}

function waitingPosition(
  crossing: CrossingPath | undefined,
  pose: { readonly position: Vec3 },
): Vec3 {
  const point = crossing?.waitingPoints[0]
  if (point !== undefined) {
    return point
  }
  return pose.position
}

/**
 * Poses every pedestrian of a plan at one clock reading.
 *
 * Walkers advance along their spline by `speed * clock` and take their heading
 * from the spline tangent; waiting people hold the crosswalk waypoint they were
 * bound to with an idle sway. The function is pure, so the painter and the tests
 * see exactly the same motion.
 */
export function posePedestrians(
  plan: PedestrianPlan,
  layout: BlockLayout,
  clockSec: number,
): readonly PedestrianPose[] {
  const clock = Number.isFinite(clockSec) ? clockSec : 0
  const splines = new Map<string, PathSpline>()
  for (const spline of layout.pedestrianSplines) {
    splines.set(spline.name, spline)
  }
  const crossings = new Map<string, CrossingPath>()
  for (const crossing of layout.crossings) {
    crossings.set(crossing.spline, crossing)
  }

  return plan.pedestrians.map((person) => {
    const spline = splines.get(person.splineName)
    if (spline === undefined) {
      return {
        id: person.id,
        position: { x: 0, y: 0, z: 0 },
        heading: 0,
        phase: person.gaitPhase,
        speedMps: person.speedMps,
        waiting: person.waiting,
        heightM: person.heightM,
        build: person.build,
        outfitIndex: person.outfitIndex,
        child: person.child,
        splineName: person.splineName,
      }
    }

    if (person.waiting) {
      const walking = splinePoseAt(spline, 0)
      return {
        id: person.id,
        position: waitingPosition(crossings.get(person.splineName), walking),
        heading: headingFromTangent(walking.tangent, 1),
        phase: (clock * 1.4 + person.gaitPhase) % (Math.PI * 2),
        speedMps: person.speedMps,
        waiting: true,
        heightM: person.heightM,
        build: person.build,
        outfitIndex: person.outfitIndex,
        child: person.child,
        splineName: person.splineName,
      }
    }

    const distance = person.distance + person.direction * person.speedMps * clock
    const walking = splinePoseAt(spline, distance)
    return {
      id: person.id,
      position: walking.position,
      heading: headingFromTangent(walking.tangent, person.direction),
      phase: ((distance / Math.max(0.2, person.strideM)) * Math.PI + person.gaitPhase) % (Math.PI * 2),
      speedMps: person.speedMps,
      waiting: false,
      heightM: person.heightM,
      build: person.build,
      outfitIndex: person.outfitIndex,
      child: person.child,
      splineName: person.splineName,
    }
  })
}

/** Flattens the census into the numeric record the composition publishes. */
export function crowdStatsRecord(stats: CrowdStats): Readonly<Record<string, number>> {
  return {
    pedestrianCount: stats.pedestrianCount,
    adultCount: stats.adultCount,
    childCount: stats.childCount,
    walkerCount: stats.walkerCount,
    waiterCount: stats.waiterCount,
    uniqueOutfits: stats.uniqueOutfits,
    outfitVariants: stats.outfitVariants,
    hairVariants: stats.hairVariants,
    headwearVariants: stats.headwearVariants,
    carriedVariants: stats.carriedVariants,
    sidewalkLengthM: stats.sidewalkLengthM,
    density: stats.density,
    averageSpeedMps: stats.averageSpeedMps,
    averageHeightM: stats.averageHeightM,
    minHeightM: stats.minHeightM,
    maxHeightM: stats.maxHeightM,
    averageStrideM: stats.averageStrideM,
    childRatio: stats.childRatio,
    groupCount: stats.groupCount,
  }
}

/** Every era's crowd plan for a block, in timeline order. */
export function buildAllCrowdPlans(context: PedestrianContext): readonly PedestrianPlan[] {
  return (['1945', '1965', '1985', '2005', '2025'] as const).map((eraId: EraId) =>
    applyEra(eraId, context),
  )
}

/** Stable digest of a crowd plan, for determinism assertions. */
export function crowdPlanHash(plan: PedestrianPlan): string {
  const serialised = JSON.stringify(plan)
  let low = 0x811c9dc5
  let high = 0x1b873593
  for (let index = 0; index < serialised.length; index += 1) {
    const code = serialised.charCodeAt(index)
    low = Math.imul(low ^ code, 0x01000193) >>> 0
    high = Math.imul(high ^ code, 0x01000193) >>> 0
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}
