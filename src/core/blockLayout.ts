/**
 * Shared city-block layout contract.
 *
 * Every era layer (buildings, props, vehicles, pedestrians) consumes these
 * constants read-only so geometry stays consistent with the block perimeter,
 * the four buildable lots, the sidewalk ring and the road/lane network.
 *
 * Coordinate system: x = east, z = north in the three.js plan view; y is up
 * and is not part of the 2D layout contract (ground level is y = 0). All
 * dimensions are meters and the block center is the origin.
 *
 * Footprint summary:
 *   1. BLOCK_BOUNDS  - 120 × 100 m buildable lot area.
 *   2. SIDEWALK      - 3 m ring directly outside the block edge.
 *   3. ROAD          - 14 m ring (4 × 3.5 m lanes) outside the sidewalk.
 *   4. CROSSWALK     - 4 m strips crossing each street at the corners.
 *   5. WORLD_BOUNDS  - full modeled footprint, road outer edge to road edge.
 */

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly width: number;
  readonly depth: number;
}

export type LotId = 'NW' | 'NE' | 'SW' | 'SE';

export interface LotExtent extends Rect {
  readonly id: LotId;
  readonly centerX: number;
  readonly centerZ: number;
}

function makeRect(minX: number, maxX: number, minZ: number, maxZ: number): Rect {
  return Object.freeze({
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  });
}

function makeLot(id: LotId, minX: number, maxX: number, minZ: number, maxZ: number): LotExtent {
  return Object.freeze({
    id,
    ...makeRect(minX, maxX, minZ, maxZ),
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  });
}

/** Outer bounds of the four buildable lots (the building footprint zone). */
export const BLOCK_BOUNDS: Readonly<Rect> = makeRect(-60, 60, -50, 50);

/** Width of the service alley separating the four lot quadrants. */
export const LOT_ALLEY_GAP = 4;

/** Four non-overlapping buildable lot extents, one per cardinal quadrant. */
export const LOT_EXTENTS: Readonly<Record<LotId, LotExtent>> = Object.freeze({
  SW: makeLot('SW', -60, -2, -50, -2),
  SE: makeLot('SE', 2, 60, -50, -2),
  NW: makeLot('NW', -60, -2, 2, 50),
  NE: makeLot('NE', 2, 60, 2, 50),
});

/**
 * Sidewalk ring: 3 m band directly outside the block edge. The north and
 * south bands span the full ring width so the corner squares are covered
 * exactly once; the four bands meet along edges and never overlap.
 */
export const SIDEWALK: Readonly<{
  width: number;
  north: Rect;
  east: Rect;
  south: Rect;
  west: Rect;
}> = Object.freeze({
  width: 3,
  north: makeRect(-63, 63, 50, 53),
  east: makeRect(60, 63, -50, 50),
  south: makeRect(-63, 63, -53, -50),
  west: makeRect(-63, -60, -50, 50),
});

/**
 * Road ring around the sidewalk: 14 m band split into 4 × 3.5 m lanes.
 * laneCenters are offsets measured from the inner (sidewalk-side) edge of the
 * band. Like the sidewalk, north/south bands span the full width and the four
 * bands never overlap.
 */
export const ROAD: Readonly<{
  width: number;
  laneCount: number;
  laneWidth: number;
  centerLineWidth: number;
  laneCenters: readonly number[];
  north: Rect;
  east: Rect;
  south: Rect;
  west: Rect;
}> = Object.freeze({
  width: 14,
  laneCount: 4,
  laneWidth: 3.5,
  centerLineWidth: 0.25,
  laneCenters: Object.freeze([1.75, 5.25, 8.75, 12.25]),
  north: makeRect(-77, 77, 53, 67),
  east: makeRect(63, 77, -53, 53),
  south: makeRect(-77, 77, -67, -53),
  west: makeRect(-77, -63, -53, 53),
});

/**
 * Crosswalks: 4 m strips crossing each street at the ring corners. Every strip
 * spans the full road band depth in one axis; its other axis is
 * CROSSWALK.width, offset `offset` meters from the sidewalk ring's outer
 * corner line measured along the street being crossed. The eight strips share
 * at most a corner point and never overlap.
 */
export const CROSSWALK: Readonly<{
  width: number;
  offset: number;
  stripeWidth: number;
  stripeGap: number;
  northWest: Rect;
  northEast: Rect;
  eastNorth: Rect;
  eastSouth: Rect;
  southEast: Rect;
  southWest: Rect;
  westSouth: Rect;
  westNorth: Rect;
}> = Object.freeze({
  width: 4,
  offset: 2,
  stripeWidth: 0.45,
  stripeGap: 0.45,
  northWest: makeRect(-67, -63, 53, 67),
  northEast: makeRect(63, 67, 53, 67),
  eastNorth: makeRect(63, 77, 49, 53),
  eastSouth: makeRect(63, 77, -53, -49),
  southEast: makeRect(63, 67, -67, -53),
  southWest: makeRect(-67, -63, -67, -53),
  westSouth: makeRect(-77, -63, -53, -49),
  westNorth: makeRect(-77, -63, 49, 53),
});

/** Full modeled footprint: road outer edge to road outer edge. */
export const WORLD_BOUNDS: Readonly<Rect> = makeRect(-77, 77, -67, 67);
