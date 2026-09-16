/**
 * vehicleLayer.ts — Era-driven vehicle layer for the city block timelapse.
 *
 * Provides procedural low-poly vehicles per era (1940s sedans, 1965 tailfins/
 * beetles, 1985 boxy sedans/taxis, 2005 SUVs/sedans, 2025 EVs/e-scooters), a
 * traffic loop on the shared road lanes, and parked cars. Integrates with
 * SceneRuntime via attach/update/dispose.
 */

import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three';
import type { FrameState } from '../core/sceneRuntime';
import { ROAD } from '../core/blockLayout';
import { ERAS, type EraId, type EraVehicles } from '../eras/eraSystem';

/* ------------------------------------------------------------------ *
 * Traffic Path Geometry
 * ------------------------------------------------------------------ */

/** Segment of the clockwise traffic loop path. */
interface PathSegment {
  readonly dx: number;
  readonly dz: number;
  readonly length: number;
  readonly startX: number;
  readonly startZ: number;
}

/** Build the 8-segment clockwise path for a given lane index. */
function buildPathSegments(laneIndex: number): PathSegment[] {
  const lc = ROAD.laneCenters[laneIndex];

  const northZ = ROAD.north.minZ + lc;
  const eastX = ROAD.east.minX + lc;
  const southZ = ROAD.south.maxZ - lc;
  const westX = ROAD.west.maxX - lc;
  const cornerInset = 2;

  return [
    { dx: 1, dz: 0, length: ROAD.north.maxX - ROAD.north.minX - 2 * cornerInset, startX: ROAD.north.minX + cornerInset, startZ: northZ },
    { dx: (eastX - (ROAD.north.maxX - cornerInset)) / 3, dz: ((ROAD.east.maxZ - cornerInset) - northZ) / 3, length: Math.hypot(eastX - (ROAD.north.maxX - cornerInset), (ROAD.east.maxZ - cornerInset) - northZ) / 3, startX: ROAD.north.maxX - cornerInset, startZ: northZ },
    { dx: 0, dz: -1, length: ROAD.east.maxZ - ROAD.east.minZ - 2 * cornerInset, startX: eastX, startZ: ROAD.east.maxZ - cornerInset },
    { dx: ((ROAD.south.maxX - cornerInset) - eastX) / 3, dz: (southZ - (ROAD.east.minZ + cornerInset)) / 3, length: Math.hypot((ROAD.south.maxX - cornerInset) - eastX, southZ - (ROAD.east.minZ + cornerInset)) / 3, startX: eastX, startZ: ROAD.east.minZ + cornerInset },
    { dx: -1, dz: 0, length: ROAD.south.maxX - ROAD.south.minX - 2 * cornerInset, startX: ROAD.south.maxX - cornerInset, startZ: southZ },
    { dx: ((ROAD.west.minX + cornerInset) - (ROAD.south.minX + cornerInset)) / 3, dz: (westX - southZ) / 3, length: Math.hypot((ROAD.west.minX + cornerInset) - (ROAD.south.minX + cornerInset), westX - southZ) / 3, startX: ROAD.south.minX + cornerInset, startZ: southZ },
    { dx: 0, dz: 1, length: ROAD.west.maxZ - ROAD.west.minZ - 2 * cornerInset, startX: westX, startZ: ROAD.west.minZ + cornerInset },
    { dx: ((ROAD.north.minX + cornerInset) - westX) / 3, dz: (northZ - (ROAD.west.maxZ - cornerInset)) / 3, length: Math.hypot((ROAD.north.minX + cornerInset) - westX, northZ - (ROAD.west.maxZ - cornerInset)) / 3, startX: westX, startZ: ROAD.west.maxZ - cornerInset },
  ];
}

/** Total length of a lane's traffic path. */
function pathTotalLength(segments: readonly PathSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.length, 0);
}

/** Position on path given distance traveled along segments. */
function positionAtDistance(segments: readonly PathSegment[], distance: number): { x: number; z: number } {
  const total = pathTotalLength(segments);
  let d = ((distance % total) + total) % total;

  for (const seg of segments) {
    if (d <= seg.length) {
      const t = d / seg.length;
      return { x: seg.startX + seg.dx * seg.length * t, z: seg.startZ + seg.dz * seg.length * t };
    }
    d -= seg.length;
  }
  return { x: segments[0].startX, z: segments[0].startZ };
}

/** Heading (rotation.y) at a given distance along the path. */
function headingAtDistance(segments: readonly PathSegment[], distance: number): number {
  const total = pathTotalLength(segments);
  let d = ((distance % total) + total) % total;

  for (const seg of segments) {
    if (d <= seg.length) {
      return Math.atan2(seg.dz * seg.length, seg.dx * seg.length);
    }
    d -= seg.length;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Vehicle Geometry
 * ------------------------------------------------------------------ */

interface VehicleDims {
  length: number;
  width: number;
  height: number;
  roofHeight: number;
}

const VEHICLE_DIMS: Record<string, VehicleDims> = {
  'sedan-1940': { length: 4, width: 1.6, height: 1.0, roofHeight: 0.8 },
  'pickup-truck': { length: 4.2, width: 1.7, height: 1.3, roofHeight: 1.1 },
  'delivery-van': { length: 4.5, width: 1.8, height: 1.6, roofHeight: 1.4 },
  tailfin: { length: 4.4, width: 1.7, height: 1.1, roofHeight: 0.9 },
  beetle: { length: 3.6, width: 1.5, height: 1.0, roofHeight: 0.8 },
  'station-wagon': { length: 4.5, width: 1.7, height: 1.2, roofHeight: 1.0 },
  convertible: { length: 4.0, width: 1.6, height: 0.9, roofHeight: 0.7 },
  'boxy-sedan': { length: 4.2, width: 1.7, height: 1.1, roofHeight: 1.0 },
  taxi: { length: 4.2, width: 1.7, height: 1.1, roofHeight: 1.0 },
  'cargo-van': { length: 4.8, width: 1.9, height: 1.7, roofHeight: 1.5 },
  hatchback: { length: 3.8, width: 1.6, height: 1.0, roofHeight: 0.9 },
  suv: { length: 4.5, width: 1.9, height: 1.5, roofHeight: 1.3 },
  sedan: { length: 4.3, width: 1.7, height: 1.1, roofHeight: 0.9 },
  minivan: { length: 4.7, width: 1.9, height: 1.6, roofHeight: 1.4 },
  'ev-sedan': { length: 4.1, width: 1.7, height: 1.0, roofHeight: 0.8 },
  'ev-suv': { length: 4.4, width: 1.9, height: 1.4, roofHeight: 1.2 },
  'e-scooter': { length: 1.6, width: 0.5, height: 0.4, roofHeight: 0.3 },
  'electric-bus': { length: 8, width: 2.2, height: 2.5, roofHeight: 2.2 },
};

const geomCache = new Map<string, { chassis: BoxGeometry; cabin: BoxGeometry; accent: BoxGeometry | null }>();

function getOrCreateVehicleGeometry(type: string) {
  if (geomCache.has(type)) return geomCache.get(type)!;

  const dims = VEHICLE_DIMS[type] ?? VEHICLE_DIMS['sedan-1940'];
  const chassis = new BoxGeometry(dims.length, dims.height * 0.5, dims.width);
  const cabin = new BoxGeometry(dims.length * 0.6, dims.roofHeight * 0.6, dims.width * 0.7);
  let accent: BoxGeometry | null = null;
  if (type === 'tailfin') {
    accent = new BoxGeometry(0.5, dims.height * 0.8, dims.width * 0.3);
  } else if (type === 'e-scooter') {
    accent = new BoxGeometry(dims.length, 0.1, dims.width);
  }
  const result = { chassis, cabin, accent };
  geomCache.set(type, result);
  return result;
}

function disposeGeometryCache(): void {
  for (const { chassis, cabin, accent } of geomCache.values()) {
    chassis.dispose();
    cabin.dispose();
    accent?.dispose();
  }
  geomCache.clear();
}

/* ------------------------------------------------------------------ *
 * Vehicle Creation
 * ------------------------------------------------------------------ */

function createVehicleMesh(type: string, eraVehicles: EraVehicles, seed: number): Group {
  const dims = VEHICLE_DIMS[type] ?? VEHICLE_DIMS['sedan-1940'];
  const { chassis, cabin, accent } = getOrCreateVehicleGeometry(type);
  const colorIdx = Math.abs(seed) % eraVehicles.colors.length;
  const color = new Color(eraVehicles.colors[colorIdx]);
  const material = new MeshBasicMaterial({ color });

  const group = new Group();

  const chassisMesh = new Mesh(chassis, material);
  chassisMesh.position.y = dims.height * 0.25;
  group.add(chassisMesh);

  const cabinMesh = new Mesh(cabin, material);
  cabinMesh.position.y = dims.height * 0.4;
  group.add(cabinMesh);

  if (accent) {
    const accentMesh = new Mesh(accent, material);
    if (type === 'tailfin') {
      accentMesh.position.set(dims.length * 0.35, dims.height * 0.4, 0);
    } else if (type === 'e-scooter') {
      accentMesh.position.y = dims.height * 0.2;
    }
    group.add(accentMesh);
  }

  return group;
}

/* ------------------------------------------------------------------ *
 * VehicleLayer
 * ------------------------------------------------------------------ */

/**
 * Era-driven vehicle layer.
 *
 * Owns procedural per-era vehicle fleets, a clockwise traffic loop on the
 * shared road lanes, and parked cars. Integrates with SceneRuntime via the
 * SceneLayer interface (attach/update/dispose) and exposes attach(group),
 * applyEra(eraId) and dispose() for explicit control.
 */
export class VehicleLayer {
  readonly id = 'vehicles';

  private _currentEra: EraId = 1945;
  private root: Group = new Group();
  private movingVehicles: Array<{ group: Group; lane: number; distance: number; pathSegments: readonly PathSegment[] }> = [];
  private parkedVehicles: Group[] = [];

  /** Current era being displayed. */
  get currentEra(): EraId {
    return this._currentEra;
  }

  /** Total number of vehicles currently in the scene. */
  get count(): number {
    return this.movingVehicles.length + this.parkedVehicles.length;
  }

  createRoot(): Group {
    return this.root;
  }

  /**
   * Attach the layer root into a scene graph group.
   * Called by the integration layer after SceneRuntime.attachLayer().
   */
  attach(group: Group): void {
    group.add(this.root);
  }

  /**
   * Apply an era's vehicle fleet and reinitialize traffic logic.
   * Swaps all existing vehicles for the new era's fleet.
   */
  applyEra(eraId: EraId, _progress: number = 1): void {
    this.dispose();

    this._currentEra = eraId;
    const eraVehicles = ERAS[eraId].vehicles;

    this.buildMovingFleet(eraVehicles);
    this.buildParkedFleet(eraVehicles);
  }

  /**
   * Advance the traffic simulation one frame.
   * Called by SceneRuntime.step() via the SceneLayer interface.
   */
  update(state: FrameState): void {
    if (this.movingVehicles.length === 0) return;

    const eraVehicles = ERAS[this._currentEra].vehicles;
    const speedMps = 0.8 + eraVehicles.density * 0.6;
    const delta = Math.min(state.delta, 0.05) * speedMps;

    for (const v of this.movingVehicles) {
      v.distance += delta * 12;
      const pos = positionAtDistance(v.pathSegments, v.distance);
      const heading = headingAtDistance(v.pathSegments, v.distance);
      v.group.position.set(pos.x, 0, pos.z);
      v.group.rotation.y = heading;
    }
  }

  /**
   * Clear all vehicles and release resources.
   */
  dispose(): void {
    for (const v of this.movingVehicles) {
      this.root.remove(v.group);
      v.group.traverse((obj: unknown) => {
        if (obj instanceof Mesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
    }
    for (const p of this.parkedVehicles) {
      this.root.remove(p);
      p.traverse((obj: unknown) => {
        if (obj instanceof Mesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
    }
    this.movingVehicles = [];
    this.parkedVehicles = [];
    disposeGeometryCache();
  }

  /** Build moving traffic vehicles for an era. */
  private buildMovingFleet(eraVehicles: EraVehicles): void {
    const laneCount = 2;
    const basePerLane = Math.round(4 + eraVehicles.density * 6);

    for (let lane = 0; lane < laneCount; lane++) {
      const pathSegments = buildPathSegments(lane);
      const pathLength = pathTotalLength(pathSegments);

      for (let i = 0; i < basePerLane; i++) {
        const type = eraVehicles.types[i % eraVehicles.types.length];
        const group = createVehicleMesh(type, eraVehicles, i * 13 + lane * 7);

        const distance = (i / basePerLane) * pathLength + lane * (pathLength / basePerLane);
        const pos = positionAtDistance(pathSegments, distance);
        const heading = headingAtDistance(pathSegments, distance);

        group.position.set(pos.x, 0, pos.z);
        group.rotation.y = heading;

        this.root.add(group);

        this.movingVehicles.push({ group, lane, distance, pathSegments });
      }
    }
  }

  /** Build parked cars along the road edges for an era. */
  private buildParkedFleet(eraVehicles: EraVehicles): void {
    const positions: Array<{ x: number; z: number; rotationY: number }> = [];

    for (let i = 0; i < 4; i++) {
      positions.push({ x: -55 + i * 30, z: ROAD.north.minZ + 0.5, rotationY: 0 });
    }
    for (let i = 0; i < 4; i++) {
      positions.push({ x: -55 + i * 30, z: ROAD.south.maxZ - 0.5, rotationY: Math.PI });
    }
    for (let i = 0; i < 3; i++) {
      positions.push({ x: ROAD.east.minX + 0.5, z: -30 + i * 30, rotationY: -Math.PI / 2 });
    }
    for (let i = 0; i < 3; i++) {
      positions.push({ x: ROAD.west.maxX - 0.5, z: -30 + i * 30, rotationY: Math.PI / 2 });
    }

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const type = eraVehicles.parkedTypes[i % eraVehicles.parkedTypes.length];
      const group = createVehicleMesh(type, eraVehicles, i + 100);

      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.rotationY;

      this.root.add(group);
      this.parkedVehicles.push(group);
    }
  }
}