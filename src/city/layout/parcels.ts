/**
 * Parcel grid of the canonical block.
 *
 * The parcel zone is the 112 × 112 m square inside the build line. A 4 × 4 grid
 * of 28 m cells tiles it exactly, so the union of the cells is the block and no
 * two cells overlap. Each cell gets deterministic building-line setbacks (tight
 * on the street frontage, generous toward the courtyard), a rectangular
 * footprint inside the cell, a building capacity record, and a run of
 * ground-floor storefront bays along every street-facing facade edge.
 *
 * Everything here is a pure function of the supplied generator: no ambient
 * randomness, no clock, and the draw order is fixed by the canonical
 * north → east → south → west edge order.
 */

import type { Rng } from '../../lib/rng'
import {
  BUILD_LINE,
  FLOOR_HEIGHT,
  GROUND_FLOOR_HEIGHT,
  PARCEL_COLUMNS,
  PARCEL_ROWS,
  PARCEL_SIZE,
  STOREFRONT_BAY_WIDTH,
  STREET_NAMES,
  clamp,
  round,
  v2,
  v3,
  type CornerName,
  type FootprintRect,
  type Parcel,
  type ParcelSetbacks,
  type StorefrontBay,
  type StreetName,
  type Vec2,
} from './types'

/** Setback range (metres) applied to a street-facing facade edge. */
const STREET_SETBACK = { min: 1.2, max: 2.6 } as const

/** Setback range (metres) applied to a courtyard / party-wall edge. */
const COURTYARD_SETBACK = { min: 3.5, max: 7.5 } as const

/** Height range (metres) per parcel role. */
const HEIGHT = {
  corner: { min: 20, max: 38 },
  street: { min: 12, max: 30 },
  interior: { min: 10, max: 20 },
} as const

/** Reads an index that the caller has already proven to be in range. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

/** Outward unit normal of a block-facing facade edge. */
const OUTWARD: Readonly<Record<StreetName, Vec2>> = {
  north: v2(0, -1),
  east: v2(1, 0),
  south: v2(0, 1),
  west: v2(-1, 0),
}

/** Builds an axis-aligned rectangle with its derived metrics. */
function rect(minX: number, minZ: number, maxX: number, maxZ: number): FootprintRect {
  const width = round(maxX - minX)
  const depth = round(maxZ - minZ)
  return {
    min: v2(round(minX), round(minZ)),
    max: v2(round(maxX), round(maxZ)),
    width,
    depth,
    area: round(width * depth),
  }
}

/** Which streets a cell fronts, in canonical street order. */
function facingStreets(columnIndex: number, rowIndex: number): StreetName[] {
  const facing: StreetName[] = []
  if (rowIndex === 0) facing.push('north')
  if (columnIndex === PARCEL_COLUMNS.length - 1) facing.push('east')
  if (rowIndex === PARCEL_ROWS.length - 1) facing.push('south')
  if (columnIndex === 0) facing.push('west')
  return facing
}

/** Block corner a cell occupies, or `null` for non-corner parcels. */
function cornerOf(facing: readonly StreetName[]): CornerName | null {
  const north = facing.includes('north')
  const south = facing.includes('south')
  const east = facing.includes('east')
  const west = facing.includes('west')
  if (north && east) return 'north-east'
  if (south && east) return 'south-east'
  if (south && west) return 'south-west'
  if (north && west) return 'north-west'
  return null
}

/**
 * Facade edge of a footprint for one street. Edges run clockwise around the
 * footprint (seen with north up) so bay numbering is stable: along the north
 * edge west → east, the east edge north → south, and so on.
 */
function facadeEdge(footprint: FootprintRect, street: StreetName): { from: Vec2; to: Vec2 } {
  switch (street) {
    case 'north':
      return { from: v2(footprint.min.x, footprint.min.z), to: v2(footprint.max.x, footprint.min.z) }
    case 'east':
      return { from: v2(footprint.max.x, footprint.min.z), to: v2(footprint.max.x, footprint.max.z) }
    case 'south':
      return { from: v2(footprint.max.x, footprint.max.z), to: v2(footprint.min.x, footprint.max.z) }
    case 'west':
      return { from: v2(footprint.min.x, footprint.max.z), to: v2(footprint.min.x, footprint.min.z) }
  }
}

/** Ground-floor retail bays along one street-facing facade edge. */
function buildBays(
  parcelId: string,
  footprint: FootprintRect,
  street: StreetName,
  firstIndex: number,
): StorefrontBay[] {
  const edge = facadeEdge(footprint, street)
  const spanX = edge.to.x - edge.from.x
  const spanZ = edge.to.z - edge.from.z
  const edgeLength = round(Math.hypot(spanX, spanZ))
  const count = clamp(Math.round(edgeLength / STOREFRONT_BAY_WIDTH), 1, 12)
  const width = round(edgeLength / count)
  const outward = OUTWARD[street]
  const bays: StorefrontBay[] = []

  for (let index = 0; index < count; index += 1) {
    const centreFraction = (index + 0.5) / count
    const centreX = round(edge.from.x + spanX * centreFraction)
    const centreZ = round(edge.from.z + spanZ * centreFraction)
    bays.push({
      name: `parcel:${parcelId}:storefront:${firstIndex + index}`,
      index: firstIndex + index,
      street,
      from: v2(round(edge.from.x + spanX * (index / count)), round(edge.from.z + spanZ * (index / count))),
      to: v2(
        round(edge.from.x + spanX * ((index + 1) / count)),
        round(edge.from.z + spanZ * ((index + 1) / count)),
      ),
      centre: v2(centreX, centreZ),
      width,
      height: GROUND_FLOOR_HEIGHT,
      normal: v3(outward.x, 0, outward.z),
      area: round(width * GROUND_FLOOR_HEIGHT),
    })
  }

  return bays
}

/**
 * Generates the whole parcel grid.
 *
 * Rows run north (1) to south (4), columns west (A) to east (D), and every cell
 * draws in the fixed edge order north, east, south, west, so the same seed
 * always produces the same parcels.
 */
export function buildParcels(rng: Rng): Parcel[] {
  const parcels: Parcel[] = []

  for (let rowIndex = 0; rowIndex < PARCEL_ROWS.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < PARCEL_COLUMNS.length; columnIndex += 1) {
      const column = at(PARCEL_COLUMNS, columnIndex)
      const row = at(PARCEL_ROWS, rowIndex)
      const id = `${column}${row}`
      const cell = rect(
        -BUILD_LINE + columnIndex * PARCEL_SIZE,
        -BUILD_LINE + rowIndex * PARCEL_SIZE,
        -BUILD_LINE + (columnIndex + 1) * PARCEL_SIZE,
        -BUILD_LINE + (rowIndex + 1) * PARCEL_SIZE,
      )
      const facing = facingStreets(columnIndex, rowIndex)
      const facingSet = new Set<StreetName>(facing)

      const setbacks: ParcelSetbacks = {
        north: round(rng.float(
          facingSet.has('north') ? STREET_SETBACK.min : COURTYARD_SETBACK.min,
          facingSet.has('north') ? STREET_SETBACK.max : COURTYARD_SETBACK.max,
        )),
        east: round(rng.float(
          facingSet.has('east') ? STREET_SETBACK.min : COURTYARD_SETBACK.min,
          facingSet.has('east') ? STREET_SETBACK.max : COURTYARD_SETBACK.max,
        )),
        south: round(rng.float(
          facingSet.has('south') ? STREET_SETBACK.min : COURTYARD_SETBACK.min,
          facingSet.has('south') ? STREET_SETBACK.max : COURTYARD_SETBACK.max,
        )),
        west: round(rng.float(
          facingSet.has('west') ? STREET_SETBACK.min : COURTYARD_SETBACK.min,
          facingSet.has('west') ? STREET_SETBACK.max : COURTYARD_SETBACK.max,
        )),
      }

      const footprint = rect(
        cell.min.x + setbacks.west,
        cell.min.z + setbacks.north,
        cell.max.x - setbacks.east,
        cell.max.z - setbacks.south,
      )

      const corner = cornerOf(facing)
      const heightRange = corner !== null ? HEIGHT.corner : facing.length > 0 ? HEIGHT.street : HEIGHT.interior
      const maxHeight = round(Math.round(rng.float(heightRange.min, heightRange.max) * 2) / 2)
      const floors = Math.max(1, Math.floor((maxHeight - GROUND_FLOOR_HEIGHT) / FLOOR_HEIGHT) + 1)
      const use = corner !== null
        ? 'mixed'
        : facing.length > 0
          ? rng.bool(0.65)
            ? 'commercial'
            : 'mixed'
          : rng.bool(0.7)
            ? 'residential'
            : 'civic'

      const bays: StorefrontBay[] = []
      for (const street of STREET_NAMES) {
        if (!facingSet.has(street)) {
          continue
        }
        bays.push(...buildBays(id, footprint, street, bays.length + 1))
      }

      parcels.push({
        id,
        column,
        row,
        cell,
        setbacks,
        footprint,
        capacity: {
          footprintArea: footprint.area,
          maxHeight,
          floors,
          groundFloorHeight: GROUND_FLOOR_HEIGHT,
          upperFloorHeight: FLOOR_HEIGHT,
          buildableVolume: round(footprint.area * maxHeight),
          use,
        },
        facing,
        corner,
        bays,
      })
    }
  }

  return parcels
}

/** True when two ground rectangles overlap with positive area. */
export function footprintsOverlap(a: FootprintRect, b: FootprintRect): boolean {
  const separates =
    a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.z <= b.min.z || b.max.z <= a.min.z
  return !separates
}
