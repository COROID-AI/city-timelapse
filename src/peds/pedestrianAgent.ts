/**
 * Pedestrian agent simulation — the framework-free locomotion brain.
 *
 * Like `roadNetwork.ts` and `trafficLight.ts`, this module contains *no*
 * Three.js code: it is pure, serializable logic that the visual
 * {@link file://./PedestrianSystem.ts} consumes. Each agent walks along the
 * shared `RoadNetwork` walking/crosswalk lanes, waits at crosswalks when
 * vehicles have right-of-way, and avoids clipping its neighbours with a light
 * repulsion field.
 *
 * The simulation is built so it can be unit-tested in isolation (no DOM, no
 * WebGL) — the agent interface exposes world-space positions, wait state, and
 * walk-cycle phase that a test harness can assert directly.
 */

import {
  type LaneAxis,
  type LaneType,
  type RoadNetwork,
  type Vec3,
  getNode,
  vec,
} from '../world/roadNetwork.js';
import type { TrafficLightController } from '../world/trafficLight.js';

// ---------------------------------------------------------------------------
// Position-snapped walk graph
// ---------------------------------------------------------------------------

/**
 * Walking and crosswalk lanes form two disjoint sub-graphs in the raw network
 * (a sidewalk node and a crosswalk endpoint may share the *same* world position
 * but different node ids). To let a pedestrian step from a sidewalk onto a
 * crosswalk we merge coincident nodes by a snapped position key, producing a
 * single connected graph the agents can traverse. This consumes the shared
 * `RoadNetwork` without redefining any lane geometry.
 */
const POS_SNAP = 0.05;

/** Snap a world position to a stable string key (ignores Y — pedestrians are
 *  ground-bound). */
function posKey(p: Vec3): string {
  return `${Math.round(p.x / POS_SNAP)}:${Math.round(p.z / POS_SNAP)}`;
}

/** A junction in the merged walk graph: a snapped position + its neighbours. */
export interface WalkJunction {
  /** Stable key derived from the snapped position. */
  key: string;
  /** World position (shared by every physical node merged into this junction). */
  position: Vec3;
}

/** A walkable connection from one junction to an adjacent one. */
export interface WalkLink {
  /** Destination junction key. */
  to: string;
  /** Lane class of the underlying edge. */
  type: LaneType;
  /** Travel axis of the underlying edge. */
  axis: LaneAxis;
}

/** The connected, traversable walk graph built from a `RoadNetwork`. */
export interface WalkGraph {
  /** All junctions keyed by snapped position. */
  junctions: Map<string, WalkJunction>;
  /** Adjacency list: junction key → outbound links. */
  adjacency: Map<string, WalkLink[]>;
}

/**
 * Build a connected {@link WalkGraph} from the shared road network, merging
 * coincident walking/crosswalk nodes so pedestrians can move between sidewalks
 * and crosswalks. Driving / parking / cycling lanes are ignored.
 */
export function buildWalkGraph(network: RoadNetwork): WalkGraph {
  const junctions = new Map<string, WalkJunction>();
  const adjacency = new Map<string, WalkLink[]>();

  const ensure = (p: Vec3): string => {
    const key = posKey(p);
    if (!junctions.has(key)) {
      junctions.set(key, { key, position: vec(p.x, p.y, p.z) });
      adjacency.set(key, []);
    }
    return key;
  };

  // Seed every walking/crosswalk node so isolated endpoints still exist.
  for (const node of network.nodes) {
    if (node.laneType === 'walking' || node.laneType === 'crosswalk') {
      ensure(node.position);
    }
  }

  // Wire up bidirectional links for walking + crosswalk edges only.
  for (const edge of network.edges) {
    if (edge.laneType !== 'walking' && edge.laneType !== 'crosswalk') {
      continue;
    }
    const from = getNode(network, edge.from);
    const to = getNode(network, edge.to);
    if (!from || !to) {
      continue;
    }
    const fk = ensure(from.position);
    const tk = ensure(to.position);
    adjacency.get(fk)!.push({ to: tk, type: edge.laneType, axis: edge.axis });
    adjacency.get(tk)!.push({ to: fk, type: edge.laneType, axis: edge.axis });
  }

  return { junctions, adjacency };
}

// ---------------------------------------------------------------------------
// Crosswalk right-of-way
// ---------------------------------------------------------------------------

/**
 * Whether pedestrians may currently cross a crosswalk that runs along `axis`.
 *
 * A crosswalk whose travel axis is `north-south` spans the east-west road, so
 * it conflicts with the primary (east-west) signal phase; pedestrians may cross
 * only while that phase is red. The `east-west` crosswalk is governed by the
 * complementary (north-south) phase. Walking lanes never call this — only
 * crosswalk entry does.
 */
export function pedestriansMayCross(
  controller: TrafficLightController,
  axis: LaneAxis,
): boolean {
  if (axis === 'north-south') {
    return controller.getPhase() === 'red';
  }
  return controller.getComplementaryPhase() === 'red';
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/** Walk-cycle phase advance per world unit travelled (controls stride cadence). */
const STRIDE_RATE = 7.0;
/** Repulsion radius (world units) for the light separation field. */
const SEP_RADIUS = 0.7;
/** Maximum separation offset magnitude so agents never drift off the sidewalk. */
const SEP_MAX = 0.35;

/**
 * A single walking pedestrian. The agent tracks its position as an edge
 * traversal (`fromKey → toKey` at `progress` in [0,1]); the visual system reads
 * `position`, `facing`, `phase`, and `waiting` every frame.
 */
export interface PedestrianAgent {
  /** Stable instance id (also the outfit slot index). */
  id: number;
  /** Source junction key of the current segment. */
  fromKey: string;
  /** Destination junction key of the current segment. */
  toKey: string;
  /** Lane class of the current segment (`walking` or `crosswalk`). */
  type: LaneType;
  /** Travel axis of the current segment. */
  axis: LaneAxis;
  /** Normalized traversal progress of the current segment in [0, 1]. */
  progress: number;
  /** Segment length in world units. */
  length: number;
  /** Walking speed in world units per second. */
  speed: number;
  /** Walk-cycle phase in radians (advances with movement, freezes while waiting). */
  phase: number;
  /** True while stopped at a crosswalk curb waiting for vehicles to clear. */
  waiting: boolean;
  /** Position along the segment, before separation (the "rail" position). */
  base: Vec3;
  /** Accumulated separation offset (added to `base` for the final position). */
  sepOffset: Vec3;
  /** Final world position (`base + sepOffset`) consumed by the visual mesh. */
  position: Vec3;
  /** Facing yaw in radians, derived from travel direction. */
  facing: number;
}

/** A random source so tests can inject determinism; defaults to `Math.random`. */
export type RandFn = () => number;

/**
 * Create an agent placed on a random walking segment of the graph. The agent
 * never spawns on a crosswalk (so it does not begin mid-crossing).
 */
export function createAgent(
  id: number,
  graph: WalkGraph,
  rand: RandFn = Math.random,
): PedestrianAgent {
  // Prefer walking-only starting segments.
  const walkStarts: Array<{ from: string; to: string; type: LaneType; axis: LaneAxis }> = [];
  for (const [from, links] of graph.adjacency) {
    for (const link of links) {
      if (link.type === 'walking') {
        walkStarts.push({ from, to: link.to, type: link.type, axis: link.axis });
      }
    }
  }
  const start = walkStarts.length > 0
    ? walkStarts[Math.floor(rand() * walkStarts.length)]
    : pickAnyLink(graph, rand);

  const fromPos = graph.junctions.get(start.from)!.position;
  const toPos = graph.junctions.get(start.to)!.position;
  const length = distance(fromPos, toPos);

  const progress = rand();
  const base = lerpVec(fromPos, toPos, progress);

  return {
    id,
    fromKey: start.from,
    toKey: start.to,
    type: start.type,
    axis: start.axis,
    progress,
    length,
    speed: 0.9 + rand() * 0.7, // 0.9–1.6 u/s — a relaxed human stroll
    phase: rand() * Math.PI * 2,
    waiting: false,
    base,
    sepOffset: vec(0, 0, 0),
    position: vec(base.x, base.y, base.z),
    facing: yawBetween(fromPos, toPos),
  };
}

/**
 * Advance the whole population one step: per-agent movement + crosswalk waiting,
 * then a single O(n²) separation pass (the population is capped, so this is
 * cheap). Mutates agents in place.
 */
export function stepAgents(
  agents: PedestrianAgent[],
  deltaSec: number,
  graph: WalkGraph,
  controller: TrafficLightController,
): void {
  const dt = Math.min(deltaSec, 0.1); // clamp huge frames so nobody tunnels

  // 1. Movement + crosswalk right-of-way.
  for (const agent of agents) {
    moveAgent(agent, dt, graph, controller);
  }

  // 2. Separation: decay each offset, then add pairwise repulsion.
  for (const agent of agents) {
    agent.sepOffset.x *= 0.6;
    agent.sepOffset.z *= 0.6;
  }
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      const dx = a.base.x - b.base.x;
      const dz = a.base.z - b.base.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= SEP_RADIUS * SEP_RADIUS || d2 < 1e-6) {
        continue;
      }
      const d = Math.sqrt(d2);
      const push = (SEP_RADIUS - d) / SEP_RADIUS * 0.5;
      const nx = (dx / d) * push;
      const nz = (dz / d) * push;
      a.sepOffset.x += nx;
      a.sepOffset.z += nz;
      b.sepOffset.x -= nx;
      b.sepOffset.z -= nz;
    }
  }

  // 3. Resolve final positions, clamping the separation offset.
  for (const agent of agents) {
    const m = Math.hypot(agent.sepOffset.x, agent.sepOffset.z);
    if (m > SEP_MAX) {
      const s = SEP_MAX / m;
      agent.sepOffset.x *= s;
      agent.sepOffset.z *= s;
    }
    agent.position.x = agent.base.x + agent.sepOffset.x;
    agent.position.y = agent.base.y + agent.sepOffset.y;
    agent.position.z = agent.base.z + agent.sepOffset.z;
  }
}

/**
 * Move a single agent along its current segment, enforcing crosswalk
 * right-of-way at the curb and advancing to a new segment on arrival.
 */
function moveAgent(
  agent: PedestrianAgent,
  dt: number,
  graph: WalkGraph,
  controller: TrafficLightController,
): void {
  const atCrosswalkCurb =
    agent.type === 'crosswalk' && agent.progress < 0.001;

  if (atCrosswalkCurb && !pedestriansMayCross(controller, agent.axis)) {
    // Hold at the curb until vehicles clear. The walk cycle freezes (standing).
    agent.waiting = true;
    syncBase(agent, graph);
    return;
  }
  agent.waiting = false;

  const move = agent.speed * dt;
  agent.progress += move / Math.max(agent.length, 1e-3);
  agent.phase += move * STRIDE_RATE;

  if (agent.progress >= 1) {
    advanceSegment(agent, graph);
  }
  syncBase(agent, graph);
}

/** Recompute the agent's rail position + facing from its segment + progress. */
function syncBase(agent: PedestrianAgent, graph: WalkGraph): void {
  const from = graph.junctions.get(agent.fromKey);
  const to = graph.junctions.get(agent.toKey);
  if (!from || !to) {
    return;
  }
  const p = clamp01(agent.progress);
  agent.base.x = from.position.x + (to.position.x - from.position.x) * p;
  agent.base.y = from.position.y + (to.position.y - from.position.y) * p;
  agent.base.z = from.position.z + (to.position.z - from.position.z) * p;
  agent.facing = yawBetween(from.position, to.position);
}

/**
 * On arrival at `toKey`, choose the next outbound link — preferring to continue
 * rather than immediately reverse, and allowing dead-end turnaround. The agent
 * then begins the new segment at progress 0 (any overshoot is discarded, which
 * keeps agents aligned to junctions).
 */
function advanceSegment(agent: PedestrianAgent, graph: WalkGraph): void {
  const links = graph.adjacency.get(agent.toKey);
  if (!links || links.length === 0) {
    // Truly isolated — stay put at the junction.
    agent.progress = 1;
    return;
  }

  const forward = links.filter((l) => l.to !== agent.fromKey);
  const choices = forward.length > 0 ? forward : links;
  const next = choices[Math.floor(Math.random() * choices.length)];

  const fromPos = graph.junctions.get(agent.toKey)!.position;
  const toPos = graph.junctions.get(next.to)?.position;

  agent.fromKey = agent.toKey;
  agent.toKey = next.to;
  agent.type = next.type;
  agent.axis = next.axis;
  agent.length = toPos ? distance(fromPos, toPos) : agent.length;
  agent.progress = 0;
}

// ---------------------------------------------------------------------------
// Small vector helpers (no Three.js dependency)
// ---------------------------------------------------------------------------

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return vec(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Facing yaw so a model's +Z faces from `a` toward `b`. */
function yawBetween(a: Vec3, b: Vec3): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Pick any link in the graph (fallback when no walking-only start exists). */
function pickAnyLink(graph: WalkGraph, rand: RandFn): { from: string; to: string; type: LaneType; axis: LaneAxis } {
  for (const [from, links] of graph.adjacency) {
    if (links.length > 0) {
      const link = links[Math.floor(rand() * links.length)];
      return { from, to: link.to, type: link.type, axis: link.axis };
    }
  }
  // Graph is completely empty — should not happen for a real network.
  return { from: '', to: '', type: 'walking', axis: 'east-west' };
}
