import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { BLOCK_SIZE, ROAD_WIDTH, LOT_SIZE, lotCenter, LOTS_PER_AXIS } from './ground';
import { mulberry32, pick, randFloat, lerpN, smoothstep } from '../util/math';
import { lerpColorInto } from '../util/color';

interface Pedestrian {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  // walk path along a sidewalk edge
  axis: 0 | 1;
  lotIndex: number;
  dir: 1 | -1;
  pos: number;
  speed: number;
  phase: number;
}

const _c = new THREE.Color();

/**
 * Simple low-poly capsule pedestrians that walk along sidewalk edges. Their
 * clothing and hair colours, and the number visible, are driven by the era.
 * Legs swing to simulate a walking gait.
 */
export class PedestriansModule implements SceneModule {
  readonly group = new THREE.Group();
  private peds: Pedestrian[] = [];
  private maxPeds = 26;
  private time = 0;

  constructor() {
    const rng = mulberry32(99_173);
    this.maxPeds = ERA_LIST.reduce((m, e) => Math.max(m, e.pedCount), 0);
    for (let i = 0; i < this.maxPeds; i++) {
      const p = this.createPed(i, rng);
      this.peds.push(p);
      this.group.add(p.group);
    }
    this.setEra(ERA_LIST[0]);
  }

  private createPed(i: number, rng: () => number): Pedestrian {
    const axis: 0 | 1 = i % 2 === 0 ? 0 : 1;
    const lotIndex = Math.floor(rng() * LOTS_PER_AXIS);
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const cloth = pick(rng, ERA_LIST[0].pedColors);
    const hair = pick(rng, ERA_LIST[0].pedHairColors);

    const bodyMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.7 });

    const grp = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), bodyMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    grp.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    grp.add(head);

    const legGeo = new THREE.CapsuleGeometry(0.1, 0.4, 3, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(0.1, 0.45, 0);
    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(-0.1, 0.45, 0);
    grp.add(legL, legR);

    return {
      group: grp,
      bodyMat,
      headMat,
      legL,
      legR,
      axis,
      lotIndex,
      dir,
      pos: randFloat(rng, -BLOCK_SIZE / 2, BLOCK_SIZE / 2),
      speed: randFloat(rng, 1.1, 1.8),
      phase: randFloat(rng, 0, Math.PI * 2)
    };
  }

  update(dt: number, state: SceneState): void {
    this.time += dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);
    const active = Math.round(lerpN(a.pedCount, b.pedCount, t));

    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      const visible = i < active;
      p.group.visible = visible;
      if (!visible) continue;

      p.pos += p.dir * p.speed * dt;
      const half = BLOCK_SIZE / 2 + 2;
      if (p.pos > half) p.pos = -half;
      if (p.pos < -half) p.pos = half;

      // Walk along the sidewalk border of the chosen lot
      const border = lotCenter(p.lotIndex) + (p.dir > 0 ? LOT_SIZE / 2 + 1.2 : -LOT_SIZE / 2 - 1.2);
      if (p.axis === 0) {
        p.group.position.set(p.pos, 0.3, border);
        p.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.group.position.set(border, 0.3, p.pos);
        p.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }

      // Gait
      const swing = Math.sin(this.time * 6 + p.phase) * 0.4;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;

      // Clothing / hair colour lerp
      const rngA = mulberry32(i * 131 + 11);
      const rngB = mulberry32(i * 131 + 19);
      lerpColorInto(pick(rngA, a.pedColors), pick(rngB, b.pedColors), t, _c);
      p.bodyMat.color.copy(_c);
      const rngH1 = mulberry32(i * 131 + 23);
      const rngH2 = mulberry32(i * 131 + 29);
      lerpColorInto(pick(rngH1, a.pedHairColors), pick(rngH2, b.pedHairColors), t, _c);
      p.headMat.color.copy(_c);
    }
  }

  setEra(config: EraConfig): void {
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      p.group.visible = i < config.pedCount;
      p.bodyMat.color.set(pick(mulberry32(i * 131 + 11), config.pedColors));
      p.headMat.color.set(pick(mulberry32(i * 131 + 23), config.pedHairColors));
    }
  }

  dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    for (const p of this.peds) {
      p.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geos.add(o.geometry);
          mats.add(o.material as THREE.Material);
        }
      });
    }
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}

void ROAD_WIDTH;
void smoothstep;
