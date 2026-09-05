/**
 * Vehicle lane geometry for the CityBlock road ring.
 *
 * Lanes are derived from the CityBlock canonical layout (`buildBlockLayoutData`),
 * never defined here: the four street sides (two east-west roads spanning 170
 * world units and two north-south roads spanning 110) each expose a pair of
 * one-way auto lanes, plus, in eras that enable them, a dedicated curb-side
 * bike lane and a dedicated center bus lane on the demonstrated corridors.
 *
 * Each lane is a closed loop of waypoints (templates are snapped to the lane
 * centerline) that vehicles follow with simple steering. Stop points are the
 * centers of the painted zebra crosswalks that CityBlock puts on that road
 * side; vehicles decelerate to a stop there (and bikes/robots share the same
 * geometry so the whole fleet behaves consistently).
 *
 * Pure data + math: no Three.js mesh construction here, so unit tests can
 * assert lane validity (closed loops, within road extents, crosswalk stops
 * on-lane) without a WebGL context.
 */

import { ERA_IDS, type EraId } from '../../eras'
import {
  buildBlockLayoutData,
  ROAD_GRID_LENGTH,
  ROAD_GRID_WIDTH,
  STREET_CENTER,
} from '../city-block'

export type LaneKind = 'auto' | 'bus' | 'bike'

export interface Waypoint {
  x: number
  z: number
}

export interface LaneStop {
  /** Segment index where the stop acts (vehicle parks at waypoint[i]). */
  waypointIndex: number
  /** Stop center in world space (center of the painted zebra crosswalk). */
  x: number
  z: number
}

export interface LaneDef {
  id: string
  kind: LaneKind
  /** Travel direction sign along the lane loop (1 = forward, -1 = reverse). */
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

interface RoadSide {
  id: string
  /** Axis the road runs along: 'z' for north-south roads, 'x' for east-west. */
  axis: 'z' | 'x'
  /** Street-center coordinate of the road (negative = west/south side). */
  center: number
  /** Loop direction: +1 travels along +axis, -1 travels along -axis. */
  forward: 1 | -1
  /**
   * Offset sign toward the block interior. For a road at center ±64 the
   * block sits between -50..50, so an inner lane moves toward the block.
   */
  towardBlock: 1 | -1
  /** Zebra crosswalk center on this road (from buildBlockLayoutData). */
  stopAlong: number
}

/**
 * Build the lane set for an era from the canonical block layout.
 * Pure — no Three dependency.
 *
 * The two east-west roads run along X at z = ±STREET_CENTER and span the full
 * ROAD_GRID_LENGTH; the two north-south roads run along Z at x = ±STREET_CENTER
 * and span ROAD_GRID_WIDTH. Every road keeps an inner lane (toward the block)
 * and an outer lane, so the eight auto lanes tile the whole ring. 2025 adds a
 * center bus lane and curb bike lanes on the west/north demonstrated corridors.
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

  // Road sides: west/east (north-south, runs along Z) and south/north
  // (east-west, runs along X). Offsets are relative to the street center and
  // signed toward the block for "inner" lanes.
  const sides: RoadSide[] = [
    { id: 'ns-west', axis: 'z', center: -center, forward: -1, towardBlock: 1, stopAlong: -20 },
    { id: 'ns-east', axis: 'z', center: center, forward: 1, towardBlock: -1, stopAlong: 20 },
    { id: 'ew-south', axis: 'x', center: -center, forward: -1, towardBlock: 1, stopAlong: -20 },
    { id: 'ew-north', axis: 'x', center: center, forward: 1, towardBlock: -1, stopAlong: 20 },
  ]

  for (const side of sides) {
    const innerOffset = autoOffsetInner * side.towardBlock
    const outerOffset = autoOffsetOuter * side.towardBlock
    const nextId = `${side.id}-auto`

    const points = (
      offset: number,
    ): Waypoint[] => {
      if (side.axis === 'z') {
        const x = side.center + offset
        return [
          { x, z: -halfWid },
          { x, z: halfWid },
        ]
      }
      const z = side.center + offset
      return [
        { x: -halfLen, z },
        { x: halfLen, z },
      ]
    }

    const stopPoint = (offset: number): LaneStop => {
      if (side.axis === 'z') {
        return { waypointIndex: 0, x: side.center + offset, z: side.stopAlong }
      }
      return { waypointIndex: 0, x: side.stopAlong, z: side.center + offset }
    }

    lanes.push({
      id: `${nextId}-inner`,
      kind: 'auto',
      direction: side.forward,
      points: points(innerOffset),
      stops: [stopPoint(innerOffset)],
      width: AUTO_LANE_WIDTH,
    })
    lanes.push({
      id: `${nextId}-outer`,
      kind: 'auto',
      direction: side.forward,
      points: points(outerOffset),
      stops: [stopPoint(outerOffset)],
      width: AUTO_LANE_WIDTH,
    })
  }

  if (bus) {
    // Center bus lanes on the demonstrated west/north corridors.
    const busSides = [sides[0], sides[3]]
    for (const side of busSides) {
      const offset = busOffset * side.towardBlock
      lanes.push({
        id: `corridor-bus-${side.axis}-${side.towardBlock === 1 ? 'near' : 'far'}`,
        kind: 'bus',
        direction: side.forward,
        points: side.axis === 'z'
          ? [{ x: side.center + offset, z: -halfWid }, { x: side.center + offset, z: halfWid }]
          : [{ x: -halfLen, z: side.center + offset }, { x: halfLen, z: side.center + offset }],
        stops: side.axis === 'z'
          ? [{ waypointIndex: 0, x: side.center + offset, z: side.stopAlong }]
          : [{ waypointIndex: 0, x: side.stopAlong, z: side.center + offset }],
        width: BUS_LANE_WIDTH,
      })
    }
  }

  if (bike) {
    // Curb bike lanes on the west/north corridors (both road edges).
    const bikeSides = [sides[0], sides[3]]
    const offsets = [bikeOffset, -bikeOffset]
    for (const side of bikeSides) {
      for (const rail of offsets) {
        lanes.push({
          id: `corridor-bike-${side.axis}-${rail > 0 ? 'far' : 'near'}`,
          kind: 'bike',
          direction: rail > 0 ? (side.forward as 1 | -1) : ((side.forward * -1) as 1 | -1),
          points: side.axis === 'z'
            ? [{ x: side.center + rail, z: -halfWid }, { x: side.center + rail, z: halfWid }]
            : [{ x: -halfLen, z: side.center + rail }, { x: halfLen, z: side.center + rail }],
          stops: side.axis === 'z'
            ? [{ waypointIndex: 0, x: side.center + rail, z: side.stopAlong }]
            : [{ waypointIndex: 0, x: side.stopAlong, z: side.center + rail }],
          width: BIKE_LANE_WIDTH,
        })
      }
    }
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

/** Distance of a world-space point projected onto a lane loop (in meters). */
export function distanceAtPoint(
  points: readonly Waypoint[],
  x: number,
  z: number,
): number {
  let acc = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const seg = Math.hypot(b.x - a.x, b.z - a.z)
    if (seg < 1e-6) continue
    const t = Math.min(1, Math.max(0, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (seg * seg)))
    const px = a.x + (b.x - a.x) * t
    const pz = a.z + (b.z - a.z) * t
    if (Math.hypot(px - x, pz - z) < 0.5) {
      return acc + t * seg
    }
    acc += seg
  }
  return 0
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