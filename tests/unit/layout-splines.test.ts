/**
 * Contract tests for the vehicle and pedestrian path splines.
 *
 * The acceptance criteria for splines are geometric, so these tests are too:
 * every loop is closed and uniformly sampled by arc length, no loop intersects
 * itself, every vehicle sample stays on the carriageway of the lane it claims,
 * the travel direction matches right-hand traffic, the sidewalk loop walks on
 * the sidewalk, and every crossing exports kerb crossing points and waiting
 * points that really sit on the loop.
 */

import { describe, expect, it } from 'vitest'
import {
  CURB_HEIGHT,
  DEFAULT_LAYOUT_SEED,
  LANE_OFFSETS,
  LANE_WIDTH,
  PARKING_WIDTH,
  SIDEWALK_WALK_LINE,
  SPLINE_SAMPLE_SPACING,
  STREET_NAMES,
  classifyGround,
  countSelfIntersections,
  generateBlock,
  splineByName,
  splinePoseAt,
  streetByName,
  type PathSpline,
  type StreetDescriptor,
} from '../../src/city/layout'

const SEED = DEFAULT_LAYOUT_SEED
const block = generateBlock(SEED)
const splines: PathSpline[] = [...block.vehicleSplines, ...block.pedestrianSplines]

type Point = [number, number, number]

/** Samples of a spline as tuples. */
function samples(spline: PathSpline): Point[] {
  const points: Point[] = []
  for (let index = 0; index < spline.sampleCount; index += 1) {
    points.push([
      spline.positions[index * 3] ?? Number.NaN,
      spline.positions[index * 3 + 1] ?? Number.NaN,
      spline.positions[index * 3 + 2] ?? Number.NaN,
    ])
  }
  return points
}

/** Tangents of a spline as tuples. */
function tangents(spline: PathSpline): Point[] {
  const vectors: Point[] = []
  for (let index = 0; index < spline.sampleCount; index += 1) {
    vectors.push([
      spline.tangents[index * 3] ?? Number.NaN,
      spline.tangents[index * 3 + 1] ?? Number.NaN,
      spline.tangents[index * 3 + 2] ?? Number.NaN,
    ])
  }
  return vectors
}

/** Coordinate of a point on the axis a street runs along. */
function alongOf(street: StreetDescriptor, point: Point): number {
  return street.axis === 'x' ? point[0] : point[2]
}

/** Coordinate of a point across a street. */
function acrossOf(street: StreetDescriptor, point: Point): number {
  return street.acrossAxis === 'x' ? point[0] : point[2]
}

/**
 * Samples of a leg of a circuit: the mid-block part of one street, filtered to
 * the side of the block the lane sits on.
 */
function legSamples(
  spline: PathSpline,
  streetName: (typeof STREET_NAMES)[number],
  expectedAcross: number,
): Point[] {
  const street = streetByName(streetName)
  return samples(spline).filter(
    (point) =>
      Math.abs(alongOf(street, point)) <= 40 &&
      Math.sign(acrossOf(street, point)) === Math.sign(expectedAcross),
  )
}

/** Across-axis coordinate of a lane offset on a street. */
function laneAcross(streetName: (typeof STREET_NAMES)[number], offset: number): number {
  const street = streetByName(streetName)
  return street.centre + offset * street.acrossSign
}

/** Distance from a point to the nearest sample of a spline. */
function distanceToSpline(spline: PathSpline, point: { x: number; z: number }): number {
  return Math.min(
    ...samples(spline).map(([x, , z]) => Math.hypot(x - point.x, z - point.z)),
  )
}

describe('spline inventory', () => {
  it('exports five vehicle circuits and nine pedestrian loops, all closed', () => {
    expect(block.vehicleSplines).toHaveLength(5)
    expect(block.pedestrianSplines).toHaveLength(9)
    expect(block.stats.vehicleSplineCount).toBe(5)
    expect(block.stats.pedestrianSplineCount).toBe(9)

    const names = splines.map((spline) => spline.name)
    expect(new Set(names).size).toBe(names.length)
    for (const spline of splines) {
      expect(spline.closed).toBe(true)
      expect(spline.sampleCount).toBeGreaterThan(8)
      expect(spline.length).toBeGreaterThan(10)
    }

    expect(block.vehicleSplines.filter((spline) => spline.role === 'traffic-lane')).toHaveLength(4)
    expect(block.vehicleSplines.filter((spline) => spline.role === 'parking-lane')).toHaveLength(1)
    expect(block.pedestrianSplines.filter((spline) => spline.role === 'sidewalk-loop')).toHaveLength(1)
    expect(block.pedestrianSplines.filter((spline) => spline.role === 'crossing')).toHaveLength(8)
    expect(block.crossings).toHaveLength(8)
    expect(splineByName(splines, 'vehicle:traffic:curb').laneOffset).toBe(LANE_OFFSETS.kerb)
    expect(splineByName(splines, 'vehicle:parking:loop').laneWidth).toBe(PARKING_WIDTH)
  })

  it('covers both directions of every street with right-hand traffic', () => {
    const traffic = block.vehicleSplines.filter((spline) => spline.role === 'traffic-lane')
    expect(traffic).toHaveLength(4)

    for (const streetName of STREET_NAMES) {
      const street = streetByName(streetName)
      const dots = traffic.map((spline) => {
        const offset = spline.laneOffset ?? 0
        const across = laneAcross(streetName, offset)
        const leg = legSamples(spline, streetName, across)
        expect(leg.length, `${spline.name} on ${streetName}`).toBeGreaterThan(5)
        const vectors = tangents(spline)
        const points = samples(spline)
        let total = 0
        let counted = 0
        for (let index = 0; index < points.length; index += 1) {
          const point = at(points, index)
          if (Math.abs(alongOf(street, point)) > 40) continue
          if (Math.sign(acrossOf(street, point)) !== Math.sign(across)) continue
          const tangent = at(vectors, index)
          total += tangent[0] * street.direction.x + tangent[2] * street.direction.z
          counted += 1
        }
        return total / Math.max(counted, 1)
      })

      // Block-side lanes travel with the street direction, far-side lanes against.
      expect(dots.some((dot) => dot > 0.999), `${streetName} has no forward lane`).toBe(true)
      expect(dots.some((dot) => dot < -0.999), `${streetName} has no opposing lane`).toBe(true)
    }
  })
})

describe('uniform sampling and closure', () => {
  it('samples every loop uniformly by arc length', () => {
    for (const spline of splines) {
      expect(spline.positions).toHaveLength(spline.sampleCount * 3)
      expect(spline.tangents).toHaveLength(spline.sampleCount * 3)
      expect(spline.distances).toHaveLength(spline.sampleCount)
      // `length` is published rounded to millimetres.
      expect(Math.abs(spline.length - spline.sampleCount * spline.sampleSpacing)).toBeLessThan(0.001)

      const step =
        spline.kind === 'vehicle' ? SPLINE_SAMPLE_SPACING.vehicle : SPLINE_SAMPLE_SPACING.pedestrian
      expect(spline.sampleSpacing).toBeCloseTo(step, 1)

      for (let index = 0; index < spline.sampleCount; index += 1) {
        expect(at(spline.distances, index)).toBeCloseTo(index * spline.sampleSpacing, 3)
      }
    }
  })

  it('closes the loop from the last sample back to the first', () => {
    for (const spline of splines) {
      const points = samples(spline)
      const first = at(points, 0)
      const last = at(points, spline.sampleCount - 1)
      const gap = Math.hypot(last[0] - first[0], last[2] - first[2])
      // The seam sits between an arc and a straight, so its chord is a few
      // percent shorter than the arc-length step.
      expect(gap, spline.name).toBeGreaterThan(spline.sampleSpacing * 0.9)
      expect(gap, spline.name).toBeLessThanOrEqual(spline.sampleSpacing * 1.02)
    }
  })

  it('keeps every sample and tangent finite, with unit tangents', () => {
    for (const spline of splines) {
      for (const point of samples(spline)) {
        expect(Number.isFinite(point[0] + point[1] + point[2])).toBe(true)
      }
      for (const tangent of tangents(spline)) {
        expect(Math.hypot(tangent[0], tangent[1], tangent[2])).toBeCloseTo(1, 6)
      }
    }
  })

  it('points every tangent along the direction of travel', () => {
    for (const spline of splines) {
      const points = samples(spline)
      const vectors = tangents(spline)
      for (let index = 0; index < spline.sampleCount; index += 1) {
        const previous = at(points, (index + spline.sampleCount - 1) % spline.sampleCount)
        const next = at(points, (index + 1) % spline.sampleCount)
        const dx = next[0] - previous[0]
        const dz = next[2] - previous[2]
        const magnitude = Math.hypot(dx, dz)
        const tangent = at(vectors, index)
        expect((tangent[0] * dx + tangent[2] * dz) / magnitude).toBeGreaterThan(0.98)
      }
    }
  })

  it('is safe to sample at an arbitrary arc length', () => {
    for (const spline of splines) {
      const start = splinePoseAt(spline, 0)
      const first = at(samples(spline), 0)
      expect(start.position.x).toBeCloseTo(first[0], 2)
      expect(start.position.z).toBeCloseTo(first[2], 2)
      const middle = splinePoseAt(spline, spline.length / 2)
      expect(distanceToSpline(spline, middle.position)).toBeLessThanOrEqual(spline.sampleSpacing)
      expect(Math.hypot(middle.tangent.x, middle.tangent.y, middle.tangent.z)).toBeCloseTo(1, 6)
      const wrapped = splinePoseAt(spline, spline.length + 1)
      const unwrapped = splinePoseAt(spline, 1)
      expect(wrapped.position).toEqual(unwrapped.position)
    }
  })
})

describe('geometry validity', () => {
  it('never loops back through itself', () => {
    for (const spline of splines) {
      expect(countSelfIntersections(spline), spline.name).toBe(0)
    }
  })

  it('keeps every vehicle sample on the carriageway', () => {
    for (const spline of block.vehicleSplines) {
      for (const [x, , z] of samples(spline)) {
        expect(classifyGround(x, z), `${spline.name} at ${x},${z}`).toBe('roadway')
      }
    }
  })

  it('keeps the sidewalk loop on the sidewalk deck', () => {
    const loop = splineByName(splines, 'pedestrian:sidewalk:loop')
    expect(loop.kind).toBe('pedestrian')
    for (const [x, y, z] of samples(loop)) {
      expect(classifyGround(x, z), `${x},${z}`).toBe('sidewalk')
      expect(y).toBeCloseTo(CURB_HEIGHT, 6)
      // The walk lane runs 2 m inside the kerb: never beyond it, and the corner
      // arcs (radius 2 m about the build-line corner) pull it slightly inward.
      const reach = Math.max(Math.abs(x), Math.abs(z))
      expect(reach).toBeLessThanOrEqual(SIDEWALK_WALK_LINE + 0.001)
      expect(reach).toBeGreaterThan(SIDEWALK_WALK_LINE - 1.5)
    }
  })

  it('keeps crossings on the carriageway and the sidewalk', () => {
    for (const crossing of block.crossings) {
      const spline = splineByName(splines, crossing.spline)
      expect(spline.role).toBe('crossing')
      for (const [x, , z] of samples(spline)) {
        const ground = classifyGround(x, z)
        expect(['roadway', 'sidewalk'], `${crossing.name} at ${x},${z}`).toContain(ground)
      }
    }
  })
})

describe('lane plumbing', () => {
  it('puts every circuit leg exactly on its documented lane', () => {
    const expected: Record<string, number> = {
      'vehicle:traffic:curb': LANE_OFFSETS.kerb,
      'vehicle:traffic:inner': LANE_OFFSETS.inner,
      'vehicle:traffic:curb-far': -LANE_OFFSETS.kerb,
      'vehicle:traffic:inner-far': -LANE_OFFSETS.inner,
      'vehicle:parking:loop': LANE_OFFSETS.parking,
    }

    for (const [name, offset] of Object.entries(expected)) {
      const spline = splineByName(splines, name)
      expect(spline.laneOffset).toBe(offset)
      for (const streetName of spline.streets) {
        const across = laneAcross(streetName, offset)
        const street = streetByName(streetName)
        const leg = legSamples(spline, streetName, across)
        expect(leg.length, `${name} on ${streetName}`).toBeGreaterThan(5)
        for (const point of leg) {
          expect(acrossOf(street, point), `${name} on ${streetName}`).toBeCloseTo(across, 2)
        }
      }
    }
  })

  it('turns the block-side circuits clockwise and the far-side circuits back', () => {
    const circulation: Record<string, 'block-clockwise' | 'counter-clockwise'> = {
      'vehicle:traffic:curb': 'block-clockwise',
      'vehicle:traffic:inner': 'block-clockwise',
      'vehicle:parking:loop': 'block-clockwise',
      'vehicle:traffic:curb-far': 'counter-clockwise',
      'vehicle:traffic:inner-far': 'counter-clockwise',
    }
    for (const [name, expected] of Object.entries(circulation)) {
      expect(splineByName(splines, name).circulation).toBe(expected)
    }

    for (const spline of block.vehicleSplines) {
      const laneWidth = spline.role === 'parking-lane' ? PARKING_WIDTH : LANE_WIDTH
      expect(spline.laneWidth).toBe(laneWidth)
      const offset = spline.laneOffset ?? 0
      const sign = offset >= 0 ? 1 : -1
      for (const streetName of spline.streets) {
        const street = streetByName(streetName)
        const across = laneAcross(streetName, offset)
        const leg = legSamples(spline, streetName, across)
        const vectors = tangents(spline)
        const points = samples(spline)
        for (let index = 0; index < points.length; index += 1) {
          const point = at(points, index)
          if (Math.abs(alongOf(street, point)) > 40) continue
          if (Math.sign(acrossOf(street, point)) !== Math.sign(across)) continue
          const tangent = at(vectors, index)
          const dot = tangent[0] * street.direction.x * sign + tangent[2] * street.direction.z * sign
          expect(dot, `${spline.name} on ${streetName}`).toBeGreaterThan(0.999)
        }
        expect(leg.length).toBeGreaterThan(5)
      }
    }
  })

  it('walks every circuit around all four streets', () => {
    for (const spline of block.vehicleSplines) {
      expect([...spline.streets].sort()).toEqual(['east', 'north', 'south', 'west'])
    }
  })
})

describe('pedestrian crossings', () => {
  it('links every crossing to a crosswalk band mesh call-out on the same kerb', () => {
    const meshNames = new Set(block.meshes.map((mesh) => mesh.name))
    for (const crossing of block.crossings) {
      expect(meshNames.has(crossing.name)).toBe(true)
      expect(crossing.name).toBe(`crosswalk:${crossing.corner}:${crossing.street}`)
      expect(crossing.width).toBe(4)
      expect(crossing.span).toBe(20)
    }
    expect(new Set(block.crossings.map((crossing) => crossing.corner)).size).toBe(4)
  })

  it('exports kerb crossing points and waiting points that lie on the loop', () => {
    for (const crossing of block.crossings) {
      const spline = splineByName(splines, crossing.spline)
      expect(crossing.crossingPoints).toHaveLength(2)
      expect(crossing.waitingPoints).toHaveLength(2)

      for (const point of crossing.crossingPoints) {
        expect(Math.max(Math.abs(point.x), Math.abs(point.z))).toBeCloseTo(60, 3)
        expect(distanceToSpline(spline, point)).toBeLessThanOrEqual(spline.sampleSpacing)
      }

      const blockKerb = at(crossing.waitingPoints, 0)
      const farKerb = at(crossing.waitingPoints, 1)
      expect(classifyGround(blockKerb.x, blockKerb.z)).toBe('sidewalk')
      expect(blockKerb.y).toBeCloseTo(CURB_HEIGHT, 6)
      expect(classifyGround(farKerb.x, farKerb.z)).toBe('roadway')
      for (const point of crossing.waitingPoints) {
        expect(distanceToSpline(spline, point)).toBeLessThanOrEqual(spline.sampleSpacing)
      }
    }
  })

  it('walks each crossing out across the carriageway and back', () => {
    for (const crossing of block.crossings) {
      const spline = splineByName(splines, crossing.spline)
      const points = samples(spline)
      const crossingAlongZ = crossing.street === 'north' || crossing.street === 'south'
      let maxReach = 0

      for (const point of points) {
        const band = crossingAlongZ ? point[0] : point[2]
        const depth = crossingAlongZ ? point[2] : point[0]
        // The band is 4 m wide; the 1 m turn loops stay inside it.
        expect(Math.abs(Math.abs(band) - SIDEWALK_WALK_LINE)).toBeLessThanOrEqual(1.5)
        // The loop steps two metres onto the sidewalk and reaches the far kerb.
        expect(Math.abs(depth) - 60).toBeGreaterThanOrEqual(-3.2)
        expect(Math.abs(depth) - 60).toBeLessThanOrEqual(20)
        maxReach = Math.max(maxReach, Math.abs(depth))
      }

      expect(maxReach, crossing.name).toBeGreaterThan(75)
    }
  })
})

function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} outside ${items.length}`)
  }
  return value
}
