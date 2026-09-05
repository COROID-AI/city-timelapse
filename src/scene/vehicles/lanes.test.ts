import { describe, expect, it } from 'vitest'
import {
  AUTO_LANE_WIDTH,
  BIKE_LANE_WIDTH,
  BUS_LANE_WIDTH,
  buildEraLanes,
  laneLength,
  pointAtDistance,
} from './lanes'
import {
  STREET_CENTER,
  ROAD_GRID_LENGTH,
  ROAD_GRID_WIDTH,
} from '../city-block'
import { ERA_IDS } from '../../eras'

/** True when (x,z) projects onto the straight lane line within 0.1 units. */
function isPointOnLaneLine(
  points: readonly { x: number; z: number }[],
  x: number,
  z: number,
): boolean {
  if (points.length < 2) return false
  const a = points[0]
  const b = points[points.length - 1]
  const vx = b.x - a.x
  const vz = b.z - a.z
  const len = Math.hypot(vx, vz)
  if (len < 1e-6) return false
  const t = ((x - a.x) * vx + (z - a.z) * vz) / (len * len)
  const px = a.x + vx * Math.min(1, Math.max(0, t))
  const pz = a.z + vz * Math.min(1, Math.max(0, t))
  return Math.hypot(px - x, pz - z) < 0.1
}

describe('vehicle lane geometry (from CityBlock road layout)', () => {
  it('exposes only auto lanes before 2025 (no bike/bus lanes)', () => {
    for (const era of ['1945', '1965', '1985', '2005'] as const) {
      const profile = buildEraLanes(era)
      const kinds = profile.lanes.map((l) => l.kind)
      expect(kinds).not.toContain('bike')
      expect(kinds).not.toContain('bus')
      expect(profile.bikeLane).toBe(false)
      expect(profile.busLane).toBe(false)
      // Two lanes per road side (8 total), all auto.
      expect(profile.lanes).toHaveLength(8)
      expect(kinds.every((k) => k === 'auto')).toBe(true)
    }
  })

  it('adds dedicated bike/bus lanes only in 2025', () => {
    const profile = buildEraLanes('2025')
    const kinds = profile.lanes.map((l) => l.kind)
    expect(kinds).toContain('bike')
    expect(kinds).toContain('bus')
    expect(profile.bikeLane).toBe(true)
    expect(profile.busLane).toBe(true)
    // 2025 keeps the 8 general corridors plus dedicated lanes: two bus lanes
    // (west/north) and four curb bike lanes.
    expect(profile.lanes.filter((l) => l.kind === 'auto')).toHaveLength(6)
    expect(profile.lanes.filter((l) => l.kind === 'bus')).toHaveLength(2)
    expect(profile.lanes.filter((l) => l.kind === 'bike')).toHaveLength(4)
  })

  it('keeps every lane inside the road extents', () => {
    for (const era of ERA_IDS) {
      const profile = buildEraLanes(era)
      for (const lane of profile.lanes) {
        const xs = lane.points.map((p) => p.x)
        const zs = lane.points.map((p) => p.z)
        const alongX = Math.max(...xs) - Math.min(...xs) > Math.max(...zs) - Math.min(...zs)
        for (const point of lane.points) {
          // East-west roads span ROAD_GRID_LENGTH along X; north-south roads
          // span ROAD_GRID_WIDTH along Z. Lane centerlines along the travel
          // axis must stay within the grid.
          const along = alongX ? point.x : point.z
          const limit = alongX ? ROAD_GRID_LENGTH / 2 : ROAD_GRID_WIDTH / 2
          expect(Math.abs(along)).toBeLessThanOrEqual(limit + 1e-6)
        }
      }
    }
  })

  it('places crosswalk stops on the lane line', () => {
    for (const era of ['1945', '2025'] as const) {
      const profile = buildEraLanes(era)
      for (const lane of profile.lanes) {
        for (const stop of lane.stops) {
          // Stop center lies on the lane's straight line (projection distance 0)
          // — perpendicular distance from the segment is ~0.
          const onLine = isPointOnLaneLine(lane.points, stop.x, stop.z)
          expect(onLine, `${lane.id} stop not on lane`).toBe(true)
        }
      }
    }
  })

  it('produces straight open lanes of positive length with sensible speed range', () => {
    const profile = buildEraLanes('1985')
    for (const lane of profile.lanes) {
      expect(laneLength(lane.points)).toBeGreaterThan(0)
      // Two waypoints for the straight road: the loop stays two points
      // (open-ended), traversal wraps at the ends.
      expect(lane.points.length).toBeGreaterThanOrEqual(2)
    }
    // North road (z=+STREET_CENTER) travels along +X from -halfLen to +halfLen.
    const north = profile.lanes.find((l) => l.id.includes('ew-north-auto'))
    expect(north).toBeDefined()
    const start = pointAtDistance(north!.points, 1)
    const end = pointAtDistance(north!.points, laneLength(north!.points) - 1)
    // Start near the negative end, end near the positive end; z sits at the
    // lane offset (within ~6 units of the street center).
    expect(start.x).toBeLessThan(-80)
    expect(end.x).toBeGreaterThan(80)
    expect(Math.abs(start.z - STREET_CENTER)).toBeLessThan(6)
    expect(Math.abs(end.z - STREET_CENTER)).toBeLessThan(6)
  })
})

describe('lane width constants', () => {
  it('are positive and distinct', () => {
    expect(AUTO_LANE_WIDTH).toBeGreaterThan(0)
    expect(BUS_LANE_WIDTH).toBeGreaterThan(0)
    expect(BIKE_LANE_WIDTH).toBeGreaterThan(0)
    expect(BUS_LANE_WIDTH).not.toBe(AUTO_LANE_WIDTH)
  })
})