/**
 * Vehicle and pedestrian path splines of the canonical block.
 *
 * Every spline is a **closed** loop, sampled at a uniform arc-length
 * resolution, and exported as flat `x, y, z` position and tangent arrays with
 * length metadata. Consumers (the vehicle layer, the pedestrian layer, the
 * inspection UI) animate along those arrays directly; nothing here depends on
 * three.js.
 *
 * Vehicle splines are lane circuits around the block:
 *
 * | spline                      | lanes                    | turn radius |
 * | --------------------------- | ------------------------ | ----------- |
 * | `vehicle:traffic:curb`      | block side, kerb lane    | 5.75 m      |
 * | `vehicle:traffic:inner`     | block side, inner lane   | 7 m         |
 * | `vehicle:traffic:curb-far`  | far side, kerb lane      | 4 m         |
 * | `vehicle:traffic:inner-far` | far side, inner lane     | 7 m         |
 * | `vehicle:parking:loop`      | block-side parking strip | 3.5 m       |
 *
 * Block-side circuits run block-clockwise (east along the north street, south
 * along the east street …) and far-side circuits the other way, so every street
 * carries traffic in both directions, as right-hand traffic demands. Radii are
 * chosen so no lane sample ever leaves the carriageway; the unit suite proves
 * that with `classifyGround`.
 *
 * Pedestrian splines are one sidewalk loop (walk lane 2 m inside the kerb, with
 * corner arcs concentric with the kerb fillet) plus one crossing loop per
 * crosswalk that walks out across the carriageway and back on the other half of
 * the crossing band, so no pedestrian layer ever has to invent a path.
 */

import {
  BUILD_LINE,
  CURB_HEIGHT,
  LANE_OFFSETS,
  LANE_WIDTH,
  PARKING_WIDTH,
  SIDEWALK_WALK_LINE,
  SPLINE_SAMPLE_SPACING,
  STREET_CENTRE,
  clamp,
  round,
  v2,
  v3,
  type CrossingPath,
  type PathSpline,
  type SplineRole,
  type StreetDescriptor,
  type StreetName,
  type Vec2,
  type Vec3,
} from './types'
import { crosswalkPlans, shortestAngle, streetByName, type CrosswalkPlan } from './roads'

/* ------------------------------------------------------------------------- *
 * Segment primitives
 * ------------------------------------------------------------------------- */

/** A straight run between two ground points. */
interface LineSegment {
  readonly kind: 'line'
  readonly from: Vec2
  readonly to: Vec2
}

/** A circular arc; `sweep` is signed and traversal follows its sign. */
interface ArcSegment {
  readonly kind: 'arc'
  readonly centre: Vec2
  readonly radius: number
  readonly startAngle: number
  readonly sweep: number
}

type Segment = LineSegment | ArcSegment

/** One leg of a lane circuit: a street plus the lane offset on it. */
interface CircuitLeg {
  readonly street: StreetName
  /** Positive offsets are toward the block, negative offsets are the far side. */
  readonly offset: number
}

function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

/** Across-axis coordinate of a lane on a street. */
function legAcross(street: StreetDescriptor, offset: number): number {
  return street.centre + offset * street.acrossSign
}

/** Travel direction of a leg; block-side lanes follow the street direction. */
function legDirection(street: StreetDescriptor, offset: number): Vec2 {
  const sign = offset >= 0 ? 1 : -1
  return v2(street.direction.x * sign, street.direction.z * sign)
}

/** Crossing point of two consecutive leg lines (always one x line, one z line). */
function legIntersection(legA: CircuitLeg, legB: CircuitLeg): Vec2 {
  const streetA = streetByName(legA.street)
  const streetB = streetByName(legB.street)
  const acrossA = legAcross(streetA, legA.offset)
  const acrossB = legAcross(streetB, legB.offset)
  return streetA.axis === 'x' ? v2(acrossB, acrossA) : v2(acrossA, acrossB)
}

/** Right-hand normal of a ground direction. */
function rightOf(direction: Vec2): Vec2 {
  return v2(-direction.z, direction.x)
}

/** Arc joining two tangents, traversed in the direction that matches `incoming`. */
function arcSegment(
  centre: Vec2,
  radius: number,
  from: Vec2,
  to: Vec2,
  incoming: Vec2,
): ArcSegment {
  const startAngle = Math.atan2(from.z - centre.z, from.x - centre.x)
  const endAngle = Math.atan2(to.z - centre.z, to.x - centre.x)
  const short = shortestAngle(startAngle, endAngle)
  const candidates = [short, short > 0 ? short - Math.PI * 2 : short + Math.PI * 2]
  for (const sweep of candidates) {
    const forward = sweep >= 0 ? 1 : -1
    const tangent = v2(-Math.sin(startAngle) * forward, Math.cos(startAngle) * forward)
    if (tangent.x * incoming.x + tangent.z * incoming.z > 0) {
      return { kind: 'arc', centre, radius, startAngle, sweep }
    }
  }
  return { kind: 'arc', centre, radius, startAngle, sweep: short }
}

/**
 * Rounded circuit through a list of lane legs.
 *
 * Consecutive legs meet at a corner: straights stop `radius` metres before the
 * leg-line intersection and an arc of that radius carries the path between the
 * tangent points, turning right for block-side legs and left for far-side legs.
 */
function buildCircuit(legs: readonly CircuitLeg[], radius: number): Segment[] {
  const ordered: Segment[] = []
  const count = legs.length

  for (let index = 0; index < count; index += 1) {
    const leg = at(legs, index)
    const nextLeg = at(legs, (index + 1) % count)
    const previousLeg = at(legs, (index + count - 1) % count)
    const unit = legDirection(streetByName(leg.street), leg.offset)
    const nextUnit = legDirection(streetByName(nextLeg.street), nextLeg.offset)
    const corner = legIntersection(leg, nextLeg)
    const previousCorner = legIntersection(previousLeg, leg)
    const entry = v2(corner.x - unit.x * radius, corner.z - unit.z * radius)
    const exit = v2(corner.x + nextUnit.x * radius, corner.z + nextUnit.z * radius)
    const previousExit = v2(
      previousCorner.x + unit.x * radius,
      previousCorner.z + unit.z * radius,
    )
    // `unit × nextUnit` on the ground plane; negative y means a right-hand turn.
    const turnRight = nextUnit.x * unit.z - nextUnit.z * unit.x < 0
    const right = rightOf(unit)
    const side = turnRight ? right : v2(-right.x, -right.z)
    const centre = v2(entry.x + side.x * radius, entry.z + side.z * radius)

    ordered.push({ kind: 'line', from: previousExit, to: entry })
    ordered.push(arcSegment(centre, radius, entry, exit, unit))
  }

  return ordered
}

/* ------------------------------------------------------------------------- *
 * Sampling
 * ------------------------------------------------------------------------- */

function arcPoint(segment: ArcSegment, index: number, steps: number): Vec2 {
  const angle = segment.startAngle + (segment.sweep * index) / steps
  return v2(
    segment.centre.x + segment.radius * Math.cos(angle),
    segment.centre.z + segment.radius * Math.sin(angle),
  )
}

function segmentSteps(segment: Segment): number {
  if (segment.kind === 'line') {
    return 1
  }
  return clamp(Math.ceil((Math.abs(segment.sweep) / (Math.PI / 2)) * 8), 4, 32)
}

/** Turns an ordered segment list into a closed polyline (no closing duplicate). */
function segmentsToPolyline(segments: readonly Segment[]): Vec2[] {
  const points: Vec2[] = []

  for (const segment of segments) {
    if (segment.kind === 'line') {
      if (points.length === 0) {
        points.push(segment.from)
      }
      points.push(segment.to)
      continue
    }
    const steps = segmentSteps(segment)
    for (let index = points.length === 0 ? 0 : 1; index <= steps; index += 1) {
      points.push(arcPoint(segment, index, steps))
    }
  }

  const first = at(points, 0)
  const last = at(points, points.length - 1)
  if (points.length > 1 && Math.hypot(last.x - first.x, last.z - first.z) < 1e-6) {
    points.pop()
  }
  return points
}

interface SampledLoop {
  readonly positions: number[]
  readonly tangents: number[]
  readonly distances: number[]
  readonly sampleCount: number
  readonly sampleSpacing: number
  readonly length: number
}

/** Uniform arc-length resampling of a closed polyline. */
function resampleClosedLoop(polyline: readonly Vec2[], spacing: number, y: number): SampledLoop {
  const count = polyline.length
  const cumulative: number[] = [0]
  for (let index = 0; index < count; index += 1) {
    const current = at(polyline, index)
    const next = at(polyline, (index + 1) % count)
    cumulative.push(at(cumulative, index) + Math.hypot(next.x - current.x, next.z - current.z))
  }

  const total = at(cumulative, count)
  const sampleCount = Math.max(8, Math.round(total / Math.max(spacing, 0.1)))
  const sampleSpacing = round(total / sampleCount, 6)
  const points: Vec2[] = []
  const distances: number[] = []
  let segment = 0

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const distance = (sample * total) / sampleCount
    while (segment + 1 < count && at(cumulative, segment + 1) < distance) {
      segment += 1
    }
    const start = at(polyline, segment)
    const end = at(polyline, (segment + 1) % count)
    const startDistance = at(cumulative, segment)
    const span = at(cumulative, segment + 1) - startDistance
    const t = span > 0 ? (distance - startDistance) / span : 0
    points.push(v2(start.x + (end.x - start.x) * t, start.z + (end.z - start.z) * t))
    distances.push(round(distance, 4))
  }

  const positions: number[] = []
  const tangents: number[] = []
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const previous = at(points, (sample + sampleCount - 1) % sampleCount)
    const current = at(points, sample)
    const next = at(points, (sample + 1) % sampleCount)
    const dx = next.x - previous.x
    const dz = next.z - previous.z
    const magnitude = Math.hypot(dx, dz)
    positions.push(round(current.x), round(y), round(current.z))
    tangents.push(magnitude > 0 ? dx / magnitude : 1, 0, magnitude > 0 ? dz / magnitude : 0)
  }

  return {
    positions,
    tangents,
    distances,
    sampleCount,
    sampleSpacing,
    length: round(sampleCount * sampleSpacing),
  }
}

interface SplineMeta {
  readonly kind: 'vehicle' | 'pedestrian'
  readonly role: SplineRole
  readonly laneOffset: number | null
  readonly laneWidth: number | null
  readonly circulation: PathSpline['circulation']
  readonly streets: readonly StreetName[]
}

function makeSpline(
  name: string,
  segments: readonly Segment[],
  spacing: number,
  y: number,
  meta: SplineMeta,
): PathSpline {
  const sampled = resampleClosedLoop(segmentsToPolyline(segments), spacing, y)
  return {
    name,
    kind: meta.kind,
    role: meta.role,
    closed: true,
    sampleSpacing: sampled.sampleSpacing,
    sampleCount: sampled.sampleCount,
    length: sampled.length,
    positions: sampled.positions,
    tangents: sampled.tangents,
    distances: sampled.distances,
    laneOffset: meta.laneOffset,
    laneWidth: meta.laneWidth,
    circulation: meta.circulation,
    streets: meta.streets,
  }
}

/* ------------------------------------------------------------------------- *
 * Vehicle circuits
 * ------------------------------------------------------------------------- */

/** Streets in block-clockwise order. */
export const CLOCKWISE_STREETS: readonly StreetName[] = ['north', 'east', 'south', 'west']

/** Streets in counter-clockwise order. */
export const COUNTER_CLOCKWISE_STREETS: readonly StreetName[] = ['north', 'west', 'south', 'east']

function circuitLegs(streets: readonly StreetName[], offset: number): CircuitLeg[] {
  return streets.map((street) => ({ street, offset }))
}

function vehicleSplines(vehicleSpacing: number): PathSpline[] {
  const build = (
    name: string,
    offset: number,
    radius: number,
    streets: readonly StreetName[],
    laneWidth: number,
    role: SplineRole,
  ): PathSpline =>
    makeSpline(name, buildCircuit(circuitLegs(streets, offset), radius), vehicleSpacing, 0, {
      kind: 'vehicle',
      role,
      laneOffset: offset,
      laneWidth,
      circulation: offset >= 0 ? 'block-clockwise' : 'counter-clockwise',
      streets,
    })

  return [
    build('vehicle:traffic:curb', LANE_OFFSETS.kerb, LANE_OFFSETS.kerb, CLOCKWISE_STREETS, LANE_WIDTH, 'traffic-lane'),
    build('vehicle:traffic:inner', LANE_OFFSETS.inner, 7, CLOCKWISE_STREETS, LANE_WIDTH, 'traffic-lane'),
    build('vehicle:traffic:curb-far', -LANE_OFFSETS.kerb, 4, COUNTER_CLOCKWISE_STREETS, LANE_WIDTH, 'traffic-lane'),
    build('vehicle:traffic:inner-far', -LANE_OFFSETS.inner, 7, COUNTER_CLOCKWISE_STREETS, LANE_WIDTH, 'traffic-lane'),
    build('vehicle:parking:loop', LANE_OFFSETS.parking, 3.5, CLOCKWISE_STREETS, PARKING_WIDTH, 'parking-lane'),
  ]
}

/* ------------------------------------------------------------------------- *
 * Pedestrian loops
 * ------------------------------------------------------------------------- */

/**
 * Offset from a street centre line to the sidewalk walk lane. The block is
 * symmetric, so the same value puts every leg 2 m inside the kerb.
 */
export const SIDEWALK_LEG_OFFSET = STREET_CENTRE - SIDEWALK_WALK_LINE

/**
 * Corner radius of the sidewalk loop: the walk lane sits this far inside the
 * build line, so each corner arc is concentric with the kerb fillet and stays
 * inside the sidewalk corner quarter disc.
 */
export const SIDEWALK_LOOP_RADIUS = SIDEWALK_WALK_LINE - BUILD_LINE

function sidewalkLoop(pedestrianSpacing: number): PathSpline {
  return makeSpline(
    'pedestrian:sidewalk:loop',
    buildCircuit(circuitLegs(CLOCKWISE_STREETS, SIDEWALK_LEG_OFFSET), SIDEWALK_LOOP_RADIUS),
    pedestrianSpacing,
    CURB_HEIGHT,
    {
      kind: 'pedestrian',
      role: 'sidewalk-loop',
      laneOffset: null,
      laneWidth: null,
      circulation: null,
      streets: CLOCKWISE_STREETS,
    },
  )
}

/** Half distance between the two walk lines of a crossing loop. */
const CROSSING_WALK_OFFSET = 1

/** Distance from the kerb to the block-side turn-around centre. */
const CROSSING_NEAR_TURN = -2

/**
 * Point on a crossing loop: `u` runs away from the block across the
 * carriageway (`u = 0` at the kerb line) and `v` is the offset within the
 * crossing band.
 */
function crossingPoint(plan: CrosswalkPlan, u: number, v: number): Vec2 {
  const along = plan.kerbCoordinate + plan.directionSign * u
  const across = plan.bandCentre + v
  return plan.crossAxis === 'x' ? v2(along, across) : v2(across, along)
}

/** Crossing loop: out across the carriageway, U-turn, back on the far half. */
function crossingSegments(plan: CrosswalkPlan): Segment[] {
  const nearTurn = CROSSING_NEAR_TURN
  const farTurn = plan.span - 2
  const walk = CROSSING_WALK_OFFSET
  const outboundStart = crossingPoint(plan, nearTurn, -walk)
  const outboundEnd = crossingPoint(plan, farTurn, -walk)
  const returnStart = crossingPoint(plan, farTurn, walk)
  const returnEnd = crossingPoint(plan, nearTurn, walk)
  const farTurnCentre = crossingPoint(plan, farTurn, 0)
  const nearTurnCentre = crossingPoint(plan, nearTurn, 0)
  const uDirection = v2(
    plan.crossAxis === 'x' ? plan.directionSign : 0,
    plan.crossAxis === 'z' ? plan.directionSign : 0,
  )
  const backDirection = v2(-uDirection.x, -uDirection.z)

  return [
    { kind: 'line', from: outboundStart, to: outboundEnd },
    arcSegment(farTurnCentre, walk, outboundEnd, returnStart, uDirection),
    { kind: 'line', from: returnStart, to: returnEnd },
    arcSegment(nearTurnCentre, walk, returnEnd, outboundStart, backDirection),
  ]
}

function crossingPaths(pedestrianSpacing: number): {
  splines: PathSpline[]
  crossings: CrossingPath[]
} {
  const splines: PathSpline[] = []
  const crossings: CrossingPath[] = []

  for (const plan of crosswalkPlans()) {
    splines.push(
      makeSpline(plan.splineName, crossingSegments(plan), pedestrianSpacing, 0, {
        kind: 'pedestrian',
        role: 'crossing',
        laneOffset: null,
        laneWidth: null,
        circulation: null,
        streets: [plan.street],
      }),
    )

    const kerbOut = crossingPoint(plan, 0, -CROSSING_WALK_OFFSET)
    const kerbBack = crossingPoint(plan, 0, CROSSING_WALK_OFFSET)
    const blockKerbWait = crossingPoint(plan, CROSSING_NEAR_TURN, 0)
    const farKerbWait = crossingPoint(plan, plan.span - 2, 0)
    crossings.push({
      name: plan.name,
      corner: plan.corner,
      street: plan.street,
      spline: plan.splineName,
      width: plan.width,
      span: plan.span,
      crossingPoints: [
        v3(kerbOut.x, 0, kerbOut.z),
        v3(kerbBack.x, 0, kerbBack.z),
      ],
      waitingPoints: [
        v3(blockKerbWait.x, CURB_HEIGHT, blockKerbWait.z),
        v3(farKerbWait.x, 0, farKerbWait.z),
      ],
    })
  }

  return { splines, crossings }
}

/* ------------------------------------------------------------------------- *
 * Public assembly and validation
 * ------------------------------------------------------------------------- */

/** Everything the block needs for vehicle and pedestrian motion. */
export interface SplineBundle {
  readonly vehicles: readonly PathSpline[]
  readonly pedestrians: readonly PathSpline[]
  readonly crossings: readonly CrossingPath[]
}

/** Builds every spline of the block. */
export function buildSplines(
  vehicleSpacing: number = SPLINE_SAMPLE_SPACING.vehicle,
  pedestrianSpacing: number = SPLINE_SAMPLE_SPACING.pedestrian,
): SplineBundle {
  const crossings = crossingPaths(pedestrianSpacing)
  return {
    vehicles: vehicleSplines(vehicleSpacing),
    pedestrians: [sidewalkLoop(pedestrianSpacing), ...crossings.splines],
    crossings: crossings.crossings,
  }
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

function segmentsProperlyIntersect(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean {
  const epsilon = 1e-9
  const d1 = orientation(b0, b1, a0)
  const d2 = orientation(b0, b1, a1)
  const d3 = orientation(a0, a1, b0)
  const d4 = orientation(a0, a1, b1)
  const crossesFirst = (d1 > epsilon && d2 < -epsilon) || (d1 < -epsilon && d2 > epsilon)
  const crossesSecond = (d3 > epsilon && d4 < -epsilon) || (d3 < -epsilon && d4 > epsilon)
  return crossesFirst && crossesSecond
}

/**
 * Counts proper self-intersections of a sampled loop.
 *
 * Adjacent segments, which share an endpoint by construction, and collinear
 * touches are excluded, so a clean loop returns `0`. The unit suite runs this
 * over every exported spline as its non-self-intersection proof.
 */
export function countSelfIntersections(spline: PathSpline): number {
  const count = spline.sampleCount
  const point = (index: number): Vec2 => {
    const base = (index % count) * 3
    return v2(spline.positions[base] ?? Number.NaN, spline.positions[base + 2] ?? Number.NaN)
  }

  let intersections = 0
  for (let i = 0; i < count; i += 1) {
    const iNext = (i + 1) % count
    for (let j = i + 1; j < count; j += 1) {
      const jNext = (j + 1) % count
      if (iNext === j || jNext === i) {
        continue
      }
      if (segmentsProperlyIntersect(point(i), point(iNext), point(j), point(jNext))) {
        intersections += 1
      }
    }
  }
  return intersections
}

/** Position and tangent at an arc length along a spline. */
export function splinePoseAt(
  spline: PathSpline,
  distance: number,
): { readonly position: Vec3; readonly tangent: Vec3 } {
  const count = spline.sampleCount
  const spacing = spline.sampleSpacing
  const wrapped = ((distance % spline.length) + spline.length) % spline.length
  const index = Math.floor(wrapped / spacing) % count
  const next = (index + 1) % count
  const t = (wrapped - index * spacing) / spacing
  const read = (sample: number, offset: number): number => spline.positions[sample * 3 + offset] ?? 0
  const readTangent = (sample: number, offset: number): number =>
    spline.tangents[sample * 3 + offset] ?? 0
  const mix = (source: (sample: number, offset: number) => number, offset: number): number =>
    source(index, offset) + (source(next, offset) - source(index, offset)) * t
  const tangent = v3(mix(readTangent, 0), mix(readTangent, 1), mix(readTangent, 2))
  const magnitude = Math.hypot(tangent.x, tangent.y, tangent.z)

  return {
    position: v3(round(mix(read, 0)), round(mix(read, 1)), round(mix(read, 2))),
    tangent:
      magnitude > 0 ? v3(tangent.x / magnitude, tangent.y / magnitude, tangent.z / magnitude) : v3(1, 0, 0),
  }
}

/** Convenience: the spline whose name matches, or a descriptive error. */
export function splineByName(splines: readonly PathSpline[], name: string): PathSpline {
  const spline = splines.find((candidate) => candidate.name === name)
  if (spline === undefined) {
    throw new RangeError(`Unknown spline ${name}`)
  }
  return spline
}
