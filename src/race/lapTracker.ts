/**
 * Deterministic, checkpoint-validated lap counting and timing.
 *
 * Owns per-entrant lap state for the race director. It consumes the shared
 * `CarState` snapshots produced by the player/AI systems — never positions
 * cars itself — and validates sequential checkpoint progression against the
 * closed-loop `TrackPath`, preventing reverse-direction cheating.
 *
 * Model
 * -----
 * The track loop's ordered waypoints (`track.points`) are treated as N
 * sequential checkpoints. Each entrant must reach checkpoint `(k+1) % N`
 * after checkpoint `k` in order for progress to count. A lap completes only
 * when the entrant has traversed every checkpoint in sequence and re-reached
 * the start/finish checkpoint (index 0). Skipping ahead or driving in
 * reverse yields no progress, so the only way forward is the forward
 * direction.
 *
 * Timing: each entrant records its per-lap times (from lap start to the next
 * finish-line crossing) under a global race clock measured from GO. The
 * cumulative race time is the sum of completed lap times plus the in-progress
 * lap elapse; it freezes at `finishMs` once the entrant finishes.
 */

import type { CarState, TrackPath } from '../shared/types';

/** A normalized arc-length position helper (mirrors the AI waypoint helpers). */
type Waypoint = readonly [number, number, number];

/** Clamp a value into the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Wrap an index into `[0, n)` (closed-loop adjacency). */
function wrapIndex(index: number, n: number): number {
  return ((index % n) + n) % n;
}

/** Squared euclidean distance between two waypoints (ignores Y). */
function distanceSq(a: Waypoint, b: Waypoint): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

/** Index of the waypoint nearest to `position`. */
function nearestWaypoint(points: readonly Waypoint[], position: Waypoint): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = distanceSq(points[i] as Waypoint, position);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Fractional loop position `[0, 1)` for a position, interpolated between the
 * nearest waypoint and the following one. 0 == the start/finish checkpoint.
 */
function fractionalLoopProgress(points: readonly Waypoint[], position: Waypoint): number {
  const n = points.length;
  if (n === 0) return 0;
  const i = nearestWaypoint(points, position);
  const a = points[i] as Waypoint;
  const b = points[wrapIndex(i + 1, n)] as Waypoint;

  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const apx = position[0] - a[0];
  const apz = position[2] - a[2];
  const lenSq = abx * abx + abz * abz;
  const frac = lenSq < 1e-9 ? 0 : clamp((apx * abx + apz * abz) / lenSq, 0, 1);

  let value = (i + frac) / n;
  if (value >= 1) value = 0;
  return value;
}

/** Accumulated per-entrant lap/timing state for the director. */
export interface EntrantLapState {
  /** Number of fully validated laps completed (0..totalLaps). */
  readonly completedLaps: number;
  /** Fractional position `[0, 1)` within the current lap (start line = 0). */
  readonly inLapProgress: number;
  /**
   * Cumulative loop count `completedLaps + inLapProgress`. Frozen near the
   * finish-line after completion; standings use this plus finish order.
   */
  readonly cumulativeLoops: number;
  /** How many sequential checkpoints have been reached in the current lap. */
  readonly checkpointsInLap: number;
  /** The checkpoint index this entrant must next reach to make progress. */
  readonly nextCheckpoint: number;
  /** True once `totalLaps` validated laps are complete. */
  readonly finished: boolean;
  /** Race-clock ms at which the entrant finished (null until finished). */
  readonly finishMs: number | null;
  /** Per-lap times in ms for the completed laps. */
  readonly lapTimesMs: readonly number[];
  /** Race-clock ms at the start of the current (in-progress) lap. */
  readonly currentLapStartMs: number;
  /** Cumulative race time in ms (sum of completed laps + current elapse). */
  readonly raceMs: number;
}

interface MutableEntrant {
  id: string;
  completedLaps: number;
  checkpointsInLap: number;
  nextCheckpoint: number;
  inLapProgress: number;
  currentLapStartMs: number;
  lapTimes: number[];
  finished: boolean;
  finishMs: number | null;
  lastSeenIndex: number;
}

/** Configured checkpoint-validated lap timing for a single race. */
export interface LapTracker {
  /** Advance an entrant one frame using its latest snapshot. */
  update(state: CarState, raceMs: number): EntrantLapState;
  /** Read the current lap state for an entrant id. */
  get(id: string): EntrantLapState;
  /** Per-lap times (ms) for an entrant id. */
  lapTimes(id: string): readonly number[];
}

/**
 * Build a checkpoint-validated lap timer over `track` requiring `totalLaps`
 * full, forward traversals of the loop to finish.
 */
export function createLapTracker(track: TrackPath, totalLaps: number): LapTracker {
  const points = track.points as readonly Waypoint[];
  const n = points.length;
  if (n < 3) {
    throw new Error('createLapTracker: TrackPath must have at least 3 waypoints');
  }
  if (!track.loop) {
    throw new Error('createLapTracker: laps require a closed-loop TrackPath');
  }

  const byId = new Map<string, MutableEntrant>();
  // Latest race clock observed; used by `get` for in-progress lap elapse.
  let currentRaceMs = 0;

  const makeState = (m: MutableEntrant, raceMs: number): EntrantLapState => ({
    completedLaps: m.completedLaps,
    inLapProgress: m.inLapProgress,
    cumulativeLoops:
      m.completedLaps + (m.finished ? 1 : m.inLapProgress),
    checkpointsInLap: m.checkpointsInLap,
    nextCheckpoint: m.nextCheckpoint,
    finished: m.finished,
    finishMs: m.finishMs,
    lapTimesMs: m.lapTimes,
    currentLapStartMs: m.currentLapStartMs,
    raceMs: m.finished && m.finishMs !== null
      ? m.finishMs
      : m.currentLapStartMs + Math.max(0, raceMs - m.currentLapStartMs),
  });

  const update = (state: CarState, raceMs: number): EntrantLapState => {
    currentRaceMs = raceMs;
    let m = byId.get(state.id);
    if (!m) {
      m = {
        id: state.id,
        completedLaps: 0,
        checkpointsInLap: 0,
        nextCheckpoint: wrapIndex(1, n),
        inLapProgress: 0,
        currentLapStartMs: raceMs,
        lapTimes: [],
        finished: false,
        finishMs: null,
        lastSeenIndex: 0,
      };
      byId.set(state.id, m);
    }

    const inLapProgress = fractionalLoopProgress(points, state.position);
    m.inLapProgress = inLapProgress;

    // Ignore further movement once finished — the classification is frozen.
    if (!m.finished) {
      const cur = nearestWaypoint(points, state.position);
      if (cur === m.nextCheckpoint) {
        m.checkpointsInLap += 1;
        m.nextCheckpoint = wrapIndex(m.nextCheckpoint + 1, n);

        // A lap completes when we have crossed all N checkpoints, which
        // happens exactly when nextCheckpoint wraps back to 0.
        if (m.nextCheckpoint === 0) {
          const lapTimeMs = Math.max(0, raceMs - m.currentLapStartMs);
          m.lapTimes.push(lapTimeMs);
          m.completedLaps += 1;
          m.checkpointsInLap = 0;
          m.currentLapStartMs = raceMs;

          if (m.completedLaps >= totalLaps) {
            m.finished = true;
            m.finishMs = raceMs;
            m.inLapProgress = 0;
          }
        }
      }
      m.lastSeenIndex = cur;
    }

    return makeState(m, raceMs);
  };

  const get = (id: string): EntrantLapState => {
    const m = byId.get(id);
    if (!m) return makeState({ id, completedLaps: 0, checkpointsInLap: 0, nextCheckpoint: wrapIndex(1, n), inLapProgress: 0, currentLapStartMs: 0, lapTimes: [], finished: false, finishMs: null, lastSeenIndex: 0 }, 0);
    return makeState(m, currentRaceMs);
  };

  const lapTimes = (id: string): readonly number[] => {
    const m = byId.get(id);
    return m ? m.lapTimes : [];
  };

  return { update, get, lapTimes };
}