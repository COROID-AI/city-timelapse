import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { BLOCK_SIZE, LOT_SIZE, lotCenter, LOTS_PER_AXIS } from './ground';
import { mulberry32, lerpN, smoothstep } from '../util/math';
import { lerpColorInto } from '../util/color';

interface StreetLamp {
  group: THREE.Group;
  bulbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
}

const _c = new THREE.Color();

/**
 * Street furniture: lamp posts at every lot corner with era-appropriate
 * lamp colour and style. Lamps brighten at night. A few hydrants and benches
 * add ground-level detail.
 */
export class PropsModule implements SceneModule {
  readonly group = new THREE.Group();
  private lamps: StreetLamp[] = [];
  private poleMat: THREE.MeshStandardMaterial;
  private time = 0;

  constructor() {
    const rng = mulberry32(41_201);
    this.poleMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.6 });

    // Lamp posts at the inner corners of each lot
    for (let iz = 0; iz < LOTS_PER_AXIS; iz++) {
      for (let ix = 0; ix < LOTS_PER_AXIS; ix++) {
        const cx = lotCenter(ix);
        const cz = lotCenter(iz);
        const off = LOT_SIZE / 2 + 1.5;
        const corners = [
          [cx + off, cz + off],
          [cx - off, cz + off],
          [cx + off, cz - off],
          [cx - off, cz - off]
        ];
        for (const [x, z] of corners) {
          if (Math.abs(x) > BLOCK_SIZE / 2 || Math.abs(z) > BLOCK_SIZE / 2) continue;
          if (rng() < 0.5) continue;
          this.lamps.push(this.createLamp(x, z, rng));
        }
      }
    }

    // Hydrants + benches for detail
    for (let i = 0; i < 8; i++) {
      const x = lerpN(-1, 1, rng()) * (BLOCK_SIZE / 2 - 8);
      const z = lerpN(-1, 1, rng()) * (BLOCK_SIZE / 2 - 8);
      if (rng() < 0.5) {
        this.group.add(this.createHydrant(x, z));
      } else {
        this.group.add(this.createBench(x, z, rng));
      }
    }

    for (const l of this.lamps) this.group.add(l.group);
    this.setEra(ERA_LIST[0]);
  }

  private createLamp(x: number, z: number, rng: () => number): StreetLamp {
    const grp = new THREE.Group();
    grp.position.set(x, 0.3, z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 8), this.poleMat);
    pole.position.y = 2.5;
    pole.castShadow = true;
    grp.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), this.poleMat);
    arm.position.set(0.6, 4.8, 0);
    grp.add(arm);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#ffb86b',
      emissive: '#ffb86b',
      emissiveIntensity: 1.5,
      roughness: 0.3
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bulbMat);
    bulb.position.set(1.1, 4.7, 0);
    grp.add(bulb);

    const light = new THREE.PointLight('#ffb86b', 1.2, 18, 2);
    light.position.set(1.1, 4.5, 0);
    grp.add(light);

    void rng;
    return { group: grp, bulbMat, light };
  }

  private createHydrant(x: number, z: number): THREE.Object3D {
    const grp = new THREE.Group();
    grp.position.set(x, 0.3, z);
    const mat = new THREE.MeshStandardMaterial({ color: '#b23030', roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 10), mat);
    body.position.y = 0.4;
    body.castShadow = true;
    grp.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat);
    cap.position.y = 0.85;
    grp.add(cap);
    return grp;
  }

  private createBench(x: number, z: number, rng: () => number): THREE.Object3D {
    const grp = new THREE.Group();
    grp.position.set(x, 0.3, z);
    grp.rotation.y = rng() * Math.PI * 2;
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), wood);
    seat.position.y = 0.45;
    seat.castShadow = true;
    grp.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), wood);
    back.position.set(0, 0.7, -0.2);
    grp.add(back);
    return grp;
  }

  update(dt: number, state: SceneState): void {
    this.time += dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);
    const night = lerpN(a.nightFactor, b.nightFactor, t);

    for (const lamp of this.lamps) {
      // Lamp colour
      lerpColorInto(a.lampColor, b.lampColor, t, _c);
      lamp.bulbMat.color.copy(_c);
      lamp.bulbMat.emissive.copy(_c);
      lamp.light.color.copy(_c);
      // Brighter at night
      const intensity = 0.4 + night * 2.2;
      lamp.bulbMat.emissiveIntensity = intensity;
      lamp.light.intensity = 0.3 + night * 1.8;
      // Hologram flicker in 2055
      if (b.lampStyle === 'hologram') {
        const flick = 0.85 + Math.sin(this.time * 8 + lamp.group.position.x) * 0.15;
        lamp.bulbMat.emissiveIntensity *= flick;
      }
    }
  }

  setEra(config: EraConfig): void {
    for (const lamp of this.lamps) {
      const c = new THREE.Color(config.lampColor).convertSRGBToLinear();
      lamp.bulbMat.color.copy(c);
      lamp.bulbMat.emissive.copy(c);
      lamp.light.color.copy(c);
      const intensity = 0.4 + config.nightFactor * 2.2;
      lamp.bulbMat.emissiveIntensity = intensity;
      lamp.light.intensity = 0.3 + config.nightFactor * 1.8;
    }
  }

  dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        mats.add(o.material as THREE.Material);
      }
    });
    this.poleMat.dispose();
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}
