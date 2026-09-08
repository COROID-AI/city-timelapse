import type {
  CityBlockLayout,
  Lane,
  Lot,
  Point2,
  Segment2,
  Sidewalk,
  Storefront,
  WalkwayWaypoint,
} from './types.js';

/**
 * The concrete, era-invariant geometry of the reference city block.
 *
 * The block is a 60m x 40m rectangle centered on the origin. A single road
 * runs down the block's spine (the main street) with two travel lanes, plus
 * a sidewalk strip on each side. A ring road wraps the block perimeter to
 * provide the traffic circulation loop. Building lots line the main street
 * on both sides, with storefronts on the street-facing facades.
 *
 * Nothing here changes across eras: era-specific appearance lives in
 * `src/scenes/eras/` and only consumes these anchors read-only.
 */

/** Half the block width (x-axis). */
const HALF_WIDTH = 30;
/** Half the block depth (z-axis). */
const HALF_DEPTH = 20;

/** Main street half-width (distance from spine to curb). */
const STREET_HALF_WIDTH = 8;
/** Sidewalk width. */
const SIDEWALK_WIDTH = 3;
/** Lane half-width (each lane is 3.5m, centerline offset 1.75m from spine). */
const LANE_OFFSET = 1.75;

/** Number of lots along each side of the main street. */
const LOTS_PER_SIDE = 5;

/** Point helper. */
function p(x: number, z: number): Point2 {
  return { x, z };
}

/** Euclidean distance between two points (squared, for comparisons). */
function distSq(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** Normalize a vector to unit length; falls back to (1,0) for zero-length. */
function unit(v: Point2): Point2 {
  const len = Math.hypot(v.x, v.z);
  if (len === 0) {
    return { x: 1, z: 0 };
  }
  return { x: v.x / len, z: v.z / len };
}

/**
 * Build the road centerline segments. The spine runs along the x-axis at
 * z = 0. The ring road runs just inside the block boundary.
 */
function buildRoads(): Segment2[] {
  const spine: Segment2 = {
    start: p(-HALF_WIDTH, 0),
    end: p(HALF_WIDTH, 0),
  };
  // Ring road (block perimeter, inset from the boundary).
  const inset = 2;
  const w = HALF_WIDTH - inset;
  const d = HALF_DEPTH - inset;
  const ring: Segment2[] = [
    { start: p(-w, -d), end: p(w, -d) },
    { start: p(w, -d), end: p(w, d) },
    { start: p(w, d), end: p(-w, d) },
    { start: p(-w, d), end: p(-w, -d) },
  ];
  return [spine, ...ring];
}

/**
 * Build the traffic lanes. Two lanes run along the main street (one in each
 * direction), and a single-lane loop follows the ring road.
 */
function buildLanes(): Lane[] {
  const east: Lane = {
    id: 'main-eastbound',
    waypoints: [p(-HALF_WIDTH, LANE_OFFSET), p(HALF_WIDTH, LANE_OFFSET)],
    offset: LANE_OFFSET,
    direction: { x: 1, z: 0 },
  };
  const west: Lane = {
    id: 'main-westbound',
    waypoints: [p(HALF_WIDTH, -LANE_OFFSET), p(-HALF_WIDTH, -LANE_OFFSET)],
    offset: -LANE_OFFSET,
    direction: { x: -1, z: 0 },
  };
  const loop: Lane = {
    id: 'ring-loop',
    waypoints: [
      p(-HALF_WIDTH + 2, -HALF_DEPTH + 2),
      p(HALF_WIDTH - 2, -HALF_DEPTH + 2),
      p(HALF_WIDTH - 2, HALF_DEPTH - 2),
      p(-HALF_WIDTH + 2, HALF_DEPTH - 2),
    ],
    offset: 0,
    direction: { x: 0, z: -1 },
  };
  return [east, west, loop];
}

/** Build the two sidewalk strips flanking the main street. */
function buildSidewalks(): Sidewalk[] {
  const south: Sidewalk = {
    id: 'main-south-sidewalk',
    bounds: {
      x: -HALF_WIDTH,
      z: -STREET_HALF_WIDTH - SIDEWALK_WIDTH,
      width: HALF_WIDTH * 2,
      depth: SIDEWALK_WIDTH,
    },
    offset: -STREET_HALF_WIDTH - SIDEWALK_WIDTH / 2,
  };
  const north: Sidewalk = {
    id: 'main-north-sidewalk',
    bounds: {
      x: -HALF_WIDTH,
      z: STREET_HALF_WIDTH,
      width: HALF_WIDTH * 2,
      depth: SIDEWALK_WIDTH,
    },
    offset: STREET_HALF_WIDTH + SIDEWALK_WIDTH / 2,
  };
  return [south, north];
}

/**
 * Build the building lots lining both sides of the main street.
 * Lots face the street (south lots face +z, north lots face -z).
 */
function buildLots(): Lot[] {
  const lots: Lot[] = [];
  const lotDepth = 9;
  // South side: lots between the sidewalk and the south ring road.
  const southEdge = -STREET_HALF_WIDTH - SIDEWALK_WIDTH;
  const southBack = southEdge - lotDepth;
  // North side: lots between the sidewalk and the north ring road.
  const northEdge = STREET_HALF_WIDTH + SIDEWALK_WIDTH;
  const northBack = northEdge + lotDepth;

  const side = (row: 'south' | 'north'): void => {
    const front =
      row === 'south' ? southEdge - 0.5 : northEdge + 0.5;
    const back = row === 'south' ? southBack : northBack;
    const facadeZ = row === 'south' ? front : back;
    const boundsZ = Math.min(front, back);
    const depth = Math.abs(back - front);
    const width = (HALF_WIDTH * 2) / LOTS_PER_SIDE;

    for (let i = 0; i < LOTS_PER_SIDE; i++) {
      const x0 = -HALF_WIDTH + i * width;
      const x1 = x0 + width;
      const centerX = (x0 + x1) / 2;
      const id = `${row}-lot-${i + 1}`;
      const facadeDirection = row === 'south' ? { x: 0, z: 1 } : { x: 0, z: -1 };
      lots.push({
        id,
        bounds: {
          x: x0,
          z: boundsZ,
          width,
          depth,
        },
        facadeDirection,
        facadeCenter: p(centerX, facadeZ),
      });
    }
  };

  side('south');
  side('north');
  return lots;
}

/**
 * Build the storefront spans. Each lot gets a storefront along the full
 * width of its street-facing facade (span 0..1).
 */
function buildStorefronts(): Storefront[] {
  const lots = buildLots();
  const storefronts: Storefront[] = [];
  for (const lot of lots) {
    const half = lot.bounds.width / 2;
    const start = p(lot.facadeCenter.x - half, lot.facadeCenter.z);
    const end = p(lot.facadeCenter.x + half, lot.facadeCenter.z);
    storefronts.push({
      id: `${lot.id}-storefront`,
      lotId: lot.id,
      spanStart: 0,
      spanEnd: 1,
      segment: { start, end },
    });
  }
  return storefronts;
}

/**
 * Build the pedestrian walkway waypoints. These trace the sidewalks and a
 * path through the block interior so pedestrians can circulate.
 */
function buildWalkway(): WalkwayWaypoint[] {
  const w = HALF_WIDTH - 3;
  const s = STREET_HALF_WIDTH + SIDEWALK_WIDTH / 2;
  const ids = ['south-west', 'south-mid', 'south-east', 'north-east', 'north-mid', 'north-west'];
  const pts = [
    p(-w, -s),
    p(0, -s),
    p(w, -s),
    p(w, s),
    p(0, s),
    p(-w, s),
  ];
  return ids.map((id, i) => ({ id, point: pts[i]! }));
}

/**
 * Build the traffic circulation loops. The main street loop runs around the
 * block using the ring road, and a dedicated loop follows the two main lanes.
 */
function buildTrafficLoops(): CityBlockLayout['trafficLoops'] {
  const w = HALF_WIDTH - 2;
  const d = HALF_DEPTH - 2;
  const ringLoop = {
    id: 'ring-circulation',
    waypoints: [p(-w, -d), p(w, -d), p(w, d), p(-w, d)],
  };
  const mainLoop = {
    id: 'main-street-loop',
    waypoints: [
      p(-HALF_WIDTH, LANE_OFFSET),
      p(HALF_WIDTH, LANE_OFFSET),
      p(HALF_WIDTH, -LANE_OFFSET),
      p(-HALF_WIDTH, -LANE_OFFSET),
    ],
  };
  return [ringLoop, mainLoop];
}

/**
 * Build the named camera focus points: a per-building vantage for every lot
 * plus an overview of the whole block.
 */
function buildCameraFocusPoints(): CityBlockLayout['cameraFocusPoints'] {
  const foci: CityBlockLayout['cameraFocusPoints'] = [];
  for (const lot of buildLots()) {
    const lookFrom = {
      x: lot.facadeCenter.x,
      z: lot.facadeCenter.z - lot.facadeDirection.z * 6,
    };
    foci.push({
      id: `focus-${lot.id}`,
      label: `View ${lot.id}`,
      position: lookFrom,
      target: lot.facadeCenter,
      height: 3,
    });
  }
  foci.push({
    id: 'focus-overview',
    label: 'Block overview',
    position: p(0, -HALF_DEPTH - 14),
    target: p(0, 0),
    height: 24,
  });
  return foci;
}

/**
 * The single, authoritative era-invariant layout for the reference city
 * block. Every scene subsystem and the camera rig consume this read-only.
 */
export const CITY_BLOCK_LAYOUT: CityBlockLayout = {
  block: {
    x: -HALF_WIDTH,
    z: -HALF_DEPTH,
    width: HALF_WIDTH * 2,
    depth: HALF_DEPTH * 2,
  },
  roads: buildRoads(),
  lanes: buildLanes(),
  sidewalks: buildSidewalks(),
  lots: buildLots(),
  storefronts: buildStorefronts(),
  walkway: buildWalkway(),
  trafficLoops: buildTrafficLoops(),
  cameraFocusPoints: buildCameraFocusPoints(),
};

/** Convenience accessors (read-only aliases into the shared layout). */
export const ROADS = CITY_BLOCK_LAYOUT.roads;
export const LANES = CITY_BLOCK_LAYOUT.lanes;
export const SIDEWALKS = CITY_BLOCK_LAYOUT.sidewalks;
export const LOTS = CITY_BLOCK_LAYOUT.lots;
export const STOREFRONTS = CITY_BLOCK_LAYOUT.storefronts;
export const WALKWAY = CITY_BLOCK_LAYOUT.walkway;
export const TRAFFIC_LOOPS = CITY_BLOCK_LAYOUT.trafficLoops;
export const CAMERA_FOCUS_POINTS = CITY_BLOCK_LAYOUT.cameraFocusPoints;

/**
 * Deterministic helpers used by consumers to look up geometry without
 * redefining it. Kept here so the layout module is the single owner of the
 * anchor data.
 */
export function findLotById(id: string): Lot | undefined {
  return CITY_BLOCK_LAYOUT.lots.find((lot) => lot.id === id);
}

export function findFocusPointById(id: string): CityBlockLayout['cameraFocusPoints'][number] | undefined {
  return CITY_BLOCK_LAYOUT.cameraFocusPoints.find((f) => f.id === id);
}

/** Distance between two points in the ground plane. */
export function distance(a: Point2, b: Point2): number {
  return Math.sqrt(distSq(a, b));
}

/** Total length of a polyline of waypoints (used for walkways and lanes). */
export function pathLength(waypoints: readonly Point2[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += distance(waypoints[i - 1]!, waypoints[i]!);
  }
  return total;
}

/** Unit direction from `a` toward `b`. */
export function directionFrom(a: Point2, b: Point2): Point2 {
  return unit({ x: b.x - a.x, z: b.z - a.z });
}