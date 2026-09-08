/**
 * Deterministic closed-loop street circuit for the neon city.
 *
 * The track is the single source of truth for lap progress, AI waypoint
 * lookahead, checkpoint timing, and the start/finish line. Geometry is
 * generated from a fixed seed so every module (world, vehicle, race, AI)
 * agrees on the exact same curve and checkpoint layout.
 *
 * The loop is exposed both as the shared `TrackPath` contract (a waypoint
 * list) and as a `THREE.CatmullRomCurve3` for smooth sampling. Checkpoints
 * are evenly spaced by arc length so per-segment progress is uniform.
 */

import * as THREE from 'three';
import type { TrackPath } from '../shared/types';

/** Fixed seed so the circuit layout is reproducible across modules. */
export const TRACK_SEED = 0x9e3779b9;

/** Number of evenly spaced checkpoints around the loop. */
export const CHECKPOINT_COUNT = 40;

/** Half-width of the drivable road ribbon, in world units. */
export const ROAD_HALF_WIDTH = 12;

/** Base control polygon (x, y, z) before seeded jitter. */
const BASE_POINTS: readonly (readonly [number, number, number])[] = [
  [-90, 0, -55],
  [-45, 0, -95],
  [45, 0, -95],
  [90, 0, -55],
  [90, 0, 55],
  [45, 0, 95],
  [-45, 0, 95],
  [-90, 0, 55],
];

/**
 * Deterministic PRNG (mulberry32). Used everywhere a reproducible layout is
 * required (track jitter, sign placement, building placement, …).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orientation of the start/finish line on the track. */
export interface StartLine {
  /** World-space position of the line (on the centerline). */
  readonly position: THREE.Vector3;
  /** Unit forward tangent along the direction of travel. */
  readonly tangent: THREE.Vector3;
  /** Unit vector pointing to the right of the direction of travel. */
  readonly right: THREE.Vector3;
}

/**
 * A fully built, sampled street circuit. `path` is the shared contract the
 * race/AI layer consumes; `curve` and `checkpoints` support smooth sampling
 * and per-segment progress.
 */
export interface TrackCurve {
  /** Shared `TrackPath` contract (closed waypoint loop). */
  readonly path: TrackPath;
  /** The smooth closed CatmullRom curve (arc-length parametrizable). */
  readonly curve: THREE.CatmullRomCurve3;
  /** Total arc length of the loop in world units. */
  readonly length: number;
  /** Evenly arc-length-spaced checkpoints around the loop. */
  readonly checkpoints: readonly THREE.Vector3[];
  /** Number of checkpoints (= `checkpoints.length`). */
  readonly checkpointCount: number;
  /** Start/finish line, coincident with `checkpoints[0]`. */
  readonly startLine: StartLine;
  /** Sample the curve at normalized parameter `t` in [0, 1]. */
  getPoint(t: number, target?: THREE.Vector3): THREE.Vector3;
  /** Sample the unit tangent at normalized parameter `t` in [0, 1]. */
  getTangent(t: number, target?: THREE.Vector3): THREE.Vector3;
  /** Index of the checkpoint nearest to `position` (for lap progress). */
  nearestCheckpoint(position: THREE.Vector3): number;
}

/**
 * Build the deterministic closed-loop street circuit.
 * @param seed Optional override of the layout seed (tests use this).
 */
export function createTrack(seed: number = TRACK_SEED): TrackCurve {
  const rand = mulberry32(seed);
  const jitter = (v: number, amp: number): number => v + (rand() - 0.5) * 2 * amp;

  const controlPoints: THREE.Vector3[] = [];
  for (const [x, y, z] of BASE_POINTS) {
    controlPoints.push(new THREE.Vector3(jitter(x, 6), y, jitter(z, 6)));
  }

  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
  const length = curve.getLength();

  // Evenly spaced checkpoints by arc length: `getPointAt` already re-maps the
  // uniform parameter to arc length, so equal t-steps mean equal spacing.
  const checkpoints: THREE.Vector3[] = [];
  for (let i = 0; i < CHECKPOINT_COUNT; i++) {
    checkpoints.push(curve.getPointAt(i / CHECKPOINT_COUNT));
  }

  const startPosition = checkpoints[0] as THREE.Vector3;
  const tangent = curve.getTangentAt(0).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  const path: TrackPath = {
    points: controlPoints.map((p) => [p.x, p.y, p.z] as const),
    loop: true,
  };

  return {
    path,
    curve,
    length,
    checkpoints,
    checkpointCount: CHECKPOINT_COUNT,
    startLine: { position: startPosition, tangent, right },
    getPoint: (t, target) => curve.getPoint(t, target),
    getTangent: (t, target) => curve.getTangent(t, target),
    nearestCheckpoint(position) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < checkpoints.length; i++) {
        const d = position.distanceToSquared(checkpoints[i] as THREE.Vector3);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
  };
}