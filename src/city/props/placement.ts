/**
 * Deterministic placement of an era's props on the block's layout anchors.
 *
 * This module is pure data-in / data-out: it never imports three.js and never
 * touches a renderer, so the same code decides what the renderer draws and what
 * the unit and composition suites assert.
 *
 * ## What it guarantees
 *
 * 1. **Full coverage, exactly once.** For every anchor category an era demands
 *    (see `SLOT_FILTERS`), every matching layout anchor receives exactly one
 *    prop, chosen from the era's pool round-robin. Pools are validated against
 *    the era's lifespans in `tables.ts`, so a period only shows props it owns.
 * 2. **Legality.** Each prop's footprint is measured against the layout's build
 *    line, kerb, walking line and corner fillets, so the whole object stays on
 *    the sidewalk: never in the walking band, never on the carriageway, never
 *    inside a building envelope. Props that would collide are slid along the
 *    street by a fixed, deterministic amount.
 * 3. **Determinism.** Every draw comes from `createRng(layout.seedInput)` forked
 *    by era, slot and anchor name, so placement, scale jitter, per-prop wear and
 *    the transition stagger all rebuild from the block seed plus the era.
 *
 * ## Reading the layout
 *
 * A prop's local frame is `+x` along the street and `+z` toward the kerb (see
 * `recipes.ts`). The solver converts that frame into the street's own axes:
 * `outward` (away from the block, toward the kerb) and `direction` (the travel
 * direction of the block-side lanes), so the same recipe works on all four
 * streets and all seven anchor categories.
 */

import { getEra, getNeighbouringEras, type EraDefinition, type EraId } from '../../era'
import {
  BLOCK_DECK_HEIGHT,
  BLOCK_HALF,
  BUILD_LINE,
  CORNER_RADIUS,
  SIDEWALK_WALK_LINE,
  classifyGround,
  round,
  v3,
  type Anchor,
  type BlockLayout,
  type StreetDescriptor,
  type StreetName,
  type Vec3,
} from '../layout'
import { createRng, type Rng } from '../../lib/rng'
import { DEFAULT_QUALITY_TIER, type QualityTierName } from '../../lib/quality'
import { getPropRecipe, recipeDetail } from './recipes'
import {
  PROP_TABLE_ERA_IDS,
  eraCatalogue,
  getEraPropTable,
  isPropAvailableInEra,
  propsRetiredByEra,
} from './tables'
import {
  LAMP_BASE_LIGHT_INTENSITY,
  LAMP_DAY_EMISSIVE_SCALE,
  LAMP_NIGHT_EMISSIVE_SCALE,
  MAX_GROUND_PROP_DEPTH,
  MAX_PROP_HEIGHT,
  PROP_CLEARANCE,
  PROP_SLOTS,
  SIDEWALK_SUB_BAND_DEPTH,
  SLOT_FILTERS,
  WALKING_BAND_HALF_WIDTH,
  type LampTechnology,
  type PlacedLamp,
  type PlacedProp,
  type PropBand,
  type PropPlanIssue,
  type PropRecipe,
  type PropSlot,
  type PropsCensus,
  type PropsLayerPlan,
  type PropsPlanOptions,
  type PropsTransitionInput,
  type PropsTransitionPlan,
  type SlotCoverage,
  type StagedProp,
  type WearProfile,
} from './types'
import { mergeWear } from './recipes'

/* ------------------------------------------------------------------------- *
 * Tuning constants
 * ------------------------------------------------------------------------- */

/** Geometry tolerance used by every legality test, in metres. */
export const PLACEMENT_EPSILON = 0.02

/** Deterministic slide distances tried when a station is already occupied. */
export const SLIDE_OFFSETS: readonly number[] = [
  0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.25, -2.25, 2.7, -2.7,
]

/** Range the along-street jitter is drawn from, in metres. */
export const ALONG_JITTER = 0.3

/**
 * Spacing and count of the spread stations the solver tries when the anchor's own
 * along coordinate is already outside the legal range.
 *
 * A corner anchor publishes an along coordinate of ±59 m, but the sidewalk only
 * fits a prop up to about ±56.5 m once the kerb fillet is accounted for, so a
 * fixed slide list clamped to the limit would collapse onto one station. The
 * spread walks inwards from both ends of the legal range instead, which is what
 * lets straight, corner and clash-avoidance placements all be solved with the
 * same deterministic search.
 */
export const STATION_SPREAD_STEP = 0.45

/** How many spread steps are generated inwards from each end of the range. */
export const STATION_SPREAD_STEPS = 10

/** Fractions of the era switch during which a prop's appear/disappear ramps. */
export const PROP_STAGGER_SPAN = 0.35

/**
 * Lowest era artificial-light level that still counts as "the lamps are on".
 *
 * Real point lights are only mounted at night (see {@link resolveNight}): a
 * daylight era keeps its lamps' emissive glow, but does not light the street.
 */
export const LAMP_POINT_LIGHT_MIN_INTENSITY = 0.05

/** Light a lamp keeps while its era is in daylight. */
export const LAMP_DAY_LIGHT_FRACTION = 0.35

/** Point-light limit per quality tier, applied to the era's own limit. */
export const POINT_LIGHT_LIMIT_BY_TIER: Readonly<Record<QualityTierName, number>> = {
  high: Number.POSITIVE_INFINITY,
  medium: 2,
  low: 1,
}

/** Labels the PRNG streams so every draw is reproducible and inspectable. */
export const PROPS_RNG_LABEL = 'era-props'

/* ------------------------------------------------------------------------- *
 * Anchor selection
 * ------------------------------------------------------------------------- */

/** True when a layout anchor belongs to one slot of the layer. */
export function anchorMatchesSlot(layout: BlockLayout, anchor: Anchor, slot: PropSlot): boolean {
  const filter = SLOT_FILTERS[slot]
  if (anchor.kind !== filter.kind) {
    return false
  }
  if (filter.tag !== null && !anchor.tags.includes(filter.tag)) {
    return false
  }
  if (filter.ownerKind !== null && anchor.owner.kind !== filter.ownerKind) {
    return false
  }
  if (filter.sidewalkOnly && isInsideBuilding(layout, anchor.position.x, anchor.position.z)) {
    // The anchor points into a building: an interior parcel's second prop point,
    // which no street prop may occupy.
    return false
  }
  return true
}

/** The layout anchors of one slot, in the catalogue's name order. */
export function anchorsForSlot(layout: BlockLayout, slot: PropSlot): readonly Anchor[] {
  return layout.anchors.filter((anchor) => anchorMatchesSlot(layout, anchor, slot))
}

/**
 * True when a ground position is inside a parcel's building envelope.
 *
 * A street-facing prop point sits *on* the facade line, which is inside its
 * parcel cell but on the edge of the footprint, so the test shrinks the
 * footprint by a centimetre: touching the facade is legal, standing inside the
 * building is not.
 */
export function isInsideBuilding(layout: BlockLayout, x: number, z: number): boolean {
  const inset = 0.01
  return layout.parcels.some(
    (parcel) =>
      x > parcel.footprint.min.x + inset &&
      x < parcel.footprint.max.x - inset &&
      z > parcel.footprint.min.z + inset &&
      z < parcel.footprint.max.z - inset,
  )
}

/** Anchors the layer deliberately leaves alone (storefront, sign, parking, parcel focus). */
export function reservedAnchorNames(layout: BlockLayout): readonly string[] {
  const claimed = new Set<string>()
  for (const slot of PROP_SLOTS) {
    for (const anchor of anchorsForSlot(layout, slot)) {
      claimed.add(anchor.name)
    }
  }
  return layout.anchors
    .filter((anchor) => !claimed.has(anchor.name))
    .map((anchor) => anchor.name)
    .sort()
}

/* ------------------------------------------------------------------------- *
 * Street frames and orientation
 * ------------------------------------------------------------------------- */

function signOf(value: number): 1 | -1 {
  return value < 0 ? -1 : 1
}

/** The street an anchor stands on, or `null` for a rooftop anchor. */
export function streetForAnchor(layout: BlockLayout, anchor: Anchor): StreetDescriptor | null {
  if (anchor.facing !== null) {
    return layout.streets.find((street) => street.name === anchor.facing) ?? null
  }
  let best: StreetDescriptor | null = null
  let bestDistance = 0
  for (const street of layout.streets) {
    const across = street.acrossAxis === 'x' ? anchor.position.x : anchor.position.z
    const distance = Math.abs(across)
    if (distance > BUILD_LINE && distance > bestDistance) {
      best = street
      bestDistance = distance
    }
  }
  return best
}

/** Coordinate of a point along a street's own axis. */
function alongCoordinate(street: StreetDescriptor, point: Vec3): number {
  return street.axis === 'x' ? point.x : point.z
}

/** Coordinate of a point across a street (its outward axis). */
function acrossCoordinate(street: StreetDescriptor, point: Vec3): number {
  return street.acrossAxis === 'x' ? point.x : point.z
}

/** World position of a street-relative (along, across) station. */
function streetToWorld(street: StreetDescriptor, along: number, across: number, height: number): Vec3 {
  return street.axis === 'x' ? v3(along, height, across) : v3(across, height, along)
}

/** Snaps a yaw to the street grid so every prop sits orthogonally. */
function snapYaw(yaw: number): number {
  const quarter = Math.PI / 2
  return Math.round(yaw / quarter) * quarter
}

/**
 * Rotation of a recipe about its anchor.
 *
 * `local +z` points along {@link PropRecipe.facing}; for `along-street` recipes
 * `local +x` follows the street's travel direction, which is what lets a signal
 * head face oncoming traffic while its mast arm runs parallel to the kerb.
 */
export function propYaw(recipe: PropRecipe, anchor: Anchor, street: StreetDescriptor | null): number {
  const outward = street?.outward ?? v3(0, 0, 1)
  switch (recipe.facing) {
    case 'outward':
      return snapYaw(Math.atan2(outward.x, outward.z))
    case 'inward':
      return snapYaw(Math.atan2(-outward.x, -outward.z))
    case 'along-street': {
      const direction = street?.direction ?? v3(1, 0, 0)
      return snapYaw(Math.atan2(-direction.z, direction.x))
    }
    case 'anchor-normal': {
      const normal = anchor.normal
      if (Math.hypot(normal.x, normal.z) < 0.5) {
        return snapYaw(Math.atan2(outward.x, outward.z))
      }
      return snapYaw(Math.atan2(normal.x, normal.z))
    }
  }
}

/** Local x/z axes of a prop after its yaw, in world axes. */
function yawAxes(yaw: number): { readonly along: { x: number; z: number }; readonly across: { x: number; z: number } } {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return { along: { x: cos, z: -sin }, across: { x: sin, z: cos } }
}

/** Bounds of a recipe's scaled geometry, in world axes, relative to its contact. */
export interface ContactExtents {
  readonly xMin: number
  readonly xMax: number
  readonly zMin: number
  readonly zMax: number
  readonly minY: number
  readonly maxY: number
  readonly width: number
  readonly depth: number
  readonly height: number
}

/**
 * Extents of a recipe about its contact point.
 *
 * Every yaw the catalogue uses is a multiple of a quarter turn, so transforming
 * the two local extents is exact: no conservative padding is needed and the
 * footprint the planner measures is the footprint the renderer draws.
 */
export function contactExtents(recipe: PropRecipe, yaw: number): ContactExtents {
  const axes = yawAxes(yaw)
  const [contactX, contactY, contactZ] = recipe.contact
  const localX = [recipe.bounds.minX - contactX, recipe.bounds.maxX - contactX]
  const localZ = [recipe.bounds.minZ - contactZ, recipe.bounds.maxZ - contactZ]
  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let zMin = Number.POSITIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY
  for (const lx of localX) {
    for (const lz of localZ) {
      const x = axes.along.x * lx + axes.across.x * lz
      const z = axes.along.z * lx + axes.across.z * lz
      xMin = Math.min(xMin, x)
      xMax = Math.max(xMax, x)
      zMin = Math.min(zMin, z)
      zMax = Math.max(zMax, z)
    }
  }
  const minY = round(recipe.bounds.minY - contactY, 4)
  const maxY = round(recipe.bounds.maxY - contactY, 4)
  return {
    xMin: round(xMin, 4),
    xMax: round(xMax, 4),
    zMin: round(zMin, 4),
    zMax: round(zMax, 4),
    minY,
    maxY,
    width: round(xMax - xMin, 4),
    depth: round(zMax - zMin, 4),
    // Height counts from the contact plane, matching `PropRecipe.height`.
    height: round(maxY - Math.min(0, minY), 4),
  }
}

/** World axis-aligned bounds of a placed prop. */
export interface PlacedBounds {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}

function boundsOf(contact: Vec3, extents: ContactExtents): PlacedBounds {
  return {
    minX: round(contact.x + extents.xMin),
    maxX: round(contact.x + extents.xMax),
    minY: round(contact.y + extents.minY),
    maxY: round(contact.y + extents.maxY),
    minZ: round(contact.z + extents.zMin),
    maxZ: round(contact.z + extents.zMax),
  }
}

/** Footprint corners, edge midpoints and centre: the legality sample set. */
export function footprintSamples(bounds: PlacedBounds): readonly { readonly x: number; readonly z: number }[] {
  const midX = (bounds.minX + bounds.maxX) / 2
  const midZ = (bounds.minZ + bounds.maxZ) / 2
  return [
    { x: bounds.minX, z: bounds.minZ },
    { x: bounds.minX, z: bounds.maxZ },
    { x: bounds.maxX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.maxZ },
    { x: midX, z: bounds.minZ },
    { x: midX, z: bounds.maxZ },
    { x: bounds.minX, z: midZ },
    { x: bounds.maxX, z: midZ },
    { x: midX, z: midZ },
  ]
}

/**
 * True when a ground position is inside the sidewalk walking band.
 *
 * On a straight edge the band is the strip ±{@link WALKING_BAND_HALF_WIDTH}
 * around `SIDEWALK_WALK_LINE`; inside a corner it is the matching annulus of the
 * pedestrian loop, whose radius is `BUILD_LINE - SIDEWALK_WALK_LINE` away from
 * the kerb fillet centre. This mirrors `src/city/layout/splines.ts`, so the props
 * layer and the pedestrian layer agree on where people actually walk.
 */
export function isInWalkingBand(x: number, z: number, halfWidth = WALKING_BAND_HALF_WIDTH): boolean {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax > BUILD_LINE && az > BUILD_LINE) {
    const radial = Math.hypot(ax - BUILD_LINE, az - BUILD_LINE)
    const walkRadius = SIDEWALK_WALK_LINE - BUILD_LINE
    return Math.abs(radial - walkRadius) < halfWidth
  }
  return Math.abs(ax - SIDEWALK_WALK_LINE) < halfWidth || Math.abs(az - SIDEWALK_WALK_LINE) < halfWidth
}

/** Largest `|along|` a point may have at `acrossDistance` and stay on the sidewalk. */
export function cornerAlongLimit(acrossDistance: number): number {
  const inside = CORNER_RADIUS ** 2 - (acrossDistance - BUILD_LINE) ** 2
  const filletReach = inside > 0 ? Math.sqrt(inside) : 0
  return BUILD_LINE + filletReach
}

/** A prop's reach on either side of its contact, expressed in street axes. */
interface StreetReach {
  readonly outward: number
  readonly inward: number
  readonly alongMin: number
  readonly alongMax: number
}

function streetReach(street: StreetDescriptor, extents: ContactExtents, outwardSign: 1 | -1): StreetReach {
  if (street.acrossAxis === 'z') {
    return {
      outward: outwardSign > 0 ? extents.zMax : -extents.zMin,
      inward: outwardSign > 0 ? -extents.zMin : extents.zMax,
      alongMin: extents.xMin,
      alongMax: extents.xMax,
    }
  }
  return {
    outward: outwardSign > 0 ? extents.xMax : -extents.xMin,
    inward: outwardSign > 0 ? -extents.xMin : extents.xMax,
    alongMin: extents.zMin,
    alongMax: extents.zMax,
  }
}

/**
 * Footprint of a prop in its street's own frame.
 *
 * `width` always runs along the street and `depth` always reaches into the
 * sidewalk band, whichever pair of world axes the street uses, so a caller never
 * has to know whether it is looking at a north–south or an east–west frontage.
 */
function streetFootprint(
  extents: ContactExtents,
  street: StreetDescriptor | null,
  roof: boolean,
): { readonly width: number; readonly depth: number } {
  if (roof || street === null || street.acrossAxis === 'z') {
    return { width: extents.width, depth: extents.depth }
  }
  return { width: extents.depth, depth: extents.width }
}

/** Bands a prop may use, ordered by preference for its mount. */
function bandsForMount(mount: PropRecipe['mount']): readonly PropBand[] {  switch (mount) {
    case 'ground':
    case 'kerb':
      return ['kerb-band', 'facade-band']
    case 'facade':
      return ['facade-band', 'kerb-band']
    case 'roof':
      return ['roof']
    case 'pole-top':
      return ['kerb-band']
  }
}

/** Candidate across stations of one band, or `null` when the prop cannot fit. */
function bandStation(
  band: PropBand,
  reach: StreetReach,
  outwardSign: 1 | -1,
): { readonly across: number; readonly innerDistance: number; readonly outerDistance: number } | null {
  if (band === 'roof') {
    return null
  }
  const walkLimit = SIDEWALK_WALK_LINE - WALKING_BAND_HALF_WIDTH - PROP_CLEARANCE
  const walkFloor = SIDEWALK_WALK_LINE + WALKING_BAND_HALF_WIDTH + PROP_CLEARANCE
  if (band === 'kerb-band') {
    const distance = BLOCK_HALF - PROP_CLEARANCE - reach.outward
    if (distance - reach.inward < walkFloor) {
      return null
    }
    return { across: outwardSign * distance, innerDistance: distance - reach.inward, outerDistance: distance + reach.outward }
  }
  const distance = BUILD_LINE + PROP_CLEARANCE + reach.inward
  if (distance + reach.outward > walkLimit) {
    return null
  }
  return { across: outwardSign * distance, innerDistance: distance - reach.inward, outerDistance: distance + reach.outward }
}

/* ------------------------------------------------------------------------- *
 * Lamp resolution
 * ------------------------------------------------------------------------- */

/** Night state of an era: its own sun elevation, or an explicit override. */
export function resolveNight(era: EraDefinition, override?: boolean): boolean {
  return override ?? era.lighting.sunElevationDeg < 2
}

/** Resolves a lamp's emission and light contribution for one era and night flag. */
export function resolveLamp(
  recipe: PropRecipe,
  era: EraDefinition,
  night: boolean,
  withPointLight: boolean,
  position: Vec3,
): PlacedLamp | null {
  if (recipe.lamp === null) {
    return null
  }
  const table = getEraPropTable(era.id)
  const intensity = era.lighting.artificialLightIntensity
  const emissiveIntensity =
    recipe.lamp.baseEmissive *
    table.lamp.emissiveScale *
    intensity *
    (night ? LAMP_NIGHT_EMISSIVE_SCALE : LAMP_DAY_EMISSIVE_SCALE)
  const colour = table.lamp.followsLighting
    ? era.lighting.artificialLightColor
    : (table.lamp.fixedColour ?? era.lighting.artificialLightColor)
  const lightIntensity =
    LAMP_BASE_LIGHT_INTENSITY *
    table.lamp.lightIntensityScale *
    intensity *
    (night ? 1 : LAMP_DAY_LIGHT_FRACTION)
  return {
    technology: table.lamp.technology,
    colour,
    emissiveIntensity: round(Math.max(0, emissiveIntensity), 4),
    glowRadius: round(recipe.lamp.glowRadius * table.lamp.glowScale, 3),
    light: withPointLight,
    lightIntensity: round(withPointLight ? Math.max(0, lightIntensity) : 0, 4),
    lightPosition: position,
  }
}

/* ------------------------------------------------------------------------- *
 * Placement
 * ------------------------------------------------------------------------- */

function localToWorldOffset(localX: number, localZ: number, yaw: number): { x: number; z: number } {
  const axes = yawAxes(yaw)
  return {
    x: axes.along.x * localX + axes.across.x * localZ,
    z: axes.along.z * localX + axes.across.z * localZ,
  }
}

function overlaps3d(left: PlacedBounds, right: PlacedBounds): boolean {
  return (
    left.minX < right.maxX - PLACEMENT_EPSILON &&
    right.minX < left.maxX - PLACEMENT_EPSILON &&
    left.minZ < right.maxZ - PLACEMENT_EPSILON &&
    right.minZ < left.maxZ - PLACEMENT_EPSILON &&
    left.minY < right.maxY - PLACEMENT_EPSILON &&
    right.minY < left.maxY - PLACEMENT_EPSILON
  )
}

/** Legality audit of one concrete placement. */
function auditPlacement(input: {
  readonly layout: BlockLayout
  readonly anchor: Anchor
  readonly recipe: PropRecipe
  readonly bounds: PlacedBounds
  readonly roof: boolean
}): { readonly issues: readonly PropPlanIssue[]; readonly band: PropBand } {
  const { layout, anchor, recipe, bounds, roof } = input
  const issues: PropPlanIssue[] = []
  const push = (code: PropPlanIssue['code'], message: string): void => {
    issues.push({ code, target: anchor.name, message })
  }

  if (!roof) {
    const classes = footprintSamples(bounds).map((sample) => classifyGround(sample.x, sample.z))
    if (classes.some((entry) => entry === 'roadway' || entry === 'outside')) {
      push('road-corridor', `${recipe.id} reaches the carriageway or leaves the block`)
    } else if (classes.some((entry) => entry === 'parcel')) {
      push('building-overlap', `${recipe.id} encroaches on a parcel footprint on the ground plane`)
    }
    if (footprintSamples(bounds).some((sample) => isInWalkingBand(sample.x, sample.z))) {
      push('walking-band', `${recipe.id} intrudes into the sidewalk walking band`)
    }
    if (bounds.minY < BLOCK_DECK_HEIGHT - PLACEMENT_EPSILON) {
      push('off-sidewalk', `${recipe.id} sinks below the sidewalk deck`)
    }
    if (bounds.maxY > BLOCK_DECK_HEIGHT + MAX_PROP_HEIGHT) {
      push('height-over-limit', `${recipe.id} tops out above the layer's height limit`)
    }
  }

  for (const parcel of layout.parcels) {
    const footprint = parcel.footprint
    const insideXZ =
      bounds.minX < footprint.max.x - PLACEMENT_EPSILON &&
      footprint.min.x < bounds.maxX - PLACEMENT_EPSILON &&
      bounds.minZ < footprint.max.z - PLACEMENT_EPSILON &&
      footprint.min.z < bounds.maxZ - PLACEMENT_EPSILON
    if (!insideXZ) {
      continue
    }
    const roofTop = BLOCK_DECK_HEIGHT + parcel.capacity.maxHeight
    if (bounds.minY < roofTop - PLACEMENT_EPSILON && bounds.maxY > BLOCK_DECK_HEIGHT + PLACEMENT_EPSILON) {
      push('building-overlap', `${recipe.id} intersects the ${parcel.id} building envelope`)
      break
    }
  }

  const centreAcross = (bounds.minZ + bounds.maxZ) / 2
  const band: PropBand = roof
    ? 'roof'
    : Math.abs(centreAcross) > (BUILD_LINE + BLOCK_HALF) / 2
      ? 'kerb-band'
      : 'facade-band'
  return { issues, band }
}

interface PlacementResult {
  readonly prop: PlacedProp
  readonly bounds: PlacedBounds
  readonly issues: readonly PropPlanIssue[]
}

/**
 * Places one prop on one anchor.
 *
 * The solver walks a short, deterministic list of candidate stations along the
 * street — every usable sidewalk sub-band, each with a fixed slide list — and
 * accepts the first station that is legal *and* clear of the props already
 * placed. The search order is fixed, so the outcome depends only on the block
 * seed and the era.
 */
function placeOne(input: {
  readonly layout: BlockLayout
  readonly anchor: Anchor
  readonly slot: PropSlot
  readonly recipe: PropRecipe
  readonly era: EraDefinition
  readonly rng: Rng
  readonly night: boolean
  readonly pointLight: boolean
  readonly wear: WearProfile
  readonly stagger: number
  readonly placed: readonly PlacedBounds[]
}): PlacementResult {
  const { layout, anchor, slot, recipe, era, rng, night, wear } = input
  const street = streetForAnchor(layout, anchor)
  const roof = recipe.mount === 'roof' || street === null
  const yaw = propYaw(recipe, anchor, street)
  // Pole-top fittings keep scale 1: their mast must meet the deck exactly.
  // Every other prop jitters in size, but never past the sub-band: a variant that
  // grew beyond the depth the sidewalk can hide would have nowhere legal to stand.
  const drawnScale =
    recipe.mount === 'pole-top' ? 1 : round(rng.float(recipe.scaleRange[0], recipe.scaleRange[1]), 4)
  const depthBudget =
    recipe.footprint.depth > 0 ? MAX_GROUND_PROP_DEPTH / recipe.footprint.depth : drawnScale
  const scale = round(Math.min(drawnScale, Math.max(depthBudget, 0.9)), 4)
  const jitter = round(rng.float(-ALONG_JITTER, ALONG_JITTER), 4)
  const extents = contactExtents(
    {
      ...recipe,
      bounds: {
        minX: recipe.bounds.minX * scale,
        maxX: recipe.bounds.maxX * scale,
        minY: recipe.bounds.minY * scale,
        maxY: recipe.bounds.maxY * scale,
        minZ: recipe.bounds.minZ * scale,
        maxZ: recipe.bounds.maxZ * scale,
      },
    },
    yaw,
  )
  const [contactX, contactY, contactZ] = recipe.contact

  const stations: Array<{ contact: Vec3; band: PropBand }> = []
  // Ground furniture always stands on the sidewalk deck; only roof and pole-top
  // props take their height from the anchor (a roof cap, a pole top). The corner
  // apron anchor, for instance, publishes `y = 0` because it sits on the
  // carriageway, which is not where a prop may stand.
  const stationHeight =
    roof || recipe.mount === 'pole-top' ? anchor.position.y : BLOCK_DECK_HEIGHT
  if (roof) {
    stations.push({ contact: v3(anchor.position.x, stationHeight, anchor.position.z), band: 'roof' })
  } else if (street !== null) {
    const outwardSign = signOf(acrossCoordinate(street, anchor.position))
    const reach = streetReach(street, extents, outwardSign)
    const baseAlong = alongCoordinate(street, anchor.position) + jitter
    const anchorAcross = Math.abs(acrossCoordinate(street, anchor.position))
    const candidates: Array<{ across: number; band: PropBand; inner: number; outer: number }> = []
    for (const band of bandsForMount(recipe.mount)) {
      const station = bandStation(band, reach, outwardSign)
      if (station !== null) {
        candidates.push({ across: station.across, band, inner: station.innerDistance, outer: station.outerDistance })
      }
    }
    // Nearest band first: a kerb anchor stays at the kerb, a facade anchor at the facade.
    candidates.sort(
      (left, right) => Math.abs(anchorAcross - Math.abs(left.across)) - Math.abs(anchorAcross - Math.abs(right.across)),
    )
    for (const candidate of candidates) {
      const worstAcross = Math.max(candidate.inner, candidate.outer)
      const alongLimit = cornerAlongLimit(worstAcross) - PROP_CLEARANCE
      const lower = -alongLimit - reach.alongMin
      const upper = alongLimit - reach.alongMax
      if (upper < lower) {
        continue
      }
      const clampAlong = (value: number): number =>
        round(Math.min(Math.max(value, lower), upper), 3)
      const alongCandidates = new Set<number>()
      for (const slide of SLIDE_OFFSETS) {
        alongCandidates.add(clampAlong(baseAlong + slide))
      }
      for (let step = 1; step <= STATION_SPREAD_STEPS; step += 1) {
        alongCandidates.add(clampAlong(upper - step * STATION_SPREAD_STEP))
        alongCandidates.add(clampAlong(lower + step * STATION_SPREAD_STEP))
      }
      // Nearest station to the anchor first, so a prop only migrates along the
      // street as far as the clash check actually requires.
      const ordered = [...alongCandidates].sort(
        (left, right) => Math.abs(left - baseAlong) - Math.abs(right - baseAlong),
      )
      for (const along of ordered) {
        stations.push({
          contact: streetToWorld(street, along, round(candidate.across), stationHeight),
          band: candidate.band,
        })
      }
    }
    if (stations.length === 0) {
      stations.push({
        contact: v3(anchor.position.x, stationHeight, anchor.position.z),
        band: 'kerb-band',
      })
    }
  } else {
    stations.push({ contact: v3(anchor.position.x, stationHeight, anchor.position.z), band: 'kerb-band' })
  }

  let chosen = stations[0] as { contact: Vec3; band: PropBand }
  let chosenAudit = auditPlacement({
    layout,
    anchor,
    recipe,
    bounds: boundsOf(chosen.contact, extents),
    roof,
  })
  let accepted = chosenAudit.issues.length === 0
  for (const station of stations) {
    const bounds = boundsOf(station.contact, extents)
    const audit = auditPlacement({ layout, anchor, recipe, bounds, roof })
    const clear = !input.placed.some((other) => overlaps3d(bounds, other))
    if (audit.issues.length === 0 && clear) {
      chosen = station
      chosenAudit = audit
      accepted = true
      break
    }
    if (!accepted && audit.issues.length === 0) {
      chosen = station
      chosenAudit = audit
    }
  }

  const issues = [...chosenAudit.issues]
  if (!accepted && chosenAudit.issues.length === 0) {
    issues.push({
      code: 'prop-overlap',
      target: anchor.name,
      message: `${recipe.id} could not be separated from the props already placed on ${street?.name ?? 'the block'}`,
    })
  }
  if (stations.length === 1 && street !== null && !roof) {
    issues.push({
      code: 'off-sidewalk',
      target: anchor.name,
      message: `${recipe.id} has no sidewalk sub-band wide enough for its footprint on ${street.name}`,
    })
  }

  const offset = localToWorldOffset(-contactX, -contactZ, yaw)
  const position: Vec3 = v3(
    round(chosen.contact.x + offset.x),
    round(chosen.contact.y - contactY),
    round(chosen.contact.z + offset.z),
  )

  const prop: PlacedProp = {
    key: `${anchor.name}#${slot}#${recipe.id}`,
    anchorName: anchor.name,
    anchorSlot: slot,
    anchorKind: anchor.kind,
    ownerKind: anchor.owner.kind,
    ownerId: anchor.owner.id,
    eraId: era.id,
    propId: recipe.id,
    category: recipe.category,
    mount: recipe.mount,
    label: recipe.label,
    position,
    rotationY: round(yaw, 6),
    scale,
    footprint: streetFootprint(extents, street, roof),
    height: extents.height,
    aabb: boundsOf(chosen.contact, extents),
    wear,
    materialPalette: recipe.materials,
    lamp: resolveLamp(recipe, era, night, input.pointLight, position),
    detail: recipeDetail(recipe),
    triangles: Math.round(recipe.triangles * scale * scale * scale),
    band: chosen.band,
    contact: { x: round(chosen.contact.x, 3), z: round(chosen.contact.z, 3) },
    stagger: input.stagger,
    weight: 1,
  }

  return { prop, bounds: boundsOf(chosen.contact, extents), issues }
}

/** Pool assignment: a deterministic shuffle of the pool, then round-robin. */
export function assignPool(pool: readonly string[], count: number, rng: Rng): readonly string[] {
  const order = rng.shuffle(pool)
  const assignment: string[] = []
  for (let index = 0; index < count; index += 1) {
    if (order.length === 0) {
      break
    }
    const propId = order[index % order.length]
    if (propId !== undefined) {
      assignment.push(propId)
    }
  }
  return assignment
}

/**
 * Plans one era's props.
 *
 * @param layout Canonical block from `src/city/layout`.
 * @param options Era, seed, quality tier and optional night override.
 */
export function planEraProps(layout: BlockLayout, options: PropsPlanOptions): PropsLayerPlan {
  const era = getEra(options.eraId)
  const table = getEraPropTable(era.id)
  const tier: QualityTierName = options.qualityTier ?? DEFAULT_QUALITY_TIER
  const night = resolveNight(era, options.night)
  const root = createRng(options.seed ?? layout.seedInput, PROPS_RNG_LABEL).fork(era.id)
  const pointLightLimit = Math.min(table.lamp.pointLightLimit, POINT_LIGHT_LIMIT_BY_TIER[tier])

  const props: PlacedProp[] = []
  const placedBounds: PlacedBounds[] = []
  const issues: PropPlanIssue[] = []
  const coverage = {} as Record<PropSlot, SlotCoverage>
  let lampIndex = 0
  let pointLights = 0
  let pointLightIntensity = 0

  for (const slot of PROP_SLOTS) {
    const anchors = anchorsForSlot(layout, slot)
    const pool = table.pools[slot]
    const expected = anchors.map((anchor) => anchor.name).sort()
    if (pool.length === 0) {
      issues.push({
        code: 'pool-empty',
        target: slot,
        message: `Era ${era.id} has no catalogue for the ${slot} slot`,
      })
    }
    if (pool.length > anchors.length) {
      // One prop per anchor, so a pool longer than the anchor list would leave
      // catalogued props off the block entirely.
      issues.push({
        code: 'pool-too-long',
        target: slot,
        message: `Era ${era.id} lists ${pool.length} ${slot} props for ${anchors.length} anchors`,
      })
    }
    const assignment = assignPool(pool, anchors.length, root.fork(`pool:${slot}`))
    const placedNames: string[] = []

    anchors.forEach((anchor, index) => {
      const propId = assignment[index]
      if (propId === undefined) {
        return
      }
      if (!isPropAvailableInEra(propId, era.id)) {
        issues.push({
          code: 'unavailable-prop',
          target: anchor.name,
          message: `Prop ${propId} is retired in ${era.id}`,
        })
      }
      const recipe = getPropRecipe(propId)
      if (recipe.slot !== slot) {
        issues.push({
          code: 'slot-mismatch',
          target: anchor.name,
          message: `Prop ${propId} belongs to ${recipe.slot} but is placed in ${slot}`,
        })
      }

      const propRng = root.fork(`anchor:${anchor.name}`)
      const stagger = round(propRng.float(0, PROP_STAGGER_SPAN), 4)
      const wear = mergeWear(table.wear, table.wearOverrides[propId])
      const wantsLight =
        recipe.lamp !== null &&
        lampIndex < pointLightLimit &&
        night &&
        era.lighting.artificialLightIntensity >= LAMP_POINT_LIGHT_MIN_INTENSITY

      const result = placeOne({
        layout,
        anchor,
        slot,
        recipe,
        era,
        rng: propRng,
        night,
        pointLight: wantsLight,
        wear,
        stagger,
        placed: placedBounds,
      })
      if (recipe.lamp !== null) {
        lampIndex += 1
      }
      if (result.prop.lamp?.light) {
        pointLights += 1
        pointLightIntensity = Math.max(pointLightIntensity, result.prop.lamp.lightIntensity)
      }
      props.push(result.prop)
      placedBounds.push(result.bounds)
      issues.push(...result.issues)
      placedNames.push(anchor.name)
    })

    coverage[slot] = {
      slot,
      expected,
      placed: [...placedNames].sort(),
      missing: expected.filter((name) => !placedNames.includes(name)),
      duplicated: placedNames.filter((name, position) => placedNames.indexOf(name) !== position),
    }
  }

  const census = buildCensus(era.id, props)
  const triangles = props.reduce((total, prop) => total + prop.triangles, 0)

  return {
    eraId: era.id,
    seed: layout.seed,
    seedInput: layout.seedInput,
    night,
    props,
    coverage,
    census,
    issues,
    triangles,
    lamp: {
      technology: table.lamp.technology,
      label: table.lamp.label,
      colour: table.lamp.followsLighting
        ? era.lighting.artificialLightColor
        : (table.lamp.fixedColour ?? era.lighting.artificialLightColor),
      emissiveIntensity: round(
        props.reduce((max, prop) => Math.max(max, prop.lamp?.emissiveIntensity ?? 0), 0),
        4,
      ),
      pointLights,
      pointLightIntensity: round(pointLightIntensity, 4),
    },
    wear: table.wear,
    activeProps: [...new Set(props.map((prop) => prop.propId))].sort(),
    retiredProps: previousEraRetirements(era.id),
  }
}

/** Props the previous era placed that this era's catalogue no longer contains. */
function previousEraRetirements(eraId: EraId): readonly string[] {
  const [previous] = getNeighbouringEras(eraId)
  if (previous === undefined || previous.id === eraId) {
    return []
  }
  const current = new Set(eraCatalogue(eraId))
  return propsRetiredByEra(eraId)
    .filter((propId) => eraCatalogue(previous.id).includes(propId) && !current.has(propId))
    .sort()
}

function buildCensus(eraId: EraId, props: readonly PlacedProp[]): PropsCensus {
  const byCategory = { lighting: 0, signals: 0, furniture: 0, utility: 0, clutter: 0 }
  const bySlot = {} as Record<PropSlot, number>
  const byProp: Record<string, number> = {}
  const detail: Record<string, number> = {}
  for (const slot of PROP_SLOTS) {
    bySlot[slot] = 0
  }
  for (const prop of props) {
    byCategory[prop.category] += 1
    bySlot[prop.anchorSlot] += 1
    byProp[prop.propId] = (byProp[prop.propId] ?? 0) + 1
    for (const [kind, count] of Object.entries(prop.detail)) {
      detail[kind] = (detail[kind] ?? 0) + count
    }
  }
  const placed = new Set(props.map((prop) => prop.propId))
  const otherEras = otherEraCatalogues(eraId)
  return {
    byCategory,
    bySlot,
    byProp: Object.fromEntries(Object.entries(byProp).sort(([a], [b]) => (a < b ? -1 : 1))),
    uniqueToEra: eraCatalogue(eraId)
      .filter((propId) => placed.has(propId) && !otherEras.has(propId))
      .sort(),
    detail: Object.fromEntries(Object.entries(detail).sort(([a], [b]) => (a < b ? -1 : 1))),
  }
}

const OTHER_CATALOGUE_CACHE = new Map<EraId, Set<string>>()

function otherEraCatalogues(eraId: EraId): Set<string> {
  const cached = OTHER_CATALOGUE_CACHE.get(eraId)
  if (cached !== undefined) {
    return cached
  }
  const union = new Set<string>()
  for (const other of PROP_TABLE_ERA_IDS) {
    if (other === eraId) {
      continue
    }
    for (const propId of eraCatalogue(other)) {
      union.add(propId)
    }
  }
  OTHER_CATALOGUE_CACHE.set(eraId, union)
  return union
}

/* ------------------------------------------------------------------------- *
 * Coverage and census helpers used by the suites
 * ------------------------------------------------------------------------- */

/** Every missing anchor across every slot of a plan. */
export function missingAnchors(plan: PropsLayerPlan): readonly string[] {
  return PROP_SLOTS.flatMap((slot) => plan.coverage[slot].missing)
}

/** Every duplicated anchor across every slot of a plan. */
export function duplicatedAnchors(plan: PropsLayerPlan): readonly string[] {
  return PROP_SLOTS.flatMap((slot) => plan.coverage[slot].duplicated)
}

/** Lamp technologies the plan's lighting props use, sorted. */
export function planLampTechnologies(plan: PropsLayerPlan): readonly LampTechnology[] {
  const technologies = new Set<LampTechnology>()
  for (const prop of plan.props) {
    if (prop.lamp !== null) {
      technologies.add(prop.lamp.technology)
    }
  }
  return [...technologies].sort()
}

/** Props the plan lights up, in placement order. */
export function emittingLamps(plan: PropsLayerPlan): readonly PlacedProp[] {
  return plan.props.filter((prop) => (prop.lamp?.emissiveIntensity ?? 0) > 0.05)
}

/** Props standing on the deck, i.e. the ones the ground legality tests cover. */
export function groundProps(plan: PropsLayerPlan): readonly PlacedProp[] {
  return plan.props.filter((prop) => prop.mount !== 'roof')
}

/* ------------------------------------------------------------------------- *
 * Staged era transitions
 * ------------------------------------------------------------------------- */

/**
 * Presence curve of one prop during a staged switch.
 *
 * A prop's own stagger delays the start of its ramp, so the block's furniture
 * changes over a sweep rather than in one frame. Under `reducedMotion` the whole
 * schedule collapses to an instant switch at the halfway point.
 */
function presence(t: number, stagger: number, reducedMotion: boolean, appearing: boolean): number {
  if (reducedMotion) {
    const late = t >= 0.5
    return appearing === late ? 1 : 0
  }
  const span = Math.min(0.9, Math.max(0.05, PROP_STAGGER_SPAN))
  const ramp = Math.min(1, Math.max(0, (t - stagger) / (1 - span)))
  return appearing ? ramp : 1 - ramp
}

/** Blend of a persistent prop's transform between the two decades. */
function blendInterpolatedProp(from: PlacedProp, to: PlacedProp, t: number): PlacedProp {
  const mix = (a: number, b: number): number => round(a + (b - a) * t, 4)
  return {
    ...to,
    position: v3(
      mix(from.position.x, to.position.x),
      mix(from.position.y, to.position.y),
      mix(from.position.z, to.position.z),
    ),
    rotationY: mix(from.rotationY, to.rotationY),
    scale: mix(from.scale, to.scale),
    weight: 1,
  }
}

/**
 * Blends two era plans into one staged frame.
 *
 * Per anchor the two eras either show the same object — it *persists*, and its
 * transform is blended between the two placements — or different objects, in
 * which case the old one retires while the new one appears. Each prop carries a
 * deterministic stagger, so the switch sweeps around the block instead of
 * popping in a single frame; with `reducedMotion` the schedule collapses to an
 * instant swap at the halfway point.
 */
export function planTransition(
  layout: BlockLayout,
  input: PropsTransitionInput,
  options: Omit<PropsPlanOptions, 'eraId'> = {},
): PropsTransitionPlan {
  const fromPlan = planEraProps(layout, { ...options, eraId: input.from })
  const toPlan = planEraProps(layout, { ...options, eraId: input.to })
  const t = Math.min(1, Math.max(0, input.t))
  const reducedMotion = input.reducedMotion ?? false
  const fromByAnchor = new Map(fromPlan.props.map((prop) => [prop.anchorName, prop]))
  const toByAnchor = new Map(toPlan.props.map((prop) => [prop.anchorName, prop]))
  const anchors = [...new Set([...fromByAnchor.keys(), ...toByAnchor.keys()])].sort()
  const props: StagedProp[] = []
  const counts = { held: 0, persistent: 0, appearing: 0, retiring: 0, replaced: 0, hidden: 0 }

  for (const anchorName of anchors) {
    const fromProp = fromByAnchor.get(anchorName) ?? null
    const toProp = toByAnchor.get(anchorName) ?? null
    if (fromProp !== null && toProp !== null && fromProp.propId === toProp.propId) {
      const blend = reducedMotion ? (t < 0.5 ? 0 : 1) : t
      props.push({
        prop: blendInterpolatedProp(fromProp, toProp, blend),
        phase: 'persistent',
        weight: 1,
        source: 'both',
        fromPropId: fromProp.propId,
        toPropId: toProp.propId,
        blend: round(blend, 4),
      })
      counts.persistent += 1
      continue
    }
    if (fromProp !== null && toProp !== null) {
      const remain = presence(t, fromProp.stagger, reducedMotion, false)
      const appear = presence(t, toProp.stagger, reducedMotion, true)
      props.push({
        prop: { ...fromProp, weight: round(remain, 4) },
        phase: remain <= 0 ? 'held' : 'retiring',
        weight: round(remain, 4),
        source: 'from',
        fromPropId: fromProp.propId,
        toPropId: toProp.propId,
        blend: 0,
      })
      props.push({
        prop: { ...toProp, weight: round(appear, 4) },
        phase: 'appearing',
        weight: round(appear, 4),
        source: 'to',
        fromPropId: fromProp.propId,
        toPropId: toProp.propId,
        blend: 0,
      })
      counts.replaced += 1
      continue
    }
    if (fromProp !== null) {
      const weight = presence(t, fromProp.stagger, reducedMotion, false)
      props.push({
        prop: { ...fromProp, weight: round(weight, 4) },
        phase: weight <= 0 ? 'held' : 'retiring',
        weight: round(weight, 4),
        source: 'from',
        fromPropId: fromProp.propId,
        toPropId: null,
        blend: 0,
      })
      if (weight <= 0) {
        counts.hidden += 1
      } else {
        counts.retiring += 1
      }
      continue
    }
    if (toProp !== null) {
      const weight = presence(t, toProp.stagger, reducedMotion, true)
      props.push({
        prop: { ...toProp, weight: round(weight, 4) },
        phase: weight <= 0 ? 'held' : 'appearing',
        weight: round(weight, 4),
        source: 'to',
        fromPropId: null,
        toPropId: toProp.propId,
        blend: 0,
      })
      if (weight <= 0) {
        counts.hidden += 1
      } else {
        counts.appearing += 1
      }
    }
  }

  return {
    from: input.from,
    to: input.to,
    t: round(t, 4),
    reducedMotion,
    staged: !reducedMotion,
    props,
    counts,
    fromPlan,
    toPlan,
  }
}

/** Human-readable one-line summary, used by the harness and by QA reports. */
export function describePlan(plan: PropsLayerPlan): string {
  return [
    `${plan.eraId}: ${plan.props.length} props`,
    `${plan.census.byCategory.lighting} lighting`,
    `${plan.census.byCategory.signals} signals`,
    `${plan.census.byCategory.furniture} furniture`,
    `${plan.census.byCategory.utility} utility`,
    `${plan.census.byCategory.clutter} clutter`,
    `lamp ${plan.lamp.technology}`,
    `${plan.lamp.pointLights} point lights`,
    `${plan.triangles} triangles`,
    plan.issues.length === 0 ? 'legal' : `${plan.issues.length} issues`,
  ].join(' · ')
}

/** Re-exported so consumers can name a slot or a street without a second import. */
export type { PropSlot, StreetName }

/** Convenience for tests and harnesses: the sidewalk band depth constant. */
export const SIDEWALK_BAND_DEPTH = SIDEWALK_SUB_BAND_DEPTH
