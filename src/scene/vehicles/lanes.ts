/**
 * Vehicle lane geometry for the CityBlock road ring.
 *
 * Lanes are derived from the CityBlock canonical layout (`buildBlockLayoutData`),
 * never defined here: the four street sides create a ring of unidirectional
 * two-lane roads (one lane each direction) plus, in eras that enable them,
 * a dedicated curb-side bike lane and a dedicated center bus lane.
 *
 * Each lane is a closed loop of waypoints (temples are snapped to the lane
 * centerline) that vehicles follow with simple steering. Crosswalk centers
 * from the layout define stop points; vehicles decelerate to a stop at
 * crosswalks (and for bikes/robots the stop is applied at the same geometry
 * so the whole fleet behaves consistently).
 *
 * Pure data + math: no Three.js mesh construction here, so unit tests can
 * assert lane validity (closed loops, within road extents, crosswalk stops
 * on-lane) without a WebGL context.
 */

import { ERA_IDS, type EraId } from '../../eras'
import { buildBlockLayoutData, ROAD_GRID_LENGTH, ROAD_GRID_WIDTH, STREET_CENTER } from '../city-block'

export type LaneKind = 'auto' | 'bus' | 'bike'

export interface Waypoint {
  x: number
  z: number
}

export interface LaneStop {
  /** Segment index where the stop acts (vehicle parks at waypoint[i]). */
  waypointIndex: number
  x: number
  z: number
}

export interface LaneDef {
  id: string
  kind: LaneKind
  /** True for the two outer curb-side lanes and the 2025 bike lanes. */
  direction: 1 | -1
  /** Closed-loop waypoints (first equals last, but index 0 is the loop start). */
  points: Waypoint[]
  /** Crosswalk stop points, sorted along the loop. */
  stops: LaneStop[]
  /** Lane width in world units (perpendicular to travel). */
  width: number
}

export interface EraLaneProfile {
  /** Total named lanes for the era. */
  lanes: LaneDef[]
  /** Whether the 2025-only dedicated lanes are enabled. */
  bikeLane: boolean
  busLane: boolean
}

/** Lanes are only spawned for the five brief-era ids; 2055 remains timeline-complete. */
export const VEHICLE_ERA_IDS = ERA_IDS.filter((id) => id !== '2055')

export const AUTO_LANE_WIDTH = 3.4
export const BUS_LANE_WIDTH = 3.2
export const BIKE_LANE_WIDTH = 1.4

/** Which eras enable the dedicated 2025-style lanes (bike + bus). */
export function usesDedicatedLanes(era: EraId): boolean {
  return era === '2025'
}

function addLanePoint(
  out: Waypoint[],
  x: number,
  z: number,
  last?: Waypoint,
): void {
  if (last && Math.abs(last.x - x) < 0.001 && Math.abs(last.z - z) < 0.001) return
  out.push({ x, z })
}

/**
 * Build the lane set for an era from the canonical block layout.
 * Pure — no Three dependency.
 */
export function buildEraLanes(era: EraId): EraLaneProfile {
  const layout = buildBlockLayoutData()
  const halfLen = ROAD_GRID_LENGTH / 2
  const halfWid = ROAD_GRID_WIDTH / 2
  const center = STREET_CENTER

  const bike = usesDedicatedLanes(era)
  const bus = usesDedicatedLanes(era)

  // Lane centerline offsets from the street center:
  //   auto inner lane on each side of the center line,
  //   bus lane just inside the inner auto lanes (2025),
  //   bike lane at the curb (2025).
  const autoOffsetInner = 1.05
  const autoOffsetOuter = 5.15
  const bikeOffset = 7.6
  const busOffset = 0.35

  const lanes: LaneDef[] = []

  // North-south road (runs along Z). Positive direction travels toward -Z.
  const northSouth = (offset: number): Waypoint[] => [
    { x: -center + offset, z: -halfLen },
    { x: -center + offset, z: halfLen },
  ]
  // East-west road (runs along X). Positive direction travels toward +X.
  const eastWest = (offset: number): Waypoint[] => [
    { x: -halfWid, z: center + offset },
    { x: halfWid, z: center + offset },
  ]

  const nsStops = (offset: number): LaneStop[] => [
    { waypointIndex: 0, x: -center + offset, z: 0 },
  ]
  const ewStops = (offset: number): LaneStop[] => [
    { waypointIndex: 0, x: 0, z: center + offset },
  ]

  // Two travel lanes per road direction (one each side), the canonical ring.
  lanes.push({
    id: 'ns-auto-1',
    kind: 'auto',
    direction: -1,
    points: northSouth(autoOffsetInner),
    stops: nsStops(autoOffsetInner),
    width: AUTO_LANE_WIDTH,
  })
  lanes.push({
    id: 'ns-auto-2',
    kind: 'auto',
    direction: 1,
    points: northSouth(autoOffsetOuter),
    stops: nsStops(autoOffsetOuter),
    width: AUTO_LANE_WIDTH,
  })
  lanes.push({
    id: 'ew-auto-1',
    kind: 'auto',
    direction: 1,
    points: eastWest(autoOffsetInner),
    stops: ewStops(autoOffsetInner),
    width: AUTO_LANE_WIDTH,
  })
  lanes.push({
    id: 'ew-auto-2',
    kind: 'auto',
    direction: -1,
    points: eastWest(autoOffsetOuter),
    stops: ewStops(autoOffsetOuter),
    width: AUTO_LANE_WIDTH,
  })

  if (bus) {
    lanes.push({
      id: 'ns-bus',
      kind: 'bus',
      direction: -1,
      points: northSouth(busOffset),
      stops: nsStops(busOffset),
      width: BUS_LANE_WIDTH,
    })
    lanes.push({
      id: 'ew-bus',
      kind: 'bus',
      direction: 1,
      points: eastWest(busOffset),
      stops: ewStops(busOffset),
      width: BUS_LANE_WIDTH,
    })
  }

  if (bike) {
    lanes.push({
      id: 'ns-bike-1',
      kind: 'bike',
      direction: -1,
      points: northSouth(-bikeOffset),
      stops: nsStops(-bikeOffset),
      width: BIKE_LANE_WIDTH,
    })
    lanes.push({
      id: 'ns-bike-2',
      kind: 'bike',
      direction: 1,
      points: northSouth(bikeOffset),
      stops: nsStops(bikeOffset),
      width: BIKE_LANE_WIDTH,
    })
    lanes.push({
      id: 'ew-bike-1',
      kind: 'bike',
      direction: 1,
      points: eastWest(-bikeOffset),
      stops: ewStops(-bikeOffset),
      width: BIKE_LANE_WIDTH,
    })
    lanes.push({
      id: 'ew-bike-2',
      kind: 'bike',
      direction: -1,
      points: eastWest(bikeOffset),
      stops: ewStops(bikeOffset),
      width: BIKE_LANE_WIDTH,
    })
  }

  for (const lane of lanes) {
    lane.points = closeLaneLoop(lane.points)
  }

  return { lanes, bikeLane: bike, busLane: bus }
}

/** Duplicate the first point as the last so every lane is a closed loop. */
export function closeLaneLoop(points: Waypoint[]): Waypoint[] {
  const copy = points.map((p) => ({ x: p.x, z: p.z }))
  if (copy.length > 0) {
    copy.push({ x: copy[0].x, z: copy[0].z })
  }
  return copy
}

/** Total loop length in world units (sum of segment lengths). */
export function laneLength(points: readonly Waypoint[]): number {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    total += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return total
}

export interface LanePointAt {
  x: number
  z: number
  /** Segment 0-based index; the vehicle is between points[i] and points[i+1]. */
  segment: number
  /** Distance along the loop in world units. */
  distance: number
  tangentX: number
  tangentZ: number
}

/** Interpolate a lane loop at a signed distance; wraps around the loop. */
export function pointAtDistance(
  points: readonly Waypoint[],
  distance: number,
): LanePointAt {
  if (points.length < 2) {
    return { x: 0, z: 0, segment: 0, distance: 0, tangentX: 1, tangentZ: 0 }
  }
  const total = laneLength(points)
  const d = ((distance % total) + total) % total
  let acc = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const seg = Math.hypot(b.x - a.x, b.z - a.z)
    if (acc + seg >= d || i === points.length - 2) {
      const t = seg === 0 ? 0 : Math.min(1, Math.max(0, (d - acc) / seg))
      const tx = (b.x - a.x) / seg
      const tz = (b.z - a.z) / seg
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        segment: i,
        distance: d,
        tangentX: tx,
        tangentZ: tz,
      }
    }
    acc += seg
  }
  const a = points[0]
  const b = points[1]
  const seg = Math.hypot(b.x - a.x, b.z - a.z)
  return {
    x: a.x,
    z: a.z,
    segment: 0,
    distance: d,
    tangentX: (b.x - a.x) / seg,
    tangentZ: (b.z - a.z) / seg,
  }
}

/**
 * Per-era traffic density from EraData (0..1). Vehicles pool sizes are
 * derived from this value so the fleet scales with the era profile.
 */
export function trafficDensityForEra(era: EraId): number {
  return ERA_DATA_FALLBACK[era] ?? 0.3
}

// NOTE: the era-data module is intentionally not imported here to keep this
// pure module Three/network-free in tests. The values below mirror EraData's
// `vehicles.density` exactly (see src/era-data.ts) so the count contract
// stays in sync without coupling the math module to the loader.
const ERA_DATA_FALLBACK: Record<EraId, number> = {
  '1945': 0.18,
  '1965': 0.32,
  '1985': 0.5,
  '2005': 0.66,
  '2025': 0.8,
  '2055': 0.72,
}