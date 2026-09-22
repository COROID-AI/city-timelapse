/**
 * Automobile fleet and traffic tests.
 *
 * Covers the acceptance criteria end to end against the real modules:
 * - era-true fleet rosters across all five years;
 * - canonical lane slots, right-hand traffic loops, intersection control,
 *   car-following, wheel rotation, head/tail/brake lights, and curbside
 *   parking with no collisions and no cars outside lanes;
 * - `EraTransformable` registration and smooth variant swaps mid-motion;
 * - pickable descriptors (streetcar, robotaxi) and audio hook events;
 * - composition with the real era transform registry and the real
 *   procedural gfx material library.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEraMorphSystem, type EraMorphSystem } from '../../era/contracts';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import {
  createVehiclesModule,
  VEHICLE_KINDS,
  ERA_FLEETS,
  fleetKindForSlot,
  laneCenterAcross,
  laneCenterWorld,
  isRightHandLane,
  travelDirection,
  acrossToOffset,
  buildStreetLoop,
  buildStreetcarPath,
  desiredFollowingSpeed,
  desiredApproachSpeed,
  STREET_WIDTH,
  LANE_CENTERS,
  CURB_PARKING_WIDTH,
  PARKING_LANE_CENTERS,
  ROAD_SURFACE_Y,
  RAIL_CENTER_ACROSS,
  MOVING_CARS_PER_LOOP,
  PARKED_PER_SIDE,
  type VehiclesModule,
  type TrafficFleetSystem,
  type VehicleKindId,
  type FleetEra,
  type VehicleAudioHookEvent,
} from './index';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const DT = 1 / 60;

interface Fixture {
  era: EraMorphSystem;
  module: VehiclesModule;
  parent: THREE.Group;
}

function makeFixture(): Fixture {
  const era = createEraMorphSystem();
  const parent = new THREE.Group();
  const module = createVehiclesModule({
    registry: era.registry,
    parent,
    initialBlend: era.core.frame().blend,
  });
  return { era, module, parent };
}

interface Box2 {
  x: number;
  z: number;
  yaw: number;
  halfW: number;
  halfL: number;
}

/** Oriented-box overlap depth via 2D SAT (0 = separated). */
function overlapDepth(a: Box2, b: Box2): number {
  // Local forward is +Z rotated by yaw about Y: world (sin, cos).
  const frame = (
    box: Box2,
  ): { length: [number, number]; width: [number, number] } => ({
    length: [Math.sin(box.yaw), Math.cos(box.yaw)],
    width: [Math.cos(box.yaw), -Math.sin(box.yaw)],
  });
  const fa = frame(a);
  const fb = frame(b);
  const axes: Array<[number, number]> = [fa.length, fa.width, fb.length, fb.width];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let minPenetration = Infinity;
  for (const [ax, az] of axes) {
    const radiusA =
      a.halfL * Math.abs(fa.length[0] * ax + fa.length[1] * az) +
      a.halfW * Math.abs(fa.width[0] * ax + fa.width[1] * az);
    const radiusB =
      b.halfL * Math.abs(fb.length[0] * ax + fb.length[1] * az) +
      b.halfW * Math.abs(fb.width[0] * ax + fb.width[1] * az);
    const distance = Math.abs(dx * ax + dz * az);
    const penetration = radiusA + radiusB - distance;
    if (penetration <= 0) return 0;
    if (penetration < minPenetration) minPenetration = penetration;
  }
  return minPenetration;
}

/** Worst pairwise overlap among currently visible vehicles. */
function worstOverlap(system: TrafficFleetSystem): number {
  const boxes: Box2[] = [];
  for (const slot of system.slots) {
    if (!slot.active || slot.kindId === null || slot.variantScale <= 1e-4) continue;
    const def = VEHICLE_KINDS[slot.kindId];
    const s = slot.variantScale;
    boxes.push({
      x: slot.x,
      z: slot.z,
      yaw: slot.yaw,
      halfW: (def.width / 2) * s,
      halfL: (def.length / 2) * s,
    });
  }
  let worst = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      worst = Math.max(worst, overlapDepth(boxes[i], boxes[j]));
    }
  }
  return worst;
}

interface LaneViolation {
  slotId: string;
  deviation: number;
}

/**
 * Lane-hold check: moving cars on straight sections must sit on their
 * right-hand lane center; parked cars inside the 2-unit curb lane; the
 * streetcar on the centerline.
 */
function checkLaneHold(system: TrafficFleetSystem, halfLength: number): LaneViolation[] {
  const violations: LaneViolation[] = [];
  for (const slot of system.slots) {
    if (!slot.active || slot.kindId === null) continue;
    if (slot.role === 'moving') {
      if (slot.pathId === 'ns-loop' && Math.abs(slot.z) <= halfLength - 1) {
        const expected = Math.cos(slot.yaw) >= 0 ? laneCenterWorld('ns', 1) : laneCenterWorld('ns', -1);
        const deviation = Math.abs(slot.x - expected);
        if (deviation > 0.05) violations.push({ slotId: slot.slotId, deviation });
      }
      if (slot.pathId === 'ew-loop' && Math.abs(slot.x) <= halfLength - 1) {
        const expected = Math.sin(slot.yaw) >= 0 ? laneCenterWorld('ew', 1) : laneCenterWorld('ew', -1);
        const deviation = Math.abs(slot.z - expected);
        if (deviation > 0.05) violations.push({ slotId: slot.slotId, deviation });
      }
    } else if (slot.role === 'parked') {
      // ns parked cars straddle x = +-5; ew parked cars straddle z = +-5.
      const lateral = slot.slotId.startsWith('ns') ? Math.abs(slot.x) : Math.abs(slot.z);
      if (lateral < 4 || lateral > 6) {
        violations.push({ slotId: slot.slotId, deviation: lateral });
      }
    } else if (slot.role === 'rail' && Math.abs(slot.x) > 0.05) {
      violations.push({ slotId: slot.slotId, deviation: Math.abs(slot.x) });
    }
  }
  return violations;
}

function stepFixture(fixture: Fixture, seconds: number, perFrame?: () => void): void {
  const frames = Math.round(seconds / DT);
  for (let f = 0; f < frames; f++) {
    fixture.era.driver.advance(DT);
    fixture.module.update(DT);
    perFrame?.();
  }
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('canonical lane slots and right-hand traffic', () => {
  it('pins the contract constants: 12-wide road, lanes at 3/9, 2-unit parking', () => {
    expect(STREET_WIDTH).toBe(12);
    expect(LANE_CENTERS).toEqual([3, 9]);
    expect(CURB_PARKING_WIDTH).toBe(2);
    expect(PARKING_LANE_CENTERS).toEqual([1, 11]);
    expect(ROAD_SURFACE_Y).toBe(0);
    expect(RAIL_CENTER_ACROSS).toBe(6);
    expect(acrossToOffset(3)).toBe(-3);
    expect(acrossToOffset(9)).toBe(3);
    expect(acrossToOffset(1)).toBe(-5);
    expect(acrossToOffset(11)).toBe(5);
  });

  it('places both directions of both streets on the driver’s right', () => {
    expect(laneCenterAcross('ns', 1)).toBe(9);
    expect(laneCenterAcross('ns', -1)).toBe(3);
    expect(laneCenterAcross('ew', 1)).toBe(3);
    expect(laneCenterAcross('ew', -1)).toBe(9);

    expect(laneCenterWorld('ns', 1)).toBe(3);
    expect(laneCenterWorld('ns', -1)).toBe(-3);
    expect(laneCenterWorld('ew', 1)).toBe(-3);
    expect(laneCenterWorld('ew', -1)).toBe(3);

    for (const axis of ['ns', 'ew'] as const) {
      for (const dir of [1, -1] as const) {
        expect(isRightHandLane(axis, dir)).toBe(true);
      }
    }
    expect(travelDirection('ns', 1)).toEqual({ x: 0, z: 1 });
    expect(travelDirection('ew', 1)).toEqual({ x: 1, z: 0 });
  });
});

describe('traffic loops', () => {
  const half = 48;

  it('builds closed loops that hold the right-hand lane on both streets', () => {
    const ns = buildStreetLoop('ns', half);
    const ew = buildStreetLoop('ew', half);
    expect(ns.closed).toBe(true);
    expect(ew.closed).toBe(true);
    expect(ns.length).toBeGreaterThan(4 * half);
    expect(ew.length).toBeGreaterThan(4 * half);

    // Every straight-section sample sits exactly on one of the two lanes,
    // with the tangent matching right-hand flow.
    for (let d = 0; d < ns.length; d += 1) {
      const s = ns.sample(d);
      if (Math.abs(s.z) <= half - 1) {
        expect(Math.abs(Math.abs(s.x) - 3)).toBeLessThan(1e-6);
        if (s.x > 0) expect(s.tangentZ).toBeGreaterThan(0.99); // northbound in east lane
        else expect(s.tangentZ).toBeLessThan(-0.99); // southbound in west lane
      }
    }
    for (let d = 0; d < ew.length; d += 1) {
      const s = ew.sample(d);
      if (Math.abs(s.x) <= half - 1) {
        expect(Math.abs(Math.abs(s.z) - 3)).toBeLessThan(1e-6);
        if (s.z < 0) expect(s.tangentX).toBeGreaterThan(0.99); // eastbound in south lane
        else expect(s.tangentX).toBeLessThan(-0.99); // westbound in north lane
      }
    }
  });

  it('precomputes intersection intervals and entry gaps for reservation', () => {
    const ns = buildStreetLoop('ns', half);
    expect(ns.insideIntervals.length).toBe(2); // one per direction of travel
    for (const [a, b] of ns.insideIntervals) {
      expect(a).toBeLessThan(b);
      expect(ns.isInside((a + b) / 2)).toBe(true);
    }
    const firstStart = ns.insideIntervals[0][0];
    expect(ns.entryGapAhead(firstStart - 10)).toBeCloseTo(10, 5);
    expect(ns.entryGapAhead(firstStart + 1)).toBeGreaterThan(1); // past entry: next lap

    const rail = buildStreetcarPath(half);
    expect(rail.closed).toBe(false);
    expect(rail.insideIntervals.length).toBe(1);
    for (const p of rail.points) expect(p.x).toBe(acrossToOffset(RAIL_CENTER_ACROSS));
  });
});

describe('era fleet rosters', () => {
  it('covers every required vehicle across the five eras', () => {
    const required: Record<FleetEra, VehicleKindId[]> = {
      1945: ['presedan', 'streetcar', 'deliverytruck'],
      1965: ['chromesedan', 'wagon', 'citybus', 'musclecar'],
      1985: ['boxcoupe', 'hatchback', 'panelvan', 'importcompact'],
      2005: ['suv', 'compact', 'taxi', 'bicycle'],
      2025: ['evsedan', 'scooter', 'ebike', 'robotaxi'],
    };
    for (const [era, kinds] of Object.entries(required)) {
      const fleet = ERA_FLEETS[Number(era) as FleetEra];
      const roster = new Set<VehicleKindId>([...fleet.moving, ...fleet.parked]);
      if (fleet.rail) roster.add(fleet.rail);
      for (const kind of kinds) expect(roster.has(kind)).toBe(true);
    }
    expect(ERA_FLEETS[1945].rail).toBe('streetcar');
    expect(ERA_FLEETS[1965].rail).toBe('streetcar');
    expect(ERA_FLEETS[1985].rail).toBeNull();
    expect(ERA_FLEETS[2005].rail).toBeNull();
    expect(ERA_FLEETS[2025].rail).toBeNull();
  });

  it('uses era-true trim styles and non-empty paint palettes', () => {
    const chromeKinds: VehicleKindId[] = ['presedan', 'streetcar', 'chromesedan', 'citybus', 'musclecar'];
    for (const id of chromeKinds) expect(VEHICLE_KINDS[id].trim).toBe('chrome');
    expect(VEHICLE_KINDS.boxcoupe.trim).toBe('chrome-rubber');
    expect(VEHICLE_KINDS.suv.trim).toBe('plastic');
    expect(VEHICLE_KINDS.evsedan.trim).toBe('satin');
    expect(VEHICLE_KINDS.presedan.whitewall).toBe(true);
    expect(VEHICLE_KINDS.chromesedan.whitewall).toBe(true);
    for (const def of Object.values(VEHICLE_KINDS)) {
      expect(def.paints.length).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.length).toBeGreaterThan(def.wheelRadius * 2);
    }
    // Width budget: moving + parked widths must keep a positive lateral gap
    // between the driving lane (center offset 3) and parking lane (offset 5).
    for (const fleet of Object.values(ERA_FLEETS)) {
      const movingMax = Math.max(...fleet.moving.map((id) => VEHICLE_KINDS[id].width));
      const parkedMax = Math.max(...fleet.parked.map((id) => VEHICLE_KINDS[id].width));
      expect(movingMax + parkedMax).toBeLessThan(4.0);
    }
  });

  it('assigns slots deterministically with per-street roster offsets', () => {
    expect(fleetKindForSlot('moving', 0, 0, 1945)).toBe('presedan');
    expect(fleetKindForSlot('moving', 1, 0, 1945)).toBe('deliverytruck');
    expect(fleetKindForSlot('moving', 1, 1, 1945)).toBe('presedan'); // offset shifts the mix
    expect(fleetKindForSlot('rail', 0, 0, 1945)).toBe('streetcar');
    expect(fleetKindForSlot('rail', 0, 0, 2025)).toBeNull();
    expect(fleetKindForSlot('moving', 1, 0, 2025)).toBe('robotaxi');
  });
});

describe('driving control laws', () => {
  it('follows leaders without collisions and yields at the box', () => {
    const cruise = 11;
    expect(desiredFollowingSpeed(0, 10, cruise)).toBe(0);
    expect(desiredFollowingSpeed(2, 10, cruise)).toBe(0);
    // Settled clearance matches the leader exactly.
    expect(desiredFollowingSpeed(3.5 + 7, 10, cruise)).toBeCloseTo(10, 6);
    // Wide gaps allow the cruise target.
    expect(desiredFollowingSpeed(40, 10, cruise)).toBe(cruise);
    // Monotonically non-decreasing in the gap.
    let previous = -1;
    for (let gap = 3; gap < 30; gap += 1) {
      const desired = desiredFollowingSpeed(gap, 8, cruise);
      expect(desired).toBeGreaterThanOrEqual(previous);
      previous = desired;
    }

    expect(desiredApproachSpeed(1, cruise)).toBe(0);
    expect(desiredApproachSpeed(3, cruise)).toBe(0);
    expect(desiredApproachSpeed(30, cruise)).toBe(cruise);
    expect(desiredApproachSpeed(10, cruise)).toBeGreaterThan(0);
    expect(desiredApproachSpeed(10, cruise)).toBeLessThan(cruise);
    expect(desiredApproachSpeed(Infinity, cruise)).toBe(cruise);
  });
});

describe('traffic simulation', () => {
  it('moves cars in lanes with wheel rotation, lights, and parking — no collisions', () => {
    const fixture = makeFixture();
    const system = fixture.module.eraSystem;
    const half = 48;

    // Seed deterministic intersection contention: one car inside the box,
    // one car approaching so it must yield and brake within the first frames.
    // Seeded positions keep every neighbor at a safe stopping distance.
    const nsPath = system.paths.find((p) => p.id === 'ns-loop')!;
    const ewPath = system.paths.find((p) => p.id === 'ew-loop')!;
    const byId = (id: string) => system.slots.find((s) => s.slotId === id)!;
    byId('ns-move-0').distance = (nsPath.insideIntervals[0][0] + nsPath.insideIntervals[0][1]) / 2;
    byId('ns-move-1').distance = 30;
    byId('ew-move-4').distance = ewPath.normalize(ewPath.insideIntervals[0][0] - 12);
    byId('ew-move-0').distance = 5;

    const initial = system.slots.map((s) => ({ id: s.slotId, spin: s.wheelSpin }));
    const parkedInitial = system.slots
      .filter((s) => s.role === 'parked')
      .map((s) => ({ id: s.slotId, x: s.x, z: s.z }));

    let minBumperGap = Infinity;
    let maxOverlap = 0;
    let brakeFrames = 0;
    let slowFrames = 0;

    stepFixture(fixture, 15, () => {
      maxOverlap = Math.max(maxOverlap, worstOverlap(system));
      for (const slot of system.slots) {
        if (!slot.active || slot.kindId === null) continue;
        const def = VEHICLE_KINDS[slot.kindId];
        if (slot.braking) brakeFrames += 1;
        if (slot.role === 'moving' && slot.speed < def.speed - 0.5) slowFrames += 1;
        // Bumper clearance to the car ahead on the same path.
        if (slot.pathId && slot.role === 'moving') {
          const path = system.paths.find((p) => p.id === slot.pathId);
          if (!path) continue;
          for (const peer of system.slots) {
            if (peer.pathId !== slot.pathId || peer === slot || !peer.active) continue;
            let delta = peer.distance - slot.distance;
            if (delta < 0) delta += path.length;
            if (delta <= 0.01 || delta >= path.length - 0.01) continue;
            const peerDef = peer.kindId ? VEHICLE_KINDS[peer.kindId] : null;
            const gap = delta - def.length / 2 - (peerDef ? peerDef.length / 2 : 2);
            minBumperGap = Math.min(minBumperGap, gap);
          }
        }
      }
      const violations = checkLaneHold(system, half);
      expect(violations).toEqual([]);
    });

    // No pair ever overlapped; clearance stayed positive throughout.
    expect(maxOverlap).toBeLessThan(0.02);
    expect(minBumperGap).toBeGreaterThan(0.5);

    // Intersection yield produced braking and slowed traffic.
    expect(brakeFrames).toBeGreaterThan(0);
    expect(slowFrames).toBeGreaterThan(0);

    // Every powered vehicle advanced and spun its wheels (distance / radius).
    for (let i = 0; i < system.slots.length; i++) {
      const slot = system.slots[i];
      if (slot.role === 'parked') continue;
      const start = initial.find((s) => s.id === slot.slotId)!;
      expect(slot.wheelSpin).toBeGreaterThan(start.spin + 1);
      const def = slot.kindId ? VEHICLE_KINDS[slot.kindId] : null;
      if (def) {
        const impliedDistance = (slot.wheelSpin - start.spin) * def.wheelRadius;
        expect(impliedDistance).toBeGreaterThan(1);
      }
    }

    // Lights: moving cars have headlights/taillights on; parked cars off.
    for (const slot of system.slots) {
      if (slot.role === 'moving' && slot.active) {
        expect(slot.headlights).toBe(true);
        expect(slot.taillights).toBe(true);
      }
      if (slot.role === 'parked') {
        expect(slot.headlights).toBe(false);
        expect(slot.taillights).toBe(false);
        expect(slot.braking).toBe(false);
      }
    }

    // Parked cars never moved and sit inside the 2-unit curb lane.
    for (const slot of system.slots) {
      if (slot.role !== 'parked') continue;
      const start = parkedInitial.find((p) => p.id === slot.slotId)!;
      expect(slot.x).toBeCloseTo(start.x, 10);
      expect(slot.z).toBeCloseTo(start.z, 10);
      const lateral = slot.slotId.startsWith('ns') ? Math.abs(slot.x) : Math.abs(slot.z);
      expect(lateral).toBeGreaterThanOrEqual(4);
      expect(lateral).toBeLessThanOrEqual(6);
      expect(slot.speed).toBe(0);
    }

    // Slot counts: 10 moving + 12 parked + 1 rail.
    expect(system.slots.filter((s) => s.role === 'moving')).toHaveLength(MOVING_CARS_PER_LOOP * 2);
    expect(system.slots.filter((s) => s.role === 'parked')).toHaveLength(PARKED_PER_SIDE * 4);

    fixture.module.dispose();
  });

  it('brakes for a rear-end threat and yields + honks at the intersection', () => {
    const fixture = makeFixture();
    const system = fixture.module.eraSystem;

    // 1. Rear-end threat: place the follower close behind a stalled leader;
    //    it must brake to a stop without touching.
    const leader = system.slots.find((s) => s.slotId === 'ns-move-0')!;
    const follower = system.slots.find((s) => s.slotId === 'ns-move-1')!;
    follower.distance = system.paths[0].normalize(leader.distance - 12);
    leader.speed = 0;
    follower.speed = 9;
    let sawBrake = false;
    let sawFullStop = false;
    let minGapDuring = Infinity;
    for (let f = 0; f < 90; f++) {
      fixture.module.update(DT);
      const path = system.paths[0];
      let delta = leader.distance - follower.distance;
      if (delta < 0) delta += path.length;
      const leaderDef = leader.kindId ? VEHICLE_KINDS[leader.kindId] : null;
      const followerDef = follower.kindId ? VEHICLE_KINDS[follower.kindId] : null;
      const gap =
        delta -
        (leaderDef ? leaderDef.length / 2 : 2) -
        (followerDef ? followerDef.length / 2 : 2);
      minGapDuring = Math.min(minGapDuring, gap);
      if (follower.braking) sawBrake = true;
      if (follower.speed < 0.05) sawFullStop = true;
      expect(worstOverlap(system)).toBeLessThan(0.02);
    }
    expect(sawBrake).toBe(true);
    expect(sawFullStop).toBe(true);
    expect(minGapDuring).toBeGreaterThan(0.2);

    // 2. Intersection yield: hold the box with an ew car and force an ns car
    //    to the stop line; it must brake, wait outside, and honk.
    const nsPath = system.paths.find((p) => p.id === 'ns-loop')!;
    const ewPath = system.paths.find((p) => p.id === 'ew-loop')!;
    const nsCar = system.slots.find((s) => s.slotId === 'ns-move-4')!;
    const ewCar = system.slots.find((s) => s.slotId === 'ew-move-4')!;
    const ewInterval = ewPath.insideIntervals[0];
    ewCar.distance = (ewInterval[0] + ewInterval[1]) / 2;
    const nsEntry = nsPath.insideIntervals[0][0];
    nsCar.distance = nsPath.normalize(nsEntry - 2);
    nsCar.speed = 0;
    nsCar.blockedSeconds = 1.6; // already waiting past the horn threshold
    nsCar.hornFired = false;

    const horns: VehicleAudioHookEvent[] = [];
    fixture.module.subscribeAudio((event) => {
      if (event.type === 'horn') horns.push(event);
    });
    fixture.module.update(DT);
    expect(horns.some((h) => h.type === 'horn' && h.vehicleId === 'ns-move-4')).toBe(true);
    expect(nsCar.braking).toBe(true);
    expect(nsCar.speed).toBe(0);
    expect(nsPath.isInside(nsCar.distance)).toBe(false);

    fixture.module.dispose();
  });
});

describe('EraTransformable fleet swaps', () => {
  it('registers as one fleet-stage system and swaps eras mid-motion', () => {
    const fixture = makeFixture();
    const system = fixture.module.eraSystem;

    expect(fixture.era.registry.size).toBe(1);
    expect(fixture.era.registry.has(system)).toBe(true);
    expect(system.stage).toBe('fleet');

    const startDistance = new Map(system.slots.map((s) => [s.slotId, s.distance]));

    // Transition 1945 -> 1965, stepping frames like the render loop would.
    fixture.era.driver.transitionTo(1965, 1.5);
    // The initial dispatch holds the outgoing fleet at full scale.
    expect(system.slots.every((s) => s.kindId !== null && s.variantScale === 1)).toBe(true);

    let sawMidMorph = 0;
    let sawChromeFleetMid = 0;
    let frames = 0;
    while (fixture.era.core.isTransitioning && frames < 120) {
      fixture.era.driver.advance(DT);
      fixture.module.update(DT);
      frames += 1;

      for (const slot of system.slots) {
        if (slot.kindId === null) expect(slot.variantScale).toBe(0);
        else expect(slot.variantScale).toBeGreaterThan(0);
        expect(slot.variantScale).toBeGreaterThanOrEqual(0);
        expect(slot.variantScale).toBeLessThanOrEqual(1);
        if (slot.variantScale > 0.05 && slot.variantScale < 0.95) sawMidMorph += 1;
        if (slot.kindId === 'chromesedan' && slot.variantScale > 0.5) sawChromeFleetMid += 1;
      }
      expect(worstOverlap(system)).toBeLessThan(0.02);
      expect(checkLaneHold(system, 48)).toEqual([]);
    }
    expect(frames).toBeGreaterThan(10);
    expect(sawMidMorph).toBeGreaterThan(0); // smooth shrink/grow actually ran
    expect(sawChromeFleetMid).toBeGreaterThan(0);
    expect(fixture.era.core.isTransitioning).toBe(false);

    // Traffic kept moving through the swap (waiting cars at the
    // intersection aside, the fleet as a whole covered ground).
    let totalMoved = 0;
    for (const slot of system.slots) {
      if (slot.role !== 'moving') continue;
      const start = startDistance.get(slot.slotId)!;
      const path = system.paths.find((p) => p.id === slot.pathId)!;
      const moved = Math.abs(slot.distance - start);
      totalMoved += Math.min(moved, path.length - moved);
    }
    expect(totalMoved).toBeGreaterThan(20);

    // Settled exactly on the 1965 fleet.
    for (const slot of system.slots) {
      const expected = fleetKindForSlot(slot.role, slot.fleetIndex, slot.loopOffset, 1965);
      expect(slot.kindId).toBe(expected);
      expect(slot.variantScale).toBe(expected ? 1 : 0);
      expect(slot.active).toBe(expected !== null);
    }

    fixture.module.dispose();
  });

  it('crosses multiple eras in one transition with invariants held throughout', () => {
    const fixture = makeFixture();
    const system = fixture.module.eraSystem;

    fixture.era.driver.transitionTo(2025, 2);
    let maxOverlapDuring = 0;
    let violations = 0;
    let frames = 0;
    while (fixture.era.core.isTransitioning && frames < 180) {
      fixture.era.driver.advance(DT);
      fixture.module.update(DT);
      frames += 1;
      maxOverlapDuring = Math.max(maxOverlapDuring, worstOverlap(system));
      violations += checkLaneHold(system, 48).length;
    }
    expect(frames).toBeGreaterThan(20);
    expect(maxOverlapDuring).toBeLessThan(0.02);
    expect(violations).toBe(0);

    // Final fleet: 2025 everywhere, robotaxi in traffic, rail retired.
    for (const slot of system.slots) {
      const expected = fleetKindForSlot(slot.role, slot.fleetIndex, slot.loopOffset, 2025);
      expect(slot.kindId).toBe(expected);
    }
    const robotaxi = system.slots.find((s) => s.slotId === 'ns-move-1')!;
    expect(robotaxi.kindId).toBe('robotaxi');
    expect(robotaxi.active).toBe(true);
    const rail = system.slots.find((s) => s.slotId === 'rail-tram')!;
    expect(rail.kindId).toBeNull();
    expect(rail.active).toBe(false);

    fixture.module.dispose();
  });
});

describe('pickable descriptors', () => {
  it('exposes the streetcar and robotaxi with callout-ready fields', () => {
    const fixture = makeFixture();
    const ids = fixture.module.pickables.map((d) => d.id);
    expect(ids).toContain('vehicle:streetcar');
    expect(ids).toContain('vehicle:robotaxi');

    const streetcar = fixture.module.pickables.find((d) => d.id === 'vehicle:streetcar')!;
    expect(streetcar.title).toBe('Streamline Streetcar');
    expect(streetcar.eyebrow).toBe('1945');
    expect(streetcar.description.length).toBeGreaterThan(10);
    expect(streetcar.facts.length).toBeGreaterThan(0);
    expect(streetcar.focusDistance).toBeGreaterThan(0);
    expect(streetcar.focusHeight).toBeGreaterThan(0);
    expect(streetcar.object.name).toBe('rail-tram');

    // At rest in 1945 the rail slot resolves to the streetcar descriptor.
    const railGroup = fixture.module.group.getObjectByName('rail-tram')!;
    expect(fixture.module.describePick(railGroup)).toBe(streetcar);

    // Parked slots also resolve for their era (pre-war sedan callout).
    const parkedGroup = fixture.module.group.getObjectByName('ns-park-a-0')!;
    const parkedPick = fixture.module.describePick(parkedGroup);
    expect(parkedPick?.id).toBe('vehicle:presedan');

    // After moving to 2025 the robotaxi slot resolves instead.
    fixture.era.driver.transitionTo(2025, 2);
    for (let f = 0; f < 150 && fixture.era.core.isTransitioning; f++) {
      fixture.era.driver.advance(DT);
      fixture.module.update(DT);
    }
    const robotaxiGroup = fixture.module.group.getObjectByName('ns-move-1')!;
    const pick = fixture.module.describePick(robotaxiGroup);
    expect(pick?.id).toBe('vehicle:robotaxi');
    expect(pick?.eyebrow).toBe('2025');
    // The retired streetcar no longer resolves.
    expect(fixture.module.describePick(railGroup)).toBeNull();

    fixture.module.dispose();
  });
});

describe('audio hook events', () => {
  it('emits documented engine events while driving and horn on demand', () => {
    const fixture = makeFixture();
    const events: VehicleAudioHookEvent[] = [];
    const unsubscribe = fixture.module.subscribeAudio((event) => events.push(event));

    stepFixture(fixture, 1);
    const engines = events.filter((e) => e.type === 'engine');
    expect(engines.length).toBeGreaterThan(0);
    for (const engine of engines) {
      if (engine.type !== 'engine') continue;
      expect(engine.vehicleId).toMatch(/^((ns|ew)-move-\d|rail-tram)$/);
      expect(engine.era).toBe(1945);
      expect(engine.rpm).toBeGreaterThanOrEqual(0);
      expect(engine.rpm).toBeLessThanOrEqual(1);
      expect(engine.intensity).toBeGreaterThan(0);
      expect(engine.intensity).toBeLessThanOrEqual(1.35);
      expect(typeof engine.braking).toBe('boolean');
    }

    expect(fixture.module.honk('ns-move-2')).toBe(true);
    const horns = events.filter((e) => e.type === 'horn');
    expect(horns.length).toBeGreaterThan(0);
    const horn = horns[horns.length - 1];
    if (horn.type === 'horn') {
      expect(horn.vehicleId).toBe('ns-move-2');
      expect(horn.position).toHaveLength(3);
      expect(horn.era).toBe(1945);
    }

    unsubscribe();
    const countAfterUnsub = events.length;
    stepFixture(fixture, 0.5);
    expect(events.length).toBe(countAfterUnsub);

    fixture.module.dispose();
  });
});

describe('composition with the era contract and gfx material library', () => {
  it('composes real systems: registry, library materials, instanced pools, budget', () => {
    const era = createEraMorphSystem();
    const parent = new THREE.Group();
    const module = createVehiclesModule({ registry: era.registry, parent });

    // Real era transform contract integration.
    expect(era.registry.size).toBe(1);
    expect(era.registry.has(module.eraSystem)).toBe(true);
    expect(parent.children).toContain(module.group);

    // Real gfx material library on the glass: era swatch color + generated map.
    const glass = module.group.getObjectByName('ns-move-0-glass') as THREE.Mesh;
    expect(glass).toBeDefined();
    const glassMaterial = glass.material as THREE.MeshStandardMaterial;
    const swatch = ProceduralGfxLibrary.getMaterialSwatch(1945, 'glass');
    expect(glassMaterial.color.getHexString().toLowerCase()).toBe(
      swatch.color.replace('#', '').toLowerCase(),
    );
    expect(glassMaterial.map).toBeInstanceOf(THREE.Texture);
    expect(glassMaterial.transparent).toBe(true);

    // Body paint is a real per-slot standard material using the era paint.
    const body = module.group.getObjectByName('ns-move-0-body') as THREE.Mesh;
    const bodyMaterial = body.material as THREE.MeshStandardMaterial;
    expect(bodyMaterial).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(VEHICLE_KINDS.presedan.paints).toContain(`#${bodyMaterial.color.getHexString()}`);

    // Instanced pools for wheels, hubs, trim, and lamps.
    const instanced: THREE.InstancedMesh[] = [];
    module.group.traverse((obj) => {
      const mesh = obj as THREE.InstancedMesh;
      if (mesh.isInstancedMesh) instanced.push(mesh);
    });
    expect(instanced.length).toBe(6);
    const byName = new Map(instanced.map((m) => [m.name, m]));
    const slotCount = module.eraSystem.slots.length;
    expect(byName.get('vehicleWheels')?.count).toBe(slotCount * 4);
    expect(byName.get('vehicleHubs')?.count).toBe(slotCount * 4);
    expect(byName.get('vehicleTrim')?.count).toBe(slotCount * 5);
    expect(byName.get('vehicleHeadlamps')?.count).toBe(slotCount);
    expect(byName.get('vehicleTaillamps')?.count).toBe(slotCount);
    expect(byName.get('vehicleBrakelamps')?.count).toBe(slotCount);

    // Low draw budget: bodies + glasses + six pools.
    const meshes: THREE.Mesh[] = [];
    module.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
    expect(meshes.length).toBeLessThanOrEqual(slotCount * 2 + 6);

    // A real dispatched transition drives the composed module to 1965.
    expect(module.states().find((s) => s.slotId === 'ns-move-0')?.kindId).toBe('presedan');
    era.driver.transitionTo(1965, 1);
    era.driver.advance(1);
    module.update(DT);
    expect(era.core.isTransitioning).toBe(false);
    expect(module.states().find((s) => s.slotId === 'ns-move-0')?.kindId).toBe('chromesedan');

    // Dispose unregisters and detaches.
    module.dispose();
    expect(era.registry.has(module.eraSystem)).toBe(false);
    expect(parent.children).not.toContain(module.group);
  });

  it('ProceduralGfxLibrary exposes the constructors the fleet relies on', () => {
    expect(ProceduralGfxLibrary.createEraMaterial).toBeTypeOf('function');
    expect(ProceduralGfxLibrary.createBeveledBoxGeometry).toBeTypeOf('function');
    expect(ProceduralGfxLibrary.mergeBufferGeometries).toBeTypeOf('function');
    expect(ProceduralGfxLibrary.createInstancedMesh).toBeTypeOf('function');
    expect(ProceduralGfxLibrary.setInstanceColor).toBeTypeOf('function');
    expect(ProceduralGfxLibrary.getMaterialSwatch).toBeTypeOf('function');
  });
});
