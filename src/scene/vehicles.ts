import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getEraConfig, type EraId } from '../eras';
import { getLaneAnchors, type LaneAnchor } from './blockLayout';

/**
 * Vehicle subsystem — era-reactive traffic on the block streets.
 *
 * Reads the era config (`VehiclesConfig` from Phase 1) for the vehicle types,
 * body color palette, traffic density and headlight color of the current era,
 * then instantiates a stylized fleet that drives along the street lanes.
 *
 * Design:
 *  - One InstancedMesh per (era, type) body geometry, plus a shared wheel
 *    InstancedMesh and a headlight InstancedMesh per era. Repeated bodies and
 *    wheels are therefore drawn as a handful of draw calls regardless of the
 *    number of vehicles.
 *  - Each era has its own body geometry (tailfins in 1965, boxy shapes in 1985,
 *    EVs in 2025, ...) built procedurally from merged primitives.
 *  - Vehicles follow the block lanes and wrap to the next lane at a corner, so
 *    traffic loops around the block.
 *  - When the era store's dominant era changes (mid-transition), the fleet is
 *    rebuilt: the previous set disappears and the new era's set/colors/density
 *    appear, so traffic visibly changes with the transition.
 *
 * Scene module contract: exposes `group`, `update(dt, state)`, `setEra(era, t)`
 * and `dispose()`. It does not start its own render loop.
 */

/** Max per-type body instances and total wheel/headlight capacity. */
const MAX_PER_TYPE = 12;
const WHEELS_PER_CAR = 4;
const HEADLIGHTS_PER_CAR = 2;

/** Shared state consumed by `update`. */
export interface VehicleState {
  /** Normalized 0..1 transition progress between current and target era. */
  transitionProgress: number;
  currentEra: EraId;
  targetEra: EraId;
}

/** One active vehicle on the road. */
interface Vehicle {
  type: string;
  laneIndex: number;
  /** 0..1 progress along the current lane. */
  offset: number;
  speed: number;
  color: THREE.Color;
  /** Per-type size scale applied to body + wheels. */
  scale: number;
}

/** Per-type geometry/dimension spec. */
interface TypeSpec {
  /** Body width (X). */
  w: number;
  /** Body length (Z). */
  l: number;
  /** Body height (Y). */
  h: number;
  /** Cabin height above body. */
  cabinH: number;
  /** Cabin length. */
  cabinL: number;
  /** Cabin centre offset along Z (negative = forward). */
  cabinZ: number;
  /** Cabin width. */
  cabinW: number;
  /** Rear offset of body along Z (positive = behind). */
  rear: number;
  /** Wheel radius. */
  wheelR: number;
  /** Half-track width (X) of the wheels. */
  track: number;
  /** Half wheelbase between front and rear axles. */
  wheelBase: number;
  /** Number of wheels (2 for scooters, else 4). */
  wheels: number;
  /** Extra body feature eras can add. */
  feature: 'none' | 'tail' | 'boxy' | 'truck' | 's-rail';
  /** Per-instance scale multiplier. */
  scale: number;
}

/** Procedurally build a merged body geometry for an era + type. */
function buildBodyGeometry(era: EraId, type: string): THREE.BufferGeometry {
  const spec = getTypeSpec(era, type);
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, l);
    g.translate(x, y, z);
    parts.push(g);
  };

  // Main body slab.
  box(spec.w, spec.h, spec.l, 0, spec.h / 2, 0);
  // Cabin.
  box(spec.cabinW, spec.cabinH, spec.cabinL, 0, spec.h + spec.cabinH / 2, spec.cabinZ);

  if (spec.feature === 'tail') {
    // 1965 tailfin wings rising at the rear of the cabin.
    const finW = spec.w * 0.18;
    const finH = spec.h * 0.5;
    const finL = spec.l * 0.28;
    const finY = spec.h + spec.cabinH * 0.55;
    const finZ = spec.cabinZ + spec.cabinL * 0.5 + finL * 0.4;
    box(finW, finH, finL, -spec.w / 2 + finW / 2, finY, finZ);
    box(finW, finH, finL, spec.w / 2 - finW / 2, finY, finZ);
  } else if (spec.feature === 'truck') {
    // Enclosed cargo bed behind the cab.
    const bedL = spec.l * 0.55;
    const bedZ = -spec.l / 2 + bedL / 2;
    box(spec.w, spec.h * 0.95, bedL, 0, spec.h * 0.95 / 2 + 0.02, bedZ);
  } else if (spec.feature === 'boxy') {
    // Taller, more upright cabin for boxy 80s/90s shapes.
    box(spec.w * 0.92, spec.cabinH * 1.25, spec.cabinL * 0.9, 0, spec.h + spec.cabinH * 0.62, spec.cabinZ);
  } else if (spec.feature === 's-rail') {
    // Roof rails on SUVs.
    const railW = spec.w * 0.06;
    const railH = 0.06;
    const railL = spec.cabinL * 0.9;
    const railY = spec.h + spec.cabinH + railH / 2;
    box(railW, railH, railL, -spec.w / 2 + railW / 2, railY, spec.cabinZ);
    box(railW, railH, railL, spec.w / 2 - railW / 2, railY, spec.cabinZ);
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) {
    // Fallback: a plain box so the scene never breaks.
    return new THREE.BoxGeometry(spec.w, spec.h, spec.l);
  }
  merged.computeVertexNormals();
  return merged;
}

/** Era + type → geometry spec. */
function getTypeSpec(era: EraId, type: string): TypeSpec {
  // Default sedan spec; adjusted per era/type below.
  const base: TypeSpec = {
    w: 1.8,
    l: 4.6,
    h: 0.9,
    cabinH: 0.5,
    cabinL: 2.3,
    cabinZ: -0.2,
    cabinW: 1.5,
    rear: 0,
    wheelR: 0.32,
    track: 1.5,
    wheelBase: 1.6,
    wheels: 4,
    feature: 'none',
    scale: 1,
  };

  switch (type) {
    case 'sedan':
      return era === '1945'
        ? { ...base, feature: 'boxy' }
        : era === '1965'
          ? { ...base, feature: 'tail' }
          : era === '1985'
            ? { ...base, feature: 'boxy', cabinH: 0.55 }
            : era === '2005'
              ? { ...base, w: 1.85, l: 4.7 }
              : { ...base, w: 1.85, l: 4.7, cabinH: 0.45, feature: 'none' };
    case 'coupe':
      return { ...base, l: 4.4, cabinL: 1.9, cabinZ: -0.1, cabinH: 0.42, scale: 0.96 };
    case 'convertible':
      return { ...base, l: 4.5, cabinH: 0.22, cabinL: 2.1, cabinZ: -0.15, scale: 0.98 };
    case 'station-wagon':
      return { ...base, l: 5.0, cabinL: 3.4, cabinH: 0.5, cabinZ: -0.4, scale: 1.02 };
    case 'truck':
      return {
        w: 2.0, l: 5.4, h: 1.0, cabinH: 0.7, cabinL: 1.6, cabinZ: 1.0, cabinW: 1.8,
        rear: 1.0, wheelR: 0.36, track: 1.7, wheelBase: 2.0, wheels: 4, feature: 'truck', scale: 1.05,
      };
    case 'trolley':
      return {
        w: 2.1, l: 6.2, h: 1.3, cabinH: 0.8, cabinL: 5.6, cabinZ: 0, cabinW: 2.0,
        rear: 0, wheelR: 0.38, track: 1.8, wheelBase: 2.4, wheels: 4, feature: 'none', scale: 1.1,
      };
    case 'hatchback':
      return { ...base, l: 4.3, cabinL: 2.6, cabinZ: -0.3, cabinH: 0.58, feature: 'boxy', scale: 0.97 };
    case 'minivan':
      return {
        w: 1.9, l: 4.7, h: 1.1, cabinH: 0.75, cabinL: 3.6, cabinZ: -0.3, cabinW: 1.8,
        rear: 0, wheelR: 0.33, track: 1.6, wheelBase: 1.7, wheels: 4, feature: 'boxy', scale: 1.0,
      };
    case 'taxi':
      return { ...base, w: 1.8, l: 4.6, cabinH: 0.6, feature: 'boxy', scale: 1.0 };
    case 'suv':
      return {
        w: 1.95, l: 4.8, h: 1.1, cabinH: 0.62, cabinL: 2.9, cabinZ: -0.3, cabinW: 1.85,
        rear: 0, wheelR: 0.4, track: 1.65, wheelBase: 2.0, wheels: 4, feature: 's-rail', scale: 1.05,
      };
    case 'bus':
      return {
        w: 2.0, l: 5.6, h: 1.6, cabinH: 0.9, cabinL: 5.2, cabinZ: 0, cabinW: 1.9,
        rear: 0, wheelR: 0.42, track: 1.7, wheelBase: 2.4, wheels: 4, feature: 'none', scale: 1.1,
      };
    case 'ev':
      return { ...base, w: 1.85, l: 4.7, cabinH: 0.42, cabinL: 2.5, cabinZ: -0.25, feature: 'none', scale: 1.0 };
    case 'scooter':
      return {
        w: 0.7, l: 1.9, h: 0.7, cabinH: 0.1, cabinL: 0.4, cabinZ: 0.2, cabinW: 0.6,
        rear: 0, wheelR: 0.22, track: 0.55, wheelBase: 0.7, wheels: 2, feature: 'none', scale: 0.9,
      };
    default:
      return base;
  }
}

export class Vehicles {
  readonly group: THREE.Group;

  private meshes = new Map<string, THREE.InstancedMesh>();
  private wheelMeshes = new Map<EraId, THREE.InstancedMesh>();
  private headlightMeshes = new Map<EraId, THREE.InstancedMesh>();
  private bodyGeos = new Map<string, THREE.BufferGeometry>();
  private wheelGeo: THREE.BufferGeometry;
  private headlightGeo: THREE.BufferGeometry;

  private bodyMat: THREE.MeshStandardMaterial;
  private wheelMat: THREE.MeshStandardMaterial;
  private headlightMat: THREE.MeshBasicMaterial;

  private activeEra: EraId | null = null;
  private vehicles: Vehicle[] = [];
  private lanes: LaneAnchor[] = [];
  private laneLengths: number[] = [];

  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'vehicles';

    this.bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.35 });
    this.wheelMat = new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.9, metalness: 0.1 });
    this.headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

    this.wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 10);
    this.wheelGeo.rotateZ(Math.PI / 2); // axle along X
    this.headlightGeo = new THREE.SphereGeometry(0.14, 6, 5);

    this.lanes = getLaneAnchors();
    this.laneLengths = this.lanes.map((l) => l.start.distanceTo(l.end));

    // Build all era geometries up front so era switches are instant.
    for (const era of ['1945', '1965', '1985', '2005', '2025'] as const) {
      const cfg = getEraConfig(era);
      for (const type of cfg.vehicles.types) {
        this.ensureMeshes(era, type);
      }
    }

    // Initial era.
    this.setEra('1945', 1);
  }

  private ensureMeshes(era: EraId, type: string): void {
    const key = `${era}:${type}`;
    if (this.meshes.has(key)) return;

    const geo = buildBodyGeometry(era, type);
    this.bodyGeos.set(key, geo);

    const body = new THREE.InstancedMesh(geo, this.bodyMat, MAX_PER_TYPE);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.castShadow = true;
    body.name = `vehicles-${era}-${type}`;
    this.meshes.set(key, body);
    this.group.add(body);
    body.visible = false;

    if (!this.wheelMeshes.has(era)) {
      const wheels = new THREE.InstancedMesh(this.wheelGeo, this.wheelMat, MAX_PER_TYPE * WHEELS_PER_CAR);
      wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      wheels.name = `wheels-${era}`;
      this.wheelMeshes.set(era, wheels);
      this.group.add(wheels);
      wheels.visible = false;
    }
    if (!this.headlightMeshes.has(era)) {
      const headlights = new THREE.InstancedMesh(this.headlightGeo, this.headlightMat, MAX_PER_TYPE * HEADLIGHTS_PER_CAR);
      headlights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      headlights.name = `headlights-${era}`;
      this.headlightMeshes.set(era, headlights);
      this.group.add(headlights);
      headlights.visible = false;
    }
  }

  /** Apply a fully-resolved era (construction / settle / dominant swap). */
  setEra(era: EraId, _t = 1): void {
    if (this.disposed) return;
    if (this.activeEra === era) return;

    // Hide the previous era's meshes.
    if (this.activeEra) {
      for (const [key, mesh] of this.meshes) {
        if (key.startsWith(`${this.activeEra}:`)) mesh.visible = false;
      }
      this.wheelMeshes.get(this.activeEra)!.visible = false;
      this.headlightMeshes.get(this.activeEra)!.visible = false;
    }

    this.activeEra = era;
    const cfg = getEraConfig(era);
    const types = cfg.vehicles.types;
    const colors = cfg.vehicles.colors;
    const density = cfg.vehicles.trafficDensity;

    // Headlight color from config.
    this.headlightMat.color.set(cfg.vehicles.headlightColor);

    for (const type of types) this.ensureMeshes(era, type);

    // Show the new era's meshes.
    for (const type of types) this.meshes.get(`${era}:${type}`)!.visible = true;
    this.wheelMeshes.get(era)!.visible = true;
    this.headlightMeshes.get(era)!.visible = true;

    // Build the fleet.
    const count = Math.max(2, Math.round(MAX_PER_TYPE * density));
    this.vehicles = [];
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const spec = getTypeSpec(era, type);
      const laneIndex = i % this.lanes.length;
      const color = new THREE.Color(colors[i % colors.length]);
      const speed = (3.2 + Math.random() * 2.6) * (0.8 + Math.random() * 0.5);
      this.vehicles.push({
        type,
        laneIndex,
        offset: Math.random(),
        speed,
        color,
        scale: spec.scale,
      });
    }

    // Write initial instance transforms.
    this.writeInstances(0);
  }

  /** Advance vehicles and write instance matrices. */
  private writeInstances(dt: number): void {
    if (!this.activeEra) return;

    // Advance motion.
    for (const v of this.vehicles) {
      const len = this.laneLengths[v.laneIndex] || 1;
      v.offset += (v.speed * dt) / len;
      if (v.offset >= 1) {
        // Wrap around the corner to the next lane.
        v.offset = v.offset - 1;
        v.laneIndex = (v.laneIndex + 1) % this.lanes.length;
      }
    }

    // Per-type instance counters.
    const counters = new Map<string, number>();
    const wheelCounter = new Map<EraId, number>();
    const headlightCounter = new Map<EraId, number>();

    for (const v of this.vehicles) {
      const lane = this.lanes[v.laneIndex];
      const dir = lane.direction;
      const yaw = Math.atan2(dir.x, dir.z);
      const t = v.offset;

      const x = lane.start.x + (lane.end.x - lane.start.x) * t;
      const z = lane.start.z + (lane.end.z - lane.start.z) * t;

      const spec = getTypeSpec(this.activeEra, v.type);
      const s = v.scale;

      // Body instance.
      const key = `${this.activeEra}:${v.type}`;
      const body = this.meshes.get(key);
      if (body) {
        const idx = counters.get(key) ?? 0;
        this.dummy.position.set(x, 0.05, z);
        this.dummy.rotation.set(0, yaw, 0);
        this.dummy.scale.setScalar(s);
        this.dummy.updateMatrix();
        body.setMatrixAt(idx, this.dummy.matrix);
        this.tmpColor.copy(v.color);
        body.setColorAt(idx, this.tmpColor);
        counters.set(key, idx + 1);
      }

      // Wheels.
      const wheels = this.wheelMeshes.get(this.activeEra);
      if (wheels) {
        const wbase = spec.wheelBase;
        const track = spec.track;
        const frontZ = wbase / 2;
        const rearZ = -wbase / 2;
        const offsets: Array<[number, number, number]> = [];
        if (spec.wheels === 2) {
          offsets.push([0, spec.wheelR, 0]);
          offsets.push([0, spec.wheelR, 0]);
        } else {
          offsets.push([-track / 2, spec.wheelR, frontZ]);
          offsets.push([track / 2, spec.wheelR, frontZ]);
          offsets.push([-track / 2, spec.wheelR, rearZ]);
          offsets.push([track / 2, spec.wheelR, rearZ]);
        }
        let widx = wheelCounter.get(this.activeEra) ?? 0;
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        for (const [ox, oy, oz] of offsets) {
          const wx = ox * c + oz * sn;
          const wz = -ox * sn + oz * c;
          this.dummy.position.set(x + wx, 0.05 + oy * s, z + wz);
          this.dummy.rotation.set(0, yaw, 0);
          this.dummy.scale.setScalar(s);
          this.dummy.updateMatrix();
          wheels.setMatrixAt(widx, this.dummy.matrix);
          widx++;
        }
        wheelCounter.set(this.activeEra, widx);
      }

      // Headlights.
      const headlights = this.headlightMeshes.get(this.activeEra);
      if (headlights) {
        let hidx = headlightCounter.get(this.activeEra) ?? 0;
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        const hlZ = spec.l / 2 * 0.5;
        const hlX = spec.track * 0.25;
        for (const hx of [-hlX, hlX]) {
          const wx = hx * c + hlZ * sn;
          const wz = -hx * sn + hlZ * c;
          this.dummy.position.set(x + wx, 0.95, z + wz);
          this.dummy.rotation.set(0, yaw, 0);
          this.dummy.scale.setScalar(s * 1.1);
          this.dummy.updateMatrix();
          headlights.setMatrixAt(hidx, this.dummy.matrix);
          hidx++;
        }
        headlightCounter.set(this.activeEra, hidx);
      }
    }

    // Mark dirty + hide unused instances.
    for (const [key, mesh] of this.meshes) {
      if (!key.startsWith(`${this.activeEra}:`)) continue;
      const used = counters.get(key) ?? 0;
      for (let i = used; i < MAX_PER_TYPE; i++) {
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const wheels = this.wheelMeshes.get(this.activeEra);
    if (wheels) {
      const used = wheelCounter.get(this.activeEra) ?? 0;
      for (let i = used; i < MAX_PER_TYPE * WHEELS_PER_CAR; i++) {
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        wheels.setMatrixAt(i, this.dummy.matrix);
      }
      wheels.instanceMatrix.needsUpdate = true;
    }
    const headlights = this.headlightMeshes.get(this.activeEra);
    if (headlights) {
      const used = headlightCounter.get(this.activeEra) ?? 0;
      for (let i = used; i < MAX_PER_TYPE * HEADLIGHTS_PER_CAR; i++) {
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        headlights.setMatrixAt(i, this.dummy.matrix);
      }
      headlights.instanceMatrix.needsUpdate = true;
    }
  }

  /** Called each frame by the composition root. */
  update(dt: number, state: VehicleState): void {
    if (this.disposed) return;

    // Determine the dominant era; swap the fleet when it changes so the set,
    // colors and density follow the transition.
    const dominant = state.transitionProgress >= 0.5 ? state.targetEra : state.currentEra;
    if (this.activeEra !== dominant) {
      this.setEra(dominant);
    }

    this.writeInstances(dt);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.meshes.clear();
    for (const w of this.wheelMeshes.values()) w.dispose();
    for (const h of this.headlightMeshes.values()) h.dispose();
    this.wheelMeshes.clear();
    this.headlightMeshes.clear();
    this.wheelGeo.dispose();
    this.headlightGeo.dispose();
    this.bodyMat.dispose();
    this.wheelMat.dispose();
    this.headlightMat.dispose();
  }
}