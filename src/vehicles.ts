// Vehicles: five procedurally-built car types (vintage/muscle/sedan/suv/ev).
// Each type has a distinct silhouette. During an era transition the outgoing
// type cross-fades out while the incoming type cross-fades in, so the street
// reads as evolving rather than popping. Cars travel along the road and loop.

import * as THREE from 'three';
import { EraConfig, VehicleType } from './eras';

const ROAD_X_MIN = -54;
const ROAD_X_MAX = 54;

/** Shared geometry cache so we never rebuild primitive shapes. */
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.32, 0.32, 1, 14),
};

interface CarParts {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  mats: THREE.MeshStandardMaterial[];
}

function makeCar(type: VehicleType): CarParts {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x223344,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const mats = [bodyMat, accentMat, glassMat];

  const add = (
    geo: THREE.BufferGeometry,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.MeshStandardMaterial,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // Wheels are shared; keep simple.
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const addWheel = (x: number, z: number) => {
    const w = new THREE.Mesh(GEO.cyl, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.32, z);
    w.scale.set(1, 1, 1);
    group.add(w);
    mats.push(wheelMat);
  };

  if (type === 'vintage') {
    // Tall rounded body, separate trunk + fenders.
    add(GEO.box, 1.7, 0.5, 3.4, 0, 0.6, 0, bodyMat);
    add(GEO.box, 1.5, 0.7, 1.5, 0, 1.2, -0.2, bodyMat); // cabin
    add(GEO.box, 0.6, 0.4, 0.6, 0, 1.25, 1.1, accentMat); // roof light
    addWheel(-0.85, 1.05);
    addWheel(0.85, 1.05);
    addWheel(-0.85, -1.05);
    addWheel(0.85, -1.05);
  } else if (type === 'muscle') {
    // Long low fastback, two-tone.
    add(GEO.box, 2.0, 0.55, 4.2, 0, 0.55, 0, bodyMat);
    add(GEO.box, 1.7, 0.55, 2.0, 0, 1.05, -0.1, accentMat);
    addWheel(-1.0, 1.35);
    addWheel(1.0, 1.35);
    addWheel(-1.0, -1.35);
    addWheel(1.0, -1.35);
  } else if (type === 'sedan') {
    // Box-y 80s sedan with sharp cabin.
    add(GEO.box, 1.8, 0.6, 3.8, 0, 0.6, 0, bodyMat);
    add(GEO.box, 1.7, 0.8, 2.4, 0, 1.2, -0.1, accentMat);
    addWheel(-0.9, 1.2);
    addWheel(0.9, 1.2);
    addWheel(-0.9, -1.2);
    addWheel(0.9, -1.2);
  } else if (type === 'suv') {
    // Tall, blocky.
    add(GEO.box, 2.0, 0.85, 4.0, 0, 0.75, 0, bodyMat);
    add(GEO.box, 1.9, 0.85, 3.4, 0, 1.5, -0.1, accentMat);
    addWheel(-1.0, 1.3);
    addWheel(1.0, 1.3);
    addWheel(-1.0, -1.3);
    addWheel(1.0, -1.3);
  } else {
    // ev: smooth pod, low nose, glass canopy.
    add(GEO.box, 1.9, 0.5, 3.9, 0, 0.55, 0, bodyMat);
    add(GEO.box, 1.75, 0.6, 2.6, 0, 1.0, -0.2, glassMat);
    addWheel(-0.95, 1.25);
    addWheel(0.95, 1.25);
    addWheel(-0.95, -1.25);
    addWheel(0.95, -1.25);
  }
  return { group, bodyMat, accentMat, mats };
}

export class Vehicle {
  readonly group = new THREE.Group();
  private readonly lane: number; // z offset on road
  private readonly dir: 1 | -1;
  private speed = 6;
  private colorIndex: number;
  private currentType: VehicleType | null = null;
  private parts: CarParts | null = null;
  private spawnX: number;

  constructor(seed: number) {
    const r = seed * 9301 + 49297;
    this.dir = ((Math.floor(r / 2) % 2) + 2) % 2 === 0 ? 1 : -1;
    this.lane = this.dir === 1 ? 3.0 : -3.0;
    this.colorIndex = Math.floor(r) % 4;
    this.spawnX = ROAD_X_MIN + ((r % 1) + 1) * (ROAD_X_MAX - ROAD_X_MIN);
    this.group.position.set(this.spawnX, 0, this.lane);
    this.group.rotation.y = this.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  private buildType(type: VehicleType, color: number): void {
    this.parts?.group.children.forEach(() => {});
    if (this.parts) {
      this.group.remove(this.parts.group);
      // dispose materials (geometries shared, don't dispose)
      this.parts.mats.forEach((m) => m.dispose());
    }
    this.parts = makeCar(type);
    this.parts.bodyMat.color.set(color);
    this.currentType = type;
    this.group.add(this.parts.group);
  }

  /** Cross-fade between two types during a transition. */
  setEra(from: EraConfig, to: EraConfig, t: number): void {
    const activeType = t < 0.5 ? from.vehicleType : to.vehicleType;
    const activeEra = t < 0.5 ? from : to;
    if (activeType !== this.currentType) {
      this.buildType(activeType, activeEra.vehicleColors[this.colorIndex % activeEra.vehicleColors.length]);
    } else if (this.parts) {
      // continuous colour blend for the active era
      this.parts.bodyMat.color.set(activeEra.vehicleColors[this.colorIndex % activeEra.vehicleColors.length]);
    }
    // fade opacity through the midpoint for a soft swap
    const fade = Math.abs(t - 0.5) * 2; // 0 at midpoint, 1 at ends
    const vis = THREE.MathUtils.clamp(fade, 0.15, 1);
    this.group.visible = vis > 0.18;
    if (this.parts) {
      this.parts.group.scale.setScalar(vis > 0.5 ? 1 : 0.96);
    }
  }

  update(dt: number): void {
    const x = this.group.position.x + this.dir * this.speed * dt;
    this.group.position.x =
      this.dir === 1
        ? x > ROAD_X_MAX
          ? ROAD_X_MIN
          : x
        : x < ROAD_X_MIN
          ? ROAD_X_MAX
          : x;
    // subtle bob
    this.group.position.y = 0.02 * Math.sin(performance.now() * 0.004 + this.colorIndex);
  }

  setSpeed(s: number): void {
    this.speed = s;
  }

  dispose(): void {
    this.parts?.mats.forEach((m) => m.dispose());
  }
}

export { GEO as SHARED_GEO };
