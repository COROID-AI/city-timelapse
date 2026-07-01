/**
 * Traffic & pedestrian animation system.
 *
 * Drives the city block each frame: cars advance along their lane segments,
 * decelerate into parking spots, pedestrians walk along sidewalk paths with a
 * natural gait, car wheels roll, and pedestrian walk cycles are phase-offset
 * so crowds never lock-step.
 *
 * Design contract:
 *   - The system consumes plain scene handles (THREE.Object3D rigs + the
 *     StreetInfra / EraContent data bundles). It performs NO direct scene-graph
 *     mutation beyond repositioning/rotating the rigs it was given — it never
 *     adds or removes objects, so it is safe to drive from the render loop.
 *   - Vehicle rigs follow the factory convention: a THREE.Group whose
 *     `userData.wheelPivots` optionally exposes `{ FL, FR, RL, RR }` pivots
 *     (their `.rotation.z` spins, `.rotation.y` steers). When absent the car
 *     still drives; wheels simply do not visibly spin.
 *   - Pedestrian rigs are PedestrianRig (THREE.Group + `walk(t, speed)` /
 *     `idle(t)` pose functions + `walkCycle`).
 */

import * as THREE from 'three';

import type {
  EraContent,
  LaneLayout,
  LaneSpec,
  ParkingSpot,
} from './eras/types';
import type {
  ParkingMarker,
  SidewalkSlab,
  StreetInfra,
} from './assetBuilder/streets';
import type { PedestrianRig } from './assetBuilder/pedestrian';

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

/**
 * Named wheel pivots on a vehicle rig, following the vehicle-factory convention.
 * Each pivot spins around its local Z and steers around its local Y. The map is
 * optional — rigs without it still drive, just without visible wheel spin.
 */
export interface WheelPivots {
  FL?: THREE.Object3D;
  FR?: THREE.Object3D;
  RL?: THREE.Object3D;
  RR?: THREE.Object3D;
}

/**
 * A vehicle placed in the world. `rig` is the rendered group; the rest is the
 * motion state tracked by the traffic system.
 */
export interface VehicleHandle {
  /** The rendered vehicle group (chassis + wheels). */
  rig: THREE.Group;
  /** Heading the car points along, in radians (0 = +Z, yaw about +Y). */
  heading: number;
  /** Current forward speed along the lane, in metres/second (>= 0). */
  speed: number;
  /** Cruise speed when unobstructed, in m/s. */
  cruiseSpeed: number;
  /** Distance travelled along the current lane segment, in metres. */
  distance: number;
  /** Total length of the current lane segment, in metres. */
  segmentLength: number;
  /** Travel direction along the street axis (+1 forward, -1 backward). */
  direction: 1 | -1;
  /** Fixed lateral (X) offset of this car's lane centre, in metres. */
  lateralOffset: number;
  /** Wheel pivots following the factory convention, if present. */
  wheels?: WheelPivots;
  /**
   * Parking spot the car is heading toward. Once the car reaches the end of its
 * lane it parks here; `null` means the car loops the lane indefinitely.
   */
  targetSpot: ParkingSpot | null;
  /** Whether the car has finished parking (speed 0, pose applied). */
  parked: boolean;
}

/** A pedestrian walking a sidewalk path. */
export interface PedestrianHandle {
  /** The rigged pedestrian group (has `.walk(t, speed)` / `.idle(t)`). */
  rig: PedestrianRig;
  /** Walk speed in metres/second. */
  speed: number;
  /** Distance travelled along the sidewalk path, in metres. */
  distance: number;
  /** Total length of the sidewalk path before it wraps, in metres. */
  pathLength: number;
  /** Travel direction along the path (+1 / -1). */
  direction: 1 | -1;
  /** Fixed lateral (X) offset of this pedestrian's path, in metres. */
  lateralOffset: number;
  /** Fixed Z origin of the path, in metres. */
  zOrigin: number;
  /**
   * Phase offset applied to the walk-cycle time so crowds do not lock-step, in
 * seconds.
   */
  phaseOffset: number;
  /** Accumulated wall-clock time used to drive the pose functions, in seconds. */
  elapsed: number;
}

/** Aggregate input handed to {@link createTrafficSystem}. */
export interface TrafficSystemInput {
  /** The era content bundle (lane layout, parking, walk cycle, vehicle rigs). */
  content: EraContent;
  /** The street infrastructure layout (lanes, sidewalks, parking markers). */
  infra: StreetInfra;
  /** Vehicles placed in the scene, in drive or park state. */
  vehicles: VehicleHandle[];
  /** Pedestrians placed on sidewalk paths. */
  pedestrians: PedestrianHandle[];
}

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------

/**
 * Distance over which a car decelerates from cruise speed into its parking
 * spot, in metres. A longer zone yields a gentler, more natural stop.
  */
const PARK_DECEL_ZONE = 14;

/** Minimum crawl speed a car keeps until it is fully parked, in m/s. */
const PARK_CRAWL_SPEED = 0.8;

/** Lateral safety margin a car keeps from a parked neighbour, in metres. */
const LATERAL_CLEARANCE = 0.6;

/** Headway gap a moving car keeps behind a slower leader, in metres. */
const FOLLOW_GAP = 5;

/**
 * Phase-offset spread for pedestrian walk cycles. Each pedestrian's phase is a
 * deterministic pseudo-random value in [0, spread) so groups desynchronise.
 */
const PHASE_SPREAD = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic pseudo-random in [0, 1) from an integer seed. Used so pedestrian
 * phase offsets are stable across frames (no flicker) without runtime RNG state.
 */
function hash01(seed: number): number {
  // xorshift32-style mix; masks keep the arithmetic 32-bit safe.
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s ^= s << 13; s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5; s >>>= 0;
  return (s % 100000) / 100000;
}

/**
 * Computes the wheel roll delta for a frame from speed and wheel radius.
 * `arc = speed * dt`; roll = arc / radius. A nominal 0.35 m wheel radius keeps
 * the visual rate believable for the token-scale cars.
 */
function rollDelta(speed: number, dt: number, radius = 0.35): number {
  return (speed * dt) / radius;
}

/**
 * Selects the drive lanes (motor traffic, directional) from a layout. Parking,
 * bike, transit and sidewalk lanes are excluded — only cars drive here.
 */
function driveLanes(layout: LaneLayout): LaneSpec[] {
  return layout.lanes.filter(
    (lane) => lane.type === 'motor' && lane.direction !== 'none',
  );
}

// ---------------------------------------------------------------------------
// Per-frame update steps
// ---------------------------------------------------------------------------

/**
 * Advances a single vehicle along its lane, decelerating into its parking spot
 * and rolling/steering its wheels. The rig's world position and rotation are
 * updated in place; no scene-graph mutation occurs beyond the rig's transform.
 */
function tickVehicle(car: VehicleHandle, dt: number, content: EraContent): void {
  if (car.parked) {
    // Parked cars are static; keep wheels locked straight.
    return;
  }

  // --- Determine target speed -------------------------------------------------
  let targetSpeed = car.cruiseSpeed;

  if (car.targetSpot) {
    const remaining = Math.max(0, car.segmentLength - car.distance);
    if (remaining <= PARK_DECEL_ZONE) {
      // Ease down from cruise to crawl as the spot approaches, then to 0.
      const t = 1 - remaining / PARK_DECEL_ZONE; // 0 far away -> 1 at spot
      targetSpeed = THREE.MathUtils.lerp(car.cruiseSpeed, PARK_CRAWL_SPEED, t);
      if (remaining <= 0.5) targetSpeed = 0;
    }
  }

  // Avoid the car directly ahead: keep a headway gap.
  // (Leader lookup is handled at the fleet level in `tickFleet` by slowing the
  // follower; here we only clamp to the already-resolved target speed.)
  targetSpeed = Math.max(0, targetSpeed);

  // Smoothly approach the target speed (simple first-order lag).
  const accel = targetSpeed > car.speed ? 4.0 : 8.0; // brake harder than accel
  car.speed += Math.sign(targetSpeed - car.speed) * Math.min(Math.abs(targetSpeed - car.speed), accel * dt);
  car.speed = Math.max(0, car.speed);

  // --- Integrate position -----------------------------------------------------
  car.distance += car.speed * dt;

  // --- Resolve parking --------------------------------------------------------
  if (car.targetSpot && car.distance >= car.segmentLength) {
    parkVehicle(car, content);
    return;
  }

  // --- Update rig transform ---------------------------------------------------
  const z = car.direction * car.distance;
  car.rig.position.set(car.lateralOffset, 0, z);
  car.rig.rotation.y = car.heading;

  // --- Roll & steer wheels ----------------------------------------------------
  rollAndSteerWheels(car, content);
}

/**
 * Snaps a vehicle into its parking spot: positions it at the spot, yaws it to
 * the spot angle, locks wheels straight, and applies the park pose so the door
 * opens. Marks the car (and spot) as occupied.
 */
function parkVehicle(car: VehicleHandle, content: EraContent): void {
  const spot = car.targetSpot;
  if (!spot) return;

  // Spot position is along the street axis; lateral offset depends on the side.
  const sideSign = spot.side === 'left' ? -1 : 1;
  const lateral = car.lateralOffset + sideSign * LATERAL_CLEARANCE;
  const z = car.direction * spot.position;

  car.rig.position.set(lateral, 0, z);

  // Yaw to match the spot orientation relative to travel direction.
  const angleByKind: Record<ParkingSpot['angle'], number> = {
    parallel: 0,
    perpendicular: Math.PI / 2,
    diagonal: Math.PI / 4,
  };
  car.heading = car.direction * angleByKind[spot.angle];
  car.rig.rotation.y = car.heading;

  // Lock wheels straight (park pose steerYaw is 0).
  const variant = pickVehicleRig(content);
  lockWheelsStraight(car, variant);

  car.speed = 0;
  car.parked = true;
  spot.occupied = true;
}

/**
 * Spins and steers a vehicle's wheels according to its current speed and the
 * era's drive pose. Front wheels steer by the drive steerYaw; all wheels roll
 * proportional to forward speed.
 */
function rollAndSteerWheels(car: VehicleHandle, content: EraContent): void {
  if (!car.wheels) return;
  const variant = pickVehicleRig(content);
  const steerYaw = variant.drive.steerYaw;
  const delta = rollDelta(car.speed, 1 / 60); // per-frame roll at 60fps reference

  // Front axle steers; all four wheels roll about Z.
  steerWheel(car.wheels.FL, steerYaw, delta);
  steerWheel(car.wheels.FR, steerYaw, delta);
  steerWheel(car.wheels.RL, 0, delta);
  steerWheel(car.wheels.RR, 0, delta);
}

/** Applies a steer (Y) and roll (Z) delta to a single wheel pivot. */
function steerWheel(
  pivot: THREE.Object3D | undefined,
  steerYaw: number,
  rollDelta: number,
): void {
  if (!pivot) return;
  pivot.rotation.y = steerYaw;
  pivot.rotation.z += rollDelta;
}

/** Locks all wheels straight (used when parking). */
function lockWheelsStraight(
  car: VehicleHandle,
  variant: { park: { steerYaw: number } },
): void {
  if (!car.wheels) return;
  const yaw = variant.park.steerYaw;
  for (const pivot of [car.wheels.FL, car.wheels.FR, car.wheels.RL, car.wheels.RR]) {
    if (pivot) pivot.rotation.y = yaw;
  }
}

/**
 * Resolves the era's vehicle rig. Cars are the common case; fall back to the
 * truck rig only when the car variant is somehow absent.
 */
function pickVehicleRig(content: EraContent) {
  return content.vehicles.car ?? content.vehicles.truck;
}

/**
 * Walks a single pedestrian along its sidewalk path. The rig's position is
 * advanced, its heading is set to the travel direction, and its `walk()` pose
 * function is driven with a phase-offset clock so groups desynchronise.
 */
function tickPedestrian(p: PedestrianHandle, dt: number): void {
  p.elapsed += dt;
  p.distance += p.speed * p.direction * dt;

  // Wrap the path so pedestrians loop seamlessly.
  if (p.distance >= p.pathLength) {
    p.distance -= p.pathLength;
  } else if (p.distance < 0) {
    p.distance += p.pathLength;
  }

  const z = p.zOrigin + p.direction * p.distance;
  p.rig.position.set(p.lateralOffset, 0, z);
  // Face the walk direction: +Z for forward, -Z for backward.
  p.rig.rotation.y = p.direction > 0 ? 0 : Math.PI;

  // Drive the walk cycle with a per-pedestrian phase offset to avoid lock-step.
  const phase = p.elapsed + p.phaseOffset;
  p.rig.walk(phase, p.speed);
}

// ---------------------------------------------------------------------------
// Fleet-level helpers
// ---------------------------------------------------------------------------

/**
 * Applies simple car-following: any vehicle whose leader (same lane, ahead) is
 * within the follow gap slows to match, so moving cars avoid rear-ending parked
 * or slower cars. Leaders are identified by lane offset + direction.
 */
function applyCarFollowing(vehicles: VehicleHandle[]): void {
  // Group cars by lane (lateral offset + direction) to find leaders.
  const lanes = new Map<string, VehicleHandle[]>();
  for (const car of vehicles) {
    if (car.parked) continue;
    const key = `${car.lateralOffset.toFixed(2)}:${car.direction}`;
    const bucket = lanes.get(key);
    if (bucket) bucket.push(car);
    else lanes.set(key, [car]);
  }

  for (const bucket of lanes.values()) {
    // Sort by distance along travel direction (descending = closest to leader).
    bucket.sort((a, b) => b.distance - a.distance);
    for (let i = 0; i < bucket.length - 1; i++) {
      const leader = bucket[i];
      const follower = bucket[i + 1];
      const gap = (leader.distance - follower.distance) * follower.direction;
      if (gap < FOLLOW_GAP) {
        // Clamp follower speed to a fraction of the available gap.
        follower.speed = Math.min(follower.speed, Math.max(0, gap / FOLLOW_GAP) * follower.cruiseSpeed);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public system factory
// ---------------------------------------------------------------------------

/**
 * An opaque traffic system handle. The only public operation is {@link
 * TrafficSystem.tick}, called once per render frame with the elapsed delta.
 */
export interface TrafficSystem {
  /** Advance all vehicles and pedestrians by `dt` seconds. */
  tick(dt: number): void;
  /** The vehicles being driven. */
  readonly vehicles: readonly VehicleHandle[];
  /** The pedestrians being walked. */
  readonly pedestrians: readonly PedestrianHandle[];
}

/**
 * Creates a traffic system over the given handles.
 *
 * Pedestrian phase offsets are assigned deterministically from each rig's UUID
 * (or index) so that crowds desynchronise without per-frame RNG. The system
 * holds no global state beyond the provided handles.
 */
export function createTrafficSystem(input: TrafficSystemInput): TrafficSystem {
  // Assign deterministic phase offsets once, at construction, so pedestrians
  // never lock-step. Uses the pedestrian's index as a stable seed.
  input.pedestrians.forEach((p, i) => {
    p.phaseOffset = hash01(i + 1) * PHASE_SPREAD;
  });

  const { content } = input;

  return {
    vehicles: input.vehicles,
    pedestrians: input.pedestrians,

    tick(dt: number): void {
      // Clamp dt to avoid tunnelling on long stalls (tab switches, etc.).
      const step = Math.min(dt, 1 / 15);

      // 1. Advance every moving car along its lane / into its spot.
      for (const car of input.vehicles) tickVehicle(car, step, content);

      // 2. Apply car-following so moving cars avoid parked / slower leaders.
      applyCarFollowing(input.vehicles);

      // 3. Walk every pedestrian along its sidewalk path.
      for (const ped of input.pedestrians) tickPedestrian(ped, step);
    },
  };
}

// ---------------------------------------------------------------------------
// Spawn helpers (optional convenience for the scene/city-block assembler)
// ---------------------------------------------------------------------------

/**
 * Builds a {@link VehicleHandle} from a placed rig and a lane, ready to be
 * driven by the system. The lane's direction and width set the travel direction
 * and lateral offset; an optional target spot makes the car park at the end.
 */
export function spawnVehicle(params: {
  rig: THREE.Group;
  lane: LaneSpec;
  laneIndex: number;
  segmentLength: number;
  cruiseSpeed?: number;
  targetSpot?: ParkingSpot | null;
}): VehicleHandle {
  const direction = params.lane.direction === 'forward' ? 1 : -1;
  // Stagger cars across the lane width based on laneIndex so they don't overlap.
  const lateralOffset = (params.laneIndex - 0.5) * params.lane.width;
  return {
    rig: params.rig,
    heading: direction > 0 ? 0 : Math.PI,
    speed: params.cruiseSpeed ?? 8,
    cruiseSpeed: params.cruiseSpeed ?? 8,
    distance: 0,
    segmentLength: params.segmentLength,
    direction,
    lateralOffset,
    wheels: extractWheels(params.rig),
    targetSpot: params.targetSpot ?? null,
    parked: false,
  };
}

/** Reads the factory-convention `userData.wheelPivots` off a rig, if present. */
function extractWheels(rig: THREE.Group): WheelPivots | undefined {
  const raw = (rig.userData as { wheelPivots?: unknown }).wheelPivots;
  if (!raw || typeof raw !== 'object') return undefined;
  const wp = raw as Record<string, unknown>;
  const isPivot = (v: unknown): v is THREE.Object3D =>
    v instanceof THREE.Object3D;
  return {
    FL: isPivot(wp.FL) ? wp.FL : undefined,
    FR: isPivot(wp.FR) ? wp.FR : undefined,
    RL: isPivot(wp.RL) ? wp.RL : undefined,
    RR: isPivot(wp.RR) ? wp.RR : undefined,
  };
}

/**
 * Builds a {@link PedestrianHandle} from a rig and a sidewalk slab, ready to be
 * walked by the system. The slab's rect sets the path bounds; `index` seeds the
 * deterministic phase offset.
 */
export function spawnPedestrian(params: {
  rig: PedestrianRig;
  sidewalk: SidewalkSlab;
  index: number;
  speed?: number;
  direction?: 1 | -1;
}): PedestrianHandle {
  const direction = params.direction ?? (params.index % 2 === 0 ? 1 : -1);
  const rect = params.sidewalk.rect;
  // Path runs along Z (street axis); length is twice the slab depth (out & wrap).
  const pathLength = rect.halfDepth * 2;
  // Spread pedestrians across the slab width so they don't overlap.
  const lateralOffset = rect.x + ((params.index % 3) - 1) * (rect.halfWidth / 2);
  return {
    rig: params.rig,
    speed: params.speed ?? 1.2,
    distance: (params.index * 1.7) % pathLength,
    pathLength,
    direction,
    lateralOffset,
    zOrigin: rect.z - rect.halfDepth,
    phaseOffset: hash01(params.index + 1) * PHASE_SPREAD,
    elapsed: 0,
  };
}

/**
 * Lists the parking spots available for assignment in the given infra, in the
 * order they appear along the street. Occupied spots are skipped.
 */
export function availableParkingSpots(infra: StreetInfra): ParkingMarker[] {
  return infra.parkingMarkers.filter((m) => !m.spot.occupied);
}

export { driveLanes };
