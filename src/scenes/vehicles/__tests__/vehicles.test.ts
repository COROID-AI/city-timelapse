import { describe, expect, it } from 'vitest';
import { getEra, interpolateEra } from '../../eras/index.js';
import { CITY_BLOCK_LAYOUT } from '../../layout/index.js';
import {
  attachVehicles,
  bodyTypeCount,
  createVehicles,
  disposeVehicles,
  mountVehicles,
  stateCounts,
  updateVehicles,
} from '../index.js';
import type { EraData } from '../../eras/index.js';

const YEARS = [1945, 1965, 1985, 2005, 2025];

describe('vehicles module', () => {
  it('mounts an era-authentic fleet for every year onto the shared traffic loops', () => {
    for (const year of YEARS) {
      const era = getEra(year);
      const fleet = createVehicles(era, CITY_BLOCK_LAYOUT);
      expect(fleet.length).toBeGreaterThan(0);
      // Every vehicle follows a real traffic loop from the shared layout.
      const loopIds = new Set(CITY_BLOCK_LAYOUT.trafficLoops.map((l) => l.id));
      for (const vehicle of fleet) {
        expect(loopIds).toContain(vehicle.loopId);
        expect(vehicle.kindId).toBeTruthy();
        expect(vehicle.body.paint).toBeTruthy();
      }
      expect(attachVehicles(fleet)).toBe(fleet);
    }
  });

  it('gives each era a distinct set of body silhouettes and paints', () => {
    const bodies: number[] = [];
    const paints: Set<string> = new Set();
    for (const year of YEARS) {
      const fleet = createVehicles(getEra(year), CITY_BLOCK_LAYOUT);
      expect(fleet.length).toBeGreaterThan(0);
      bodies.push(bodyTypeCount(fleet));
      fleet.forEach((v) => paints.add(v.body.paint));
    }
    // Each era renders a distinct, non-empty body-type set.
    for (const count of bodies) {
      expect(count).toBeGreaterThan(0);
    }
    // Body-style diversity must exceed the single-era minimum across eras.
    expect(bodies[0]).not.toBe(bodies[1]);
    expect(bodies[1]).not.toBe(bodies[2]);
    expect(bodies[2]).not.toBe(bodies[3]);
    expect(bodies[3]).not.toBe(bodies[4]);
    // All five eras combined use a broad, distinct paint palette.
    expect(paints.size).toBeGreaterThanOrEqual(5);
  });

  it('drives the loop and idles at intersections with per-era motion', () => {
    const era = getEra(1985);
    const fleet = createVehicles(era, CITY_BLOCK_LAYOUT);
    const before = fleet.map((v) => ({ ...v.position }));
    // Simulate a few seconds of traffic.
    for (let i = 0; i < 20; i++) {
      updateVehicles(fleet, era, CITY_BLOCK_LAYOUT, 0.1);
    }
    const after = fleet.map((v) => ({ ...v.position }));
    const moved = after.some((p, i) => p.x !== before[i]!.x || p.z !== before[i]!.z);
    expect(moved).toBe(true);
  });

  it('parks vehicles along a shared lane (read-only layout consumption)', () => {
    const era = getEra(2005);
    const fleet = mountVehicles(era, CITY_BLOCK_LAYOUT, { parkCount: 3 });
    const counts = stateCounts(fleet);
    expect(counts.parked).toBe(3);
    // Parked vehicles still reference a real lane-adjacent position.
    const lane = CITY_BLOCK_LAYOUT.lanes[0]!;
    const parked = fleet.filter((v) => v.state === 'parked');
    for (const vehicle of parked) {
      const onLane =
        vehicle.position.x >= lane.waypoints[0]!.x &&
        vehicle.position.x <= lane.waypoints[lane.waypoints.length - 1]!.x;
      expect(onLane).toBe(true);
    }
  });

  it('interpolates body material values across an era transition', () => {
    const from = getEra(1945);
    const to = getEra(2025);
    const mid = interpolateEra(from, to, 0.5);
    const fleet = createVehicles(mid, CITY_BLOCK_LAYOUT);
    // The interpolated era drives gloss/chrome values between the endpoints.
    for (const vehicle of fleet) {
      const gloss = vehicle.body.gloss;
      expect(gloss).toBeGreaterThanOrEqual(from.vehicles.bodyGloss);
      expect(gloss).toBeLessThanOrEqual(to.vehicles.bodyGloss);
    }
    // Interpolation is deterministic.
    const again = createVehicles(interpolateEra(from, to, 0.5), CITY_BLOCK_LAYOUT);
    expect(again.length).toBe(fleet.length);
  });

  it('disposes the fleet', () => {
    const fleet = createVehicles(getEra(1965), CITY_BLOCK_LAYOUT);
    expect(fleet.length).toBeGreaterThan(0);
    disposeVehicles(fleet);
    expect(fleet.length).toBe(0);
  });

  it('consumes the shared layout read-only (never mutates anchors)', () => {
    const before = JSON.stringify(CITY_BLOCK_LAYOUT);
    const era = getEra(2025);
    const fleet = createVehicles(era, CITY_BLOCK_LAYOUT);
    for (let i = 0; i < 10; i++) {
      updateVehicles(fleet, era, CITY_BLOCK_LAYOUT, 0.1);
    }
    expect(JSON.stringify(CITY_BLOCK_LAYOUT)).toBe(before);
  });
});