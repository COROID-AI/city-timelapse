// City block ground plane: road grid, sidewalks, curbs, crosswalks,
// street blotches, and a park plot with era-varying tree colors.
// Also hosts the road lane markings that vehicles follow conceptually.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { moodAt } from '../mood';
import { eraIndex } from '../eras';
import { mulberry32, range } from './rand';

const BLOCK = 120;
const ROAD_W = 12;
const SIDEWALK_W = 6;
const LANE_COUNT = 2;

export const LANE_X: readonly number[] = (() => {
  const xs: number[] = [];
  for (let i = 0; i < LANE_COUNT; i++) {
    xs.push(ROAD_W / 4 + i * (ROAD_W / 2));
  }
  return xs;
})();

export class GroundModule implements SceneModule {
  readonly name = 'ground';
  readonly group: THREE.Group = new THREE.Group();

  private roadMat: THREE.MeshStandardMaterial;
  private sidewalkMat: THREE.MeshStandardMaterial;
  private parkMat: THREE.MeshStandardMaterial;
  private crosswalkMats: THREE.MeshBasicMaterial[] = [];
  private stripMats: THREE.MeshBasicMaterial[] = [];

  private treeMeshes: THREE.Mesh[] = [];
  private treeMat: THREE.MeshLambertMaterial;

  private roadNoise: THREE.CanvasTexture | null = null;
  private lastMoodT = Number.NaN;

  constructor() {
    this.roadMat = new THREE.MeshStandardMaterial({ color: '#3a3330', roughness: 0.95 });
    this.sidewalkMat = new THREE.MeshStandardMaterial({ color: '#8a857c', roughness: 0.9 });
    this.parkMat = new THREE.MeshStandardMaterial({ color: '#636b4a', roughness: 1 });
    this.treeMat = new THREE.MeshLambertMaterial({ color: '#6c8a4f' });

    this.build();
  }

  private build(): void {
    // Road rectangle along Z axis (lanes run -Z..+Z).
    const roadGeo = new THREE.PlaneGeometry(ROAD_W, BLOCK * 2);
    const road = new THREE.Mesh(roadGeo, this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    this.group.add(road);

    // Sidewalks left and right (+ some apron at ends)
    const sideGeo = new THREE.PlaneGeometry(SIDEWALK_W, BLOCK * 2);
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(sideGeo, this.sidewalkMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(side * (ROAD_W / 2 + SIDEWALK_W / 2), 0.02, 0);
      this.group.add(m);
    }

    // Curbs: thin raised strips between road and sidewalk.
    const curbGeo = new THREE.BoxGeometry(0.35, 0.16, BLOCK * 2);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#6b6a66', roughness: 0.8 });
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(side * (ROAD_W / 2 + 0.18), 0.09, 0);
      this.group.add(curb);
    }
    curbGeo.dispose();
    curbMat.dispose();

    // Crosswalks at both ends (simple white stripes across the road).
    const stripeW = 0.8;
    const stripeH = ROAD_W - 1.2;
    const stripeGeo = new THREE.PlaneGeometry(stripeW, stripeH);
    for (const zEnd of [-BLOCK + 8, BLOCK - 8]) {
      for (let i = -3; i <= 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: '#cfd3d8', transparent: true, opacity: 0.85 });
        const stripe = new THREE.Mesh(stripeGeo, mat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(i * 1.7, 0.05, zEnd);
        stripe.rotation.z = 0;
        this.group.add(stripe);
        this.crosswalkMats.push(mat);
      }
    }
    stripeGeo.dispose();

    // Street blotches / era dirt on road (small dark patches).
    const blotchMat = new THREE.MeshBasicMaterial({ color: '#27241f', transparent: true, opacity: 0.25 });
    const blotchGeo = new THREE.CircleGeometry(1.4, 12);
    const rnd = mulberry32(7);
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Mesh(blotchGeo, blotchMat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(range(rnd, -ROAD_W / 2 + 1.2, ROAD_W / 2 - 1.2), 0.03, range(rnd, -BLOCK + 6, BLOCK - 6));
      b.scale.set(range(rnd, 0.5, 1.6), range(rnd, 0.5, 1.6), 1);
      this.group.add(b);
    }
    blotchGeo.dispose();
    blotchMat.dispose();

    // Lane center line.
    const lineMat = new THREE.MeshBasicMaterial({ color: '#b9a860', transparent: true, opacity: 0.6 });
    const lineGeo = new THREE.PlaneGeometry(0.22, BLOCK * 2);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.04;
    this.group.add(line);
    lineGeo.dispose();
    lineMat.dispose();

    // Park plot to one side of the block (green space with trees ded).
    const parkGeo = new THREE.PlaneGeometry(14, 16);
    const park = new THREE.Mesh(parkGeo, this.parkMat);
    park.rotation.x = -Math.PI / 2;
    park.position.set(BLOCK / 2 + 9, 0.02, -10);
    this.group.add(park);
    parkGeo.dispose();

    // Trees lining the park.
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#4f3b2c' });
    const crownGeo = new THREE.IcosahedronGeometry(1.1, 1);
    const crownMat = new THREE.MeshLambertMaterial({ color: '#6c8a4f' });
    const crownMat2 = new THREE.MeshLambertMaterial({ color: '#4f8a5c' });
    const tRnd = mulberry32(21);
    for (let i = 0; i < 12; i++) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      const crown = new THREE.Mesh(crownGeo, i % 2 === 0 ? crownMat : crownMat2);
      const x = BLOCK / 2 + 9 + range(tRnd, -6, 6);
      const z = -10 + range(tRnd, -7, 7);
      const s = range(tRnd, 0.8, 1.5);
      trunk.position.set(x, 0.8 * s, z);
      crown.position.set(x, (1.6 + 0.4) * s, z);
      crown.scale.set(s, s, s);
      this.group.add(trunk);
      this.group.add(crown);
      this.treeMeshes.push(crown);
    }
    trunkGeo.dispose();
    trunkMat.dispose();
    crownGeo.dispose();
    // Keep materials for era color updates.

    // Buildings will be placed by BuildingsModule; nothing else here.
  }

  setEra(era: EraId): void {
    const m = moodAt(eraIndex(era));
    this.roadMat.color.set(m.road);
    this.sidewalkMat.color.set(m.sidewalk);
    this.parkMat.color.set(m.park);
    this.treeMat.color.set(m.treeColor);
    for (const c of this.crosswalkMats) c.color.set('#cfd3d8');
    for (const s of this.stripMats) s.color.set('#b9a860');
  }

  update(_dt: number, state: AppState): void {
    const ft = state.eraFloat;
    if (ft === this.lastMoodT) return;
    this.lastMoodT = ft;
    const m = moodAt(ft);
    this.roadMat.color.set(m.road);
    this.sidewalkMat.color.set(m.sidewalk);
    this.parkMat.color.set(m.park);
    this.treeMat.color.set(m.treeColor);
    // Add subtle dusk darkening from sky mood.
    const darken = 1 - m.sky.nightGlow * 0.25;
    this.roadMat.color.multiplyScalar(darken);
    this.sidewalkMat.color.multiplyScalar(darken);
    this.parkMat.color.multiplyScalar(darken);
  }

  dispose(): void {
    this.roadMat.dispose();
    this.sidewalkMat.dispose();
    this.parkMat.dispose();
    this.treeMat.dispose();
    this.crosswalkMats.forEach((m) => m.dispose());
    this.stripMats.forEach((m) => m.dispose());
    for (const t of this.treeMeshes) t.geometry.dispose();
    this.roadNoise?.dispose();
  }
}