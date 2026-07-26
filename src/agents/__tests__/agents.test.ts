/**
 * Tests for the cyclist & dog agent systems and their framework-free path
 * helpers. The path/stepping logic (gate behavior at the signalized
 * intersection, ping-pong reflection, count caps) is unit-tested directly; the
 * Three.js-backed systems are exercised via the real road network + a fake
 * traffic-light controller to verify counts, era registration, and
 * signal-respecting motion without asserting on rendered pixels.
 */
import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../../world/BlockLayout.js';
import {
  buildAgentPath,
  buildCrossingDogRoutes,
  buildCyclistPaths,
  buildSidewalkPaths,
  sampleAgent,
  stepAgent,
  type AgentPath,
  type AgentState,
  type SignalAxis,
} from '../agentPaths.js';
import { ERA_KEYS } from '../../eras/eraConfig.js';
import { buildEraConveyances } from '../bikes.js';
import { DOG_GAIT_PHASES, buildDogGeometry, dogPalettes } from '../dogs.js';
import { MAX_CYCLISTS, createCyclistSystem } from '../CyclistSystem.js';
import { MAX_DOGS, createDogSystem } from '../DogSystem.js';
import type { SignalPhase } from '../../world/roadNetwork.js';
import type { TrafficLightController } from '../../world/trafficLight.js';

const NETWORK = buildRoadNetwork();

/** A controllable fake controller: returns a fixed phase per axis. */
function fakeController(ew: SignalPhase, ns: SignalPhase): TrafficLightController {
  return {
    update: () => {},
    getPhase: () => ew,
    getComplementaryPhase: () => ns,
    getCycleMs: () => 12000,
    reset: () => {},
  };
}

/** All-red controller — every gate should hold agents. */
const ALL_RED = fakeController('red', 'red');
/** All-green controller — no gate should hold agents. */
const ALL_GREEN = fakeController('green', 'green');

describe('agentPaths — polylines from the shared road network', () => {
  it('derives cycling-lane polylines from the network', () => {
    const paths = buildCyclistPaths(NETWORK);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.total).toBeGreaterThan(0);
      expect(p.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('derives sidewalk polylines from the network', () => {
    const paths = buildSidewalkPaths(NETWORK);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.total).toBeGreaterThan(0);
    }
  });

  it('derives crosswalk crossing routes for dogs', () => {
    const routes = buildCrossingDogRoutes(NETWORK);
    expect(routes.length).toBeGreaterThan(0);
    // Each crossing route must have exactly one signal gate.
    for (const r of routes) {
      expect(r.gates.length).toBe(1);
    }
  });
});

describe('agentPaths — stepping & signal gates', () => {
  it('ping-pongs at both ends of a path', () => {
    const path = buildAgentPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      [],
    );
    const state: AgentState = { d: 0, dir: 1, speed: 5, waiting: false };
    // Travel forward 1s → reach 5; then enough to reflect.
    stepAgent(state, path, 1, () => true);
    expect(state.d).toBeCloseTo(5, 5);
    expect(state.dir).toBe(1);
    // Travel forward 2s more → 5 + 10 = 15 → reflect to 5 (total=10).
    stepAgent(state, path, 2, () => true);
    expect(state.dir).toBe(-1);
    expect(state.d).toBeCloseTo(5, 5);
  });

  it('holds an agent at a closed gate and releases on green', () => {
    // Path of length 10 with a gate spanning [4, 6], governed by the 'ew' axis.
    const path = buildAgentPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      [{ startDist: 4, endDist: 6, axis: 'ew' as SignalAxis }],
    );
    const state: AgentState = { d: 3, dir: 1, speed: 2, waiting: false };

    // Red: agent must stop at the gate start (d=4), not enter the conflict zone.
    stepAgent(state, path, 1, (axis) => axis === 'ew' ? false : true);
    expect(state.d).toBeCloseTo(4, 5);
    expect(state.waiting).toBe(true);

    // Green: agent proceeds through the gate.
    stepAgent(state, path, 1, () => true);
    expect(state.waiting).toBe(false);
    expect(state.d).toBeGreaterThan(4);
  });

  it('clamps distance to the path bounds', () => {
    const path = buildAgentPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
      ],
      [],
    );
    const state: AgentState = { d: 4.9, dir: 1, speed: 100, waiting: false };
    stepAgent(state, path, 1, () => true);
    expect(state.d).toBeLessThanOrEqual(path.total);
    expect(state.d).toBeGreaterThanOrEqual(0);
  });

  it('sampleAgent returns positions along the path', () => {
    const path: AgentPath = buildAgentPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
      ],
      [],
    );
    const s = sampleAgent(path, 2);
    expect(s.pos.x).toBeCloseTo(2, 5);
    expect(s.dir.x).toBeCloseTo(1, 5);
  });
});

describe('bikes — era-correct conveyances', () => {
  it.each(ERA_KEYS)('builds at least one variant for era %s', (era) => {
    const variants = buildEraConveyances(era);
    expect(variants.length).toBeGreaterThanOrEqual(1);
    for (const v of variants) {
      expect(v.geometry).toBeDefined();
      expect(v.weight).toBeGreaterThan(0);
    }
  });

  it('2025 and 2055 each offer two conveyance variants', () => {
    expect(buildEraConveyances('2025').length).toBe(2);
    expect(buildEraConveyances('2055').length).toBe(2);
  });

  it('1945/1965/1985/2005 each offer exactly one variant', () => {
    expect(buildEraConveyances('1945').length).toBe(1);
    expect(buildEraConveyances('1965').length).toBe(1);
    expect(buildEraConveyances('1985').length).toBe(1);
    expect(buildEraConveyances('2005').length).toBe(1);
  });
});

describe('dogs — era-neutral quadruped geometry', () => {
  it('builds a grounded geometry for each gait phase', () => {
    const palettes = dogPalettes();
    for (let phase = 0; phase < DOG_GAIT_PHASES; phase++) {
      const geo = buildDogGeometry(palettes[0], 1, phase);
      geo.computeBoundingBox();
      expect(geo.attributes.position.count).toBeGreaterThan(0);
      // Grounded: lowest point at y ≈ 0.
      expect(geo.boundingBox?.min.y ?? 0).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it('exposes multiple breed palettes for variety', () => {
    expect(dogPalettes().length).toBeGreaterThanOrEqual(3);
  });
});

describe('CyclistSystem', () => {
  it('caps the cyclist population at MAX_CYCLISTS', () => {
    const sys = createCyclistSystem(NETWORK, ALL_GREEN, '1945');
    // The group contains one InstancedMesh per variant; the sum of instance
    // counts equals the population, which must be ≤ MAX_CYCLISTS.
    let totalInstances = 0;
    sys.group.traverse((obj) => {
      if ((obj as { count?: number }).count !== undefined) {
        const c = (obj as { count: number }).count;
        totalInstances += c;
      }
    });
    expect(totalInstances).toBeLessThanOrEqual(MAX_CYCLISTS);
    expect(totalInstances).toBeGreaterThan(0);
    sys.dispose();
  });

  it('registers an era domain callback (applyEra is a function)', () => {
    const sys = createCyclistSystem(NETWORK, ALL_GREEN, '1945');
    expect(typeof sys.applyEra).toBe('function');
    // Calling applyEra for a different era should not throw.
    expect(() => sys.applyEra('2025', 0.5, '1945')).not.toThrow();
    sys.dispose();
  });

  it('advances cyclists forward on green without throwing', () => {
    const sys = createCyclistSystem(NETWORK, ALL_GREEN, '1985');
    expect(() => sys.update(16)).not.toThrow();
    sys.dispose();
  });

  it('updates without throwing on all red (agents wait at gates)', () => {
    const sys = createCyclistSystem(NETWORK, ALL_RED, '1945');
    expect(() => sys.update(16)).not.toThrow();
    sys.dispose();
  });

  it('disposes without throwing', () => {
    const sys = createCyclistSystem(NETWORK, ALL_GREEN, '1945');
    expect(() => sys.dispose()).not.toThrow();
  });
});

describe('DogSystem', () => {
  it('caps the dog population at MAX_DOGS', () => {
    const sys = createDogSystem(NETWORK, ALL_GREEN, '1945');
    let totalInstances = 0;
    sys.group.traverse((obj) => {
      if ((obj as { count?: number }).count !== undefined) {
        totalInstances += (obj as { count: number }).count;
      }
    });
    // Phase meshes + owners + leashes; phase meshes sum to ≤ MAX_DOGS, and
    // owners/leashes are a subset of that.
    expect(totalInstances).toBeLessThanOrEqual(MAX_DOGS * (DOG_GAIT_PHASES + 2));
    sys.dispose();
  });

  it('registers an era domain callback (applyEra is a function)', () => {
    const sys = createDogSystem(NETWORK, ALL_GREEN, '1945');
    expect(typeof sys.applyEra).toBe('function');
    expect(() => sys.applyEra('2055', 1, '1945')).not.toThrow();
    sys.dispose();
  });

  it('advances dogs forward on green without throwing', () => {
    const sys = createDogSystem(NETWORK, ALL_GREEN, '2005');
    expect(() => sys.update(16)).not.toThrow();
    sys.dispose();
  });

  it('updates without throwing on all red (dogs wait at gates)', () => {
    const sys = createDogSystem(NETWORK, ALL_RED, '1945');
    expect(() => sys.update(16)).not.toThrow();
    sys.dispose();
  });

  it('disposes without throwing', () => {
    const sys = createDogSystem(NETWORK, ALL_GREEN, '1945');
    expect(() => sys.dispose()).not.toThrow();
  });
});
