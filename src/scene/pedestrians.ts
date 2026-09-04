/**
 * Pedestrians walking on the sidewalks. Outfits (colours) change with the
 * era; density and walking speed vary too. Simple capsule-ish figures made
 * from boxes — low polygon, readable from orbit distance.
 */

import * as THREE from 'three';
import type { AppState } from '../state';
import { themePairAt, rgbToHex, lerpRgb } from '../theme';
import type { Rgb } from '../theme';
import { mulberry32 } from '../textures';

export interface PedestrianModule {
  group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: number, t: number): void;
  dispose(): void;
}

interface PedestrianF {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  speed: number;
  dir: 1 | -1;
  axis: 'x' | 'z';
  phase: number;
  baseX: number;
  baseZ: number;
  stride: number;
}

const GRID = 7;
const BLOCK = 11.2;
const SIDEWALK = 1.3;
const CITY_HALF = (GRID * BLOCK) / 2;

export function createPedestrians(): PedestrianModule {
  const group = new THREE.Group();
  group.name = 'pedestrians';
  const rnd = mulberry32(0xbeefcafe);

  const people: PedestrianF[] = [];

  /* shared geometry & materials */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d8a878', roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#5a6a7a', roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#3a3a44', roughness: 0.9 });

  function makePedestrian(): PedestrianF {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo, shirtMat);
    body.scale.set(0.34, 0.8, 0.22);
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.62;
    g.add(head);
    const armL = new THREE.Mesh(boxGeo, shirtMat);
    armL.scale.set(0.11, 0.55, 0.11);
    armL.position.set(-0.24, 1.25, 0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.24;
    g.add(armR);
    const legL = new THREE.Mesh(boxGeo, pantsMat);
    legL.scale.set(0.13, 0.6, 0.13);
    legL.position.set(-0.09, 0.3, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.09;
    g.add(legR);

    // place on a sidewalk strip along a random road
    const axis: 'x' | 'z' = rnd() < 0.5 ? 'x' : 'z';
    const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1;
    const roadIdx = Math.floor(rnd() * (GRID + 1));
    const axisCoord = roadIdx * BLOCK - CITY_HALF + SIDEWALK * (rnd() < 0.5 ? 1 : -1) * (dir > 0 ? 1 : -1);
    const along = (rnd() - 0.5) * CITY_HALF * 2;
    const baseX = axis === 'x' ? axisCoord : along;
    const baseZ = axis === 'z' ? axisCoord : along;
    g.position.set(baseX, 0, baseZ);
    if (axis === 'z') g.rotation.y = Math.PI / 2;
    group.add(g);

    return {
      group: g,
      body,
      head,
      armL,
      armR,
      legL,
      legR,
      speed: 0.8 + rnd() * 0.9,
      dir,
      axis,
      phase: rnd() * Math.PI * 2,
      baseX,
      baseZ,
      stride: 0.9 + rnd() * 0.6,
    };
  }

  for (let i = 0; i < 26; i++) people.push(makePedestrian());

  /** Apply era outfit palette. */
  function applyEra(palette: Rgb[]): void {
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const shirt = palette[i % palette.length];
      (p.body.material as THREE.MeshStandardMaterial).color.set(rgbToHex(shirt));
      (p.armL.material as THREE.MeshStandardMaterial).color.set(rgbToHex(shirt));
      (p.armR.material as THREE.MeshStandardMaterial).color.set(rgbToHex(shirt));
      const pants = palette[(i + 2) % palette.length];
      (p.legL.material as THREE.MeshStandardMaterial).color.set(rgbToHex(pants));
      (p.legR.material as THREE.MeshStandardMaterial).color.set(rgbToHex(pants));
    }
  }

  let lastEraIdx = -1;

  function update(dt: number, state: AppState): void {
    const { a, b, t } = themePairAt(state.eraFloat);
    const idx = Math.round(state.eraFloat);
    if (idx !== lastEraIdx) {
      lastEraIdx = idx;
      applyEra(b.pedestrian.palette);
    }

    // density: fewer pedestrians in 1945, more in 2025
    const density = 0.6 + t * 0.6;
    const activeCount = Math.round(people.length * density);

    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const active = i < activeCount;
      p.group.visible = active;
      if (!active) continue;
      // walk along the sidewalk
      p.phase += dt * p.speed;
      const walk = Math.sin(p.phase * p.stride);
      if (p.axis === 'x') {
        p.group.position.x = p.baseX + Math.sin(p.phase * 0.5) * 0.4;
      } else {
        p.group.position.z = p.baseZ + Math.sin(p.phase * 0.5) * 0.4;
      }
      // limbs swing
      p.armL.rotation.x = walk * 0.5;
      p.armR.rotation.x = -walk * 0.5;
      p.legL.rotation.x = -walk * 0.4;
      p.legR.rotation.x = walk * 0.4;
      // outfit crossfade
      const slot = i % Math.max(a.pedestrian.palette.length, b.pedestrian.palette.length);
      const ca = a.pedestrian.palette[slot % a.pedestrian.palette.length];
      const cb = b.pedestrian.palette[slot % b.pedestrian.palette.length];
      const c = lerpRgb(ca, cb, t);
      (p.body.material as THREE.MeshStandardMaterial).color.set(rgbToHex(c));
      (p.armL.material as THREE.MeshStandardMaterial).color.set(rgbToHex(c));
      (p.armR.material as THREE.MeshStandardMaterial).color.set(rgbToHex(c));
      const pa = a.pedestrian.palette[(slot + 2) % a.pedestrian.palette.length];
      const pb = b.pedestrian.palette[(slot + 2) % b.pedestrian.palette.length];
      const pc = lerpRgb(pa, pb, t);
      (p.legL.material as THREE.MeshStandardMaterial).color.set(rgbToHex(pc));
      (p.legR.material as THREE.MeshStandardMaterial).color.set(rgbToHex(pc));
    }
  }

  function setEra(): void {}

  function dispose(): void {
    boxGeo.dispose();
    headGeo.dispose();
    skinMat.dispose();
    shirtMat.dispose();
    pantsMat.dispose();
    group.removeFromParent();
  }

  return { group, update, setEra, dispose };
}