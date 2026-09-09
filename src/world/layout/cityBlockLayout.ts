/**
 * Deterministic seeded generator for the city-block layout.
 *
 * `createCityBlockLayout(seed)` returns a pure `BlockLayout` that is
 * identical for the same seed (no Date, no Math.random, no ambient state).
 * It lays out:
 *
 * - a block island bounded on its south flank by an east–west street (A)
 *   and on its west flank by a north–south street (B) meeting in a corner,
 * - 6–8 building plots with footprints, height ranges, and street-facing
 *   frontage planes split across the two street frontages,
 * - the two perpendicular streets, each with two travel lanes, painted
 *   lane markings, one zebra crosswalk, and parallel parking slots,
 * - paved sidewalks along both sides of each street,
 * - walking paths sampled along those pads (including across crosswalks),
 * - deterministic street-furniture anchors (lamps, fire hydrant, mailbox,
 *   bench, bus stop, trash can).
 *
 * All units are world meters on the ground plane (Y = 0). The block island
 * occupies x in [0, 30], z in [0, 18]; street A runs along +x south of the
 * block (z in [-7.4, 0]) and street B runs along +z west of the block
 * (x in [-7.4, 0]).
 */

import type {
  Axis2D,
  BlockLayout,
  BuildingPlot,
  Crosswalk,
  FurnitureAnchor,
  FurnitureKind,
  GridPoint2D,
  GridRect,
  GridVec2,
  Lane,
  ParkingSlot,
  RoadMarkingLine,
  Sidewalk,
  Street,
  StreetId,
  WalkingPath,
} from './types';

/* ------------------------------------------------------------------ */
/* Geometry constants (world meters)                                   */
/* ------------------------------------------------------------------ */

const BLOCK_MIN_X = 0;
const BLOCK_MAX_X = 30;
const BLOCK_MIN_Z = 0;
const BLOCK_MAX_Z = 18;

/** Width of one travel lane. */
const LANE_WIDTH = 3.4;
/** Painted carriageway margin beyond the lane edges (inside the asphalt). */
const LANE_MARGIN = 0.6;
/** Full asphalt carriageway width (two lanes + margin). */
const CARRIAGEWAY_WIDTH = LANE_WIDTH * 2 + LANE_MARGIN; // 7.4
/** Depth of the paved sidewalk pad on each side of a street. */
const SIDEWALK_DEPTH = 1.7;

/** Distance kept between the block edge and the building footprint. */
const PLOT_MARGIN = 2.0;
const PARKING_SLOT_LENGTH = 4.4;
const PARKING_SLOT_WIDTH = 2.6;
const CROSSWALK_BAND = 2.2;
const CROSSWALK_STRIPES = 6;
const WALKING_PATH_WIDTH = 1.0;

/** Building depth of the south-frontage plots (z extent). */
const SOUTH_ARM_Z_MIN = PLOT_MARGIN;
const SOUTH_ARM_Z_MAX = 9.2;
/** Building depth of the west-frontage plots (x extent). */
const WEST_ARM_X_MIN = PLOT_MARGIN;
const WEST_ARM_X_MAX = 9.7;
/** Frontage extents split into plots. */
const SOUTH_FRONT_MIN_X = 2.0;
const SOUTH_FRONT_MAX_X = 29.0;
const WEST_FRONT_MIN_Z = SOUTH_ARM_Z_MAX;
const WEST_FRONT_MAX_Z = 17.0;

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

/** Extract a stable integer from `seed-<n>` or hash any other seed. */
function stableSeedNumber(seed: string): number {
  const match = /-(\d+)$/.exec(seed);
  if (match) return Number(match[1]);
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (mulberry32); each call advances and returns [0,1). */
function createRng(seedNumber: number): () => number {
  let state = seedNumber >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function mid(a: number, b: number): number {
  return (a + b) / 2;
}

/** Inclusive point-in-rect check (ground plane). */
export function pointInRect(p: GridPoint2D, rect: GridRect): boolean {
  return p.x >= rect.minX && p.x <= rect.maxX && p.z >= rect.minZ && p.z <= rect.maxZ;
}

/** True when two axis-aligned rects share any interior area (Y = 0). */
export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Deterministically split the span `[start, end]` into `count` widths that
 * sum back to the full span (last width absorbs rounding). `maxJitter` is
 * the per-width deterministic deviation from an even split.
 */
function splitSpan(
  start: number,
  end: number,
  count: number,
  rng: () => number,
  maxJitter: number,
): number[] {
  const span = end - start;
  const base = span / count;
  let widths = Array.from({ length: count }, () => base + (rng() * 2 - 1) * maxJitter);
  // Shortest allowed plot keeps plots comfortably walkable/storefront-sized.
  const absoluteMin = span / (count * 2);
  widths = widths.map((w) => Math.max(w, absoluteMin));
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = span / total;
  widths = widths.map((w) => w * scale);
  widths[count - 1] = end - start - widths.slice(0, count - 1).reduce((s, w) => s + w, 0);
  return widths;
}

function plotHeightRange(rng: () => number): { min: number; max: number } {
  const base = 5 + rng() * 5; // 5..10
  const min = base + rng() * 2;
  const max = min + 3 + rng() * 7; // max strictly above min
  return { min, max };
}

/* ------------------------------------------------------------------ */
/* Street construction                                                 */
/* ------------------------------------------------------------------ */

/** Build the street hugging one flank of the block island. */
function buildStreet(
  id: StreetId,
  axis: Axis2D,
  alongStart: number,
  alongEnd: number,
): Street {
  const carriageway: GridRect =
    axis === 'x'
      ? { minX: alongStart, maxX: alongEnd, minZ: -CARRIAGEWAY_WIDTH, maxZ: 0 }
      : { minX: -CARRIAGEWAY_WIDTH, maxX: 0, minZ: alongStart, maxZ: alongEnd };

  // Lane 1 sits next to the block, lane 2 on the far side; centers sit at
  // ±half of the (lane + margin) band.
  const laneCenterA = -(LANE_WIDTH + LANE_MARGIN) / 2; // block-side lane center
  const laneCenterB = laneCenterA - LANE_WIDTH; // far-side lane center
  const halfLane = LANE_WIDTH / 2;

  const laneBounds: GridRect[] =
    axis === 'x'
      ? [
          { minX: alongStart, maxX: alongEnd, minZ: laneCenterA - halfLane, maxZ: laneCenterA + halfLane },
          { minX: alongStart, maxX: alongEnd, minZ: laneCenterB - halfLane, maxZ: laneCenterB + halfLane },
        ]
      : [
          { minX: laneCenterA - halfLane, maxX: laneCenterA + halfLane, minZ: alongStart, maxZ: alongEnd },
          { minX: laneCenterB - halfLane, maxX: laneCenterB + halfLane, minZ: alongStart, maxZ: alongEnd },
        ];

  const lanes: Lane[] = laneBounds.map((bounds, i) => {
    const direction: GridVec2 =
      axis === 'x' ? (i === 0 ? { x: 1, z: 0 } : { x: -1, z: 0 }) : i === 0 ? { x: 0, z: 1 } : { x: 0, z: -1 };
    const start: GridPoint2D = axis === 'x'
      ? { x: alongStart, z: direction.x === 1 ? laneCenterA : laneCenterB }
      : { x: direction.z === 1 ? laneCenterA : laneCenterB, z: alongStart };
    const end: GridPoint2D =
      axis === 'x'
        ? { x: alongEnd, z: direction.x === 1 ? laneCenterA : laneCenterB }
        : { x: direction.z === 1 ? laneCenterA : laneCenterB, z: alongEnd };
    return { id: `${id}-lane${i + 1}`, bounds, direction, centerLine: [start, end] };
  });

  // Painted edge lines: solid curb lines next to both sidewalks.
  const nearEdge = -CARRIAGEWAY_WIDTH + 0.18;
  const farEdge = -0.18;
  const curbA: RoadMarkingLine =
    axis === 'x'
      ? {
          from: { x: alongStart, z: farEdge },
          to: { x: alongEnd, z: farEdge },
          style: 'solid',
          width: 0.12,
        }
      : {
          from: { x: farEdge, z: alongStart },
          to: { x: farEdge, z: alongEnd },
          style: 'solid',
          width: 0.12,
        };
  const curbB: RoadMarkingLine =
    axis === 'x'
      ? {
          from: { x: alongStart, z: nearEdge },
          to: { x: alongEnd, z: nearEdge },
          style: 'solid',
          width: 0.12,
        }
      : {
          from: { x: nearEdge, z: alongStart },
          to: { x: nearEdge, z: alongEnd },
          style: 'solid',
          width: 0.12,
        };
  const centerLine: RoadMarkingLine =
    axis === 'x'
      ? {
          from: { x: alongStart, z: -LANE_WIDTH - LANE_MARGIN / 2 },
          to: { x: alongEnd, z: -LANE_WIDTH - LANE_MARGIN / 2 },
          style: 'dashed',
          width: 0.12,
          dash: 1.1,
          gap: 1.4,
        }
      : {
          from: { x: -LANE_WIDTH - LANE_MARGIN / 2, z: alongStart },
          to: { x: -LANE_WIDTH - LANE_MARGIN / 2, z: alongEnd },
          style: 'dashed',
          width: 0.12,
          dash: 1.1,
          gap: 1.4,
        };

  const crosswalk: Crosswalk =
    axis === 'x'
      ? {
          id: `${id}-crosswalk`,
          bounds: { minX: 1.0, maxX: 1.0 + CROSSWALK_BAND, minZ: -CARRIAGEWAY_WIDTH, maxZ: 0 },
          direction: { x: 0, z: -1 },
          stripeCount: CROSSWALK_STRIPES,
        }
      : {
          id: `${id}-crosswalk`,
          bounds: { minX: -CARRIAGEWAY_WIDTH, maxX: 0, minZ: 1.0, maxZ: 1.0 + CROSSWALK_BAND },
          direction: { x: -1, z: 0 },
          stripeCount: CROSSWALK_STRIPES,
        };

  const offsetStart = 7.0;
  const parking: ParkingSlot[] =
    axis === 'x'
      ? [0, 1, 2].map((i) => ({
          id: `${id}-park${i + 1}`,
          street: id,
          bounds: {
            minX: offsetStart + i * (PARKING_SLOT_LENGTH + 0.8),
            maxX: offsetStart + i * (PARKING_SLOT_LENGTH + 0.8) + PARKING_SLOT_LENGTH,
            minZ: -PARKING_SLOT_WIDTH,
            maxZ: -0.3,
          },
        }))
      : [0, 1].map((i) => ({
          id: `${id}-park${i + 1}`,
          street: id,
          bounds: {
            minX: -PARKING_SLOT_WIDTH,
            maxX: -0.3,
            minZ: 6.5 + i * (PARKING_SLOT_LENGTH + 0.8),
            maxZ: 6.5 + i * (PARKING_SLOT_LENGTH + 0.8) + PARKING_SLOT_LENGTH,
          },
        }));

  return {
    id,
    name: id,
    axis,
    carriageway,
    lanes,
    markings: [curbA, curbB, centerLine],
    crosswalks: [crosswalk],
    parkingSlots: parking,
  };
}

/* ------------------------------------------------------------------ */
/* Sidewalks, walking paths, furniture                                 */
/* ------------------------------------------------------------------ */

function buildSidewalks(): Sidewalk[] {
  return [
    // Block-side (south): between the block and street A.
    { id: 'sidewalk-a-block', bounds: { minX: BLOCK_MIN_X, maxX: BLOCK_MAX_X, minZ: 0, maxZ: SIDEWALK_DEPTH } },
    // Far side of street A (south roadside).
    { id: 'sidewalk-a-far', bounds: { minX: BLOCK_MIN_X, maxX: BLOCK_MAX_X, minZ: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH, maxZ: -CARRIAGEWAY_WIDTH } },
    // Block-side (walks B): between the block and street B.
    { id: 'sidewalk-b-block', bounds: { minX: 0, maxX: SIDEWALK_DEPTH, minZ: BLOCK_MIN_Z, maxZ: BLOCK_MAX_Z } },
    // Far-side of street B (west roadside).
    { id: 'sidewalk-b-far', bounds: { minX: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH, maxX: -CARRIAGEWAY_WIDTH, minZ: BLOCK_MIN_Z, maxZ: BLOCK_MAX_Z } },
  ];
}

function buildWalkingPaths(): WalkingPath[] {
  const walk = WALKING_PATH_WIDTH;
  return [
    // Along the block-side sidewalk of street A.
    { id: 'path-a-block', width: walk, points: [{ x: 2.5, z: 0.85 }, { x: 28.5, z: 0.85 }] },
    // Along the far sidewalk of street A.
    { id: 'path-a-far', width: walk, points: [{ x: 2.5, z: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.85 }, { x: 28.5, z: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.85 }] },
    // Cross street A on its crosswalk, from far sidewalk to block sidewalk.
    { id: 'path-a-cross', width: walk, points: [{ x: 2.6, z: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH }, { x: 2.6, z: 1.1 }] },
    // Along the block-side sidewalk of street B.
    { id: 'path-b-block', width: walk, points: [{ x: 0.85, z: 2.5 }, { x: 0.85, z: 16.5 }] },
    // Along the far sidewalk of street B.
    { id: 'path-b-far', width: walk, points: [{ x: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.85, z: 2.5 }, { x: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.85, z: 16.5 }] },
    // Cross street B's crosswalk, from far-side to block-side.
    { id: 'path-b-cross', width: walk, points: [{ x: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH, z: 2.6 }, { x: 0.85, z: 2.6 }] },
    // Corner link: connect the two block-side walks at the crossroads.
    { id: 'path-corner', width: walk, points: [{ x: 0.85, z: 0.85 }, { x: 0.85, z: 1.6 }] },
  ];
}

interface FurnitureSpot {
  id: string;
  kind: FurnitureKind;
  position: GridPoint2D;
  facing: GridVec2;
}

function buildFurniture(): FurnitureAnchor[] {
  const frames: FurnitureSpot[] = [
    // Street lamps along street A's block sidewalk.
    { id: 'lamp-a-1', kind: 'lamp', position: { x: 4.5, z: 0.85 }, facing: { x: 0, z: -1 } },
    { id: 'lamp-a-2', kind: 'lamp', position: { x: 9.0, z: 0.85 }, facing: { x: 0, z: -1 } },
    { id: 'lamp-a-3', kind: 'lamp', position: { x: 13.5, z: 0.85 }, facing: { x: 0, z: -1 } },
    // Street lamps along street B's block sidewalk.
    { id: 'lamp-b-1', kind: 'lamp', position: { x: 0.85, z: 5.5 }, facing: { x: -1, z: 0 } },
    { id: 'lamp-b-2', kind: 'lamp', position: { x: 0.85, z: 10.5 }, facing: { x: -1, z: 0 } },
  ];
  const fires = { id: 'hydrant-a', kind: 'fireHydrant' as const, position: { x: 2.6, z: 0.6 }, facing: { x: 0, z: -1 } };
  const mail = { id: 'mailbox-a', kind: 'mailbox' as const, position: { x: 17.5, z: 0.85 }, facing: { x: 0, z: -1 } };
  const bench = { id: 'bench-a-far', kind: 'bench' as const, position: { x: 11.0, z: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.8 }, facing: { x: 0, z: 1 } };
  const bus = { id: 'busstop-a-far', kind: 'busStop' as const, position: { x: 2.9, z: -CARRIAGEWAY_WIDTH - SIDEWALK_DEPTH + 0.9 }, facing: { x: 0, z: 1 } };
  const trash = { id: 'trash-a', kind: 'trashCan' as const, position: { x: 25.5, z: 0.7 }, facing: { x: 0, z: -1 } };
  return [...frames, fires, mail, bench, bus, trash];
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Create the deterministic city-block frame for `seed`. The same seed
 * always yields the identical `BlockLayout` — app code may cache it.
 */
export function createCityBlockLayout(seed: string): BlockLayout {
  const rng = createRng(stableSeedNumber(seed));

  const blockBounds: GridRect = { minX: BLOCK_MIN_X, maxX: BLOCK_MAX_X, minZ: BLOCK_MIN_Z, maxZ: BLOCK_MAX_Z };
  const streetA = buildStreet('streetA', 'x', BLOCK_MIN_X, BLOCK_MAX_X);
  const streetB = buildStreet('streetB', 'z', BLOCK_MIN_Z, BLOCK_MAX_Z);
  const streets: [Street, Street] = [streetB, streetA];

  // Plots: south arm (street A frontage) then west arm (street B frontage).
  const southCount = 3 + Math.round(rng()); // 3–4
  const southWidths = splitSpan(SOUTH_FRONT_MIN_X, SOUTH_FRONT_MAX_X, southCount, rng, 0.8);
  const westCount = 3 + Math.round(rng()); // 3–4
  const westWidths = splitSpan(WEST_FRONT_MIN_Z, WEST_FRONT_MAX_Z, westCount, rng, 0.5);
  const plots: BuildingPlot[] = [];

  let xCursor = SOUTH_FRONT_MIN_X;
  for (let i = 0; i < southCount; i += 1) {
    const minX = xCursor;
    const maxX = xCursor + southWidths[i];
    xCursor = maxX;
    const footprint: GridRect = { minX, maxX, minZ: SOUTH_ARM_Z_MIN, maxZ: SOUTH_ARM_Z_MAX };
    const heightRange = plotHeightRange(rng);
    const plot: BuildingPlot = {
      id: `plot-south-${i + 1}`,
      footprint,
      heightRange,
      frontageStreet: 'streetA',
      frontagePlane: { position: { x: mid(minX, maxX), z: SOUTH_ARM_Z_MIN }, width: maxX - minX, height: heightRange.max, facing: { x: 0, z: -1 } },
    };
    plots.push(plot);
  }

  let zCursor = WEST_FRONT_MIN_Z;
  for (let i = 0; i < westCount; i += 1) {
    const minZ = zCursor;
    const maxZ = zCursor + westWidths[i];
    zCursor = maxZ;
    const footprint: GridRect = { minX: WEST_ARM_X_MIN, maxX: WEST_ARM_X_MAX, minZ, maxZ };
    const heightRange = plotHeightRange(rng);
    const plot: BuildingPlot = {
      id: `plot-west-${i + 1}`,
      footprint,
      heightRange,
      frontageStreet: 'streetB',
      frontagePlane: { position: { x: WEST_ARM_X_MIN, z: mid(minZ, maxZ) }, width: maxZ - minZ, height: heightRange.max, facing: { x: -1, z: 0 } },
    };
    plots.push(plot);
  }

  return {
    seed,
    blockBounds,
    plots,
    streets,
    sidewalks: buildSidewalks(),
    walkingPaths: buildWalkingPaths(),
    furniture: buildFurniture(),
  };
}