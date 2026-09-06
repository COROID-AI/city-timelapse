import { describe, expect, it } from 'vitest';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';
import type { EraLayout } from '../../types';
import { createSimulation, pedestrianPosition } from '../pedestrians';
import { ERA_PROFILES, type SimulationProviders } from '../profiles';

/** A layout derived from the shared frozen constants. */
const layout: EraLayout = {
  block: BLOCK,
  street: STREET,
  sidewalk: SIDEWALK,
  curb: CURB,
  cameraAnchors: [],
};

/** In-memory providers that build era-labelled stub meshes. */
const makeProviders = (): SimulationProviders => {
  const pedestrian = new Map<string, { build: () => unknown; dispose: () => void }>();
  const vehicle = new Map<string, { build: () => unknown; dispose: () => void }>();
  for (const profile of ERA_PROFILES) {
    pedestrian.set(profile.pedestrianProviderId, {
      build: () => ({ kind: 'ped', era: profile.era }),
      dispose: () => {},
    });
    vehicle.set(profile.vehicleProviderId, {
      build: () => ({ kind: 'veh', era: profile.era }),
      dispose: () => {},
    });
  }
  return { pedestrian, vehicle };
};

describe('sim composition', () => {
  it('composes pedestrians + vehicles + profiles across all five eras', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());

    for (const era of ['1945', '1965', '1985', '2005', '2025']) {
      sim.setProfile(era);
      const snap = sim.snapshot();
      expect(snap.pedestrians.length).toBeGreaterThanOrEqual(8);
      expect(snap.vehicles.length).toBeGreaterThanOrEqual(3);
      // Era mesh providers are attached to agents.
      expect(snap.pedestrians[0].mesh).toEqual({ kind: 'ped', era });
      expect(snap.vehicles[0].mesh).toEqual({ kind: 'veh', era });
    }
  });

  it('switching profile changes counts, speeds and mesh providers without changing sim internals', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());

    sim.setProfile('1945');
    const a = sim.snapshot();
    const countsA = { p: a.pedestrians.length, v: a.vehicles.length };
    const speedsA = {
      p: a.pedestrians[0].maxSpeed,
      v: a.vehicles[0].maxSpeed,
    };
    const meshesA = { p: a.pedestrians[0].mesh, v: a.vehicles[0].mesh };

    sim.setProfile('2025');
    const b = sim.snapshot();
    expect(b.pedestrians.length).toBeGreaterThan(countsA.p);
    expect(b.vehicles.length).toBeGreaterThan(countsA.v);
    expect(b.pedestrians[0].maxSpeed).toBeGreaterThan(speedsA.p);
    expect(b.vehicles[0].maxSpeed).toBeGreaterThan(speedsA.v);
    expect(b.pedestrians[0].mesh).not.toEqual(meshesA.p);
    expect(b.vehicles[0].mesh).not.toEqual(meshesA.v);
  });

  it('waypoint+avoidance and lane+stop-and-go behaviours mutate positions per tick', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());
    sim.setProfile('1985');

    const before = sim.snapshot();
    const pedBefore = before.pedestrians.map((p) => ({ x: p.travelled, i: p.waypointIndex }));
    const vehBefore = before.vehicles.map((v) => v.positionOnLoop);

    sim.update(0.5, null);

    const after = sim.snapshot();
    const pedMoved = after.pedestrians.some((p, i) => p.travelled !== pedBefore[i].x || p.waypointIndex !== pedBefore[i].i);
    const vehMoved = after.vehicles.some((v, i) => v.positionOnLoop !== vehBefore[i]);
    expect(pedMoved).toBe(true);
    expect(vehMoved).toBe(true);
  });

  it('agents avoid the first-person camera position', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());
    sim.setProfile('2025');

    const snap = sim.snapshot();
    const wps = snap.pedestrianWaypoints;
    const first = snap.pedestrians[0];
    // Place the camera ahead of the agent along the sidewalk ring, between the
    // agent's current waypoint and the next one.
    const a = wps[first.waypointIndex].position;
    const b = wps[(first.waypointIndex + 1) % wps.length].position;
    const cameraPos = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

    const START_DIST = Math.hypot(a.x - cameraPos.x, a.z - cameraPos.z);
    expect(START_DIST).toBeGreaterThan(0);

    // The agent must never pass through the camera: it may approach and stop,
    // but its distance to the camera never drops below a small hard-stop radius.
    let minDist = Infinity;
    for (let i = 0; i < 600; i++) {
      const s = sim.snapshot();
      const p = pedestrianPosition(s.pedestrians[0], s.pedestrianWaypoints);
      const dist = Math.hypot(cameraPos.x - p.x, cameraPos.z - p.z);
      minDist = Math.min(minDist, dist);
      sim.update(0.05, cameraPos);
    }
    // The agent stops approaching before reaching the camera's hard-stop radius
    // (0.5), so it never passes through the first-person camera.
    expect(minDist).toBeGreaterThanOrEqual(0.4);
  });
});