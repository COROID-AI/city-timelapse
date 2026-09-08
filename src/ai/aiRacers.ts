/**
 * AI opponent racers.
 *
 * Composes the neon car mesh factory from `../vehicle/carMesh` (reusing the
 * exact same livery system — never forking a second mesh implementation) with
 * the deterministic waypoint-following core from `waypointFollower` to build
 * `count` lane-placed rival cars that race the player around the closed
 * `TrackPath`.
 *
 * Lifecycle contract (consumed by integration-polish / race-director):
 *   `createAIRacers(track, count)` -> build car meshes + mutable AI states
 *   `ai.update(dt, player)`        -> steer every AI for one frame
 *   `ai.getState(index)`           -> CarState-compatible snapshot
 *   `ai.dispose()`                 -> release all mesh resources
 *
 * Each AI exposes a `CarState`-compatible shape via `getState()` so live
 * standings can rank them against the player by `lap + loopProgress`.
 *
 * Behavior highlights
 * -------------------
 *  - Personality: each AI has a distinct speed multiplier (racing style).
 *  - Lookahead steering: steers toward a waypoint `lookahead` segments ahead.
 *  - Curvature speed control: target speed drops into corners, builds on
 *    straights.
 *  - Bounded rubber-banding: an AI far ahead of the player gets a small
 *    backoff; one far behind gets a proportional catch-up boost. The effective
 *    multiplier is clamped per personality so the field stays near the player
 *    without ever dominating or dropping out.
 *  - Off-track recovery: when lateral distance exceeds the road half-width the
 *    car physically steers back toward the centerline at reduced speed.
 */

import * as THREE from 'three';

import type { CarState, TrackPath } from '../shared/types';
import { createCarMesh } from '../vehicle/carMesh';
import {
  type Waypoint,
  clamp,
  curvatureAt,
  distanceToTrack,
  lookaheadIndex,
  loopProgress,
  nearestWaypoint,
  steerToPoint,
} from './waypointFollower';

/** An AI opponent archetype (one per start-grid slot). */
export interface AIPersonality {
  /** Livery key from `carMesh.LIVERIES`. */
  readonly livery: string;
  /** Unique racer name (shown in standings). */
  readonly name: string;
  /** Racing style multiplier: > 1 = aggressive, < 1 = conservative. */
  readonly speedMultiplier: number;
  /** Per-lap rubber-band pull-back when far ahead of the player. */
  readonly backoffCoeff: number;
  /** Per-lap catch-up boost when far behind the player. */
  readonly catchupCoeff: number;
}

/** Default on-grid personalities (architect-approved arcade roster). */
export const DEFAULT_PERSONALITIES: readonly AIPersonality[] = [
  { livery: 'violet', name: 'Violet', speedMultiplier: 1.06, backoffCoeff: 0.16, catchupCoeff: 0.14 },
  { livery: 'ember', name: 'Ember', speedMultiplier: 0.97, backoffCoeff: 0.14, catchupCoeff: 0.12 },
  { livery: 'frost', name: 'Frost', speedMultiplier: 1.0, backoffCoeff: 0.15, catchupCoeff: 0.13 },
];

/** Tunable AI behaviour constants. */
export interface AIRacerConfig {
  /** Waypoints ahead of the car the steering aims at. */
  readonly lookahead: number;
  /** Rubber-band window, in fraction of a lap. */
  readonly bandLap: number;
  /** Max rubber-band deviation from 1 (bounded). */
  readonly bandMax: number;
  /** Corner curvature treated as "tight" for speed scaling (radians). */
  readonly tightCurvature: number;
  /** Lowest speed scale allowed in the tightest corners. */
  readonly minSpeedScale: number;
  /** Lateral off-track threshold (equals the road half-width). */
  readonly roadHalfWidth: number;
  /** Extra steering gain applied while recovering toward the centerline. */
  readonly recoveryGain: number;
  /** Absolute speed cap while recovering (world units / second). */
  readonly recoveryMaxSpeed: number;
  /** Base max cruising speed (world units / second). */
  readonly baseMaxSpeed: number;
  /** Forward acceleration (world units / second^2). */
  readonly acceleration: number;
  /** Peak steering yaw rate (radians / second). */
  readonly steerRateMax: number;
}

/** Default AI behavior tuning. */
export const defaultAIRacerConfig: Readonly<AIRacerConfig> = {
  lookahead: 5,
  bandLap: 0.18,
  bandMax: 0.18,
  tightCurvature: 1.1,
  minSpeedScale: 0.42,
  roadHalfWidth: 12,
  recoveryGain: 1.5,
  recoveryMaxSpeed: 10,
  baseMaxSpeed: 30,
  acceleration: 32,
  steerRateMax: 2.4,
};

/** Mutable per-AI runtime state (the composer owns this). */
export interface AIRacerState {
  /** Grid slot / personality index across the field. */
  readonly index: number;
  /** Stable car id (used by standings + race-boundary lookups). */
  readonly id: string;
  /** Display name from the personality. */
  readonly name: string;
  /** The visible neon car mesh (add to the scene to display). */
  readonly body: THREE.Group;
  /** Mutable kinematic state. */
  readonly kin: { x: number; z: number; yaw: number; speed: number };
  /** 0-based lap counter. */
  lap: number;
  /** Most recently reached waypoint index (per CarState). */
  waypointIndex: number;
  /** Fractional loop progress in `[0,1)` within the current lap. */
  loopProgress: number;
  /** Effective personality-based speed multiplier in force this frame. */
  personalityMultiplier: number;
  /** Current bounded rubber-band multiplier (near 1). */
  rubberBand: number;
}

/** Concrete `CarState`-compatible snapshot from an AI. */
export interface AIRacerStateView extends CarState {
  /** Live fractional loop progress for rankings. */
  readonly progress: number;
  /** Effective speed multiplier in force this frame. */
  readonly multiplier: number;
}

/** The bundled AI opponent field. */
export interface AIRacers {
  /** The individual racer states. */
  readonly racers: readonly AIRacerState[];
  /** Build a CarState-compatible snapshot for a racer. */
  getState(index: number): AIRacerStateView;
  /** Advance every racer by `dt`, rubber-banding toward the player. */
  update(dt: number, player: { readonly x: number; readonly z: number; readonly lap: number }): void;
  /** Release all mesh geometry/materials. */
  dispose(): void;
}

/**
 * Build `count` AI opponent cars on a staggered start grid ahead of the start
 * line, reusing `createCarMesh` with distinct liveries and names.
 *
 * @param track Shared closed-loop TrackPath (read-only; never modified).
 * @param count Number of AI opponents (default 3).
 */
export function createAIRacers(track: TrackPath, count: number = 3): AIRacers {
  if (!track || track.points.length < 3) {
    throw new Error('createAIRacers: TrackPath must have at least 3 waypoints');
  }
  const waypoints = track.points as readonly Waypoint[];
  const n = waypoints.length;
  const cfg = defaultAIRacerConfig;

  // Derive the start-line frame (position + forward tangent + right) directly
  // from the waypoint loop so no geometric regeneration is required.
  const startPos = waypoints[0] as Waypoint;
  const nextPos = waypoints[1] as Waypoint;
  let tx = nextPos[0] - startPos[0];
  let tz = nextPos[2] - startPos[2];
  const tLen = Math.hypot(tx, tz);
  if (tLen > 1e-9) {
    tx /= tLen;
    tz /= tLen;
  } else {
    tz = 1;
  }
  // Right vector = forward tangent rotated -90° about Y.
  const rx = -tz;
  const rz = tx;
  const startYaw = Math.atan2(tx, tz);

  const racers: AIRacerState[] = [];

  for (let i = 0; i < count; i++) {
    const personality = DEFAULT_PERSONALITIES[i % DEFAULT_PERSONALITIES.length] as AIPersonality;
    const id = `ai-${i}`;

    const body = createCarMesh({ livery: personality.livery });
    body.name = `ai-car-${i}`;

    // Staggered grid: alternate sides of the start line, creeping forward
    // by slot so cars don't overlap. AI occupy slots 1..count (player = 0).
    const slot = i + 1;
    const dir = slot % 2 === 0 ? 1 : -1;
    const lane = Math.floor(slot / 2);
    const lateral = dir * (lane + 0.5) * 1.8;
    const backOff = 1.0 + i * 1.35;

    const sx = startPos[0] + rx * lateral - tx * backOff;
    const sz = startPos[2] + rz * lateral - tz * backOff;

    const racer: AIRacerState = {
      index: i,
      id,
      name: personality.name,
      body,
      kin: { x: sx, z: sz, yaw: startYaw, speed: 0 },
      lap: 0,
      waypointIndex: 0,
      loopProgress: 0,
      personalityMultiplier: personality.speedMultiplier,
      rubberBand: 1,
    };
    body.position.set(sx, 0, sz);
    body.rotation.y = startYaw;
    racers.push(racer);
  }

  /** Perceived race progress = lap + fractional loop progress. */
  const raceProgress = (lap: number, loop: number): number => lap + Math.min(loop, 1);

  /** Build a CarState-compatible snapshot for one racer. */
  const getState = (index: number): AIRacerStateView => {
    const r = racers[index] as AIRacerState;
    return {
      id: r.id,
      position: [r.kin.x, 0, r.kin.z],
      yaw: r.kin.yaw,
      speed: r.kin.speed,
      lap: r.lap,
      waypointIndex: r.waypointIndex,
      progress: r.loopProgress,
      multiplier: r.personalityMultiplier * r.rubberBand,
    };
  };

  /** Advance every AI toward its lookahead waypoint for one frame. */
  const update = (
    dt: number,
    player: { readonly x: number; readonly z: number; readonly lap: number },
  ): void => {
    const playerProgress = raceProgress(
      player.lap,
      loopProgress(waypoints, [player.x, 0, player.z] as Waypoint),
    );

    for (const r of racers) {
      const pos: Waypoint = [r.kin.x, 0, r.kin.z];

      // --- Nearest waypoint + lookahead target -------------------------------
      const nearest = nearestWaypoint(waypoints, pos);
      r.waypointIndex = nearest;
      const look = lookaheadIndex(nearest, cfg.lookahead, n);
      const target = waypoints[look] as Waypoint;

      // --- Bounded rubber-banding ---------------------------------------------
      const myProgress = raceProgress(r.lap, r.loopProgress);
      const diff = myProgress - playerProgress;
      let band = 1;
      if (diff > cfg.bandLap) {
        band = 1 - Math.min(diff - cfg.bandLap, cfg.bandMax) * personalityFor(r).backoffCoeff;
      } else if (diff < -cfg.bandLap) {
        band = 1 + Math.min(-diff - cfg.bandLap, cfg.bandMax) * personalityFor(r).catchupCoeff;
      }
      r.rubberBand = band;

      // --- Curvature-based target speed ---------------------------------------
      const curv = curvatureAt(waypoints, look);
      const speedScale = speedScaleForCurvature(curv, cfg);
      const targetSpeed = cfg.baseMaxSpeed * r.personalityMultiplier * r.rubberBand * speedScale;

      // --- Off-track recovery --------------------------------------------------
      const off = distanceToTrack(waypoints, pos);
      let steer = steerToPoint(pos, target, r.kin.yaw);
      let speedTarget = targetSpeed;
      if (off > cfg.roadHalfWidth) {
        const center = waypoints[nearest] as Waypoint;
        const toCenter = steerToPoint(pos, center, r.kin.yaw);
        steer = clamp(steer + toCenter * cfg.recoveryGain, -1, 1);
        speedTarget = Math.min(speedTarget, cfg.recoveryMaxSpeed);
      }

      // --- Advance attitude + speed --------------------------------------------
      const accel = cfg.acceleration * dt;
      const newSpeed = r.kin.speed < speedTarget
        ? Math.min(speedTarget, r.kin.speed + accel)
        : Math.max(speedTarget, r.kin.speed - cfg.acceleration * cfg.minSpeedScale * dt);

      // Steering gain is low at launch so cars don't snap sideways.
      const gain = clamp(Math.abs(newSpeed) / 6, 0, 1);
      r.kin.yaw += steer * cfg.steerRateMax * gain * dt;
      r.kin.speed = newSpeed;

      // --- Integrate position ---------------------------------------------------
      r.kin.x += Math.sin(r.kin.yaw) * newSpeed * dt;
      r.kin.z += Math.cos(r.kin.yaw) * newSpeed * dt;

      // --- Progress + lap crossing ----------------------------------------------
      const currentLoop = loopProgress(waypoints, [r.kin.x, 0, r.kin.z] as Waypoint);
      if (r.loopProgress > 0.9 && currentLoop < 0.1) {
        r.lap += 1;
      }
      r.loopProgress = currentLoop;

      // --- Push pose onto the mesh ----------------------------------------------
      r.body.position.set(r.kin.x, 0, r.kin.z);
      r.body.rotation.y = r.kin.yaw;
    }
  };

  /** Release all mesh resources. */
  const dispose = (): void => {
    for (const r of racers) {
      r.body.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    }
  };

  return { racers, getState, update, dispose };
}

/** Look up the personality assigned to a racer state. */
function personalityFor(r: { index: number }): AIPersonality {
  return DEFAULT_PERSONALITIES[r.index % DEFAULT_PERSONALITIES.length] as AIPersonality;
}

/** Speed scale from curvature, clamped to the racer band. */
function speedScaleForCurvature(curvature: number, cfg: Readonly<AIRacerConfig>): number {
  if (cfg.tightCurvature <= 0) return 1;
  return clamp(1 - curvature / cfg.tightCurvature, cfg.minSpeedScale, 1);
}

