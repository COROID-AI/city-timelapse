/**
 * Road, sidewalk, kerb, crosswalk and drainage geometry of the canonical block,
 * plus the raised deck the parcel grid sits on.
 *
 * Everything here is engine-agnostic mesh data: flat `x, y, z` position arrays
 * with triangle indices, grouped by the named groups in {@link MESH_GROUPS}.
 * `buildMeshes.ts` is the only place that knows about three.js.
 *
 * The carriageway cross-section (offsets measured from the street centre line,
 * positive toward the block) is tiled as:
 *
 * ```
 *   -10 … -7.5   parking strip (far side)
 *  -7.5 … -4.0   travel lane (far side, fast)
 *  -4.0 … -0.5   travel lane (far side, kerb)
 *  -0.5 …  0.5   centre line zone
 *   0.5 …  4.0   travel lane (block side, fast)
 *   4.0 …  7.5   travel lane (block side, kerb)
 *   7.5 … 10.0   parking strip (block side)
 * ```
 *
 * The block corner is rounded with {@link CORNER_RADIUS}: the kerb follows a
 * quarter arc centred on the matching build-line corner, so the carriageway
 * bulges into the corner and a right-turning vehicle never touches the kerb.
 * The sidewalk is therefore the 4 m ring between the kerb and the build line,
 * ending in a quarter disc of radius {@link CORNER_RADIUS} at each corner.
 */

import type { Rng } from '../../lib/rng'
import {
  BLOCK_DECK_HEIGHT,
  BLOCK_HALF,
  BUILD_LINE,
  CORNER_NAMES,
  CORNER_RADIUS,
  CURB_HEIGHT,
  LANE_BOUNDARY_OFFSET,
  LANE_OFFSETS,
  LANE_WIDTH,
  MARKING_CLEAR_ZONE,
  MARKING_LIFT,
  MATERIAL_KEYS,
  MESH_GROUPS,
  PARKING_WIDTH,
  ROAD_WIDTH,
  SIDEWALK_WALK_LINE,
  STREET_CENTRE,
  WORLD_HALF,
  clamp,
  round,
  v2,
  v3,
  type BlockLayout,
  type CornerName,
  type MaterialKey,
  type MeshData,
  type MeshGroup,
  type Parcel,
  type StreetDescriptor,
  type StreetName,
  type Vec2,
  type Vec3,
} from './types'

/* ------------------------------------------------------------------------- *
 * Streets and corners
 * ------------------------------------------------------------------------- */

/** The four streets of the block, clockwise from the north side. */
export const STREETS: readonly StreetDescriptor[] = [
  {
    name: 'north',
    axis: 'x',
    acrossAxis: 'z',
    centre: -STREET_CENTRE,
    acrossSign: 1,
    direction: v3(1, 0, 0),
    outward: v3(0, 0, -1),
    kerb: BLOCK_HALF,
    corners: ['north-west', 'north-east'],
  },
  {
    name: 'east',
    axis: 'z',
    acrossAxis: 'x',
    centre: STREET_CENTRE,
    acrossSign: -1,
    direction: v3(0, 0, 1),
    outward: v3(1, 0, 0),
    kerb: BLOCK_HALF,
    corners: ['north-east', 'south-east'],
  },
  {
    name: 'south',
    axis: 'x',
    acrossAxis: 'z',
    centre: STREET_CENTRE,
    acrossSign: -1,
    direction: v3(-1, 0, 0),
    outward: v3(0, 0, 1),
    kerb: BLOCK_HALF,
    corners: ['south-west', 'south-east'],
  },
  {
    name: 'west',
    axis: 'z',
    acrossAxis: 'x',
    centre: -STREET_CENTRE,
    acrossSign: 1,
    direction: v3(0, 0, -1),
    outward: v3(-1, 0, 0),
    kerb: BLOCK_HALF,
    corners: ['north-west', 'south-west'],
  },
]

/** A rounded block corner. */
export interface CornerDescriptor {
  readonly name: CornerName
  /** Sign of the corner on the x axis. */
  readonly signX: 1 | -1
  /** Sign of the corner on the z axis. */
  readonly signZ: 1 | -1
  /** Kerb square corner point, e.g. `(60, -60)` for the north-east corner. */
  readonly point: Vec2
  /** Fillet centre: the matching build-line corner, e.g. `(56, -56)`. */
  readonly filletCentre: Vec2
  /** Tangent point of the fillet on the north/south kerb, e.g. `(56, -60)`. */
  readonly kerbTangentAlong: Vec2
  /** Tangent point of the fillet on the east/west kerb, e.g. `(60, -56)`. */
  readonly kerbTangentAcross: Vec2
  readonly radius: number
  /** Meeting streets, north/south street first. */
  readonly streets: readonly [StreetName, StreetName]
}

const CORNER_SIGNS: Readonly<Record<CornerName, { signX: 1 | -1; signZ: 1 | -1 }>> = {
  'north-east': { signX: 1, signZ: -1 },
  'south-east': { signX: 1, signZ: 1 },
  'south-west': { signX: -1, signZ: 1 },
  'north-west': { signX: -1, signZ: -1 },
}

function buildCorner(name: CornerName): CornerDescriptor {
  const signs = CORNER_SIGNS[name]
  const { signX, signZ } = signs
  return {
    name,
    signX,
    signZ,
    point: v2(signX * BLOCK_HALF, signZ * BLOCK_HALF),
    filletCentre: v2(signX * BUILD_LINE, signZ * BUILD_LINE),
    kerbTangentAlong: v2(signX * BUILD_LINE, signZ * BLOCK_HALF),
    kerbTangentAcross: v2(signX * BLOCK_HALF, signZ * BUILD_LINE),
    radius: CORNER_RADIUS,
    streets: [signZ < 0 ? 'north' : 'south', signX > 0 ? 'east' : 'west'],
  }
}

/** The four rounded block corners, clockwise from the north-east corner. */
export const CORNERS: readonly CornerDescriptor[] = CORNER_NAMES.map(buildCorner)

/** Looks a street descriptor up by name. */
export function streetByName(name: StreetName): StreetDescriptor {
  const street = STREETS.find((candidate) => candidate.name === name)
  if (street === undefined) {
    throw new RangeError(`Unknown street ${name}`)
  }
  return street
}

/** Looks a corner descriptor up by name. */
export function cornerByName(name: CornerName): CornerDescriptor {
  const corner = CORNERS.find((candidate) => candidate.name === name)
  if (corner === undefined) {
    throw new RangeError(`Unknown corner ${name}`)
  }
  return corner
}

/* ------------------------------------------------------------------------- *
 * Arc helpers (shared with the spline module)
 * ------------------------------------------------------------------------- */

/** Reads an index the caller has already proven to be in range. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

/** Number of chords needed to keep an arc's sagitta under `tolerance` metres. */
export function arcSegments(radius: number, sweep: number, tolerance = 0.01): number {
  if (radius <= 0 || sweep === 0) {
    return 1
  }
  const maxStep = 2 * Math.acos(clamp(1 - tolerance / radius, -1, 1))
  const segments = Math.ceil(Math.abs(sweep) / (maxStep > 0 ? maxStep : Math.PI / 4))
  return clamp(segments, 2, 32)
}

/** Shortest signed angle from `from` to `to`, in `(-π, π]`. */
export function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta <= -Math.PI) delta += Math.PI * 2
  return delta
}

/** Start angle and signed sweep of the arc that runs from `from` to `to`. */
export function arcBetween(
  centre: Vec2,
  from: Vec2,
  to: Vec2,
): { readonly startAngle: number; readonly sweep: number } {
  const startAngle = Math.atan2(from.z - centre.z, from.x - centre.x)
  const endAngle = Math.atan2(to.z - centre.z, to.x - centre.x)
  return { startAngle, sweep: shortestAngle(startAngle, endAngle) }
}

/** Samples an arc, `segments + 1` points inclusive of both ends. */
export function arcPoints(
  centre: Vec2,
  radius: number,
  startAngle: number,
  sweep: number,
  segments: number,
): Vec2[] {
  const points: Vec2[] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + (sweep * index) / segments
    points.push(v2(round(centre.x + radius * Math.cos(angle)), round(centre.z + radius * Math.sin(angle))))
  }
  return points
}

/** Samples the arc that runs from `from` to `to` (both ends inclusive). */
export function arcPointsBetween(
  centre: Vec2,
  radius: number,
  from: Vec2,
  to: Vec2,
  segments?: number,
): Vec2[] {
  const { startAngle, sweep } = arcBetween(centre, from, to)
  return arcPoints(centre, radius, startAngle, sweep, segments ?? arcSegments(radius, sweep))
}

/** True when two ground points coincide at the published precision. */
export function samePoint(a: Vec2, b: Vec2): boolean {
  return round(a.x) === round(b.x) && round(a.z) === round(b.z)
}

/* ------------------------------------------------------------------------- *
 * Mesh drafts
 * ------------------------------------------------------------------------- */

interface MeshDraft {
  readonly name: string
  readonly group: MeshGroup
  readonly materialKey: MaterialKey
  readonly raised: boolean
  readonly positions: number[]
  readonly indices: number[]
  min: Vec3
  max: Vec3
}

function createDraft(
  name: string,
  group: MeshGroup,
  materialKey: MaterialKey,
  raised: boolean,
): MeshDraft {
  return {
    name,
    group,
    materialKey,
    raised,
    positions: [],
    indices: [],
    min: v3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    max: v3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
  }
}

function pushVertex(draft: MeshDraft, point: Vec3): number {
  const index = draft.positions.length / 3
  const x = round(point.x)
  const y = round(point.y)
  const z = round(point.z)
  draft.positions.push(x, y, z)
  draft.min = v3(Math.min(draft.min.x, x), Math.min(draft.min.y, y), Math.min(draft.min.z, z))
  draft.max = v3(Math.max(draft.max.x, x), Math.max(draft.max.y, y), Math.max(draft.max.z, z))
  return index
}

/**
 * Planar polygon on the ground plane, every triangle wound to face up.
 *
 * The fan anchor is the polygon's first vertex, so callers pass a vertex that
 * sees the whole polygon (the corner apex of the curved corner apron, a corner
 * of a rectangle, the centre of a sector). Each triangle is oriented on its own
 * because the curved corner apron is concave: flipping the whole ring would
 * re-triangulate it around a different anchor instead of reversing it.
 */
function addHorizontalPolygon(draft: MeshDraft, ring: readonly Vec2[], y: number): void {
  const base = ring.map((point) => pushVertex(draft, v3(point.x, y, point.z)))
  for (let index = 1; index + 1 < base.length; index += 1) {
    const first = at(base, 0)
    const second = at(base, index)
    const third = at(base, index + 1)
    const p0 = vertexAt(draft, first)
    const p1 = vertexAt(draft, second)
    const p2 = vertexAt(draft, third)
    const ux = p1.x - p0.x
    const uz = p1.z - p0.z
    const vx = p2.x - p0.x
    const vz = p2.z - p0.z
    // y component of `u × v`: positive when the triangle faces up.
    const facingUp = uz * vx - ux * vz > 0
    if (facingUp) {
      draft.indices.push(first, second, third)
    } else {
      draft.indices.push(first, third, second)
    }
  }
}

/** Reads a pushed vertex back out of a draft. */
function vertexAt(draft: MeshDraft, index: number): Vec3 {
  const base = index * 3
  return v3(
    draft.positions[base] ?? 0,
    draft.positions[base + 1] ?? 0,
    draft.positions[base + 2] ?? 0,
  )
}

/** Vertical wall from `a` to `b`; the outward normal is `up × (b - a)`. */
function addVerticalWall(draft: MeshDraft, a: Vec2, b: Vec2, y0: number, y1: number): void {
  const bottomA = pushVertex(draft, v3(a.x, y0, a.z))
  const topA = pushVertex(draft, v3(a.x, y1, a.z))
  const topB = pushVertex(draft, v3(b.x, y1, b.z))
  const bottomB = pushVertex(draft, v3(b.x, y0, b.z))
  draft.indices.push(bottomA, topA, topB, bottomA, topB, bottomB)
}

function finaliseDraft(draft: MeshDraft): MeshData {
  return {
    name: draft.name,
    group: draft.group,
    materialKey: draft.materialKey,
    triangles: draft.indices.length / 3,
    positions: draft.positions,
    indices: draft.indices,
    bounds: { min: draft.min, max: draft.max },
    raised: draft.raised,
  }
}

/** Rectangle helper on the ground plane. */
function groundRect(cornerA: Vec2, cornerB: Vec2): Vec2[] {
  return [
    v2(Math.min(cornerA.x, cornerB.x), Math.min(cornerA.z, cornerB.z)),
    v2(Math.max(cornerA.x, cornerB.x), Math.min(cornerA.z, cornerB.z)),
    v2(Math.max(cornerA.x, cornerB.x), Math.max(cornerA.z, cornerB.z)),
    v2(Math.min(cornerA.x, cornerB.x), Math.max(cornerA.z, cornerB.z)),
  ]
}

/** Rectangles on a street, addressed by along-axis coordinate and lane offset. */
function streetRect(
  street: StreetDescriptor,
  alongFrom: number,
  alongTo: number,
  offsetFrom: number,
  offsetTo: number,
): Vec2[] {
  const cornerA = streetPoint2(street, alongFrom, offsetFrom)
  const cornerB = streetPoint2(street, alongTo, offsetTo)
  return groundRect(cornerA, cornerB)
}

function streetPoint2(street: StreetDescriptor, along: number, offset: number): Vec2 {
  const across = street.centre + offset * street.acrossSign
  return street.axis === 'x' ? v2(along, across) : v2(across, along)
}

/* ------------------------------------------------------------------------- *
 * Decoration density
 * ------------------------------------------------------------------------- */

function decorationCount(base: number, detail: number, minimum: number): number {
  return clamp(Math.round(base * detail), minimum, base)
}

/* ------------------------------------------------------------------------- *
 * Crosswalk plans
 * ------------------------------------------------------------------------- */

/**
 * A crosswalk and the matching pedestrian crossing loop.
 *
 * `crossAxis` is the axis the pedestrians walk along, `bandCentre` is the
 * coordinate of the crossing band on the crossed street's axis, and
 * `kerbCoordinate` is where the carriageway starts in the crossing direction.
 */
export interface CrosswalkPlan {
  /** Mesh name, e.g. `crosswalk:north-east:north`. */
  readonly name: string
  /** Matching pedestrian spline name. */
  readonly splineName: string
  readonly corner: CornerName
  /** Street that is crossed. */
  readonly street: StreetName
  readonly crossAxis: 'x' | 'z'
  /** Coordinate of the band centre along the crossed street. */
  readonly bandCentre: number
  /** Coordinate of the block-side kerb line along the crossing direction. */
  readonly kerbCoordinate: number
  /** Travel direction across the carriageway. */
  readonly directionSign: 1 | -1
  /** Band width along the crossed street. */
  readonly width: number
  /** Carriageway width that has to be crossed. */
  readonly span: number
}

/** The eight crosswalks of the block: two per corner, one per meeting street. */
export function crosswalkPlans(): CrosswalkPlan[] {
  const plans: CrosswalkPlan[] = []
  for (const corner of CORNERS) {
    for (const streetName of corner.streets) {
      const street = streetByName(streetName)
      const crossingTheNorthSouthStreet = street.axis === 'x'
      plans.push({
        name: `crosswalk:${corner.name}:${street.name}`,
        splineName: `pedestrian:crossing:${corner.name}:${street.name}`,
        corner: corner.name,
        street: street.name,
        crossAxis: street.axis === 'x' ? 'z' : 'x',
        bandCentre: crossingTheNorthSouthStreet
          ? corner.signX * SIDEWALK_WALK_LINE
          : corner.signZ * SIDEWALK_WALK_LINE,
        kerbCoordinate: crossingTheNorthSouthStreet
          ? corner.signZ * BLOCK_HALF
          : corner.signX * BLOCK_HALF,
        directionSign: crossingTheNorthSouthStreet ? corner.signZ : corner.signX,
        width: 4,
        span: ROAD_WIDTH,
      })
    }
  }
  return plans
}

/* ------------------------------------------------------------------------- *
 * Surface meshes
 * ------------------------------------------------------------------------- */

function roadSurfaceMeshes(): MeshData[] {
  const meshes: MeshData[] = []

  for (const street of STREETS) {
    const draft = createDraft(`surface:road:${street.name}`, 'roads', 'asphalt', false)
    const sign = Math.sign(street.centre)
    addHorizontalPolygon(
      draft,
      streetRect(street, -BLOCK_HALF, BLOCK_HALF, sign * BLOCK_HALF - street.centre, sign * WORLD_HALF - street.centre),
      0,
    )
    meshes.push(finaliseDraft(draft))
  }

  for (const corner of CORNERS) {
    const square = createDraft(
      `surface:road:intersection:${corner.name}`,
      'roads',
      'asphalt',
      false,
    )
    addHorizontalPolygon(
      square,
      groundRect(
        v2(corner.signX * BLOCK_HALF, corner.signZ * BLOCK_HALF),
        v2(corner.signX * WORLD_HALF, corner.signZ * WORLD_HALF),
      ),
      0,
    )
    meshes.push(finaliseDraft(square))

    const apron = createDraft(`surface:road:apron:${corner.name}`, 'roads', 'asphalt', false)
    const arc = arcPointsBetween(
      corner.filletCentre,
      corner.radius,
      corner.kerbTangentAlong,
      corner.kerbTangentAcross,
    )
    addHorizontalPolygon(apron, [corner.point, ...arc], 0)
    meshes.push(finaliseDraft(apron))
  }

  return meshes
}

function laneStripMeshes(detail: number): MeshData[] {
  const meshes: MeshData[] = []
  // Index 0 … 3: block-side kerb lane, block-side inner lane, far-side inner
  // lane, far-side kerb lane.
  const offsets = [
    LANE_OFFSETS.kerb,
    LANE_OFFSETS.inner,
    -LANE_OFFSETS.inner,
    -LANE_OFFSETS.kerb,
  ]

  for (const street of STREETS) {
    offsets.forEach((offset, index) => {
      const draft = createDraft(
        `street:${street.name}:lane:${index}`,
        'lane-strips',
        'lane-surface',
        true,
      )
      addHorizontalPolygon(
        draft,
        streetRect(
          street,
          -MARKING_CLEAR_ZONE,
          MARKING_CLEAR_ZONE,
          offset - LANE_WIDTH / 2,
          offset + LANE_WIDTH / 2,
        ),
        MARKING_LIFT,
      )
      meshes.push(finaliseDraft(draft))
    })

    // Index 0 … 2: block-side lane boundary, centre line, far-side boundary.
    const dividerOffsets = [LANE_BOUNDARY_OFFSET, 0, -LANE_BOUNDARY_OFFSET]
    dividerOffsets.forEach((offset, index) => {
      const draft = createDraft(
        `street:${street.name}:divider:${index}`,
        'lane-strips',
        'marking',
        true,
      )
      const dashes = decorationCount(20, detail, 4)
      const pitch = (MARKING_CLEAR_ZONE * 2) / dashes
      for (let dash = 0; dash < dashes; dash += 1) {
        const centre = -MARKING_CLEAR_ZONE + pitch * (dash + 0.5)
        addHorizontalPolygon(
          draft,
          streetRect(street, centre - pitch * 0.25, centre + pitch * 0.25, offset - 0.075, offset + 0.075),
          MARKING_LIFT + 0.004,
        )
      }
      meshes.push(finaliseDraft(draft))
    })
  }

  return meshes
}

/** Parking bay pitch along a kerb. */
export const PARKING_BAY_PITCH = 6

/** Number of parking bays on each parking strip. */
export const PARKING_BAY_COUNT = 17

/** Along-axis coordinate of parking bay `index` (0-based). */
export function parkingBayCentre(index: number): number {
  const span = PARKING_BAY_COUNT * PARKING_BAY_PITCH
  const start = -MARKING_CLEAR_ZONE + (MARKING_CLEAR_ZONE * 2 - span) / 2
  return round(start + PARKING_BAY_PITCH * (index + 0.5))
}

function parkingStripMeshes(): MeshData[] {
  const meshes: MeshData[] = []

  for (const street of STREETS) {
    const stripOffsets = [LANE_OFFSETS.parking, -LANE_OFFSETS.parking]
    stripOffsets.forEach((offset, index) => {
      const draft = createDraft(
        `street:${street.name}:parking:${index}`,
        'parking-strips',
        'parking-surface',
        true,
      )
      addHorizontalPolygon(
        draft,
        streetRect(
          street,
          -MARKING_CLEAR_ZONE,
          MARKING_CLEAR_ZONE,
          offset - PARKING_WIDTH / 2,
          offset + PARKING_WIDTH / 2,
        ),
        MARKING_LIFT,
      )
      meshes.push(finaliseDraft(draft))

      const ticks = createDraft(
        `street:${street.name}:parking-tick:${index}`,
        'parking-strips',
        'marking',
        true,
      )
      const span = PARKING_BAY_COUNT * PARKING_BAY_PITCH
      const start = -MARKING_CLEAR_ZONE + (MARKING_CLEAR_ZONE * 2 - span) / 2
      // Tick marks sit on the structural bay boundaries, so they never depend
      // on the decoration density: content layers rely on them all being there.
      for (let boundary = 0; boundary <= PARKING_BAY_COUNT; boundary += 1) {
        const along = start + PARKING_BAY_PITCH * boundary
        addHorizontalPolygon(
          ticks,
          streetRect(street, along - 0.06, along + 0.06, offset - PARKING_WIDTH / 2, offset + PARKING_WIDTH / 2),
          MARKING_LIFT + 0.002,
        )
      }
      meshes.push(finaliseDraft(ticks))
    })
  }

  return meshes
}

function sidewalkMeshes(): MeshData[] {
  const meshes: MeshData[] = []

  const bands: ReadonlyArray<{ street: StreetName; from: Vec2; to: Vec2 }> = [
    { street: 'north', from: v2(-BUILD_LINE, -BLOCK_HALF), to: v2(BUILD_LINE, -BUILD_LINE) },
    { street: 'east', from: v2(BUILD_LINE, -BUILD_LINE), to: v2(BLOCK_HALF, BUILD_LINE) },
    { street: 'south', from: v2(-BUILD_LINE, BUILD_LINE), to: v2(BUILD_LINE, BLOCK_HALF) },
    { street: 'west', from: v2(-BLOCK_HALF, -BUILD_LINE), to: v2(-BUILD_LINE, BUILD_LINE) },
  ]

  for (const band of bands) {
    const draft = createDraft(`surface:sidewalk:${band.street}`, 'sidewalks', 'sidewalk', false)
    addHorizontalPolygon(draft, groundRect(band.from, band.to), CURB_HEIGHT)
    meshes.push(finaliseDraft(draft))
  }

  for (const corner of CORNERS) {
    const draft = createDraft(
      `surface:sidewalk:corner:${corner.name}`,
      'sidewalks',
      'sidewalk',
      false,
    )
    const arc = arcPointsBetween(
      corner.filletCentre,
      corner.radius,
      corner.kerbTangentAlong,
      corner.kerbTangentAcross,
    )
    addHorizontalPolygon(draft, [corner.filletCentre, ...arc], CURB_HEIGHT)
    meshes.push(finaliseDraft(draft))
  }

  return meshes
}

function curbMeshes(): MeshData[] {
  const meshes: MeshData[] = []
  // Each kerb run is the straight stretch of one street plus the fillet arc
  // that ends it, traversed in loop order so the wall normal (`up × segment`)
  // always points at the carriageway. Every corner arc belongs to one run.
  const runs: ReadonlyArray<{
    street: StreetName
    straight: readonly [Vec2, Vec2]
    corner: CornerName
  }> = [
    { street: 'north', straight: [v2(-BUILD_LINE, -BLOCK_HALF), v2(BUILD_LINE, -BLOCK_HALF)], corner: 'north-east' },
    { street: 'east', straight: [v2(BLOCK_HALF, -BUILD_LINE), v2(BLOCK_HALF, BUILD_LINE)], corner: 'south-east' },
    { street: 'south', straight: [v2(BUILD_LINE, BLOCK_HALF), v2(-BUILD_LINE, BLOCK_HALF)], corner: 'south-west' },
    { street: 'west', straight: [v2(-BLOCK_HALF, BUILD_LINE), v2(-BLOCK_HALF, -BUILD_LINE)], corner: 'north-west' },
  ]

  for (const run of runs) {
    const corner = cornerByName(run.corner)
    const straightEnd = at(run.straight, 1)
    const tangentAlong = samePoint(straightEnd, corner.kerbTangentAlong)
    const arcEnd = tangentAlong ? corner.kerbTangentAcross : corner.kerbTangentAlong
    const arc = arcPointsBetween(corner.filletCentre, corner.radius, straightEnd, arcEnd)
    const path = [at(run.straight, 0), straightEnd, ...arc.slice(1)]
    const draft = createDraft(`curb:${run.street}`, 'curbs', 'curb', true)
    for (let index = 0; index + 1 < path.length; index += 1) {
      addVerticalWall(draft, at(path, index), at(path, index + 1), 0, CURB_HEIGHT)
    }
    meshes.push(finaliseDraft(draft))
  }

  return meshes
}

function crosswalkMeshes(detail: number): MeshData[] {
  const meshes: MeshData[] = []
  const barCount = decorationCount(16, detail, 6)

  for (const plan of crosswalkPlans()) {
    const draft = createDraft(plan.name, 'crosswalks', 'crosswalk', true)
    const pitch = plan.span / barCount
    const halfBand = plan.width / 2
    for (let bar = 0; bar < barCount; bar += 1) {
      const alongCentre = plan.kerbCoordinate + plan.directionSign * pitch * (bar + 0.5)
      const alongHalf = pitch * 0.25
      const rect: Vec2[] =
        plan.crossAxis === 'x'
          ? groundRect(
              v2(alongCentre - alongHalf, plan.bandCentre - halfBand),
              v2(alongCentre + alongHalf, plan.bandCentre + halfBand),
            )
          : groundRect(
              v2(plan.bandCentre - halfBand, alongCentre - alongHalf),
              v2(plan.bandCentre + halfBand, alongCentre + alongHalf),
            )
      addHorizontalPolygon(draft, rect, MARKING_LIFT)
    }
    meshes.push(finaliseDraft(draft))
  }

  return meshes
}

/**
 * Manhole covers and kerbside drainage grates.
 *
 * Counts are fixed so mesh names stay stable across quality tiers: a content
 * layer that dresses `drain:north:3` in 1945 still finds it in 2055.
 */
function drainageMeshes(rng: Rng): MeshData[] {
  const meshes: MeshData[] = []
  const manholesPerStreet = 2
  const drainPairsPerStreet = 2

  for (const street of STREETS) {
    for (let index = 0; index < manholesPerStreet; index += 1) {
      const along = round((index * 2 - (manholesPerStreet - 1)) * 22 + rng.float(-1.5, 1.5))
      const centre = streetPoint2(street, along, rng.float(-1.2, 1.2))
      const draft = createDraft(`manhole:${street.name}:${index + 1}`, 'drainage', 'metal', true)
      const radius = 0.45
      const segments = 12
      const cover = arcPoints(centre, radius, 0, Math.PI * 2, segments).slice(0, segments)
      addHorizontalPolygon(draft, cover, MARKING_LIFT + 0.006)
      const inner = arcPoints(centre, radius * 0.55, 0, Math.PI * 2, segments).slice(0, segments)
      for (let step = 0; step < segments; step += 1) {
        addHorizontalPolygon(
          draft,
          [
            at(cover, step),
            at(cover, (step + 1) % segments),
            at(inner, (step + 1) % segments),
            at(inner, step),
          ],
          MARKING_LIFT + 0.012,
        )
      }
      meshes.push(finaliseDraft(draft))
    }

    for (let pair = 0; pair < drainPairsPerStreet; pair += 1) {
      const along = round(
        ((pair + 0.5) * (MARKING_CLEAR_ZONE * 2)) / drainPairsPerStreet - MARKING_CLEAR_ZONE,
      )
      for (const side of [1, -1] as const) {
        const offset = side * (LANE_OFFSETS.parking + PARKING_WIDTH / 2 - 0.45)
        const centre = streetPoint2(street, along, offset)
        const index = pair * 2 + (side === 1 ? 1 : 2)
        const draft = createDraft(
          `drain:${street.name}:${index}`,
          'drainage',
          'metal',
          true,
        )
        const alongHalf = 0.6
        const acrossHalf = 0.25
        const frame: Vec2[] =
          street.axis === 'x'
            ? groundRect(
                v2(centre.x - alongHalf, centre.z - acrossHalf),
                v2(centre.x + alongHalf, centre.z + acrossHalf),
              )
            : groundRect(
                v2(centre.x - acrossHalf, centre.z - alongHalf),
                v2(centre.x + acrossHalf, centre.z + alongHalf),
              )
        addHorizontalPolygon(draft, frame, MARKING_LIFT + 0.006)
        for (let slot = 0; slot < 3; slot += 1) {
          const slotCentre = -0.3 + slot * 0.3
          const slotRect: Vec2[] =
            street.axis === 'x'
              ? groundRect(
                  v2(centre.x + slotCentre - 0.05, centre.z - acrossHalf * 0.6),
                  v2(centre.x + slotCentre + 0.05, centre.z + acrossHalf * 0.6),
                )
              : groundRect(
                  v2(centre.x - acrossHalf * 0.6, centre.z + slotCentre - 0.05),
                  v2(centre.x + acrossHalf * 0.6, centre.z + slotCentre + 0.05),
                )
          addHorizontalPolygon(draft, slotRect, MARKING_LIFT + 0.012)
        }
        meshes.push(finaliseDraft(draft))
      }
    }
  }

  return meshes
}

/**
 * Canonical mesh order: mesh group, then material key, then name. Sorting here
 * means harness counts and determinism hashes never depend on construction
 * order.
 */
export function sortShellMeshes(meshes: readonly MeshData[]): MeshData[] {
  const groupOrder = new Map<MeshGroup, number>(MESH_GROUPS.map((group, index) => [group, index]))
  const materialOrder = new Map<MaterialKey, number>(MATERIAL_KEYS.map((key, index) => [key, index]))
  return [...meshes].sort((left, right) => {
    const leftGroup = groupOrder.get(left.group) ?? 0
    const rightGroup = groupOrder.get(right.group) ?? 0
    if (leftGroup !== rightGroup) return leftGroup - rightGroup
    const leftMaterial = materialOrder.get(left.materialKey) ?? 0
    const rightMaterial = materialOrder.get(right.materialKey) ?? 0
    if (leftMaterial !== rightMaterial) return leftMaterial - rightMaterial
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  })
}

/**
 * The raised deck under the parcel grid: one quad per parcel cell. The cells
 * tile the 112 × 112 m parcel zone exactly, so the deck has no gaps and no
 * overlaps, and it meets the sidewalk ring at the build line.
 */
export function buildParcelDeckMeshes(parcels: readonly Parcel[]): MeshData[] {
  return parcels.map((parcel) => {
    const draft = createDraft(`surface:parcel:${parcel.id}`, 'parcels', 'ground', false)
    addHorizontalPolygon(draft, groundRect(parcel.cell.min, parcel.cell.max), BLOCK_DECK_HEIGHT)
    return finaliseDraft(draft)
  })
}

/**
 * Builds the static road shell, in {@link MESH_GROUPS} order: road surfaces,
 * lane strips, parking strips, sidewalks, curbs, crosswalks and drainage
 * detail. `detail` only scales decoration counts (crosswalk bars and lane
 * divider dashes), never mesh identity or mesh names. The parcel deck is built
 * separately by {@link buildParcelDeckMeshes} so this module stays independent
 * of the parcel grid.
 */
export function buildRoadMeshes(detail: number, rng: Rng): MeshData[] {
  return sortShellMeshes([
    ...roadSurfaceMeshes(),
    ...laneStripMeshes(detail),
    ...parkingStripMeshes(),
    ...sidewalkMeshes(),
    ...curbMeshes(),
    ...crosswalkMeshes(detail),
    ...drainageMeshes(rng),
  ])
}

/** Total triangles across the shell meshes of a layout. */
export function countMeshTriangles(layout: Pick<BlockLayout, 'meshes'>): number {
  return layout.meshes.reduce((total, mesh) => total + mesh.triangles, 0)
}
