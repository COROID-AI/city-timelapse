/**
 * Per-era traffic configuration derived from EraData.
 *
 * This module is the single source of truth for how many vehicles exist per
 * era, which era body styles they use, and which lanes they occupy. It is
 * pure data + math (no Three dependency, no network) so unit tests can assert
 * the acceptance contract: vehicle count per era matches EraData traffic
 * density, lane usage differs per era, and the 2025 bike/bus lanes are the
 * only dedicated lanes.
 *
 * The lane geometry comes from the CityBlock road layout (src/scene/vehicles/
 * lanes.ts); this module only *assigns* vehicles to lanes. Counts are derived
 * from `EraData.vehicles.density` (0..1) scaled by the road network's lane
 * capacity, never hard-coded per vehicle.
 */

import type { EraId } from '../../eras'
import { ERA_DATA } from '../../era-data'
import type { EraLaneProfile, LaneDef, LaneKind } from './lanes'
import {
  buildEraLanes,
  laneLength,
} from './lanes'
import { type StyleId } from './styles'
import { eraStyleIds } from './styles'

/** Road network capacity: how many lane meters of vehicle spacing each unit
 *  of era density buys. Tuned so density 0.18 (1945) yields a sparse fleet
 *  and 0.8 (2025) a dense one. */
const LANE_METERS_PER_DENSITY = 560
const MAX_VEHICLES = 90
const MIN_VEHICLES = 10

/** Vehicle length per body style for headway math (meters). */
const STYLE_LENGTH: Record<StyleId, number> = {
  vintage: 4.3,
  panel: 4.7,
  wagon: 3.7,
  trolley: 9,
  coupe: 5.1,
  convertible: 4.9,
  scooter: 1.5,
  truck: 6.8,
  boxySedan: 4.5,
  muscle: 4.9,
  van: 4.9,
  taxi: 4.5,
  suv: 4.9,
  minivan: 4.7,
  compact: 3.95,
  evSedan: 4.6,
  bus: 10.2,
  robot: 0.55,
  bike: 1.3,
}

export interface TrafficVehicleSpec {
  /** Stable spawn ordinal within the era fleet (0-based). */
  index: number
  style: StyleId
  lane: LaneDef
  /** Starting travel distance along the lane loop (meters). */
  distance: number
  /** Desired cruise speed in world units/sec, from EraData range. */
  speed: number
}

export interface TrafficEraPlan {
  era: EraId
  density: number
  lanes: EraLaneProfile
  /** Total pooled/instanced vehicles spawned for the era. */
  count: number
  /** Vehicles per lane kind (bike lanes only in 2025). */
  laneUsage: Record<LaneKind, number>
  /** Data-driven body mix, in spawn order. */
  styles: StyleId[]
  /** All spawn specs, deterministic per era. */
  vehicles: TrafficVehicleSpec[]
}

/** Which body styles may drive in auto lanes (excludes sidewalk robots). */
const AUTO_STYLES: readonly StyleId[] = [
  'vintage',
  'panel',
  'wagon',
  'coupe',
  'convertible',
  'truck',
  'boxySedan',
  'muscle',
  'van',
  'taxi',
  'suv',
  'minivan',
  'compact',
  'evSedan',
]

/** Which body styles may occupy the dedicated bike lane (2025 only). */
const BIKE_STYLES: readonly StyleId[] = ['bike']

/** Which body styles may occupy the dedicated bus lane (2025 only). */
const BUS_STYLES: readonly StyleId[] = ['bus']

/** Discrete per-era lane counts so count/lane contracts are testable. */
export function laneCountsForEra(era: EraId): { auto: number; bus: number; bike: number } {
  const profile = buildEraLanes(era)
  const counts = { auto: 0, bus: 0, bike: 0 }
  for (const lane of profile.lanes) {
    counts[lane.kind] += 1
  }
  return counts
}

/** Total vehicle count that matches EraData traffic density for an era. */
export function vehicleCountForDensity(density: number): number {
  const raw = Math.floor(density * LANE_METERS_PER_DENSITY / 14)
  return Math.min(MAX_VEHICLES, Math.max(MIN_VEHICLES, raw))
}

/** Pure lane assignment: auto vehicles, then bus corridor, then bike curb. */
export function laneForKind(
  lanes: readonly LaneDef[],
  kind: LaneKind,
  index: number,
): LaneDef {
  const kindLanes = lanes.filter((lane) => lane.kind === kind)
  if (kindLanes.length === 0) {
    // Fallback: auto lanes absorb every vehicle.
    const auto = lanes.filter((lane) => lane.kind === 'auto')
    return auto[index % Math.max(1, auto.length)]
  }
  return kindLanes[index % kindLanes.length]
}

/** Build the deterministic spawn plan for an era from EraData. */
export function buildTrafficPlan(era: EraId): TrafficEraPlan {
  const data = ERA_DATA[era]
  const density = data.vehicles.density
  const styleMix = eraStyleIds(era)
  const profile = buildEraLanes(era)
  const count = vehicleCountForDensity(density)

  // Reserve the dedicated lane vehicles first so the fleet mix always
  // includes the era's headline traffic (tram drive, e-bike, bus).
  const busLanes = profile.lanes.filter((lane) => lane.kind === 'bus')
  const bikeLanes = profile.lanes.filter((lane) => lane.kind === 'bike')
  const busCount = Math.min(2, busLanes.length)
  const bikeCount = Math.min(4, bikeLanes.length)
  // 1945 always puts a trolley on the road ring (tram heritage); it rides an
  // auto lane because there is no dedicated rail lane in the block layout.
  const trolleyCount = era === '1945' ? 1 : 0
  const autoCount = Math.max(0, count - busCount - bikeCount - trolleyCount)

  const vehicles: TrafficVehicleSpec[] = []
  const laneUsage: Record<LaneKind, number> = { auto: 0, bus: 0, bike: 0 }

  const pickStyle = (candidate: readonly StyleId[]): StyleId => {
    // For dedicated lanes (bus/bike) the candidate list is the authoritative
    // style set — reserve those styles so the era's headline traffic shows.
    if (candidate.length > 0 && candidate.some((s) => s === 'bus' || s === 'bike')) {
      return candidate[vehicles.length % candidate.length]
    }
    // General auto lanes: rotate through the era's data-driven mix, skipping
    // styles that cannot use the lane kind.
    const pool = styleMix.filter((style) => candidate.includes(style))
    const ordered = pool.length > 0 ? pool : [...AUTO_STYLES]
    return ordered[(vehicles.length % ordered.length)]
  }

  for (let i = 0; i < autoCount; i += 1) {
    const lane = laneForKind(profile.lanes, 'auto', i)
    laneUsage.auto += 1
    vehicles.push({
      index: i,
      style: pickStyle(AUTO_STYLES),
      lane,
      distance: spawnDistance(lane, i, autoCount),
      speed: eraSpeed(era, i),
    })
  }
  let ordinal = autoCount
  if (era === '1945') {
    // The heritage trolley rides the first inner auto lane (long vehicle,
    // reserved so the tram is always visible in the 1945 frame).
    const lane = laneForKind(profile.lanes, 'auto', 0)
    laneUsage.auto += 1
    vehicles.push({
      index: ordinal,
      style: 'trolley',
      lane,
      distance: 12,
      speed: eraSpeed(era, ordinal) * 0.85,
    })
    ordinal += 1
  }
  for (let i = 0; i < busCount; i += 1) {
    const lane = laneForKind(profile.lanes, 'bus', i)
    laneUsage.bus += 1
    vehicles.push({
      index: ordinal,
      style: pickStyle(BUS_STYLES),
      lane,
      distance: spawnDistance(lane, i, busCount),
      speed: eraSpeed(era, ordinal),
    })
    ordinal += 1
  }
  for (let i = 0; i < bikeCount; i += 1) {
    const lane = laneForKind(profile.lanes, 'bike', i)
    laneUsage.bike += 1
    vehicles.push({
      index: ordinal,
      style: pickStyle(BIKE_STYLES),
      lane,
      distance: spawnDistance(lane, i, bikeCount),
      speed: eraSpeed(era, ordinal),
    })
    ordinal += 1
  }

  return {
    era,
    density,
    lanes: profile,
    count,
    laneUsage,
    styles: styleMix,
    vehicles,
  }
}

/** Deterministic spawn distance: spread vehicles evenly along the lane loop. */
function spawnDistance(lane: LaneDef, index: number, total: number): number {
  const totalLength = laneLength(lane.points)
  if (total <= 1) return 2
  const spacing = Math.max(4, totalLength / total)
  return ((index + 0.5) * spacing) % Math.max(1, totalLength)
}

/** Deterministic per-vehicle cruise speed from EraData.speedRange. */
function eraSpeed(era: EraId, index: number): number {
  const [lo, hi] = ERA_DATA[era].vehicles.speedRange
  const t = ((index * 2654435761) % 1000) / 1000
  return lo + (hi - lo) * t
}

/** Aggregate pool sizing used by the renderer: one InstancedMesh per vehicle
 *  with per-instance style scaling — a true instance pool (no per-vehicle
 *  Mesh/Geometry material). */
export function maxInstancesForPlan(plan: TrafficEraPlan): number {
  return plan.count
}

/** Body length for headway/spacing (meters). */
export function styleLength(style: StyleId): number {
  return STYLE_LENGTH[style] ?? 4
}

/** Headway in meters for a lane at the era density. */
export function laneHeadway(plan: TrafficEraPlan, lane: LaneDef): number {
  const kinds = plan.laneUsage
  const perLaneCount = Math.max(1, kinds[lane.kind])
  const loopLength = loopLengthOf(lane)
  const share = Math.max(8, loopLength / perLaneCount)
  return Math.min(share, styleLength('taxi') * 2.2)
}

function loopLengthOf(lane: LaneDef): number {
  return laneLength(lane.points)
}

/** Reference constants for tests. */
export const LANE_CONSTANTS = {
  LANE_METERS_PER_DENSITY: LANE_METERS_PER_DENSITY,
  MAX_VEHICLES: MAX_VEHICLES,
  MIN_VEHICLES: MIN_VEHICLES,
} as const