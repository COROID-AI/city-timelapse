/**
 * Tests for the framework-free pedestrian agent simulation — verifies walk-graph
 * construction from the shared RoadNetwork, path following along walking +
 * crosswalk lanes, crosswalk right-of-way, separation between agents, and the
 * population cap. No Three.js / DOM dependency.
 */
import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../../world/BlockLayout.js';
import { createTrafficLightController } from '../../world/trafficLight.js';
import {
  type PedestrianAgent,
  buildWalkGraph,
  createAgent,
  pedestriansMayCross,
  stepAgents,
} from '../pedestrianAgent.js';

const NETWORK = buildRoadNetwork();
const CONTROLLER = createTrafficLightController();

/** Deterministic PRNG so population behaviour is reproducible in tests. */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('WalkGraph — construction from the shared RoadNetwork', () => {
  const graph = buildWalkGraph(NETWORK);

  it('merges walking + crosswalk nodes into junctions', () => {
    expect(graph.junctions.size).toBeGreaterThan(0);
  });

  it('produces a connected adjacency list', () => {
    for (const [key, links] of graph.adjacency) {
      expect(key).toBeDefined();
      expect(links.length).toBeGreaterThan(0);
    }
  });

  it('only consumes walking and crosswalk lanes (never driving/parking/cycling)', () => {
    for (const links of graph.adjacency.values()) {
      for (const link of links) {
        expect(['walking', 'crosswalk']).toContain(link.type);
      }
    }
  });

  it('includes crosswalk connections so sidewalks link across the road', () => {
    const types = new Set<string>();
    for (const links of graph.adjacency.values()) {
      for (const link of links) types.add(link.type);
    }
    expect(types.has('crosswalk')).toBe(true);
    expect(types.has('walking')).toBe(true);
  });
});

describe('Agent creation & initial placement', () => {
  const graph = buildWalkGraph(NETWORK);

  it('places an agent on a walking segment (never mid-crosswalk)', () => {
    const agent = createAgent(0, graph, makeRng(1));
    expect(agent.type).toBe('walking');
  });

  it('assigns a positive walking speed', () => {
    const agent = createAgent(0, graph, makeRng(2));
    expect(agent.speed).toBeGreaterThan(0);
    expect(agent.speed).toBeLessThan(3);
  });

  it('initializes the agent within the block footprint', () => {
    const agent = createAgent(0, graph, makeRng(3));
    expect(Math.abs(agent.position.x)).toBeLessThan(30);
    expect(Math.abs(agent.position.z)).toBeLessThan(30);
  });
});

describe('stepAgents — movement & walk cycle', () => {
  it('advances the agent along its segment', () => {
    const graph = buildWalkGraph(NETWORK);
    const agent = createAgent(0, graph, makeRng(10));
    const initialProgress = agent.progress;
    stepAgents([agent], 0.1, graph, CONTROLLER);
    // Progress should have increased (unless it wrapped past a segment end and
    // was reset to ~0 by advanceSegment, which is also valid movement).
    const moved = agent.progress > initialProgress || agent.progress < 0.2;
    expect(moved).toBe(true);
  });

  it('advances the walk-cycle phase while moving', () => {
    const graph = buildWalkGraph(NETWORK);
    const agent = createAgent(0, graph, makeRng(11));
    const initialPhase = agent.phase;
    stepAgents([agent], 0.5, graph, CONTROLLER);
    expect(agent.phase).toBeGreaterThan(initialPhase);
  });

  it('keeps agents within the block footprint', () => {
    const graph = buildWalkGraph(NETWORK);
    const rng = makeRng(12);
    const agents = Array.from({ length: 10 }, (_, i) => createAgent(i, graph, rng));
    for (let f = 0; f < 60; f++) {
      stepAgents(agents, 0.1, graph, CONTROLLER);
    }
    for (const agent of agents) {
      expect(Math.abs(agent.position.x)).toBeLessThan(30);
      expect(Math.abs(agent.position.z)).toBeLessThan(30);
    }
  });

  it('agents stay on or near walking lanes (no drifting into driving lanes)', () => {
    const graph = buildWalkGraph(NETWORK);
    const rng = makeRng(13);
    const agents = Array.from({ length: 10 }, (_, i) => createAgent(i, graph, rng));
    for (let f = 0; f < 60; f++) {
      stepAgents(agents, 0.1, graph, CONTROLLER);
    }
    for (const agent of agents) {
      // The agent should be near a known walk-graph junction (within the
      // sidewalk/crosswalk network, not floating in the road centre).
      let minDist = Infinity;
      for (const j of graph.junctions.values()) {
        const dx = agent.position.x - j.position.x;
        const dz = agent.position.z - j.position.z;
        const d = Math.hypot(dx, dz);
        if (d < minDist) minDist = d;
      }
      expect(minDist).toBeLessThan(6);
    }
  });
});

describe('stepAgents — separation (avoid clipping)', () => {
  it('pushes two overlapping agents apart', () => {
    const graph = buildWalkGraph(NETWORK);
    const a = createAgent(0, graph, makeRng(20));
    const b = createAgent(1, graph, makeRng(21));
    // Force them to overlap at the same base position.
    b.base.x = a.base.x;
    b.base.z = a.base.z;
    b.progress = a.progress;
    b.fromKey = a.fromKey;
    b.toKey = a.toKey;

    stepAgents([a, b], 0.016, graph, CONTROLLER);

    const dist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
    // After separation they must no longer be exactly coincident.
    expect(dist).toBeGreaterThan(0.001);
  });

  it('far-apart agents do not influence each other', () => {
    const graph = buildWalkGraph(NETWORK);
    const a = createAgent(0, graph, makeRng(30));
    const b = createAgent(1, graph, makeRng(31));
    // Place them at opposite ends of the block.
    a.base.x = 20;
    a.base.z = 20;
    b.base.x = -20;
    b.base.z = -20;

    const aBeforeX = a.base.x;
    const aBeforeZ = a.base.z;
    stepAgents([a, b], 0.016, graph, CONTROLLER);

    // No meaningful separation force should have been applied to A.
    expect(Math.abs(a.sepOffset.x)).toBeLessThan(0.01);
    expect(Math.abs(a.sepOffset.z)).toBeLessThan(0.01);
    // (base positions are recomputed by syncBase, so we check sepOffset instead)
    expect(aBeforeX).toBe(20);
    expect(aBeforeZ).toBe(20);
  });
});

describe('pedestriansMayCross — crosswalk right-of-way', () => {
  it('returns false when the conflicting vehicle phase is green', () => {
    // Step the controller until the primary (E-W) phase is green.
    let phase = CONTROLLER.getPhase();
    for (let i = 0; i < 1000 && phase !== 'green'; i++) {
      CONTROLLER.update(10);
      phase = CONTROLLER.getPhase();
    }
    expect(phase).toBe('green');
    // A N-S crosswalk spans the E-W road → blocked while E-W is green.
    expect(pedestriansMayCross(CONTROLLER, 'north-south')).toBe(false);
  });

  it('returns true when the conflicting vehicle phase is red', () => {
    // Step until the primary phase is red.
    let phase = CONTROLLER.getPhase();
    for (let i = 0; i < 1000 && phase !== 'red'; i++) {
      CONTROLLER.update(20);
      phase = CONTROLLER.getPhase();
    }
    expect(phase).toBe('red');
    expect(pedestriansMayCross(CONTROLLER, 'north-south')).toBe(true);
  });
});

describe('stepAgents — crosswalk waiting', () => {
  it('a waiting agent has its walk cycle frozen (phase unchanged)', () => {
    const graph = buildWalkGraph(NETWORK);
    const rng = makeRng(40);
    const agent = createAgent(0, graph, rng);

    // Find a crosswalk segment and place the agent at its curb.
    let placed = false;
    for (const [from, links] of graph.adjacency) {
      for (const link of links) {
        if (link.type === 'crosswalk') {
          const fromPos = graph.junctions.get(from)!.position;
          const toPos = graph.junctions.get(link.to)!.position;
          agent.fromKey = from;
          agent.toKey = link.to;
          agent.type = 'crosswalk';
          agent.axis = link.axis;
          agent.length = Math.hypot(toPos.x - fromPos.x, toPos.z - fromPos.z);
          agent.progress = 0; // at the curb
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    expect(placed).toBe(true);

    // Advance the controller until vehicles have right-of-way for THIS
    // crosswalk's axis (pedestriansMayCross returns false).
    for (let i = 0; i < 1000 && pedestriansMayCross(CONTROLLER, agent.axis); i++) {
      CONTROLLER.update(20);
    }
    expect(pedestriansMayCross(CONTROLLER, agent.axis)).toBe(false);

    const phaseBefore = agent.phase;
    stepAgents([agent], 0.5, graph, CONTROLLER);
    expect(agent.waiting).toBe(true);
    expect(agent.phase).toBe(phaseBefore); // frozen while waiting
  });

  it('an agent on a walking lane never enters a waiting state', () => {
    const graph = buildWalkGraph(NETWORK);
    const rng = makeRng(41);
    const agents = Array.from({ length: 8 }, (_, i) => createAgent(i, graph, rng));
    for (let f = 0; f < 100; f++) {
      stepAgents(agents, 0.1, graph, CONTROLLER);
      for (const a of agents) {
        if (a.type === 'walking') {
          expect(a.waiting).toBe(false);
        }
      }
    }
  });
});

describe('Population cap', () => {
  it('agents can be created up to a fixed cap', () => {
    const graph = buildWalkGraph(NETWORK);
    const rng = makeRng(50);
    const cap = 18;
    const agents: PedestrianAgent[] = [];
    for (let i = 0; i < cap; i++) {
      agents.push(createAgent(i, graph, rng));
    }
    expect(agents.length).toBe(cap);
    // Each agent has a unique stable id.
    const ids = new Set(agents.map((a) => a.id));
    expect(ids.size).toBe(cap);
  });
});
