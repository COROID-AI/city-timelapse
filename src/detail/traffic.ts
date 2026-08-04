import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, randRange } from '../city/rng';
import type { CityGridLayout } from '../city/types';

export interface TrafficOptions {
  /** City seed (traffic reuses the same deterministic RNG family). */
  seed: number;
  /** Street-grid layout from city-generation. */
  grid: CityGridLayout;
  /** Vehicle count range per road strip. Default [1, 2]. */
  vehicleCount?: readonly [number, number];
  /** Pedestrian count range per sidewalk strip. Default [1, 3]. */
  pedestrianCount?: readonly [number, number];
}

export interface TrafficCounts {
  vehicles: number;
  pedestrians: number;
}

/** Driving distance from the road center line to each travel lane. */
const LANE_OFFSET = 1.4;
/** Vehicle speed range (world units/second). */
const VEHICLE_SPEED: readonly [number, number] = [2.6, 5.6];
/** Pedestrian walking speed range (world units/second). */
const PEDESTRIAN_SPEED: readonly [number, number] = [1.1, 2.0];

const VEHICLE_COLORS: readonly number[] = [
  0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xecf0f1, 0x34495e,
  0xd35400, 0x16a085, 0x7f8c8d,
];
const PEDESTRIAN_COLORS: readonly number[] = [
  0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c,
  0x95a5a6, 0xcacfd2, 0xd35400,
];

interface VehicleState {
  /** 0 = travels along X, 1 = travels along Z. */
  axis: 0 | 1;
  /** World coordinate perpendicular to the travel axis (the lane center). */
  lane: number;
  /** Units per second along the travel axis. */
  speed: number;
  /** Position along the travel axis. */
  along: number;
  /** +1 or -1 travel direction. */
  direction: 1 | -1;
  /** Uniform scale variation. */
  scale: number;
}

interface PedestrianState {
  axis: 0 | 1;
  /** World coordinate perpendicular to the walk axis (sidewalk centerline). */
  lane: number;
  speed: number;
  along: number;
  direction: 1 | -1;
  /** Per-pedestrian bob phase so they do not all step in sync. */
  phase: number;
  scale: number;
}

/**
 * Simple low-poly vehicles: a box body with a slightly narrower cabin.
 * Long axis is Z; the traffic system rotates each instance to face travel.
 */
function buildVehicleGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(0.85, 0.5, 1.75).translate(0, 0.52, 0);
  const cabin = new THREE.BoxGeometry(0.72, 0.42, 0.95).translate(0, 0.95, -0.08);
  const merged = mergeGeometries([body, cabin]);
  return merged ?? new THREE.BoxGeometry(0.85, 0.9, 1.75).translate(0, 0.55, 0);
}

/** Low-poly pedestrians: a tapered body capsule plus a head sphere. */
function buildPedestrianGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.2, 0.26, 1.0, 8).translate(0, 0.78, 0);
  const head = new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.42, 0);
  const merged = mergeGeometries([body, head]);
  return merged ?? new THREE.SphereGeometry(0.3, 8, 6).translate(0, 1.0, 0);
}

/**
 * Ambient city life: instanced vehicles driving along the road strips and
 * instanced pedestrians walking along the sidewalk strips.
 *
 * - One InstancedMesh per population (2 draw calls total); `update(delta)`
 *   recomposes the per-instance matrices in the render loop, which keeps
 *   animated-object cost low.
 * - Every vehicle/pedestrian is assigned to a road/sidewalk strip from the
 *   city grid, so traffic stays on streets and never overlaps buildings.
 * - Animation is purely visual: nothing here is added to the walk-controls
 *   collision data, so the collision boundaries used by walk-controls are
 *   untouched.
 */
export class TrafficSystem {
  readonly group: THREE.Group;
  readonly counts: TrafficCounts;
  private readonly vehicles: VehicleState[] = [];
  private readonly pedestrians: PedestrianState[] = [];
  private readonly vehicleMesh: THREE.InstancedMesh;
  private readonly pedestrianMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly travelLimit: number;
  private time = 0;

  constructor(options: TrafficOptions) {
    const { grid, seed } = options;
    const rng = createRng((seed ^ 0x51ab3e7d) >>> 0);
    const vehicleRange = options.vehicleCount ?? [1, 2];
    const pedestrianRange = options.pedestrianCount ?? [1, 3];
    // Roads extend a little past the outer ring road; keep traffic on asphalt.
    this.travelLimit = grid.stripLength / 2 - 1;

    const sidewalkOffset = (grid.streetWidth + grid.sidewalkWidth) / 2;
    const laneSign = (direction: 1 | -1): number => (direction === 1 ? 1 : -1);

    for (const line of grid.roadLines) {
      for (const axis of [0, 1] as const) {
        const count = Math.floor(randRange(rng, vehicleRange[0], vehicleRange[1] + 0.999));
        for (let i = 0; i < count; i++) {
          const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;
          this.vehicles.push({
            axis,
            lane: line + laneSign(direction) * LANE_OFFSET,
            speed: randRange(rng, VEHICLE_SPEED[0], VEHICLE_SPEED[1]),
            along: randRange(rng, -this.travelLimit, this.travelLimit),
            direction,
            scale: 0.85 + rng() * 0.45,
          });
        }
      }
    }

    for (const line of grid.roadLines) {
      for (const axis of [0, 1] as const) {
        for (const side of [-1, 1]) {
          const count = Math.floor(
            randRange(rng, pedestrianRange[0], pedestrianRange[1] + 0.999),
          );
          for (let i = 0; i < count; i++) {
            this.pedestrians.push({
              axis,
              lane: line + side * sidewalkOffset,
              speed: randRange(rng, PEDESTRIAN_SPEED[0], PEDESTRIAN_SPEED[1]),
              along: randRange(rng, -this.travelLimit, this.travelLimit),
              direction: rng() < 0.5 ? 1 : -1,
              phase: rng() * Math.PI * 2,
              scale: 0.9 + rng() * 0.3,
            });
          }
        }
      }
    }

    const vehicleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pedestrianMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.vehicleMesh = new THREE.InstancedMesh(
      buildVehicleGeometry(),
      vehicleMaterial,
      this.vehicles.length,
    );
    this.pedestrianMesh = new THREE.InstancedMesh(
      buildPedestrianGeometry(),
      pedestrianMaterial,
      this.pedestrians.length,
    );
    const color = new THREE.Color();
    for (let i = 0; i < this.vehicles.length; i++) {
      this.vehicleMesh.setColorAt(
        i,
        color.setHex(VEHICLE_COLORS[Math.floor(rng() * VEHICLE_COLORS.length)]).clone(),
      );
    }
    for (let i = 0; i < this.pedestrians.length; i++) {
      this.pedestrianMesh.setColorAt(
        i,
        color.setHex(PEDESTRIAN_COLORS[Math.floor(rng() * PEDESTRIAN_COLORS.length)]).clone(),
      );
    }
    if (this.vehicleMesh.instanceColor) this.vehicleMesh.instanceColor.needsUpdate = true;
    if (this.pedestrianMesh.instanceColor) this.pedestrianMesh.instanceColor.needsUpdate = true;
    this.writeVehicleMatrices();
    this.writePedestrianMatrices(0);

    this.group = new THREE.Group();
    if (this.vehicles.length > 0) this.group.add(this.vehicleMesh);
    if (this.pedestrians.length > 0) this.group.add(this.pedestrianMesh);
    this.counts = { vehicles: this.vehicles.length, pedestrians: this.pedestrians.length };
  }

  /** Advance traffic by `delta` seconds; call every frame from the render loop. */
  update(delta: number): void {
    this.time += delta;

    for (const v of this.vehicles) {
      v.along += v.speed * v.direction * delta;
      if (v.along > this.travelLimit) v.along = -this.travelLimit;
      else if (v.along < -this.travelLimit) v.along = this.travelLimit;
    }
    this.writeVehicleMatrices();

    for (const p of this.pedestrians) {
      p.along += p.speed * p.direction * delta;
      // Pedestrians turn around at the ends of their sidewalk strip.
      if (p.along > this.travelLimit) {
        p.along = this.travelLimit;
        p.direction = -1;
      } else if (p.along < -this.travelLimit) {
        p.along = -this.travelLimit;
        p.direction = 1;
      }
    }
    this.writePedestrianMatrices(this.time);
  }

  private writeVehicleMatrices(): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      this.dummy.position.set(
        v.axis === 0 ? v.along : v.lane,
        0,
        v.axis === 0 ? v.lane : v.along,
      );
      this.dummy.rotation.set(
        0,
        vehicleYaw(v.axis, v.direction),
        0,
      );
      this.dummy.scale.setScalar(v.scale);
      this.dummy.updateMatrix();
      this.vehicleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.vehicleMesh.instanceMatrix.needsUpdate = true;
  }

  private writePedestrianMatrices(time: number): void {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const bob = Math.abs(Math.sin(time * 5 + p.phase)) * 0.07;
      this.dummy.position.set(
        p.axis === 0 ? p.along : p.lane,
        bob,
        p.axis === 0 ? p.lane : p.along,
      );
      this.dummy.rotation.set(0, pedestrianYaw(p.axis, p.direction), 0);
      this.dummy.scale.setScalar(p.scale);
      this.dummy.updateMatrix();
      this.pedestrianMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.pedestrianMesh.instanceMatrix.needsUpdate = true;
  }
}

/** Yaw so a Z-elongated model faces along the travel axis. */
function vehicleYaw(axis: 0 | 1, direction: 1 | -1): number {
  if (axis === 0) {
    return direction === 1 ? Math.PI / 2 : -Math.PI / 2;
  }
  return direction === 1 ? 0 : Math.PI;
}

/** Pedestrians are roughly symmetric; face them along the walk axis. */
function pedestrianYaw(axis: 0 | 1, direction: 1 | -1): number {
  if (axis === 0) {
    return direction === 1 ? Math.PI / 2 : -Math.PI / 2;
  }
  return direction === 1 ? 0 : Math.PI;
}
