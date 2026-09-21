/**
 * The era crowd: placement, walk and crossing behaviour, era application, and
 * the instanced render payload.
 *
 * ## Determinism
 *
 * Identity, proportions, gait and the five era looks are drawn once per
 * pedestrian from `pedestrianRng(seed, index)` (`bodies.ts`, `outfits.ts`), so
 * two crowds with the same seed dress and move the same way. Motion then
 * advances in **fixed sub-steps** of {@link PEDESTRIAN_FIXED_STEP} seconds
 * driven by the caller's clock: `advanceCrowd` accumulates sub-step seconds and
 * `seekCrowd` replays the same sub-steps from the spawn, so any subdivision of
 * the same elapsed time yields the same state. That is what lets unit,
 * composition and browser tests step time without a renderer.
 *
 * ## Behaviour
 *
 * Pedestrians only ever move along the layout's own pedestrian splines: the
 * sidewalk loop for walking and the crossing loops for crossing. A crosser walks
 * the sidewalk until it reaches the crossing's waiting point, waits there while
 * that crossing's signal is red, then walks the whole crossing loop — out across
 * the carriageway and back — and rejoins the sidewalk where it left it. Nothing
 * here invents a path, and no pedestrian leaves the corridor the layout built.
 *
 * ## Era changes
 *
 * `applyEra(eraId, ctx)` re-dresses, re-densifies and re-routes instantly, which
 * is the reduced-motion path. `applyEraTransition({ from, to, t }, ctx)` stages
 * the same change: each pedestrian owns a `dressWeight` in `[0, 1)`, garments
 * swap once the blend passes that weight, and carried props lead the garments by
 * a margin, so a staged switch shows old clothes with new props before the
 * clothes follow.
 */

import * as THREE from 'three'
import { DEFAULT_ERA_ID, ERA_ID_ORDER, getEra, type EraId } from '../../era'
import { DEFAULT_QUALITY_TIER, QUALITY_TIERS, type QualityTierName } from '../../lib/quality'
import {
  CANONICAL_LAYOUT_SEED,
  createCityLayout,
  splinePoseAt,
  v3,
  type CityLayout,
  type PathSpline,
  type Vec3,
} from '../layout'
import {
  BODY_PART_SHAPES,
  animationLodFor,
  createBodyProfile,
  createGaitProfile,
  pedestrianRng,
  posePedestrian,
  restPose,
  shapeTriangleCount,
  type PoseInput,
} from './bodies'
import {
  digestTokens,
  resolveOutfit,
  shapeGeometryKey,
  skinToneAt,
  tierDetail,
  tierShape,
} from './outfits'
import { getCrowdTable } from './tables'
import { PART_IDS } from './types'
import type {
  AnimationLod,
  CrossingAnchor,
  Crowd,
  CrowdCostEstimate,
  CrowdStats,
  EraBlend,
  EraCrowdTable,
  HexColor,
  Pedestrian,
  PedestrianLayerContext,
  PedestrianLayerHandle,
  PedestrianLayerOptions,
  PedestrianPlacement,
  PedestrianPose,
  PoseFrame,
  PrimitiveShape,
  ResolvedItem,
  ResolvedOutfit,
} from './types'

/* ------------------------------------------------------------------------- *
 * Constants
 * ------------------------------------------------------------------------- */

/** Simulation sub-step, in seconds. Every clock path advances in these steps. */
export const PEDESTRIAN_FIXED_STEP = 1 / 30

/** Longest single advance accepted by {@link advanceCrowd}, in seconds. */
export const MAX_ADVANCE_SECONDS = 5

/** Longest simulated time {@link seekCrowd} will replay to, in seconds. */
export const MAX_SEEK_SECONDS = 900

/** Pedestrians a metre of sidewalk carries at unit density. */
export const PEDESTRIANS_PER_METRE = 0.12

/** Smallest crowd any density produces: a street is never completely empty. */
export const MIN_CROWD_COUNT = 6

/** Largest crowd any density or layout produces. */
export const MAX_CROWD_COUNT = 96

/** Fraction of the pool that uses a crosswalk instead of walking past it. */
export const CROSSING_SHARE = 0.55

/** Metres a crosser walks before the next crossing can trigger. */
export const MIN_CROSSING_INTERVAL_M = 12

/** Crossers slow slightly at the kerb, watching the traffic. */
export const CROSSING_SPEED_SCALE = 0.95

/** Peak sideways weave of a walker around the walk line, in metres. */
export const WEAVE_AMPLITUDE_M = 0.14

/** Crossing signal schedule: one period, the green window, the phase offset. */
export const CROSSING_SIGNAL = {
  periodSeconds: 24,
  greenSeconds: 11,
  /** Phase offset between neighbouring crossings, in seconds. */
  offsetSeconds: 3,
} as const

/** Fixed steps between pose refreshes at animation level of detail 1. */
export const LOD1_FRAME_INTERVAL = 3

/** Renderer-free default camera used by the cost estimate, in world metres. */
export const DEFAULT_CAMERA_POSITION: Vec3 = v3(34, 12, 58)

/** Instances one shared geometry may hold per pedestrian of pool capacity. */
export const INSTANCES_PER_KEY = 6

/**
 * Triangle budget of the crowd per quality tier.
 *
 * A budget, not a measurement: the unit and browser suites assert both the
 * estimate and the renderer's own report stay inside it, so anything that
 * inflates the crowd — more parts, lost instancing, a wrong level of detail —
 * fails loudly. Ordered high > medium > low like every shared quality constant.
 */
export const PEDESTRIAN_TRIANGLE_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 46_000,
  medium: 24_000,
  low: 11_000,
}

/** Instanced draw calls the crowd may submit per tier. */
export const PEDESTRIAN_DRAW_CALL_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 64,
  medium: 60,
  low: 52,
}

/** Triangles of the shared geometry pool itself, per tier. */
export const PEDESTRIAN_GEOMETRY_BUDGETS: Readonly<Record<QualityTierName, number>> = {
  high: 2_600,
  medium: 1_600,
  low: 1_200,
}

/** How far ahead of the garments a staged switch re-dresses carried props. */
export const PROP_LEAD_SCALE = 1.3

/** Shared geometry of a pedestrian beyond the far animation LOD distance. */
export const SILHOUETTE_SHAPE: PrimitiveShape = {
  kind: 'tapered-cylinder',
  size: [0.62, 1.75, 0.62],
  segments: 6,
  taper: 0.72,
  offset: [0, 0.875, 0],
  rotation: [0, 0, 0],
}

/** Geometry key of the far-distance silhouette. */
export const SILHOUETTE_KEY = 'body:silhouette'

/** Era ids the layer dresses, in timeline order. */
export const PEDESTRIAN_ERA_IDS: readonly EraId[] = ERA_ID_ORDER

/* ------------------------------------------------------------------------- *
 * Small maths helpers
 * ------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function wrap(value: number, length: number): number {
  if (!(length > 0)) {
    return 0
  }
  return ((value % length) + length) % length
}

/** Forward distance from `from` to `to` on a closed loop of `length`. */
function forwardDistance(from: number, to: number, length: number): number {
  return wrap(to - from, length)
}

function horizontal(vector: Vec3): Vec3 {
  const magnitude = Math.hypot(vector.x, vector.z)
  return magnitude > 0 ? v3(vector.x / magnitude, 0, vector.z / magnitude) : v3(0, 0, 1)
}

/** Right-hand ground normal of a heading. */
function rightOf(heading: Vec3): Vec3 {
  return v3(-heading.z, 0, heading.x)
}

/** Simulated seconds a crowd has advanced. */
export function crowdTimeSeconds(crowd: Crowd): number {
  return crowd.steps * PEDESTRIAN_FIXED_STEP
}

/** Crossing signal state at one instant: walkers only step off on green. */
export function crossingSignalAt(crossingIndex: number, timeSeconds: number): 'green' | 'red' {
  const period = CROSSING_SIGNAL.periodSeconds
  const offset = Math.max(0, Math.trunc(crossingIndex)) * CROSSING_SIGNAL.offsetSeconds
  const phase = wrap(timeSeconds + offset, period)
  return phase < CROSSING_SIGNAL.greenSeconds ? 'green' : 'red'
}

/* ------------------------------------------------------------------------- *
 * Layout queries
 * ------------------------------------------------------------------------- */

/** Index of the sidewalk loop inside `CityLayout.pedestrianSplines`. */
export function sidewalkSplineIndex(layout: CityLayout): number {
  const index = layout.pedestrianSplines.findIndex((spline) => spline.role === 'sidewalk-loop')
  if (index < 0) {
    throw new RangeError('The layout exports no sidewalk-loop pedestrian spline')
  }
  return index
}

/** Length of the sidewalk loop, in metres: the walkable length of the block. */
export function walkableSidewalkLength(layout: CityLayout): number {
  const spline = layout.pedestrianSplines[sidewalkSplineIndex(layout)]
  if (spline === undefined) {
    throw new RangeError('The layout exports no sidewalk-loop pedestrian spline')
  }
  return spline.length
}

/** Arc distance of the point of `spline` nearest to a ground position. */
export function nearestArcDistance(spline: PathSpline, point: Vec3): number {
  const count = spline.sampleCount
  const spacing = spline.sampleSpacing
  const sampleAt = (sample: number): Vec3 => {
    const base = ((sample % count) + count) % count
    return v3(
      spline.positions[base * 3] ?? 0,
      spline.positions[base * 3 + 1] ?? 0,
      spline.positions[base * 3 + 2] ?? 0,
    )
  }

  let nearest = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let sample = 0; sample < count; sample += 1) {
    const candidate = sampleAt(sample)
    const distance = Math.hypot(candidate.x - point.x, candidate.z - point.z)
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = sample
    }
  }

  // Refine on the two segments that touch the nearest sample, so a crossing
  // anchors where it really meets the walk line instead of one sample early.
  let arc = nearest * spacing
  for (const direction of [1, -1] as const) {
    const from = sampleAt(nearest)
    const to = sampleAt(nearest + direction)
    const vx = to.x - from.x
    const vz = to.z - from.z
    const lengthSquared = vx * vx + vz * vz
    if (lengthSquared <= 0) {
      continue
    }
    const t = clamp(((point.x - from.x) * vx + (point.z - from.z) * vz) / lengthSquared, 0, 1)
    const px = from.x + vx * t
    const pz = from.z + vz * t
    const distance = Math.hypot(point.x - px, point.z - pz)
    if (distance < bestDistance) {
      bestDistance = distance
      arc = nearest * spacing + direction * t * spacing
    }
  }

  return wrap(arc, spline.length)
}

/**
 * Where every crossing meets the sidewalk loop, and where its walkers wait.
 *
 * The layout publishes both: the crossing loop's first sample sits on the walk
 * line, and `CrossingPath.waitingPoints[0]` is the kerbside waiting point two
 * metres inside the kerb. Anchors are ordered by crossing index, so the crowd is
 * deterministic without depending on map iteration order.
 */
export function crossingAnchors(layout: CityLayout): readonly CrossingAnchor[] {
  const loop = layout.pedestrianSplines[sidewalkSplineIndex(layout)]
  if (loop === undefined) {
    throw new RangeError('The layout exports no sidewalk-loop pedestrian spline')
  }

  return layout.crossings.map((crossing, index) => {
    const splineIndex = layout.pedestrianSplines.findIndex((spline) => spline.name === crossing.spline)
    const spline = splineIndex >= 0 ? layout.pedestrianSplines[splineIndex] : undefined
    const waitingPoint = crossing.waitingPoints[0]
    if (spline === undefined || waitingPoint === undefined) {
      throw new RangeError(`Crossing ${crossing.name} is missing its spline or waiting point`)
    }
    const start = splinePoseAt(spline, 0)
    return {
      crossingIndex: index,
      crossingName: crossing.name,
      splineIndex,
      anchorDistance: nearestArcDistance(loop, waitingPoint),
      waitingPoint,
      crossingHeading: horizontal(start.tangent),
    }
  })
}

/**
 * Crowd size of one era on one tier.
 *
 * Density is measured against the block's real walkable length — the sidewalk
 * loop the layout publishes — and scaled by the tier's pedestrian density, so a
 * busy 2025 pavement really is denser than a 1945 one and a low-tier device
 * carries a proportional share of it.
 */
export function crowdTargetCount(
  layout: CityLayout,
  density: number,
  tier: QualityTierName,
): number {
  const length = walkableSidewalkLength(layout)
  const tierFactor = QUALITY_TIERS[tier].density.pedestrians
  const count = clamp(density, 0, 1.5) * PEDESTRIANS_PER_METRE * length * tierFactor
  return Math.round(clamp(count, MIN_CROWD_COUNT, MAX_CROWD_COUNT))
}

/* ------------------------------------------------------------------------- *
 * Spawning
 * ------------------------------------------------------------------------- */

/** Dresses one pedestrian for all five eras, each from its own generator fork. */
function resolveEraOutfits(rng: ReturnType<typeof pedestrianRng>): ReadonlyMap<EraId, ResolvedOutfit> {
  const outfits = new Map<EraId, ResolvedOutfit>()
  for (const eraId of ERA_ID_ORDER) {
    outfits.set(eraId, resolveOutfit({ table: getCrowdTable(eraId), rng: rng.fork(`outfit:${eraId}`) }))
  }
  return outfits
}

/**
 * Spawns the pedestrian pool.
 *
 * Every field is a pure function of the block seed and the pedestrian index, so
 * figures, gaits, all five era looks, crossing decisions and cross-dress weights
 * are reproducible. The era only contributes the pool's child share and the mean
 * gait the personal gaits derive from.
 */
function spawnPedestrians(
  layout: CityLayout,
  seed: string,
  capacity: number,
  childShare: number,
  eraGait: EraCrowdTable['gait'],
  anchors: readonly CrossingAnchor[],
): Pedestrian[] {
  const loopIndex = sidewalkSplineIndex(layout)
  const pedestrians: Pedestrian[] = []
  for (let index = 0; index < capacity; index += 1) {
    const rng = pedestrianRng(seed, index)
    const body = createBodyProfile(rng.fork('body'), childShare)
    const gait = createGaitProfile(rng.fork('gait'), eraGait, body)
    const route = rng.fork('route')
    const crosses = anchors.length > 0 && route.bool(CROSSING_SHARE)
    const crossingIndex = crosses ? route.int(0, anchors.length) : -1
    const dressWeight = route.next()
    const spawnFraction = route.next()
    const lateralOffsetM = route.float(-0.55, 0.55)
    const idlePhase = route.next()
    const lookPhase = route.next()

    pedestrians.push({
      index,
      body,
      gait,
      dressWeight,
      skinTone: skinToneAt(index + Math.floor(spawnFraction * 97)),
      crosses,
      crossingIndex,
      outfits: resolveEraOutfits(rng),
      lateralOffsetM,
      spawnFraction,
      idlePhase,
      lookPhase,
      visible: false,
      state: 'walking',
      splineIndex: loopIndex,
      distance: 0,
      direction: 1,
      gaitPhase: spawnFraction,
      walkedSinceCrossing: MIN_CROSSING_INTERVAL_M,
      stateSeconds: 0,
      crossingStarted: false,
    })
  }
  return pedestrians
}

/** Sets the visibility of the pool from the active count, in spawn-fraction order. */
function refreshVisibility(crowd: Crowd): void {
  const active = clamp(Math.round(crowd.activeCount), 0, crowd.pedestrians.length)
  crowd.activeCount = active
  for (const pedestrian of crowd.pedestrians) {
    pedestrian.visible = false
  }
  for (let rank = 0; rank < active; rank += 1) {
    const index = crowd.visibilityOrder[rank]
    const pedestrian = index === undefined ? undefined : crowd.pedestrians[index]
    if (pedestrian !== undefined) {
      pedestrian.visible = true
    }
  }
}

/**
 * Places the pool along the sidewalk loop and resets the clock.
 *
 * Spawn positions use each person's own spawn fraction, so the pool is spread
 * over the whole loop while visibility picks a spread subset of it; both are
 * deterministic, and a reset always reproduces the same crowd state.
 */
export function resetCrowd(crowd: Crowd): void {
  crowd.steps = 0
  crowd.remainder = 0
  const length = crowd.sidewalkLength
  for (const pedestrian of crowd.pedestrians) {
    pedestrian.state = 'walking'
    pedestrian.splineIndex = crowd.sidewalkSplineIndex
    pedestrian.distance = wrap(pedestrian.spawnFraction * length, length)
    pedestrian.direction = 1
    pedestrian.gaitPhase = pedestrian.spawnFraction
    pedestrian.walkedSinceCrossing = MIN_CROSSING_INTERVAL_M
    pedestrian.stateSeconds = 0
    pedestrian.crossingStarted = false
  }
  refreshVisibility(crowd)
}

/** Creates a crowd for one era, ready to advance. */
export function createPedestrianCrowd(options: {
  readonly layout: CityLayout
  readonly eraId: EraId
  readonly seed: string
  readonly tier: QualityTierName
}): Crowd {
  const { layout, eraId, seed, tier } = options
  const table = getCrowdTable(eraId)
  const anchors = crossingAnchors(layout)
  const capacity = crowdTargetCount(layout, 1, 'high')
  const childShare = getEra(eraId).population.childRatio
  const pedestrians = spawnPedestrians(layout, seed, capacity, childShare, table.gait, anchors)

  const crowd: Crowd = {
    layout,
    seed,
    tier,
    sidewalkSplineIndex: sidewalkSplineIndex(layout),
    sidewalkLength: walkableSidewalkLength(layout),
    anchors,
    pedestrians,
    capacity,
    childShare,
    visibilityOrder: pedestrians
      .map((pedestrian) => pedestrian.index)
      .sort((left, right) => {
        const a = pedestrians[left]?.spawnFraction ?? 0
        const b = pedestrians[right]?.spawnFraction ?? 0
        return a === b ? left - right : a - b
      }),
    eraId,
    blend: null,
    steps: 0,
    remainder: 0,
    activeCount: crowdTargetCount(layout, table.density, tier),
  }

  resetCrowd(crowd)
  return crowd
}

/* ------------------------------------------------------------------------- *
 * Simulation
 * ------------------------------------------------------------------------- */

/** Advances one pedestrian by one fixed sub-step. */
function stepPedestrian(crowd: Crowd, pedestrian: Pedestrian, dt: number, time: number): void {
  const splines = crowd.layout.pedestrianSplines

  if (pedestrian.state === 'walking') {
    const step = pedestrian.gait.speedMps * dt * pedestrian.direction
    const previous = pedestrian.distance
    const spline = splines[pedestrian.splineIndex]
    if (spline === undefined) {
      return
    }
    pedestrian.distance = wrap(previous + step, spline.length)
    pedestrian.walkedSinceCrossing += Math.abs(step)
    pedestrian.gaitPhase = wrap(
      pedestrian.gaitPhase + Math.abs(step) / (2 * Math.max(pedestrian.gait.strideLengthM, 0.1)),
      1,
    )

    const anchor = pedestrian.crossingIndex >= 0 ? crowd.anchors[pedestrian.crossingIndex] : undefined
    if (
      anchor !== undefined &&
      pedestrian.walkedSinceCrossing >= MIN_CROSSING_INTERVAL_M &&
      forwardDistance(previous, anchor.anchorDistance, crowd.sidewalkLength) <= Math.abs(step) + 1e-9
    ) {
      pedestrian.distance = anchor.anchorDistance
      pedestrian.state = 'waiting'
      pedestrian.stateSeconds = 0
      pedestrian.crossingStarted = false
    }
    return
  }

  if (pedestrian.state === 'waiting') {
    pedestrian.stateSeconds += dt
    const anchor = pedestrian.crossingIndex >= 0 ? crowd.anchors[pedestrian.crossingIndex] : undefined
    if (anchor !== undefined && crossingSignalAt(anchor.crossingIndex, time) === 'green') {
      pedestrian.state = 'crossing'
      pedestrian.stateSeconds = 0
      pedestrian.splineIndex = anchor.splineIndex
      pedestrian.distance = 0
      pedestrian.direction = 1
      pedestrian.crossingStarted = true
    }
    return
  }

  // Crossing: walk the whole crossing loop, then rejoin the sidewalk where the
  // crossing meets it.
  const crossingSpline = splines[pedestrian.splineIndex]
  if (crossingSpline === undefined) {
    return
  }
  const step = pedestrian.gait.speedMps * CROSSING_SPEED_SCALE * dt
  pedestrian.distance += step
  pedestrian.stateSeconds += dt
  pedestrian.gaitPhase = wrap(
    pedestrian.gaitPhase + step / (2 * Math.max(pedestrian.gait.strideLengthM, 0.1)),
    1,
  )
  if (pedestrian.distance >= crossingSpline.length) {
    const anchor = pedestrian.crossingIndex >= 0 ? crowd.anchors[pedestrian.crossingIndex] : undefined
    pedestrian.state = 'walking'
    pedestrian.splineIndex = crowd.sidewalkSplineIndex
    pedestrian.distance = anchor?.anchorDistance ?? 0
    pedestrian.walkedSinceCrossing = 0
    pedestrian.stateSeconds = 0
    pedestrian.crossingStarted = false
  }
}

/** Runs one fixed sub-step of the whole crowd. */
function stepCrowd(crowd: Crowd, dt: number): void {
  const time = crowd.steps * PEDESTRIAN_FIXED_STEP
  for (const pedestrian of crowd.pedestrians) {
    stepPedestrian(crowd, pedestrian, dt, time)
  }
  crowd.steps += 1
}

/**
 * Advances the crowd by up to {@link MAX_ADVANCE_SECONDS} of simulated time.
 *
 * The elapsed time is accumulated and consumed in fixed sub-steps, so a caller
 * that advances 60 times by `1/60` and a caller that advances once by `1` end in
 * the same state — the property the tests rely on.
 */
export function advanceCrowd(crowd: Crowd, dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return
  }
  crowd.remainder += Math.min(dtSeconds, MAX_ADVANCE_SECONDS)
  let guard = 0
  const maxSteps = Math.ceil(MAX_ADVANCE_SECONDS / PEDESTRIAN_FIXED_STEP) + 1
  while (crowd.remainder >= PEDESTRIAN_FIXED_STEP && guard < maxSteps) {
    stepCrowd(crowd, PEDESTRIAN_FIXED_STEP)
    crowd.remainder -= PEDESTRIAN_FIXED_STEP
    guard += 1
  }
  if (guard >= maxSteps) {
    crowd.remainder = 0
  }
}

/**
 * Seeks the crowd to an absolute simulated time.
 *
 * Replaying is deterministic: the crowd always advances in fixed sub-steps from
 * its spawn, so `seekCrowd(crowd, t)` produces the same state however it is
 * reached. Seeking backwards — or jumping further than one advance — replays
 * from the spawn, which is what a test harness does between eras.
 */
export function seekCrowd(crowd: Crowd, seconds: number): void {
  const target = clamp(seconds, 0, MAX_SEEK_SECONDS)
  const current = crowdTimeSeconds(crowd)
  if (target < current || target - current > MAX_ADVANCE_SECONDS) {
    resetCrowd(crowd)
  }
  const remaining = target - crowdTimeSeconds(crowd)
  const steps = Math.floor(remaining / PEDESTRIAN_FIXED_STEP + 1e-9)
  for (let step = 0; step < steps; step += 1) {
    stepCrowd(crowd, PEDESTRIAN_FIXED_STEP)
  }
  crowd.remainder = 0
}

/* ------------------------------------------------------------------------- *
 * Pose and appearance
 * ------------------------------------------------------------------------- */

/** One pedestrian's world placement: where it is, which way it faces. */
export function pedestrianPlacement(crowd: Crowd, pedestrian: Pedestrian): PedestrianPlacement {
  const splines = crowd.layout.pedestrianSplines

  if (pedestrian.state === 'waiting') {
    const anchor = pedestrian.crossingIndex >= 0 ? crowd.anchors[pedestrian.crossingIndex] : undefined
    if (anchor !== undefined) {
      return {
        position: anchor.waitingPoint,
        heading: anchor.crossingHeading,
        state: 'waiting',
        speedMps: 0,
      }
    }
  }

  const spline = splines[pedestrian.splineIndex]
  if (spline === undefined) {
    throw new RangeError(`Pedestrian ${pedestrian.index} walks an unknown spline`)
  }
  const pose = splinePoseAt(spline, pedestrian.distance)
  const heading = horizontal(
    pedestrian.direction === 1 ? pose.tangent : v3(-pose.tangent.x, 0, -pose.tangent.z),
  )

  if (pedestrian.state === 'crossing') {
    return {
      position: pose.position,
      heading,
      state: 'crossing',
      speedMps: pedestrian.gait.speedMps * CROSSING_SPEED_SCALE,
    }
  }

  // Walking: weave around the walk line, always inside the sidewalk corridor.
  const lateral = pedestrian.lateralOffsetM + Math.sin(2 * Math.PI * pedestrian.gaitPhase) * WEAVE_AMPLITUDE_M
  const right = rightOf(heading)
  return {
    position: v3(
      pose.position.x + right.x * lateral,
      pose.position.y,
      pose.position.z + right.z * lateral,
    ),
    heading,
    state: 'walking',
    speedMps: pedestrian.gait.speedMps,
  }
}

/** Appearance of one pedestrian: garments plus the carried props. */
export interface DressedPedestrian {
  /** Era whose garments this pedestrian currently wears. */
  readonly eraId: EraId
  /** Which part of a staged switch this pedestrian is in. */
  readonly stage: 'from' | 'props' | 'to'
  /** Garments, hair, headwear and accessories. */
  readonly outfit: ResolvedOutfit
  /** Carried props, which lead the garments during a staged switch. */
  readonly props: readonly ResolvedItem[]
}

/**
 * Dresses one pedestrian for the crowd's current era, honouring a staged blend.
 *
 * In flight, a pedestrian whose `dressWeight` the blend has passed wears the
 * target era outright; one inside the props lead window still wears the previous
 * garments but already carries the new era's props; the rest are untouched.
 */
export function pedestrianOutfit(crowd: Crowd, pedestrian: Pedestrian): DressedPedestrian {
  const target = pedestrian.outfits.get(crowd.eraId)
  const blend = crowd.blend
  if (blend === null) {
    if (target === undefined) {
      throw new RangeError(`Pedestrian ${pedestrian.index} has no ${crowd.eraId} outfit`)
    }
    return { eraId: crowd.eraId, stage: 'to', outfit: target, props: target.props }
  }

  const from = pedestrian.outfits.get(blend.from) ?? target
  const to = pedestrian.outfits.get(blend.to) ?? target
  if (from === undefined || to === undefined) {
    throw new RangeError(`Pedestrian ${pedestrian.index} cannot be dressed for the blend`)
  }
  const t = clamp(blend.t, 0, 1)
  if (t >= 1 || pedestrian.dressWeight < t) {
    return { eraId: blend.to, stage: 'to', outfit: to, props: to.props }
  }
  if (pedestrian.dressWeight < Math.min(1, t * PROP_LEAD_SCALE)) {
    return { eraId: blend.to, stage: 'props', outfit: from, props: to.props }
  }
  return { eraId: blend.from, stage: 'from', outfit: from, props: from.props }
}

/** Options for {@link pedestrianPoseOf}. */
export interface PedestrianPoseOptions {
  readonly lod?: AnimationLod
  /** Reused pose, so a reduced-rate animation level does not recompute it. */
  readonly cachedParts?: PoseFrame
}

/**
 * One pedestrian's pose at the crowd's current clock.
 *
 * The walk cycle, the idle sway at a red light, the head look and the raised arm
 * of someone holding a phone all come from `bodies.ts`; this function only
 * supplies the placement, the phase and what the hands hold.
 */
export function pedestrianPoseOf(
  crowd: Crowd,
  pedestrian: Pedestrian,
  options: PedestrianPoseOptions = {},
): PedestrianPose {
  const placement = pedestrianPlacement(crowd, pedestrian)
  const lod = options.lod ?? 0
  if (options.cachedParts === undefined && lod === 2) {
    // Beyond the far animation distance the pose is frozen at rest: the
    // silhouette carries the era palette, and the limbs stop being computed.
    return {
      position: placement.position,
      heading: placement.heading,
      state: placement.state,
      parts: restPose(pedestrian.body),
      gaitPhase: pedestrian.gaitPhase,
      animationLod: lod,
    }
  }
  const dressed = pedestrianOutfit(crowd, pedestrian)
  const parts =
    options.cachedParts ??
    posePedestrian({
      body: pedestrian.body,
      gait: pedestrian.gait,
      state: placement.state,
      speedMps: placement.speedMps,
      phase: pedestrian.gaitPhase,
      seconds: crowdTimeSeconds(crowd),
      idlePhase: pedestrian.idlePhase,
      lookPhase: pedestrian.lookPhase,
      holdLeft: dressed.props.some((prop) => prop.part === 'handL'),
      holdRight: dressed.props.some((prop) => prop.part === 'handR'),
    } satisfies PoseInput)

  return {
    position: placement.position,
    heading: placement.heading,
    state: placement.state,
    parts,
    gaitPhase: pedestrian.gaitPhase,
    animationLod: lod,
  }
}

/* ------------------------------------------------------------------------- *
 * Stats and signature
 * ------------------------------------------------------------------------- */

/** Snapshot of the crowd: counts, appearance pools and a determinism digest. */
export function crowdStats(crowd: Crowd): CrowdStats {
  let walking = 0
  let waiting = 0
  let crossing = 0
  let hidden = 0
  const outfitKeys = new Set<string>()
  const propIds = new Set<string>()

  for (const pedestrian of crowd.pedestrians) {
    if (!pedestrian.visible) {
      hidden += 1
      continue
    }
    if (pedestrian.state === 'walking') {
      walking += 1
    } else if (pedestrian.state === 'waiting') {
      waiting += 1
    } else {
      crossing += 1
    }
    const dressed = pedestrianOutfit(crowd, pedestrian)
    outfitKeys.add(dressed.outfit.outfitKey)
    for (const prop of dressed.props) {
      propIds.add(prop.id)
    }
  }

  return {
    eraId: crowd.eraId,
    blend: crowd.blend,
    tier: crowd.tier,
    activeCount: crowd.activeCount,
    capacity: crowd.capacity,
    timeSeconds: crowdTimeSeconds(crowd),
    states: { walking, waiting, crossing, hidden },
    outfitKeys: [...outfitKeys].sort(),
    propIds: [...propIds].sort(),
    signature: crowdSignature(crowd),
  }
}

/**
 * Digest of the whole visible crowd.
 *
 * Two crowds with the same digest agree on who is where, what they wear and what
 * they carry to three decimal places, which is how the suites assert
 * determinism, contained crossings and staged era switches without comparing
 * thousands of numbers by hand.
 */
export function crowdSignature(crowd: Crowd): string {
  const tokens: string[] = [crowd.eraId, `active:${crowd.activeCount}`]
  if (crowd.blend !== null) {
    tokens.push(`blend:${crowd.blend.from}>${crowd.blend.to}@${crowd.blend.t.toFixed(3)}`)
  }
  for (const pedestrian of crowd.pedestrians) {
    if (!pedestrian.visible) {
      continue
    }
    const placement = pedestrianPlacement(crowd, pedestrian)
    const dressed = pedestrianOutfit(crowd, pedestrian)
    const spline = crowd.layout.pedestrianSplines[pedestrian.splineIndex]
    tokens.push(
      [
        pedestrian.index,
        pedestrian.state,
        spline?.name ?? 'none',
        placement.position.x.toFixed(3),
        placement.position.y.toFixed(3),
        placement.position.z.toFixed(3),
        dressed.outfit.outfitKey,
        dressed.stage,
        dressed.props.map((prop) => prop.id).join('+'),
      ].join(','),
    )
  }
  return digestTokens(tokens)
}

/* ------------------------------------------------------------------------- *
 * Instanced render payload
 * ------------------------------------------------------------------------- */

/** Reusable instance buffers of one shared geometry. */
export interface InstanceBuffer {
  readonly matrices: Float32Array
  readonly colours: Float32Array
  readonly capacity: number
}

/** One pooled draw: a shared geometry with this frame's instances. */
export interface CrowdInstanceEntry {
  readonly geometryKey: string
  /** Tier-adjusted shape the geometry is built from. */
  readonly shape: PrimitiveShape
  /** Which part of a look this geometry belongs to. */
  readonly kind: 'body' | 'garment' | 'hair' | 'headwear' | 'accessory' | 'prop' | 'silhouette'
  /** Triangles one instance submits. */
  readonly triangles: number
  readonly matrices: Float32Array
  readonly colours: Float32Array
  readonly capacity: number
  /** Instances written this frame; `0` means the mesh is not drawn. */
  count: number
}

/** Persistent instance state, so a frame allocates nothing. */
export interface InstancePool {
  readonly buffers: Map<string, InstanceBuffer>
  readonly entries: Map<string, CrowdInstanceEntry>
  /** Cached poses per pedestrian, used by the reduced animation level. */
  readonly poses: Map<number, PoseFrame>
  order: string[]
}

/** Creates an empty instance pool. */
export function createInstancePool(): InstancePool {
  return { buffers: new Map(), entries: new Map(), poses: new Map(), order: [] }
}

/** Options for {@link collectInstances}. */
export interface CollectInstancesOptions {
  readonly tier?: QualityTierName
  /** Camera the animation level of detail is measured from. */
  readonly cameraPosition?: Vec3
  /** Reused pool; the renderer passes its own so frames allocate nothing. */
  readonly pool?: InstancePool
}

/** Everything the renderer needs for one frame, plus its cost. */
export interface CrowdInstances {
  readonly tier: QualityTierName
  /** Draw entries with at least one instance, in first-use order. */
  readonly entries: readonly CrowdInstanceEntry[]
  readonly pedestrians: number
  readonly instances: number
  readonly triangles: number
  readonly drawCalls: number
  readonly poolTriangles: number
  readonly lodCounts: readonly [number, number, number]
}

const COLOUR_CACHE = new Map<string, readonly [number, number, number]>()

/** Linear-space RGB of a hex colour, cached; matches three's colour workflow. */
function linearRgb(hex: HexColor): readonly [number, number, number] {
  const cached = COLOUR_CACHE.get(hex)
  if (cached !== undefined) {
    return cached
  }
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const value = match?.[1] ?? '808080'
  const channels: [number, number, number] = [0, 0, 0]
  for (let index = 0; index < 3; index += 1) {
    const raw = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16) / 255
    const channel = raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4
    channels[index] = channel
  }
  COLOUR_CACHE.set(hex, channels)
  return channels
}

/** Scratch objects one collection reuses; no allocation per instance. */
interface MatrixScratch {
  readonly root: THREE.Matrix4
  readonly part: THREE.Matrix4
  readonly piece: THREE.Matrix4
  readonly combined: THREE.Matrix4
  readonly position: THREE.Vector3
  readonly offset: THREE.Vector3
  readonly scale: THREE.Vector3
  readonly quaternion: THREE.Quaternion
  readonly euler: THREE.Euler
}

function createMatrixScratch(): MatrixScratch {
  return {
    root: new THREE.Matrix4(),
    part: new THREE.Matrix4(),
    piece: new THREE.Matrix4(),
    combined: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, 'XYZ'),
  }
}

function acquireEntry(
  pool: InstancePool,
  geometryKey: string,
  shape: PrimitiveShape,
  kind: CrowdInstanceEntry['kind'],
  capacity: number,
): CrowdInstanceEntry {
  const existing = pool.entries.get(geometryKey)
  if (existing !== undefined) {
    return existing
  }
  const buffer: InstanceBuffer = {
    matrices: new Float32Array(capacity * 16),
    colours: new Float32Array(capacity * 3),
    capacity,
  }
  const entry: CrowdInstanceEntry = {
    geometryKey,
    shape,
    kind,
    triangles: shapeTriangleCount(shape),
    matrices: buffer.matrices,
    colours: buffer.colours,
    capacity: buffer.capacity,
    count: 0,
  }
  pool.buffers.set(geometryKey, buffer)
  pool.entries.set(geometryKey, entry)
  pool.order.push(geometryKey)
  return entry
}

/**
 * Collects every instanced draw of the visible crowd for one tier and camera.
 *
 * The crowd is *pooled by shared geometry*: one entry per distinct geometry, with
 * per-instance matrices and colours. Pedestrians beyond the near animation LOD
 * distance drop props and accessories and refresh their pose at a reduced rate;
 * beyond the far distance they render as a single palette-coloured silhouette.
 * The renderer uploads these entries unchanged, so its own draw-call report and
 * the cost estimate cannot drift apart.
 */
export function collectInstances(
  crowd: Crowd,
  options: CollectInstancesOptions = {},
): CrowdInstances {
  const tier = options.tier ?? crowd.tier
  const detail = tierDetail(tier)
  const camera = options.cameraPosition ?? DEFAULT_CAMERA_POSITION
  const pool = options.pool ?? createInstancePool()
  const scratch = createMatrixScratch()
  const capacity = Math.max(1, crowd.capacity * INSTANCES_PER_KEY)

  for (const entry of pool.entries.values()) {
    entry.count = 0
  }
  // Entries are pooled: a key that already exists is reused, so the frame's
  // draw list has to be rebuilt from *use*, not only from creation.
  const used: string[] = []
  const markUsed = (entry: CrowdInstanceEntry): CrowdInstanceEntry => {
    if (entry.count === 0) {
      used.push(entry.geometryKey)
    }
    return entry
  }

  let pedestrians = 0
  let instances = 0
  let triangles = 0
  let poolTriangles = 0
  const lodCounts: [number, number, number] = [0, 0, 0]

  for (const pedestrian of crowd.pedestrians) {
    if (!pedestrian.visible) {
      continue
    }
    const placement = pedestrianPlacement(crowd, pedestrian)
    const distance = Math.hypot(
      placement.position.x - camera.x,
      placement.position.y - camera.y,
      placement.position.z - camera.z,
    )
    const lod = animationLodFor(distance, tier)
    lodCounts[lod] += 1
    pedestrians += 1

    const dressed = pedestrianOutfit(crowd, pedestrian)
    const yaw = Math.atan2(placement.heading.x, placement.heading.z)
    scratch.quaternion.setFromEuler(scratch.euler.set(0, yaw, 0, 'XYZ'))
    scratch.root.compose(scratch.position.set(placement.position.x, placement.position.y, placement.position.z), scratch.quaternion, scratch.scale.set(1, 1, 1))
    const bodyScale = v3(pedestrian.body.widthScale, pedestrian.body.heightScale, pedestrian.body.widthScale)

    if (lod === 2) {
      const colour = dressed.outfit.garments[0]?.colour ?? dressed.outfit.palette[0] ?? '#8a8a8a'
      const silhouette = tierShape(SILHOUETTE_SHAPE, tier)
      const entry = markUsed(acquireEntry(pool, SILHOUETTE_KEY, silhouette, 'silhouette', capacity))
      writeInstance(entry, scratch, silhouette, v3(0, 0, 0), v3(0, 0, 0), colour, bodyScale, false)
      continue
    }

    let parts: PoseFrame
    const cached = pool.poses.get(pedestrian.index)
    if (lod === 0 || cached === undefined || crowd.steps % LOD1_FRAME_INTERVAL === 0) {
      parts = pedestrianPoseOf(crowd, pedestrian, { lod }).parts
      pool.poses.set(pedestrian.index, parts)
    } else {
      parts = cached
    }

    for (const part of PART_IDS) {
      const transform = parts[part]
      const shape = BODY_PART_SHAPES[part]
      const scaled = tierShape(shape, tier)
      const entry = markUsed(acquireEntry(pool, shapeGeometryKey(scaled), scaled, 'body', capacity))
      writeInstance(entry, scratch, scaled, transform.position, transform.rotation, pedestrian.skinTone, bodyScale, true)
    }
    for (const garment of dressed.outfit.garments) {
      const shape = tierShape(garment.shape, tier)
      const entry = markUsed(acquireEntry(pool, shapeGeometryKey(shape), shape, 'garment', capacity))
      writeInstance(entry, scratch, shape, parts[garment.part].position, parts[garment.part].rotation, garment.colour, bodyScale, true)
    }
    if (detail.hair) {
      const hair = dressed.outfit.hair
      const shape = tierShape(hair.shape, tier)
      const entry = markUsed(acquireEntry(pool, shapeGeometryKey(shape), shape, 'hair', capacity))
      writeInstance(entry, scratch, shape, parts[hair.part].position, parts[hair.part].rotation, hair.colour, bodyScale, true)
    }
    if (detail.headwear && dressed.outfit.headwear !== null) {
      const headwear = dressed.outfit.headwear
      const shape = tierShape(headwear.shape, tier)
      const entry = markUsed(acquireEntry(pool, shapeGeometryKey(shape), shape, 'headwear', capacity))
      writeInstance(entry, scratch, shape, parts[headwear.part].position, parts[headwear.part].rotation, headwear.colour, bodyScale, true)
    }
    if (detail.accessories) {
      for (const accessory of dressed.outfit.accessories) {
        const shape = tierShape(accessory.shape, tier)
        const entry = markUsed(acquireEntry(pool, shapeGeometryKey(shape), shape, 'accessory', capacity))
        writeInstance(entry, scratch, shape, parts[accessory.part].position, parts[accessory.part].rotation, accessory.colour, bodyScale, true)
      }
    }
    if (detail.props) {
      for (const prop of dressed.props) {
        const shape = tierShape(prop.shape, tier)
        const entry = markUsed(acquireEntry(pool, shapeGeometryKey(shape), shape, 'prop', capacity))
        writeInstance(entry, scratch, shape, parts[prop.part].position, parts[prop.part].rotation, prop.colour, bodyScale, true)
      }
    }
  }

  pool.order = used
  const entries: CrowdInstanceEntry[] = []
  for (const key of used) {
    const entry = pool.entries.get(key)
    if (entry !== undefined && entry.count > 0) {
      entries.push(entry)
    }
  }
  for (const entry of entries) {
    instances += entry.count
    triangles += entry.count * entry.triangles
    poolTriangles += entry.triangles
  }

  return {
    tier,
    entries,
    pedestrians,
    instances,
    triangles,
    drawCalls: entries.length,
    poolTriangles,
    lodCounts,
  }
}

/** Writes one instance of a piece into an entry's buffers. */
function writeInstance(
  entry: CrowdInstanceEntry,
  scratch: MatrixScratch,
  shape: PrimitiveShape,
  partPosition: Vec3,
  partRotation: Vec3,
  colour: HexColor,
  bodyScale: Vec3,
  usePart: boolean,
): void {
  const slot = findSlot(entry)
  if (slot < 0) {
    throw new RangeError(
      `Instance pool overflow for geometry ${entry.geometryKey}; raise INSTANCES_PER_KEY or the pool capacity`,
    )
  }
  if (usePart) {
    scratch.quaternion.setFromEuler(scratch.euler.set(partRotation.x, partRotation.y, partRotation.z, 'XYZ'))
    scratch.part.compose(
      scratch.position.set(partPosition.x, partPosition.y, partPosition.z),
      scratch.quaternion,
      scratch.scale.set(1, 1, 1),
    )
    scratch.combined.multiplyMatrices(scratch.root, scratch.part)
  } else {
    scratch.combined.copy(scratch.root)
  }
  scratch.quaternion.setFromEuler(
    scratch.euler.set(shape.rotation[0], shape.rotation[1], shape.rotation[2], 'XYZ'),
  )
  scratch.piece.compose(
    scratch.offset.set(
      shape.offset[0] * bodyScale.x,
      shape.offset[1] * bodyScale.y,
      shape.offset[2] * bodyScale.z,
    ),
    scratch.quaternion,
    scratch.scale.set(bodyScale.x, bodyScale.y, bodyScale.z),
  )
  scratch.combined.multiply(scratch.piece)
  scratch.combined.toArray(entry.matrices, slot * 16)
  const [r, g, b] = linearRgb(colour)
  entry.colours[slot * 3] = r
  entry.colours[slot * 3 + 1] = g
  entry.colours[slot * 3 + 2] = b
  entry.count += 1
}

/**
 * Index of the next free instance slot of an entry.
 *
 * Instances are written in the same order every frame, so the writer only has to
 * track how many it has already placed — but it checks anyway, because a silent
 * overflow would corrupt another pedestrian's geometry.
 */
function findSlot(entry: CrowdInstanceEntry): number {
  return entry.count < entry.capacity ? entry.count : -1
}

/**
 * Cost of one frame of the crowd, against the shared per-tier budgets.
 *
 * Counts what the renderer submits: triangles as instances times their shared
 * geometry, one draw call per geometry in use, and the resident geometry pool
 * once. The browser harness asserts its own renderer report equals these numbers.
 */
export function estimateCrowdCost(
  crowd: Crowd,
  options: { readonly tier?: QualityTierName; readonly cameraPosition?: Vec3 } = {},
): CrowdCostEstimate {
  const tier = options.tier ?? crowd.tier
  const collected = collectInstances(crowd, {
    tier,
    cameraPosition: options.cameraPosition,
    pool: createInstancePool(),
  })
  const triangleBudget = PEDESTRIAN_TRIANGLE_BUDGETS[tier]
  const drawCallBudget = PEDESTRIAN_DRAW_CALL_BUDGETS[tier]
  const geometryBudget = PEDESTRIAN_GEOMETRY_BUDGETS[tier]

  return {
    tier,
    pedestrians: collected.pedestrians,
    triangles: collected.triangles,
    drawCalls: collected.drawCalls,
    poolTriangles: collected.poolTriangles,
    instances: collected.instances,
    triangleBudget,
    drawCallBudget,
    geometryBudget,
    lodCounts: collected.lodCounts,
    withinBudget:
      collected.triangles <= triangleBudget &&
      collected.drawCalls <= drawCallBudget &&
      collected.poolTriangles <= geometryBudget,
  }
}

/* ------------------------------------------------------------------------- *
 * Era application
 * ------------------------------------------------------------------------- */

/** Crowd table of the era a layer currently shows. */
export function currentCrowdTable(crowd: Crowd): EraCrowdTable {
  return getCrowdTable(crowd.eraId)
}

/** Target crowd size of one era for a crowd's layout and tier. */
function targetCountFor(crowd: Crowd, eraId: EraId): number {
  return crowdTargetCount(crowd.layout, getCrowdTable(eraId).density, crowd.tier)
}

/**
 * Applies an era instantly: re-dresses the crowd, re-densifies it and clears any
 * staged blend. This is the reduced-motion path the transition director takes,
 * and the settled state every staged blend ends in.
 */
export function applyEra(eraId: EraId, ctx: PedestrianLayerContext): CrowdStats {
  const crowd = ctx.crowd
  crowd.eraId = eraId
  crowd.blend = null
  crowd.activeCount = targetCountFor(crowd, eraId)
  refreshVisibility(crowd)
  return crowdStats(crowd)
}

/**
 * Applies a staged era change: garments cross-dress progressively, the crowd
 * grows or shrinks towards the target era's density, and carried props are
 * re-dressed ahead of the garments.
 *
 * `t` runs from 0 (still the `from` era) to 1 (fully the `to` era). A blend with
 * `reducedMotion` set — or a blend already at `t >= 1` — is applied instantly
 * through {@link applyEra}, which is how a viewer who asked for reduced motion
 * gets one clean switch instead of an animation.
 */
export function applyEraTransition(blend: EraBlend, ctx: PedestrianLayerContext): CrowdStats {
  const crowd = ctx.crowd
  const t = clamp(blend.t, 0, 1)
  if (blend.reducedMotion === true || t >= 1) {
    return applyEra(blend.to, ctx)
  }

  crowd.blend = { from: blend.from, to: blend.to, t, reducedMotion: blend.reducedMotion }
  crowd.eraId = blend.to
  const fromCount = targetCountFor(crowd, blend.from)
  const toCount = targetCountFor(crowd, blend.to)
  crowd.activeCount = Math.round(fromCount + (toCount - fromCount) * t)
  refreshVisibility(crowd)
  return crowdStats(crowd)
}

/* ------------------------------------------------------------------------- *
 * Layer handle
 * ------------------------------------------------------------------------- */

/**
 * Builds a layer handle: the crowd plus the layout, seed and tier it was built
 * from, and a live view of the era table it currently shows.
 *
 * The handle *is* the `ctx` of `applyEra` and `applyEraTransition`, so the
 * transition director can stage era changes on this layer without owning any of
 * its internals — or any of its imports.
 */
export function createPedestrianLayer(options: PedestrianLayerOptions = {}): PedestrianLayerHandle {
  const layout = options.layout ?? createCityLayout()
  const seed = String(options.seed ?? CANONICAL_LAYOUT_SEED)
  const tier = options.tier ?? DEFAULT_QUALITY_TIER
  const eraId = options.eraId ?? ERA_ID_ORDER[0] ?? DEFAULT_ERA_ID
  const crowd = createPedestrianCrowd({ layout, eraId, seed, tier })
  const context: PedestrianLayerContext = { crowd, layout, seed, tier }
  return {
    ...context,
    get table(): EraCrowdTable {
      return currentCrowdTable(crowd)
    },
  }
}

