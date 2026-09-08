/**
 * Pure geometry + kinematics helpers for AI waypoint racers.
 *
 * This module is the ALLOCATION-FREE, deterministic core of the AI driving
 * model. It works only on plain closed polyline waypoints (`Vec3` tuples) so
 * the tests and the racer composer share one reproducible implementation
 * without depending on three.js curve internals. The neon city track exposes
 * its evenly arc-length-spaced checkpoints exactly as such a loop, which we
 * feed straight in here.
 *
 * Every function is a pure function of its inputs: lookahead steering,
 * curvature-based speed scaling, loop progress (for per-AI lap / race
 * progress and live standings), nearest-waypoint lookups, and lateral
 * off-track distance (for recovery).
 */

/** A 3D waypoint (x, y, z) on the closed track loop. */
export type Waypoint = readonly [number, number, number];

/** Clamp `value` into the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Wrap `value` into `[0, 1)` (normalized loop parameter). */
export function normalizeLoop(value: number): number {
  const mod = value % 1;
  return mod < 0 ? mod + 1 : mod;
}

/**
 * Reduce an angle to the nearest signed offset in `[-PI, PI]`.
 * Handles arbitrary magnitudes accumulated over many steering frames.
 */
export function angleDiff(angle: number): number {
  let r = angle % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/** Wrap an array index into `[0, n)` (closed-loop adjacency). */
export function wrapIndex(index: number, n: number): number {
  return ((index % n) + n) % n;
}

/** Squared Euclidean distance between two waypoints. */
export function squaredDistance(a: Waypoint, b: Waypoint): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Project `p` onto the segment `a -> b` (in 2D, ignoring the Y component).
 *
 * Returns the clamped parametric fraction `frac` in `[0,1]` (0 at `a`, 1 at
 * `b`) alongside the squared perpendicular distance from the segment.
 * This drives both loop progress (fractional arc position) and the lateral
 * off-track distance used by recovery.
 */
export function projectOnSegment(
  a: Waypoint,
  b: Waypoint,
  p: Waypoint,
): { frac: number; perpSq: number } {
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apz = p[2] - a[2];
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 1e-9) return { frac: 0, perpSq: squaredDistance(a, p) };
  const t = clamp((apx * abx + apz * abz) / lenSq, 0, 1);
  const cx = a[0] + abx * t;
  const cz = a[2] + abz * t;
  const ddx = p[0] - cx;
  const ddz = p[2] - cz;
  return { frac: t, perpSq: ddx * ddx + ddz * ddz };
}

/** Index of the waypoint closest to `position`. */
export function nearestWaypoint(points: readonly Waypoint[], position: Waypoint): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = squaredDistance(points[i] as Waypoint, position);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Fractional loop progress `[0, 1)` for a position, interpolated between the
 * nearest waypoint and the following one. Lap-progress layers this on top:
 * total race progress = `lap + loopProgress`.
 */
export function loopProgress(points: readonly Waypoint[], position: Waypoint): number {
  const n = points.length;
  if (n === 0) return 0;
  const i = nearestWaypoint(points, position);
  const a = points[i] as Waypoint;
  const b = points[wrapIndex(i + 1, n)] as Waypoint;
  const { frac } = projectOnSegment(a, b, position);
  let value = (i + frac) / n;
  if (value >= 1) value = 0;
  return value;
}

/** Shortest distance from `position` to the closed waypoint polyline. */
export function distanceToTrack(points: readonly Waypoint[], position: Waypoint): number {
  const n = points.length;
  if (n === 0) return 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = points[i] as Waypoint;
    const b = points[wrapIndex(i + 1, n)] as Waypoint;
    best = Math.min(best, projectOnSegment(a, b, position).perpSq);
  }
  return Math.sqrt(best);
}

/** Index `steps` waypoints ahead on the closed loop. */
export function lookaheadIndex(current: number, steps: number, count: number): number {
  return wrapIndex(current + steps, count);
}

/**
 * Signed steering in `[-1, 1]` needed to point the car (heading `yaw`)
 * at `target`. Full deflection at ±90°; zero when already aimed at the
 * waypoint. Uses the same forward convention as the physics module:
 * `forward = (sin(yaw), cos(yaw))`.
 */
export function steerToPoint(
  position: Waypoint,
  target: Waypoint,
  yaw: number,
): number {
  const dx = target[0] - position[0];
  const dz = target[2] - position[2];
  if (dx === 0 && dz === 0) return 0;
  const desired = Math.atan2(dx, dz);
  const diff = angleDiff(desired - yaw);
  // Full steering deflection is reached at a 90° heading error.
  return clamp(diff / (Math.PI / 2), -1, 1);
}

/**
 * Local curvature (in radians of turning angle) at the waypoint `index`,
 * measured from the turn between the preceding segment and the following
 * one. 0 = straight; larger = sharper corner.
 */
export function curvatureAt(points: readonly Waypoint[], index: number): number {
  const n = points.length;
  if (n < 3) return 0;
  const a = points[wrapIndex(index - 1, n)] as Waypoint;
  const b = points[index] as Waypoint;
  const c = points[wrapIndex(index + 1, n)] as Waypoint;
  const d1x = b[0] - a[0];
  const d1z = b[2] - a[2];
  const d2x = c[0] - b[0];
  const d2z = c[2] - b[2];
  const ang1 = Math.atan2(d1z, d1x);
  const ang2 = Math.atan2(d2z, d2x);
  return Math.abs(angleDiff(ang2 - ang1));
}

/**
 * Speed scale in `[minScale, 1]` for a given curvature: straightaway -> 1
 * (full speed), `tightCurvature` of turn -> `minScale` and lower. Keeps the
 * AI braking into corners and accelerating out, matching arcade feel.
 */
export function speedScaleForCurvature(
  curvature: number,
  tightCurvature: number,
  minScale: number,
): number {
  if (tightCurvature <= 0) return 1;
  return clamp(1 - curvature / tightCurvature, minScale, 1);
}