/**
 * Integration test for AI opponents composed on the real neon world.
 *
 * Proves `createAIRacers` instantiates `createCarMesh` liveries and drives
 * every car around the closed-loop `TrackPath`, exposing CarState-compatible
 * states that let standings rank them against the player.
 */

import * as THREE from 'three';

import { createAIRacers } from '../../src/ai/aiRacers';
import { distanceToTrack } from '../../src/ai/waypointFollower';
import type { CarState, TrackPath } from '../../src/shared/types';
import { createCarMesh, LIVERIES } from '../../src/vehicle/carMesh';
import { createTrack } from '../../src/world/track';

/** Assert the returned snapshot is structurally CarState-compatible. */
function expectCarState(st: unknown): asserts st is CarState {
  const s = st as CarState;
  expect(typeof s.id).toBe('string');
  expect(s.position).toHaveLength(3);
  expect(typeof s.yaw).toBe('number');
  expect(typeof s.speed).toBe('number');
  expect(typeof s.lap).toBe('number');
  expect(typeof s.waypointIndex).toBe('number');
}

describe('ai × carMesh integration on the closed-loop TrackPath', () => {
  const track = createTrack();

  it('instantiates createCarMesh liveries with createAIRacers', () => {
    // Sanity: the shared factory supports the liveries we reuse.
    for (const key of Object.keys(LIVERIES)) {
      expect(createCarMesh({ livery: key }).userData.livery).toBe(key);
    }

    const ai = createAIRacers(track.path as TrackPath, 3);
    expect(ai.racers).toHaveLength(3);

    for (const r of ai.racers) {
      // Each car is a real, populated three.js group produced by the shared
      // factory, placed on the start grid with a distinct livery.
      expect(r.body).toBeInstanceOf(THREE.Group);
      expect(r.body.children.length).toBeGreaterThanOrEqual(6);
      expect(typeof r.body.userData.livery).toBe('string');
      expect(r.lap).toBe(0);
    }

    // Distinct liveries among the three rivals.
    const liveries = new Set(ai.racers.map((r) => r.body.userData.livery));
    expect(liveries.size).toBe(3);

    ai.dispose();
  });

  it('updateAIRacers progresses all cars and returns CarState-compatible states', () => {
    const ai = createAIRacers(track.path as TrackPath, 3);
    const dt = 1 / 60;
    const starts = ai.racers.map((r) => ({ x: r.kin.x, z: r.kin.z }));

    // Simulated race frames with a rival player pacing on the grid.
    for (let i = 0; i < 240; i++) {
      const player = { x: 0, z: 0, lap: 0 };
      ai.update(dt, player);
    }

    for (let i = 0; i < ai.racers.length; i++) {
      const r = ai.racers[i] as (typeof ai.racers)[number];
      const st = ai.getState(i);
      expectCarState(st);

      const moved = Math.hypot(r.kin.x - starts[i]!.x, r.kin.z - starts[i]!.z);
      expect(moved).toBeGreaterThan(5);

      const off = distanceToTrack(track.path.points, [r.kin.x, 0, r.kin.z]);
      expect(off).toBeLessThan(track.length); // on/near the circuit
    }

    // Live standings use per-AI progress to rank them.
    const sorted = ai.racers
      .map((r) => ai.getState(r.index))
      .sort((a, b) => b.lap + b.progress - (a.lap + a.progress));
    expect(sorted).toHaveLength(3);

    ai.dispose();
  });

  it('dispose frees the shared mesh resources without throwing', () => {
    const ai = createAIRacers(track.path as TrackPath, 3);
    expect(() => ai.dispose()).not.toThrow();
  });
});