/**
 * Facade and roof geometry of the era buildings layer.
 *
 * This module turns a resolved {@link BuildingInstance} into the exact geometry
 * the painter places: the window grid of a facade (columns, rows, pane size and
 * storefront band) and the deterministic world placement of every window pane
 * and every roof add-on.
 *
 * Nothing here reads a clock or draws from a random source: placement is a pure
 * function of the building's own data and its parcel id, so a plan repaints
 * byte-identically and the browser proof never sees a building jitter.
 */

import { hashStringToSeed } from '../../lib/rng'
import type { FootprintRect } from '../layout'
import type { FacadePlan, RoofItemKind, RoofKitPlan } from './types'

/** One window pane in world space, before the pane geometry is applied. */
export interface WindowPlacement {
  readonly x: number
  readonly y: number
  readonly z: number
  /** Yaw that turns the pane to face outward, in radians. */
  readonly rotationY: number
}

/** One roof add-on in world space, with its box dimensions. */
export interface RoofPlacement {
  readonly kind: RoofItemKind
  readonly x: number
  readonly y: number
  readonly z: number
  readonly width: number
  readonly height: number
  readonly depth: number
  readonly rotationY: number
}

/** Margin kept clear at each end of a facade before the first window. */
const FACADE_EDGE_MARGIN = 0.6

/** Deterministic unit value in `[0, 1)` derived from a key. */
function unit(key: string): number {
  return hashStringToSeed(key) / 0x1_0000_0000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Columns that fit on one edge of `length` metres. */
function columnCount(length: number, windowWidth: number, spacingX: number, detail: number): number {
  const usable = Math.max(windowWidth, length - FACADE_EDGE_MARGIN * 2)
  const raw = Math.floor(usable / (windowWidth + spacingX))
  const scale = 0.45 + 0.55 * clamp(detail, 0, 1)
  return Math.max(1, Math.min(40, Math.round(raw * scale) || 1))
}

/**
 * Builds the facade plan of one building.
 *
 * The window grid is sized to the era's own pane proportions and to the quality
 * tier's facade detail, so a cheaper tier draws fewer, wider-spaced windows
 * rather than the same grid at a lower resolution.
 */
export function computeFacadePlan(options: {
  readonly footprint: FootprintRect
  readonly floors: number
  readonly height: number
  readonly groundFloorHeight: number
  readonly detail: number
  readonly profile: {
    readonly style: FacadePlan['style']
    readonly windowWidth: number
    readonly windowHeight: number
    readonly windowSpacingX: number
    readonly windowSpacingY: number
    readonly sillHeight: number
    readonly masonryCoursing: boolean
    readonly spandrelBands: boolean
    readonly mullions: boolean
    readonly exposedStructure: boolean
    readonly balconyChance: number
    readonly storefrontBandHeight: number
  }
  readonly facingEdges: number
}): FacadePlan {
  const { footprint, floors, height, detail, profile } = options
  const rows = Math.max(1, floors - 1)
  const columnsX = columnCount(footprint.width, profile.windowWidth, profile.windowSpacingX, detail)
  const columnsZ = columnCount(footprint.depth, profile.windowWidth, profile.windowSpacingX, detail)
  const windowCount = rows * (columnsX * 2 + columnsZ * 2)
  const masonryCourses = profile.masonryCoursing ? Math.max(1, Math.round(height / 0.9)) : 0
  const balconyCount =
    profile.balconyChance > 0
      ? Math.round(rows * profile.balconyChance * Math.max(1, options.facingEdges))
      : 0

  return {
    style: profile.style,
    window: {
      columns: Math.max(columnsX, columnsZ),
      columnsX,
      columnsZ,
      rows,
      width: profile.windowWidth,
      height: profile.windowHeight,
      sillHeight: profile.sillHeight,
      spacingX: profile.windowSpacingX,
      spacingY: profile.windowSpacingY,
    },
    windowCount,
    facingEdges: options.facingEdges,
    masonryCourses,
    hasMasonryCoursing: profile.masonryCoursing,
    hasSpandrelBands: profile.spandrelBands,
    hasMullions: profile.mullions,
    hasExposedStructure: profile.exposedStructure,
    balconyCount,
    storefrontBandHeight: Math.max(profile.storefrontBandHeight, options.groundFloorHeight),
  }
}

/**
 * Places every window pane of one building on its four facades.
 *
 * The ground floor is deliberately left clear below
 * {@link FacadePlan.storefrontBandHeight}: that band belongs to the storefront
 * layer, and the buildings layer must not dress it.
 */
export function facadeWindowPlacements(options: {
  readonly id: string
  readonly footprint: FootprintRect
  readonly facade: FacadePlan
  readonly height: number
  readonly groundFloorHeight: number
}): readonly WindowPlacement[] {
  const { footprint, facade, groundFloorHeight } = options
  const { columnsX, columnsZ, rows, width, height, sillHeight, spacingY } = facade.window
  const placements: WindowPlacement[] = []

  const paneTop = groundFloorHeight + sillHeight + (rows - 1) * (height + spacingY) + height
  const cappedRows = paneTop <= options.height ? rows : Math.max(0, rows - 1)

  const rowY = (row: number): number =>
    groundFloorHeight + sillHeight + row * (height + spacingY) + height / 2

  // North and south faces span the footprint width.
  for (const [z, rotationY] of [
    [footprint.min.z, Math.PI],
    [footprint.max.z, 0],
  ] as const) {
    for (let column = 0; column < columnsX; column += 1) {
      const x = footprint.min.x + FACADE_EDGE_MARGIN + width / 2 + column * (width + facade.window.spacingX)
      if (x + width / 2 > footprint.max.x - FACADE_EDGE_MARGIN + 1e-9) {
        break
      }
      for (let row = 0; row < cappedRows; row += 1) {
        placements.push({ x, y: rowY(row), z, rotationY })
      }
    }
  }

  // East and west faces span the footprint depth.
  for (const [x, rotationY] of [
    [footprint.max.x, Math.PI / 2],
    [footprint.min.x, -Math.PI / 2],
  ] as const) {
    for (let column = 0; column < columnsZ; column += 1) {
      const z = footprint.min.z + FACADE_EDGE_MARGIN + width / 2 + column * (width + facade.window.spacingX)
      if (z + width / 2 > footprint.max.z - FACADE_EDGE_MARGIN + 1e-9) {
        break
      }
      for (let row = 0; row < cappedRows; row += 1) {
        placements.push({ x, y: rowY(row), z, rotationY })
      }
    }
  }

  return placements
}

/**
 * Places one building's roof kit.
 *
 * Items are distributed over the roof rectangle on a golden-angle spiral keyed
 * to the building and the item kind, so the same building always carries its
 * chimneys and AC boxes in the same spots.
 */
export function roofItemPlacements(options: {
  readonly id: string
  readonly footprint: FootprintRect
  readonly height: number
  readonly roof: RoofKitPlan
}): readonly RoofPlacement[] {
  const { footprint, height, roof } = options
  const placements: RoofPlacement[] = []
  const insetX = Math.max(0, (footprint.width - 1.2) / 2)
  const insetZ = Math.max(0, (footprint.depth - 1.2) / 2)

  for (const item of roof.items) {
    for (let index = 0; index < item.count; index += 1) {
      const key = unit(`${options.id}:${item.kind}:${index}`)
      const angle = index * 2.399963 + key * 6.283185
      const radius = Math.min(insetX, insetZ) * (0.25 + 0.7 * ((index + 1) / (item.count + 1)))
      const x = footprint.min.x + footprint.width / 2 + Math.cos(angle) * radius
      const z = footprint.min.z + footprint.depth / 2 + Math.sin(angle) * radius
      const spec = ROOF_ITEM_SIZES[item.kind]
      placements.push({
        kind: item.kind,
        x,
        y: height + spec.height / 2,
        z,
        width: spec.width,
        height: spec.height,
        depth: spec.depth,
        rotationY: key > 0.5 ? 0 : Math.PI / 4,
      })
    }
  }

  return placements
}

/**
 * Nominal dimensions of every roof add-on, in metres.
 *
 * Shared by the plan (which counts what a building carries) and the painter
 * (which places it), so the two can never disagree.
 */
export const ROOF_ITEM_SIZES: Readonly<
  Record<RoofItemKind, { readonly width: number; readonly height: number; readonly depth: number }>
> = Object.freeze({
  chimney: { width: 0.9, height: 2.2, depth: 0.9 },
  'water-tank': { width: 1.8, height: 2.4, depth: 1.8 },
  'fire-escape': { width: 2.4, height: 3.4, depth: 1.1 },
  'sign-frame': { width: 3.2, height: 1.6, depth: 0.4 },
  vent: { width: 0.6, height: 0.8, depth: 0.6 },
  'ac-box': { width: 1, height: 0.8, depth: 0.8 },
  antenna: { width: 0.15, height: 3.5, depth: 0.15 },
  'satellite-dish': { width: 1.1, height: 0.9, depth: 0.2 },
  'mechanical-penthouse': { width: 5, height: 3, depth: 4 },
  'solar-array': { width: 6, height: 0.4, depth: 3 },
  'green-roof': { width: 7, height: 0.5, depth: 5 },
  'roof-deck': { width: 5, height: 1.1, depth: 4 },
})
