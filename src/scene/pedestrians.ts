// Pedestrians module — simple articulated figures walking on sidewalks,
// with era-specific clothing palettes (1945 coats & hats, 1965 pastels,
// 1985 shoulder pads, 2005 casual, 2025 athleisure + glowing sneakers).

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { mulberry32, range } from './rand';

interface Ped {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  coatMat: THREE.MeshStandardMaterial;
  pantMat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  speed: number;
  phase: number;
  direction: 1 | -1;
  colorIdx: number;
}

const SIDEWALK_X = [-16, 16];

const ERA_PALETTES: Record<EraId, { coat: string[]; pant: string[]; shoe: string[] }> = {
  '1945': { coat: ['#4c443a', '#5c4a3e', '#3e3a34'], pant: ['#3b3b3b', '#2f3237', '#44382e'], shoe: ['#1d1d1f'] },
  '1965': { coat: ['#c6d9d0', '#e8d5c0', '#bcd0e8'], pant: ['#556070', '#7a6a5a', '#637a5e'], shoe: ['#2b2622'] },
  '1985': { coat: ['#6a7a8c', '#8c6a7a', '#c05734'], pant: ['#3a3a44', '#2e3a4a', '#5a4a4a'], shoe: ['#f2f2f2'] },
  '2005': { coat: ['#7a8794', '#9b8a74', '#5a6b78'], pant: ['#2e3440', '#4a4a52', '#3a4a5a'], shoe: ['#d8d8d8'] },
  '2025': { coat: ['#a3b8d4', '#9ce0c8', '#d8b0e8'], pant: ['#1c2430', '#27334a', '#3a2b4a'], shoe: ['#7fd4c1'] },
};

export class PedestriansModule implements SceneModule {
  readonly name = 'pedestrians';
  readonly group: THREE.Group = new THREE.Group();

  private peds: Ped[] = [];
  private era: EraId = '1945';

  constructor() {
    this.build();
  }

  private build(): void {
    const rnd = mulberry32(555);
    for (let i = 0; i < 11; i++) {
      const side = i % 2 === 0 ? 0 : 1;
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.8 });
      const coatMat = new THREE.MeshStandardMaterial({ color: '#4c443a', roughness: 0.9 });
      const pantMat = new THREE.MeshStandardMaterial({ color: '#3b3b3b', roughness: 0.9 });
      const group = new THREE.Group();

      // Legs
      const legGeo = new THREE.BoxGeometry(0.14, 0.8, 0.16);
      const legL = new THREE.Mesh(legGeo, pantMat);
      legL.position.set(-0.09, 0.4, 0);
      const legR = new THREE.Mesh(legGeo, pantMat);
      legR.position.set(0.09, 0.4, 0);
      group.add(legL, legR);

      // Torso
      const torsoGeo = new THREE.BoxGeometry(0.4, 0.7, 0.24);
      const torso = new THREE.Mesh(torsoGeo, coatMat);
      torso.position.y = 1.15;
      group.add(torso);

      // Head
      const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
      const headMat = new THREE.MeshStandardMaterial({ color: '#d9a98c', roughness: 0.7 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.68;
      group.add(head);

      // Hat for 1945
      const hatGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8);
      const hat = new THREE.Mesh(hatGeo, coatMat);
      hat.position.y = 1.84;
      group.add(hat);

      group.position.set(SIDEWALK_X[side], 0, range(rnd, -50, 50));
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      this.group.add(group);
      this.peds.push({
        group,
        bodyMat,
        coatMat,
        pantMat,
        x: SIDEWALK_X[side],
        z: group.position.z,
        speed: range(rnd, 0.5, 1.0),
        phase: range(rnd, 0, Math.PI * 2),
        direction: dir,
        colorIdx: i,
      });
      legGeo.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      hatGeo.dispose();
      headMat.dispose();
    }
  }

  setEra(era: EraId): void {
    this.era = era;
    const pal = ERA_PALETTES[era];
    for (const p of this.peds) {
      const coat = pal.coat[p.colorIdx % pal.coat.length];
      const pant = pal.pant[p.colorIdx % pal.pant.length];
      p.coatMat.color.set(coat);
      p.pantMat.color.set(pant);
      p.bodyMat.color.set(pant);
    }
  }

  update(dt: number, state: AppState): void {
    // Era change through continuous path rarely happens; keep state sync.
    if (state.era !== this.era) this.setEra(state.era);
    for (const p of this.peds) {
      p.z += p.speed * p.direction * dt;
      if (p.z > 55) p.direction = -1;
      if (p.z < -55) p.direction = 1;
      // Simple leg swing
      const swing = Math.sin(p.phase + performance.now() * 0.006) * 0.25;
      p.group.children[0].position.z = swing;
      p.group.children[1].position.z = -swing;
      p.group.position.z = p.z;
      p.group.rotation.y = p.direction > 0 ? 0 : Math.PI;
    }
  }

  dispose(): void {
    for (const p of this.peds) {
      p.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      p.bodyMat.dispose();
      p.coatMat.dispose();
      p.pantMat.dispose();
    }
  }
}