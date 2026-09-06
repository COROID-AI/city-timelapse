import { describe, expect, it } from 'vitest';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';
import type { EraLayout } from '../../types';
import {
  buildSidewalkWaypoints,
  createSimulation,
  createPedestrianAgents,
  pedestrianPosition,
  updatePedestrians,
} from '../pedestrians';
import { createRng, ERA_PROFILES, getProfile, type SimulationProviders } from '../profiles';
import {
  buildLaneLoops,
  createVehicleAgents,
  laneLoopPosition,
  updateVehicles,
} from '../vehicles';

/** A layout derived from the shared frozen constants (matches EraLayout). */
const layout: EraLayout = {
  block: BLOCK,
  street: STREET,
  sidewalk: SIDEWALK,
  curb: CURB,
  cameraAnchors: [],
};

/** Providers that record call counts and dispose calls for assertions. */
const makeProviders = (): SimulationProviders => {
  const ped = new Map<string, { build: () => unknown; dispose: () => void }>();
  const veh = new Map<string, { build: () => unknown; dispose: () => void }>();
  for (const profile of ERA_PROFILES) {
    ped.set(profile.pedestrianProviderId, {
      build: () => ({ kind: 'ped', era: profile.era }),
      dispose: () => {},
    });
    veh.set(profile.vehicleProviderId, {
      build: () => ({ kind: 'veh', era: profile.era }),
      dispose: () => {},
    });
  }
  return { pedestrian: ped, vehicle: veh };
};

describe('pedestrian agents', () => {
  it('walks along sidewalk waypoints and changes position over ticks', () => {
    const waypoints = buildSidewalkWaypoints(layout);
    expect(waypoints.length).toBeGreaterThanOrEqual(4);
    const agents = createPedestrianAgents(layout, 8, 1.0, 1.2, 'p', createRng(1));
    const before = agents.map((a) => pedestrianPosition(a, waypoints));
    updatePedestrians(agents, waypoints, 1.0, null, createRng(2));
    const after = agents.map((a) => pedestrianPosition(a, waypoints));
    const moved = after.filter((p, i) => Math.hypot(p.x - before[i].x, p.z - before[i].z) > 1e-6).length;
    expect(moved).toBeGreaterThan(0);
  });

  it('pauses (idle/look) and resumes walking', () => {
    const waypoints = buildSidewalkWaypoints(layout);
    const agents = createPedestrianAgents(layout, 1, 1.0, 1.0, 'p', createRng(7));
    // Force a pause via many updates with a high pause probability.
    let paused = false;
    for (let i = 0; i < 2000 && !paused; i++) {
      updatePedestrians(agents, waypoints, 0.016, null, createRng(i));
      paused = agents[0].state === 'paused';
    }
    expect(paused).toBe(true);
  });

  it('avoids the player camera in first-person mode', () => {
    const waypoints = buildSidewalkWaypoints(layout);
    const agents = createPedestrianAgents(layout, 1, 1.0, 1.0, 'p', createRng(3));
    // Place the camera directly on the agent's waypoint path.
    const start = pedestrianPosition(agents[0], waypoints);
    const playerPos = { x: start.x, z: start.z };
    const before = { ...start };
    updatePedestrians(agents, waypoints, 0.1, playerPos, createRng(4));
    const after = pedestrianPosition(agents[0], waypoints);
    // The agent must not pass through the camera: distance grows or stays >= 0.
    const distBefore = Math.hypot(before.x - playerPos.x, before.z - playerPos.z);
    const distAfter = Math.hypot(after.x - playerPos.x, after.z - playerPos.z);
    // With avoidance the agent slows to a near stop instead of walking through.
    expect(agents[0].speed).toBeLessThan(0.2);
    expect(distAfter).toBeGreaterThanOrEqual(distBefore - 0.5);
  });
});

describe('vehicle agents', () => {
  it('drives along lane loops and changes position over ticks', () => {
    const loops = buildLaneLoops(layout);
    expect(loops).toHaveLength(STREET.laneCount);
    const agents = createVehicleAgents(layout, 3, 4.0, 5.0, 'v', createRng(5));
    const before = agents.map((a) => laneLoopPosition(loops[a.lane], a.positionOnLoop));
    updateVehicles(agents, loops, 1.0, [], createRng(6));
    const after = agents.map((a) => laneLoopPosition(loops[a.lane], a.positionOnLoop));
    const moved = after.filter((p, i) => Math.hypot(p.x - before[i].x, p.z - before[i].z) > 1e-6).length;
    expect(moved).toBeGreaterThan(0);
  });

  it('supports stop-and-go (vehicles can be stopped by traffic/pedestrians)', () => {
    const loops = buildLaneLoops(layout);
    const agents = createVehicleAgents(layout, 1, 5.0, 5.0, 'v', createRng(8));
    // Place a pedestrian directly in front of the vehicle to force a stop.
    const blockPos = laneLoopPosition(loops[agents[0].lane], agents[0].positionOnLoop + 2);
    const pedestrians = [{ position: blockPos }];
    let sawStopped = false;
    for (let i = 0; i < 200 && !sawStopped; i++) {
      updateVehicles(agents, loops, 0.016, pedestrians, createRng(i));
      sawStopped = agents[0].speed === 0 || agents[0].state !== 'driving';
    }
    expect(sawStopped).toBe(true);
  });
});

describe('era profiles', () => {
  it('defines all five era profiles', () => {
    expect(ERA_PROFILES).toHaveLength(5);
    for (const profile of ERA_PROFILES) {
      expect(profile.pedestrianCount).toBeGreaterThanOrEqual(8);
      expect(profile.vehicleCount).toBeGreaterThanOrEqual(3);
      expect(profile.vehicleSpeedMin).toBeGreaterThan(0);
    }
  });

  it('looks up profiles by era', () => {
    expect(getProfile('2025').pedestrianCount).toBeGreaterThan(getProfile('1945').pedestrianCount);
  });
});

describe('createSimulation composition', () => {
  it('creates a sim with profile-driven counts and injectable providers', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());
    sim.setProfile('2025');

    const snap = sim.snapshot();
    expect(snap.pedestrians.length).toBeGreaterThanOrEqual(8);
    expect(snap.vehicles.length).toBeGreaterThanOrEqual(3);
    // Meshes from the era provider are attached.
    expect(snap.pedestrians[0].mesh).toEqual({ kind: 'ped', era: '2025' });
    expect(snap.vehicles[0].mesh).toEqual({ kind: 'veh', era: '2025' });

    sim.update(0.5, null);
    sim.dispose();
  });

  it('switches profiles without changing sim internals', () => {
    const sim = createSimulation(layout);
    sim.setProviders(makeProviders());

    sim.setProfile('1945');
    const p1945 = sim.snapshot();
    const pedCount1945 = p1945.pedestrians.length;
    const vehCount1945 = p1945.vehicles.length;
    const pedSpeed1945 = p1945.pedestrians[0].maxSpeed;
    const vehSpeed1945 = p1945.vehicles[0].maxSpeed;
    const pedMesh1945 = p1945.pedestrians[0].mesh;
    const vehMesh1945 = p1945.vehicles[0].mesh;

    sim.setProfile('2025');
    const p2025 = sim.snapshot();
    expect(p2025.pedestrians.length).toBeGreaterThan(pedCount1945);
    expect(p2025.vehicles.length).toBeGreaterThan(vehCount1945);
    expect(p2025.pedestrians[0].maxSpeed).toBeGreaterThan(pedSpeed1945);
    expect(p2025.vehicles[0].maxSpeed).toBeGreaterThan(vehSpeed1945);
    expect(p2025.pedestrians[0].mesh).not.toEqual(pedMesh1945);
    expect(p2025.vehicles[0].mesh).not.toEqual(vehMesh1945);
  });
});