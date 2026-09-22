/**
 * Pedestrian crowd tests.
 *
 * Covers the work order's acceptance criteria end to end:
 * - era-true outfit silhouettes/props vocabulary for 1945/1965/1985/2005/2025
 *   and vertex-compatible morph topology between them,
 * - varied skin/hair tones, heights, ages, gaits, and speeds,
 * - walk cycles, idle chatter, window shopping, and street crossing with
 *   documented footstep/chatter audio hooks,
 * - no interpenetration while walkers stay inside the canonical lane band,
 * - composition with the REAL `EraTransformable` registry/morph driver and the
 *   REAL `ProceduralGfxLibrary` (instanced meshes, procedural textures,
 *   palette-derived instance colors), including mid-stride era restyling with
 *   continuous weights and no popping.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEraMorphSystem, createEraTransformRegistry, stageOffset } from '../../era/contracts';
import { blendForYear, type EraYear } from '../../era/timeline';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import {
  ALL_ERA_YEARS,
  ARCHETYPE_SLOTS,
  ERA_ARCHETYPES,
  ERA_REQUIRED_TAGS,
  GFX_TEXTURE_SOURCE,
  GRID_SLOTS,
  PINNED_LANE_CONSTANTS,
  PEDESTRIAN_AUDIO_HOOK_TYPES,
  SLOT_CELL_KINDS,
  PedestriansModule,
  archetypeAt,
  buildFigureMorphSet,
  createCrowdPath,
  createPedestriansModule,
  eraCellsForSlot,
  eraFabricColor,
  mixHex,
  resolveLaneConstants,
  resolveOutfitColor,
  type PedestrianAudioEvent,
  type PedestrianPublicState,
  type WalkerBehavior,
} from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulate(crowd: PedestriansModule, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) crowd.update(dt);
}

function minPairDistance(peds: readonly PedestrianPublicState[]): number {
  let min = Infinity;
  for (let i = 0; i < peds.length; i++) {
    const a = peds[i].position;
    for (let j = i + 1; j < peds.length; j++) {
      const b = peds[j].position;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < min) min = d;
    }
  }
  return min;
}

function maxAbs(arr: Float32Array): number {
  let m = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = Math.abs(arr[i]);
    if (v > m) m = v;
  }
  return m;
}

function hexChannels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function identityFor(p: PedestrianPublicState): {
  index: number;
  archetypeIndex: number;
  skinTone: string;
  hairTone: string;
} {
  return {
    index: p.index,
    archetypeIndex: p.archetypeIndex,
    skinTone: p.skinTone,
    hairTone: p.hairTone,
  };
}

// ---------------------------------------------------------------------------
// Canonical lane constants
// ---------------------------------------------------------------------------

describe('canonical sidewalk lane constants', () => {
  it('pins sidewalk top, width, lane inset, and both intersection crossings', () => {
    expect(PINNED_LANE_CONSTANTS.SIDEWALK_TOP_Y).toBe(0.15);
    expect(PINNED_LANE_CONSTANTS.SIDEWALK_WIDTH).toBe(3);
    expect(PINNED_LANE_CONSTANTS.LANE_CENTER_INSET).toBe(1.5);

    const c = resolveLaneConstants();
    expect(c.sidewalkTopY).toBe(0.15);
    expect(c.sidewalkWidth).toBe(3);
    // Walking lane centered 1.5 units in from the curb.
    expect(c.laneZ).toBeCloseTo(c.curbZ + 1.5, 9);

    const path = createCrowdPath(c);
    expect(path.segments.map((s) => s.kind)).toEqual(['lane', 'crossing', 'lane', 'crossing']);
    const [south, east, north, west] = path.segments;
    expect(south.az).toBeCloseTo(-c.laneZ, 9);
    expect(south.bz).toBeCloseTo(-c.laneZ, 9);
    expect(north.az).toBeCloseTo(c.laneZ, 9);
    // Crossings sit at the two intersections (x = +/- intersectionX).
    expect(east.ax).toBeCloseTo(c.intersectionX, 9);
    expect(east.bx).toBeCloseTo(c.intersectionX, 9);
    expect(west.ax).toBeCloseTo(-c.intersectionX, 9);
    expect(west.bx).toBeCloseTo(-c.intersectionX, 9);

    const laneLength = 2 * c.intersectionX;
    const crossLength = 2 * c.laneZ;
    expect(path.totalLength).toBeCloseTo(2 * laneLength + 2 * crossLength, 6);

    // Lane walking rests exactly on the sidewalk top.
    const midLane = path.pointAt(south.start + laneLength / 2, 0);
    expect(midLane.y).toBeCloseTo(0.15, 9);
    expect(midLane.z).toBeCloseTo(-c.laneZ, 9);
    // Mid-crossing steps down onto the roadway between the two sidewalks.
    const midCross = path.pointAt(east.start + crossLength / 2, 0);
    expect(midCross.x).toBeCloseTo(c.intersectionX, 9);
    expect(midCross.z).toBeCloseTo(0, 9);
    expect(midCross.y).toBeCloseTo(0.02, 6);
  });
});

// ---------------------------------------------------------------------------
// Era outfit vocabulary and morph topology
// ---------------------------------------------------------------------------

describe('era-true outfit silhouettes and props', () => {
  it('covers every required era tag across six archetypes per era', () => {
    for (const era of ALL_ERA_YEARS) {
      const archetypes = ERA_ARCHETYPES[era];
      expect(archetypes).toHaveLength(ARCHETYPE_SLOTS);
      const keys = archetypes.map((a) => a.key);
      expect(new Set(keys).size).toBe(ARCHETYPE_SLOTS);
      const tags = archetypes.flatMap((a) => [...a.tags]);
      for (const required of ERA_REQUIRED_TAGS[era]) {
        expect(tags).toContain(required);
      }
    }
  });

  it('builds vertex-compatible morph targets for every (slot, archetype) pair', () => {
    for (let idx = 0; idx < ARCHETYPE_SLOTS; idx++) {
      for (const slot of GRID_SLOTS) {
        const cells = eraCellsForSlot(slot, idx);
        const kinds = SLOT_CELL_KINDS[slot];
        for (const era of ALL_ERA_YEARS) {
          expect(cells[era]).toHaveLength(kinds.length);
          cells[era].forEach((cell, i) => expect(cell.kind).toBe(kinds[i]));
        }
        const set = buildFigureMorphSet(slot, cells);
        if (set) {
          expect(set.liveEras.length).toBeGreaterThan(0);
          for (const era of ALL_ERA_YEARS) {
            expect(set.positionsByEra[era]).toHaveLength(set.vertexCount);
          }
        }
      }
    }
  });

  it('morphs hats fedora -> pillbox -> bare, and face gear appears only in 2025', () => {
    const hat = buildFigureMorphSet('hat', eraCellsForSlot('hat', 0));
    expect(hat).not.toBeNull();
    expect(hat?.liveEras).toEqual([1945, 1965]); // fedora + pillbox; power era wears none
    expect(maxAbs(hat!.positionsByEra[1985])).toBeLessThan(0.01);
    expect(maxAbs(hat!.positionsByEra[1945])).toBeGreaterThan(0.1);

    const face = buildFigureMorphSet('face', eraCellsForSlot('face', 0));
    expect(face?.liveEras).toEqual([2025]); // masks/earbuds are a 2025-only part
    expect(maxAbs(face!.positionsByEra[1945])).toBeLessThan(0.01);
    expect(maxAbs(face!.positionsByEra[2025])).toBeGreaterThan(0.05);

    const prop = buildFigureMorphSet('propA', eraCellsForSlot('propA', 0));
    // newspaper -> (nothing) -> briefcase -> flip phone -> phone in hand
    expect(prop?.liveEras).toEqual([1945, 1985, 2005, 2025]);
  });

  it('varies skin/hair tones, heights, ages, archetypes, and era palette colors', () => {
    const crowd = new PedestriansModule({ count: 36, seed: 12345 });
    try {
      const peds = crowd.getPedestrians();
      expect(peds).toHaveLength(36);

      const heights = peds.map((p) => p.heightM);
      expect(new Set(heights).size).toBeGreaterThanOrEqual(10);
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThanOrEqual(0.5);

      expect(new Set(peds.map((p) => p.skinTone)).size).toBeGreaterThanOrEqual(7);
      expect(new Set(peds.map((p) => p.hairTone)).size).toBeGreaterThanOrEqual(9);
      expect(new Set(peds.map((p) => p.ageGroup))).toEqual(
        new Set(['child', 'adult', 'senior'] as const),
      );
      expect(new Set(peds.map((p) => p.archetypeIndex)).size).toBe(ARCHETYPE_SLOTS);

      // Outfit colors differ per person and per era.
      for (const era of ALL_ERA_YEARS) {
        const colors = new Set(
          peds.map((p) => resolveOutfitColor(identityFor(p), era, 'torso')),
        );
        expect(colors.size).toBeGreaterThanOrEqual(6);
      }

      // The resolved garment sits on the palette-mixed base (within the
      // documented per-person jitter bound), proving the era fabric swatch
      // from the shared material library participates in outfit color.
      const id0 = identityFor(peds[0]);
      const arch0 = archetypeAt(1985, 0);
      const paletteBase = eraFabricColor(1985);
      const mixed = mixHex(arch0.colors.garment, paletteBase, 0.18);
      const actual = resolveOutfitColor(id0, 1985, 'torso');
      const expected = hexChannels(mixed);
      const got = hexChannels(actual);
      for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - expected[i])).toBeLessThanOrEqual(14);

      // Era palettes differ, so the same person dresses differently per era.
      expect(eraFabricColor(1945)).not.toBe(eraFabricColor(2025));
      expect(resolveOutfitColor(id0, 1945, 'torso')).not.toBe(
        resolveOutfitColor(id0, 2025, 'torso'),
      );
    } finally {
      crowd.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Walk cycles, behaviors, gaits, audio hooks
// ---------------------------------------------------------------------------

describe('walk cycles, idle behaviors, and audio hooks', () => {
  it('animates walking, window shopping, chatter, idle, and crossing with varied gaits', () => {
    const crowd = new PedestriansModule({ count: 36, seed: 777 });
    try {
      simulate(crowd, 0.5);
      const behaviors = new Set(crowd.getPedestrians().map((p) => p.behavior));
      for (const expected of [
        'walking',
        'windowShopping',
        'chatter',
        'idle',
        'crossing',
      ] as WalkerBehavior[]) {
        expect(behaviors).toContain(expected);
      }

      const speeds = new Set(crowd.getPedestrians().map((p) => p.cruiseSpeed));
      expect(speeds.size).toBeGreaterThanOrEqual(5);
      const strides = new Set(crowd.getPedestrians().map((p) => p.strideLength));
      expect(strides.size).toBeGreaterThanOrEqual(8);

      const before = crowd.getPedestrians();
      const beforePos = before.map((p) => [p.position.x, p.position.z] as const);
      simulate(crowd, 6);
      const after = crowd.getPedestrians();

      const advancing = after.filter((p, i) => p.walkPhase > before[i].walkPhase + 0.5).length;
      expect(advancing).toBeGreaterThan(10);
      const moving = after.filter((p, i) => {
        const dx = p.position.x - beforePos[i][0];
        const dz = p.position.z - beforePos[i][1];
        return Math.sqrt(dx * dx + dz * dz) > 0.2;
      }).length;
      expect(moving).toBeGreaterThan(10);
    } finally {
      crowd.dispose();
    }
  });

  it('emits documented footstep and chatter hooks at believable gait cadence', () => {
    const crowd = new PedestriansModule({ count: 36, seed: 777 });
    try {
      simulate(crowd, 14);
      const events = crowd.getAudioEvents();
      expect(events.length).toBeGreaterThan(0);

      for (const e of events) {
        expect(PEDESTRIAN_AUDIO_HOOK_TYPES).toContain(e.type);
        expect(e.era).toBe(1945);
        expect(['sidewalk', 'crosswalk']).toContain(e.surface);
        expect(Number.isFinite(e.intensity)).toBe(true);
        expect(Number.isFinite(e.position.x)).toBe(true);
        if (e.type === 'footstep') {
          expect(['left', 'right']).toContain(e.foot as string);
        }
      }

      const footsteps = events.filter((e) => e.type === 'footstep');
      const chatter = events.filter((e) => e.type === 'chatter');
      expect(chatter.length).toBeGreaterThanOrEqual(2);

      // Two steps per stride of actual distance traveled (with slack for
      // pauses and acceleration bands).
      let expectedSteps = 0;
      let maxPossibleSteps = 0;
      for (const p of crowd.getPedestrians()) {
        expectedSteps += (2 * p.traveledDistance) / p.strideLength;
        maxPossibleSteps += (2 * p.traveledDistance) / 0.35;
      }
      expect(expectedSteps).toBeGreaterThan(10);
      expect(footsteps.length).toBeGreaterThanOrEqual(Math.floor(expectedSteps * 0.75));
      expect(footsteps.length).toBeLessThanOrEqual(maxPossibleSteps + 36);

      // Sequence numbers are monotonic for incremental consumers.
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
      }
    } finally {
      crowd.dispose();
    }
  });

  it('delivers live hook events to subscribers and stops after unsubscribe', () => {
    const crowd = new PedestriansModule({ count: 24, seed: 31 });
    try {
      const received: PedestrianAudioEvent[] = [];
      const off = crowd.onAudioEvent((e) => received.push(e));
      simulate(crowd, 2);
      expect(received.length).toBeGreaterThan(0);

      off();
      const countAtUnsubscribe = received.length;
      simulate(crowd, 2);
      expect(received.length).toBe(countAtUnsubscribe);
    } finally {
      crowd.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Lane containment and interpenetration
// ---------------------------------------------------------------------------

describe('lane containment and spacing', () => {
  it(
    'keeps every walker inside the canonical lane band with no interpenetration',
    () => {
      const crowd = new PedestriansModule({ count: 40, seed: 4242 });
      const c = crowd.laneConstants;
      const dt = 1 / 60;
      let minDist = Infinity;
      let maxLaneDeviation = 0;
      let maxCrossDeviation = 0;
      let minLaneY = Infinity;
      let maxLaneYDeviation = 0;
      let minCrossY = Infinity;
      let maxCrossY = -Infinity;
      let sawStreetLevel = false;
      let sawBothLanes = false;

      for (let step = 0; step < 60 * 20; step++) {
        crowd.update(dt);
        if (step < 30) continue; // let the first separation pass settle
        const peds = crowd.getPedestrians();

        let laneSeen = 0;
        for (const p of peds) {
          if (p.segmentKind === 'lane') {
            laneSeen |= p.position.z > 0 ? 1 : 2;
            const dev = Math.abs(Math.abs(p.position.z) - c.laneZ);
            if (dev > maxLaneDeviation) maxLaneDeviation = dev;
            const yDev = Math.abs(p.position.y - 0.15);
            if (yDev > maxLaneYDeviation) maxLaneYDeviation = yDev;
            if (p.position.y < minLaneY) minLaneY = p.position.y;
            // Inside the 3-unit sidewalk band (|z| in [12, 15]).
            expect(Math.abs(p.position.z)).toBeGreaterThanOrEqual(12);
            expect(Math.abs(p.position.z)).toBeLessThanOrEqual(15);
          } else {
            const dev = Math.abs(Math.abs(p.position.x) - c.intersectionX);
            if (dev > maxCrossDeviation) maxCrossDeviation = dev;
            if (p.position.y < minCrossY) minCrossY = p.position.y;
            if (p.position.y > maxCrossY) maxCrossY = p.position.y;
            if (p.position.y < 0.05) sawStreetLevel = true;
          }
        }
        if (laneSeen === 3) sawBothLanes = true;

        if (step % 3 === 0) {
          const d = minPairDistance(peds);
          if (d < minDist) minDist = d;
        }
      }

      expect(maxLaneDeviation).toBeLessThanOrEqual(0.31);
      expect(maxCrossDeviation).toBeLessThanOrEqual(0.31);
      expect(maxLaneYDeviation).toBeLessThan(1e-9); // lane walking stays on y = 0.15
      expect(minLaneY).toBeCloseTo(0.15, 9);
      expect(minCrossY).toBeGreaterThanOrEqual(0.019);
      expect(maxCrossY).toBeLessThanOrEqual(0.1500001);
      expect(sawStreetLevel).toBe(true); // crossing dips onto the roadway
      expect(sawBothLanes).toBe(true); // both sidewalks are used
      expect(minDist).toBeGreaterThanOrEqual(0.45); // no interpenetration
      crowd.dispose();
    },
    60000,
  );
});

// ---------------------------------------------------------------------------
// Composition with the real era contract
// ---------------------------------------------------------------------------

describe('EraTransformable composition with the real era contract', () => {
  it('registers as the crowd stage and receives contract stage offsets', () => {
    const registry = createEraTransformRegistry();
    const crowd = new PedestriansModule({ count: 18, seed: 3 });
    const off = crowd.register(registry);
    try {
      expect(registry.size).toBe(1);
      expect(registry.members[0]).toBe(crowd);
      expect(crowd.stage).toBe('crowd');
      expect(crowd.getMorphInfo().stageOffset).toBeCloseTo(stageOffset('crowd'), 10);

      registry.dispatch(blendForYear(1965), 1);
      // Stage bookkeeping lands synchronously with the dispatch...
      expect(crowd.getMorphInfo().stageOffset).toBeCloseTo(stageOffset('crowd'), 10);
      expect(crowd.getMorphInfo().progress).toBeCloseTo(1, 10);
      // ...while applied weights realize the staged target at a bounded,
      // pop-free rate on the next update ticks.
      simulate(crowd, 0.5);
      const weights = crowd.getEraWeights();
      expect(weights[1965]).toBeCloseTo(1, 6);
      expect(crowd.getMorphInfo().resting).toBe(true);
      expect(crowd.getMorphInfo().restingEra).toBe(1965);
    } finally {
      off();
      expect(registry.has(crowd)).toBe(false);
      crowd.dispose();
    }
  });

  it(
    'restyles mid-stride through the morph driver with continuous, pop-free weights',
    () => {
      const system = createEraMorphSystem();
      const crowd = new PedestriansModule({
        count: 24,
        seed: 5,
        registry: system.registry,
        library: ProceduralGfxLibrary,
      });
      try {
        expect(system.registry.has(crowd)).toBe(true);
        system.driver.sync();
        expect(crowd.getEraWeights()).toEqual({
          1945: 1,
          1965: 0,
          1985: 0,
          2005: 0,
          2025: 0,
        });
        expect(crowd.getMorphInfo().stageOffset).toBeCloseTo(0.5, 10);

        // Capture the hat mesh (archetype 0 wears a fedora in 1945) and the
        // starting walk state of pedestrian 0.
        const hatMesh = crowd.getSlotMesh('hat', 0);
        expect(hatMesh).not.toBeNull();
        const hatBefore = new Float32Array(
          (hatMesh!.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
        );
        const start = crowd.getPedestrians();
        const startPhase = start[0].walkPhase;
        const startTraveled = start.reduce((sum, p) => sum + p.traveledDistance, 0);

        system.driver.transitionTo(1965, 1.5);

        let maxWeightSumError = 0;
        let maxWeightDelta = 0;
        let maxPositionJump = 0;
        let bothErasMax = 0;
        let nonFinite = 0;
        let prevWeights = crowd.getEraWeights();
        let prevPositions = crowd.getPedestrians().map((p) => [p.position.x, p.position.z] as const);
        let hatMid: Float32Array | null = null;

        for (let frame = 0; frame < 100; frame++) {
          system.driver.advance(1 / 60);
          crowd.update(1 / 60);

          const weights = crowd.getEraWeights();
          let s = 0;
          for (const era of ALL_ERA_YEARS) {
            const w = weights[era];
            if (!Number.isFinite(w)) nonFinite += 1;
            s += w;
            maxWeightDelta = Math.max(maxWeightDelta, Math.abs(w - prevWeights[era]));
          }
          maxWeightSumError = Math.max(maxWeightSumError, Math.abs(s - 1));
          bothErasMax = Math.max(bothErasMax, Math.min(weights[1945], weights[1965]));

          const peds = crowd.getPedestrians();
          for (let i = 0; i < peds.length; i++) {
            const dx = peds[i].position.x - prevPositions[i][0];
            const dz = peds[i].position.z - prevPositions[i][1];
            maxPositionJump = Math.max(maxPositionJump, Math.sqrt(dx * dx + dz * dz));
          }
          prevWeights = weights;
          prevPositions = peds.map((p) => [p.position.x, p.position.z] as const);

          if (frame === 45) {
            hatMid = new Float32Array(
              (hatMesh!.geometry.getAttribute('position') as THREE.BufferAttribute)
                .array as Float32Array,
            );
          }
        }

        expect(nonFinite).toBe(0);
        expect(maxWeightSumError).toBeLessThan(1e-6);
        // No popping: weights move smoothly and pedestrians never teleport.
        expect(maxWeightDelta).toBeLessThan(0.35);
        expect(maxPositionJump).toBeLessThan(0.12);
        // Both eras are visibly present mid-morph (outfit crossfade).
        expect(bothErasMax).toBeGreaterThan(0.02);

        // The crowd kept walking mid-stride while restyled.
        const end = crowd.getPedestrians();
        expect(end[0].walkPhase).toBeGreaterThan(startPhase);
        expect(end.reduce((sum, p) => sum + p.traveledDistance, 0)).toBeGreaterThan(
          startTraveled + 5,
        );

        // Transition completed: resting on 1965.
        expect(system.driver.isTransitioning).toBe(false);
        const finalWeights = crowd.getEraWeights();
        expect(finalWeights[1965]).toBeCloseTo(1, 6);
        expect(finalWeights[1945]).toBeCloseTo(0, 6);
        expect(crowd.getMorphInfo().resting).toBe(true);
        expect(crowd.getMorphInfo().restingEra).toBe(1965);

        // Geometry actually morphed (fedora -> pillbox) and is exact at rest.
        expect(hatMid).not.toBeNull();
        let midDiffers = 0;
        for (let i = 0; i < hatBefore.length; i++) {
          if (Math.abs(hatMid![i] - hatBefore[i]) > 1e-4) midDiffers += 1;
        }
        expect(midDiffers).toBeGreaterThan(10);

        const expected1965 = buildFigureMorphSet('hat', eraCellsForSlot('hat', 0))!
          .positionsByEra[1965];
        const hatAfter = (hatMesh!.geometry.getAttribute('position') as THREE.BufferAttribute)
          .array as Float32Array;
        expect(hatAfter.length).toBe(expected1965.length);
        let exactMatches = 0;
        for (let i = 0; i < hatAfter.length; i++) {
          if (Math.abs(hatAfter[i] - expected1965[i]) < 1e-6) exactMatches += 1;
        }
        expect(exactMatches).toBe(hatAfter.length);

        // Instance colors equal the palette-derived 1965 outfit colors.
        const torsoMesh = crowd.getSlotMesh('torso', 0)!;
        const packed = crowd.getPackedInstanceIndex('torso', 0);
        expect(packed).toBeGreaterThanOrEqual(0);
        const colorArr = torsoMesh.instanceColor!.array as Float32Array;
        const expectedColor = new THREE.Color(
          resolveOutfitColor(identityFor(end[0]), 1965, 'torso'),
        );
        expect(colorArr[packed * 3]).toBeCloseTo(expectedColor.r, 4);
        expect(colorArr[packed * 3 + 1]).toBeCloseTo(expectedColor.g, 4);
        expect(colorArr[packed * 3 + 2]).toBeCloseTo(expectedColor.b, 4);
        // The public blended color agrees with the GPU buffer.
        const publicColor = new THREE.Color(crowd.getSlotColor(0, 'torso'));
        expect(publicColor.r).toBeCloseTo(expectedColor.r, 4);
        expect(publicColor.g).toBeCloseTo(expectedColor.g, 4);
        expect(publicColor.b).toBeCloseTo(expectedColor.b, 4);

        // Interrupt a transition mid-morph: weights must stay continuous
        // (the crowd re-holds its current blended look before moving on).
        system.driver.transitionTo(2025, 1.2);
        let interruptSumError = 0;
        let interruptNonFinite = 0;
        let interruptDelta = 0;
        let prev = crowd.getEraWeights();
        for (let frame = 0; frame < 40; frame++) {
          system.driver.advance(1 / 60);
          crowd.update(1 / 60);
          const w = crowd.getEraWeights();
          let s = 0;
          for (const era of ALL_ERA_YEARS) {
            if (!Number.isFinite(w[era])) interruptNonFinite += 1;
            s += w[era];
            interruptDelta = Math.max(interruptDelta, Math.abs(w[era] - prev[era]));
          }
          interruptSumError = Math.max(interruptSumError, Math.abs(s - 1));
          prev = w;
        }
        expect(interruptNonFinite).toBe(0);
        expect(interruptSumError).toBeLessThan(1e-6);
        expect(interruptDelta).toBeLessThan(0.35);

        // Finish the interrupted transition.
        for (let frame = 0; frame < 80; frame++) {
          system.driver.advance(1 / 60);
          crowd.update(1 / 60);
        }
        const landed = crowd.getEraWeights();
        expect(landed[2025]).toBeCloseTo(1, 6);
        expect(crowd.getMorphInfo().restingEra).toBe(2025);

        // Pickable descriptors follow the current era.
        const pickables = crowd.getPickables();
        expect(pickables[0].era).toBe(2025);
        expect(pickables[0].label).toContain('2025');
        expect(pickables[0].archetypeKey).toBe(archetypeAt(2025, 0).key);
      } finally {
        crowd.dispose();
        expect(system.registry.size).toBe(0);
      }
    },
    60000,
  );
});

// ---------------------------------------------------------------------------
// Composition with the real gfx library
// ---------------------------------------------------------------------------

describe('ProceduralGfxLibrary composition and instancing', () => {
  it('renders the crowd as instanced meshes with procedural library textures', () => {
    const crowd = createPedestriansModule({
      count: 24,
      seed: 9,
      library: ProceduralGfxLibrary,
    });
    try {
      const children = crowd.group.children;
      expect(children.length).toBeGreaterThan(20);
      for (const child of children) {
        expect(child).toBeInstanceOf(THREE.InstancedMesh);
        const mesh = child as THREE.InstancedMesh;
        expect(mesh.name).toBe('crowdInstancedMesh');
        expect(mesh.count).toBeGreaterThan(0);
        expect(mesh.instanceColor).toBeDefined();
        expect(mesh.frustumCulled).toBe(false);
        expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        const material = mesh.material as THREE.MeshStandardMaterial;
        expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(material.userData.gfxSource).toBe(GFX_TEXTURE_SOURCE);
      }

      // Instance matrices are actually written (figures stand above ground).
      const head = crowd.getSlotMesh('head', 0)!;
      const matrix = new THREE.Matrix4();
      head.getMatrixAt(0, matrix);
      expect(matrix.elements[13]).toBeGreaterThan(1); // translation y (head height)

      const stats = crowd.getStats();
      expect(stats.pedestrians).toBe(24);
      expect(stats.drawCalls).toBe(children.length);
      expect(stats.drawCalls).toBeLessThanOrEqual(96);
      expect(stats.instanceSlots).toBeGreaterThan(24 * 6);

      // Draw calls do not scale with crowd size (instanced grid).
      const big = new PedestriansModule({ count: 96, seed: 11 });
      try {
        expect(big.getStats().pedestrians).toBe(96);
        expect(big.getStats().drawCalls).toBe(stats.drawCalls);
      } finally {
        big.dispose();
      }
    } finally {
      crowd.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Pickables
// ---------------------------------------------------------------------------

describe('pickable descriptors', () => {
  it('exposes representative characters for every archetype slot', () => {
    const crowd = new PedestriansModule({ count: 36, seed: 21 });
    try {
      const pickables = crowd.getPickables();
      expect(pickables).toHaveLength(36);
      const representatives = pickables.filter((p) => p.representative);
      expect(representatives).toHaveLength(ARCHETYPE_SLOTS);
      expect(new Set(representatives.map((p) => p.archetypeKey)).size).toBe(ARCHETYPE_SLOTS);

      const repTags = new Set(representatives.flatMap((p) => [...p.tags]));
      for (const required of ERA_REQUIRED_TAGS[1945 as EraYear]) {
        expect(repTags).toContain(required);
      }
      for (const p of pickables) {
        expect(p.era).toBe(1945);
        expect(p.label).toContain('1945');
        expect(Number.isFinite(p.position.x)).toBe(true);
        expect(p.tags.length).toBeGreaterThan(0);
      }

      const before = pickables[0].position;
      simulate(crowd, 1);
      const after = crowd.getPickables()[0].position;
      const dx = after.x - before.x;
      const dz = after.z - before.z;
      expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThan(0.2);
    } finally {
      crowd.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

describe('module teardown', () => {
  it('unregisters, detaches, and becomes inert on dispose', () => {
    const registry = createEraTransformRegistry();
    const crowd = new PedestriansModule({ count: 18, seed: 8, registry });
    simulate(crowd, 1);
    expect(crowd.getStats().drawCalls).toBeGreaterThan(20);

    crowd.dispose();
    expect(registry.size).toBe(0);
    expect(registry.has(crowd)).toBe(false);
    expect(crowd.group.parent).toBeNull();
    expect(crowd.getStats().drawCalls).toBe(0);
    expect(crowd.getAudioEvents()).toHaveLength(0);

    expect(() => crowd.update(0.016)).not.toThrow();
    expect(() => crowd.applyEraBlend(blendForYear(2025), 0.5, 1)).not.toThrow();
    expect(crowd.getPickables()).toHaveLength(18);
  });
});
