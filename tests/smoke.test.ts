/**
 * Smoke test: proves the Jest + ts-jest harness actually runs and can
 * type-check/execute real TypeScript from the shared contracts module.
 */

import {
  NitrousState,
  RacePhase,
  RaceState,
  TrackPath,
} from '../src/shared/types';

describe('neon-racer foundation harness', () => {
  it('runs TypeScript through ts-jest', () => {
    // Force real TS syntax through the transformer (enums + type imports).
    expect(typeof RacePhase).toBe('object');
    expect(RacePhase.Racing).toBe('racing');
  });

  it('exposes the shared race-domain contracts', () => {
    const nitrous: NitrousState = {
      active: false,
      reserve: 1,
      boost: 1,
      cooldown: 0,
    };
    const path: TrackPath = {
      points: [
        [0, 0, 0],
        [0, 0, -10],
      ],
      loop: true,
    };
    const race: RaceState = {
      phase: RacePhase.PreRace,
      timeMs: 0,
      cars: {
        hero: {
          id: 'hero',
          position: [0, 0, 0],
          yaw: 0,
          speed: 0,
          lap: 0,
          waypointIndex: 0,
        },
      },
      standings: [],
    };

    expect(nitrous.reserve).toBe(1);
    expect(path.loop).toBe(true);
    expect(race.phase).toBe(RacePhase.PreRace);
    expect(race.cars['hero']?.speed).toBe(0);
  });
});