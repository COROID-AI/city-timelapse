/**
 * Standings unit tests: ordering by finish, lap + progress, name/gap/lap
 * fields, and determinism of the ranking independently of the director.
 */

import { CarState } from '../../src/shared/types';
import {
  computeStandings,
  StandingsInput,
} from '../../src/race/standings';
import { EntrantLapState } from '../../src/race/lapTracker';

/** Build a minimal EntrantLapState for an unfinished car. */
function unim(state: {
  completedLaps: number;
  progress: number;
  raceMs: number;
}): EntrantLapState {
  return {
    completedLaps: state.completedLaps,
    inLapProgress: state.progress,
    cumulativeLoops: state.completedLaps + state.progress,
    checkpointsInLap: 0,
    nextCheckpoint: 1,
    finished: false,
    finishMs: null,
    lapTimesMs: [],
    currentLapStartMs: 0,
    raceMs: state.raceMs,
  };
}

/** Build a minimal EntrantLapState for a finished car. */
function done(state: { laps: number; finishMs: number }): EntrantLapState {
  return {
    completedLaps: state.laps,
    inLapProgress: 0,
    cumulativeLoops: state.laps,
    checkpointsInLap: 0,
    nextCheckpoint: 1,
    finished: true,
    finishMs: state.finishMs,
    lapTimesMs: [],
    currentLapStartMs: 0,
    raceMs: state.finishMs,
  };
}

function input(
  id: string,
  state: CarState,
  name: string,
  laps: EntrantLapState,
): StandingsInput {
  return { state, name, laps };
}

describe('computeStandings', () => {
  const car = (id: string): CarState =>
    ({ id, position: [0, 0, 0], yaw: 0, speed: 0, lap: 0, waypointIndex: 0 }) as CarState;

  it('orders unfinished cars by lap then fractional progress', () => {
    const cars = computeStandings([
      input('a', car('a'), 'Alpha', unim({ completedLaps: 1, progress: 0.9, raceMs: 4000 })),
      input('b', car('b'), 'Beta', unim({ completedLaps: 2, progress: 0.1, raceMs: 5050 })),
      input('c', car('c'), 'Gamma', unim({ completedLaps: 1, progress: 0.2, raceMs: 3800 })),
    ]);
    expect(cars.map((s) => s.carId)).toEqual(['b', 'a', 'c']);
    // Lap display is 1-based: lap 3 for the two-lap car, lap 2 for one-lap cars.
    expect(cars[0].lap).toBe(3);
    expect(cars[1].lap).toBe(2);
    expect(cars[2].lap).toBe(2);
  });

  it('ranks finished entrants by finish order ahead of unfinished cars', () => {
    const cars = computeStandings([
      input('un', car('un'), 'Unfinished', unim({ completedLaps: 2, progress: 0.5, raceMs: 9000 })),
      input('f2', car('f2'), 'Second', done({ laps: 3, finishMs: 8000 })),
      input('f1', car('f1'), 'First', done({ laps: 3, finishMs: 7000 })),
    ]);
    expect(cars[0].name).toBe('First');
    expect(cars[1].name).toBe('Second');
    expect(cars[2].name).toBe('Unfinished');
    expect(cars[0].position).toBe(1);
    expect(cars[2].lap).toBe(3); // unfinished lap display is 1-based
  });

  it('computes 1-based positions, a 0-gap leader, and non-negative ms gaps when the leader finishes', () => {
    const cars = computeStandings([
      input('a', car('a'), 'Alpha', done({ laps: 3, finishMs: 72000 })),
      input('b', car('b'), 'Beta', unim({ completedLaps: 2, progress: 0.9, raceMs: 73000 })),
    ]);
    expect(cars.map((s) => s.position)).toEqual([1, 2]);
    expect(cars[0].gap).toBe(0);
    expect(cars[1].gap).toBeGreaterThan(0); // time deficit behind the finished leader
  });

  it('carries carId/name/lap fields on every entry', () => {
    const cars = computeStandings([
      input('x', car('x'), 'Xena', unim({ completedLaps: 0, progress: 0.1, raceMs: 1000 })),
    ]);
    expect(cars[0]).toMatchObject({ carId: 'x', name: 'Xena', lap: 1 });
  });

  it('is deterministic: identical input ranks identically', () => {
    const build = (): StandingsInput[] =>
      [
        input('a', car('a'), 'A', unim({ completedLaps: 2, progress: 0.1, raceMs: 6000 })),
        input('b', car('b'), 'B', unim({ completedLaps: 1, progress: 0.9, raceMs: 4500 })),
        input('c', car('c'), 'C', done({ laps: 3, finishMs: 7000 })),
      ];
    const a = computeStandings(build()).map((s) => s.carId);
    const b = computeStandings(build()).map((s) => s.carId);
    expect(a).toEqual(b);
  });
});