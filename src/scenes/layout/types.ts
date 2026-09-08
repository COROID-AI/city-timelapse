/**
 * Core geometric primitives shared by every scene subsystem.
 *
 * The city block is laid out in a single 2D horizontal plane (the ground).
 * The vertical (Y) axis is owned by the individual scene subsystems
 * (buildings, vehicles, pedestrians) based on their era-specific heights.
 * This module only defines the horizontal anchors so that every subsystem
 * and the camera rig agree on *where* things are, never *how tall* they are.
 *
 * All values are era-invariant. Era-specific differences belong in
 * `src/scenes/eras/`, not here.
 */

/** A point in the horizontal ground plane. Units are scene meters. */
export interface Point2 {
  x: number;
  z: number;
}

/** An axis-aligned rectangle in the ground plane. */
export interface Bounds2 {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * A directed segment in the ground plane.
 * `start` -> `end` defines the direction of travel.
 */
export interface Segment2 {
  start: Point2;
  end: Point2;
}

/**
 * A distinct lane of a road, offset from the road centerline.
 * `offset` is the signed lateral offset from the centerline in meters
 * (positive = right of travel direction). `direction` is the unit vector
 * of travel along the lane.
 */
export interface Lane {
  id: string;
  /** Waypoints tracing the lane center, in travel order. */
  waypoints: Point2[];
  /** Signed lateral offset from the road centerline in meters. */
  offset: number;
  /** Unit travel direction along the lane. */
  direction: Point2;
}

/** A sidewalk strip running along a road, offset from the road centerline. */
export interface Sidewalk {
  id: string;
  /** Bounds of the walkable strip in the ground plane. */
  bounds: Bounds2;
  /** Signed lateral offset from the road centerline in meters. */
  offset: number;
}

/** A building's land parcel (lot) within the block. */
export interface Lot {
  id: string;
  /** Ground-plane bounds of the lot. */
  bounds: Bounds2;
  /**
   * Unit vector the building facade faces (the direction the front of the
   * building points toward, typically the street).
   */
  facadeDirection: Point2;
  /** The street-facing edge midpoint; where the front door sits. */
  facadeCenter: Point2;
}

/** The fraction of a storefront facade that is a shopfront (0..1). */
export interface Storefront {
  id: string;
  /** Lot this storefront belongs to. */
  lotId: string;
  /** Span along the lot facade, as a 0..1 fraction of the facade width. */
  spanStart: number;
  spanEnd: number;
  /** The ground-plane segment of the storefront facade. */
  segment: Segment2;
}

/** A named waypoint along the pedestrian walkway network. */
export interface WalkwayWaypoint {
  id: string;
  point: Point2;
}

/** A closed loop of waypoints describing the traffic circulation path. */
export interface TrafficLoop {
  id: string;
  /** Waypoints in order; the loop closes implicitly. */
  waypoints: Point2[];
}

/** A named camera vantage (position + direction to look). */
export interface CameraFocusPoint {
  id: string;
  label: string;
  /** Where the camera sits. */
  position: Point2;
  /** Where the camera looks (a point in the ground plane). */
  target: Point2;
  /** Suggested camera height above the ground for the vantage. */
  height: number;
}

/**
 * The complete, era-invariant geometric description of one city block.
 * This is the single source of truth for block geometry anchors.
 */
export interface CityBlockLayout {
  /** Ground-plane footprint of the whole block. */
  block: Bounds2;
  /** Road centerlines that define the block's perimeter and interior. */
  roads: Segment2[];
  /** Named traffic lanes offset from the road centerlines. */
  lanes: Lane[];
  /** Sidewalk strips. */
  sidewalks: Sidewalk[];
  /** Building lots (parcels) within the block. */
  lots: Lot[];
  /** Storefront spans. */
  storefronts: Storefront[];
  /** Pedestrian walkway waypoints. */
  walkway: WalkwayWaypoint[];
  /** Traffic circulation loops. */
  trafficLoops: TrafficLoop[];
  /** Named camera focus points. */
  cameraFocusPoints: CameraFocusPoint[];
}