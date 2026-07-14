import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { BLOCK_SIZE, ROAD_WIDTH, LOT_SIZE, LOTS_PER_AXIS } from './ground';
import { mulberry32, pick, randFloat, lerpN, smoothstep, TAU } from '../util/math';
import { lerpColorInto } from '../util/color';

interface Vehicle {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshStandardMaterial;
  // path: which axis (0 = runs along X, 1 = runs along Z), lane offset, direction
  axis: 0 | 1;
  laneLine: number; // index of the road line this vehicle drives on
  dir: 1 | -1;
  speed: number;
  pos: number; // position along the travel axis
  headlight: THREE.PointLight;
}

const _c = new THREE.Color();

/**
 * Vehicles loop around the road grid. Their silhouette (classic fin car,
 * modern sedan, futuristic hover-pod) and colour cross-fade with the era.
 * Headlights toggle on at night.
 */
export class VehiclesModule implements SceneModule {
  readonly group = new THREE.Group();
  private vehicles: Vehicle[] = [];
  private maxVehicles = 12;
  private time = 0;

  constructor() {
    const rng = mulberry32(22_011);
    this.maxVehicles = ERA_LIST.reduce((m, e) => Math.max(m, e.vehicleCount), 0);
    for (let i = 0; i < this.maxVehicles; i++) {
      const v = this.createVehicle(i, rng);
      this.vehicles.push(v);
      this.group.add(v.group);
    }
    this.setEra(ERA_LIST[0]);
  }

  private roadLine(index: number): number {
    const half = BLOCK_SIZE / 2;
    return -half + index * (LOT_SIZE + ROAD_WIDTH) - ROAD_WIDTH / 2;
  }

  private createVehicle(i: number, rng: () => number): Vehicle {
    const axis: 0 | 1 = i % 2 === 0 ? 0 : 1;
    const laneLine = randInt(rng, 0, LOTS_PER_AXIS);
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const color = pick(rng, ERA_LIST[0].vehicleColors);

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.7
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: '#fff0c0',
      emissive: '#fff0c0',
      emissiveIntensity: 0,
      roughness: 0.4
    });

    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    grp.add(body);

    // cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), bodyMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    grp.add(cabin);

    // headlights (two small emissive boxes)
    const hlGeo = new THREE.BoxGeometry(0.4, 0.25, 0.1);
    const hlL = new THREE.Mesh(hlGeo, glowMat);
    hlL.position.set(0.6, 0.6, 2.1);
    const hlR = new THREE.Mesh(hlGeo, glowMat);
    hlR.position.set(-0.6, 0.6, 2.1);
    grp.add(hlL, hlR);

    // taillights
    const tlMat = glowMat.clone();
    tlMat.color.set('#ff3030');
    tlMat.emissive.set('#ff3030');
    const tlGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
    const tlL = new THREE.Mesh(tlGeo, tlMat);
    tlL.position.set(0.6, 0.6, -2.1);
    const tlR = new THREE.Mesh(tlGeo, tlMat);
    tlR.position.set(-0.6, 0.6, -2.1);
    grp.add(tlL, tlR);

    const headlight = new THREE.PointLight('#fff0c0', 0, 14, 2);
    headlight.position.set(0, 1.2, 2.5);
    grp.add(headlight);

    return {
      group: grp,
      body,
      bodyMat,
      glowMat,
      axis,
      laneLine,
      dir,
      speed: randFloat(rng, 6, 11),
      pos: randFloat(rng, -BLOCK_SIZE / 2, BLOCK_SIZE / 2),
      headlight
    };
  }

  update(dt: number, state: SceneState): void {
    this.time += dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);
    const night = lerpN(a.nightFactor, b.nightFactor, t);
    const activeCount = Math.round(lerpN(a.vehicleCount, b.vehicleCount, t));

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const visible = i < activeCount;
      v.group.visible = visible;
      if (!visible) continue;

      // Move
      v.pos += v.dir * v.speed * dt;
      const half = BLOCK_SIZE / 2 + 6;
      if (v.pos > half) v.pos = -half;
      if (v.pos < -half) v.pos = half;

      const line = this.roadLine(v.laneLine);
      const laneOffset = v.dir * 2.6; // drive on the right/left
      if (v.axis === 0) {
        v.group.position.set(v.pos, 0, line + laneOffset);
        v.group.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        v.group.position.set(line + laneOffset, 0, v.pos);
        v.group.rotation.y = v.dir > 0 ? 0 : Math.PI;
      }

      // Future era hover bob
      const hover = b.year >= 2055 ? Math.sin(this.time * 3 + i) * 0.12 : 0;
      v.group.position.y = hover;

      // Body colour lerp
      const rngA = mulberry32(i * 57 + 3);
      const rngB = mulberry32(i * 57 + 7);
      lerpColorInto(pick(rngA, a.vehicleColors), pick(rngB, b.vehicleColors), t, _c);
      v.bodyMat.color.copy(_c);

      // Headlights at night
      const headOn = night > 0.25;
      v.glowMat.emissiveIntensity = headOn ? 1.6 : 0;
      v.headlight.intensity = headOn ? 1.2 : 0;

      // Future glow trail
      if (b.vehicleType === 'future') {
        v.glowMat.emissive.set(b.windowEmissive);
        v.glowMat.emissiveIntensity = 0.8;
      } else if (a.vehicleType === 'future') {
        v.glowMat.emissive.set('#fff0c0');
      }
    }
  }

  setEra(config: EraConfig): void {
    const night = config.nightFactor;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      v.group.visible = i < config.vehicleCount;
      v.bodyMat.color.set(pick(mulberry32(i * 57 + 3), config.vehicleColors));
      const headOn = night > 0.25;
      v.glowMat.emissiveIntensity = headOn ? 1.6 : 0;
      v.headlight.intensity = headOn ? 1.2 : 0;
    }
  }

  dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    for (const v of this.vehicles) {
      v.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geos.add(o.geometry);
          if (Array.isArray(o.material)) o.material.forEach((m) => mats.add(m));
          else mats.add(o.material);
        }
      });
      v.bodyMat.dispose();
      v.glowMat.dispose();
    }
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

void TAU;
void lerpN;
