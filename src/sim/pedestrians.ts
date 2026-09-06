import type { EraId, EraLayout } from '../types';
import type { MeshProvider, SimulationProviders } from './profiles';
import { createRng, getProfile, randRange, type RandomFn } from './profiles';
import type { LaneLoop, Position2D, VehicleAgent } from './vehicles';
import {
  buildLaneLoops,
  createVehicleAgents,
  disposeVehicleMeshes,
  updateVehicles,
} from './vehicles';

/**
 * Era-agnostic pedestrian agents.
 *
 * Pedestrians walk along the sidewalk waypoints that ring the city block,
 * applying basic avoidance against other pedestrians (and the player camera in
 * first-person mode) and taking idle/look pauses. The module never branches on
 * era: counts, speeds, and meshes are injected via profiles and providers.
 */

/** Pedestrian agent state machine. */
export type PedestrianState = 'walking' | 'paused';

/** One pedestrian agent. */
export interface PedestrianAgent {
  id: number;
  /** Index into the sidewalk waypoint ring. */
  waypointIndex: number;
  /** Distance between the previous and next waypoint already travelled. */
  travelled: number;
  /** Current walking speed (world units / second). */
  speed: number;
  /** Profile-derived speed for this agent. */
  maxSpeed: number;
  /** Current behaviour state. */
  state: PedestrianState;
  /** Seconds remaining in the current idle/look pause. */
  pauseRemaining: number;
  /** The era mesh attached to this agent (from the active provider). */
  mesh: unknown;
  /** Id of the provider that built {@link mesh}. */
  providerId: string;
}

/** A world position plus the direction of travel along a waypoint ring. */
export interface Waypoint {
  position: Position2D;
  /** Unit heading (+1 or -1) around the ring. */
  direction: number;
}

/**
 * Build the sidewalk waypoint ring around the block. Waypoints are placed on
 * the sidewalk band that lines the block, at a fixed distance from the block
 * edge. They are derived purely from the shared BLOCK / SIDEWALK / STREET
 * layout constants (via the injected `EraLayout`).
 */
export function buildSidewalkWaypoints(layout: EraLayout): Waypoint[] {
  const half = layout.block.width / 2;
  const walkOffset = layout.curb.depth + layout.sidewalk.width / 2;
  const r = half + walkOffset;
  const positions: Position2D[] = [
    { x: -r, z: r },
    { x: r, z: r },
    { x: r, z: -r },
    { x: -r, z: -r },
  ];
  // Interleave midpoints for a denser ring so avoidance has room to work.
  const midA: Position2D = { x: 0, z: r };
  const midB: Position2D = { x: r, z: 0 };
  const midC: Position2D = { x: 0, z: -r };
  const midD: Position2D = { x: -r, z: 0 };
  const ring: Position2D[] = [
    positions[0],
    midA,
    positions[1],
    midB,
    positions[2],
    midC,
    positions[3],
    midD,
  ];
  return ring.map((p) => ({ position: p, direction: 1 }));
}

/** Distance between two waypoint ring entries. */
export function waypointDistance(a: Waypoint, b: Waypoint): number {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

/** Create a fresh set of pedestrian agents for a profile. */
export function createPedestrianAgents(
  layout: EraLayout,
  count: number,
  speedMin: number,
  speedMax: number,
  providerId: string,
  rng: RandomFn,
): PedestrianAgent[] {
  const waypoints = buildSidewalkWaypoints(layout);
  const agents: PedestrianAgent[] = [];
  for (let i = 0; i < count; i++) {
    const startIndex = Math.floor(rng() * waypoints.length);
    agents.push({
      id: i,
      waypointIndex: startIndex,
      travelled: 0,
      speed: randRange(rng, speedMin, speedMax),
      maxSpeed: speedMin + (speedMax - speedMin) * 0.5,
      state: 'walking',
      pauseRemaining: 0,
      mesh: undefined,
      providerId,
    });
  }
  return agents;
}

/** Current world position of a pedestrian along the waypoint ring. */
export function pedestrianPosition(
  agent: PedestrianAgent,
  waypoints: readonly Waypoint[],
): Position2D {
  const a = waypoints[agent.waypointIndex];
  const b = waypoints[(agent.waypointIndex + 1) % waypoints.length];
  const len = waypointDistance(a, b);
  const t = len === 0 ? 0 : Math.min(1, agent.travelled / len);
  return {
    x: a.position.x + (b.position.x - a.position.x) * t,
    z: a.position.z + (b.position.z - a.position.z) * t,
  };
}

/**
 * Advance all pedestrians by `dt` seconds.
 *
 * `playerPos` is the first-person camera position; pedestrians steer around it
 * so the camera is never passed through. Set it to `null` to disable
 * first-person avoidance (e.g. cinematic overview).
 */
export function updatePedestrians(
  agents: PedestrianAgent[],
  waypoints: readonly Waypoint[],
  dt: number,
  playerPos: Position2D | null,
  rng: RandomFn,
): void {
  for (const agent of agents) {
    const current = pedestrianPosition(agent, waypoints);

    // Idle/look pause: randomly stop to look around for a moment.
    if (agent.state === 'walking' && rng() < 0.004 * dt * 60) {
      agent.state = 'paused';
      agent.pauseRemaining = randRange(rng, 0.6, 2.4);
    }

    if (agent.state === 'paused') {
      agent.pauseRemaining -= dt;
      if (agent.pauseRemaining <= 0) {
        agent.state = 'walking';
        agent.pauseRemaining = 0;
      }
      continue;
    }

    // Basic avoidance: slow down when another pedestrian is close ahead.
    let following = agent.speed;
    for (const other of agents) {
      if (other.id === agent.id) continue;
      const op = pedestrianPosition(other, waypoints);
      const dist = Math.hypot(current.x - op.x, current.z - op.z);
      if (dist < 1.4) {
        following = Math.min(following, agent.speed * 0.25);
      }
    }

    // First-person avoidance: never pass through the player camera.
    if (playerPos) {
      const distToPlayer = Math.hypot(current.x - playerPos.x, current.z - playerPos.z);
      if (distToPlayer < 1.6) {
        following = 0;
      }
      // Hard stop when the camera is right in front of the agent so it can
      // never walk through the player in first-person mode.
      if (distToPlayer < 1.0) {
        agent.speed = 0;
        continue;
      }
    }

    agent.speed = Math.max(0, agent.speed + (following - agent.speed) * Math.min(1, 4 * dt));
    agent.travelled += agent.speed * dt;

    const segmentLength = waypointDistance(
      waypoints[agent.waypointIndex],
      waypoints[(agent.waypointIndex + 1) % waypoints.length],
    );
    if (segmentLength > 0 && agent.travelled >= segmentLength) {
      agent.travelled -= segmentLength;
      agent.waypointIndex = (agent.waypointIndex + 1) % waypoints.length;
    }
  }
}

/** Dispose the meshes owned by a set of pedestrian agents. */
export function disposePedestrianMeshes(
  agents: PedestrianAgent[],
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

/** Snapshot of the current simulation state, exposed for tests and UI. */
export interface SimulationSnapshot {
  pedestrians: readonly PedestrianAgent[];
  vehicles: readonly VehicleAgent[];
  pedestrianWaypoints: readonly Waypoint[];
  laneLoops: readonly LaneLoop[];
}

/** The live simulation facade returned by {@link createSimulation}. */
export interface Simulation {
  /** Inject the era mesh providers. Call once at boot before setProfile. */
  setProviders(providers: SimulationProviders): void;
  /** Switch the active era profile (rebuilds agents + attaches meshes). */
  setProfile(eraId: string): void;
  /** Advance the simulation by `dt` seconds. */
  update(dt: number, playerPos: Position2D | null): void;
  /** Release all agent meshes. Call on era switch-away / shutdown. */
  dispose(): void;
  /** Read-only snapshot of the current agents and geometry. */
  snapshot(): SimulationSnapshot;
}

/**
 * Compose the era-agnostic pedestrian + vehicle simulation.
 *
 * Consumes the Phase 1 SimState contract (an `EraLayout` derived from the
 * shared BLOCK / STREET / SIDEWALK / CURB constants) so any era's content
 * meshes can be attached to agents while the movement logic stays shared.
 */
export function createSimulation(layout: EraLayout): Simulation {
  const waypoints = buildSidewalkWaypoints(layout);
  const laneLoops = buildLaneLoops(layout);
  let providers: SimulationProviders = {
    pedestrian: new Map(),
    vehicle: new Map(),
  };
  let profile = getProfile('1945');
  let rng = createRng(1945);
  let pedestrians: PedestrianAgent[] = [];
  let vehicles: VehicleAgent[] = [];

  const attachMeshes = (): void => {
    const pedProvider = providers.pedestrian.get(profile.pedestrianProviderId);
    const vehProvider = providers.vehicle.get(profile.vehicleProviderId);
    for (const agent of pedestrians) {
      agent.mesh = pedProvider ? pedProvider.build(agent.id + 1) : undefined;
    }
    for (const agent of vehicles) {
      agent.mesh = vehProvider ? vehProvider.build(agent.id + 1) : undefined;
    }
  };

  const rebuild = (eraId: EraId): void => {
    // Release the outgoing era's agent meshes before rebuilding, so switching
    // profiles never leaks geometry into the shared scene.
    disposeVehicleMeshes(vehicles, providers.vehicle);
    disposePedestrianMeshes(pedestrians, providers.pedestrian);
    profile = getProfile(eraId);
    rng = createRng(parseInt(eraId, 10) || 1);
    pedestrians = createPedestrianAgents(
      layout,
      profile.pedestrianCount,
      profile.pedestrianSpeedMin,
      profile.pedestrianSpeedMax,
      profile.pedestrianProviderId,
      rng,
    );
    vehicles = createVehicleAgents(
      layout,
      profile.vehicleCount,
      profile.vehicleSpeedMin,
      profile.vehicleSpeedMax,
      profile.vehicleProviderId,
      rng,
    );
    attachMeshes();
  };

  rebuild('1945');

  return {
    setProviders(next: SimulationProviders): void {
      disposeVehicleMeshes(vehicles, providers.vehicle);
      disposePedestrianMeshes(pedestrians, providers.pedestrian);
      providers = next;
      attachMeshes();
    },
    setProfile(eraId: EraId): void {
      rebuild(eraId);
    },
    update(dt: number, playerPos: Position2D | null): void {
      updatePedestrians(pedestrians, waypoints, dt, playerPos, rng);
      updateVehicles(
        vehicles,
        laneLoops,
        dt,
        pedestrians.map((p) => ({ position: pedestrianPosition(p, waypoints) })),
        rng,
      );
    },
    dispose(): void {
      disposeVehicleMeshes(vehicles, providers.vehicle);
      disposePedestrianMeshes(pedestrians, providers.pedestrian);
    },
    snapshot(): SimulationSnapshot {
      return {
        pedestrians,
        vehicles,
        pedestrianWaypoints: waypoints,
        laneLoops,
      };
    },
  };
}