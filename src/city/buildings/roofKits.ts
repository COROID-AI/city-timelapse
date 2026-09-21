/**
 * Era roof kits: everything that makes the skyline read as a period.
 *
 * A roof kit is data ({@link RoofKitTable}): a parapet range, a surface
 * treatment (bare slab, deck, green roof, solar array) and a list of add-ons
 * with counts and size ranges. This module turns that data into placed boxes on
 * the roof plate, which is itself derived from the parcel's rooftop anchor
 * (`parcel:<id>:prop:1`, tagged `rooftop`), so the kit always lands inside the
 * parcel the layout published.
 *
 * The five kits are: 1945 coal chimneys, a timber water tank and tar paper;
 * 1965 a steel roof-sign frame with vents; 1985 a crowded plant roof with AC
 * units, aerials, dishes and a bulkhead; 2005 a mechanical penthouse and a
 * service deck; 2025 a green roof, a solar array and a planted roof deck.
 */

import type { Rng } from '../../lib/rng'
import type { Anchor } from '../layout'
import type {
  AddOnAttachment,
  BuildingEraTable,
  PlacedAddOn,
  PlotRect,
  Primitive,
  RoofKitId,
  RooftopPlan,
} from './types'
import {
  boxPrimitive,
  clampPlotRect,
  countAddOnKinds,
  emptyAddOnCounts,
  expandPlotRect,
  insetPlotRect,
  insetPlotRectSides,
  plotRect,
  primitiveListTriangles,
  round3,
} from './types'

/** Thickness of the parapet wall that rings every roof. */
const PARAPET_THICKNESS = 0.35

/** Walkable margin left free around the plant, in metres. */
const ROOF_MARGIN = 0.8

/** Height of the raised roof deck slab. */
const DECK_HEIGHT = 0.18

/** Thickness of the walkable roof plate every kit stands on. */
const ROOF_PLATE_HEIGHT = 0.12

/** Height of a planted/ballasted roof build-up. */
const GROUND_COVER_HEIGHT = 0.32

/** Height of a solar panel plane. */
const SOLAR_HEIGHT = 0.45

/** Input of {@link planRooftop}. */
export interface PlanRooftopInput {
  readonly parcelId: string
  readonly table: BuildingEraTable
  /** Top of the building mass; the kit stands here. */
  readonly roofY: number
  /** Topmost mass plate the kit stands on. */
  readonly plate: PlotRect
  /** Parcel cell, the outer bound no roof detail may leave. */
  readonly bounds: PlotRect
  /** The layout's rooftop anchor for this parcel. */
  readonly anchor: Anchor | undefined
  readonly rng: Rng
}

/** Ground rectangle covered by a layout anchor's `size` hint. */
export function anchorRect(anchor: Anchor): PlotRect | null {
  if (anchor.size === null) {
    return null
  }
  return plotRect(
    anchor.position.x - anchor.size.width / 2,
    anchor.position.z - anchor.size.height / 2,
    anchor.position.x + anchor.size.width / 2,
    anchor.position.z + anchor.size.height / 2,
  )
}

/**
 * Centred sub-rectangle covering `ratio` of a rectangle's area.
 *
 * The linear scale is the square root, so `0.55` really is 55 % of the plate
 * rather than 55 % of each side.
 */
export function centredAreaFraction(rect: PlotRect, ratio: number): PlotRect {
  const clamped = Math.min(1, Math.max(0, ratio))
  const inset = (1 - Math.sqrt(clamped)) / 2
  return insetPlotRectSides(
    rect,
    rect.width * inset,
    rect.depth * inset,
    rect.width * inset,
    rect.depth * inset,
  )
}

/** Builds a `Record<AddOnKind, number>` with every key present at zero. */
export function roofKitCounts(kitId: RoofKitId, count: number): Record<RoofKitId, number> {
  const counts = {
    'masonry-watertank': 0,
    'signage-frame': 0,
    'mechanical-clutter': 0,
    'penthouse-deck': 0,
    'green-solar': 0,
  } satisfies Record<RoofKitId, number>
  counts[kitId] = count
  return counts
}

/**
 * Plans one building's rooftop kit.
 *
 * Add-ons are placed inside the walkable margin of the roof plate, against the
 * parapet when the kit says the item is edge-mounted (sign frames, aerials,
 * roof decks), and on a deterministic draw from the parcel's own generator, so
 * the same seed always produces the same roofscape.
 */
export function planRooftop(input: PlanRooftopInput): RooftopPlan {
  const { table, rng } = input
  const kit = table.roof
  const parapetHeight = round3(rng.float(kit.parapetHeight.min, kit.parapetHeight.max))

  // The kit stands on the topmost mass, clamped into the parcel's roof anchor.
  const anchorBounds = input.anchor === undefined ? null : anchorRect(input.anchor)
  let roof = insetPlotRect(input.plate, PARAPET_THICKNESS)
  if (roof.width < 3 || roof.depth < 3) {
    roof = insetPlotRect(input.plate, 0.1)
  }
  roof = clampPlotRect(roof, input.bounds)
  if (anchorBounds !== null) {
    roof = clampPlotRect(roof, anchorBounds)
  }

  const primitives: Primitive[] = []
  const addOns: PlacedAddOn[] = []
  const roofY = input.roofY

  // --- parapet ring -----------------------------------------------------
  const halfway = PARAPET_THICKNESS / 2
  const y = roofY + parapetHeight / 2
  primitives.push(
    boxPrimitive(
      `building:${input.parcelId}:roof:parapet:north`,
      'roof-kits',
      { x: roof.centreX, y: round3(y), z: round3(roof.minZ + halfway) },
      { width: roof.width, height: parapetHeight, depth: PARAPET_THICKNESS },
    ),
    boxPrimitive(
      `building:${input.parcelId}:roof:parapet:south`,
      'roof-kits',
      { x: roof.centreX, y: round3(y), z: round3(roof.maxZ - halfway) },
      { width: roof.width, height: parapetHeight, depth: PARAPET_THICKNESS },
    ),
    boxPrimitive(
      `building:${input.parcelId}:roof:parapet:east`,
      'roof-kits',
      { x: round3(roof.maxX - halfway), y: round3(y), z: roof.centreZ },
      { width: PARAPET_THICKNESS, height: parapetHeight, depth: Math.max(0.2, roof.depth - PARAPET_THICKNESS) },
    ),
    boxPrimitive(
      `building:${input.parcelId}:roof:parapet:west`,
      'roof-kits',
      { x: round3(roof.minX + halfway), y: round3(y), z: roof.centreZ },
      { width: PARAPET_THICKNESS, height: parapetHeight, depth: Math.max(0.2, roof.depth - PARAPET_THICKNESS) },
    ),
  )

  // --- surface treatment, layered bottom-up so nothing z-fights ----------
  let surfaceY = roofY
  const addSurface = (id: string, rect: PlotRect, height: number): void => {
    primitives.push(
      boxPrimitive(
        id,
        'roof-kits',
        { x: rect.centreX, y: round3(surfaceY + height / 2), z: rect.centreZ },
        { width: rect.width, height, depth: rect.depth },
      ),
    )
    surfaceY += height
  }

  addSurface(`building:${input.parcelId}:roof:plate`, insetPlotRect(roof, ROOF_MARGIN), ROOF_PLATE_HEIGHT)
  if (kit.greenRoofRatio > 0) {
    addSurface(
      `building:${input.parcelId}:roof:green-roof`,
      centredAreaFraction(roof, kit.greenRoofRatio),
      GROUND_COVER_HEIGHT,
    )
  }
  if (kit.solarCoverage > 0) {
    addSurface(
      `building:${input.parcelId}:roof:solar`,
      centredAreaFraction(roof, kit.solarCoverage),
      SOLAR_HEIGHT,
    )
  }
  if (kit.roofDeck) {
    addSurface(`building:${input.parcelId}:roof:deck`, insetPlotRect(roof, ROOF_MARGIN), DECK_HEIGHT)
  }

  // --- add-ons -----------------------------------------------------------
  const usable = insetPlotRect(roof, ROOF_MARGIN)
  const usableRect = usable.width > 1 && usable.depth > 1 ? usable : roof

  for (const spec of kit.addOns) {
    if (spec.attach !== 'roof' || spec.kind === 'balcony') {
      continue
    }
    // 2025's planted and photovoltaic surfaces are raised details on top of the
    // coverage the surface layer already laid down.
    if (spec.kind === 'green-roof' || spec.kind === 'solar-array') {
      const size = {
        width: round3(rng.float(spec.size.width.min, spec.size.width.max)),
        height: round3(rng.float(spec.size.height.min, spec.size.height.max)),
        depth: round3(rng.float(spec.size.depth.min, spec.size.depth.max)),
      }
      const position = placeOnRoof(usableRect, size, true, rng)
      addOns.push({
        ...boxPrimitive(
          `building:${input.parcelId}:addon:${spec.kind}:1`,
          'add-ons',
          { x: position.x, y: round3(surfaceY + size.height / 2), z: position.z },
          size,
        ),
        addOn: spec.kind,
        attach: 'roof' as AddOnAttachment,
        parcelId: input.parcelId,
      })
      continue
    }
    const count = Math.max(0, rng.int(spec.count.min, spec.count.max + 1))
    for (let index = 0; index < count; index += 1) {
      const size = {
        width: round3(rng.float(spec.size.width.min, spec.size.width.max)),
        height: round3(rng.float(spec.size.height.min, spec.size.height.max)),
        depth: round3(rng.float(spec.size.depth.min, spec.size.depth.max)),
      }
      const position = placeOnRoof(usableRect, size, spec.edgeMount, rng)
      addOns.push({
        ...boxPrimitive(
          `building:${input.parcelId}:addon:${spec.kind}:${index + 1}`,
          'add-ons',
          { x: position.x, y: round3(surfaceY + size.height / 2), z: position.z },
          size,
        ),
        addOn: spec.kind,
        attach: spec.attach,
        parcelId: input.parcelId,
      })
    }
  }

  return {
    kit: kit.kit,
    roof,
    roofY: round3(roofY),
    parapetHeight,
    roofDeck: kit.roofDeck,
    greenRoofRatio: kit.greenRoofRatio,
    solarCoverage: kit.solarCoverage,
    addOns,
    countsByKind: countAddOnKinds(addOns),
    primitives,
    triangles: primitiveListTriangles(primitives),
  }
}

/** Places one add-on inside the usable roof area, honouring edge mounts. */
function placeOnRoof(
  usable: PlotRect,
  size: { readonly width: number; readonly depth: number },
  edgeMount: boolean,
  rng: Rng,
): { x: number; z: number } {
  const halfWidth = size.width / 2
  const halfDepth = size.depth / 2
  const minX = usable.minX + Math.min(halfWidth, usable.width / 2)
  const maxX = usable.maxX - Math.min(halfWidth, usable.width / 2)
  const minZ = usable.minZ + Math.min(halfDepth, usable.depth / 2)
  const maxZ = usable.maxZ - Math.min(halfDepth, usable.depth / 2)

  if (!edgeMount) {
    return { x: round3(rng.float(minX, maxX)), z: round3(rng.float(minZ, maxZ)) }
  }

  // Edge-mounted plant hugs one of the four parapets.
  const edge = rng.int(0, 4)
  if (edge === 0) {
    return { x: round3(rng.float(minX, maxX)), z: round3(minZ) }
  }
  if (edge === 1) {
    return { x: round3(maxX), z: round3(rng.float(minZ, maxZ)) }
  }
  if (edge === 2) {
    return { x: round3(rng.float(minX, maxX)), z: round3(maxZ) }
  }
  return { x: round3(minX), z: round3(rng.float(minZ, maxZ)) }
}

/** Empty kit counters, shared by the plan summary. */
export function noRooftopCounts(): Record<RoofKitId, number> {
  return roofKitCounts('masonry-watertank', 0)
}

/** An empty rooftop plan for a parcel with no building. */
export function emptyRooftopPlan(kitId: RoofKitId, plate: PlotRect, roofY: number): RooftopPlan {
  return {
    kit: kitId,
    roof: plate,
    roofY: round3(roofY),
    parapetHeight: 0,
    roofDeck: false,
    greenRoofRatio: 0,
    solarCoverage: 0,
    addOns: [],
    countsByKind: emptyAddOnCounts(),
    primitives: [],
    triangles: 0,
  }
}

/** Area of the planted/solar coverage a kit claims, in square metres. */
export function roofCoverArea(plan: RooftopPlan): number {
  const green = plan.roof.area * plan.greenRoofRatio
  const solar = plan.roof.area * plan.solarCoverage
  return round3(green + solar)
}

/** Convenience: a rectangle grown by the parapet, used by harness diagnostics. */
export function roofEnvelope(plan: RooftopPlan): PlotRect {
  return expandPlotRect(plan.roof, PARAPET_THICKNESS)
}
