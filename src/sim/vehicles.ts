import type { EraLayout } from '../types';
import type { MeshProvider } from './profiles';
import { randRange, type RandomFn } from './profiles';

/**
 * Era-agnostic vehicle agents.
 *
 * Vehicles drive clockwise around rectangular lane loops that surround the
 * city block. They support three behaviours required by the brief:
 *   - lane driving (following a fixed lane loop at a profile-tuned speed),
 *   - curbside parking (pulling over to the inner lane and stopping for a
 *     while before resuming),
 *   - stop-and-go (slowing or stopping for following-distance and random
 *     "traffic" pauses).
 *
 * The module never branches on era: counts, speeds, and meshes are injected
 * via profiles and providers.
 */

/** A 2D world position (x = width, z = depth). */
export interface Position2D {
  x: number;
  z: number;
}

/** Vehicle agent state machine. */
export type VehicleState = 'driving' | 'parked' | 'stopped';

/** One vehicle agent. */
export interface VehicleAgent {
  id: number;
  /** Lane index 0..laneCount-1; 0 is the innermost (curbside) lane. */
  lane: number;
  /** Distance travelled along the lane loop (world units, wraps at perimeter). */
  positionOnLoop: number;
  /** Current speed in world units / second. */
  speed: number;
  /** Profile-derived maximum speed for this agent. */
  maxSpeed: number;
  /** Current behaviour state. */
  state: VehicleState;
  /** Seconds remaining in the current parked / stopped state. */
  stateRemaining: number;
  /** The era mesh attached to this agent (from the active provider). */
  mesh: unknown;
  /** Id of the provider that built {@link mesh}. */
  providerId: string;
}

/** Geometry describing one rectangular lane loop around the block. */
export interface LaneLoop {
  lane: number;
  radius: number;
  perimeter: number;
}

/**
 * Build the lane loops for a layout. Lanes are concentric rectangular loops
 * surrounding the block, from the innermost (curbside) lane outward.
 */
export function buildLaneLoops(layout: EraLayout): LaneLoop[] {
  const half = layout.block.width / 2;
  const laneWidth = layout.street.width / layout.street.laneCount;
  const loops: LaneLoop[] = [];
  for (let i = 0; i < layout.street.laneCount; i++) {
    // Offset from the block edge: curb depth + half the lane width + lane index.
    const radius = half + layout.curb.depth + laneWidth * (i + 0.5);
    loops.push({ lane: i, radius, perimeter: 8 * radius });
  }
  return loops;
}

/** Convert a distance along a lane loop into a world position. */
export function laneLoopPosition(loop: LaneLoop, t: number): Position2D {
  const r = loop.radius;
  const side = 2 * r;
  const mod = ((t % loop.perimeter) + loop.perimeter) % loop.perimeter;
  if (mod < side) {
    // Top edge: x increases.
    return { x: -r + mod, z: r };
  }
  if (mod < 2 * side) {
    // Right edge: z decreases.
    return { x: r, z: r - (mod - side) };
  }
  if (mod < 3 * side) {
    // Bottom edge: x decreases.
    return { x: r - (mod - 2 * side), z: -r };
  }
  // Left edge: z increases.
  return { x: -r, z: -r + (mod - 3 * side) };
}

/** Create a fresh set of vehicle agents for a profile. */
export function createVehicleAgents(
  layout: EraLayout,
  count: number,
  speedMin: number,
  speedMax: number,
  providerId: string,
  rng: RandomFn,
): VehicleAgent[] {
  const loops = buildLaneLoops(layout);
  const agents: VehicleAgent[] = [];
  for (let i = 0; i < count; i++) {
    const lane = i % loops.length;
    const loop = loops[lane];
    const maxSpeed = randRange(rng, speedMin, speedMax);
    agents.push({
      id: i,
      lane,
      positionOnLoop: rng() * loop.perimeter,
      speed: maxSpeed,
      maxSpeed,
      state: 'driving',
      stateRemaining: 0,
      mesh: undefined,
      providerId,
    });
  }
  return agents;
}

/**
 * Advance all vehicles by `dt` seconds.
 *
 * `pedestrians` is passed so vehicles can stop-and-go when a pedestrian is
 * near a crossing, giving the street a believable shared rhythm.
 */
export function updateVehicles(
  agents: VehicleAgent[],
  loops: LaneLoop[],
  dt: number,
  pedestrians: readonly { position: Position2D }[],
  rng: RandomFn,
): void {
  for (const agent of agents) {
    const loop = loops[agent.lane];
    const ahead = agents
      .filter((o) => o.id !== agent.id && o.lane === agent.lane)
      .map((o) => {
        // Signed circular distance from agent to the vehicle ahead.
        let d = (o.positionOnLoop - agent.positionOnLoop) % loop.perimeter;
        if (d < 0) d += loop.perimeter;
        return d;
      })
      .filter((d) => d > 0)
      .sort((a, b) => a - b)[0];

    // Stop-and-go: follow the vehicle ahead with a minimum gap.
    const FOLLOW_GAP = 6.0;
    const slowForTraffic = ahead !== undefined && ahead < FOLLOW_GAP;

    // Stop-and-go: pause briefly for pedestrians near a crossing.
    const nearCrossing = pedestrians.some((p) => {
      const pos = laneLoopPosition(loop, agent.positionOnLoop);
      return Math.abs(pos.x - p.position.x) < 3.0 && Math.abs(pos.z - p.position.z) < 3.0;
    });

    switch (agent.state) {
      case 'driving': {
        if (agent.stateRemaining > 0) {
          // A scheduled stop is active.
          agent.stateRemaining -= dt;
          if (agent.stateRemaining <= 0) {
            agent.stateRemaining = 0;
            agent.state = 'driving';
          } else {
            agent.speed = 0;
          }
          break;
        }
        if (slowForTraffic || nearCrossing) {
          agent.speed = Math.max(0, agent.speed - 3.0 * dt);
        } else {
          agent.speed = Math.min(agent.maxSpeed, agent.speed + 2.0 * dt);
        }
        // Random stop-and-go / traffic-light pause.
        if (agent.speed > 0.1 && rng() < 0.002 * dt * 60) {
          agent.state = 'stopped';
          agent.stateRemaining = randRange(rng, 0.5, 2.0);
          agent.speed = 0;
          break;
        }
        // Random curbside parking event (inner lanes only).
        if (agent.lane === 0 && rng() < 0.0015 * dt * 60) {
          agent.state = 'parked';
          agent.stateRemaining = randRange(rng, 4.0, 9.0);
          agent.speed = 0;
          break;
        }
        break;
      }
      case 'stopped':
      case 'parked': {
        agent.stateRemaining -= dt;
        if (agent.stateRemaining <= 0) {
          agent.state = 'driving';
          agent.stateRemaining = 0;
          agent.speed = agent.maxSpeed * 0.5;
        } else {
          agent.speed = 0;
        }
        break;
      }
    }

    agent.positionOnLoop += agent.speed * dt;
    agent.positionOnLoop = ((agent.positionOnLoop % loop.perimeter) + loop.perimeter) % loop.perimeter;
  }
}

/** Dispose the meshes owned by a set of vehicle agents. */
export function disposeVehicleMeshes(
  agents: VehicleAgent[],
  providers: ReadonlyMap<string, MeshProvider>,
): void {
  for (const agent of agents) {
    const provider = providers.get(agent.providerId);
    if (provider && agent.mesh !== undefined) {
      provider.dispose(agent.mesh);
    }
    agent.mesh = undefined;
  }
}