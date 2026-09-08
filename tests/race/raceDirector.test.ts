/**
 * Race-director integration tests: countdown, 3-lap timing, checkpoint lap
 * validation, finish, and determinism under a fixed dt.
 *
 * These drive the director with synthetic `CarState` snapshots placed on a
 * known closed-loop track so lap transitions can be asserted deterministically.
 */

import { createTrack } from '../../src/world/track';
import { CarState, RacePhase, TrackPath } from '../../src/shared/types';
import {
  createRaceDirector,
  RaceDirector,
  RaceEntrant,
  COUNTDOWN_SECONDS,
  TOTAL_LAPS,
} from '../../src/race/raceDirector';

/** A tiny closed square loop with 8 checkpoints for deterministic testing. */
function buildTestTrack(): TrackPath {
  return {
    loop: true,
    points: [
      [0, 0, 40],
      [40, 0, 40],
      [40, 0, 0],
      [40, 0, -40],
      [0, 0, -40],
      [-40, 0, -40],
      [-40, 0, 0],
      [-40, 0, 40],
    ],
  };
}

/** Build a CarState snapshot at a given waypoint index with the right lap. */
function carAt(
  id: string,
  waypoint: number,
  pos: readonly [number, number, number],
  lapIndex: number,
): CarState {
  return { id, position: pos, yaw: 0, speed: 0, lap: lapIndex, waypointIndex: waypoint };
}

describe('createRaceDirector', () => {
  const track = buildTestTrack();
  const entrants: RaceEntrant[] = [
    { id: 'player', name: 'Player' },
    { id: 'ai-0', name: 'Violet' },
  ];

  it('starts in Countdown and exposes 3-2-1-GO before Racing', () => {
    const race = createRaceDirector(track, entrants);
    expect(race.getState().phase).toBe(RacePhase.Countdown);
    expect(race.getState().countdown).toBeCloseTo(COUNTDOWN_SECONDS);

    // Drive countdown in 0.5s steps → after 1s only 2s remain.
    for (let i = 0; i < 2; i++) race.update(0.5, starterStates());
    expect(race.getState().phase).toBe(RacePhase.Countdown);
    expect(race.getState().countdown).toBeCloseTo(2);

    // Finish the countdown → GO.
    let remaining = race.getState().countdown;
    while (remaining > 1e-9) {
      race.update(remaining, starterStates());
      remaining = race.getState().countdown;
    }
    expect(race.getState().phase).toBe(RacePhase.Racing);
    expect(race.getState().countdown).toBe(0);
    expect(race.getState().timeMs).toBe(0);
  });

  it('starts the total timer from GO with per-lap times accumulating', () => {
    const race = createRaceDirector(track, entrants);
    go(race); // advance countdown to Racing

    race.update(1, starterStates());
    expect(race.getState().phase).toBe(RacePhase.Racing);
    // 1s after GO the total clock reads 1000 ms and no lap is complete yet.
    expect(race.getState().timeMs).toBe(1000);
    expect(race.getState().lapTimes['player']).toEqual([]);
  });

  it('requires sequential checkpoint progression (blocks reverse-direction)', () => {
    const race = createRaceDirector(track, entrants);
    go(race);

    // A car reports being at a later checkpoint than the start line without
    // having passed the earlier ones — this is skipping and must not advance.
    const jumped = carAt('player', 4, [40, 0, -40], 0);
    race.update(1, [jumped, starterState('ai-0')]);
    const st = race.getState().standings.find((s) => s.carId === 'player')!;
    expect(st.lap).toBe(1); // still on lap 1, no completion
    expect(race.getState().lapTimes['player']).toEqual([]);
  });

  it('completes the race at the start/finish line after 3 validated laps', () => {
    const race = createRaceDirector(track, entrants);
    go(race);

    // Drive the player through all 8 checkpoints in order, 3 laps.
    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
      for (let c = 1; c <= 8; c++) {
        const idx = c % 8; // waypoint index 1..7 then 0 (finish line)
        race.update(0.1, [carAt('player', idx, track.points[idx]!, 0), starterState('ai-0')]);
      }
    }

    const state = race.getState();
    expect(state.phase).toBe(RacePhase.Finished);
    expect(state.standings[0].lap).toBe(TOTAL_LAPS);
    expect(state.lapTimes['player']).toHaveLength(TOTAL_LAPS);
  });

  it('ranks unfinished entrants by lap + progress and finished first', () => {
    const race = createRaceDirector(track, entrants);
    go(race);

    // Give the player two completed laps worth of waypoints; AI stays on lap 1.
    for (let lap = 0; lap < 2; lap++) {
      for (let c = 1; c <= 8; c++) {
        const idx = c % 8;
        race.update(0.1, [carAt('player', idx, track.points[idx]!, 0), starterState('ai-0')]);
      }
    }
    let state = race.getState();
    expect(state.standings[0].carId).toBe('player');
    expect(state.standings[0].position).toBe(1);

    // Finish the player fully → player stays ahead and finished.
    for (let lap = 0; lap < 1; lap++) {
      for (let c = 1; c <= 8; c++) {
        const idx = c % 8;
        race.update(0.1, [carAt('player', idx, track.points[idx]!, 0), starterState('ai-0')]);
      }
    }
    state = race.getState();
    expect(state.phase).toBe(RacePhase.Finished);
    expect(state.standings[0].carId).toBe('player');
    expect(state.standings[0].lap).toBe(TOTAL_LAPS);
  });

  it('is deterministic under a fixed dt (identical runs produce identical state)', () => {
    const run = (): number => {
      const race = createRaceDirector(track, entrants);
      go(race);
      for (let lap = 0; lap < TOTAL_LAPS; lap++) {
        for (let c = 1; c <= 8; c++) {
          const idx = c % 8;
          race.update(0.05, [carAt('player', idx, track.points[idx]!, 0), starterState('ai-0')]);
        }
      }
      const s = race.getState();
      return s.timeMs + s.standings.reduce((a, e) => a + e.position, 0);
    };
    expect(run()).toBe(run());
  });
});

/** Register + snapshots used as the neutral "still at start" field. */
function starterStates(): CarState[] {
  return [starterState('player'), starterState('ai-0')];
}
function starterState(id: string): CarState {
  return carAt(id, 0, [0, 0, 40], 0);
}

/** Advance a director out of Countdown into Racing. */
function go(race: RaceDirector): void {
  let remaining = race.getState().countdown;
  while (remaining > 1e-9) {
    race.update(remaining, starterStates());
    remaining = race.getState().countdown;
  }
  race.update(0, [starterState('player'), starterState('ai-0')]);
  expect(race.getState().phase).toBe(RacePhase.Racing);
}