/**
 * Pedestrians with era-specific outfits and simple walk cycles.
 *
 * Each walker is built from capsules/boxes, colored by era clothing palettes
 * (1945 hats & coats, 1965 pastels, 1985 brights, 2005 denim, 2025 athleisure).
 * Pedestrians are always present; their palette crossfades as you change eras,
 * and the walk cycle keeps the block feeling alive.
 */

import * as THREE from 'three';
import { getEraSegment, type AppState } from '../state';
import { type EraId } from '../eras';

export interface Pedestrians {
  readonly group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
}

interface Outfit {
  torso: string;
  legs: string;
  hat: string | null;
  accent: string;
}

const OUTFITS: Record<EraId, Outfit[]> = {
  '1945': [
    { torso: '#4a4a50', legs: '#2e2e33', hat: '#1e1e22', accent: '#8a8a90' },
    { torso: '#5c4a3a', legs: '#3a2d22', hat: '#4a3a2a', accent: '#b08d5c' },
    { torso: '#6a3a34', legs: '#33302e', hat: '#4a2c28', accent: '#c8b090' },
    { torso: '#46586a', legs: '#2e3a44', hat: '#2a3a46', accent: '#9ab0c0' },
  ],
  '1965': [
    { torso: '#e8b0c0', legs: '#c8a0b0', hat: '#d8a8b8', accent: '#f8e0e8' },
    { torso: '#9ac8e0', legs: '#7ab0c8', hat: null, accent: '#e0f0f8' },
    { torso: '#c8e0a8', legs: '#a0c880', hat: null, accent: '#e8f8d8' },
    { torso: '#e8c8a0', legs: '#c8a870', hat: '#d8b080', accent: '#f8e8d0' },
  ],
  '1985': [
    { torso: '#ff7a7a', legs: '#5a6a8a', hat: null, accent: '#f8f8f8' },
    { torso: '#7ae0ff', legs: '#c8c8f0', hat: null, accent: '#ffffff' },
    { torso: '#ffd24a', legs: '#4a5a8a', hat: null, accent: '#f0f0f0' },
    { torso: '#d84ad8', legs: '#5a3a8a', hat: null, accent: '#e0e0e0' },
  ],
  '2005': [
    { torso: '#6a8ab0', legs: '#3a4a6a', hat: null, accent: '#c0d0e0' },
    { torso: '#a86a6a', legs: '#4a4a5a', hat: null, accent: '#d0c0b0' },
    { torso: '#8ab06a', legs: '#3a4a3a', hat: null, accent: '#e0e8d0' },
    { torso: '#b0a08a', legs: '#5a4a3a', hat: null, accent: '#f0e0c8' },
  ],
  '2025': [
    { torso: '#2e3a4a', legs: '#22282e', hat: null, accent: '#9ad0e8' },
    { torso: '#3a6a5a', legs: '#283832', hat: null, accent: '#b8e8c8' },
    { torso: '#5a3a6a', legs: '#2e2638', hat: null, accent: '#c8a0e8' },
    { torso: '#6a4a3a', legs: '#332a26', hat: null, accent: '#e8b09a' },
  ],
};

interface Walker {
  obj: THREE.Group;
  phase: number;
  speed: number;
  path: 'x' | 'z';
  dir: number;
  base: [number, number];
  torso: THREE.MeshStandardMaterial;
  legs: THREE.MeshStandardMaterial;
  hat: THREE.MeshStandardMaterial | null;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

function buildWalker(outfit: Outfit): Omit<Walker, 'phase' | 'speed' | 'path' | 'dir' | 'base'> {
  const obj = new THREE.Group();
  const torsoMat = new THREE.MeshStandardMaterial({ color: outfit.torso, roughness: 0.85 });
  const legsMat = new THREE.MeshStandardMaterial({ color: outfit.legs, roughness: 0.9 });
  const hatMat = outfit.hat
    ? new THREE.MeshStandardMaterial({ color: outfit.hat, roughness: 0.8 })
    : null;
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d9a57a', roughness: 0.7, metalness: 0 });
  const accentMat = new THREE.MeshStandardMaterial({ color: outfit.accent, roughness: 0.4, metalness: 0.2 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 10), torsoMat);
  torso.position.y = 1.0;
  obj.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skinMat);
  head.position.y = 1.62;
  obj.add(head);
  if (hatMat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 10), hatMat);
    hat.position.y = 1.74;
    obj.add(hat);
  }
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), torsoMat);
  armL.position.set(-0.36, 1.0, 0);
  obj.add(armL);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), torsoMat);
  armR.position.set(0.36, 1.0, 0);
  obj.add(armR);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), legsMat);
  legL.position.set(-0.13, 0.45, 0);
  obj.add(legL);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), legsMat);
  legR.position.set(0.13, 0.45, 0);
  obj.add(legR);
  // Little accent (scarf/bag)
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.1), accentMat);
  bag.position.set(0.24, 0.75, 0.1);
  obj.add(bag);

  return { obj, torso: torsoMat, legs: legsMat, hat: hatMat, armL, armR, legL, legR };
}

export function createPedestrians(): Pedestrians {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const walkers: Walker[] = [];

  const spawns: Array<{
    path: 'x' | 'z';
    dir: number;
    base: [number, number];
    speed: number;
  }> = [
    { path: 'x', dir: 1, base: [20, 0], speed: 1.1 },
    { path: 'x', dir: -1, base: [50, 0], speed: 0.9 },
    { path: 'x', dir: 1, base: [70, 0], speed: 1.3 },
    { path: 'z', dir: 1, base: [0, 20], speed: 1.0 },
    { path: 'z', dir: -1, base: [0, 50], speed: 1.2 },
    { path: 'z', dir: 1, base: [0, 70], speed: 0.95 },
    { path: 'x', dir: -1, base: [30, 0], speed: 1.4 },
    { path: 'z', dir: -1, base: [0, 40], speed: 1.15 },
  ];

  spawns.forEach((sp, i) => {
    const era = ERA_IDS[i % ERA_IDS.length];
    const outfit = OUTFITS[era][i % OUTFITS[era].length];
    const built = buildWalker(outfit);
    const walker: Walker = {
      obj: built.obj,
      phase: Math.random() * Math.PI * 2,
      speed: sp.speed,
      path: sp.path,
      dir: sp.dir,
      base: sp.base,
      torso: built.torso,
      legs: built.legs,
      hat: built.hat,
      armL: built.armL,
      armR: built.armR,
      legL: built.legL,
      legR: built.legR,
    };
    group.add(walker.obj);
    walkers.push(walker);
    disposables.push(...collectMaterials(walker.obj));
  });

  const env: Pedestrians = {
    group,
    update(dt: number, state: AppState): void {
      const seg = getEraSegment(state.eraIndex);
      const loOutfits = OUTFITS[ERA_IDS[seg.lo]];
      const hiOutfits = OUTFITS[ERA_IDS[seg.hi]];
      const t = seg.t;

      walkers.forEach((w, i) => {
        const lo = loOutfits[i % loOutfits.length];
        const hi = hiOutfits[i % hiOutfits.length];
        w.torso.color.copy(new THREE.Color(lo.torso)).lerp(new THREE.Color(hi.torso), t);
        w.legs.color.copy(new THREE.Color(lo.legs)).lerp(new THREE.Color(hi.legs), t);

        w.phase += dt * w.speed * 8;
        const swing = Math.sin(w.phase) * 0.55;
        w.armL.rotation.x = swing;
        w.armR.rotation.x = -swing;
        w.legL.rotation.x = -swing;
        w.legR.rotation.x = swing;
        if (w.hat) {
          w.hat.color.copy(new THREE.Color(lo.hat ?? lo.torso)).lerp(new THREE.Color(hi.hat ?? hi.torso), t);
        }

        // advance along sidewalk
        const amt = w.dir * w.speed * dt;
        if (w.path === 'x') {
          w.base[0] += amt;
          w.obj.position.set(w.base[0], 0, w.base[1]);
          w.obj.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          w.base[1] += amt;
          w.obj.position.set(w.base[0], 0, w.base[1]);
          w.obj.rotation.y = w.dir > 0 ? 0 : Math.PI;
        }
        const lim = 75;
        if (w.base[0] > lim) w.base[0] = -lim;
        if (w.base[0] < -lim) w.base[0] = lim;
        if (w.base[1] > lim) w.base[1] = -lim;
        if (w.base[1] < -lim) w.base[1] = lim;
      });
    },
    setEra(_era: EraId, _t: number): void {
      // palette interpolation handled in update()
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
  return env;
}

const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

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