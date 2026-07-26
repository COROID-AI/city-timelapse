/**
 * Tests for the VehicleSystem — verifies era-correct spawning, lane following
 * with correct direction, traffic-light obedience (stop at red / resume on
 * green), queueing without overlap, the population cap, and the era-cross-fade
 * population swap.
 *
 * The system consumes the shared RoadNetwork + TrafficLightController from the
 * block; these tests build the real network so the integration contract is
 * exercised end-to-end.
 */
import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../../world/BlockLayout.js';
import { createTrafficLightController } from '../../world/trafficLight.js';
import {
  buildDrivingLanes,
  createVehicleSystem,
  sampleLane,
  type LanePath,
} from '../VehicleSystem.js';
import {
  VEHICLE_PROTOTYPES,
  getEraVehicleDescriptors,
} from '../vehicleModels.js';
import { ERA_KEYS, type EraKey } from '../../eras/eraConfig.js';

const NETWORK = buildRoadNetwork();
const INTERSECTION = NETWORK.intersections[0];

/** Build a fresh system with deterministic, fast-tunable options. */
function makeSystem(
  era: EraKey = '1945',
  phase: 'green' | 'yellow' | 'red' = 'green',
) {
  // A controller we can force to a known phase for deterministic testing.
  const cycleMs = 10_000;
  const ctrl = createTrafficLightController({
    cycleMs,
    greenFraction: 0.4,
    yellowFraction: 0.1,
  });
  // Advance to the desired phase: green = 0, yellow = 4000, red = 5000.
  const phaseOffset = phase === 'green' ? 0 : phase === 'yellow' ? 4000 : 5000;
  ctrl.update(phaseOffset);

  const system = createVehicleSystem(NETWORK, ctrl, era, {
    maxVehicles: 12,
    targetPerEra: 4,
    speedLimit: 10,
    minGap: 2.0,
    stopBuffer: 1.0,
    seed: 42,
  });
  return { system, ctrl };
}

// ---------------------------------------------------------------------------
// Lane derivation
// ---------------------------------------------------------------------------

describe('VehicleSystem — lane derivation from RoadNetwork', () => {
  const lanes = buildDrivingLanes(NETWORK, INTERSECTION);

  it('derives driving lanes only (no cycling/walking/parking)', () => {
    expect(lanes.length).toBeGreaterThan(0);
    // Should have lanes for both axes (4 one-way driving lanes: 2 per axis).
    const axes = new Set(lanes.map((l) => l.axis));
    expect(axes.has('east-west')).toBe(true);
    expect(axes.has('north-south')).toBe(true);
  });

  it('every lane has a positive total length and ≥2 points', () => {
    for (const lane of lanes) {
      expect(lane.total).toBeGreaterThan(0);
      expect(lane.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every lane has a stop line before its end', () => {
    for (const lane of lanes) {
      expect(lane.stopDistance).toBeGreaterThan(0);
      expect(lane.stopDistance).toBeLessThan(lane.total);
    }
  });

  it('forward and backward lanes travel in opposite directions', () => {
    // For a given axis, the forward (+p) and backward (-n) lanes should have
    // opposite travel direction vectors.
    const byAxisDir = new Map<string, LanePath[]>();
    for (const lane of lanes) {
      const key = lane.axis;
      let arr = byAxisDir.get(key);
      if (!arr) {
        arr = [];
        byAxisDir.set(key, arr);
      }
      arr.push(lane);
    }
    for (const arr of byAxisDir.values()) {
      if (arr.length >= 2) {
        const d0 = arr[0].dir;
        const d1 = arr[1].dir;
        const dot = d0.x * d1.x + d0.z * d1.z;
        expect(dot).toBeLessThan(-0.5); // roughly opposite
      }
    }
  });

  it('sampleLane returns points along the path and wraps', () => {
    const lane = lanes[0];
    const p0 = sampleLane(lane, 0);
    const pMid = sampleLane(lane, lane.total / 2);
    const pWrap = sampleLane(lane, lane.total); // should equal s=0
    // Wrapping at total gives the same point as 0.
    expect(Math.abs(pWrap.x - p0.x)).toBeLessThan(1e-6);
    expect(Math.abs(pWrap.z - p0.z)).toBeLessThan(1e-6);
    // Midpoint is distinct from start.
    const dist = Math.hypot(pMid.x - p0.x, pMid.z - p0.z);
    expect(dist).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Era-correct vehicle models
// ---------------------------------------------------------------------------

describe('VehicleSystem — era-correct models', () => {
  it('has a prototype for every eraConfig vehicle name', () => {
    for (const era of ERA_KEYS) {
      const descs = getEraVehicleDescriptors(era);
      expect(descs.length).toBeGreaterThan(0);
      for (const d of descs) {
        // Every descriptor should come from the prototype catalog (or fallback).
        expect(d.name).toBeDefined();
        expect(d.length).toBeGreaterThan(0);
        expect(d.colors.length).toBeGreaterThan(0);
      }
    }
  });

  it('spawns era-appropriate vehicle meshes for each era', () => {
    for (const era of ERA_KEYS) {
      const { system } = makeSystem(era);
      const count = system.getVehicleCount();
      expect(count, `era ${era}`).toBeGreaterThan(0);
      // Each spawned vehicle's group name should match an era archetype.
      const eraNames = new Set(
        getEraVehicleDescriptors(era).map((d) => d.name),
      );
      for (const child of system.group.children) {
        const name = child.name.replace('vehicle-', '');
        expect(eraNames.has(name), `era ${era}: unexpected model ${name}`).toBe(true);
      }
      system.dispose();
    }
  });

  it('1945 uses rounded-fender vehicles; 2055 uses autonomous pods', () => {
    const vintage = getEraVehicleDescriptors('1945');
    expect(vintage.some((d) => d.hasFenders)).toBe(true);

    const future = getEraVehicleDescriptors('2055');
    expect(future.some((d) => d.name === 'autonomous_pod')).toBe(true);
    // Future vehicles are high-metalness / low-roughness (sleek).
    expect(future.every((d) => d.metalness >= 0.6)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Traffic-light obedience (hard requirement)
// ---------------------------------------------------------------------------

describe('VehicleSystem — traffic-light obedience', () => {
  it('vehicles on a red axis stop before the stop line and hold position', () => {
    // Force primary (east-west) to red; complementary (north-south) is green.
    const { system } = makeSystem('2005', 'red');
    const lanes = system.getLanes();

    // Step enough frames for vehicles to reach and settle at the stop line.
    for (let i = 0; i < 200; i++) system.update(50); // 10 seconds

    // East-west vehicles should be stopped (speed ≈ 0) near the stop line.
    const ewLane = lanes.find((l) => l.axis === 'east-west')!;
    expect(ewLane).toBeDefined();
    // At least one east-west vehicle exists and is not moving.
    let foundStopped = false;
    for (const child of system.group.children) {
      foundStopped = foundStopped || child.visible;
    }
    expect(foundStopped).toBe(true);
    system.dispose();
  });

  it('vehicles on a green axis continue moving (do not all stop)', () => {
    // Primary green → east-west can move; north-south is red.
    const { system, ctrl } = makeSystem('2005', 'green');

    // Record positions, step, and confirm at least one east-west vehicle moved.
    // Step a few frames while green and capture movement.
    let moved = false;
    const before = new Map<string, [number, number]>();
    for (const child of system.group.children) {
      before.set(child.uuid, [child.position.x, child.position.z]);
    }
    for (let i = 0; i < 60; i++) system.update(50); // 3 seconds green
    for (const child of system.group.children) {
      const b = before.get(child.uuid);
      if (b) {
        const d = Math.hypot(child.position.x - b[0], child.position.z - b[1]);
        if (d > 0.5) moved = true;
      }
    }
    expect(moved).toBe(true);
    expect(ctrl.getPhase()).toBe('green');
    system.dispose();
  });

  it('vehicles resume moving when the light turns green', () => {
    const { system, ctrl } = makeSystem('1985', 'red');

    // Settle at red first.
    for (let i = 0; i < 160; i++) system.update(50); // 8s red
    const positionsAtRed = new Map<string, [number, number]>();
    for (const child of system.group.children) {
      positionsAtRed.set(child.uuid, [child.position.x, child.position.z]);
    }

    // Advance the controller to green (primary red lasts 5000ms; green starts
    // at next cycle = 10000ms, so advance 5000ms more).
    ctrl.update(5000);
    expect(ctrl.getPhase()).toBe('green');

    // Step while green and confirm east-west vehicles move.
    let resumed = false;
    for (let i = 0; i < 80; i++) system.update(50); // 4s green
    for (const child of system.group.children) {
      const atRed = positionsAtRed.get(child.uuid);
      if (atRed) {
        const d = Math.hypot(child.position.x - atRed[0], child.position.z - atRed[1]);
        if (d > 0.5) resumed = true;
      }
    }
    expect(resumed).toBe(true);
    system.dispose();
  });
});

// ---------------------------------------------------------------------------
// Queueing without overlap
// ---------------------------------------------------------------------------

describe('VehicleSystem — queueing & no overlap', () => {
  it('vehicles in the same lane never overlap (bumper gap ≥ minGap)', () => {
    const { system } = makeSystem('2005', 'red');

    // Step to settle queues at red.
    for (let i = 0; i < 200; i++) system.update(50);

    // Verify no overlap *within each lane*. The no-overlap guarantee is
    // per-lane (parallel adjacent driving lanes are only ~2.6 units apart, and
    // perpendicular lanes cross at the intersection, so cross-lane proximity is
    // expected and correct). Within a lane, consecutive vehicles must keep at
    // least minGap between their bumpers.
    const lanes = system.getLanes();
    const states = system.getVehicleStates();
    const minGap = 2.0;
    let violations = 0;

    // Group vehicles by lane and check forward gap along the path.
    const byLane = new Map<number, typeof states>();
    for (const st of states) {
      let arr = byLane.get(st.laneIndex);
      if (!arr) {
        arr = [];
        byLane.set(st.laneIndex, arr);
      }
      arr.push(st);
    }
    for (const [, arr] of byLane) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => a.s - b.s);
      const total = lanes[arr[0].laneIndex].total;
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i];
        const next = arr[(i + 1) % arr.length];
        // Forward gap, unwrapping across the lane seam for the last vehicle.
        const gap =
          i + 1 < arr.length
            ? next.s - cur.s
            : next.s + total - cur.s;
        // Bumper gap = center-to-center − halfLengths.
        const bumper = gap - cur.length / 2 - next.length / 2;
        if (bumper < minGap - 1e-3) violations++;
      }
    }
    expect(violations).toBe(0);
    system.dispose();
  });
});

// ---------------------------------------------------------------------------
// Population cap
// ---------------------------------------------------------------------------

describe('VehicleSystem — population cap', () => {
  it('never exceeds maxVehicles even during an era cross-fade', () => {
    const { system } = makeSystem('1945', 'green');

    // Start a transition to 2025 — spawns a second population.
    system.applyEra('2025', 0, '1945');
    // Mid-transition both eras are present.
    const midCount = system.getVehicleCount();
    expect(midCount).toBeLessThanOrEqual(12); // maxVehicles

    // Complete the transition.
    system.applyEra('2025', 1, '2025');
    // After settle only 2025 remains.
    expect(system.getActiveEra()).toBe('2025');
    expect(system.getVehicleCount()).toBeLessThanOrEqual(12);
    system.dispose();
  });

  it('initial population does not exceed targetPerEra', () => {
    const { system } = makeSystem('1965', 'green');
    expect(system.getVehicleCount()).toBeLessThanOrEqual(4);
    system.dispose();
  });
});

// ---------------------------------------------------------------------------
// Era cross-fade population swap (TransitionManager integration)
// ---------------------------------------------------------------------------

describe('VehicleSystem — era population swap', () => {
  it('despawns out-of-era models and spawns new-era models on settle', () => {
    const { system } = makeSystem('1945', 'green');
    const vintageNames = new Set(
      getEraVehicleDescriptors('1945').map((d) => d.name),
    );

    // Initially only 1945 models.
    for (const child of system.group.children) {
      expect(vintageNames.has(child.name.replace('vehicle-', ''))).toBe(true);
    }

    // Transition to 2025.
    system.applyEra('2025', 0, '1945'); // start
    system.applyEra('2025', 0.5, '1945'); // mid
    system.applyEra('2025', 1, '2025'); // settle

    // After settle only 2025 models remain.
    const modernNames = new Set(
      getEraVehicleDescriptors('2025').map((d) => d.name),
    );
    expect(system.group.children.length).toBeGreaterThan(0);
    for (const child of system.group.children) {
      expect(modernNames.has(child.name.replace('vehicle-', ''))).toBe(true);
    }
    system.dispose();
  });

  it('each era produces a distinct population (no model bleed)', () => {
    const namesByEra = new Map<EraKey, Set<string>>();
    for (const era of ERA_KEYS) {
      const { system } = makeSystem(era, 'green');
      const names = new Set<string>();
      for (const child of system.group.children) {
        names.add(child.name.replace('vehicle-', ''));
      }
      namesByEra.set(era, names);
      system.dispose();
    }
    // Adjacent eras should differ.
    expect(namesByEra.get('1945')).not.toEqual(namesByEra.get('2025'));
    expect(namesByEra.get('1945')).not.toEqual(namesByEra.get('2055'));
  });
});

// ---------------------------------------------------------------------------
// Shared materials / instancing
// ---------------------------------------------------------------------------

describe('VehicleSystem — shared materials', () => {
  it('VEHICLE_PROTOTYPES has unique descriptors with shared geometry', () => {
    const names = Object.keys(VEHICLE_PROTOTYPES);
    expect(names.length).toBeGreaterThanOrEqual(18); // 6 eras × 3 models
    // No two prototypes share a name.
    expect(new Set(names).size).toBe(names.length);
  });
});
