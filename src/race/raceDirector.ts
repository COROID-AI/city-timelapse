/**
 * Race director — the deterministic brain of the race flow simulation.
 *
 * Owns the `RacePhase` state machine (pre-race → countdown → racing →
 * finished), the checkpoint-validated 3-lap timing via `LapTracker`, and the
 * every-frame live standings via `computeStandings`.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `createRaceDirector(track, entrants)` -> build the state machine
 *   `update(dt, carStates)`               -> advance one fixed frame
 *   `getState()`                          -> current `RaceState` snapshot
 *   `dispose()`                           -> release the director
 *
 * Entrant `CarState` objects are consumed as read-only snapshots produced by
 * the player and AI systems; this module never steers or moves cars. Because
 * every transition and timer advances by a caller-supplied fixed `dt`, the
 * whole simulation is a pure function of (`dt`, input states) and is
 * reproducible in Jest.
 */

import {
  CarState,
  RacePhase,
  RaceState,
  StandingsEntry,
  TrackPath,
} from '../shared/types';
import { createLapTracker, LapTracker } from './lapTracker';
import { computeStandings, StandingsInput } from './standings';

/** An entrant registered with the director when it is created. */
export interface RaceEntrant {
  /** Stable car id (matches the `CarState.id` produced by the systems). */
  readonly id: string;
  /** Display name shown on the leaderboard. */
  readonly name: string;
}

/** Total laps required to complete a race. */
export const TOTAL_LAPS = 3;

/** Seconds (wall-clock, at 1x) of the 3-2-1-GO countdown. */
export const COUNTDOWN_SECONDS = 3;

/** A constructed, running race director. */
export interface RaceDirector {
  /**
   * Advance the race by a fixed `dt` (seconds), consuming the latest entrant
   * snapshots for this frame.
   *
   * @param dt Fixed simulation step in seconds (deterministic when constant).
   * @param carStates Latest per-entrant CarState snapshots for this frame.
   */
  update(dt: number, carStates: readonly CarState[]): void;
  /** Current `RaceState` snapshot (phase, clock, standings, lap times). */
  getState(): RaceState;
  /** Release any owned resources (currently a no-op, symmetric with peers). */
  dispose(): void;
}

/** Map the car states into the per-frame standings input. */
function toStandingsInputs(
  states: readonly CarState[],
  names: Readonly<Record<string, string>>,
  laps: LapTracker,
  raceMs: number,
): StandingsInput[] {
  return states.map((state) => ({
    state,
    name: names[state.id] ?? state.id,
    laps: laps.update(state, raceMs),
  }));
}

/**
 * Build the race director over `track` for the given `entrants`.
 *
 * @param track Shared closed-loop `TrackPath` (read-only, never modified).
 * @param entrants The registered field of racers to rank and time.
 */
export function createRaceDirector(
  track: TrackPath,
  entrants: readonly RaceEntrant[],
): RaceDirector {
  const totalLaps = TOTAL_LAPS;
  const laps = createLapTracker(track, totalLaps);

  const names: Readonly<Record<string, string>> = entrants.reduce(
    (acc, e) => ({ ...acc, [e.id]: e.name }),
    {} as Record<string, string>,
  );

  let phase: RacePhase = RacePhase.Countdown;
  let countdown = COUNTDOWN_SECONDS;
  let raceMs = 0;
  let cars: Record<string, CarState> = {};
  let standings: readonly StandingsEntry[] = [];

  const lapTimeMap = (): Readonly<Record<string, readonly number[]>> => {
    const out: Record<string, readonly number[]> = {};
    for (const e of entrants) {
      out[e.id] = laps.get(e.id).lapTimesMs;
    }
    return out;
  };

  const update = (dt: number, carStates: readonly CarState[]): void => {
    if (dt <= 0) return;

    cars = {};
    for (const s of carStates) cars[s.id] = s;

    // --- Countdown → GO ----------------------------------------------------
    if (phase === RacePhase.Countdown) {
      countdown -= dt;
      if (countdown <= 0) {
        phase = RacePhase.Racing;
        countdown = 0;
        raceMs = 0;
      }
    } else if (phase === RacePhase.Racing) {
      raceMs += dt * 1000;
    }

    // Standings are computed every frame from progress + finish order.
    const inputs = toStandingsInputs(carStates, names, laps, raceMs);
    standings = computeStandings(inputs);

    // --- Finish detection (the leader classified → race ends; others
    // are ranked by their progress / finish order at the line) -------------
    if (phase === RacePhase.Racing && entrants.length > 0) {
      const anyFinished = entrants.some((e) => laps.get(e.id).finished);
      if (anyFinished) phase = RacePhase.Finished;
    }
  };

  const getState = (): RaceState => ({
    phase,
    timeMs: Math.round(raceMs),
    cars,
    standings,
    countdown,
    totalLaps,
    lapTimes: lapTimeMap(),
  });

  /** No owned GPU/geometry resources (pure logic); kept for symmetry. */
  const dispose = (): void => {
    /* lap tracker holds only plain numbers — nothing to release */
  };

  return { update, getState, dispose };
}