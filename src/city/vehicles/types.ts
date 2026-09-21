/**
 * Data contract of the era vehicle layer.
 *
 * The layer has three layers of data, and this file is the boundary between
 * them:
 *
 * 1. **the catalogue** ({@link VehicleModelSpec}) — the procedural low-poly
 *    assemblies, described as primitive parts in metres so a model is data, not
 *    code, and the same description drives both the instanced renderer and the
 *    unit suite;
 * 2. **the era tables** ({@link EraVehicleTable}) — fleet census, density and
 *    speed ranges, lane configuration, road-marking plan and SFX cadence of one
 *    period, keyed by the shared `EraId`;
 * 3. **the resolved plan** ({@link EraVehiclePlan}) — what a caller actually
 *    animates: normalised fleet shares, paint colours drawn from the era
 *    palette, light levels, and the marking/lane configuration after a
 *    (possibly blended) era change.
 *
 * Everything here is plain, serialisable data. No three.js, no React, no
 * renderer: the pure animation functions in `traffic.ts` and the marking
 * builder in `markings.ts` consume these records, and `models.ts` is the single
 * file that turns them into three.js objects.
 */

import type { EraId, EraPalette, HexColor } from '../../era'
import type { PathSpline, StreetName, Vec2, Vec3 } from '../layout'

/* ------------------------------------------------------------------------- *\
 * Vehicle taxonomy
 * ------------------------------------------------------------------------- */

/** Body classes the fleet mix is expressed in. */
export const VEHICLE_CLASSES = [
  'car',
  'taxi',
  'police',
  'van',
  'truck',
  'bus',
  'streetcar',
  'micro',
] as const

export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

/** What drives the vehicle; decides its SFX family and its noise signature. */
export const VEHICLE_POWERS = ['combustion', 'electric', 'human'] as const

export type VehiclePower = (typeof VEHICLE_POWERS)[number]

/** Period body language, used to pick proportions and detail parts. */
export type VehicleSilhouette =
  | 'rounded'
  | 'tailfin'
  | 'boxy'
  | 'aero'
  | 'pod'
  | 'utility'
  | 'transit'
  | 'micro'

/** Material role of one primitive part of an assembly. */
export type VehiclePartRole = 'body' | 'glass' | 'trim' | 'tire' | 'lamp' | 'glow' | 'detail'

/** Primitive used by {@link VehiclePartSpec}: a box, a cylinder, a sphere or a wheel. */
export type VehiclePartShape = 'box' | 'cylinder' | 'sphere' | 'wheel'

/**
 * Which colour of the model's palette a part uses.
 *
 * `paint` is the body colour of the concrete instance (the era palette colour
 * drawn from the fleet entry), the rest are fixed period details.
 */
export type VehicleColourKey =
  | 'paint'
  | 'trim'
  | 'glass'
  | 'tire'
  | 'headlamp'
  | 'taillamp'
  | 'glow'
  | 'sign'
  | 'metal'

/** One primitive of a procedural vehicle assembly, in metres, local to the model. */
export interface VehiclePartSpec {
  readonly name: string
  readonly role: VehiclePartRole
  readonly shape: VehiclePartShape
  /**
   * Extent of the primitive: `[width, height, length]` for boxes, cylinders and
   * spheres, `[radius, height, width]` for wheels.
   */
  readonly size: readonly [number, number, number]
  /** Local centre offset: `x` across, `y` up, `z` along the model's length axis. */
  readonly offset: readonly [number, number, number]
  /** Rotation about the model's up axis, in radians. */
  readonly rotationY?: number
  /** Colour of the part; `paint` follows the instance. */
  readonly colourKey: VehicleColourKey
}

/** Lamp layout of a model: how many lamps, and whether indicators are fitted. */
export interface VehicleLampSpec {
  readonly head: number
  readonly tail: number
  readonly indicators: boolean
  readonly roofBeacon: boolean
}

/** Sound effects one model can trigger. */
export const SFX_KINDS = ['horn', 'engine', 'transit-bell', 'ev-whine', 'tire-squeal'] as const

export type SfxKind = (typeof SFX_KINDS)[number]

/** Complete description of one vehicle model of the catalogue. */
export interface VehicleModelSpec {
  /** Stable catalogue key, e.g. `tailfin-sedan-1960s`. */
  readonly key: string
  readonly label: string
  readonly class: VehicleClass
  readonly power: VehiclePower
  readonly silhouette: VehicleSilhouette
  /** Free-form traits the tests and the report use, e.g. `muscle-car`. */
  readonly tags: readonly string[]
  /** Overall length along the model's `+z` axis, in metres. */
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  /** Distance between the front and rear axle centres, in metres. */
  readonly wheelbaseM: number
  readonly wheelRadiusM: number
  readonly wheelWidthM: number
  /** Half the distance between the left and right wheel centres. */
  readonly trackHalfM: number
  readonly lamps: VehicleLampSpec
  /** True when the model is a vehicle that can occupy a kerbside parking bay. */
  readonly parks: boolean
  /** True for bikes, scooters and delivery robots: the era-gated micro-mobility. */
  readonly micro: boolean
  /** Primitives of the assembly, in local model space. */
  readonly parts: readonly VehiclePartSpec[]
  /** SFX the model can emit, ordered by dominance. */
  readonly sfxKinds: readonly SfxKind[]
}

/* ------------------------------------------------------------------------- *\
 * Era tables
 * ------------------------------------------------------------------------- */

/** Palette keys of `src/era`, the only source of vehicle colours. */
export type PaletteKey = keyof EraPalette

/** One census entry: how much of the era's fleet is this model, in which colours. */
export interface FleetEntrySpec {
  readonly modelKey: string
  /** Relative share of the fleet; shares are normalised per era. */
  readonly weight: number
  /** Palette keys of the era this model is painted from; defaults to the era list. */
  readonly paintKeys?: readonly PaletteKey[]
  /** Extra traits merged onto the model's tags in the plan, e.g. `streetcar`. */
  readonly role?: string
}

/** Lane and parking configuration of one era's street. */
export interface LaneConfiguration {
  /** Total drivable lanes across the street, including parking lanes. */
  readonly totalLanes: number
  /** Directional travel lanes per side of the centre line. */
  readonly travelLanesPerDirection: number
  /**
   * Kerbside parking lanes the era paints: 0 leaves the kerbside unmarked,
   * 1 paints bay markings on the published strip side, 2 paints both kerbs.
   */
  readonly parkingLanes: 0 | 1 | 2
  /** True when a striped cycle lane runs inside the kerb lane. */
  readonly bikeLane: boolean
  /** True when turn arrows are painted into the inner lane approaches. */
  readonly turnArrows: boolean
  /** True when streetcar rails are laid in the kerb lane. */
  readonly streetcarRails: boolean
  /** Kerbside charging stencils, counted per parking strip. */
  readonly chargingPointsPerStrip: number
  /** True when crossings are painted as pedestrian-priority bands. */
  readonly pedestrianPriority: boolean
  /** Width of one travel lane, in metres. */
  readonly laneWidthM: number
}

/** Era road-marking features; each kind is one named marking group. */
export const MARKING_FEATURE_KINDS = [
  'centre-line',
  'lane-division',
  'parking-lane',
  'bike-lane',
  'turn-arrow',
  'streetcar-rail',
  'charging-point',
  'pedestrian-priority',
] as const

export type MarkingFeatureKind = (typeof MARKING_FEATURE_KINDS)[number]

/** Marking plan of one era. */
export interface EraMarkingSpec {
  /** Groups the era paints; the ordered feature set is the era's signature. */
  readonly features: readonly MarkingFeatureKind[]
  /**
   * Opacity of painted markings: 0 for an era that paints nothing at all
   * (only physical rails remain), 1 for fully saturated modern paint.
   */
  readonly paintOpacity: number
  /** Track gauge of the streetcar rails, in metres. */
  readonly railGaugeM: number
}

/** Rate-limited cadence of one era's vehicle sound effects. */
export interface SfxProfile {
  /** Mean seconds between two horn events of one vehicle. */
  readonly hornIntervalSec: number
  /** Mean seconds between two engine events of one vehicle; 0 disables them. */
  readonly engineIntervalSec: number
  /** Transit bell cadence, or `null` when the era has no transit bell. */
  readonly transitBellIntervalSec: number | null
  /** EV whine cadence, or `null` when the era has no electric fleet. */
  readonly evWhineIntervalSec: number | null
  /** Tire squeal cadence, or `null` when the era's fleet does not squeal. */
  readonly tireSquealIntervalSec: number | null
  /** Hard floor between two events of the same kind on the same vehicle. */
  readonly minIntervalSec: number
}

/** The complete per-era data table of the vehicle layer. */
export interface EraVehicleTable {
  readonly eraId: EraId
  /** Slider label mirroring the era registry, e.g. `1945`. */
  readonly label: string
  /** Inclusive cruising speed band the era's traffic stays inside, in m/s. */
  readonly speedRangeMps: readonly [number, number]
  /** Lane and parking configuration. */
  readonly laneConfiguration: LaneConfiguration
  /** Road-marking plan. */
  readonly markings: EraMarkingSpec
  /** SFX cadence. */
  readonly sfx: SfxProfile
  /** Fleet census; shares are normalised when the plan is resolved. */
  readonly fleet: readonly FleetEntrySpec[]
  /** Palette keys every model of the era may be painted from by default. */
  readonly paints: readonly PaletteKey[]
  /** True when the era's street hosts micro-mobility (bikes, scooters, robots). */
  readonly microMobility: boolean
}

/* ------------------------------------------------------------------------- *\
 * Resolved plan
 * ------------------------------------------------------------------------- */

/** One fleet entry of a resolved plan: normalised share and resolved paints. */
export interface FleetPlanEntry {
  readonly modelKey: string
  readonly model: VehicleModelSpec
  /** Normalised share in the closed interval 0..1; the era's shares sum to 1. */
  readonly share: number
  /** Palette colours this model is painted from, resolved from the era palette. */
  readonly paint: readonly HexColor[]
  /** Display tags, including the entry's optional role. */
  readonly tags: readonly string[]
}

/** How the era's fleet is lit: full beams at night, running lights at dusk. */
export interface EraLightPlan {
  /** True when the era's hero time is below the horizon. */
  readonly night: boolean
  /** True in the low-sun band where cars run daytime running lights. */
  readonly dusk: boolean
  /** Headlamp strength in `[0, 1]`; 0 means the fleet is unlit. */
  readonly headlampIntensity: number
  /** Taillamp strength in `[0, 1]`. */
  readonly taillampIntensity: number
  /** True when indicator lamps blink in this era. */
  readonly indicators: boolean
}

/** Resolved marking configuration of a plan. */
export interface ResolvedMarkingSpec extends EraMarkingSpec {
  /**
   * Per-feature paint weight in the closed interval 0..1. A settled era is all
   * ones; a staged era switch scales both features so the paint cross-fades
   * while the lane configuration flips at the midpoint.
   */
  readonly featureWeights: Readonly<Partial<Record<MarkingFeatureKind, number>>>
  /** Paint colour of the era's markings, from the era palette. */
  readonly colour: HexColor
  /** Colour of physical rails, from the era palette. */
  readonly railColour: HexColor
}

/** Everything the renderer and the animator need for one (possibly blended) era. */
export interface EraVehiclePlan {
  /** Target era, or `null` while two eras are blended. */
  readonly eraId: EraId | null
  readonly fromEraId: EraId
  readonly toEraId: EraId
  /** Blend progress in `[0, 1]`; 1 settles exactly on {@link toEraId}. */
  readonly progress: number
  /** True when the plan describes a single era. */
  readonly settled: boolean
  readonly label: string
  /** Traffic density in `[0, 1]`: 0 is an empty street, 1 is gridlock. */
  readonly density: number
  /** Mean cruising speed in m/s. */
  readonly speedMps: number
  /** Inclusive cruising speed band the era's traffic stays inside, in m/s. */
  readonly speedRangeMps: readonly [number, number]
  /** Minimum longitudinal distance between two vehicles of one convoy, in metres. */
  readonly spacingM: number
  /** Fraction of the era's vehicle population standing at the kerb. */
  readonly parkedRatio: number
  readonly laneConfiguration: LaneConfiguration
  readonly markings: ResolvedMarkingSpec
  readonly lights: EraLightPlan
  readonly sfx: SfxProfile
  readonly fleet: readonly FleetPlanEntry[]
  /** Order-preserving union of the fleet's model keys: the era's census. */
  readonly census: readonly string[]
  readonly microMobility: boolean
  /** Every paint colour of the plan, resolved from the era palette. */
  readonly paints: readonly HexColor[]
  /** Palette colours the marking builder draws from. */
  readonly palette: {
    readonly roadSurface: HexColor
    readonly roadMarking: HexColor
    readonly accent: HexColor
  }
}

/** A plan consumer: the live layer, a harness probe or a test spy. */
export interface VehiclePlanTarget {
  applyPlan(plan: EraVehiclePlan): void
}

/** Input of a staged era change. */
export interface EraTransitionInput {
  readonly from: EraId
  readonly to: EraId
  /** Blend weight in `[0, 1]`; 1 equals a settled `to` era. */
  readonly t: number
}

/** Everything {@link applyEra} and {@link applyEraTransition} need. */
export interface EraApplicationContext {
  /** Layout the plan is generated against; real block geometry is required. */
  readonly layout: LayoutReference
  /** Block seed; plan generation is deterministic from it plus the era. */
  readonly seed?: string | number
  /** Quality tier that scales traffic and parking population. */
  readonly quality?: string
  /** Reduced motion: era changes apply instantly instead of blending. */
  readonly reducedMotion?: boolean
  /** Optional consumer the resolved plan is pushed to. */
  readonly target?: VehiclePlanTarget
}

/** One kerbside parking bay of the block, as the layer consumes it. */
export interface ParkingAnchor {
  readonly name: string
  readonly kind: string
  readonly position: Vec3
  readonly normal: Vec3
  readonly facing: StreetName | null
}

/** The slice of the layout the layer consumes, so tests can stub it. */
export interface LayoutReference {
  readonly vehicleSplines: readonly PathSpline[]
  readonly seedInput: string | number
  /** Parking-bay anchors of the block; absent for synthetic test layouts. */
  readonly anchors?: readonly ParkingAnchor[]
}

/* ------------------------------------------------------------------------- *\
 * Road markings
 * ------------------------------------------------------------------------- */

/** One flat marking piece laid on the road surface. */
export interface MarkingPiece {
  /** Stable name, e.g. `marking:centre-line:north:3`. */
  readonly name: string
  readonly group: MarkingFeatureKind
  readonly street: StreetName | 'intersection'
  /** World position of the piece's local origin, on the road surface. */
  readonly position: Vec3
  /** Rotation about the up axis that orients the piece along its street. */
  readonly rotationY: number
  /** Convex local outline in metres: `x` across, `z` along the piece's heading. */
  readonly corners: readonly Vec2[]
  readonly colour: HexColor
  /** Height above the road surface; never below `MARKING_LIFT`. */
  readonly lift: number
  /** True for physical strips such as streetcar rails. */
  readonly raised: boolean
  readonly opacity: number
}

/** Merged, renderer-ready geometry of one marking group. */
export interface MarkingGroupMesh {
  readonly group: MarkingFeatureKind
  readonly positions: readonly number[]
  readonly indices: readonly number[]
  readonly triangles: number
  readonly pieces: number
}

/** Pure marking geometry: one merged mesh per group plus the piece list. */
export interface MarkingGeometry {
  readonly pieces: readonly MarkingPiece[]
  readonly groups: readonly MarkingGroupMesh[]
  /** Group name to piece count, for harness reporting and assertions. */
  readonly groupCounts: Readonly<Record<string, number>>
}

/* ------------------------------------------------------------------------- *\
 * Traffic, parking and lights
 * ------------------------------------------------------------------------- */

/** Lamp state of one vehicle at one instant. */
export interface VehicleLampState {
  /** Headlamp strength in `[0, 1]`. */
  readonly headlamp: number
  /** Taillamp strength in `[0, 1]`. */
  readonly taillamp: number
  /** True while the model's indicator lamps are lit. */
  readonly indicator: boolean
}

/** One vehicle spawned into the traffic simulation. */
export interface VehicleInstance {
  readonly id: string
  readonly modelKey: string
  readonly class: VehicleClass
  readonly power: VehiclePower
  readonly micro: boolean
  readonly silhouette: VehicleSilhouette
  readonly tags: readonly string[]
  /** Index of the traffic circuit this vehicle follows. */
  readonly laneIndex: number
  readonly splineName: string
  /** Arc length of the vehicle at clock 0, in metres. */
  readonly startDistance: number
  /** Loop length of its spline, in metres. */
  readonly loopLength: number
  /** Lateral offset from the spline centre, positive toward the block, in metres. */
  readonly lateralOffset: number
  readonly speedMps: number
  readonly paint: HexColor
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  /** Deterministic proportion jitter in `[0.96, 1.05]`. */
  readonly scale: number
  readonly lamps: VehicleLampState
  /** True for the models that indicate; paired with the blink phase. */
  readonly indicates: boolean
  /** Offset into the indicator blink cycle, in seconds. */
  readonly blinkOffsetSec: number
  /** Rate-limited SFX schedule of this vehicle, in seconds of scene time. */
  readonly schedule: readonly SfxScheduleEntry[]
  /** Model geometry reused every frame; not serialised. */
  readonly model: VehicleModelSpec
}

/** One scheduled SFX event of one vehicle. */
export interface SfxScheduleEntry {
  readonly kind: SfxKind
  /** Scene time of the event in seconds. */
  readonly timeSec: number
}

/** A moving vehicle at one clock reading. */
export interface VehiclePose {
  readonly id: string
  readonly modelKey: string
  readonly class: VehicleClass
  readonly micro: boolean
  readonly laneIndex: number
  readonly splineName: string
  /** Arc length along the spline at this clock reading, in metres. */
  readonly distance: number
  readonly position: Vec3
  /** Yaw about the up axis, radians; aligns the model's `+z` with its heading. */
  readonly headingRad: number
  /** Unit heading in the ground plane. */
  readonly heading: Vec2
  readonly speedMps: number
  readonly paint: HexColor
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  readonly scale: number
  readonly lamps: VehicleLampState
  readonly tags: readonly string[]
  readonly model: VehicleModelSpec
}

/** A vehicle standing at a kerbside parking anchor. */
export interface ParkedVehicle {
  readonly id: string
  readonly anchorName: string
  readonly modelKey: string
  readonly class: VehicleClass
  readonly micro: boolean
  readonly position: Vec3
  /**
   * Yaw about the up axis, radians. A kerbside vehicle stands parallel to the
   * kerb, facing the direction the block-side lanes travel.
   */
  readonly headingRad: number
  readonly paint: HexColor
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
  readonly scale: number
  readonly lamps: VehicleLampState
  readonly tags: readonly string[]
  readonly model: VehicleModelSpec
}

/** A sound-effect trigger emitted by the layer for the audio owner. */
export interface SfxTrigger {
  readonly kind: SfxKind
  readonly vehicleId: string
  readonly modelKey: string
  /** Scene time of the trigger, in seconds. */
  readonly timeSec: number
  readonly position: Vec3
  /** Suggested linear gain in `[0, 1]`. */
  readonly gain: number
  /** Lane the vehicle is on, for stereo placement. */
  readonly splineName: string
}

export type SfxTriggerListener = (trigger: SfxTrigger) => void

/* ------------------------------------------------------------------------- *\
 * Layer and snapshot
 * ------------------------------------------------------------------------- */

/** Machine-readable state of the layer, published to harnesses and tests. */
export interface VehiclesSnapshot {
  readonly eraId: EraId | null
  readonly fromEraId: EraId
  readonly toEraId: EraId
  readonly progress: number
  readonly settled: boolean
  /** Clock the snapshot was taken at, in seconds. */
  readonly clockSec: number
  readonly density: number
  readonly speedMps: number
  readonly spacingM: number
  readonly movingCount: number
  /** Moving vehicles grouped by model key. */
  readonly movingByModel: Readonly<Record<string, number>>
  /** Moving vehicles grouped by class. */
  readonly movingByClass: Readonly<Record<string, number>>
  readonly microCount: number
  readonly parkedCount: number
  readonly parkedByModel: Readonly<Record<string, number>>
  readonly census: readonly string[]
  readonly markingGroupCounts: Readonly<Record<string, number>>
  readonly markingPieceCount: number
  readonly markingSignature: string
  readonly lanes: LaneConfiguration
  readonly lights: EraLightPlan
  /** Distinct SFX kinds the era can emit, in catalogue order. */
  readonly sfxKinds: readonly SfxKind[]
  /** SFX emitted since the layer was created. */
  readonly sfxEmitted: number
  /** Triggers emitted in the last clock step. */
  readonly sfxLastStep: readonly SfxTrigger[]
  /** Sample pose of the first moving vehicle, handy for cheap browser checks. */
  readonly firstPose: VehiclePose | null
}

/** Live, framework-free core of the vehicle layer. */
export interface VehicleLayer {
  readonly layout: LayoutReference
  readonly paintOrder: readonly HexColor[]
  /** Resolved plan currently applied. */
  readonly plan: EraVehiclePlan
  readonly fleet: readonly VehicleInstance[]
  readonly parked: readonly ParkedVehicle[]
  readonly markings: MarkingGeometry
  readonly movingCount: number
  readonly parkedCount: number
  /** Applies a resolved plan (called by {@link applyEra} and by the component). */
  applyPlan(plan: EraVehiclePlan): void
  /** Applies a settled era to the layer. */
  setEra(eraId: EraId): EraVehiclePlan
  /** Applies a staged era change to the layer. */
  setEraTransition(input: EraTransitionInput): EraVehiclePlan
  /** Poses of every moving vehicle at a clock reading; pure in `clockSec`. */
  poseAt(clockSec: number): readonly VehiclePose[]
  /**
   * Advances the layer's clock and emits the SFX triggers that fall inside the
   * step. Returns the emitted triggers and hands them to the listener.
   */
  setClock(clockSec: number): readonly SfxTrigger[]
  /** Current clock reading, in seconds. */
  readonly clockSec: number
  /** Every trigger emitted so far, in order. */
  readonly emitted: readonly SfxTrigger[]
  snapshot(clockSec?: number): VehiclesSnapshot
}
