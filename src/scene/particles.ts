import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { BLOCK_SIZE } from './ground';
import { mulberry32, lerpN, smoothstep, TAU } from '../util/math';
import { makeGlowSprite } from '../util/textures';

interface ParticleSet {
  points: THREE.Points;
  mat: THREE.PointsMaterial;
  geo: THREE.BufferGeometry;
  velocities: Float32Array;
  baseY: Float32Array;
  count: number;
}

const MAX_PARTICLES = 200;
const HALF_BLOCK = BLOCK_SIZE / 2 + 30;

/**
 * Ambient atmospheric particles. Era-specific behaviour:
 *  1945 embers drift up, 1965 dust floats, 1985 leaves swirl,
 *  2005 smog hangs low, 2025 drones move in straight lines,
 *  2055 nanites shimmer in tight clusters.
 */
export class ParticlesModule implements SceneModule {
  readonly group = new THREE.Group();
  private sets: ParticleSet[] = [];
  private time = 0;

  constructor(enabled = true) {
    if (!enabled) return;
    // One particle system per era, each with its own texture/colour.
    for (let e = 0; e < ERA_LIST.length; e++) {
      const era = ERA_LIST[e];
      const tex = makeGlowSprite(era.particleColor, e);
      const mat = new THREE.PointsMaterial({
        size: era.particleType === 'drones' ? 1.4 : 0.7,
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color(era.particleColor).convertSRGBToLinear(),
        opacity: 0
      });
      const count = Math.min(era.particleCount, MAX_PARTICLES);
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const baseY = new Float32Array(count);
      const rng = mulberry32(e * 999 + 13);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (rng() - 0.5) * BLOCK_SIZE;
        positions[i * 3 + 1] = rng() * 40 + 2;
        positions[i * 3 + 2] = (rng() - 0.5) * BLOCK_SIZE;
        velocities[i * 3] = (rng() - 0.5) * 0.5;
        velocities[i * 3 + 1] = rng() * 0.4;
        velocities[i * 3 + 2] = (rng() - 0.5) * 0.5;
        baseY[i] = positions[i * 3 + 1];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.visible = false;
      this.sets.push({ points, mat, geo, velocities, baseY, count });
      this.group.add(points);
    }
    this.setEra(ERA_LIST[0]);
  }

  update(dt: number, state: SceneState): void {
    this.time += dt;
    const from = state.fromIndex;
    const to = state.toIndex;
    const t = smoothstep(state.progress);

    for (let e = 0; e < this.sets.length; e++) {
      const set = this.sets[e];
      let opacity = 0;
      if (e === from) opacity = 1 - t;
      else if (e === to) opacity = t;
      set.mat.opacity = opacity * 0.85;
      set.points.visible = opacity > 0.01;

      if (!set.points.visible) continue;
      const era = ERA_LIST[e];
      const pos = set.geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const type = era.particleType;

      for (let i = 0; i < set.count; i++) {
        const ix = i * 3;
        const vx = set.velocities[ix];
        const vy = set.velocities[ix + 1];
        const vz = set.velocities[ix + 2];

        if (type === 'embers') {
          arr[ix] += vx * dt * 0.5;
          arr[ix + 1] += vy * dt;
          arr[ix + 2] += vz * dt * 0.5;
        } else if (type === 'dust') {
          arr[ix] += Math.sin(this.time + i) * dt * 0.3;
          arr[ix + 1] += Math.sin(this.time * 0.5 + i) * dt * 0.2;
          arr[ix + 2] += Math.cos(this.time + i) * dt * 0.3;
        } else if (type === 'leaves') {
          arr[ix] += Math.sin(this.time * 2 + i) * dt * 2;
          arr[ix + 1] += Math.cos(this.time + i) * dt * 0.5 - dt * 0.5;
          arr[ix + 2] += Math.cos(this.time * 1.5 + i) * dt * 2;
        } else if (type === 'smog') {
          arr[ix] += vx * dt * 0.2;
          arr[ix + 1] = set.baseY[i] + Math.sin(this.time * 0.3 + i) * 1.5;
          arr[ix + 2] += vz * dt * 0.2;
        } else if (type === 'drones') {
          arr[ix] += vx * dt * 3;
          arr[ix + 1] = set.baseY[i] + Math.sin(this.time + i) * 2;
          arr[ix + 2] += vz * dt * 3;
        } else {
          // nanites
          arr[ix] += Math.sin(this.time * 4 + i) * dt * 1.5;
          arr[ix + 1] += Math.cos(this.time * 3 + i) * dt * 1.5;
          arr[ix + 2] += Math.sin(this.time * 5 + i * 0.5) * dt * 1.5;
        }

        // Wrap around block bounds
        if (arr[ix] > HALF_BLOCK) arr[ix] = -HALF_BLOCK;
        if (arr[ix] < -HALF_BLOCK) arr[ix] = HALF_BLOCK;
        if (arr[ix + 2] > HALF_BLOCK) arr[ix + 2] = -HALF_BLOCK;
        if (arr[ix + 2] < -HALF_BLOCK) arr[ix + 2] = HALF_BLOCK;
        if (arr[ix + 1] > 55) arr[ix + 1] = 2;
        if (arr[ix + 1] < 1) arr[ix + 1] = 50;
      }
      pos.needsUpdate = true;
    }
  }

  setEra(config: EraConfig): void {
    const idx = ERA_LIST.findIndex((e) => e.id === config.id);
    for (let e = 0; e < this.sets.length; e++) {
      const set = this.sets[e];
      const on = e === idx;
      set.mat.opacity = on ? 0.85 : 0;
      set.points.visible = on;
    }
  }

  dispose(): void {
    for (const set of this.sets) {
      set.mat.dispose();
      set.mat.map?.dispose();
      set.geo.dispose();
    }
  }
}

void lerpN;
void TAU;
