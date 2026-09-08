import type { EraData } from '../eras/types.js';
import type { CityBlockLayout, Point2 } from '../layout/types.js';
import type { VehicleInstance } from './types.js';
import {
  baseSpeed,
  idleDwell,
  pathLen,
  pointAtProgress,
} from './fleet.js';

/**
 * Traffic simulation over the shared, read-only layout.
 *
 * Each vehicle advances around its assigned traffic loop. Near a loop vertex
 * (an intersection) a vehicle may idle for a deterministic dwell before
 * continuing, which gives the per-era motion its stop-and-go character.
 * Vehicles never mutate the layout; they only consume `trafficLoops`.
 */

/** How close (in meters) a vehicle must be to a loop vertex to idle. */
const IDLE_RADIUS = 0.6;
/** Chance that a passing vehicle stops at an intersection at all. */
const STOP_CHANCE = 0.55;

/** Advance all vehicles by `dt` seconds. */
export function updateTraffic(
  vehicles: VehicleInstance[],
  era: EraData,
  layout: CityBlockLayout,
  dt: number,
): void {
  const loops = new Map<string, Point2[]>();
  for (const loop of layout.trafficLoops) {
    loops.set(loop.id, loop.waypoints);
  }

  for (const vehicle of vehicles) {
    const waypoints = loops.get(vehicle.loopId);
    if (!waypoints || waypoints.length < 2) {
      continue;
    }
    if (vehicle.state === 'parked') {
      continue;
    }
    if (vehicle.state === 'idle') {
      vehicle.idleRemaining -= dt;
      if (vehicle.idleRemaining <= 0) {
        vehicle.state = 'driving';
      }
      continue;
    }

    // Driving: advance along the loop.
    const loopLen = pathLen(waypoints);
    const step = vehicle.speed * dt;
    vehicle.loopProgress = (vehicle.loopProgress + step / loopLen) % 1;
    const next = pointAtProgress(waypoints, loopLen, vehicle.loopProgress);
    const dx = next.x - vehicle.position.x;
    const dz = next.z - vehicle.position.z;
    vehicle.heading = Math.atan2(dz, dx);
    vehicle.position = next;

    // Idle check near an intersection (loop vertex).
    const nearVertex = waypoints.some((wp) => {
      const ddx = wp.x - vehicle.position.x;
      const ddz = wp.z - vehicle.position.z;
      return Math.hypot(ddx, ddz) < IDLE_RADIUS;
    });
    if (nearVertex && Math.random() < STOP_CHANCE * dt * 4) {
      vehicle.state = 'idle';
      vehicle.idleRemaining = idleDwell(era, vehicle.kindId);
    }
  }
}

/**
 * Park a subset of vehicles along a lane (read-only consumption of the lane
 * geometry). Vehicles are placed beside the lane so they do not block traffic.
 */
export function parkVehicles(
  vehicles: VehicleInstance[],
  layout: CityBlockLayout,
  count: number,
): void {
  if (layout.lanes.length === 0) {
    return;
  }
  const lane = layout.lanes[0]!;
  const waypoints = lane.waypoints;
  if (waypoints.length < 2) {
    return;
  }
  const n = Math.min(count, vehicles.length);
  for (let i = 0; i < n; i++) {
    const vehicle = vehicles[i]!;
    const t = (i + 1) / (n + 1);
    const x = waypoints[0]!.x + (waypoints[waypoints.length - 1]!.x - waypoints[0]!.x) * t;
    const z = waypoints[0]!.z + (waypoints[waypoints.length - 1]!.z - waypoints[0]!.z) * t;
    vehicle.state = 'parked';
    vehicle.position = { x, z };
    vehicle.heading = Math.atan2(
      waypoints[waypoints.length - 1]!.z - waypoints[0]!.z,
      waypoints[waypoints.length - 1]!.x - waypoints[0]!.x,
    );
  }
}

/** Count of vehicles in each motion state. */
export function stateCounts(vehicles: VehicleInstance[]): Record<string, number> {
  const counts: Record<string, number> = { driving: 0, idle: 0, parked: 0 };
  for (const vehicle of vehicles) {
    counts[vehicle.state] = (counts[vehicle.state] ?? 0) + 1;
  }
  return counts;
}

/** Distinct body types present in the fleet. */
export function bodyTypeCount(vehicles: VehicleInstance[]): number {
  return new Set(vehicles.map((v) => v.body.bodyType)).size;
}

/** Convenience: total vehicles. */
export function vehicleCount(vehicles: VehicleInstance[]): number {
  return vehicles.length;
}

/** Convenience: an era-aware speed reference. */
export function eraSpeed(era: EraData): number {
  return baseSpeed(era);
}