/**
 * Era road markings and lane configuration.
 *
 * The layout owns the carriageway, its four lane centres and its kerbside
 * parking strips; this module paints the *period* onto that frozen geometry
 * without touching the layout module:
 *
 * | era  | paint                                                        |
 * | ---- | ------------------------------------------------------------ |
 * | 1945 | nothing painted, two steel rails in the kerb lane             |
 * | 1965 | centre line plus kerbside parking lanes on both sides         |
 * | 1985 | wider lanes, lane division and turn arrows                    |
 * | 2005 | cycle-lane striping and a far-side parking lane               |
 * | 2025 | cycle lane, charging stencils and pedestrian-priority bands   |
 *
 * Everything here is pure data: pieces are convex outlines in local metres
 * (`x` across the street, `z` along it) placed with a world position and a yaw,
 * and each feature group is merged into one flat position/index pair. The
 * three.js bridge in `models.ts` turns that into one mesh per group, and the
 * unit suite can assert geometry without a renderer.
 */

import {
  BLOCK_HALF,
  LANE_OFFSETS,
  LANE_WIDTH,
  MARKING_CLEAR_ZONE,
  MARKING_LIFT,
  PARKING_BAY_COUNT,
  PARKING_BAY_PITCH,
  PARKING_WIDTH,
  ROAD_HALF,
  STREETS,
  parkingBayCentre,
  streetByName,
  streetPoint,
  type StreetName,
  type Vec2,
  type Vec3,
} from '../layout'
import {
  MARKING_FEATURE_KINDS,
  type EraVehiclePlan,
  type MarkingFeatureKind,
  type MarkingGeometry,
  type MarkingGroupMesh,
  type MarkingPiece,
} from './types'

/* ------------------------------------------------------------------------- *\
 * Marking geometry constants (all derived from the frozen layout)
 * ------------------------------------------------------------------------- */

/**
 * Offset of the cycle lane from the street centre line, on the block side.
 *
 * The lane sits in the outer third of the kerb lane: clear of the kerbside
 * parking strip (which starts at `ROAD_HALF - PARKING_WIDTH`) and clear of the
 * travel lane the cars keep to, so bicycles, parked cars and traffic never
 * share a band.
 */
export const BIKE_LANE_OFFSET = LANE_OFFSETS.kerb + 0.9

/** Width of the painted cycle band. */
export const BIKE_LANE_WIDTH = 1.0

/**
 * Lateral offset of a micro-mobility rider from the kerb-lane spline, positive
 * toward the block. Zero in eras without a cycle lane, where bikes keep to the
 * kerb lane itself.
 */
export const BIKE_LANE_LATERAL_OFFSET = BIKE_LANE_OFFSET - LANE_OFFSETS.kerb

/** Boundary line between two travel lanes of a multi-lane era. */
export const LANE_DIVISION_OFFSET = LANE_OFFSETS.inner + LANE_WIDTH / 2

/** Boundary line between the kerbside parking lane and the travel lane. */
export const PARKING_LANE_OFFSET = ROAD_HALF - PARKING_WIDTH

/** Dash geometry shared by the dashed line groups, in metres. */
export const MARKING_DASH = { width: 0.16, length: 3, pitch: 8 } as const

/** Solid-line segment length used by the cycle-lane striping. */
export const MARKING_SOLID = { width: 0.14, segment: 26, gap: 3 } as const

/** Turn-arrow geometry, in metres. */
export const TURN_ARROW = { shaftWidth: 0.32, shaftLength: 2.6, headWidth: 0.95, headLength: 1.1 } as const

/** Pedestrian-priority band geometry across the carriageway. */
export const PEDESTRIAN_BAND = { halfWidth: ROAD_HALF - 0.4, halfLength: 1.3 } as const

/** Streetcar rail strip geometry. */
export const RAIL_STRIP = { width: 0.14, lift: MARKING_LIFT + 0.02 } as const

/** Height of a painted piece above the road surface. */
export const PAINT_LIFT = MARKING_LIFT

/** Bays between two charging stencils on a strip. */
export const CHARGING_BAY_STRIDE = 3

/** Charging stencils painted per parking strip in the eras that declare them. */
export const CHARGING_POINTS_PER_STRIP = 6

/** Half a parking bay pitch, used to close the bay-tick run. */
const PARKING_BAY_PITCH_HALF = PARKING_BAY_PITCH / 2

/* ------------------------------------------------------------------------- *\
 * Outline helpers (local metres: x across, z along)
 * ------------------------------------------------------------------------- */

/** Rectangle outline centred on the piece origin. */
function quad(halfWidth: number, halfLength: number): Vec2[] {
  return [
    { x: -halfWidth, z: -halfLength },
    { x: halfWidth, z: -halfLength },
    { x: halfWidth, z: halfLength },
    { x: -halfWidth, z: halfLength },
  ]
}

/** Triangle outline pointing along local `+z`. */
function arrowHead(halfWidth: number, length: number): Vec2[] {
  return [
    { x: -halfWidth, z: -length / 2 },
    { x: halfWidth, z: -length / 2 },
    { x: 0, z: length / 2 },
  ]
}

/** Yaw that aligns a piece's local `+z` with a street's along-axis direction. */
function streetYaw(street: (typeof STREETS)[number]): number {
  return Math.atan2(street.direction.x, street.direction.z)
}

/** World origin of a piece: a street position lifted just above the asphalt. */
function pieceOrigin(street: (typeof STREETS)[number], along: number, offset: number, lift: number): Vec3 {
  const point = streetPoint(street, along, offset)
  return { x: point.x, y: lift, z: point.z }
}

interface PieceInput {
  readonly group: MarkingFeatureKind
  readonly street: StreetName
  readonly index: number
  readonly along: number
  readonly offset: number
  readonly corners: readonly Vec2[]
  readonly colour: string
  readonly lift: number
  readonly raised: boolean
  readonly opacity: number
}

function piece(input: PieceInput): MarkingPiece {
  const street = streetByName(input.street)
  return {
    name: `marking:${input.group}:${input.street}:${input.index}`,
    group: input.group,
    street: input.street,
    position: pieceOrigin(street, input.along, input.offset, input.lift),
    rotationY: streetYaw(street),
    corners: input.corners,
    colour: input.colour,
    lift: input.lift,
    raised: input.raised,
    opacity: input.opacity,
  }
}

/* ------------------------------------------------------------------------- *\
 * Per-feature generators
 * ------------------------------------------------------------------------- */

/** Along-axis coordinates of the dashed segments on a marking run. */
function dashCoordinates(span: number, pitch: number): number[] {
  const coordinates: number[] = []
  const count = Math.max(1, Math.floor((span * 2) / pitch))
  for (let index = 0; index < count; index += 1) {
    coordinates.push(-span + (pitch * (index + 0.5)))
  }
  return coordinates
}

/** Along-axis coordinates of the solid-line segments on a marking run. */
function solidCoordinates(span: number, segment: number, gap: number): number[] {
  const stride = segment + gap
  const coordinates: number[] = []
  const count = Math.max(1, Math.floor((span * 2) / stride))
  for (let index = 0; index < count; index += 1) {
    coordinates.push(-span + stride * index + segment / 2)
  }
  return coordinates
}

interface GeneratorContext {
  readonly plan: EraVehiclePlan
  readonly weight: number
}

/** Dashed centre line down the middle of the carriageway. */
function centreLinePieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  for (const street of STREETS) {
    dashCoordinates(MARKING_CLEAR_ZONE, MARKING_DASH.pitch).forEach((along, index) => {
      pieces.push(
        piece({
          group: 'centre-line',
          street: street.name,
          index,
          along,
          offset: 0,
          corners: quad(MARKING_DASH.width / 2, MARKING_DASH.length / 2),
          colour: plan.markings.colour,
          lift: PAINT_LIFT,
          raised: false,
          opacity: plan.markings.paintOpacity,
        }),
      )
    })
  }
  return pieces
}

/** Dashed division between two travel lanes on each side of the centre line. */
function laneDivisionPieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  if (plan.laneConfiguration.travelLanesPerDirection < 2) {
    return pieces
  }
  for (const street of STREETS) {
    const coordinates = dashCoordinates(MARKING_CLEAR_ZONE, MARKING_DASH.pitch * 1.5)
    for (const sign of [1, -1] as const) {
      coordinates.forEach((along, index) => {
        pieces.push(
          piece({
            group: 'lane-division',
            street: street.name,
            index: index + (sign === 1 ? 0 : coordinates.length),
            along,
            offset: sign * LANE_DIVISION_OFFSET,
            corners: quad(MARKING_DASH.width / 2, MARKING_DASH.length / 2),
            colour: plan.markings.colour,
            lift: PAINT_LIFT,
            raised: false,
            opacity: plan.markings.paintOpacity,
          }),
        )
      })
    }
  }
  return pieces
}

/** Parking-lane boundary plus one tick between neighbouring bays. */
function parkingLanePieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  // One boundary on the published bay side, or both kerbs in the eras that
  // paint parking on each side of the street.
  const sides: readonly (1 | -1)[] = plan.laneConfiguration.parkingLanes === 2 ? [1, -1] : [1]
  for (const street of STREETS) {
    for (const sign of sides) {
      const boundary = dashCoordinates(MARKING_CLEAR_ZONE, MARKING_DASH.pitch * 1.5)
      boundary.forEach((along, index) => {
        pieces.push(
          piece({
            group: 'parking-lane',
            street: street.name,
            index: index + (sign === 1 ? 0 : boundary.length),
            along,
            offset: sign * PARKING_LANE_OFFSET,
            corners: quad(MARKING_DASH.width / 2, MARKING_DASH.length / 2),
            colour: plan.markings.colour,
            lift: PAINT_LIFT,
            raised: false,
            opacity: plan.markings.paintOpacity,
          }),
        )
      })
      for (let bay = 0; bay <= PARKING_BAY_COUNT; bay += 1) {
        const along =
          bay === 0
            ? parkingBayCentre(0) - PARKING_BAY_PITCH_HALF
            : bay === PARKING_BAY_COUNT
              ? parkingBayCentre(PARKING_BAY_COUNT - 1) + PARKING_BAY_PITCH_HALF
              : (parkingBayCentre(bay - 1) + parkingBayCentre(bay)) / 2
        pieces.push(
          piece({
            group: 'parking-lane',
            street: street.name,
            index: boundary.length * 2 + bay + (sign === 1 ? 0 : PARKING_BAY_COUNT + 1),
            along,
            offset: sign * LANE_OFFSETS.parking,
            corners: quad(PARKING_WIDTH / 2 - 0.05, 0.08),
            colour: plan.markings.colour,
            lift: PAINT_LIFT,
            raised: false,
            opacity: plan.markings.paintOpacity,
          }),
        )
      }
    }
  }
  return pieces
}

/** Two solid lines plus direction chevrons marking the cycle lane. */
function bikeLanePieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  for (const street of STREETS) {
    const edges = [
      BIKE_LANE_OFFSET - BIKE_LANE_WIDTH / 2,
      BIKE_LANE_OFFSET + BIKE_LANE_WIDTH / 2,
    ]
    edges.forEach((offset, edge) => {
      solidCoordinates(MARKING_CLEAR_ZONE, MARKING_SOLID.segment, MARKING_SOLID.gap).forEach(
        (along, index) => {
          pieces.push(
            piece({
              group: 'bike-lane',
              street: street.name,
              index: edge * 100 + index,
              along,
              offset,
              corners: quad(MARKING_SOLID.width / 2, MARKING_SOLID.segment / 2),
              colour: plan.markings.colour,
              lift: PAINT_LIFT,
              raised: false,
              opacity: plan.markings.paintOpacity,
            }),
          )
        },
      )
    })
    const chevrons = [-MARKING_CLEAR_ZONE * 0.6, 0, MARKING_CLEAR_ZONE * 0.6]
    chevrons.forEach((along, index) => {
      pieces.push(
        piece({
          group: 'bike-lane',
          street: street.name,
          index: 500 + index,
          along,
          offset: BIKE_LANE_OFFSET,
          corners: arrowHead(BIKE_LANE_WIDTH * 0.34, BIKE_LANE_WIDTH * 0.7),
          colour: plan.markings.colour,
          lift: PAINT_LIFT,
          raised: false,
          opacity: plan.markings.paintOpacity,
        }),
      )
    })
  }
  return pieces
}

/** Turn arrows in the inner lane of each approach. */
function turnArrowPieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  for (const street of STREETS) {
    const approaches = [-(MARKING_CLEAR_ZONE - 10), MARKING_CLEAR_ZONE - 24]
    for (const sign of [1, -1] as const) {
      approaches.forEach((along, index) => {
        const base = index * 2 + (sign === 1 ? 0 : 1)
        pieces.push(
          piece({
            group: 'turn-arrow',
            street: street.name,
            index: base * 2,
            along,
            offset: sign * LANE_OFFSETS.inner,
            corners: quad(TURN_ARROW.shaftWidth / 2, TURN_ARROW.shaftLength / 2),
            colour: plan.markings.colour,
            lift: PAINT_LIFT,
            raised: false,
            opacity: plan.markings.paintOpacity,
          }),
        )
        pieces.push(
          piece({
            group: 'turn-arrow',
            street: street.name,
            index: base * 2 + 1,
            along: along + TURN_ARROW.shaftLength / 2 + TURN_ARROW.headLength / 2,
            offset: sign * LANE_OFFSETS.inner,
            corners: arrowHead(TURN_ARROW.headWidth / 2, TURN_ARROW.headLength),
            colour: plan.markings.colour,
            lift: PAINT_LIFT,
            raised: false,
            opacity: plan.markings.paintOpacity,
          }),
        )
      })
    }
  }
  return pieces
}

/** Two steel rails in the kerb lane: the streetcar's physical marking. */
function streetcarRailPieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  const halfGauge = plan.markings.railGaugeM / 2
  for (const street of STREETS) {
    for (const side of [-1, 1] as const) {
      solidCoordinates(MARKING_CLEAR_ZONE, MARKING_SOLID.segment, MARKING_SOLID.gap).forEach(
        (along, index) => {
          pieces.push(
            piece({
              group: 'streetcar-rail',
              street: street.name,
              index: (side === 1 ? 0 : 1) * 100 + index,
              along,
              // The rails sit in the block-side kerb lane, at track gauge.
              offset: LANE_OFFSETS.kerb + side * halfGauge,
              corners: quad(RAIL_STRIP.width / 2, MARKING_SOLID.segment / 2),
              colour: plan.markings.railColour,
              lift: RAIL_STRIP.lift,
              raised: true,
              opacity: 1,
            }),
          )
        },
      )
    }
  }
  return pieces
}

/** Charging stencils at regular far-side parking bays. */
function chargingPointPieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  const perStrip = CHARGING_POINTS_PER_STRIP
  for (const street of STREETS) {
    for (let index = 0; index < perStrip; index += 1) {
      const bay = Math.min(PARKING_BAY_COUNT - 1, index * CHARGING_BAY_STRIDE + 1)
      pieces.push(
        piece({
          group: 'charging-point',
          street: street.name,
          index,
          along: parkingBayCentre(bay),
          offset: -LANE_OFFSETS.parking,
          corners: quad(PARKING_WIDTH / 2 - 0.15, 2.1),
          colour: plan.palette.accent,
          lift: PAINT_LIFT,
          raised: false,
          opacity: plan.markings.paintOpacity,
        }),
      )
      pieces.push(
        piece({
          group: 'charging-point',
          street: street.name,
          index: perStrip + index,
          along: parkingBayCentre(bay),
          offset: -LANE_OFFSETS.parking,
          corners: quad(0.18, 0.55),
          colour: plan.markings.colour,
          lift: PAINT_LIFT + 0.002,
          raised: false,
          opacity: plan.markings.paintOpacity,
        }),
      )
    }
  }
  return pieces
}

/** Pedestrian-priority bands painted across the carriageway at each approach. */
function pedestrianPriorityPieces(context: GeneratorContext): MarkingPiece[] {
  const { plan } = context
  const pieces: MarkingPiece[] = []
  for (const street of STREETS) {
    const approaches = [BLOCK_HALF + 6, -(BLOCK_HALF + 6)]
    approaches.forEach((along, index) => {
      pieces.push(
        piece({
          group: 'pedestrian-priority',
          street: street.name,
          index,
          along,
          offset: 0,
          corners: quad(PEDESTRIAN_BAND.halfWidth, PEDESTRIAN_BAND.halfLength),
          colour: plan.palette.accent,
          lift: PAINT_LIFT,
          raised: false,
          opacity: plan.markings.paintOpacity * 0.55,
        }),
      )
    })
  }
  return pieces
}

/** One generator per marking feature, in catalogue order. */
const FEATURE_GENERATORS: Readonly<Record<MarkingFeatureKind, (context: GeneratorContext) => MarkingPiece[]>> = {
  'centre-line': centreLinePieces,
  'lane-division': laneDivisionPieces,
  'parking-lane': parkingLanePieces,
  'bike-lane': bikeLanePieces,
  'turn-arrow': turnArrowPieces,
  'streetcar-rail': streetcarRailPieces,
  'charging-point': chargingPointPieces,
  'pedestrian-priority': pedestrianPriorityPieces,
}

/**
 * Thins a piece list to a paint weight by keeping every `1/weight`-th piece,
 * so a cross-fading era does not simply paint half a street.
 */
function spreadSubset(pieces: readonly MarkingPiece[], weight: number): MarkingPiece[] {
  if (weight >= 1) {
    return [...pieces]
  }
  if (weight <= 0 || pieces.length === 0) {
    return []
  }
  const keep = Math.max(1, Math.round(pieces.length * weight))
  if (keep >= pieces.length) {
    return [...pieces]
  }
  const stride = pieces.length / keep
  return pieces.filter((_, index) => Math.floor(index / stride) !== Math.floor((index - 1) / stride))
}

/* ------------------------------------------------------------------------- *\
 * Merge and public builder
 * ------------------------------------------------------------------------- */

const ORDERED_KINDS: readonly MarkingFeatureKind[] = MARKING_FEATURE_KINDS

/**
 * Fan-triangulates convex marking outlines into flat position/index arrays,
 * rotated into world space. Pure data: the three.js bridge swaps it into a
 * buffer geometry without knowing anything about marking styles.
 */
export function mergeMarkingPieces(pieces: readonly MarkingPiece[]): {
  readonly positions: number[]
  readonly indices: number[]
} {
  const positions: number[] = []
  const indices: number[] = []
  for (const entry of pieces) {
    const base = positions.length / 3
    const cos = Math.cos(entry.rotationY)
    const sin = Math.sin(entry.rotationY)
    for (const corner of entry.corners) {
      // Local (x across, z along) rotated by the street yaw.
      positions.push(
        entry.position.x + corner.x * cos + corner.z * sin,
        entry.position.y,
        entry.position.z - corner.x * sin + corner.z * cos,
      )
    }
    for (let vertex = 1; vertex < entry.corners.length - 1; vertex += 1) {
      indices.push(base, base + vertex, base + vertex + 1)
    }
  }
  return { positions, indices }
}

/** Merges the pieces of one group into a flat, fan-triangulated mesh. */
function mergeGroup(group: MarkingFeatureKind, pieces: readonly MarkingPiece[]): MarkingGroupMesh {
  const merged = mergeMarkingPieces(pieces)
  return {
    group,
    positions: merged.positions,
    indices: merged.indices,
    triangles: merged.indices.length / 3,
    pieces: pieces.length,
  }
}

/**
 * Builds the complete marking geometry of a plan.
 *
 * Every feature the plan declares is generated from the frozen layout
 * constants and then thinned by the feature's paint weight, so a staged era
 * switch loses and gains paint gradually while a settled era paints all of it.
 */
export function buildMarkingGeometry(plan: EraVehiclePlan): MarkingGeometry {
  const pieces: MarkingPiece[] = []
  const groupCounts: Record<string, number> = {}
  const groups: MarkingGroupMesh[] = []

  for (const kind of ORDERED_KINDS) {
    if (!plan.markings.features.includes(kind)) {
      continue
    }
    const weight = plan.markings.featureWeights[kind] ?? 1
    const generated = FEATURE_GENERATORS[kind]({ plan, weight })
    const kept = spreadSubset(generated, weight)
    if (kept.length === 0) {
      continue
    }
    groups.push(mergeGroup(kind, kept))
    groupCounts[kind] = kept.length
    pieces.push(...kept)
  }

  return { pieces, groups, groupCounts }
}

/**
 * Stable signature of a marking configuration: the sorted group names with
 * their piece counts, so two eras with the same paint and the same density
 * compare equal and every era compares different from the others.
 */
export function markingSignature(geometry: MarkingGeometry): string {
  return Object.entries(geometry.groupCounts)
    .filter(([, count]) => count > 0)
    .map(([group]) => group)
    .sort()
    .join('+')
}

/** Number of painted (non-rail) pieces in a geometry. */
export function paintedPieceCount(geometry: MarkingGeometry): number {
  return geometry.pieces.filter((entry) => !entry.raised).length
}
