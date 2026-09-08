/**
 * Live / final standings ranking for the race director.
 *
 * Computes the ordered leaderboard every frame from the shared entrant
 * snapshots and the checkpoint-validated lap states. Ranking rules:
 *
 *   1. Finished entrants always rank ahead of unfinished entrants.
 *   2. Among finished entrants, earlier `finishMs` ranks higher.
 *   3. Among unfinished entrants, more `cumulativeLoops` (lap + fractional
 *      progress) ranks higher; on ties, less elapsed race time ranks higher.
 *
 * Gap is the millisecond difference from the reference leader time — the
 * leader's `finishMs` when the leader has finished, otherwise the shared race
 * clock. Because every entrant consumes the same race clock, live cars show
 * an (honest) ~0 time gap while the field is still circulating; once the
 * leader finishes, the trailing cars' gaps become meaningful time deficits.
 *
 * The function is a pure function of its per-frame inputs (CarState snapshots
 * + prior lap timing), so it is deterministic under a fixed simulation.
 */

import type { CarState, StandingsEntry } from '../shared/types';
import type { EntrantLapState } from './lapTracker';

/** Per-entrant snapshot needed to rank the field. */
export interface StandingsInput {
  /** Standard CarState contract from player/AI systems. */
  readonly state: CarState;
  /** Name shown on the leaderboard (from the racer personality). */
  readonly name: string;
  /** Checkpoint-validated lap/timing state from the LapTracker. */
  readonly laps: EntrantLapState;
}

/**
 * Rank `entrants` into an ordered `StandingsEntry[]`.
 *
 * @param entrants Per-entrant rank inputs (one per car in the race).
 * @returns Ordered leaderboard, position 1 first; gaps in ms from the leader.
 */
export function computeStandings(entrants: readonly StandingsInput[]): StandingsEntry[] {
  const ranked = entrants.slice().sort((a, b) => compare(a.laps, b.laps));

  // Reference time for gaps: the leader's finish time when it has finished,
  // otherwise the shared race clock of the current leader.
  const leader = ranked[0];
  let refMs = 0;
  if (leader) {
    refMs = leader.laps.finished && leader.laps.finishMs !== null
      ? leader.laps.finishMs
      : leader.laps.raceMs;
  }

  return ranked.map((e, index) => ({
    carId: e.state.id,
    name: e.name,
    position: index + 1,
    lap: e.laps.completedLaps + (e.laps.finished ? 0 : 1),
    timeMs: Math.round(e.laps.raceMs),
    gap: refMs === 0 ? 0 : Math.round(Math.max(0, e.laps.raceMs - refMs)),
  }));
}

/** Total ordering over two lap states (deterministic; lower = better). */
function compare(a: EntrantLapState, b: EntrantLapState): number {
  // Finished always ahead of unfinished.
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (a.finished && b.finished) {
    return (a.finishMs ?? a.raceMs) - (b.finishMs ?? b.raceMs);
  }
  // Both live: more cumulative progress ahead, ties by less elapsed time.
  const prog = b.cumulativeLoops - a.cumulativeLoops;
  if (prog !== 0) return prog;
  return a.raceMs - b.raceMs;
}