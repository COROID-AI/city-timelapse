/**
 * src/content/vehicles/WorldPaths.ts — shared block geometry and path sampling.
 *
 * Both era population modules (vehicles on the street, pedestrians on the
 * sidewalk loop) animate along closed paths declared here. Paths are plain
 * data so the era content can be retargeted without touching the morph layer:
 *
 *  - STREET_PATH: avenue centreline along Z. Two directional lanes are offset
 *    in X from this line (lane 0 heading +Z at +X, lane 1 heading −Z at −X).
 *    Traffic wraps at both ends so the avenue reads as one block-long stretch.
 *  - SIDEWALK_LOOP: closed walkway around the storefront block on the +X side
 *    of the avenue — the front sidewalk passes the storefronts.
 *
 * Motion driven by the shared morph timeline also reuses the small transition
 * fractions below (see EraVehicles/EraPedestrians), so a whole population swap
 * is scheduled, not rebuilt.
 */

export interface PathPoint {
  x: number;
  y: number;
  z: number;
}

/** Result of sampling a closed path at a 0..1 parameter. */
export interface PathSample {
  x: number;
  y: number;
  z: number;
  /** Heading (yaw) in radians facing the path direction. */
  yaw: number;
}

/** Street centreline waypoints (metres). */
export const STREET_PATH: readonly PathPoint[] = [
  { x: 0, y: 0, z: -30 },
  { x: 0, y: 0, z: 30 },
];

/** Sidewalk loop around the storefront block (metres). */
export const SIDEWALK_LOOP: readonly PathPoint[] = [
  { x: 3.4, y: 0, z: -25.5 },
  { x: 3.4, y: 0, z: 25.5 },
  { x: 6.6, y: 0, z: 25.5 },
  { x: 6.6, y: 0, z: -25.5 },
];

/** Lane cross offsets used to place cars on the street (outer/inner). */
export const LANE_OFFSET: Record<0 | 1, number> = { 0: 1.6, 1: -1.6 };

/** How far (loop fraction) a leaving population advances before it goes dark. */
export const DRIVE_OFF_FRACTION = 0.18;

/** How far (loop fraction) an arriving population starts behind its slot. */
export const DRIVE_IN_PULL_FRACTION = 0.14;

/** Total arc length of a closed path. */
export function loopLength(points: readonly PathPoint[]): number {
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return length;
}

/** Wrap any real value into 0..1. */
export function mod1(value: number): number {
  return ((value % 1) + 1) % 1;
}

/** Sample a closed path at parameter u in 0..1, returning position + yaw. */
export function sampleLoop(
  points: readonly PathPoint[],
  u01: number,
): PathSample {
  const u = mod1(u01);
  const total = loopLength(points);
  const target = u * total;
  let walked = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    if (walked + segLen >= target || segLen === 0) {
      const t = segLen === 0 ? 0 : (target - walked) / segLen;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    walked += segLen;
  }
  const first = points[0];
  return { x: first.x, y: first.y, z: first.z, yaw: 0 };
}

/** Crossfade profile for a leaving population: full until 45%, then to 0. */
export function fadeOut(progress: number): number {
  return progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
}

/** Crossfade profile for an arriving population: 0 up to 55%, then to 1. */
export function fadeIn(progress: number): number {
  return progress > 0.55 ? 1 : Math.max(0, progress / 0.55);
}