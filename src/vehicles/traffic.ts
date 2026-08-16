// ─── Traffic Simulation Engine ───────────────────────────────────────
// Animates era-correct vehicles along street lanes with deterministic
// path animation on the scaffold's street layout. No physics engine.
// Supports updateEra(EraId) to swap rosters without page reload.
// Handles parked cars and era-specific street markings.

import * as THREE from 'three';
import type { EraId } from '../eras.js';
import {
  ERA_TRAFFIC_SPECS,
  type EraTrafficSpec,
  type LaneConfig,
  type VehicleType,
} from './specs.js';
import { createVehicle } from './factory.js';

// ── Street geometry constants (must match ground.ts) ─────────────────

const STREET_WIDTH = 10;
const BLOCK_SIZE = 60;
const HALF_BLOCK = BLOCK_SIZE / 2; // 30
const TOTAL_EXTENT = BLOCK_SIZE + STREET_WIDTH * 2; // 80
const HALF_EXTENT = TOTAL_EXTENT / 2; // 40

// Intersection corners
const CORNERS = [
  { x: -HALF_BLOCK, z: -HALF_BLOCK },   // top-left
  { x: HALF_BLOCK, z: -HALF_BLOCK },    // top-right
  { x: HALF_BLOCK, z: HALF_BLOCK },     // bottom-right
  { x: -HALF_BLOCK, z: HALF_BLOCK },    // bottom-left
];

// ── Path point types ─────────────────────────────────────────────────

interface PathPoint {
  x: number;
  z: number;
  /** Heading angle in radians (0 = +X, PI/2 = +Z, etc.) */
  heading: number;
}

interface StraightPath {
  points: PathPoint[];
  totalLength: number;
}

// ── Road-side enumeration ────────────────────────────────────────────

type RoadSide = 'top' | 'bottom' | 'left' | 'right';

/** Build a straight-path along one side of the block for a given direction */
function buildStraightPath(
  side: RoadSide,
  direction: number,
  zOffset: number,
): StraightPath {
  const points: PathPoint[] = [];
  let startX: number;
  let endX: number;
  let baseZ: number;
  let baseX: number;

  switch (side) {
    case 'top':
      baseZ = -HALF_BLOCK + zOffset;
      startX = direction > 0 ? -HALF_EXTENT : HALF_EXTENT;
      endX = direction > 0 ? HALF_EXTENT : -HALF_EXTENT;
      for (let x = startX; Math.abs(x - endX) > 0.1; x += direction * 0.5) {
        const t = (x - startX) / (endX - startX);
        if (t > 1.01) break;
        points.push({ x, z: baseZ, heading: direction > 0 ? 0 : Math.PI });
      }
      break;
    case 'bottom':
      baseZ = HALF_BLOCK + zOffset;
      startX = direction > 0 ? HALF_EXTENT : -HALF_EXTENT;
      endX = direction > 0 ? -HALF_EXTENT : HALF_EXTENT;
      for (let x = startX; Math.abs(x - endX) > 0.1; x -= direction * 0.5) {
        const t = (startX - x) / (startX - endX);
        if (t > 1.01) break;
        points.push({ x, z: baseZ, heading: direction > 0 ? Math.PI : 0 });
      }
      break;
    case 'left':
      baseX = -HALF_BLOCK + zOffset;
      startX = direction > 0 ? HALF_EXTENT : -HALF_EXTENT;
      endX = direction > 0 ? -HALF_EXTENT : HALF_EXTENT;
      for (let z = startX; Math.abs(z - endX) > 0.1; z -= direction * 0.5) {
        const t = (startX - z) / (startX - endX);
        if (t > 1.01) break;
        points.push({ x: baseX, z, heading: direction > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
      break;
    case 'right':
      baseX = HALF_BLOCK + zOffset;
      startX = direction > 0 ? -HALF_EXTENT : HALF_EXTENT;
      endX = direction > 0 ? HALF_EXTENT : -HALF_EXTENT;
      for (let z = startX; Math.abs(z - endX) > 0.1; z += direction * 0.5) {
        const t = (z - startX) / (endX - startX);
        if (t > 1.01) break;
        points.push({ x: baseX, z, heading: direction > 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
      break;
  }

  // Calculate total path length
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    totalLength += Math.sqrt(dx * dx + dz * dz);
  }

  return { points, totalLength };
}

// ── Full circuit path builder ────────────────────────────────────────

/**
 * Build a complete rectangular circuit path around the city block.
 * Returns segments: [straight, corner, straight, corner, straight, corner, straight, corner]
 */
function buildCircuitPath(
  zOffsets: number[],
  directions: number[],
  sides: RoadSide[],
): { segments: StraightPath[]; totalLength: number } {
  const segments: StraightPath[] = [];
  let totalLength = 0;

  for (let i = 0; i < 4; i++) {
    const seg = buildStraightPath(sides[i], directions[i], zOffsets[i]);
    segments.push(seg);
    totalLength += seg.totalLength;
  }

  return { segments, totalLength };
}

// ── Animated vehicle state ───────────────────────────────────────────

interface AnimatedVehicle {
  group: THREE.Group;
  type: VehicleType;
  /** Current segment index in the circuit */
  segmentIndex: number;
  /** Progress along current segment (0→1) */
  progress: number;
  /** Speed in m/s */
  speed: number;
  /** Whether currently stopped at intersection */
  stopped: boolean;
  /** Stop countdown */
  stopTimer: number;
  /** Lane offset within its road */
  laneOffset: number;
  /** Direction sign (+1 or -1) */
  directionSign: number;
  /** Side name */
  side: RoadSide;
  /** Path reference */
  pathRef: StraightPath;
  /** Instance seed for color variation */
  instanceSeed: number;
}

// ── Parked car entry ─────────────────────────────────────────────────

interface ParkedCar {
  group: THREE.Group;
  /** Position along the street segment */
  position: number;
  /** Side of block */
  side: RoadSide;
  /** Lane config */
  laneConfig: LaneConfig;
}

// ── Traffic manager class ────────────────────────────────────────────

export class TrafficManager {
  private scene: THREE.Scene;
  private currentEra: EraId;
  private animatedVehicles: AnimatedVehicle[] = [];
  private parkedCars: ParkedCar[] = [];
  private spec: EraTrafficSpec;
  private circuitPath: { segments: StraightPath[]; totalLength: number } | null = null;
  private _markingsGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentEra = '1945';
    this.spec = ERA_TRAFFIC_SPECS['1945'];
    this._markingsGroup = new THREE.Group();
    this._markingsGroup.name = 'streetMarkings';
    this.scene.add(this._markingsGroup);
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Swap the active era roster — removes old vehicles, builds new ones */
  updateEra(era: EraId): void {
    if (era === this.currentEra) return;
    this.currentEra = era;
    this.spec = ERA_TRAFFIC_SPECS[era];

    // Clear existing
    this.clearAll();

    // Rebuild with new era
    this.buildCircuit();
    this.spawnVehicles();
    this.spawnParkedCars();
    this.updateStreetMarkings();
  }

  /** Tick all vehicles — call from render loop */
  update(delta: number): void {
    for (const v of this.animatedVehicles) {
      this.advanceVehicle(v, delta);
    }
  }

  /** Get the current era */
  getEra(): EraId {
    return this.currentEra;
  }

  // ── Circuit building ──────────────────────────────────────────────

  private clearAll(): void {
    // Remove animated vehicles
    for (const v of this.animatedVehicles) {
      this.scene.remove(v.group);
      v.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.animatedVehicles = [];

    // Remove parked cars
    for (const p of this.parkedCars) {
      this.scene.remove(p.group);
    }
    this.parkedCars = [];

    // Remove markings
    while (this._markingsGroup.children.length > 0) {
      const child = this._markingsGroup.children[0];
      this._markingsGroup.remove(child);
      if (child instanceof THREE.Group) {
        child.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
            else c.material.dispose();
          }
        });
      } else {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    }

    this.circuitPath = null;
  }

  private buildCircuit(): void {
    const lanes = this.spec.lanes;
    const sides: RoadSide[] = ['top', 'bottom', 'left', 'right'];
    const directions: number[] = [1, -1, 1, -1]; // top: +X, bottom: -X, left: +Z, right: -Z

    // Build primary circuit (first lane per side)
    const primaryOffsets = [lanes[0]?.zOffset ?? -1.5, lanes[0]?.zOffset ?? -1.5,
                            lanes[0]?.zOffset ?? -1.5, lanes[0]?.zOffset ?? -1.5];
    const primaryDirs = [directions[0], directions[1], directions[2], directions[3]];

    this.circuitPath = buildCircuitPath(primaryOffsets, primaryDirs, sides);
  }

  // ── Vehicle spawning ──────────────────────────────────────────────

  private spawnVehicles(): void {
    if (!this.circuitPath) return;

    let globalSeed = 0;
    const segments = this.circuitPath.segments;

    for (const entry of this.spec.roster) {
      for (let i = 0; i < entry.count; i++) {
        const segIdx = globalSeed % segments.length;
        const seg = segments[segIdx];

        // Pick a random starting position along the segment
        const posOnSeg = (globalSeed * 31 + i * 17) % 100 / 100;
        const speed = entry.speedRange[0] +
          ((globalSeed * 37 + i * 23) % 100) / 100 * (entry.speedRange[1] - entry.speedRange[0]);

        const vehicle = createVehicle(this.currentEra, entry.type, globalSeed);

        // Place at initial position
        const startPoint = seg.points[Math.floor(posOnSeg * (seg.points.length - 1))];
        vehicle.position.set(startPoint.x, 0.1, startPoint.z);
        vehicle.rotation.y = startPoint.heading;

        this.scene.add(vehicle);

        this.animatedVehicles.push({
          group: vehicle,
          type: entry.type,
          segmentIndex: segIdx,
          progress: posOnSeg,
          speed,
          stopped: false,
          stopTimer: 0,
          laneOffset: 0,
          directionSign: 1,
          side: ['top', 'bottom', 'left', 'right'][segIdx] as RoadSide,
          pathRef: seg,
          instanceSeed: globalSeed,
        });

        globalSeed++;
      }
    }
  }

  // ── Parked car spawning ───────────────────────────────────────────

  private spawnParkedCars(): void {
    const parking = this.spec.parking;
    const lanes = this.spec.lanes;

    if (parking.style === 'none') return;

    // Spawn parked cars along curb-adjacent lanes
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx];
      if (!lane.canPark || lane.parkOffset === undefined) continue;

      const sides: RoadSide[] = ['top', 'bottom', 'left', 'right'];
      const side = sides[laneIdx % 4];
      const numParked = Math.floor(BLOCK_SIZE / parking.spacing);

      for (let p = 0; p < numParked; p++) {
        const parkType = this.selectParkedType();
        const group = createVehicle(this.currentEra, parkType, 1000 + laneIdx * 100 + p);

        // Calculate position along curb
        let px: number, pz: number, heading: number;
        const offset = (p + 0.5) * parking.spacing;

        switch (side) {
          case 'top':
            px = -HALF_BLOCK + offset;
            pz = -HALF_BLOCK + lane.parkOffset;
            heading = lane.direction > 0 ? 0 : Math.PI;
            break;
          case 'bottom':
            px = HALF_BLOCK - offset;
            pz = HALF_BLOCK + lane.parkOffset;
            heading = lane.direction > 0 ? Math.PI : 0;
            break;
          case 'left':
            px = -HALF_BLOCK + lane.parkOffset;
            pz = HALF_BLOCK - offset;
            heading = lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
            break;
          case 'right':
            px = HALF_BLOCK + lane.parkOffset;
            pz = -HALF_BLOCK + offset;
            heading = lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
            break;
        }

        // Apply angled rotation if needed
        if (parking.angle && parking.style === 'angled') {
          heading += parking.angle * (laneIdx % 2 === 0 ? 1 : -1);
        }

        group.position.set(px, 0.1, pz);
        group.rotation.y = heading;
        group.scale.setScalar(0.9); // slightly smaller for parked cars

        this.scene.add(group);
        this.parkedCars.push({ group, position: offset, side, laneConfig: lane });
      }
    }
  }

  private selectParkedType(): VehicleType {
    const types: VehicleType[] = ['sedan', 'truck', 'hatchback', 'suv'];
    const weights: Record<EraId, number[]> = {
      '1945': [60, 30, 0, 0],
      '1965': [70, 20, 0, 10],
      '1985': [40, 15, 35, 10],
      '2005': [20, 10, 10, 50],
      '2025': [40, 5, 0, 30],
    };
    const w = weights[this.currentEra];
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= w[i];
      if (r <= 0) return types[i];
    }
    return 'sedan';
  }

  // ── Street markings ───────────────────────────────────────────────

  private updateStreetMarkings(): void {
    const markings = this.spec.markings;

    // Clear old
    while (this._markingsGroup.children.length > 0) {
      const child = this._markingsGroup.children[0];
      this._markingsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    // Center lines
    if (markings.centerLineColor !== null) {
      this.addCenterLines(markings.centerLineColor, markings.centerLinePattern);
    }

    // Bike lanes (2005+)
    if (markings.bikeLaneWidth > 0) {
      this.addBikeLanes();
    }

    // Parking lines
    if (markings.parkingLines) {
      this.addParkingLines();
    }
  }

  private addCenterLines(color: number, pattern: string): void {
    const lineMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.0,
    });

    const y = 0.035;

    // Top street center line
    if (pattern === 'dashed') {
      for (let x = -HALF_EXTENT; x < HALF_EXTENT; x += 3) {
        const stripeGeo = new THREE.PlaneGeometry(1.5, 0.15);
        const stripe = new THREE.Mesh(stripeGeo, lineMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x + 0.75, y, -HALF_BLOCK);
        this._markingsGroup.add(stripe);
      }
    } else {
      const geo = new THREE.PlaneGeometry(TOTAL_EXTENT, 0.15);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, y, -HALF_BLOCK);
      this._markingsGroup.add(stripe);
    }

    // Bottom street center line
    if (pattern === 'dashed') {
      for (let x = -HALF_EXTENT; x < HALF_EXTENT; x += 3) {
        const stripeGeo = new THREE.PlaneGeometry(1.5, 0.15);
        const stripe = new THREE.Mesh(stripeGeo, lineMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x + 0.75, y, HALF_BLOCK);
        this._markingsGroup.add(stripe);
      }
    } else {
      const geo = new THREE.PlaneGeometry(TOTAL_EXTENT, 0.15);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, y, HALF_BLOCK);
      this._markingsGroup.add(stripe);
    }

    // Left street center line
    if (pattern === 'dashed') {
      for (let z = -HALF_EXTENT; z < HALF_EXTENT; z += 3) {
        const stripeGeo = new THREE.PlaneGeometry(0.15, 1.5);
        const stripe = new THREE.Mesh(stripeGeo, lineMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(-HALF_BLOCK, y, z + 0.75);
        this._markingsGroup.add(stripe);
      }
    } else {
      const geo = new THREE.PlaneGeometry(0.15, TOTAL_EXTENT);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-HALF_BLOCK, y, 0);
      this._markingsGroup.add(stripe);
    }

    // Right street center line
    if (pattern === 'dashed') {
      for (let z = -HALF_EXTENT; z < HALF_EXTENT; z += 3) {
        const stripeGeo = new THREE.PlaneGeometry(0.15, 1.5);
        const stripe = new THREE.Mesh(stripeGeo, lineMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(HALF_BLOCK, y, z + 0.75);
        this._markingsGroup.add(stripe);
      }
    } else {
      const geo = new THREE.PlaneGeometry(0.15, TOTAL_EXTENT);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(HALF_BLOCK, y, 0);
      this._markingsGroup.add(stripe);
    }
  }

  private addBikeLanes(): void {
    const bikeMat = new THREE.MeshStandardMaterial({
      color: 0x44aa44,
      roughness: 0.6,
      metalness: 0.0,
    });

    const y = 0.036;
    const bikeWidth = 0.3; // painted band width

    // Top street bike lane markings
    for (const zOff of [-HALF_BLOCK - 2, -HALF_BLOCK + 2]) {
      const geo = new THREE.PlaneGeometry(TOTAL_EXTENT, bikeWidth);
      const stripe = new THREE.Mesh(geo, bikeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, y, zOff);
      this._markingsGroup.add(stripe);
    }

    // Bottom street
    for (const zOff of [HALF_BLOCK - 2, HALF_BLOCK + 2]) {
      const geo = new THREE.PlaneGeometry(TOTAL_EXTENT, bikeWidth);
      const stripe = new THREE.Mesh(geo, bikeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, y, zOff);
      this._markingsGroup.add(stripe);
    }

    // Left street
    for (const xOff of [-HALF_BLOCK - 2, -HALF_BLOCK + 2]) {
      const geo = new THREE.PlaneGeometry(bikeWidth, TOTAL_EXTENT);
      const stripe = new THREE.Mesh(geo, bikeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(xOff, y, 0);
      this._markingsGroup.add(stripe);
    }

    // Right street
    for (const xOff of [HALF_BLOCK - 2, HALF_BLOCK + 2]) {
      const geo = new THREE.PlaneGeometry(bikeWidth, TOTAL_EXTENT);
      const stripe = new THREE.Mesh(geo, bikeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(xOff, y, 0);
      this._markingsGroup.add(stripe);
    }
  }

  private addParkingLines(): void {
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.0,
    });

    const y = 0.037;
    const lineWidth = 0.1;

    // Parking space dividers along each side
    const spacing = this.spec.parking.spacing;
    const hb = HALF_BLOCK;

    // Top street
    for (let x = -hb + spacing / 2; x < hb; x += spacing) {
      const geo = new THREE.PlaneGeometry(lineWidth, 1.5);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, y, -hb - 1.5);
      this._markingsGroup.add(stripe);
    }

    // Bottom street
    for (let x = -hb + spacing / 2; x < hb; x += spacing) {
      const geo = new THREE.PlaneGeometry(lineWidth, 1.5);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, y, hb + 1.5);
      this._markingsGroup.add(stripe);
    }

    // Left street
    for (let z = -hb + spacing / 2; z < hb; z += spacing) {
      const geo = new THREE.PlaneGeometry(1.5, lineWidth);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-hb - 1.5, y, z);
      this._markingsGroup.add(stripe);
    }

    // Right street
    for (let z = -hb + spacing / 2; z < hb; z += spacing) {
      const geo = new THREE.PlaneGeometry(1.5, lineWidth);
      const stripe = new THREE.Mesh(geo, lineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(hb + 1.5, y, z);
      this._markingsGroup.add(stripe);
    }
  }

  // ── Vehicle animation loop ────────────────────────────────────────

  private advanceVehicle(v: AnimatedVehicle, delta: number): void {
    if (v.stopped) {
      v.stopTimer -= delta;
      if (v.stopTimer <= 0) {
        v.stopped = false;
      }
      return;
    }

    const seg = this.circuitPath?.segments[v.segmentIndex];
    if (!seg || seg.points.length < 2) return;

    // Move forward
    const moveAmount = v.speed * delta;
    const segLength = seg.totalLength;

    // Advance progress
    v.progress += moveAmount / segLength;

    // Check if we've reached the end of this segment
    if (v.progress >= 1.0) {
      v.progress = 0;
      v.segmentIndex = (v.segmentIndex + 1) % this.circuitPath!.segments.length;

      // Check for intersection stop
      if (this.shouldStopAtIntersection(v.segmentIndex)) {
        v.stopped = true;
        v.stopTimer = this.getStopDuration(v.type);
        return;
      }

      // Reset to beginning of next segment
      const nextSeg = this.circuitPath!.segments[v.segmentIndex];
      if (nextSeg.points.length > 0) {
        const pt = nextSeg.points[0];
        v.group.position.set(pt.x, 0.1, pt.z);
        v.group.rotation.y = pt.heading;
      }
      return;
    }

    // Interpolate position along segment
    const idx = Math.min(
      Math.floor(v.progress * (seg.points.length - 1)),
      seg.points.length - 2,
    );
    const frac = v.progress * (seg.points.length - 1) - idx;
    const p0 = seg.points[idx];
    const p1 = seg.points[idx + 1];

    const newX = p0.x + (p1.x - p0.x) * frac;
    const newZ = p0.z + (p1.z - p0.z) * frac;
    const newHeading = p0.heading + ((p1.heading - p0.heading) * frac);

    // Check for intersection approach (slow down near corners)
    const distToIntersection = this.distanceToNearestIntersection(newX, newZ);
    if (distToIntersection < 4 && distToIntersection > 0.5) {
      // Slow down near intersection
      v.group.position.set(newX, 0.1, newZ);
      v.group.rotation.y = newHeading;
      return;
    }

    v.group.position.set(newX, 0.1, newZ);
    v.group.rotation.y = newHeading;
  }

  private shouldStopAtIntersection(segIdx: number): boolean {
    // Stop at every other intersection for flow
    // Segments alternate: top, bottom, left, right
    // After completing a full lap (4 segments), pause briefly
    return segIdx === 0; // Stop at the "top" segment start (corner)
  }

  private getStopDuration(type: VehicleType): number {
    if (type === 'escooter' || type === 'ebike') return 0.5;
    if (type === 'trolley') return 2.0;
    return 1.0;
  }

  private distanceToNearestIntersection(x: number, z: number): number {
    let minDist = Infinity;
    for (const corner of CORNERS) {
      const dx = x - corner.x;
      const dz = z - corner.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  // ── Initialization ────────────────────────────────────────────────

  /** Initialize the traffic system with the first era */
  init(era?: EraId): void {
    const startEra = era || '1945';
    this.currentEra = startEra;
    this.spec = ERA_TRAFFIC_SPECS[startEra];
    this.buildCircuit();
    this.spawnVehicles();
    this.spawnParkedCars();
    this.updateStreetMarkings();
  }

  /** Clean up resources */
  dispose(): void {
    this.clearAll();
    this.scene.remove(this._markingsGroup);
  }
}
