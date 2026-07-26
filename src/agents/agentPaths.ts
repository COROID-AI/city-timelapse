/**
 * Framework-free path + agent-stepping helpers for cyclists and dogs.
 *
 * Both agent systems consume the *shared* {@link RoadNetwork} (they never
 * redefine lane geometry). This module turns the network's typed lane edges
 * into parametric agent paths, computes where each path crosses the driving
 * conflict zone (the signalized intersection / a crosswalk over a driving
 * lane), and advances agents along their path while obeying the traffic
 * signal. It is pure data + math — no Three.js — so it unit-tests cleanly and
 * mirrors the `roadNetwork` (pure) vs `BlockLayout` (visual) split.
 *
 * Agents ping-pong along a one-way polyline (forward then reverse) so they
 * stay inside their lane and never need a cyclic graph. Where a path enters
 * the driving conflict zone, a {@link PathGate} records the along-path
 * distance range and the signal axis that governs it; {@link stepAgent} holds
 * the agent at the gate's near edge while that axis is not green.
 */

import type { LaneAxis, LaneType, RoadNetwork, Vec3 } from '../world/roadNetwork.js';

// ---------------------------------------------------------------------------
// Small vector helpers (operate on the plain serializable Vec3)
// ---------------------------------------------------------------------------

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}
function dist2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Map a lane axis to the signal-axis name used by gates. */
export type SignalAxis = 'ew' | 'ns';

function axisToSignal(axis: LaneAxis): SignalAxis {
  return axis === 'east-west' ? 'ew' : 'ns';
}

// ---------------------------------------------------------------------------
// Polylines from the road network
// ---------------------------------------------------------------------------

/** An ordered polyline of world positions plus its dominant lane axis. */
export interface Polyline {
  points: Vec3[];
  axis: LaneAxis;
}

function deriveAxis(points: Vec3[]): LaneAxis {
  let dx = 0;
  let dz = 0;
  for (let i = 1; i < points.length; i++) {
    dx += Math.abs(points[i].x - points[i - 1].x);
    dz += Math.abs(points[i].z - points[i - 1].z);
  }
  return dx >= dz ? 'east-west' : 'north-south';
}

/**
 * Build ordered polylines from the edges of one lane type by following the
 * directed `from → to` chain. Walking / cycling lanes are emitted as linear
 * chains; crosswalk edges (single segments) become 2-point polylines.
 */
export function buildPolylines(network: RoadNetwork, type: LaneType): Polyline[] {
  const posById = new Map<string, Vec3>();
  for (const n of network.nodes) {
    posById.set(n.id, n.position);
  }

  const outAdj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  const fromIds = new Set<string>();
  for (const e of network.edges) {
    if (e.laneType !== type) continue;
    if (!outAdj.has(e.from)) outAdj.set(e.from, []);
    outAdj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    indeg.set(e.from, indeg.get(e.from) ?? 0);
    fromIds.add(e.from);
  }

  // Chain starts are `from` nodes with no inbound edge of this lane type.
  const starts = [...fromIds].filter((id) => (indeg.get(id) ?? 0) === 0);
  const usedEdge = new Set<string>();
  const polylines: Polyline[] = [];

  for (const start of starts) {
    const points: Vec3[] = [];
    let cur: string | undefined = start;
    while (cur) {
      const p = posById.get(cur);
      if (p) points.push(p);
      const nexts = outAdj.get(cur);
      let next: string | undefined;
      if (nexts) {
        for (const candidate of nexts) {
          const key = `${cur}->${candidate}`;
          if (!usedEdge.has(key)) {
            usedEdge.add(key);
            next = candidate;
            break;
          }
        }
      }
      cur = next;
    }
    if (points.length >= 2) {
      polylines.push({ points, axis: deriveAxis(points) });
    }
  }
  return polylines;
}

/**
 * Classify a crosswalk edge id by which road it crosses:
 *  - `xwalk-ew-*` stripes run across the east-west road → governed by the
 *    east-west signal phase.
 *  - `xwalk-ns-*` stripes run across the north-south road → governed by the
 *    complementary (north-south) phase.
 */
export function classifyCrosswalkAxis(edgeId: string): SignalAxis | null {
  if (edgeId.startsWith('xwalk-ew-')) return 'ew';
  if (edgeId.startsWith('xwalk-ns-')) return 'ns';
  return null;
}

// ---------------------------------------------------------------------------
// Agent path + signal gates
// ---------------------------------------------------------------------------

/** A span along a path that crosses a driving lane and is gated by a signal. */
export interface PathGate {
  /** Distance along the path where the conflict zone begins. */
  startDist: number;
  /** Distance along the path where the conflict zone ends. */
  endDist: number;
  /** Signal axis governing this crossing. */
  axis: SignalAxis;
}

/** A parametric path for a moving agent: points, cumulative distances, gates. */
export interface AgentPath {
  /** Ordered world points (the agent ping-pongs along these). */
  points: Vec3[];
  /** Per-segment length. */
  segLen: number[];
  /** Cumulative distance at each point (point 0 = 0). */
  cum: number[];
  /** Total path length. */
  total: number;
  /** Signal-gated conflict zones along the path. */
  gates: PathGate[];
}

/** Build an {@link AgentPath} from ordered points and explicit gates. */
export function buildAgentPath(points: Vec3[], gates: PathGate[] = []): AgentPath {
  const segLen: number[] = [];
  const cum: number[] = [0];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const l = len(sub(points[i + 1], points[i]));
    segLen.push(l);
    total += l;
    cum.push(total);
  }
  return { points, segLen, cum, total, gates };
}

/** A moving agent's state along an {@link AgentPath}. */
export interface AgentState {
  /** Distance along the path in [0, total]. */
  d: number;
  /** Current travel direction (+1 forward, -1 reverse). */
  dir: 1 | -1;
  /** Speed in world units per second. */
  speed: number;
  /** True while held at a closed signal gate. */
  waiting: boolean;
}

export interface Sampled {
  pos: Vec3;
  /** Unit tangent in the forward-index direction (scale by `dir` for heading). */
  dir: Vec3;
}

/** Sample position + forward tangent at distance `d` along a path. */
export function sampleAgent(path: AgentPath, d: number): Sampled {
  const { points, segLen, cum, total } = path;
  const clamped = total <= 0 ? 0 : Math.max(0, Math.min(total, d));
  // Locate the segment containing `d`.
  let i = 0;
  for (let k = 0; k < segLen.length; k++) {
    if (clamped >= cum[k] && clamped <= cum[k + 1] + 1e-9) {
      i = k;
      break;
    }
    if (k === segLen.length - 1) i = k; // clamp to last segment
  }
  const seg = Math.max(segLen[i], 1e-9);
  const t = (clamped - cum[i]) / seg;
  const pos = lerpVec(points[i], points[i + 1], Math.max(0, Math.min(1, t)));
  let tangent = sub(points[i + 1], points[i]);
  const tl = len(tangent);
  if (tl < 1e-9) tangent = { x: 0, y: 0, z: 1 };
  else tangent = scale(tangent, 1 / tl);
  return { pos, dir: tangent };
}

/**
 * Advance an agent one step, obeying signal gates and reflecting at the ends.
 *
 * `isGreen(axis)` is queried per gate: when the governing axis is not green the
 * agent is held at the gate's near edge (the start when travelling forward, the
 * end when travelling in reverse). At a path end the agent reverses direction.
 */
export function stepAgent(
  state: AgentState,
  path: AgentPath,
  dt: number,
  isGreen: (axis: SignalAxis) => boolean,
): void {
  if (path.total <= 0) return;
  state.waiting = false;

  let nd = state.d + state.dir * state.speed * dt;

  // Signal gates: hold at the near edge while the governing axis is not green.
  for (const g of path.gates) {
    if (isGreen(g.axis)) continue;
    if (state.dir === 1) {
      if (state.d <= g.startDist + 1e-6 && nd > g.startDist) {
        nd = g.startDist;
        state.waiting = true;
      }
    } else {
      if (state.d >= g.endDist - 1e-6 && nd < g.endDist) {
        nd = g.endDist;
        state.waiting = true;
      }
    }
  }

  // Reflect at either end (ping-pong).
  if (nd > path.total) {
    nd = path.total - (nd - path.total);
    state.dir = -1;
  } else if (nd < 0) {
    nd = -nd;
    state.dir = 1;
  }
  state.d = Math.max(0, Math.min(path.total, nd));
}

// ---------------------------------------------------------------------------
// Network → agent paths
// ---------------------------------------------------------------------------

/**
 * Derive the driving conflict zone half-extents from the crosswalk node
 * positions (a crosswalk over the E-W road sits at |x| = asphalt half-width;
 * one over the N-S road sits at |z| = asphalt half-width). Derived purely from
 * the network so this module stays Three.js-free.
 */
function conflictBoxHalfExtents(network: RoadNetwork): { hx: number; hz: number } {
  let hx = 0;
  let hz = 0;
  for (const e of network.edges) {
    if (e.laneType !== 'crosswalk') continue;
    const cls = classifyCrosswalkAxis(e.id);
    if (!cls) continue;
    for (const id of [e.from, e.to]) {
      const node = network.nodes.find((n) => n.id === id);
      if (!node) continue;
      if (cls === 'ew') hx = Math.max(hx, Math.abs(node.position.x));
      else hz = Math.max(hz, Math.abs(node.position.z));
    }
  }
  return { hx, hz };
}

/** True if a world point lies inside the central driving conflict zone. */
function inConflictZone(p: Vec3, hx: number, hz: number): boolean {
  return Math.abs(p.x) < hx && Math.abs(p.z) < hz;
}

/**
 * Build cyclist paths from the network's cycling lanes. Each path is one
 * cycling-lane polyline (ping-ponged end-to-end) with a signal gate over the
 * central intersection — the stretch where the cycle lane crosses the driving
 * conflict zone. Cyclists therefore stay in cycle lanes and stop at the
 * intersection on a red signal for their axis.
 */
export function buildCyclistPaths(network: RoadNetwork): AgentPath[] {
  const lanes = buildPolylines(network, 'cycling');
  const { hx, hz } = conflictBoxHalfExtents(network);

  const paths: AgentPath[] = [];
  for (const lane of lanes) {
    const points = lane.points;
    const path = buildAgentPath(points);
    const axis = axisToSignal(lane.axis);

    // Union of contiguous segments that lie inside the conflict zone → one gate.
    const gates: PathGate[] = [];
    let gateStart: number | null = null;
    for (let i = 0; i < points.length - 1; i++) {
      const inside = inConflictZone(points[i], hx, hz) && inConflictZone(points[i + 1], hx, hz);
      if (inside && gateStart === null) {
        gateStart = path.cum[i];
      } else if (!inside && gateStart !== null) {
        gates.push({ startDist: gateStart, endDist: path.cum[i], axis });
        gateStart = null;
      }
    }
    if (gateStart !== null) {
      gates.push({ startDist: gateStart, endDist: path.total, axis });
    }
    path.gates = gates;
    paths.push(path);
  }
  return paths;
}

/** Sidewalk paths (walking lanes) for dogs that stay on the sidewalk. */
export function buildSidewalkPaths(network: RoadNetwork): AgentPath[] {
  return buildPolylines(network, 'walking').map((p) => buildAgentPath(p.points));
}

function nearestPolyline(polylines: Polyline[], target: Vec3): Polyline | null {
  let best: Polyline | null = null;
  let bestD = Infinity;
  for (const poly of polylines) {
    for (const pt of poly.points) {
      const d = dist2(pt, target);
      if (d < bestD) {
        bestD = d;
        best = poly;
      }
    }
  }
  return best;
}

function nearestEndpointIndex(points: Vec3[], target: Vec3): 0 | (typeof points)['length'] {
  const d0 = dist2(points[0], target);
  const dLast = dist2(points[points.length - 1], target);
  return d0 <= dLast ? 0 : points.length - 1;
}

/**
 * Build dog crossing routes from the network: sidewalk → crosswalk → sidewalk,
 * forming a U-shaped path that crosses a driving lane once. The crosswalk
 * segment is gated by the signal axis of the road it crosses, so a dog waits
 * at the curb until that axis is green.
 */
export function buildCrossingDogRoutes(network: RoadNetwork): AgentPath[] {
  const sidewalks = buildPolylines(network, 'walking');
  const routes: AgentPath[] = [];

  for (const edge of network.edges) {
    if (edge.laneType !== 'crosswalk') continue;
    const cls = classifyCrosswalkAxis(edge.id);
    if (!cls) continue;
    const a = network.nodes.find((n) => n.id === edge.from)?.position;
    const b = network.nodes.find((n) => n.id === edge.to)?.position;
    if (!a || !b) continue;

    const pa = nearestPolyline(sidewalks, a);
    const pb = nearestPolyline(sidewalks, b);
    if (!pa || !pb || pa === pb) continue;

    // Orient each sidewalk so the route walks toward `a`, then crosses to `b`.
    const endIdxA = nearestEndpointIndex(pa.points, a);
    const halfA = endIdxA === 0 ? [...pa.points].reverse() : [...pa.points];
    const startIdxB = nearestEndpointIndex(pb.points, b);
    const halfB = startIdxB === 0 ? [...pb.points] : [...pb.points].reverse();

    const route = [...halfA, ...halfB];
    const path = buildAgentPath(route);
    // The crosswalk is the segment connecting halfA's end to halfB's start.
    const segIdx = halfA.length - 1;
    if (segIdx >= 0 && segIdx < path.segLen.length) {
      path.gates = [
        { startDist: path.cum[segIdx], endDist: path.cum[segIdx + 1], axis: cls },
      ];
    }
    routes.push(path);
  }
  return routes;
}
