/**
 * Era-specific vehicles.
 *
 * Each vehicle is built procedurally and registered to a set of eras. Vehicles
 * of the current era are "active" (scale 1, driving); other eras are scaled to
 * near-zero so they never look anachronistic (1945 block never shows SUVs).
 * A small emissive under-glow helps them read as parked/street traffic.
 */

import * as THREE from 'three';
import type { AppState } from '../state';
import { type EraId } from '../eras';

export interface Vehicles {
  readonly group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
}

type VehicleType = 'sedan' | 'coupe' | 'truck' | 'suv' | 'ev' | 'scooter' | 'trolley';

interface VehicleSpec {
  type: VehicleType;
  eras: EraId[];
  lane: 'x' | 'z';
  dir: number;
  position: number;
  speed: number;
  color: string;
}

const SPECS: VehicleSpec[] = [
  { type: 'trolley', eras: ['1945'], lane: 'x', dir: 1, position: 30, speed: 2.2, color: '#8a2f2f' },
  { type: 'sedan', eras: ['1945','1965','1985'], lane: 'x', dir: 1, position: 62, speed: 2.6, color: '#3b3f44' },
  { type: 'coupe', eras: ['1945','1965'], lane: 'x', dir: -1, position: 96, speed: 3.0, color: '#b04a32' },
  { type: 'truck', eras: ['1945','1965','1985'], lane: 'z', dir: 1, position: 44, speed: 2.0, color: '#5a4a3a' },
  { type: 'sedan', eras: ['1985', '2005'], lane: 'z', dir: -1, position: 70, speed: 2.7, color: '#c8a23c' },
  { type: 'suv', eras: ['2005','2025'], lane: 'x', dir: 1, position: 55, speed: 2.9, color: '#2f5f7a' },
  { type: 'ev', eras: ['2025'], lane: 'x', dir: -1, position: 88, speed: 3.4, color: '#bfe0e8' },
  { type: 'scooter', eras: ['2025'], lane: 'z', dir: 1, position: 36, speed: 3.2, color: '#e86a3a' },
  { type: 'suv', eras: ['2005','2025'], lane: 'z', dir: -1, position: 60, speed: 2.6, color: '#5a4a3a' },
  { type: 'sedan', eras: ['1985','2005'], lane: 'x', dir: -1, position: 74, speed: 3.1, color: '#b8b8c0' },
];

function buildVehicle(type: VehicleType, color: string): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.6,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1b2430',
    roughness: 0.15,
    metalness: 0.8,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#d8d8d8',
    roughness: 0.15,
    metalness: 1,
  });

  const addWheels = (w: number, l: number, r: number): void => {
    const wheelGeo = new THREE.CylinderGeometry(r, r, w, 14);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeo, tireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * l * 0.5, r, sz * w * 0.5);
        g.add(wheel);
      }
    }
  };

  switch (type) {
    case 'trolley': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.6, 2.0), bodyMat);
      body.position.y = 1.0;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 1.7), bodyMat);
      roof.position.y = 1.9;
      g.add(roof);
      for (const sx of [-1, 1]) {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 1.5), glassMat);
        glass.position.set(sx * 2.2, 1.3, 0);
        g.add(glass);
      }
      addWheels(1.7, 3.0, 0.4);
      break;
    }
    case 'sedan': {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.6), bodyMat);
      lower.position.y = 0.7;
      g.add(lower);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.45), glassMat);
      cabin.position.set(0.1, 1.25, 0);
      g.add(cabin);
      addWheels(1.4, 2.4, 0.35);
      break;
    }
    case 'coupe': {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 1.7), bodyMat);
      lower.position.y = 0.8;
      g.add(lower);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.5), chromeMat);
      nose.position.set(1.5, 0.7, 0);
      g.add(nose);
      addWheels(1.5, 2.6, 0.4);
      break;
    }
    case 'truck': {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.0), bodyMat);
      cab.position.set(-1.1, 1.0, 0);
      g.add(cab);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.0), bodyMat);
      bed.position.set(1.1, 1.1, 0);
      g.add(bed);
      addWheels(2.0, 2.4, 0.4);
      break;
    }
    case 'suv': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.0, 1.8), bodyMat);
      body.position.y = 0.85;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.7), glassMat);
      roof.position.y = 1.55;
      g.add(roof);
      addWheels(1.7, 2.5, 0.42);
      break;
    }
    case 'ev': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 1.7), bodyMat);
      body.position.y = 0.7;
      g.add(body);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.55), glassMat);
      glass.position.y = 1.15;
      g.add(glass);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.04, 1.3),
        new THREE.MeshBasicMaterial({ color: '#7ae8ff' }),
      );
      glow.position.y = 0.06;
      glow.material.transparent = true;
      glow.material.opacity = 0.5;
      g.add(glow);
      addWheels(1.6, 2.2, 0.35);
      break;
    }
    case 'scooter': {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.2), bodyMat);
      deck.position.y = 0.5;
      g.add(deck);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 6), chromeMat);
      pole.position.set(0, 1.0, 0.5);
      g.add(pole);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), tireMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0, 0.24, 0.55);
      g.add(wheel);
      break;
    }
  }
  return g;
}

export function createVehicles(): Vehicles {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const records: Array<{
    obj: THREE.Group;
    spec: VehicleSpec;
    pos: number;
    active: boolean;
  }> = [];

  for (const spec of SPECS) {
    const obj = buildVehicle(spec.type, spec.color);
    group.add(obj);
    disposables.push(...collectMaterials(obj));
    records.push({ obj, spec, pos: spec.position, active: true });
  }

  const env: Vehicles = {
    group,
    update(dt: number, state: AppState): void {
      for (const rec of records) {
        const s = rec.spec;
        const isActive = s.eras.includes(state.era);
        // Smoothly scale to 1 when active, near-0 otherwise.
        const target = isActive ? 1 : 0.001;
        const f = THREE.MathUtils.lerp(rec.obj.scale.x, target, 0.1);
        rec.obj.scale.setScalar(f);
        rec.obj.visible = f > 0.01;
        if (!rec.obj.visible) continue;

        rec.pos += s.speed * s.dir * dt;
        if (s.lane === 'x') {
          rec.obj.position.set(rec.pos, 0.02, s.dir > 0 ? 38.5 : 29);
        } else {
          rec.obj.position.set(s.dir > 0 ? -28 : -38.5, 0.02, rec.pos);
        }
        // Wrap around a wide range
        const lim = 130;
        if (rec.pos > lim) rec.pos = -lim;
        if (rec.pos < -lim) rec.pos = lim;
      }
    },
    setEra(_era: EraId, _t: number): void {
      // per-frame easing in update() covers crossfades
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  return env;
}

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      out.push(...mats);
    }
  });
  return out;
}