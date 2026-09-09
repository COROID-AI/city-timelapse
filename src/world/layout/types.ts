/**
 * Pure data-model for the deterministic, era-neutral city block layout.
 *
 * Every coordinate lives on the ground plane (Y = 0) unless documented.
 * X runs along the east–west street axis (street A) and Z runs along the
 * north–south street axis (street B); the block island occupies x >= 0,
 * z >= 0 and is bounded on its west flank by street B and on its south
 * flank by street A.
 *
 * This module contains only types — the seeded generator that produces a
 * `BlockLayout` lives in `cityBlockLayout.ts`, and the mesh builders in
 * `ground.ts` / `groundTextures.ts` consume the layout.
 */

/** One 2D point on the ground (Y is implicitly 0). */
export interface GridPoint2D {
  x: number;
  z: number;
}

/** A unit 2D direction on the ground (Y is implicitly 0). */
export interface GridVec2 {
  x: number;
  z: number;
}

/** An axis-aligned world rectangle on the ground plane. */
export interface GridRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Ground-plane axis a street travels along. */
export type Axis2D = 'x' | 'z';

/** Stable street identifiers used across the layout. */
export type StreetId = 'streetA' | 'streetB';

/**
 * A single travel lane. `centerLine` are two world endpoints of the lane's
 * center line, used to sample driving paths and to keep signage/vehicle
 * systems perpendicular to travel.
 */
export interface Lane {
  id: string;
  /** Footprint of this lane (world units, Y = 0). */
  bounds: GridRect;
  /** Unit direction of travel. */
  direction: GridVec2;
  /** Centerline endpoints along the direction of travel, inside the lane. */
  centerLine: [GridPoint2D, GridPoint2D];
}

/** A painted road marking line (edge line, lane divider, etc.). */
export interface RoadMarkingLine {
  /** World-space endpoints of the painted line (Y = 0). */
  from: GridPoint2D;
  to: GridPoint2D;
  /** 'solid' or 'dashed' (dashed uses `dash`/`gap` cycle). */
  style: 'solid' | 'dashed';
  /** Painted width in world units. */
  width: number;
  /** Dash length in world units when `style` is 'dashed'. */
  dash?: number;
  /** Gap length in world units when `style` is 'dashed'. */
  gap?: number;
}

/** A zebra-striped pedestrian crossing over one street. */
export interface Crosswalk {
  id: string;
  /** Bounding rectangle of the whole zebra band (world, Y = 0). */
  bounds: GridRect;
  /** Unit direction a pedestrian walks while crossing. */
  direction: GridVec2;
  /** Number of painted stripes across the band. */
  stripeCount: number;
}

/** One parallel parking slot next to a curb. */
export interface ParkingSlot {
  id: string;
  /** Street the slot belongs to. */
  street: StreetId;
  /** Rectangle of the slot (world units, Y = 0). */
  bounds: GridRect;
}

/** A full carriageway plus its lane/crosswalk/parking markings. */
export interface Street {
  id: StreetId;
  /** Stable display label (used as group name by mesh builders). */
  name: string;
  /** Travel axis of the street. */
  axis: Axis2D;
  /** Full asphalt carriageway rectangle (world units, Y = 0). */
  carriageway: GridRect;
  /** Exactly two travel lanes (one per direction). */
  lanes: Lane[];
  /** Painted lines (curb solids, center dashes) inside the carriageway. */
  markings: RoadMarkingLine[];
  /** Zebra crossings across this street. */
  crosswalks: Crosswalk[];
  /** Parallel parking slots adjacent to the block-side curb. */
  parkingSlots: ParkingSlot[];
}

/**
 * The vertical "storefront" plane a building presents to a street.
 * Signage/stores attach to this plane, never to the building mesh, so the
 * buildings system and the signage system can be built in parallel against
 * the same shared layout.
 */
export interface FrontagePlane {
  /** World position of the horizontal center of the plane at ground level. */
  position: GridPoint2D;
  /** Width of the plane along the street (world units). */
  width: number;
  /** Vertical extent of the plane (world units, from ground up). */
  height: number;
  /** Unit normal pointing from the plot street-ward (outward). */
  facing: GridVec2;
}

/** Permitted building-height envelope for one plot. */
export interface HeightRange {
  min: number;
  max: number;
}

export interface BuildingPlot {
  id: string;
  /** Occupied footprint (world units, Y = 0). */
  footprint: GridRect;
  /** Seeded height envelope for the building system. */
  heightRange: HeightRange;
  /** The street whose frontage this plot presents to. */
  frontageStreet: StreetId;
  /** Anchor plane for signage/storefronts (see FrontagePlane). */
  frontagePlane: FrontagePlane;
}

/** Street furniture kinds the layout anchors for the atmosphere system. */
export type FurnitureKind =
  | 'lamp'
  | 'fireHydrant'
  | 'mailbox'
  | 'bench'
  | 'busStop'
  | 'trashCan';

/** A deterministic anchor point for one furniture item. */
export interface FurnitureAnchor {
  id: string;
  kind: FurnitureKind;
  /** Ground position (world units, Y = 0). */
  position: GridPoint2D;
  /** Unit direction the item faces (toward the street it serves). */
  facing: GridVec2;
}

/** One paved sidewalk pad (world units, Y = 0). */
export interface Sidewalk {
  id: string;
  bounds: GridRect;
}

/**
 * A walking path for pedestrian systems: the rubber band of `points`
 * samples sidewalk/road pads so generic path queries stay test-clean.
 */
export interface WalkingPath {
  id: string;
  /** Turn vertices; the straight segments between them lie on paving. */
  points: GridPoint2D[];
  /** Comfortable side-by-side width for a simulated pedestrian (world units). */
  width: number;
}

/**
 * The complete deterministic physical frame of the city block.
 *
 * All numbers for a given `seed` are identical across calls —
 * `createCityBlockLayout(seed)` never consults Date or Math.random.
 */
export interface BlockLayout {
  /** Canonical seed string reproduced in the layout. */
  seed: string;
  /** The block island (Y = 0); bounded on west/south by the two streets. */
  blockBounds: GridRect;
  /** Deterministic building plots with frontage planes. */
  plots: BuildingPlot[];
  /** [streetB (north–south, west flank), streetA (east–west, south flank)]. */
  streets: [Street, Street];
  /** All paved sidewalk slabs (block perimeter + far road sides). */
  sidewalks: Sidewalk[];
  /** Pedestrian walking paths that sample sidewalk/road pads. */
  walkingPaths: WalkingPath[];
  /** Deterministic anchor points for street furniture. */
  furniture: FurnitureAnchor[];
}