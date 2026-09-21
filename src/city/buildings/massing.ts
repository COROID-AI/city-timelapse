/**
 * Massing generator: how much building every era puts on every parcel.
 *
 * For each parcel of the shared layout the planner does exactly three things:
 *
 * 1. **resolves the parcel's state** — a building, a vacant lot or a
 *    construction site. The rates come from the era table, the draws from the
 *    block seed, and the quota is honoured (a non-zero rate always yields at
 *    least one parcel), so "the eras whose tables request them" is a property
 *    of the data, not of chance;
 * 2. **sizes the massing** from the parcel's *own* footprint and height
 *    capacity (`parcel.footprint`, `parcel.capacity`) scaled by the era table.
 *    No footprint is ever invented: the base plate is an inset of
 *    `parcel.footprint` and nothing leaves `parcel.cell`;
 * 3. **delegates the walls and the roof** to `facades.ts` and `roofKits.ts`,
 *    then publishes the whole plot as deterministic geometry primitives.
 *
 * The rooftop anchor of every parcel (`parcel:<id>:prop:1`, tagged `rooftop`)
 * is read by name, and the storefront-bay anchors listed in
 * {@link FacadePlan.frontage} are exactly the layout's own bay names, so the
 * plan can only attach to places the layout published.
 */

import { getEra, type EraDefinition, type EraId } from '../../era'
import { QUALITY_TIERS, type QualityTierName } from '../../lib/quality'
import { createRng, type Rng, type Seed } from '../../lib/rng'
import { CURB_HEIGHT, type Anchor, type BlockLayout, type FootprintRect, type Parcel } from '../layout'
import { planFacades, type FacadeMassInput } from './facades'
import { emptyRooftopPlan, planRooftop } from './roofKits'
import { getBuildingTable } from './tables'
import type {
  AddOnKind,
  BoxPrimitive,
  BuildingEraTable,
  BuildingLayerStats,
  BuildingPlot,
  BuildingSetPlan,
  BuildingStateKind,
  FacadePlan,
  MassRole,
  ParcelRole,
  ParcelStatePlan,
  PlacedAddOn,
  PlotRect,
  Primitive,
  RoofKitId,
} from './types'
import {
  ADD_ON_KINDS,
  BUILDING_DRAW_CALL_BUDGETS,
  BUILDING_TRIANGLE_BUDGETS,
  PRIMITIVE_TRIANGLES,
  ROOF_KIT_IDS,
  boxPrimitive,
  clampPlotRect,
  countAddOnKinds,
  emptyRoofKitCounts,
  expandPlotRect,
  insetPlotRect,
  insetPlotRectSides,
  plotRect,
  primitiveListTriangles,
  round3,
  shouldInstance,
} from './types'

/* ------------------------------------------------------------------------- *
 * Options and small helpers
 * ------------------------------------------------------------------------- */

/** Input of {@link planBuildingSet}. */
export interface PlanBuildingSetOptions {
  /** The canonical block every era layer is authored against. */
  readonly layout: BlockLayout
  /** Era to build, by id or definition. */
  readonly eraId: EraId | EraDefinition
  /** Overrides the block seed (tests, alternate islands). */
  readonly seed?: Seed
  readonly qualityTier?: QualityTierName
  /** Facade detail multiplier; defaults to the tier's facade density. */
  readonly detail?: number
}

/** Reads an index the caller already proved to be in range. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} is outside a collection of ${items.length}`)
  }
  return value
}

/** Converts a layout footprint rectangle into a plot rectangle. */
export function toPlotRect(footprint: FootprintRect): PlotRect {
  return plotRect(footprint.min.x, footprint.min.z, footprint.max.x, footprint.max.z)
}

/** Facade detail multiplier of a quality tier. */
export function resolveDetail(tier: QualityTierName, detail?: number): number {
  const value = detail ?? QUALITY_TIERS[tier].density.facadeDetail
  return Math.min(1.5, Math.max(0.2, value))
}

/**
 * Parcels one era table leaves in a state.
 *
 * A non-zero rate always yields at least one parcel, which is what makes the
 * "vacant lots and construction states appear in the eras whose tables request
 * them" acceptance criterion a data property rather than a lucky draw.
 */
export function stateQuota(rate: number, parcelCount: number): number {
  if (rate <= 0 || parcelCount <= 0) {
    return 0
  }
  return Math.min(parcelCount, Math.max(1, Math.round(rate * parcelCount)))
}

/**
 * Assigns exactly one state to every parcel.
 *
 * Construction claims its parcels first, then demolition, and both prefer the
 * interior frontages so the block's corner landmarks survive a rebuild.
 */
export function assignParcelStates(
  parcels: readonly Parcel[],
  table: BuildingEraTable,
  rng: Rng,
): ReadonlyMap<string, BuildingStateKind> {
  const states = new Map<string, BuildingStateKind>()
  const cornerIds = new Set(parcels.filter((parcel) => parcel.corner !== null).map((parcel) => parcel.id))
  const shuffled = rng.shuffle(parcels.map((parcel) => parcel.id))
  const order = [
    ...shuffled.filter((id) => !cornerIds.has(id)),
    ...shuffled.filter((id) => cornerIds.has(id)),
  ]

  const construction = stateQuota(table.construction, parcels.length)
  const vacancy = Math.min(stateQuota(table.vacancy, parcels.length), parcels.length - construction)

  let cursor = 0
  for (let index = 0; index < construction; index += 1) {
    states.set(at(order, cursor), 'construction')
    cursor += 1
  }
  for (let index = 0; index < vacancy; index += 1) {
    states.set(at(order, cursor), 'vacant-lot')
    cursor += 1
  }
  for (const parcel of parcels) {
    if (!states.has(parcel.id)) {
      states.set(parcel.id, 'building')
    }
  }
  return states
}

/* ------------------------------------------------------------------------- *
 * Parcel state dressing
 * ------------------------------------------------------------------------- */

/**
 * Geometry of a parcel with no building: a cleared lot or a live site.
 *
 * Both states keep the parcel's footprint as their plate, so a demolished
 * parcel never leaves a gap in the block and never overlaps its neighbours.
 */
export function planStateDressing(
  parcel: Parcel,
  state: BuildingStateKind,
  plate: PlotRect,
  groundY: number,
  rng: Rng,
): ParcelStatePlan {
  if (state === 'building') {
    return { state, label: 'standing building', primitives: [], triangles: 0 }
  }

  const primitives: Primitive[] = []
  const inner = insetPlotRect(plate, 1.2)
  const safe = inner.width > 2 && inner.depth > 2 ? inner : plate

  if (state === 'vacant-lot') {
    primitives.push(
      boxPrimitive(
        `lot:${parcel.id}:ground`,
        'lots',
        { x: plate.centreX, y: round3(groundY + 0.06), z: plate.centreZ },
        { width: plate.width, height: 0.12, depth: plate.depth },
      ),
    )
    const rubble = rng.int(3, 7)
    for (let index = 0; index < rubble; index += 1) {
      const size = round3(rng.float(0.5, 1.5))
      primitives.push(
        boxPrimitive(
          `lot:${parcel.id}:rubble:${index + 1}`,
          'lots',
          {
            x: round3(rng.float(safe.minX + size / 2, safe.maxX - size / 2)),
            y: round3(groundY + 0.12 + size / 2),
            z: round3(rng.float(safe.minZ + size / 2, safe.maxZ - size / 2)),
          },
          { width: size, height: size, depth: round3(rng.float(0.4, 1.2)) },
          round3(rng.float(0, Math.PI)),
        ),
      )
    }
    // A cleared lot keeps its party walls: two low stub walls on the long edges.
    primitives.push(
      boxPrimitive(
        `lot:${parcel.id}:party-wall:north`,
        'lots',
        { x: plate.centreX, y: round3(groundY + 0.5), z: round3(plate.minZ + 0.2) },
        { width: plate.width, height: 1, depth: 0.4 },
      ),
      boxPrimitive(
        `lot:${parcel.id}:party-wall:south`,
        'lots',
        { x: plate.centreX, y: round3(groundY + 0.5), z: round3(plate.maxZ - 0.2) },
        { width: plate.width, height: 1, depth: 0.4 },
      ),
    )
    return {
      state,
      label: 'demolished lot with rubble and party-wall stubs',
      primitives,
      triangles: primitiveListTriangles(primitives),
    }
  }

  // Construction site: excavation slab, hoarding, a rising frame and a crane.
  primitives.push(
    boxPrimitive(
      `construction:${parcel.id}:excavation`,
      'construction',
      { x: plate.centreX, y: round3(groundY + 0.08), z: plate.centreZ },
      { width: plate.width, height: 0.16, depth: plate.depth },
    ),
  )
  const hoardingHeight = 2.4
  primitives.push(
    boxPrimitive(
      `construction:${parcel.id}:hoarding:north`,
      'construction',
      { x: plate.centreX, y: round3(groundY + hoardingHeight / 2), z: round3(plate.minZ + 0.1) },
      { width: plate.width, height: hoardingHeight, depth: 0.2 },
    ),
    boxPrimitive(
      `construction:${parcel.id}:hoarding:south`,
      'construction',
      { x: plate.centreX, y: round3(groundY + hoardingHeight / 2), z: round3(plate.maxZ - 0.1) },
      { width: plate.width, height: hoardingHeight, depth: 0.2 },
    ),
    boxPrimitive(
      `construction:${parcel.id}:hoarding:east`,
      'construction',
      { x: round3(plate.maxX - 0.1), y: round3(groundY + hoardingHeight / 2), z: plate.centreZ },
      { width: 0.2, height: hoardingHeight, depth: Math.max(0.2, plate.depth - 0.4) },
    ),
    boxPrimitive(
      `construction:${parcel.id}:hoarding:west`,
      'construction',
      { x: round3(plate.minX + 0.1), y: round3(groundY + hoardingHeight / 2), z: plate.centreZ },
      { width: 0.2, height: hoardingHeight, depth: Math.max(0.2, plate.depth - 0.4) },
    ),
  )

  const frame = insetPlotRect(plate, 2)
  const frameRect = frame.width > 4 && frame.depth > 4 ? frame : insetPlotRect(plate, 1)
  const frameLevels = Math.max(2, rng.int(2, 5))
  const columnHeight = 3.4
  for (let index = 0; index < frameLevels; index += 1) {
    const y = round3(groundY + columnHeight / 2 + index * columnHeight)
    for (const corner of [
      { x: frameRect.minX + 0.25, z: frameRect.minZ + 0.25 },
      { x: frameRect.maxX - 0.25, z: frameRect.minZ + 0.25 },
      { x: frameRect.maxX - 0.25, z: frameRect.maxZ - 0.25 },
      { x: frameRect.minX + 0.25, z: frameRect.maxZ - 0.25 },
    ]) {
      primitives.push(
        boxPrimitive(
          `construction:${parcel.id}:column:${index}:${round3(corner.x)}`,
          'construction',
          { x: corner.x, y, z: corner.z },
          { width: 0.4, height: columnHeight, depth: 0.4 },
        ),
      )
    }
    // Only the lower levels have their slab poured, so the site reads as work
    // in progress rather than a finished frame.
    if (index < 3) {
      primitives.push(
        boxPrimitive(
          `construction:${parcel.id}:slab:${index + 1}`,
          'construction',
          { x: frameRect.centreX, y: round3(y + columnHeight / 2), z: frameRect.centreZ },
          { width: frameRect.width, height: 0.24, depth: frameRect.depth },
        ),
      )
    }
  }

  const mastHeight = Math.max(12, Math.min(60, parcel.capacity.maxHeight * 1.4))
  primitives.push(
    boxPrimitive(
      `construction:${parcel.id}:crane:mast`,
      'construction',
      { x: round3(frameRect.minX + 0.8), y: round3(groundY + mastHeight / 2), z: round3(frameRect.minZ + 0.8) },
      { width: 0.9, height: round3(mastHeight), depth: 0.9 },
    ),
    boxPrimitive(
      `construction:${parcel.id}:crane:jib`,
      'construction',
      { x: round3(frameRect.minX + 0.8 + frameRect.width / 3), y: round3(groundY + mastHeight + 0.5), z: round3(frameRect.minZ + 0.8) },
      { width: (frameRect.width * 2) / 3, height: 0.6, depth: 0.6 },
    ),
  )

  return {
    state,
    label: 'cleared site with hoarding, rising frame and tower crane',
    primitives,
    triangles: primitiveListTriangles(primitives),
  }
}

/* ------------------------------------------------------------------------- *
 * Per-parcel planning
 * ------------------------------------------------------------------------- */

/** Input of {@link planPlot}. */
export interface PlanPlotOptions {
  readonly parcel: Parcel
  readonly state: BuildingStateKind
  readonly eraId: EraId
  readonly table: BuildingEraTable
  readonly detail: number
  readonly anchor: Anchor | undefined
  readonly rng: Rng
}

/** Empty facade plan of a parcel with no building. */
export function emptyFacadePlan(table: BuildingEraTable): FacadePlan {
  return {
    style: table.facade.style,
    grid: {
      windowWidth: table.facade.windowWidth,
      windowHeight: table.facade.windowHeight,
      spacingX: table.facade.columnPitch,
      spacingY: table.massing.groundFloorHeight,
      sillHeight: table.facade.sillHeight,
      columns: 0,
      rows: 0,
      aspect: round3(table.facade.windowWidth / table.facade.windowHeight),
    },
    edges: [],
    windowCount: 0,
    glazingRatio: 0,
    masonryCourses: 0,
    spandrelBands: 0,
    mullions: 0,
    balconies: 0,
    exposedFrame: false,
    groundFloorClear: false,
    frontage: [],
    addOns: [],
    primitives: [],
    triangles: 0,
  }
}

/** A wall volume while the planner is still assigning storeys to it. */
interface WallVolume {
  readonly id: string
  readonly role: FacadeMassInput['role']
  readonly rect: PlotRect
  readonly baseY: number
  readonly topY: number
  readonly groundFloor: boolean
  readonly storeys: number[]
}

/** Plans one parcel for one era. */
export function planPlot(options: PlanPlotOptions): BuildingPlot {
  const { parcel, state, eraId, table, detail, anchor, rng } = options
  const massing = table.massing
  const capacity = parcel.capacity
  const bounds = toPlotRect(parcel.cell)
  const parcelPlate = toPlotRect(parcel.footprint)
  const groundY = CURB_HEIGHT
  const role: ParcelRole =
    parcel.corner !== null ? 'corner' : parcel.facing.length > 0 ? 'street' : 'interior'
  const anchorName = `parcel:${parcel.id}:prop:1`

  const stateDetail = planStateDressing(parcel, state, parcelPlate, groundY, rng)

  if (state !== 'building') {
    return {
      parcelId: parcel.id,
      eraId,
      state,
      role,
      facing: [...parcel.facing],
      corner: parcel.corner,
      groundY,
      capacityHeight: capacity.maxHeight,
      capacityFloors: capacity.floors,
      height: 0,
      floors: 0,
      floorHeight: 0,
      groundFloorHeight: massing.groundFloorHeight,
      coverage: 0,
      footprint: parcelPlate,
      basePlate: parcelPlate,
      upperPlate: parcelPlate,
      masses: [],
      massRoles: [],
      podium: null,
      setbackCount: 0,
      facade: emptyFacadePlan(table),
      rooftop: emptyRooftopPlan(table.roof.kit, parcelPlate, groundY),
      frontage: [],
      anchorNames: [anchorName],
      addOns: [],
      stateDetail,
    }
  }

  // --- size the massing --------------------------------------------------
  const jitter = 1 + rng.float(-massing.heightJitter, massing.heightJitter)
  const floorHeight = round3(rng.float(massing.floorHeight.min, massing.floorHeight.max))
  const target = capacity.maxHeight * massing.heightScale * jitter
  const rawFloors = Math.round((target - massing.groundFloorHeight) / floorHeight) + 1
  const floors = Math.min(massing.floorRange.max, Math.max(massing.floorRange.min, rawFloors))
  const height = round3(massing.groundFloorHeight + (floors - 1) * floorHeight)
  const scale = rng.float(massing.footprintScale.min, massing.footprintScale.max)
  const insetX = (parcelPlate.width * (1 - scale)) / 2
  const insetZ = (parcelPlate.depth * (1 - scale)) / 2
  const footprint = clampPlotRect(
    insetPlotRectSides(parcelPlate, insetX, insetZ, insetX, insetZ),
    parcelPlate,
  )

  const storeyBases: number[] = []
  for (let index = 0; index < floors; index += 1) {
    storeyBases.push(
      round3(groundY + (index === 0 ? 0 : massing.groundFloorHeight + (index - 1) * floorHeight)),
    )
  }

  const crownHeight = round3(Math.min(massing.crownHeight, Math.max(0.2, height * 0.12)))
  const wallTop = round3(groundY + height - crownHeight)
  const buildingTop = round3(groundY + height)

  // --- stack the volumes -------------------------------------------------
  const masses: BoxPrimitive[] = []
  const massRoles: MassRole[] = []
  const walls: WallVolume[] = []
  let podium: { rect: PlotRect; height: number } | null = null
  let basePlate = footprint
  let upperPlate = footprint
  let setbackCount = 0

  const pushWall = (
    id: string,
    roleName: FacadeMassInput['role'],
    rect: PlotRect,
    y0: number,
    y1: number,
  ): WallVolume => {
    masses.push(
      boxPrimitive(
        `building:${parcel.id}:mass:${id}`,
        'masses',
        { x: rect.centreX, y: round3((y0 + y1) / 2), z: rect.centreZ },
        { width: rect.width, height: round3(y1 - y0), depth: rect.depth },
      ),
    )
    massRoles.push(roleName)
    const wall: WallVolume = {
      id,
      role: roleName,
      rect,
      baseY: round3(y0),
      topY: round3(y1),
      groundFloor: roleName === 'podium' || roleName === 'base',
      storeys: [],
    }
    walls.push(wall)
    return wall
  }

  if (massing.podiumHeight !== null && massing.podiumHeight < height - crownHeight - floorHeight * 1.5) {
    const podiumHeight = round3(massing.podiumHeight)
    pushWall('podium', 'podium', footprint, groundY, groundY + podiumHeight)
    podium = { rect: footprint, height: podiumHeight }
    const inset = rng.float(massing.towerInset.min, massing.towerInset.max)
    const towerRect = insetPlotRect(footprint, inset)
    upperPlate = towerRect.width > 4 && towerRect.depth > 4 ? towerRect : footprint
    pushWall('tower', 'tower', upperPlate, groundY + podiumHeight, wallTop)
  } else {
    const requested = rng.int(massing.setbackCount.min, massing.setbackCount.max + 1)
    const span = wallTop - groundY
    // The base volume always carries the ground storey plus a slice of the one
    // above it, so the shopfront mass reads as a full storey height.
    const baseSpan = Math.min(
      span,
      Math.max(span / (requested + 1), massing.groundFloorHeight + floorHeight * 0.6),
    )
    const remaining = span - baseSpan
    const steps = remaining > floorHeight * 1.2 ? requested : 0
    setbackCount = steps
    const stepHeight = steps > 0 ? remaining / steps : 0
    let rect = footprint
    pushWall('shaft', 'base', rect, groundY, groundY + baseSpan)
    for (let index = 1; index <= steps; index += 1) {
      const y0 = groundY + baseSpan + (index - 1) * stepHeight
      const y1 = groundY + baseSpan + index * stepHeight
      const stepInset = rng.float(massing.setbackInset.min, massing.setbackInset.max)
      const next = insetPlotRect(rect, stepInset)
      rect = next.width > 4 && next.depth > 4 ? next : rect
      pushWall(`setback-${index}`, 'setback', rect, y0, y1)
    }
    upperPlate = rect
  }
  basePlate = podium === null ? footprint : podium.rect

  if (crownHeight > 0.1) {
    const crownRect = clampPlotRect(expandPlotRect(upperPlate, 0.22), bounds)
    masses.push(
      boxPrimitive(
        `building:${parcel.id}:mass:crown`,
        'masses',
        { x: crownRect.centreX, y: round3(wallTop + crownHeight / 2), z: crownRect.centreZ },
        { width: crownRect.width, height: crownHeight, depth: crownRect.depth },
      ),
    )
    massRoles.push('crown')
  }

  // Every storey belongs to the volume that contains its base.
  for (let index = 0; index < storeyBases.length; index += 1) {
    const base = at(storeyBases, index)
    const owner =
      walls.find((wall) => base >= wall.baseY && base < wall.topY) ??
      walls[walls.length - 1]
    owner?.storeys.push(index)
  }

  // --- walls and roof ----------------------------------------------------
  const facade = planFacades({
    parcel,
    table,
    detail,
    masses: walls,
    storeyBases,
    buildingTop: wallTop,
    groundFloorHeight: massing.groundFloorHeight,
    bounds,
    rng,
  })
  const rooftop = planRooftop({
    parcelId: parcel.id,
    table,
    roofY: buildingTop,
    plate: upperPlate,
    bounds,
    anchor,
    rng,
  })

  const addOns: PlacedAddOn[] = [...facade.addOns, ...rooftop.addOns]
  const anchorNames = [
    anchorName,
    ...facade.frontage.map((clearance) => clearance.anchor),
  ]

  return {
    parcelId: parcel.id,
    eraId,
    state,
    role,
    facing: [...parcel.facing],
    corner: parcel.corner,
    groundY,
    capacityHeight: capacity.maxHeight,
    capacityFloors: capacity.floors,
    height,
    floors,
    floorHeight,
    groundFloorHeight: massing.groundFloorHeight,
    coverage: round3(footprint.area / Math.max(1, parcelPlate.area)),
    footprint,
    basePlate,
    upperPlate,
    masses,
    massRoles,
    podium,
    setbackCount,
    facade,
    rooftop,
    frontage: facade.frontage,
    anchorNames,
    addOns,
    stateDetail,
  }
}

/* ------------------------------------------------------------------------- *
 * The whole block
 * ------------------------------------------------------------------------- */

/** Triangles one plot mounts: walls, facades, roof kit, dressing and add-ons. */
export function plotTriangles(plot: BuildingPlot): number {
  return (
    primitiveListTriangles(plot.masses) +
    facadeTriangles(plot.facade) +
    plot.rooftop.triangles +
    plot.stateDetail.triangles +
    plot.addOns.length * PRIMITIVE_TRIANGLES.box
  )
}

/** Facade triangles of a plot, including its wall detail. */
function facadeTriangles(facade: FacadePlan): number {
  return facade.triangles
}

/** Mesh count of the add-on batch: one per instanced kind, else one per box. */
export function addOnBatch(
  counts: Readonly<Record<AddOnKind, number>>,
  tier: QualityTierName,
): { readonly meshCount: number; readonly instancedKinds: number } {
  let meshCount = 0
  let instancedKinds = 0
  for (const kind of ADD_ON_KINDS) {
    const count = counts[kind]
    if (count <= 0) {
      continue
    }
    if (shouldInstance(count, tier)) {
      meshCount += 1
      instancedKinds += 1
    } else {
      meshCount += count
    }
  }
  return { meshCount, instancedKinds }
}

/** Summarises a plan into the counters the layer publishes. */
export function summarisePlan(
  plots: readonly BuildingPlot[],
  options: {
    readonly eraId: EraId
    readonly night: boolean
    readonly tier: QualityTierName
    readonly windowEmissiveIntensity: number
    readonly floorEfficiency: number
  },
): BuildingLayerStats {
  const buildings = plots.filter((plot) => plot.state === 'building')
  const vacant = plots.filter((plot) => plot.state === 'vacant-lot')
  const construction = plots.filter((plot) => plot.state === 'construction')
  const addOns = plots.flatMap((plot) => plot.addOns)
  const addOnsByKind = countAddOnKinds(addOns)
  const batch = addOnBatch(addOnsByKind, options.tier)

  const heights = buildings.map((plot) => plot.height)
  const floors = buildings.map((plot) => plot.floors)
  const footprints = buildings.map((plot) => plot.footprint.area)
  const coverage = buildings.map((plot) => plot.coverage)
  const windowCount = buildings.reduce((total, plot) => total + plot.facade.windowCount, 0)

  const roofKitsByKit: Record<RoofKitId, number> = emptyRoofKitCounts()
  for (const plot of buildings) {
    roofKitsByKit[plot.rooftop.kit] += 1
  }

  const meshCount = buildings.length * 3 + vacant.length + construction.length + batch.meshCount
  const triangleEstimate = plots.reduce((total, plot) => total + plotTriangles(plot), 0)
  const floorAreaTotal = buildings.reduce(
    (total, plot) => total + plot.footprint.area * plot.floors * options.floorEfficiency,
    0,
  )

  return {
    eraId: options.eraId,
    night: options.night,
    parcelCount: plots.length,
    buildingCount: buildings.length,
    vacantLotCount: vacant.length,
    constructionCount: construction.length,
    heightMin: buildings.length > 0 ? Math.min(...heights) : 0,
    heightMax: heights.length > 0 ? Math.max(...heights) : 0,
    heightMean: mean(heights),
    floorsMin: floors.length > 0 ? Math.min(...floors) : 0,
    floorsMax: floors.length > 0 ? Math.max(...floors) : 0,
    floorsMean: mean(floors),
    footprintAreaMean: mean(footprints),
    footprintAreaTotal: round3(footprints.reduce((total, area) => total + area, 0)),
    coverageMean: mean(coverage),
    floorAreaTotal: round3(floorAreaTotal),
    windowCount,
    windowCountPerBuilding: buildings.length > 0 ? round3(windowCount / buildings.length) : 0,
    facadeEdgeCount: buildings.reduce((total, plot) => total + plot.facade.edges.length, 0),
    masonryCourseCount: buildings.reduce((total, plot) => total + plot.facade.masonryCourses, 0),
    spandrelBandCount: buildings.reduce((total, plot) => total + plot.facade.spandrelBands, 0),
    mullionCount: buildings.reduce((total, plot) => total + plot.facade.mullions, 0),
    balconyCount: buildings.reduce((total, plot) => total + plot.facade.balconies, 0),
    roofKitCount: buildings.length,
    roofKitsByKit,
    addOnCount: addOns.length,
    addOnsByKind,
    addOnMeshCount: batch.meshCount,
    instancedAddOnKinds: batch.instancedKinds,
    frontageClearanceCount: buildings.reduce((total, plot) => total + plot.frontage.length, 0),
    anchorCount: new Set(plots.flatMap((plot) => plot.anchorNames)).size,
    primitiveCount: plots.reduce(
      (total, plot) =>
        total +
        plot.masses.length +
        plot.facade.primitives.length +
        plot.rooftop.primitives.length +
        plot.stateDetail.primitives.length +
        plot.addOns.length,
      0,
    ),
    triangleEstimate,
    meshCount,
    drawCallEstimate: meshCount,
    materialCount: 8,
    textureRequestCount: 4,
    windowEmissiveIntensity: options.windowEmissiveIntensity,
    triangleBudget: BUILDING_TRIANGLE_BUDGETS[options.tier],
    drawCallBudget: BUILDING_DRAW_CALL_BUDGETS[options.tier],
  }
}

/** Arithmetic mean of a list; 0 for an empty list. */
function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }
  return round3(values.reduce((total, value) => total + value, 0) / values.length)
}

/**
 * Plans one era over the shared block.
 *
 * Deterministic from the block seed plus the era id: the same pair always
 * produces byte-identical primitives, and two eras of the same block never
 * share a draw.
 */
export function planBuildingSet(options: PlanBuildingSetOptions): BuildingSetPlan {
  const era = typeof options.eraId === 'string' ? getEra(options.eraId) : options.eraId
  const table = getBuildingTable(era.id)
  const tier = options.qualityTier ?? 'high'
  const detail = resolveDetail(tier, options.detail)
  const seed: Seed = options.seed ?? options.layout.seedInput
  const root = createRng(`${String(seed)}:buildings:${era.id}:${table.seedTag}`, 'city-buildings')

  const anchorsByName = new Map(options.layout.anchors.map((anchor) => [anchor.name, anchor]))
  const states = assignParcelStates(options.layout.parcels, table, root.fork('states'))

  const plots = options.layout.parcels.map((parcel) =>
    planPlot({
      parcel,
      state: states.get(parcel.id) ?? 'building',
      eraId: era.id,
      table,
      detail,
      anchor: anchorsByName.get(`parcel:${parcel.id}:prop:1`),
      rng: root.fork(`parcel:${parcel.id}`),
    }),
  )

  const anchorsUsed = [...new Set(plots.flatMap((plot) => plot.anchorNames))].sort()

  return {
    eraId: era.id,
    year: era.year,
    seed,
    tier,
    detail,
    night: table.night,
    plots,
    anchorsUsed,
    stats: summarisePlan(plots, {
      eraId: era.id,
      night: table.night,
      tier,
      windowEmissiveIntensity: table.windowEmissiveIntensity,
      floorEfficiency: table.massing.floorEfficiency,
    }),
  }
}

/** Canonical fingerprint of a plan, for determinism checks and caching keys. */
export function buildingSetFingerprint(plan: BuildingSetPlan): string {
  return JSON.stringify(plan.plots)
}

/* ------------------------------------------------------------------------- *
 * Blending (used by applyEraTransition)
 * ------------------------------------------------------------------------- */

function lerp(from: number, to: number, t: number): number {
  return round3(from + (to - from) * t)
}

function lerpRecord<K extends string>(
  from: Readonly<Record<K, number>>,
  to: Readonly<Record<K, number>>,
  t: number,
  keys: readonly K[],
): Record<K, number> {
  const blended = {} as Record<K, number>
  for (const key of keys) {
    blended[key] = lerp(from[key], to[key], t)
  }
  return blended
}

/**
 * Effective statistics of a cross-fade at weight `t`.
 *
 * Every era characterisation interpolates linearly, so `t = 0` reports exactly
 * the `from` era, `t = 1` exactly the `to` era, and any intermediate value sits
 * between them — which is what a staged rebuild looks like on screen: the
 * outgoing block shrinks while the incoming one grows through it.
 */
export function blendBuildingStats(
  from: BuildingLayerStats,
  to: BuildingLayerStats,
  t: number,
): BuildingLayerStats {
  const weight = Math.min(1, Math.max(0, t))
  const dominant = weight >= 0.5 ? to : from
  return {
    eraId: dominant.eraId,
    night: dominant.night,
    parcelCount: dominant.parcelCount,
    buildingCount: lerp(from.buildingCount, to.buildingCount, weight),
    vacantLotCount: lerp(from.vacantLotCount, to.vacantLotCount, weight),
    constructionCount: lerp(from.constructionCount, to.constructionCount, weight),
    heightMin: lerp(from.heightMin, to.heightMin, weight),
    heightMax: lerp(from.heightMax, to.heightMax, weight),
    heightMean: lerp(from.heightMean, to.heightMean, weight),
    floorsMin: lerp(from.floorsMin, to.floorsMin, weight),
    floorsMax: lerp(from.floorsMax, to.floorsMax, weight),
    floorsMean: lerp(from.floorsMean, to.floorsMean, weight),
    footprintAreaMean: lerp(from.footprintAreaMean, to.footprintAreaMean, weight),
    footprintAreaTotal: lerp(from.footprintAreaTotal, to.footprintAreaTotal, weight),
    coverageMean: lerp(from.coverageMean, to.coverageMean, weight),
    floorAreaTotal: lerp(from.floorAreaTotal, to.floorAreaTotal, weight),
    windowCount: lerp(from.windowCount, to.windowCount, weight),
    windowCountPerBuilding: lerp(from.windowCountPerBuilding, to.windowCountPerBuilding, weight),
    facadeEdgeCount: lerp(from.facadeEdgeCount, to.facadeEdgeCount, weight),
    masonryCourseCount: lerp(from.masonryCourseCount, to.masonryCourseCount, weight),
    spandrelBandCount: lerp(from.spandrelBandCount, to.spandrelBandCount, weight),
    mullionCount: lerp(from.mullionCount, to.mullionCount, weight),
    balconyCount: lerp(from.balconyCount, to.balconyCount, weight),
    roofKitCount: lerp(from.roofKitCount, to.roofKitCount, weight),
    roofKitsByKit: lerpRecord(from.roofKitsByKit, to.roofKitsByKit, weight, ROOF_KIT_IDS),
    addOnCount: lerp(from.addOnCount, to.addOnCount, weight),
    addOnsByKind: lerpRecord(from.addOnsByKind, to.addOnsByKind, weight, ADD_ON_KINDS),
    addOnMeshCount: lerp(from.addOnMeshCount, to.addOnMeshCount, weight),
    instancedAddOnKinds: lerp(from.instancedAddOnKinds, to.instancedAddOnKinds, weight),
    frontageClearanceCount: lerp(from.frontageClearanceCount, to.frontageClearanceCount, weight),
    anchorCount: lerp(from.anchorCount, to.anchorCount, weight),
    primitiveCount: lerp(from.primitiveCount, to.primitiveCount, weight),
    triangleEstimate: lerp(from.triangleEstimate, to.triangleEstimate, weight),
    meshCount: lerp(from.meshCount, to.meshCount, weight),
    drawCallEstimate: lerp(from.drawCallEstimate, to.drawCallEstimate, weight),
    materialCount: lerp(from.materialCount, to.materialCount, weight),
    textureRequestCount: lerp(from.textureRequestCount, to.textureRequestCount, weight),
    windowEmissiveIntensity: lerp(from.windowEmissiveIntensity, to.windowEmissiveIntensity, weight),
    triangleBudget: Math.min(from.triangleBudget, to.triangleBudget),
    drawCallBudget: Math.min(from.drawCallBudget, to.drawCallBudget),
  }
}

