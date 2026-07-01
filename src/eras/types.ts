/**
 * Era type contracts for the city timelapse.
 *
 * This file is TYPE-ONLY: it declares the data shapes consumed by the asset
 * builders, street layout, vehicle/pedestrian factories and the renderer. It
 * intentionally contains no runtime code so it can be erased by the compiler
 * and tree-shaken from production bundles.
 */

/** The five selectable timeline years. */
export type Era = 1945 | 1965 | 1985 | 2005 | 2025;

/** Building classification used by facade texture lookups. */
export type BuildingType = 'residential' | 'commercial' | 'office';

/** Core vehicle shape variants produced by the vehicle factory. */
export type VehicleVariant = 'car' | 'truck';

/**
 * Named wheel positions on a vehicle rig. Wheels are grouped under a `wheels`
 * parent with these named children so the drive factory can spin/steer them.
 */
export type WheelPosition = 'wheel_FL' | 'wheel_FR' | 'wheel_RL' | 'wheel_RR';

/** A single keyframe in a pedestrian walk cycle (per-limb pose). */
export interface WalkPose {
  /** Left hip swing angle around the vertical axis, in radians. */
  leftHip: number;
  /** Right hip swing angle around the vertical axis, in radians. */
  rightHip: number;
  /** Left knee bend, in radians (0 = straight). */
  leftKnee: number;
  /** Right knee bend, in radians (0 = straight). */
  rightKnee: number;
  /** Left elbow bend, in radians. */
  leftElbow: number;
  /** Right elbow bend, in radians. */
  rightElbow: number;
  /** Vertical bob offset applied to the pelvis origin, in metres. */
  verticalBob: number;
}

/**
 * A full walk-cycle rig descriptor: an ordered set of poses that the pedestrian
 * factory interpolates between to produce a natural gait for a given era.
 */
export interface WalkCycleRig {
  /** Loop duration in seconds at a 1 m/s cadence. */
  duration: number;
 /** Ordered keyframes; the cycle wraps from the last pose back to the first. */
  poses: WalkPose[];
}

/**
 * Pose applied to a vehicle while it is driving (wheels spinning, optional
 * steering yaw on the front axle).
 */
export interface DrivePose {
  /** Front-wheel steer yaw in radians (0 = straight). */
  steerYaw: number;
  /** Wheel roll speed in radians/second; applied to all four wheels. */
  wheelRoll: number;
  /** Optional per-wheel roll overrides keyed by wheel position. */
  wheelRollOverrides?: Partial<Record<WheelPosition, number>>;
  /** Subtle chassis pitch from acceleration/braking, in radians. */
  chassisPitch: number;
}

/**
 * Pose applied to a vehicle while parked (stationary, wheels straight, doors
 * optionally ajar).
 */
export interface ParkPose {
  /** Wheels locked straight; roll is always 0 for a parked vehicle. */
  steerYaw: number;
  /** Driver door open angle in radians (0 = closed). */
  doorOpenAngle: number;
}

/** Combined drive/park vehicle variant descriptor for an era. */
export interface VehicleRig {
  /** Drive pose used while the vehicle is moving. */
  drive: DrivePose;
  /** Park pose used while the vehicle is parked in a spot. */
  park: ParkPose;
}

/**
 * One lane of a street. Lanes are laid out left-to-right across the carriageway
 * and the layout module uses these to place markings, vehicles and curbs.
 */
export interface LaneSpec {
  /** Lane type which drives its width, marking and usage rules. */
  type: 'motor' | 'parking' | 'bike' | 'transit' | 'sidewalk';
  /** Lane width in metres. */
  width: number;
  /** Travel direction, or 'none' for parking/sidewalk lanes. */
  direction: 'forward' | 'backward' | 'none';
  /** Surface marking painted on this lane's left edge, if any. */
  marking?: 'solid' | 'dashed' | 'double' | 'crosswalk' | 'none';
}

/**
 * Full cross-section of a street: an ordered list of lanes from the centerline
 * outward, plus overall geometry hints.
 */
export interface LaneLayout {
  /** Ordered lanes from the street centerline to the right edge. */
  lanes: LaneSpec[];
  /** Total carriageway width in metres (sum of lane widths). */
  totalWidth: number;
  /** Curb/sidewalk rise in metres above the road surface. */
  curbHeight: number;
}

/**
 * A single parking stall. Parking spots are laid out by the street module along
 * parking lanes and consumed by the vehicle factory when placing parked cars.
 */
export interface ParkingSpot {
  /** Spot center along the street axis, in metres. */
  position: number;
  /** Stall length along the street axis, in metres. */
  length: number;
  /** Stall width across the street axis, in metres. */
  width: number;
  /** Orientation relative to the travel direction. */
  angle: 'parallel' | 'perpendicular' | 'diagonal';
  /** Which side of the street the spot sits on. */
  side: 'left' | 'right';
  /** Whether the spot is occupied by a parked vehicle. */
  occupied: boolean;
}

/**
 * Parking specification for an era: defines how stalls are distributed and the
 * proportion of spots that carry a parked vehicle.
 */
export interface ParkingSpec {
  /** Default stall geometry used when laying out a parking lane. */
  defaultAngle: ParkingSpot['angle'];
  /** Target occupancy ratio in [0, 1]. */
  occupancy: number;
  /** Per-spot dimensions by orientation. */
  dimensions: Record<ParkingSpot['angle'], { length: number; width: number }>;
}

/**
 * Depth hint for billboard/sign props so the renderer can resolve z-fighting
 * against the facade plane they sit on.
 */
export interface BillboardDepth {
  /**
   * Factor applied to `material.polygonOffsetFactor` to push the prop off the
   * facade surface in depth buffer space.
   */
  polygonOffsetFactor: number;
  /** Corresponding `material.polygonOffsetUnits` value. */
  polygonOffsetUnits: number;
  /** Forward offset in metres to apply to the prop's local position. */
  pushForward: number;
  /** Optional explicit render order (higher draws later). */
  renderOrder?: number;
}

/**
 * Per-era render policy controlling polygon offset and render ordering to keep
 * decals, markings and billboards free of z-fighting artifacts.
 */
export interface RenderPolicy {
  /** Default polygon offset factor for flat decals (road markings, ground). */
  decalPolygonOffsetFactor: number;
  /** Default polygon offset units for flat decals. */
  decalPolygonOffsetUnits: number;
  /** Render order for the ground/road plane. */
  groundRenderOrder: number;
  /** Render order for road markings (above ground). */
  markingRenderOrder: number;
  /** Render order for facade decals/billboards (above facade). */
  billboardRenderOrder: number;
  /** Depth hints keyed by billboard category for fine-grained z-resolve. */
  billboardDepth: Record<string, BillboardDepth>;
}

/** Describes a single asset (texture/mesh/material) to be generated per era. */
export interface EraAssetSpec {
  /** Stable identifier used as a cache key. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Asset category driving the builder pipeline. */
  kind:
    | 'sky'
    | 'ground'
    | 'facade'
    | 'road'
    | 'marking'
    | 'vehicle'
    | 'pedestrian'
    | 'billboard';
  /** Era the asset belongs to. */
  era: Era;
  /** Optional variant discriminator (e.g. BuildingType or VehicleVariant). */
  variant?: BuildingType | VehicleVariant | string;
  /** Pixel resolution for generated textures, when applicable. */
  resolution?: { width: number; height: number };
}

/**
 * A notable moment on the timeline, surfaced to the UI for context as the user
 * scrubs between eras.
   */
export interface TimelineEvent {
  /** Era the event is anchored to. */
  era: Era;
  /** Short headline shown on the timeline. */
  title: string;
  /** Longer descriptive body. */
  description: string;
  /** Optional year offset within the era for ordering. */
  year?: number;
}

/**
 * The full content bundle for a single era. This is the root contract every
 * downstream module (textures, layout, vehicle/pedestrian factories, asset
 * composition) reads from.
 */
export interface EraContent {
  /** The era this content describes. */
  era: Era;
  /** Human-readable display name, e.g. "Postwar Boom". */
  name: string;
  /** Palette of key colors driving materials and lighting. */
  palette: {
    sky: string;
    ground: string;
    road: string;
    accent: string;
  };
  /** Asset specs to generate for this era. */
  assets: EraAssetSpec[];
  /** Lane layout used by the street module. */
  laneLayout: LaneLayout;
  /** Parking specification used to place parked vehicles. */
  parking: ParkingSpec;
  /** Explicit parking spots for this era (overrides generated layout when set). */
  parkingSpots?: ParkingSpot[];
  /** Walk-cycle rig for pedestrians of this era. */
  walkCycle: WalkCycleRig;
  /** Vehicle rigs keyed by variant for this era. */
  vehicles: Record<VehicleVariant, VehicleRig>;
  /** Billboard/sign props with depth hints for z-fighting-free rendering. */
  billboards: BillboardDepth[];
  /** Render policy controlling polygon offset and render ordering. */
  renderPolicy: RenderPolicy;
  /** Notable timeline events for this era. */
  events: TimelineEvent[];
}
