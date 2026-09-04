/**
 * Era-specific vehicles driving on the block's roads.
 * Vehicle silhouettes and paint change with the era (boxy trucks & trolleys
 * in 1945, chrome fins in 1965, angular boxes in 1985, SUVs in 2005, EVs and
 * scooters in 2025). Vehicles loop along the road axes.
 */

import * as THREE from 'three';
import type { AppState } from '../state';
import { themePairAt, rgbToHex, lerpRgb } from '../theme';
import { mulberry32 } from '../textures';

export interface VehicleModule {
  group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: number, t: number): void;
  dispose(): void;
}

type VehicleKind = 'truck' | 'car' | 'trolley' | 'wagon' | 'car60s' | 'van' | 'sedan' | 'suv' | 'ev' | 'scooter';

/** Vehicle archetype mix per era (index 0..4). */
const ERA_VEHICLES: VehicleKind[][] = [
  ['truck', 'car', 'trolley', 'car', 'truck'],
  ['car60s', 'wagon', 'car60s', 'car', 'wagon'],
  ['car60s', 'van', 'car60s', 'sedan', 'van'],
  ['suv', 'sedan', 'suv', 'car', 'suv'],
  ['ev', 'scooter', 'ev', 'sedan', 'scooter'],
];

interface KindSpec {
  body: [number, number, number];
  roof: [number, number, number] | null;
  cabin: [number, number, number] | null;
}

const KIND_SPECS: Record<VehicleKind, KindSpec> = {
  truck: { body: [3.1, 1.25, 1.1], roof: [2.5, 0.7, 1.05], cabin: [0.9, 0.7, 1.1] },
  car: { body: [1.8, 0.85, 1.05], roof: [1.05, 0.38, 0.95], cabin: null },
  trolley: { body: [4.6, 1.35, 1.05], roof: [4.3, 0.85, 1.0], cabin: null },
  wagon: { body: [2.5, 0.95, 1.1], roof: [2.3, 0.8, 1.05], cabin: null },
  car60s: { body: [2.1, 0.95, 1.15], roof: [1.15, 0.36, 1.05], cabin: null },
  van: { body: [2.4, 1.15, 1.15], roof: [2.3, 1.05, 1.1], cabin: null },
  sedan: { body: [2.3, 0.9, 1.1], roof: [1.35, 0.38, 1.0], cabin: null },
  suv: { body: [2.4, 1.15, 1.15], roof: [2.2, 0.5, 1.1], cabin: null },
  ev: { body: [2.0, 0.78, 1.05], roof: [1.45, 0.4, 1.0], cabin: null },
  scooter: { body: [0.55, 0.9, 0.32], roof: null, cabin: null },
};

interface VehicleF {
  group: THREE.Group;
  body: THREE.Mesh;
  roof: THREE.Mesh | null;
  wheels: THREE.Mesh[];
  speed: number;
  axis: 'x' | 'z';
  dir: 1 | -1;
  lane: number;
  phase: number;
  kind: VehicleKind;
}

const GRID = 7;
const BLOCK = 11.2;
const SPAN = GRID * BLOCK + 8;

export function createVehicles(): VehicleModule {
  const group = new THREE.Group();
  group.name = 'vehicles';
  const rnd = mulberry32(0xabba0ba);

  const vehicles: VehicleF[] = [];

  /* shared geometry & materials */
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#4a4f56',
    roughness: 0.5,
    metalness: 0.4,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#2c2f34',
    roughness: 0.7,
    metalness: 0.2,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#101012', roughness: 1 });

  function makeVehicle(
    axis: 'x' | 'z',
    dir: 1 | -1,
    lane: number,
    roadIdx: number,
    seed: number,
  ): VehicleF {
    const g = new THREE.Group();
    // per-vehicle paint so each car can keep its own era palette slot
    const body = new THREE.Mesh(bodyGeo, bodyMat.clone());
    body.castShadow = true;
    g.add(body);
    const roof = new THREE.Mesh(bodyGeo, roofMat.clone());
    g.add(roof);
    const wheels: THREE.Mesh[] = [];
    for (const [wx, wz] of [
      [-0.7, 0.45],
      [0.7, 0.45],
      [-0.7, -0.45],
      [0.7, -0.45],
    ] as const) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.22, wz);
      g.add(w);
      wheels.push(w);
    }

    // start position in the road network: drive along one avenue, offset from
    // its centre-line median (roads live at i*BLOCK - cityHalf)
    const roadAxis = roadIdx * BLOCK - (GRID * BLOCK) / 2;
    const dirSign = dir === 1 ? -1 : 1;
    const sideCoord = roadAxis + dirSign * (0.85 + lane * 0.6);
    const startCoord = ((seed / 2) * SPAN) % SPAN - SPAN / 2;
    const along = startCoord;
    const gx = axis === 'x' ? along : sideCoord;
    const gz = axis === 'z' ? along : sideCoord;
    g.position.set(gx, 0, gz);
    // align the long body axis with the drive axis
    if (axis === 'z') {
      g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      g.rotation.y = dir > 0 ? 0 : Math.PI;
    }
    // phase starts where the vehicle was placed so the first update doesn't jump
    const phase = ((startCoord + SPAN / 2) % SPAN + SPAN) % SPAN;

    group.add(g);
    return {
      group: g,
      body,
      roof,
      wheels,
      speed: 3.5 + rnd() * 2.5,
      axis,
      dir,
      lane,
      phase,
      kind: 'car',
    };
  }

  // every avenue carries two-way traffic (one lane per direction), offset to
  // opposite sides of the centre-line so cars never clip through blocks.
  for (const axis of ['x', 'z'] as const) {
    for (let roadIdx = 0; roadIdx <= GRID; roadIdx++) {
      for (const dir of [1, -1] as const) {
        makeVehicle(axis, dir, 0, roadIdx, vehicles.length);
      }
    }
  }

  /** Apply silhouette for a kind (tint is applied each frame from the palette). */
  function setKind(v: VehicleF, kind: VehicleKind): void {
    v.kind = kind;
    const spec = KIND_SPECS[kind];
    const [bw, bh, bd] = spec.body;
    v.body.scale.set(bw, bh, bd);
    v.body.position.y = bh / 2 + 0.1;
    if (v.roof) {
      const roofSpec = spec.roof ?? [bw * 0.6, 0.3, bd * 0.9];
      v.roof.scale.set(roofSpec[0], roofSpec[1], roofSpec[2]);
      v.roof.position.y = bh - roofSpec[1] / 2 + 0.1;
      v.roof.visible = spec.roof !== null;
    }
    // wheels spacing follows body length
    const halfLen = bw / 2 - 0.25;
    v.wheels.forEach((w, i) => {
      const wx = i < 2 ? -halfLen : halfLen;
      const wz = i % 2 === 0 ? 0.45 : -0.45;
      w.position.set(wx, 0.22, wz);
    });
  }

  let lastEraIdx = -1;

  function applyEra(idx: number): void {
    const kinds = ERA_VEHICLES[idx];
    for (let i = 0; i < vehicles.length; i++) {
      setKind(vehicles[i], kinds[i % kinds.length]);
    }
  }

  function update(dt: number, state: AppState): void {
    const { a, b, t } = themePairAt(state.eraFloat);
    const idx = Math.round(state.eraFloat);
    if (idx !== lastEraIdx) {
      lastEraIdx = idx;
      applyEra(idx);
    }

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      // paint: per-vehicle slot in the era palette
      const slot = i % Math.max(a.vehicle.palette.length, b.vehicle.palette.length);
      const ca = a.vehicle.palette[slot % a.vehicle.palette.length];
      const cb = b.vehicle.palette[slot % b.vehicle.palette.length];
      const c = lerpRgb(ca, cb, t);
      (v.body.material as THREE.MeshStandardMaterial).color.set(rgbToHex(c));
      if (v.roof) {
        const glass = lerpRgb({ r: 0.9, g: 0.9, b: 0.9 }, { r: 0.35, g: 0.38, b: 0.45 }, t);
        (v.roof.material as THREE.MeshStandardMaterial).color.set(rgbToHex(glass));
      }
    }

    // move along the axis (wrap around)
    const speedMul = idx >= 3 ? 1.5 : 1;
    for (const v of vehicles) {
      v.phase += dt * v.speed * speedMul * v.dir;
      const pos = ((v.phase % SPAN) + SPAN) % SPAN;
      const coord = -SPAN / 2 + pos;
      if (v.axis === 'x') {
        v.group.position.x = coord;
      } else {
        v.group.position.z = coord;
      }
      // small bobbing for scooters
      if (v.kind === 'scooter') {
        v.group.position.y = Math.abs(Math.sin(state.elapsed * 6 + v.phase)) * 0.04;
      }
    }
  }

  function setEra(): void {}

  function dispose(): void {
    bodyGeo.dispose();
    wheelGeo.dispose();
    bodyMat.dispose();
    roofMat.dispose();
    wheelMat.dispose();
    group.removeFromParent();
  }

  return { group, update, setEra, dispose };
}