// Vehicles module — era-specific procedural cars driving up and down the
// road lanes. Each vehicle rebuilds its body/cabin/fin geometry on era
// change so silhouettes match the time period (1945 sedan, 1965 fin,
// 1985 box, 2005 SUV, 2025 EV).

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { moodAt } from '../mood';
import { mulberry32, range } from './rand';

const LANE_X = [-3.2, 3.2];
const DESPAWN = 62;
const CAR_COUNT = 9;

interface Car {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  lane: number;
  speed: number;
  z: number;
  phase: number;
  bodyGeo: THREE.BufferGeometry | null;
  cabinGeo: THREE.BufferGeometry | null;
  finGeo: THREE.BufferGeometry | null;
}

export class VehiclesModule implements SceneModule {
  readonly name = 'vehicles';
  readonly group: THREE.Group = new THREE.Group();

  private cars: Car[] = [];

  constructor() {
    const rnd = mulberry32(2024);
    for (let i = 0; i < CAR_COUNT; i++) {
      const lane = i % LANE_X.length;
      const z = range(rnd, -DESPAWN, DESPAWN);
      const car = this.makeCar(rnd, lane, z);
      this.cars.push(car);
    }
    this.setEra('1945');
  }

  private makeCar(rnd: () => number, lane: number, z: number): Car {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#b03a2e', roughness: 0.35, metalness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: '#e0d8c8', roughness: 0.4, metalness: 0.2 });
    group.position.set(LANE_X[lane], 0, z);
    group.rotation.y = lane === 0 ? 0 : Math.PI;
    this.group.add(group);
    return {
      group,
      bodyMat,
      accentMat,
      lane,
      speed: range(rnd, 3, 8),
      z,
      phase: range(rnd, 0, Math.PI * 2),
      bodyGeo: null,
      cabinGeo: null,
      finGeo: null,
    };
  }

  setEra(_era: EraId): void {
    const v = moodAt(0).vehicle;
    for (const car of this.cars) {
      car.bodyMat.color.set(v.color);
      car.accentMat.color.set(v.accent);
      this.rebuildSilhouette(car, v);
    }
  }

  private rebuildSilhouette(car: Car, v: { bodyWidth: number; cabinHeight: number; roofSlope: number; finHeight: number }): void {
    if (car.bodyGeo) { car.bodyGeo.dispose(); car.bodyGeo = null; }
    if (car.cabinGeo) { car.cabinGeo.dispose(); car.cabinGeo = null; }
    if (car.finGeo) { car.finGeo.dispose(); car.finGeo = null; }

    // Remove existing meshes except the first (body).
    while (car.group.children.length > 0) car.group.remove(car.group.children[0]);

    const bw = 1.9 * v.bodyWidth;
    const bh = 0.9;
    const bl = 3.4;
    const finH = v.finHeight ?? 0;

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
    const wheelPositions: ReadonlyArray<readonly [number, number]> = [
      [-bw / 2 + 0.45, -bl / 2 + 0.8],
      [bw / 2 - 0.45, -bl / 2 + 0.8],
      [-bw / 2 + 0.45, bl / 2 - 0.8],
      [bw / 2 - 0.45, bl / 2 - 0.8],
    ];
    for (const [wx, wz] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.36, wz);
      car.group.add(wheel);
    }
    wheelGeo.dispose();
    wheelMat.dispose();

    // Body
    const bodyGeo = new THREE.BoxGeometry(bw, bh, bl);
    const body = new THREE.Mesh(bodyGeo, car.bodyMat);
    body.position.y = 0.55;
    car.group.add(body);
    car.bodyGeo = bodyGeo;

    // Cabin
    const cbw = bw * 0.66;
    const cbh = bh * v.cabinHeight;
    const cbl = bl * 0.52;
    const cabinGeo = new THREE.BoxGeometry(cbw, cbh, cbl);
    const cabin = new THREE.Mesh(cabinGeo, car.accentMat);
    const cabinY = 0.55 + bh / 2 + (cbh / 2) * (1 - v.roofSlope * 0.4);
    cabin.position.y = cabinY;
    cabin.position.z = bl * 0.04;
    car.group.add(cabin);
    car.cabinGeo = cabinGeo;

    // Tail fin (1965)
    if (finH > 0) {
      const finGeo = new THREE.BoxGeometry(bw * 0.8, finH, 0.12);
      const fin = new THREE.Mesh(finGeo, car.accentMat);
      fin.position.set(0, 0.55 + bh / 2 + finH / 2, -bl / 2 - 0.04);
      car.group.add(fin);
      car.finGeo = finGeo;
    }

    // Head/tail light boxes
    const lightMat = new THREE.MeshStandardMaterial({
      color: '#ffd9a0',
      emissive: '#ffb46c',
      emissiveIntensity: 1.2,
    });
    const lightGeo = new THREE.BoxGeometry(bw * 0.7, 0.18, 0.12);
    for (const lz of [-bl / 2 - 0.08, bl / 2 + 0.08]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(0, 0.5, lz);
      car.group.add(light);
    }
    lightGeo.dispose();
    lightMat.dispose();
  }

  update(dt: number, state: AppState): void {
    const v = moodAt(state.eraFloat).vehicle;
    for (const car of this.cars) {
      car.bodyMat.color.set(v.color);
      car.accentMat.color.set(v.accent);

      const dir = car.lane === 0 ? 1 : -1;
      car.z += car.speed * dir * dt * 0.8;
      if (car.z > DESPAWN) car.z = -DESPAWN;
      if (car.z < -DESPAWN) car.z = DESPAWN;

      car.group.position.z = car.z;
      car.group.position.y = Math.sin(car.phase + performance.now() * 0.004) * 0.02;
    }
  }

  dispose(): void {
    for (const c of this.cars) {
      c.bodyGeo?.dispose();
      c.cabinGeo?.dispose();
      c.finGeo?.dispose();
      c.bodyMat.dispose();
      c.accentMat.dispose();
      c.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
  }
}