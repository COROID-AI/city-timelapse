/**
 * Facade generator: one storey-by-storey plan per building volume.
 *
 * The shared rule is that a facade is **one glazing band per storey plus the
 * era's wall detail**, not one quad per window: the window *grid* is painted by
 * the procedural facade texture (see `textures.ts`) while this module reports
 * the grid it asked for ({@link FacadeWindowGrid}) and the number of window
 * cells the grid contains ({@link FacadePlan.windowCount}). That keeps a
 * 24-storey tower at a few hundred triangles instead of tens of thousands while
 * every statistical property — window proportions, glazing ratio, coursing,
 * spandrel and mullion bands, balconies — stays measurable per era.
 *
 * Era detail is data-driven from {@link FacadeTable}: coursed masonry adds sill
 * bands for 1945/1965, band-and-mullion languages add spandrel and mullion
 * bands for 1985/2005, and the exposed-structure language adds corner columns,
 * slab bands, balconies and facade plant for 2025.
 *
 * The ground storey of the street-facing mass is deliberately left clear: the
 * frontage of every layout storefront bay is recorded in
 * {@link FacadePlan.frontage} with its setback, so the storefront layer can
 * dress it and the building never covers it.
 */

import type { Rng } from '../../lib/rng'
import type { Parcel, StreetName, Vec2 } from '../layout'
import type {
  AddOnAttachment,
  BuildingEraTable,
  FacadeEdgePlan,
  FacadePlan,
  FacadeWindowGrid,
  FrontageClearance,
  PlacedAddOn,
  PlotRect,
  Primitive,
} from './types'
import {
  boxPrimitive,
  clampPlotRect,
  expandPlotRect,
  primitiveListTriangles,
  quadPrimitive,
  round3,
} from './types'

/** Facade edges run clockwise around a footprint, matching the layout. */
const EDGE_ORDER: readonly StreetName[] = ['north', 'east', 'south', 'west']

/** Outward normal of every edge, on the ground plane. */
const OUTWARD: Readonly<Record<StreetName, Vec2>> = {
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
}

/** Along-edge tangent of every edge, in the layout's bay-numbering direction. */
const TANGENT: Readonly<Record<StreetName, Vec2>> = {
  north: { x: 1, z: 0 },
  east: { x: 0, z: 1 },
  south: { x: -1, z: 0 },
  west: { x: 0, z: -1 },
}

/** Panels sit this far proud of the mass, so they never z-fight its surface. */
const EDGE_OFFSET = 0.03

/** Clear corner pier kept at both ends of every facade edge. */
const CORNER_PIER = 0.45

/** One massing volume handed to the facade generator. */
export interface FacadeMassInput {
  readonly id: string
  readonly role: 'base' | 'podium' | 'tower' | 'setback'
  readonly rect: PlotRect
  readonly baseY: number
  readonly topY: number
  /** Global storey indices this mass contains; storey `0` is the ground floor. */
  readonly storeys: readonly number[]
  /** True for the volume that owns the parcel's ground storey. */
  readonly groundFloor: boolean
}

/** Input of {@link planFacades}. */
export interface PlanFacadesInput {
  readonly parcel: Parcel
  readonly table: BuildingEraTable
  readonly detail: number
  readonly masses: readonly FacadeMassInput[]
  /** Base height of every storey of the building, ground storey first. */
  readonly storeyBases: readonly number[]
  /** Top of the building mass (the roof the kit stands on). */
  readonly buildingTop: number
  readonly groundFloorHeight: number
  /** Parcel cell, used to clamp structural overshoot. */
  readonly bounds: PlotRect
  readonly rng: Rng
}

/** Ground-plane position `along` an edge, `offset` metres outside it. */
function edgeGroundPoint(rect: PlotRect, street: StreetName, along: number, offset: number): Vec2 {
  const outward = OUTWARD[street]
  const tangent = TANGENT[street]
  const anchorX = street === 'west' ? rect.minX : street === 'east' ? rect.maxX : rect.centreX
  const anchorZ = street === 'north' ? rect.minZ : street === 'south' ? rect.maxZ : rect.centreZ
  return {
    x: round3(anchorX + outward.x * offset + tangent.x * along),
    z: round3(anchorZ + outward.z * offset + tangent.z * along),
  }
}

/** Aligns a facade panel centre on one edge of a mass. */
function edgeCentre(
  rect: PlotRect,
  street: StreetName,
  along: number,
  y: number,
  offset = EDGE_OFFSET,
): { x: number; y: number; z: number } {
  const point = edgeGroundPoint(rect, street, along, offset)
  return { x: point.x, y: round3(y), z: point.z }
}

/** Horizontal size of an edge: how far it runs across its mass. */
function edgeLength(rect: PlotRect, street: StreetName): number {
  return street === 'north' || street === 'south' ? rect.width : rect.depth
}

/** One storey of a mass that actually takes a glazing band. */
interface DrawnStorey {
  readonly index: number
  readonly base: number
  readonly height: number
}

/**
 * Plans every facade of one building: window grids, era wall detail, the clear
 * ground-floor frontage and the facade-attached add-ons.
 */
export function planFacades(input: PlanFacadesInput): FacadePlan {
  const { parcel, table, detail, rng, bounds, storeyBases, buildingTop } = input
  const facade = table.facade
  const windowDetail = Math.min(1.5, Math.max(0.2, detail))
  const structureDetail = Math.min(2, Math.max(0.2, detail * facade.detailScale))

  const primitives: Primitive[] = []
  const edges: FacadeEdgePlan[] = []
  const frontage: FrontageClearance[] = []
  const facadeAddOns: PlacedAddOn[] = []

  let windowCount = 0
  let courses = 0
  let spandrels = 0
  let mullions = 0
  let balconies = 0

  const storeyBaseAt = (index: number): number => storeyBases[index] ?? 0
  const storeyHeightAt = (index: number): number =>
    (storeyBases[index + 1] ?? buildingTop) - storeyBaseAt(index)

  for (const mass of input.masses) {
    const height = round3(mass.topY - mass.baseY)
    if (height <= 0) {
      continue
    }
    // Upper storeys only: the ground storey stays clear for the storefront layer.
    const candidates = mass.storeys.filter((index) => !(mass.groundFloor && index === 0))

    for (const street of EDGE_ORDER) {
      const length = edgeLength(mass.rect, street)
      if (length < 2 * CORNER_PIER + 0.6) {
        continue
      }
      const facing = parcel.facing.includes(street)
      const outward = OUTWARD[street]
      const usable = length - 2 * CORNER_PIER
      const columns = Math.max(1, Math.round((usable / facade.columnPitch) * windowDetail))
      const edgeId = `building:${parcel.id}:facade:${mass.id}:${street}`

      // Lay the storeys out first: a mass that a setback or a cornice shortens
      // simply drops the storey that no longer fits inside it.
      const drawn: DrawnStorey[] = []
      for (const index of candidates) {
        const base = storeyBaseAt(index)
        const available = mass.topY - base - 0.05
        if (available < facade.sillHeight + 0.5) {
          continue
        }
        const bandHeight = Math.max(
          0.5,
          Math.min(
            facade.windowHeight,
            available - facade.sillHeight - 0.05,
            storeyHeightAt(index) - facade.sillHeight - 0.2,
          ),
        )
        drawn.push({ index, base, height: bandHeight })
      }
      const rows = drawn.length
      // The ground storey stays clear whether or not this volume draws glazing
      // rows above it, so the storefront frontage is recorded either way.
      if (mass.groundFloor && facing) {
        const wall = edgeGroundPoint(mass.rect, street, 0, 0)
        const inward = { x: -outward.x, z: -outward.z }
        for (const bay of parcel.bays) {
          if (bay.street !== street) {
            continue
          }
          frontage.push({
            anchor: bay.name,
            street,
            width: bay.width,
            height: input.groundFloorHeight,
            centre: { x: bay.centre.x, z: bay.centre.z },
            normal: { x: bay.normal.x, z: bay.normal.z },
            // Measured inward from the shopfront line, so it is never negative.
            setback: round3(
              Math.max(0, (wall.x - bay.centre.x) * inward.x + (wall.z - bay.centre.z) * inward.z),
            ),
          })
        }
      }
      if (rows === 0) {
        continue
      }

      let glazedArea = 0
      for (const storey of drawn) {
        const centre = edgeCentre(mass.rect, street, 0, storey.base + facade.sillHeight + storey.height / 2)
        primitives.push(
          quadPrimitive(`${edgeId}:glazing:${storey.index}`, 'facades', centre, usable, storey.height, outward),
        )
        glazedArea += usable * storey.height
      }

      // --- era wall detail ----------------------------------------------
      if (facade.masonryCourseHeight !== null && facade.sillBandHeight > 0) {
        for (const storey of drawn) {
          const centre = edgeCentre(mass.rect, street, 0, storey.base + facade.sillBandHeight / 2)
          primitives.push(
            quadPrimitive(
              `${edgeId}:sill:${storey.index}`,
              'facades',
              centre,
              usable,
              facade.sillBandHeight,
              outward,
            ),
          )
          courses += 1
        }
      }

      if (facade.spandrelBandHeight !== null && facade.spandrelBandHeight > 0) {
        const band = facade.spandrelBandHeight
        for (const storey of drawn) {
          const centre = edgeCentre(mass.rect, street, 0, storey.base + band / 2)
          primitives.push(
            quadPrimitive(`${edgeId}:spandrel:${storey.index}`, 'facades', centre, usable, band, outward),
          )
          spandrels += 1
        }
      }

      if (facade.mullionWidth !== null && facade.mullionWidth > 0 && facade.mullionSpacing !== null) {
        const count = Math.max(2, Math.round((usable / facade.mullionSpacing) * structureDetail))
        const first = drawn[0]
        const last = drawn[rows - 1]
        if (first !== undefined && last !== undefined) {
          const bottom = first.base
          const top = Math.min(mass.topY - 0.15, last.base + last.height + 0.15)
          const bandHeight = Math.max(0.5, top - bottom)
          for (let index = 0; index <= count; index += 1) {
            const along = -usable / 2 + (usable * index) / count
            const centre = edgeCentre(mass.rect, street, along, bottom + bandHeight / 2)
            primitives.push(
              quadPrimitive(
                `${edgeId}:mullion:${index}`,
                'facades',
                centre,
                facade.mullionWidth,
                bandHeight,
                outward,
              ),
            )
            mullions += 1
          }
        }
      }

      if (facade.balconyEveryFloors !== null && facade.balconyEveryFloors > 0 && facade.balconyDepth > 0) {
        const step = Math.max(1, Math.round(facade.balconyEveryFloors))
        const depth = facade.balconyDepth
        for (let row = step - 1; row < rows; row += step) {
          const storey = drawn[row]
          if (storey === undefined) {
            continue
          }
          const position = edgeGroundPoint(mass.rect, street, 0, depth / 2 + 0.05)
          primitives.push(
            boxPrimitive(
              `${edgeId}:balcony:${storey.index}`,
              'facades',
              { x: position.x, y: round3(storey.base + 0.18), z: position.z },
              { width: Math.max(1, usable * 0.8), height: 0.36, depth },
            ),
          )
          balconies += 1
        }
      }

      edges.push({
        id: edgeId,
        street: facing ? street : null,
        courtyard: !facing,
        length: round3(length),
        height,
        centre: edgeGroundPoint(mass.rect, street, 0, 0),
        normal: { x: outward.x, z: outward.z },
        columns,
        rows,
        windowCount: columns * rows,
        glazingRatio: round3(glazedArea / Math.max(1, length * height)),
        storefrontBays: facing
          ? parcel.bays.filter((bay) => bay.street === street).map((bay) => bay.name)
          : [],
        frontageClearanceHeight: mass.groundFloor ? input.groundFloorHeight : 0,
        groundFloorClear: mass.groundFloor,
        mullions: facade.mullionWidth !== null ? Math.max(2, Math.round(usable / (facade.mullionSpacing ?? 2))) + 1 : 0,
        spandrelBands: facade.spandrelBandHeight !== null ? rows : 0,
        courses: facade.masonryCourseHeight !== null ? rows : 0,
        balconies:
          facade.balconyEveryFloors !== null
            ? Math.floor(rows / Math.max(1, Math.round(facade.balconyEveryFloors)))
            : 0,
      })
      windowCount += columns * rows
    }

    // --- exposed structural frame (2025) --------------------------------
    if (facade.exposedFrame) {
      const frame = clampPlotRect(expandPlotRect(mass.rect, 0.15), bounds)
      const columnSize = 0.45
      for (const corner of [
        { x: frame.minX + columnSize / 2, z: frame.minZ + columnSize / 2 },
        { x: frame.maxX - columnSize / 2, z: frame.minZ + columnSize / 2 },
        { x: frame.maxX - columnSize / 2, z: frame.maxZ - columnSize / 2 },
        { x: frame.minX + columnSize / 2, z: frame.maxZ - columnSize / 2 },
      ]) {
        primitives.push(
          boxPrimitive(
            `${mass.id}:column:${corner.x}:${corner.z}`,
            'facades',
            { x: corner.x, y: round3((mass.baseY + mass.topY) / 2), z: corner.z },
            { width: columnSize, height, depth: columnSize },
          ),
        )
      }
      const slabStep = Math.max(1, Math.round(2 * structureDetail))
      for (let index = slabStep; index < mass.storeys.length; index += slabStep) {
        const storeyIndex = mass.storeys[index]
        if (storeyIndex === undefined) {
          continue
        }
        const base = storeyBaseAt(storeyIndex)
        if (base + 0.3 > mass.topY) {
          continue
        }
        primitives.push(
          boxPrimitive(
            `${mass.id}:slab:${storeyIndex}`,
            'facades',
            { x: frame.centreX, y: round3(base), z: frame.centreZ },
            { width: frame.width, height: 0.24, depth: frame.depth },
          ),
        )
      }
    }
  }

  // --- facade-attached add-ons (fire escapes, window AC units) ----------
  const attachedSpecs = table.roof.addOns.filter((spec) => spec.attach === 'facade')
  const streetEdges = edges.filter((edge) => !edge.courtyard)
  const candidateEdges = streetEdges.length > 0 ? streetEdges : edges
  for (const spec of attachedSpecs) {
    const count = rng.int(spec.count.min, spec.count.max + 1)
    for (let index = 0; index < count; index += 1) {
      const edge = candidateEdges.length > 0 ? rng.pick(candidateEdges) : null
      if (edge === null) {
        break
      }
      const mass = input.masses.find((candidate) => edge.id.includes(`facade:${candidate.id}:`))
      if (mass === undefined) {
        break
      }
      const size = {
        width: round3(rng.float(spec.size.width.min, spec.size.width.max)),
        height: round3(rng.float(spec.size.height.min, spec.size.height.max)),
        depth: round3(rng.float(spec.size.depth.min, spec.size.depth.max)),
      }
      const along = round3(
        rng.float(-edge.length / 2 + size.width / 2, edge.length / 2 - size.width / 2),
      )
      const half = size.height / 2
      const y = round3(
        spec.kind === 'fire-escape'
          ? Math.min(mass.topY - half - 0.2, Math.max(mass.baseY + half, mass.baseY + input.groundFloorHeight + half))
          : Math.min(mass.topY - half - 0.4, mass.baseY + input.groundFloorHeight + half + 0.4),
      )
      const ground = edgeGroundPoint(mass.rect, edge.street ?? 'north', along, size.depth / 2 + 0.04)
      const addOn: PlacedAddOn = {
        ...boxPrimitive(
          `building:${parcel.id}:addon:${spec.kind}:${index + 1}`,
          'add-ons',
          { x: ground.x, y, z: ground.z },
          size,
        ),
        addOn: spec.kind,
        attach: 'facade' as AddOnAttachment,
        parcelId: parcel.id,
      }
      facadeAddOns.push(addOn)
    }
  }

  const grid: FacadeWindowGrid = {
    windowWidth: facade.windowWidth,
    windowHeight: facade.windowHeight,
    spacingX: facade.columnPitch,
    spacingY: input.groundFloorHeight,
    sillHeight: facade.sillHeight,
    columns: edges.reduce((max, edge) => Math.max(max, edge.columns), 1),
    rows: edges.reduce((max, edge) => Math.max(max, edge.rows), 0),
    aspect: round3(facade.windowWidth / facade.windowHeight),
  }

  return {
    style: facade.style,
    grid,
    edges,
    windowCount,
    glazingRatio: round3(
      edges.reduce((total, edge) => total + edge.glazingRatio, 0) / Math.max(1, edges.length),
    ),
    masonryCourses: courses,
    spandrelBands: spandrels,
    mullions,
    balconies,
    exposedFrame: facade.exposedFrame,
    groundFloorClear: input.masses.some((mass) => mass.groundFloor),
    frontage,
    addOns: facadeAddOns,
    primitives,
    triangles: primitiveListTriangles(primitives),
  }
}

/** Every facade add-on spec of an era, in table order. */
export function facadeAddOnSpecs(table: BuildingEraTable): readonly string[] {
  return table.roof.addOns.filter((spec) => spec.attach === 'facade').map((spec) => spec.kind)
}
