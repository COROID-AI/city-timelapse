/**
 * Flat, uniquely named anchor catalogue of the canonical block.
 *
 * Content layers never search geometry: they ask the catalogue for a name and
 * attach their era-specific props, signs, lights and figures there. Names follow
 * the scheme documented in `types.ts` and are stable for the lifetime of the
 * project — a name is never renumbered, even if generation internals change.
 *
 * | role              | name pattern                     | count                       |
 * | ----------------- | -------------------------------- | --------------------------- |
 * | storefront bays   | `parcel:<id>:storefront:<n>`     | one per retail bay          |
 * | sign mounts       | `parcel:<id>:sign:<n>`           | one per bay + one per edge  |
 * | prop points       | `parcel:<id>:prop:<n>`           | 2 per parcel                |
 * | inspection focus  | `parcel:<id>:inspect:<n>`        | 1 per parcel                |
 * | light posts       | `street:<street>:light:<n>`      | 4 per street                |
 * | hydrants          | `street:<street>:hydrant:<n>`    | 1 per street                |
 * | utility endpoints | `street:<street>:utility:<n>`    | 4 per street                |
 * | parking bays      | `street:<street>:parking-bay:<n>`| 17 per parking strip        |
 * | signal heads      | `corner:<corner>:signal:<n>`     | 2 per corner                |
 * | inspection focus  | `corner:<corner>:inspect:<n>`    | 1 per corner apron          |
 *
 * Anchor heights are real metres in the frozen coordinate system: the deck
 * anchors (bays, props, posts, hydrants, signals) stand on `y = CURB_HEIGHT`,
 * the rooftop prop sits at the parcel's maximum height, and the carriageway
 * anchors (parking bays, the corner apron focus) sit on `y = 0`.
 */

import type { Rng } from '../../lib/rng'
import {
  BLOCK_DECK_HEIGHT,
  BLOCK_HALF,
  LANE_OFFSETS,
  PARKING_WIDTH,
  ROAD_HALF,
  round,
  streetPoint,
  v2,
  v3,
  type Anchor,
  type FootprintRect,
  type Parcel,
  type StreetName,
  type UtilityLine,
  type Vec2,
  type Vec3,
} from './types'
import { CORNERS, PARKING_BAY_COUNT, PARKING_BAY_PITCH, STREETS, streetByName, parkingBayCentre } from './roads'

/** Distance from the kerb to the base of a light post. */
const LIGHT_INSET = 0.75

/** Distance from the kerb to a hydrant. */
const HYDRANT_INSET = 0.9

/** Distance from the kerb to a signal head pole. */
const SIGNAL_INSET = 0.8

/** Mounting height of a signal head above the sidewalk deck. */
const SIGNAL_HEIGHT = 5.2

/** Height of facade signage above the sidewalk deck. */
const SIGN_HEIGHT = { fascia: 5.2, projecting: 6.6 } as const

/** Pole-top height of an overhead utility line above the deck. */
const UTILITY_HEIGHT = 9

/** Along-street coordinates of the light and utility posts. */
const POST_POSITIONS = [-42, -14, 14, 42] as const

/** Along-street coordinate of the hydrant on every street. */
const HYDRANT_POSITION = -20

/** Along-street distance from a corner to its signal head pole. */
const SIGNAL_INSET_ALONG = 2.5

/** Click of the deterministic street-level prop jitter, in metres. */
const PROP_JITTER = 0.35

/** Outward normal of every street, on the ground plane. */
const OUTWARD: Readonly<Record<StreetName, Vec2>> = {
  north: v2(0, -1),
  east: v2(1, 0),
  south: v2(0, 1),
  west: v2(-1, 0),
}

/**
 * Facade edges run clockwise around a footprint (seen with north up), which is
 * what makes bay numbering stable across runs.
 */
const FACADE_EDGE: Readonly<
  Record<
    StreetName,
    {
      readonly start: (footprint: FootprintRect) => Vec2
      readonly direction: Vec2
      readonly length: (footprint: FootprintRect) => number
    }
  >
> = {
  north: { start: (f) => v2(f.min.x, f.min.z), direction: v2(1, 0), length: (f) => f.width },
  east: { start: (f) => v2(f.max.x, f.min.z), direction: v2(0, 1), length: (f) => f.depth },
  south: { start: (f) => v2(f.max.x, f.max.z), direction: v2(-1, 0), length: (f) => f.width },
  west: { start: (f) => v2(f.min.x, f.max.z), direction: v2(0, -1), length: (f) => f.depth },
}

function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

/** Point `inset` metres inside the kerb of a street, at `height` metres up. */
function onSidewalk(streetName: StreetName, along: number, inset: number, height: number): Vec3 {
  const point = streetPoint(streetByName(streetName), along, ROAD_HALF + inset)
  return v3(round(point.x), round(height), round(point.z))
}

/** Parcel anchors: storefront bays, sign mounts, prop points and inspection focus. */
function parcelAnchors(parcel: Parcel, rng: Rng): Anchor[] {
  const anchors: Anchor[] = []
  const owner = { kind: 'parcel' as const, id: parcel.id }
  // One deterministic jitter per parcel, consumed in parcel order.
  const jitter = round(rng.float(-PROP_JITTER, PROP_JITTER), 3)

  for (const bay of parcel.bays) {
    anchors.push({
      name: bay.name,
      kind: 'storefront-bay',
      owner,
      position: v3(bay.centre.x, BLOCK_DECK_HEIGHT, bay.centre.z),
      normal: bay.normal,
      size: { width: bay.width, height: bay.height },
      facing: bay.street,
      tags: ['ground-floor', 'street-facing'],
    })

    // One fascia sign mount per bay, a quarter metre proud of the facade so a
    // content layer can hang a shroud, a lit box or a painted board on it.
    anchors.push({
      name: `parcel:${parcel.id}:sign:${bay.index}`,
      kind: 'sign-mount',
      owner,
      position: v3(
        round(bay.centre.x + bay.normal.x * 0.25),
        round(BLOCK_DECK_HEIGHT + SIGN_HEIGHT.fascia),
        round(bay.centre.z + bay.normal.z * 0.25),
      ),
      normal: bay.normal,
      size: { width: round(bay.width * 0.8), height: 0.9 },
      facing: bay.street,
      tags: ['fascia', 'ground-floor'],
    })
  }

  // One projecting blade sign per street-facing edge, 30 % along the edge and
  // 1.1 m clear of the facade, so it reads from both directions of the street.
  parcel.facing.forEach((street, edgeIndex) => {
    const edge = FACADE_EDGE[street]
    const start = edge.start(parcel.footprint)
    const along = edge.length(parcel.footprint) * 0.3
    const outward = OUTWARD[street]
    anchors.push({
      name: `parcel:${parcel.id}:sign:${parcel.bays.length + edgeIndex + 1}`,
      kind: 'sign-mount',
      owner,
      position: v3(
        round(start.x + edge.direction.x * along + outward.x * 1.1),
        round(BLOCK_DECK_HEIGHT + SIGN_HEIGHT.projecting),
        round(start.z + edge.direction.z * along + outward.z * 1.1),
      ),
      normal: v3(outward.x, 0, outward.z),
      size: { width: 1.4, height: 2.2 },
      facing: street,
      tags: ['projecting', 'blade'],
    })
  })

  const centre = v2(
    round((parcel.footprint.min.x + parcel.footprint.max.x) / 2),
    round((parcel.footprint.min.z + parcel.footprint.max.z) / 2),
  )
  const firstBay = parcel.bays.find((bay) => bay.index === 1)
  const propBase = firstBay === undefined ? centre : firstBay.centre
  const propNormal = firstBay === undefined ? v3(0, 1, 0) : firstBay.normal
  // Slide the street-level prop along the facade so neighbouring parcels do not
  // stack their props on one pixel; the tangent of the normal is (-z, x).
  const propPosition = firstBay === undefined
    ? v3(propBase.x, BLOCK_DECK_HEIGHT, propBase.z)
    : v3(
        round(propBase.x - firstBay.normal.z * jitter),
        BLOCK_DECK_HEIGHT,
        round(propBase.z + firstBay.normal.x * jitter),
      )

  anchors.push({
    name: `parcel:${parcel.id}:prop:1`,
    kind: 'prop-point',
    owner,
    position: v3(centre.x, round(BLOCK_DECK_HEIGHT + parcel.capacity.maxHeight), centre.z),
    normal: v3(0, 1, 0),
    size: { width: parcel.footprint.width, height: parcel.footprint.depth },
    facing: null,
    tags: ['rooftop', 'service'],
  })
  anchors.push({
    name: `parcel:${parcel.id}:prop:2`,
    kind: 'prop-point',
    owner,
    position: propPosition,
    normal: propNormal,
    size: null,
    facing: firstBay === undefined ? null : firstBay.street,
    tags: ['street-level'],
  })
  anchors.push({
    name: `parcel:${parcel.id}:inspect:1`,
    kind: 'inspection-focus',
    owner,
    position: v3(
      centre.x,
      round(BLOCK_DECK_HEIGHT + parcel.capacity.maxHeight / 2),
      centre.z,
    ),
    normal: v3(0, 1, 0),
    size: null,
    facing: parcel.facing[0] ?? null,
    tags: ['inspection'],
  })

  return anchors
}

/** Street anchors: light posts, hydrants, utility endpoints and parking bays. */
function streetAnchors(streetName: StreetName): Anchor[] {
  const street = streetByName(streetName)
  const owner = { kind: 'street' as const, id: streetName }
  const anchors: Anchor[] = []

  POST_POSITIONS.forEach((along, index) => {
    anchors.push({
      name: `street:${streetName}:light:${index + 1}`,
      kind: 'light-post',
      owner,
      position: onSidewalk(streetName, along, LIGHT_INSET, BLOCK_DECK_HEIGHT),
      normal: v3(0, 1, 0),
      size: { width: 0.4, height: 8.5 },
      facing: streetName,
      tags: ['street-light', 'base'],
    })
  })

  anchors.push({
    name: `street:${streetName}:hydrant:1`,
    kind: 'hydrant',
    owner,
    position: onSidewalk(streetName, HYDRANT_POSITION, HYDRANT_INSET, BLOCK_DECK_HEIGHT),
    normal: v3(0, 1, 0),
    size: { width: 0.5, height: 1.1 },
    facing: streetName,
    tags: ['utility', 'emergency'],
  })

  POST_POSITIONS.forEach((along, index) => {
    anchors.push({
      name: `street:${streetName}:utility:${index + 1}`,
      kind: 'utility-endpoint',
      owner,
      position: onSidewalk(streetName, along, LIGHT_INSET + 0.15, BLOCK_DECK_HEIGHT + UTILITY_HEIGHT),
      normal: v3(0, 1, 0),
      size: { width: 0.35, height: UTILITY_HEIGHT },
      facing: streetName,
      tags: ['overhead-line', 'pole-top'],
    })
  })

  for (let index = 0; index < PARKING_BAY_COUNT; index += 1) {
    const along = parkingBayCentre(index)
    const across = street.centre + LANE_OFFSETS.parking * street.acrossSign
    anchors.push({
      name: `street:${streetName}:parking-bay:${index + 1}`,
      kind: 'parking-bay',
      owner,
      position:
        street.axis === 'x' ? v3(along, 0, round(across)) : v3(round(across), 0, along),
      // Bays face the block across the strip, so vehicles nose in from the road.
      normal: v3(-street.outward.x, 0, -street.outward.z),
      size: { width: PARKING_BAY_PITCH, height: PARKING_WIDTH },
      facing: streetName,
      tags: ['parking-strip'],
    })
  }

  return anchors
}

/** Corner anchors: one signal head per meeting street, plus the apron focus. */
function cornerAnchors(): Anchor[] {
  const anchors: Anchor[] = []

  for (const corner of CORNERS) {
    corner.streets.forEach((streetName, index) => {
      const street = streetByName(streetName)
      const alongSign = street.axis === 'x' ? corner.signX : corner.signZ
      const along = alongSign * (BLOCK_HALF - SIGNAL_INSET_ALONG)
      anchors.push({
        name: `corner:${corner.name}:signal:${index + 1}`,
        kind: 'signal-head',
        owner: { kind: 'corner', id: corner.name },
        position: onSidewalk(streetName, along, SIGNAL_INSET, BLOCK_DECK_HEIGHT + SIGNAL_HEIGHT),
        // The head faces oncoming block-side traffic, i.e. down the street.
        normal: v3(-street.direction.x, 0, -street.direction.z),
        size: { width: 0.35, height: 1.1 },
        facing: streetName,
        tags: ['traffic-signal'],
      })
    })

    anchors.push({
      name: `corner:${corner.name}:inspect:1`,
      kind: 'inspection-focus',
      owner: { kind: 'corner', id: corner.name },
      position: v3(
        corner.signX * (BLOCK_HALF - 1),
        0,
        corner.signZ * (BLOCK_HALF - 1),
      ),
      normal: v3(0, 1, 0),
      size: null,
      facing: at(corner.streets, 0),
      tags: ['inspection', 'corner-apron'],
    })
  }

  return anchors
}

/** Overhead utility runs between the poles of each street. */
function utilityLines(anchors: readonly Anchor[]): UtilityLine[] {
  const lines: UtilityLine[] = []
  for (const street of STREETS) {
    const poles = anchors
      .filter((anchor) => anchor.kind === 'utility-endpoint' && anchor.owner.id === street.name)
      .sort((left, right) => (left.name < right.name ? -1 : 1))
    for (let index = 0; index + 1 < poles.length; index += 1) {
      lines.push({
        name: `utility-line:${street.name}:${index + 1}`,
        street: street.name,
        from: at(poles, index).name,
        to: at(poles, index + 1).name,
        height: at(poles, index).position.y,
        sag: 0.35,
      })
    }
  }
  return lines
}

/** Everything the anchor catalogue plus utility runs need. */
export interface AnchorBundle {
  readonly anchors: readonly Anchor[]
  readonly utilityLines: readonly UtilityLine[]
}

/**
 * Builds the anchor catalogue.
 *
 * The catalogue is sorted by name so its order never depends on construction
 * order. Geometry places every structural anchor; `rng` only jitters the
 * street-level prop points, one draw per parcel in parcel order.
 */
export function buildAnchors(parcels: readonly Parcel[], rng: Rng): AnchorBundle {
  const anchors: Anchor[] = []
  for (const parcel of parcels) {
    anchors.push(...parcelAnchors(parcel, rng))
  }
  for (const street of STREETS) {
    anchors.push(...streetAnchors(street.name))
  }
  anchors.push(...cornerAnchors())

  const sorted = [...anchors].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )
  return { anchors: sorted, utilityLines: utilityLines(sorted) }
}
