/**
 * Shared race-domain contracts for the neon-racer game.
 *
 * Every downstream system (input handling, physics, AI opponents, camera,
 * HUD, integration) reads THESE types as the canonical, read-only data
 * shapes. Treat every field as the source of truth; additive changes here
 * must be coordinated across the whole repository.
 *
 * Interfaces are intentionally `readonly` to discourage ad-hoc mutation of
 * shared state and to make per-frame diffing predictable.
 */

/** A 2D coordinate tuple (x, z in layout space). */
export type Vec2 = readonly [number, number];

/** A 3D coordinate tuple in world space. */
export type Vec3 = readonly [number, number, number];

/** Instantaneous kinematic + race state of a single car on the track. */
export interface CarState {
  /** Stable, unique id used across race-boundary and standings lookups. */
  readonly id: string;
  /** World-space position of the car body origin. */
  readonly position: Vec3;
  /** Heading (yaw) of the car in radians. */
  readonly yaw: number;
  /** Forward speed in world units / second. */
  readonly speed: number;
  /** Current lap index (0-based; increments when crossing the finish line). */
  readonly lap: number;
  /** Index of the most recently reached waypoint along the track path. */
  readonly waypointIndex: number;
}

/** Nitrous boost reserve and discharge state for a car. */
export interface NitrousState {
  /** Whether the nitrous system is currently discharging (boosting). */
  readonly active: boolean;
  /** Remaining reserve in the range [0, 1]. */
  readonly reserve: number;
  /** Current speed multiplier applied by nitrous (>= 1 while active). */
  readonly boost: number;
  /** Seconds until the reserve begins to regenerate after depletion. */
  readonly cooldown: number;
}

/** Raw player controller input for the current frame. */
export interface InputState {
  /** Throttle in [-1, 1]; negative = reverse. */
  readonly throttle: number;
  /** Steering in [-1, 1]; -1 = full left, 1 = full right. */
  readonly steer: number;
  /** Whether the brake is pressed. */
  readonly brake: boolean;
  /** Whether the nitrous trigger is held. */
  readonly nitrous: boolean;
}

/** Ordered polyline the race follows; optionally closed into a loop. */
export interface TrackPath {
  /** Ordered world-space waypoints along the route. */
  readonly points: readonly Vec3[];
  /** When true, the last waypoint connects back to the first. */
  readonly loop: boolean;
}

/** High-level lifecycle phase of a race. */
export enum RacePhase {
  /** Waiting before the race starts. */
  PreRace = 'pre-race',
  /** 3-2-1 countdown before go. */
  Countdown = 'countdown',
  /** Race is live; cars are ranked by progress. */
  Racing = 'racing',
  /** The race has concluded; standings are final. */
  Finished = 'finished',
}

/** A single row of the live / final leaderboard. */
export interface StandingsEntry {
  /** Car id this entry refers to. */
  readonly carId: string;
  /** 1-based overall position. */
  readonly position: number;
  /** Lap number the car is currently on. */
  readonly lap: number;
  /** Cumulative race time for this car in milliseconds. */
  readonly timeMs: number;
}

/** Snapshot of the entire race at a given frame. */
export interface RaceState {
  /** Current race lifecycle phase. */
  readonly phase: RacePhase;
  /** Elapsed race time in milliseconds (0 before Racing). */
  readonly timeMs: number;
  /** Per-car instantaneous state, indexed by car id. */
  readonly cars: Readonly<Record<string, CarState>>;
  /** Current ordered leaderboard. */
  readonly standings: readonly StandingsEntry[];
}