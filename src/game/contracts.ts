import type * as THREE from 'three';

/**
 * Shared race contracts for the neon street racer.
 *
 * This module is the single source of truth for every cross-module state
 * shape (input, car, AI, camera, track, race) and every handle type that
 * gameplay modules (track, cars, AI, camera, HUD, effects) consume.
 *
 * FROZEN: this file is intentionally immutable after the foundation task
 * lands. Later tasks consume these types read-only; changing a shape here
 * breaks the parallel build. Do not edit without coordinating all owners.
 */

/** Raw player input as of the most recent key state. Arrow keys + Shift. */
export interface InputState {
  /** ArrowUp pressed. */
  up: boolean;
  /** ArrowDown pressed. */
  down: boolean;
  /** ArrowLeft pressed. */
  left: boolean;
  /** ArrowRight pressed. */
  right: boolean;
  /** Shift pressed — nitrous trigger. */
  nitrous: boolean;
}

/** Runtime state of a single car (player or AI). */
export interface CarState {
  /** Car position in world space (x/z ground plane). */
  position: THREE.Vector3;
  /** Car heading in radians in the horizontal plane. */
  heading: number;
  /** Forward speed along the heading (m/s). */
  speed: number;
  /** Drift factor in [0, 1]; higher = more sideways slide. */
  driftFactor: number;
  /** Nitrous charge in [0, 1]. */
  nitrousCharge: number;
  /** True while the nitrous boost is active. */
  boostActive: boolean;
  /** Current lap number (1-based while racing). */
  lap: number;
  /** Progress around the track in [0, 1). */
  trackProgress: number;
}

/** A racing car in the world: its mutable state plus its visual mesh. */
export interface CarHandle {
  /** Mutable car state. */
  state: CarState;
  /** Three.js object representing the car in the scene. */
  mesh: THREE.Object3D;
}

/** AI opponent runtime state. */
export interface AIState {
  /** Difficulty / aggression factor in [0, 1]. */
  aggression: number;
  /** Index of the racing-line waypoint the car is steering toward. */
  targetWaypoint: number;
  /** Intended steering imperfection (rad) so rivals feel human. */
  steeringError: number;
}

/** Camera follow / orbit rig state. */
export interface CameraRig {
  /** Rig mode: follow the player, orbit the whole scene, or cinematic. */
  mode: 'follow' | 'orbit' | 'cinematic';
  /** Distance between camera and its target. */
  distance: number;
  /** Camera height above its target. */
  height: number;
  /** Camera pitch (radians). */
  pitch: number;
}

/** Dense track definition consumed by every positional gameplay module. */
export interface TrackData {
  /** Pose the cars start from. */
  startLine: {
    /** Start position in world space. */
    position: THREE.Vector3;
    /** Forward heading in radians. */
    heading: number;
  };
  /** Dense, closed racing-line waypoints on the ground plane. */
  waypoints: THREE.Vector3[];
  /** Ordered checkpoint positions (start/finish included). */
  checkpoints: THREE.Vector3[];
  /** True when the waypoint loop closes back to the start. */
  closed: boolean;
  /** Track width in meters. */
  width: number;
}

/** One row in the live race standings, ordered best-first. */
export interface StandingEntry {
  /** Car identifier (matches the car in CarHandle). */
  carId: string;
  /** Current lap (1-based). */
  lap: number;
  /** Track progress in [0, 1). */
  trackProgress: number;
  /** Fastest lap time in seconds, or null if none completed yet. */
  bestLapSeconds: number | null;
  /** Total race time in seconds. */
  totalSeconds: number;
}

/** Full race runtime state — the race controller's authoritative snapshot. */
export interface RaceState {
  /** Race phase; countdown seconds apply only during 'countdown'. */
  phase: 'countdown' | 'racing' | 'finished' | 'paused';
  /** Seconds remaining in the start countdown (0 once racing). */
  countdown: number;
  /** Total number of laps in the race. */
  totalLaps: number;
  /** Elapsed race time in seconds. */
  elapsedSeconds: number;
  /** Per-car lap timers in seconds, keyed by car id. */
  lapTimers: Record<string, number>;
  /** Current standings, ordered best-first. */
  standings: StandingEntry[];
}

/**
 * Handles through which downstream modules interact with each system.
 * Concrete implementations are owned by the later gameplay tasks.
 */

/** Read-only access to the track geometry (used by HUD, racers). */
export interface TrackHandle {
  /** The immutable track definition. */
  readonly data: TrackData;
}

/** Race controller handle (used by HUD, composition, AI timing). */
export interface RaceHandle {
  /** Latest race snapshot. */
  readonly state: RaceState;
  /** Advance the race by one fixed tick. */
  update: (deltaSeconds: number, input: InputState) => void;
  /** A car crossed the start line — update lap counting. */
  onCarCrossStartLine: (carId: string) => void;
}

/** HUD overlay handle (speed, nitrous gauge, laps, timer, standings). */
export interface HUDHandle {
  /** Refresh the HUD from the latest race snapshot. */
  update: (race: RaceState) => void;
  /** Remove the HUD DOM and all listeners. */
  dispose: () => void;
}

/** Effects pipeline handle (neon glow, particles, screenshake, ...). */
export interface EffectsPipelineHandle {
  /** Advance all active effects by the fixed delta. */
  update: (deltaSeconds: number) => void;
  /** Release GPU resources and remove DOM. */
  dispose: () => void;
}
