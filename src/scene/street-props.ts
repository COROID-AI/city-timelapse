// Street props module — era-evolving lamp posts (gas → cobra → sodium →
// LED → holographic), hydrants, benches, and traffic signals. Props sit in
// the sidewalk band (|x| ≈ 7–11.5), clear of the road and the building
// band. Lamp glow is a real Billboard with an emissive material so the
// glow effect is actually rendered.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { moodAt } from '../mood';

const BLOCK_END = 60;

interface Lamp {
  group: THREE.Group;
  headMat: THREE.MeshStandardMaterial;
  head: THREE.Mesh;
  glow: THREE.Sprite;
  glowMat: THREE.SpriteMaterial;
  era: EraId;
}

const POLE_X = 9.6;
const BENCH_X = 11.2;
const HYDRANT_X = 10.4;

// Lamp head shaping per era (scale multipliers + emissive tone).
const LAMP_ERA_SHAPE: Record<EraId, { headScale: number; glowScale: number; tone: string }> = {
  '1945': { headScale: 0.8, glowScale: 1.8, tone: '#ffd592' },
  '1965': { headScale: 1.05, glowScale: 2.1, tone: '#ffe2a8' },
  '1985': { headScale: 1.3, glowScale: 2.6, tone: '#ffb347' },
  '2005': { headScale: 1.0, glowScale: 2.3, tone: '#d8ecff' },
  '2025': { headScale: 0.9, glowScale: 3.4, tone: '#a6ecff' },
};

export class StreetPropsModule implements SceneModule {
  readonly name = 'street-props';
  readonly group: THREE.Group = new THREE.Group();

  private lamps: Lamp[] = [];
  private lampGeo: { pole: THREE.BufferGeometry; arm: THREE.BufferGeometry; head: THREE.BufferGeometry } | null = null;
  private materials: THREE.Material[] = [];
  private scratch = new THREE.Color();
  private lastNightGlow = Number.NaN;

  constructor() {
    this.build();
  }

  private build(): void {
    // Lamp posts along both sidewalks.
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8);
    const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6);
    const headGeo = new THREE.SphereGeometry(0.32, 10, 8);
    this.lampGeo = { pole: poleGeo, arm: armGeo, head: headGeo };

    const poleMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.5, metalness: 0.6 });
    const armMat = poleMat.clone();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const z = -50 + i * 25;
        const group = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.7;
        group.add(pole);
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(side * 1.1, 5.1, 0);
        arm.rotation.z = (side * Math.PI) / 2;
        group.add(arm);
        const headMat = new THREE.MeshStandardMaterial({
          color: '#ffe8b0',
          emissive: '#ffd592',
          emissiveIntensity: 2.0,
          roughness: 0.4,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(side * 1.7, 5.2, 0);
        group.add(head);

        // Halo sprite attached to the lamp head — makes the glow visible.
        const glowMat = new THREE.SpriteMaterial({
          color: '#ffd592',
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const glow = new THREE.Sprite(glowMat);
        glow.position.set(side * 1.7, 5.2, 0);
        glow.scale.set(2.4, 2.4, 1);
        group.add(glow);

        group.position.set(side * POLE_X, 0, z);
        this.group.add(group);
        this.lamps.push({ group, headMat, head, glow, glowMat, era: '1945' });
        this.materials.push(poleMat, armMat, headMat, glowMat);
      }
    }

    // Benches
    const benchMat = new THREE.MeshStandardMaterial({ color: '#5a4a36', roughness: 0.8 });
    const benchSlat = new THREE.BoxGeometry(1.8, 0.08, 0.5);
    const benchLeg = new THREE.BoxGeometry(0.12, 0.5, 0.4);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group();
        for (let j = 0; j < 3; j++) {
          const slat = new THREE.Mesh(benchSlat, benchMat);
          slat.position.set(0, 0.55 + j * 0.08, 0);
          g.add(slat);
        }
        for (const lz of [-0.45, 0.45]) {
          const leg = new THREE.Mesh(benchLeg, benchMat);
          leg.position.set(0.7, 0.25, lz);
          g.add(leg);
        }
        g.position.set(side * BENCH_X, 0, -20 + i * 20);
        g.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(g);
      }
    }
    benchSlat.dispose();
    benchLeg.dispose();
    this.materials.push(benchMat);

    // Hydrants
    const hydrantMat = new THREE.MeshStandardMaterial({ color: '#b13020', roughness: 0.65 });
    const hydrantGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Mesh(hydrantGeo, hydrantMat);
        h.position.set(side * HYDRANT_X, 0.45, -30 + i * 30);
        this.group.add(h);
      }
    }
    hydrantGeo.dispose();
    this.materials.push(hydrantMat);

    // Traffic signals at intersections (both sides, hanging).
    const signalMat = new THREE.MeshStandardMaterial({ color: '#202028', roughness: 0.6 });
    const boxGeo = new THREE.BoxGeometry(0.36, 1.0, 0.24);
    const lensGeo = new THREE.CircleGeometry(0.09, 8);
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(boxGeo, signalMat);
      box.position.y = 0.5;
      g.add(box);
      for (const [ly, lc] of [[0.78, '#ff2a2a'], [0.5, '#ffcf2a'], [0.22, '#3aff3a']] as const) {
        const lens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: lc }));
        lens.position.set(side * 0.14, ly, 0);
        g.add(lens);
        this.materials.push(lens.material as THREE.MeshBasicMaterial);
      }
      g.position.set(side * 10.8, 4.6, -BLOCK_END * 0.75);
      this.group.add(g);
      this.materials.push(signalMat);
    }
    boxGeo.dispose();
    lensGeo.dispose();
  }

  setEra(era: EraId): void {
    const shape = LAMP_ERA_SHAPE[era];
    for (const lamp of this.lamps) {
      lamp.era = era;
      lamp.head.scale.set(shape.headScale, shape.headScale, shape.headScale);
      lamp.glow.scale.set(shape.glowScale, shape.glowScale, 1);
      this.scratch.set(shape.tone);
      lamp.headMat.emissive.copy(this.scratch);
      lamp.headMat.emissiveIntensity = 1.4;
      lamp.glowMat.color.copy(this.scratch);
      lamp.glowMat.opacity = 0.6;
    }
  }

  update(dt: number, state: AppState): void {
    const mood = moodAt(state.eraFloat);
    const nightGlow = mood.sky.nightGlow;
    if (nightGlow !== this.lastNightGlow) {
      this.lastNightGlow = nightGlow;
      for (const lamp of this.lamps) {
        const shape = LAMP_ERA_SHAPE[lamp.era];
        this.scratch.set(shape.tone);
        lamp.headMat.emissive.copy(this.scratch);
        lamp.headMat.emissiveIntensity = 1.2 + nightGlow * 0.8;
        lamp.glowMat.color.copy(this.scratch);
        lamp.glowMat.opacity = 0.3 + nightGlow * 0.7;
      }
    }
    void dt;
  }

  dispose(): void {
    this.lampGeo?.pole.dispose();
    this.lampGeo?.arm.dispose();
    this.lampGeo?.head.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}