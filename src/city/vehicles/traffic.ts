/**
 * Kinematic traffic, parking, lights and SFX triggers of the vehicle layer.
 *
 * Everything in this module is a pure function of its arguments: a vehicle's
 * pose is an analytic function of the caller's simulation clock, parking is a
 * deterministic draw on the block seed, and the SFX triggers are read out of a
 * pre-computed, rate-limited schedule. There is no physics engine, no wall
 * clock and no hidden mutable animation state, so the unit and composition
 * suites can advance a minute of city time in milliseconds.
 *
 * The moving parts:
 *
 * - {@link resolveEraPlan} / {@link applyEra} / {@link applyEraTransition} turn
 *   the era tables into a plan, cross-fading two eras smoothly and settling
 *   exactly on the destination at `t = 1` (or instantly under reduced motion);
 * - {@link buildFleet} spawns the moving convoy and the kerbside parking of one
 *   plan on the real layout splines and parking anchors;
 * - {@link poseVehicles} and {@link collectSfxEvents} read the fleet at a clock
 *   value, which is what the renderer and the audio owner consume.
 */

import { createRng, type Rng, type Seed } from '../../lib/rng'
import { DEFAULT_QUALITY_TIER, isQualityTierName, resolveQualityTier } from '../../lib/quality'
import {
  DEFAULT_ERA_ID,
  getEra,
  requireEraId,
  type EraDefinition,
  type EraId,
  type HexColor,
} from '../../era'
import {
  classifyGround,
  splinePoseAt,
  streetByName,
  type PathSpline,
  type StreetName,
  type Vec2,
  type Vec3,
} from '../layout'
import { BIKE_LANE_LATERAL_OFFSET, buildMarkingGeometry, markingSignature } from './markings'
import {
  SFX_KINDS,
  type EraApplicationContext,
  type EraLightPlan,
  type EraTransitionInput,
  type EraVehiclePlan,
  type EraVehicleTable,
  type FleetPlanEntry,
  type LayoutReference,
  type MarkingFeatureKind,
  type ParkedVehicle,
  type ParkingAnchor,
  type SfxKind,
  type SfxProfile,
  type SfxScheduleEntry,
  type SfxTrigger,
  type SfxTriggerListener,
  type VehicleInstance,
  type VehicleLayer,
  type VehiclePose,
  type VehiclesSnapshot,
} from './types'
import { censusOf, requireEraVehicleTable, requireVehicleModel } from './tables'

/* ------------------------------------------------------------------------- *\
 * Tuning constants
 * ------------------------------------------------------------------------- */

/** Smallest longitudinal gap the layer leaves between two vehicles, in metres. */
export const MIN_GAP_M = 2.5

/** Extra gap an empty street inserts between two vehicles at density 0, in metres. */
export const EMPTY_GAP_SPAN_M = 45

/**
 * Spread of the cruising speed drawn per convoy, as a fraction.
 *
 * Every vehicle of one lane shares that lane's speed: a kinematic convoy only
 * keeps its spacing exactly if the whole convoy travels together, so a lane is
 * drawn one speed and the period's variety comes from differences between
 * lanes (and between eras) rather than from vehicles catching each other up.
 */
export const LANE_SPEED_JITTER = 0.08

/** Deterministic proportion jitter of a vehicle body, as a fraction. */
export const SCALE_JITTER = { min: 0.96, max: 1.05 } as const

/** Scene-time horizon a vehicle's SFX schedule is pre-computed over, in seconds. */
export const SFX_HORIZON_SEC = 600

/**
 * Longest vehicle the far-side lanes accept, in metres.
 *
 * The far-side circuits turn on the layout's 4 m radius corners, which a long
 * bus or streetcar cannot follow without sweeping outside the carriageway, so
 * those models stay on the block-side lanes whose radii are larger.
 */
export const LONG_VEHICLE_LANE_LIMIT_M = 8

/** Share of the indicator-fitted vehicles that use them while driving. */
export const INDICATOR_FRACTION = 0.7

/** Indicator blink period and duty cycle, in seconds. */
export const BLINK_PERIOD_SEC = 1.6
export const BLINK_DUTY = 0.55

/** Sun elevation below which an era counts as night, in degrees. */
export const NIGHT_SUN_ELEVATION_DEG = 0

/** Sun elevation under which a lit era runs daytime running lights, in degrees. */
export const DUSK_SUN_ELEVATION_DEG = 20

/** Fraction of the era headlight strength a dusk era runs. */
export const RUNNING_LIGHT_FACTOR = 0.45

/** Era headlight strength from which a period lights its fleet at all. */
export const RUNNING_LIGHT_THRESHOLD = 0.75

/** Taillamp strength as a fraction of the headlamp strength. */
export const TAILLAMP_RATIO = 0.6

/** Suggested linear gain of each SFX kind. */
export const SFX_GAINS: Readonly<Record<SfxKind, number>> = {
  horn: 0.6,
  engine: 0.34,
  'transit-bell': 0.5,
  'ev-whine': 0.22,
  'tire-squeal': 0.45,
}

/* ------------------------------------------------------------------------- *\
 * Small helpers
 * ------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

/**
 * Linear blend with exact endpoints: `0` returns `a`, `1` returns `b` and
 * anything in between interpolates. The endpoint guarantee is what lets a
 * staged era switch land exactly on the era it moves to.
 */
function mix(a: number, b: number, t: number): number {
  if (t <= 0) return a
  if (t >= 1) return b
  return a + (b - a) * t
}

function mixOptional(a: number | null, b: number | null, t: number): number | null {
  if (a === null && b === null) return null
  if (a === null) return t >= 0.5 ? b : null
  if (b === null) return t < 0.5 ? a : null
  return round(mix(a, b, t), 4)
}

function unique<T>(items: readonly T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) === index)
}

function paletteColour(palette: Readonly<Record<string, HexColor>>, key: string): HexColor {
  const colour = palette[key]
  if (colour === undefined) {
    throw new RangeError(`Palette key ${key} does not exist`)
  }
  return colour
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const name = key(item)
    counts[name] = (counts[name] ?? 0) + 1
  }
  return counts
}

/* ------------------------------------------------------------------------- *\
 * Plan resolution
 * ------------------------------------------------------------------------- */

/** Lights of a settled era, derived from its hero sun elevation and headlight data. */
export function lightsFor(era: EraDefinition): EraLightPlan {
  const night = era.lighting.sunElevationDeg < NIGHT_SUN_ELEVATION_DEG
  const dusk = !night && era.lighting.sunElevationDeg < DUSK_SUN_ELEVATION_DEG
  const strength = era.traffic.headlightIntensity
  const lit = strength >= RUNNING_LIGHT_THRESHOLD
  const headlampIntensity =
    night && strength > 0 ? strength : dusk && lit ? strength * RUNNING_LIGHT_FACTOR : 0
  return {
    night,
    dusk,
    headlampIntensity: round(headlampIntensity, 4),
    taillampIntensity: round(headlampIntensity * TAILLAMP_RATIO, 4),
    // Indicator lamps are wired to the era's lamp state: a fleet driving unlit
    // in broad daylight does not blink either.
    indicators: headlampIntensity > 0,
  }
}

/** Longest vehicle of a census, in metres. */
export function longestModelLength(table: EraVehicleTable): number {
  return table.fleet.reduce(
    (longest, entry) => Math.max(longest, requireVehicleModel(entry.modelKey).lengthM),
    0,
  )
}

/**
 * Longitudinal spacing of one era's convoy, in metres.
 *
 * A denser era packs its traffic tighter: an empty street keeps one vehicle per
 * `MIN_GAP_M + EMPTY_GAP_SPAN_M` metres, gridlock one per minimum gap. The
 * result always leaves at least {@link MIN_GAP_M} between two vehicles, which is
 * what keeps the fleet overlap-free.
 */
export function spacingFor(table: EraVehicleTable, density: number): number {
  const longest = longestModelLength(table)
  const gap = MIN_GAP_M + (1 - clamp(density, 0, 1)) * EMPTY_GAP_SPAN_M
  return round(longest + gap, 1)
}

function paletteOf(era: EraDefinition): Readonly<Record<string, HexColor>> {
  return era.palette as unknown as Readonly<Record<string, HexColor>>
}

function weightsFor(
  features: readonly MarkingFeatureKind[],
  weight: number,
): Partial<Record<MarkingFeatureKind, number>> {
  const weights: Partial<Record<MarkingFeatureKind, number>> = {}
  for (const feature of features) {
    weights[feature] = weight
  }
  return weights
}

/** Census of an era resolved into plan entries with normalised shares. */
function resolveFleet(table: EraVehicleTable, palette: Readonly<Record<string, HexColor>>): FleetPlanEntry[] {
  const weightTotal = table.fleet.reduce((total, entry) => total + entry.weight, 0)
  return table.fleet.map((entry) => {
    const model = requireVehicleModel(entry.modelKey)
    const paint = unique((entry.paintKeys ?? table.paints).map((key) => paletteColour(palette, key)))
    return {
      modelKey: entry.modelKey,
      model,
      share: weightTotal > 0 ? entry.weight / weightTotal : 0,
      paint,
      tags: entry.role === undefined ? model.tags : unique([...model.tags, entry.role]),
    }
  })
}

/** Full plan of one settled era. */
export function eraPlan(eraId: EraId): EraVehiclePlan {
  const id = requireEraId(eraId)
  const era = getEra(id)
  const table = requireEraVehicleTable(id)
  const palette = paletteOf(era)
  return {
    eraId: id,
    fromEraId: id,
    toEraId: id,
    progress: 0,
    settled: true,
    label: era.shortLabel,
    density: era.traffic.trafficDensity,
    speedMps: era.traffic.averageSpeedMps,
    speedRangeMps: table.speedRangeMps,
    spacingM: spacingFor(table, era.traffic.trafficDensity),
    parkedRatio: era.traffic.parkedRatio,
    laneConfiguration: table.laneConfiguration,
    markings: {
      ...table.markings,
      featureWeights: weightsFor(table.markings.features, 1),
      colour: era.palette.roadMarking,
      railColour: era.palette.streetFurniture,
    },
    lights: lightsFor(era),
    sfx: table.sfx,
    fleet: resolveFleet(table, palette),
    census: censusOf(table),
    microMobility: table.microMobility,
    paints: unique(table.paints.map((key) => paletteColour(palette, key))),
    palette: {
      roadSurface: era.palette.roadSurface,
      roadMarking: era.palette.roadMarking,
      accent: era.palette.accent,
    },
  }
}

/** Marking configuration of a blend: both feature sets, weighted by progress. */
function blendMarkings(
  from: EraVehicleTable,
  to: EraVehicleTable,
  dominant: EraDefinition,
  t: number,
): EraVehiclePlan['markings'] {
  const features = unique([...from.markings.features, ...to.markings.features])
  const weights: Partial<Record<MarkingFeatureKind, number>> = {}
  for (const feature of features) {
    const fromWeight = from.markings.features.includes(feature) ? 1 - t : 0
    const toWeight = to.markings.features.includes(feature) ? t : 0
    weights[feature] = round(Math.max(fromWeight, toWeight), 4)
  }
  return {
    features,
    featureWeights: weights,
    paintOpacity: round(mix(from.markings.paintOpacity, to.markings.paintOpacity, t), 4),
    railGaugeM: round(mix(from.markings.railGaugeM, to.markings.railGaugeM, t), 4),
    colour: dominant.palette.roadMarking,
    railColour: dominant.palette.streetFurniture,
  }
}

/** Blended plan of two different eras. */
function blendedPlan(fromId: EraId, toId: EraId, t: number): EraVehiclePlan {
  const fromEra = getEra(fromId)
  const toEra = getEra(toId)
  const from = requireEraVehicleTable(fromId)
  const to = requireEraVehicleTable(toId)
  const fromPalette = paletteOf(fromEra)
  const toPalette = paletteOf(toEra)

  const fromWeights = new Map(from.fleet.map((entry) => [entry.modelKey, entry.weight]))
  const fromOnly = from.fleet.filter(
    (entry) => !to.fleet.some((candidate) => candidate.modelKey === entry.modelKey),
  )
  const keyOrder = [...to.fleet.map((entry) => entry.modelKey), ...fromOnly.map((entry) => entry.modelKey)]
  const rawWeights = new Map<string, number>()
  for (const entry of to.fleet) {
    rawWeights.set(entry.modelKey, mix(fromWeights.get(entry.modelKey) ?? 0, entry.weight, t))
  }
  for (const entry of fromOnly) {
    rawWeights.set(entry.modelKey, mix(entry.weight, 0, t))
  }
  const rawTotal = keyOrder.reduce((total, key) => total + (rawWeights.get(key) ?? 0), 0)

  const fleet: FleetPlanEntry[] = []
  for (const key of keyOrder) {
    const raw = rawWeights.get(key) ?? 0
    if (raw <= 0) {
      continue
    }
    const fromEntry = from.fleet.find((entry) => entry.modelKey === key)
    const toEntry = to.fleet.find((entry) => entry.modelKey === key)
    const useTo = fromEntry === undefined || (toEntry !== undefined && t >= 0.5)
    const source = useTo ? to : from
    const palette = useTo ? toPalette : fromPalette
    const entry = useTo ? toEntry : fromEntry
    if (entry === undefined) {
      continue
    }
    const model = requireVehicleModel(key)
    const paint = unique((entry.paintKeys ?? source.paints).map((paintKey) => paletteColour(palette, paintKey)))
    fleet.push({
      modelKey: key,
      model,
      share: rawTotal > 0 ? raw / rawTotal : 0,
      paint,
      tags: entry.role === undefined ? model.tags : unique([...model.tags, entry.role]),
    })
  }

  const dominant = t < 0.5 ? fromEra : toEra
  const fromLights = lightsFor(fromEra)
  const toLights = lightsFor(toEra)
  const headlampIntensity = round(mix(fromLights.headlampIntensity, toLights.headlampIntensity, t), 4)

  return {
    eraId: null,
    fromEraId: fromId,
    toEraId: toId,
    progress: t,
    settled: false,
    label: `${fromEra.shortLabel} \u2192 ${toEra.shortLabel}`,
    density: round(mix(fromEra.traffic.trafficDensity, toEra.traffic.trafficDensity, t), 4),
    speedMps: round(mix(fromEra.traffic.averageSpeedMps, toEra.traffic.averageSpeedMps, t), 4),
    speedRangeMps: [
      mix(from.speedRangeMps[0], to.speedRangeMps[0], t),
      mix(from.speedRangeMps[1], to.speedRangeMps[1], t),
    ],
    spacingM: round(
      mix(spacingFor(from, fromEra.traffic.trafficDensity), spacingFor(to, toEra.traffic.trafficDensity), t),
      1,
    ),
    parkedRatio: round(mix(fromEra.traffic.parkedRatio, toEra.traffic.parkedRatio, t), 4),
    // Lane geometry is discrete: the nearer era's street layout is the one that
    // is drawn, and the paint of both eras cross-fades across it.
    laneConfiguration: t < 0.5 ? from.laneConfiguration : to.laneConfiguration,
    markings: blendMarkings(from, to, dominant, t),
    lights: {
      night: mix(fromLights.night ? 1 : 0, toLights.night ? 1 : 0, t) >= 0.5,
      dusk: mix(fromLights.dusk ? 1 : 0, toLights.dusk ? 1 : 0, t) >= 0.5,
      headlampIntensity,
      taillampIntensity: round(headlampIntensity * TAILLAMP_RATIO, 4),
      indicators: mix(fromLights.indicators ? 1 : 0, toLights.indicators ? 1 : 0, t) >= 0.5,
    },
    sfx: {
      hornIntervalSec: round(mix(from.sfx.hornIntervalSec, to.sfx.hornIntervalSec, t), 4),
      engineIntervalSec: round(mix(from.sfx.engineIntervalSec, to.sfx.engineIntervalSec, t), 4),
      transitBellIntervalSec: mixOptional(from.sfx.transitBellIntervalSec, to.sfx.transitBellIntervalSec, t),
      evWhineIntervalSec: mixOptional(from.sfx.evWhineIntervalSec, to.sfx.evWhineIntervalSec, t),
      tireSquealIntervalSec: mixOptional(from.sfx.tireSquealIntervalSec, to.sfx.tireSquealIntervalSec, t),
      minIntervalSec: round(mix(from.sfx.minIntervalSec, to.sfx.minIntervalSec, t), 4),
    },
    fleet,
    census: unique([...censusOf(from), ...censusOf(to)]),
    microMobility: from.microMobility || to.microMobility,
    paints: unique([
      ...from.paints.map((key) => paletteColour(fromPalette, key)),
      ...to.paints.map((key) => paletteColour(toPalette, key)),
    ]),
    palette: {
      roadSurface: dominant.palette.roadSurface,
      roadMarking: dominant.palette.roadMarking,
      accent: dominant.palette.accent,
    },
  }
}

/**
 * Resolves a staged era change into a plan.
 *
 * A settled era, `t = 0` and `t = 1` all take the exact single-era path, so a
 * finished transition is identical to applying its destination directly.
 */
export function resolveEraPlan(input: EraTransitionInput): EraVehiclePlan {
  const from = requireEraId(input.from)
  const to = requireEraId(input.to)
  const t = Number.isFinite(input.t) ? clamp(input.t, 0, 1) : 0
  if (from === to) {
    return eraPlan(to)
  }
  if (t <= 0) {
    return eraPlan(from)
  }
  if (t >= 1) {
    return eraPlan(to)
  }
  return blendedPlan(from, to, t)
}

/** Applies a settled era to the context's target and returns the plan. */
export function applyEra(eraId: EraId, context: EraApplicationContext): EraVehiclePlan {
  const plan = eraPlan(requireEraId(eraId))
  context.target?.applyPlan(plan)
  return plan
}

/**
 * Applies a staged era change to the context's target and returns the plan.
 *
 * Under reduced motion the layer never blends: the destination plan is applied
 * at once, whatever progress the transition reports.
 */
export function applyEraTransition(
  input: EraTransitionInput,
  context: EraApplicationContext,
): EraVehiclePlan {
  const t = context.reducedMotion === true ? 1 : input.t
  const plan = resolveEraPlan({ from: input.from, to: input.to, t })
  context.target?.applyPlan(plan)
  return plan
}

/** Stable signature of a plan's behaviour, used to prove transition endpoints. */
export function planSignature(plan: EraVehiclePlan): string {
  return JSON.stringify({
    eraId: plan.eraId,
    from: plan.fromEraId,
    to: plan.toEraId,
    progress: plan.progress,
    settled: plan.settled,
    density: plan.density,
    speedMps: plan.speedMps,
    speedRangeMps: plan.speedRangeMps,
    spacingM: plan.spacingM,
    parkedRatio: plan.parkedRatio,
    lanes: plan.laneConfiguration,
    markings: {
      features: plan.markings.features,
      weights: plan.markings.featureWeights,
      paintOpacity: plan.markings.paintOpacity,
      railGaugeM: plan.markings.railGaugeM,
      colour: plan.markings.colour,
      railColour: plan.markings.railColour,
    },
    lights: plan.lights,
    sfx: plan.sfx,
    fleet: plan.fleet.map((entry) => ({
      modelKey: entry.modelKey,
      share: round(entry.share, 6),
      paint: entry.paint,
      tags: entry.tags,
    })),
    census: plan.census,
    microMobility: plan.microMobility,
    paints: plan.paints,
    palette: plan.palette,
  })
}

/* ------------------------------------------------------------------------- *\
 * Fleet construction
 * ------------------------------------------------------------------------- */

/** The traffic circuits of a layout, in layout order. */
export function trafficLanes(layout: LayoutReference): readonly PathSpline[] {
  return layout.vehicleSplines.filter((spline) => spline.role === 'traffic-lane')
}

/**
 * Index of the lane micro-mobility uses: the block-side kerb lane, i.e. the
 * traffic lane whose centre sits furthest toward the block.
 */
export function microLaneIndex(lanes: readonly PathSpline[]): number {
  let best = -1
  let bestOffset = Number.NEGATIVE_INFINITY
  lanes.forEach((lane, index) => {
    const offset = lane.laneOffset ?? Number.NEGATIVE_INFINITY
    if (offset >= 0 && offset > bestOffset) {
      best = index
      bestOffset = offset
    }
  })
  return best
}

/** Interval of one SFX kind in a profile, or `null` when the kind is off. */
export function sfxIntervalFor(kind: SfxKind, profile: SfxProfile): number | null {
  switch (kind) {
    case 'horn':
      return profile.hornIntervalSec
    case 'engine':
      return profile.engineIntervalSec > 0 ? profile.engineIntervalSec : null
    case 'transit-bell':
      return profile.transitBellIntervalSec
    case 'ev-whine':
      return profile.evWhineIntervalSec
    case 'tire-squeal':
      return profile.tireSquealIntervalSec
  }
}

/**
 * Rate-limited SFX schedule of one vehicle over the scene-time horizon.
 *
 * Every gap is at least the profile's floor, so "rate-limited" is a property of
 * the data rather than of a runtime accumulator: replaying the schedule always
 * produces the same sparse, plausible stream of horns, engines and bells.
 */
export function buildSfxSchedule(
  kinds: readonly SfxKind[],
  profile: SfxProfile,
  rng: Rng,
): SfxScheduleEntry[] {
  const entries: SfxScheduleEntry[] = []
  for (const kind of SFX_KINDS) {
    if (!kinds.includes(kind)) {
      continue
    }
    const interval = sfxIntervalFor(kind, profile)
    if (interval === null || !(interval > 0)) {
      continue
    }
    const floor = Math.max(profile.minIntervalSec, interval * 0.5)
    let time = rng.float(floor, interval * 1.5)
    while (time < SFX_HORIZON_SEC) {
      entries.push({ kind, timeSec: round(time, 3) })
      time += rng.float(Math.max(floor, interval * 0.6), interval * 1.4)
    }
  }
  return entries.sort((left, right) => left.timeSec - right.timeSec)
}

function weightedPick(entries: readonly FleetPlanEntry[], rng: Rng): FleetPlanEntry {
  const total = entries.reduce((sum, entry) => sum + entry.share, 0)
  let draw = rng.next() * (total > 0 ? total : 1)
  for (const entry of entries) {
    draw -= entry.share
    if (draw <= 0) {
      return entry
    }
  }
  const last = entries[entries.length - 1]
  if (last === undefined) {
    throw new RangeError('Cannot draw a vehicle from an empty census')
  }
  return last
}

/** Deterministic seed label of a plan: the block seed plus its census. */
export function fleetSeedLabel(plan: EraVehiclePlan, seed: Seed): string {
  return `${String(seed)}|vehicles|${plan.census.join(',')}`
}

export interface FleetBuildOptions {
  readonly plan: EraVehiclePlan
  readonly layout: LayoutReference
  readonly seed?: Seed
  readonly quality?: string | null
}

export interface BuiltFleet {
  readonly fleet: readonly VehicleInstance[]
  readonly parked: readonly ParkedVehicle[]
  readonly lanes: readonly string[]
  /** Index of the lane micro-mobility rides, or `-1` when the layout has none. */
  readonly microLane: number
}

/** Quality tier resolved from untrusted input, defaulting to the shared default. */
export function fleetQuality(quality?: string | null): string {
  return isQualityTierName(quality) ? quality : DEFAULT_QUALITY_TIER
}

/**
 * Parking bays an era may use: every `parking-bay` anchor of the block.
 *
 * The layer never moves or edits the layout's anchors — it selects a
 * deterministic subset of them and stands a vehicle in each one.
 */
export function selectParkingBays(layout: LayoutReference): readonly ParkingAnchor[] {
  return (layout.anchors ?? []).filter((anchor) => anchor.kind === 'parking-bay')
}

/**
 * Parked vehicles of a plan: a deterministic subset of the era's bays, filled
 * from the models that actually park, at the era's kerbside occupancy.
 *
 * The layout's kerbside strip is `PARKING_WIDTH` deep with `PARKING_BAY_PITCH`
 * long bays, so a parked vehicle stands *parallel* to the kerb, facing the
 * direction the traffic on that side of the street travels. Its footprint then
 * fits the strip exactly: nothing overhangs the kerb or the travel lane.
 */
export function buildParkedVehicles(options: {
  readonly plan: EraVehiclePlan
  readonly layout: LayoutReference
  readonly rng: Rng
}): readonly ParkedVehicle[] {
  const { plan, layout, rng } = options
  const bays = selectParkingBays(layout)
  const eligible = plan.fleet.filter((entry) => entry.model.parks && !entry.model.micro)
  if (bays.length === 0 || eligible.length === 0) {
    return []
  }
  const weightTotal = eligible.reduce((sum, entry) => sum + entry.share, 0)
  const shares = eligible.map((entry) => ({
    ...entry,
    share: weightTotal > 0 ? entry.share / weightTotal : 0,
  }))
  const occupancy = clamp(plan.parkedRatio, 0, 1)
  const count = Math.min(bays.length, Math.round(bays.length * occupancy))
  const chosen = rng
    .shuffle(bays)
    .slice(0, count)
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))

  return chosen.map((bay) => {
    const entry = weightedPick(shares, rng)
    const model = entry.model
    return {
      id: `p:${bay.name}`,
      anchorName: bay.name,
      modelKey: model.key,
      class: model.class,
      micro: model.micro,
      position: bay.position,
      headingRad: bayHeading(bay),
      paint: rng.pick(entry.paint),
      lengthM: model.lengthM,
      widthM: model.widthM,
      heightM: model.heightM,
      scale: round(rng.float(SCALE_JITTER.min, SCALE_JITTER.max), 3),
      lamps: { headlamp: 0, taillamp: 0, indicator: false },
      tags: entry.tags,
      model,
    }
  })
}

/**
 * Yaw of a vehicle standing in a bay: parallel to the kerb, facing the
 * direction the block-side lanes travel along that street.
 */
export function bayHeading(bay: ParkingAnchor): number {
  if (bay.facing === null) {
    return 0
  }
  const street = streetByName(bay.facing as StreetName)
  return Math.atan2(street.direction.x, street.direction.z)
}

/**
 * Spawns the traffic and the parked vehicles of a plan.
 *
 * Moving vehicles are laid out evenly along each real traffic spline at the
 * plan's spacing, with the model drawn from the census by share; micro-mobility
 * only ever appears on the kerb lane (and rides the cycle lane when the era has
 * one). Parked vehicles take real `parking-bay` anchors on the era's parking
 * side, at the era's occupancy.
 */
export function buildFleet(options: FleetBuildOptions): BuiltFleet {
  const { plan, layout } = options
  const lanes = trafficLanes(layout)
  if (lanes.length === 0) {
    throw new RangeError('The vehicle layer needs at least one traffic-lane spline')
  }
  const microLane = microLaneIndex(lanes)
  const densityMultiplier = resolveQualityTier(fleetQuality(options.quality)).density.vehicles
  const rng = createRng(fleetSeedLabel(plan, options.seed ?? layout.seedInput))

  const fleet: VehicleInstance[] = []
  lanes.forEach((spline, laneIndex) => {
    const isMicroLane = laneIndex === microLane
    // The layout's block-side circuits turn on 5.75–7 m radii, the far-side ones
    // on 4 m; long transit vehicles therefore keep to the block-side lanes,
    // where the corner geometry can carry them without cutting the corner.
    const laneOffset = spline.laneOffset ?? 0
    const longVehicleLimit = laneOffset >= 0 ? Number.POSITIVE_INFINITY : LONG_VEHICLE_LANE_LIMIT_M
    const eligible = plan.fleet.filter(
      (entry) => (isMicroLane || !entry.model.micro) && entry.model.lengthM <= longVehicleLimit,
    )
    const entries = eligible.length > 0 ? eligible : plan.fleet
    const weightTotal = entries.reduce((sum, entry) => sum + entry.share, 0)
    const shares = entries.map((entry) => ({
      ...entry,
      share: weightTotal > 0 ? entry.share / weightTotal : 0,
    }))
    const longest = entries.reduce((value, entry) => Math.max(value, entry.model.lengthM), 0)
    const spacing = Math.max(plan.spacingM, longest + MIN_GAP_M)
    const capacity = Math.max(1, Math.floor(spline.length / spacing))
    const count = Math.max(1, Math.floor(capacity * densityMultiplier))
    // An era whose street carries micro-mobility always shows at least one of
    // its micro models: the first slot of the kerb lane is reserved for it, so a
    // sparse draw can never hide a period feature the era declares.
    const microEntries = shares.filter((entry) => entry.model.micro)
    const laneSpeed = round(
      clamp(
        plan.speedMps * rng.float(1 - LANE_SPEED_JITTER, 1 + LANE_SPEED_JITTER),
        plan.speedRangeMps[0],
        plan.speedRangeMps[1],
      ),
      3,
    )

    for (let slot = 0; slot < count; slot += 1) {
      const entry =
        isMicroLane && microEntries.length > 0 && slot === 0
          ? weightedPick(microEntries, rng)
          : weightedPick(shares, rng)
      const model = entry.model
      const lateralOffset = model.micro && plan.laneConfiguration.bikeLane ? BIKE_LANE_LATERAL_OFFSET : 0
      fleet.push({
        id: `v:${laneIndex}:${slot}`,
        modelKey: model.key,
        class: model.class,
        power: model.power,
        micro: model.micro,
        silhouette: model.silhouette,
        tags: entry.tags,
        laneIndex,
        splineName: spline.name,
        startDistance: round((slot * spline.length) / count, 3),
        loopLength: spline.length,
        lateralOffset,
        speedMps: laneSpeed,
        paint: rng.pick(entry.paint),
        lengthM: model.lengthM,
        widthM: model.widthM,
        heightM: model.heightM,
        scale: round(rng.float(SCALE_JITTER.min, SCALE_JITTER.max), 3),
        lamps: {
          headlamp: plan.lights.headlampIntensity,
          taillamp: plan.lights.taillampIntensity,
          indicator: false,
        },
        indicates: model.lamps.indicators && rng.bool(INDICATOR_FRACTION),
        blinkOffsetSec: round(rng.float(0, BLINK_PERIOD_SEC), 3),
        schedule: buildSfxSchedule(model.sfxKinds, plan.sfx, rng),
        model,
      })
    }
  })

  return {
    fleet,
    parked: buildParkedVehicles({ plan, layout, rng }),
    lanes: lanes.map((spline) => spline.name),
    microLane,
  }
}

/* ------------------------------------------------------------------------- *\
 * Motion
 * ------------------------------------------------------------------------- */

/** Arc length of a vehicle along its loop at a clock reading, in metres. */
export function vehicleDistance(instance: VehicleInstance, clockSec: number): number {
  const raw = instance.startDistance + instance.speedMps * clockSec
  return round(((raw % instance.loopLength) + instance.loopLength) % instance.loopLength, 4)
}

/**
 * Ground normal that points toward the block at a spline tangent.
 *
 * The splines of the block carry their circulation, and a block-clockwise
 * circuit has the block on the opposite side from a counter-clockwise one, so
 * the sign of the normal is a property of the circuit, not of the street.
 */
export function blockNormal(tangent: Vec3, circulation: PathSpline['circulation']): Vec2 {
  return circulation === 'counter-clockwise'
    ? { x: tangent.z, z: -tangent.x }
    : { x: -tangent.z, z: tangent.x }
}

/** True while a vehicle's indicator lamps are in the lit part of their blink. */
export function indicatorLit(instance: VehicleInstance, clockSec: number): boolean {
  const phase =
    (((clockSec + instance.blinkOffsetSec) % BLINK_PERIOD_SEC) + BLINK_PERIOD_SEC) % BLINK_PERIOD_SEC
  return phase < BLINK_PERIOD_SEC * BLINK_DUTY
}

/**
 * Pose of one vehicle at a clock reading.
 *
 * The position is the sampled spline point displaced by the vehicle's lateral
 * offset, the heading is the spline tangent, and the lamps are the era's lamp
 * state with the indicator blink applied — all pure in `clockSec`.
 */
export function vehiclePoseAt(
  instance: VehicleInstance,
  spline: PathSpline,
  clockSec: number,
): VehiclePose {
  const distance = vehicleDistance(instance, clockSec)
  const sample = splinePoseAt(spline, distance)
  const normal = blockNormal(sample.tangent, spline.circulation)
  const magnitude = Math.hypot(sample.tangent.x, sample.tangent.z)
  const heading: Vec2 =
    magnitude > 0
      ? { x: sample.tangent.x / magnitude, z: sample.tangent.z / magnitude }
      : { x: 0, z: 1 }
  const indicator =
    instance.indicates && instance.lamps.headlamp > 0 && indicatorLit(instance, clockSec)
  return {
    id: instance.id,
    modelKey: instance.modelKey,
    class: instance.class,
    micro: instance.micro,
    laneIndex: instance.laneIndex,
    splineName: instance.splineName,
    distance,
    position: {
      x: round(sample.position.x + normal.x * instance.lateralOffset),
      y: sample.position.y,
      z: round(sample.position.z + normal.z * instance.lateralOffset),
    },
    headingRad: Math.atan2(heading.x, heading.z),
    heading,
    speedMps: instance.speedMps,
    paint: instance.paint,
    lengthM: instance.lengthM,
    widthM: instance.widthM,
    heightM: instance.heightM,
    scale: instance.scale,
    lamps: { headlamp: instance.lamps.headlamp, taillamp: instance.lamps.taillamp, indicator },
    tags: instance.tags,
    model: instance.model,
  }
}

/** Poses of a whole fleet at a clock reading. */
export function poseVehicles(
  fleet: readonly VehicleInstance[],
  splines: readonly PathSpline[],
  clockSec: number,
): VehiclePose[] {
  const byName = new Map(splines.map((spline) => [spline.name, spline]))
  return fleet.map((instance) => {
    const spline = byName.get(instance.splineName)
    if (spline === undefined) {
      throw new RangeError(`No spline named ${instance.splineName} in the layout`)
    }
    return vehiclePoseAt(instance, spline, clockSec)
  })
}

/** Poses whose centre has left the carriageway, i.e. a real defect. */
export function posesLeavingRoadway(poses: readonly VehiclePose[]): VehiclePose[] {
  return poses.filter((pose) => classifyGround(pose.position.x, pose.position.z) !== 'roadway')
}

/* ------------------------------------------------------------------------- *\
 * SFX triggers
 * ------------------------------------------------------------------------- */

export interface SfxCollectionOptions {
  readonly fleet: readonly VehicleInstance[]
  readonly splines: readonly PathSpline[]
  readonly fromSec: number
  readonly toSec: number
}

/**
 * SFX triggers of a fleet inside a half-open clock window `(fromSec, toSec]`.
 *
 * The schedule is a fixed, rate-limited table per vehicle, so the stream is a
 * pure function of the clock window: no accumulator, no drift, and a replay
 * produces exactly the same events. The scheduler wraps every
 * {@link SFX_HORIZON_SEC} seconds of scene time.
 */
export function collectSfxEvents(options: SfxCollectionOptions): SfxTrigger[] {
  const byName = new Map(options.splines.map((spline) => [spline.name, spline]))
  const from = Math.min(options.fromSec, options.toSec)
  const to = Math.max(options.fromSec, options.toSec)
  const triggers: SfxTrigger[] = []
  if (!(to > from)) {
    return triggers
  }

  for (const instance of options.fleet) {
    const spline = byName.get(instance.splineName)
    if (spline === undefined || instance.schedule.length === 0) {
      continue
    }
    const firstPass = Math.floor(from / SFX_HORIZON_SEC) - 1
    const lastPass = Math.ceil(to / SFX_HORIZON_SEC) + 1
    for (const entry of instance.schedule) {
      for (let pass = firstPass; pass <= lastPass; pass += 1) {
        const time = entry.timeSec + pass * SFX_HORIZON_SEC
        if (time <= from || time > to) {
          continue
        }
        triggers.push({
          kind: entry.kind,
          vehicleId: instance.id,
          modelKey: instance.modelKey,
          timeSec: round(time, 3),
          position: vehiclePoseAt(instance, spline, time).position,
          gain: SFX_GAINS[entry.kind],
          splineName: instance.splineName,
        })
      }
    }
  }

  return triggers.sort(
    (left, right) =>
      left.timeSec - right.timeSec ||
      (left.vehicleId < right.vehicleId ? -1 : left.vehicleId > right.vehicleId ? 1 : 0) ||
      SFX_KINDS.indexOf(left.kind) - SFX_KINDS.indexOf(right.kind),
  )
}

/** SFX kinds a fleet can actually emit under a plan, in catalogue order. */
export function emittedSfxKinds(fleet: readonly VehicleInstance[]): SfxKind[] {
  const available = new Set<SfxKind>()
  for (const instance of fleet) {
    for (const entry of instance.schedule) {
      available.add(entry.kind)
    }
  }
  return SFX_KINDS.filter((kind) => available.has(kind))
}

/* ------------------------------------------------------------------------- *\
 * Snapshot
 * ------------------------------------------------------------------------- */

interface SnapshotInput {
  readonly plan: EraVehiclePlan
  readonly fleet: readonly VehicleInstance[]
  readonly parked: readonly ParkedVehicle[]
  readonly markings: ReturnType<typeof buildMarkingGeometry>
  readonly clockSec: number
  readonly emitted: readonly SfxTrigger[]
  readonly lastStep: readonly SfxTrigger[]
  readonly splines: readonly PathSpline[]
}

function buildSnapshot(input: SnapshotInput): VehiclesSnapshot {
  const poses = poseVehicles(input.fleet, input.splines, input.clockSec)
  const first = poses[0] ?? null
  return {
    eraId: input.plan.eraId,
    fromEraId: input.plan.fromEraId,
    toEraId: input.plan.toEraId,
    progress: input.plan.progress,
    settled: input.plan.settled,
    clockSec: input.clockSec,
    density: input.plan.density,
    speedMps: input.plan.speedMps,
    spacingM: input.plan.spacingM,
    movingCount: input.fleet.length,
    movingByModel: countBy(input.fleet, (instance) => instance.modelKey),
    movingByClass: countBy(input.fleet, (instance) => instance.class),
    microCount: input.fleet.filter((instance) => instance.micro).length,
    parkedCount: input.parked.length,
    parkedByModel: countBy(input.parked, (vehicle) => vehicle.modelKey),
    census: input.plan.census,
    markingGroupCounts: input.markings.groupCounts,
    markingPieceCount: input.markings.pieces.length,
    markingSignature: markingSignature(input.markings),
    lanes: input.plan.laneConfiguration,
    lights: input.plan.lights,
    sfxKinds: emittedSfxKinds(input.fleet),
    sfxEmitted: input.emitted.length,
    sfxLastStep: input.lastStep,
    firstPose: first,
  }
}

/* ------------------------------------------------------------------------- *\
 * The live layer
 * ------------------------------------------------------------------------- */

export interface VehicleLayerOptions {
  readonly layout: LayoutReference
  /** Era applied at creation; defaults to the timeline's default era. */
  readonly eraId?: EraId
  readonly seed?: Seed
  readonly quality?: string | null
  /** Reduced motion: era switches apply instantly instead of blending. */
  readonly reducedMotion?: boolean
  /** Audio owner's sink for horn, engine, bell, whine and squeal events. */
  readonly onSfxTrigger?: SfxTriggerListener
  /** Initial clock reading, in seconds. */
  readonly clockSec?: number
}

/**
 * Creates the framework-free core of the vehicle layer.
 *
 * The layer owns a plan plus its fleet, parking and marking geometry, and it is
 * driven by the caller's clock: {@link VehicleLayer.setClock} advances the
 * simulated time and hands the SFX events of that step to the listener, and
 * {@link VehicleLayer.poseAt} answers with pure poses at any clock reading.
 */
export function createVehicleLayer(options: VehicleLayerOptions): VehicleLayer {
  const layout = options.layout
  const seed = options.seed ?? layout.seedInput
  const quality = options.quality ?? null
  const splines = trafficLanes(layout)
  const listener = options.onSfxTrigger

  let clock = options.clockSec ?? 0
  let emitted: SfxTrigger[] = []
  let lastStep: readonly SfxTrigger[] = []
  let plan = eraPlan(options.eraId ?? DEFAULT_ERA_ID)
  let built = buildFleet({ plan, layout, seed, quality })
  let markings = buildMarkingGeometry(plan)

  const applyPlan = (next: EraVehiclePlan): void => {
    plan = next
    built = buildFleet({ plan, layout, seed, quality })
    markings = buildMarkingGeometry(plan)
    lastStep = []
  }

  const context: EraApplicationContext = {
    layout,
    seed,
    quality: quality ?? undefined,
    reducedMotion: options.reducedMotion,
    target: { applyPlan },
  }

  const layer: VehicleLayer = {
    layout,
    get paintOrder() {
      return plan.paints
    },
    get plan() {
      return plan
    },
    get fleet() {
      return built.fleet
    },
    get parked() {
      return built.parked
    },
    get markings() {
      return markings
    },
    get movingCount() {
      return built.fleet.length
    },
    get parkedCount() {
      return built.parked.length
    },
    get clockSec() {
      return clock
    },
    get emitted() {
      return emitted
    },
    applyPlan,
    setEra(eraId: EraId) {
      return applyEra(eraId, context)
    },
    setEraTransition(input: EraTransitionInput) {
      return applyEraTransition(input, context)
    },
    poseAt(clockSec: number) {
      return poseVehicles(built.fleet, splines, clockSec)
    },
    setClock(clockSec: number) {
      if (!Number.isFinite(clockSec)) {
        return []
      }
      const previous = clock
      const events = clockSec > previous
        ? collectSfxEvents({ fleet: built.fleet, splines, fromSec: previous, toSec: clockSec })
        : []
      clock = clockSec
      lastStep = events
      if (events.length > 0) {
        emitted = [...emitted, ...events]
        if (listener !== undefined) {
          for (const trigger of events) {
            listener(trigger)
          }
        }
      }
      return events
    },
    snapshot(clockSec?: number) {
      return buildSnapshot({
        plan,
        fleet: built.fleet,
        parked: built.parked,
        markings,
        clockSec: clockSec ?? clock,
        emitted,
        lastStep,
        splines,
      })
    },
  }

  return layer
}
