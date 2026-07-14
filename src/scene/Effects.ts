import * as THREE from 'three';
import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendColors, blendScalar } from '../core/mathUtils';

// Atmospheric particle systems: era-specific drifting motes (smog, neon haze,
// holo confetti, rain). Built once per era; crossfade by opacity + visibility.

const PARTICLE_COUNT = 400;

// Pre-computed per-era arrays — built once.
const EFF_COLORS = ERAS.map(e => e.effects.color);
const EFF_DENSITY = ERAS.map(e => e.effects.density);

interface EffectData {
  group: THREE.Points;
  mat: THREE.PointsMaterial;
  velocities: Float32Array;
}

export class Effects {
  private scene: THREE.Scene;
  private effects: EffectData[] = [];
  private positions: Float32Array[] = [];
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let e = 0; e < ERA_COUNT; e++) {
      this.buildEra(e);
    }
  }

  private buildEra(e: number): void {
    const era = ERAS[e];
    const isActive = e === 0;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      if (era.effects.kind === 'rain') {
        velocities[i * 3] = 0;
        velocities[i * 3 + 1] = -18 - Math.random() * 8;
        velocities[i * 3 + 2] = 0;
      } else if (era.effects.kind === 'smog' || era.effects.kind === 'haze') {
        velocities[i * 3] = (Math.random() - 0.5) * 0.5;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      } else {
        velocities[i * 3] = (Math.random() - 0.5) * 1.5;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const size = era.effects.kind === 'rain' ? 0.15 : era.effects.kind === 'holo' ? 0.5 : 0.4;
    const mat = new THREE.PointsMaterial({
      color: era.effects.color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: isActive ? era.effects.density * 0.5 : 0,
      depthWrite: false,
      blending: era.effects.kind === 'neon' || era.effects.kind === 'holo'
        ? THREE.AdditiveBlending
        : THREE.NormalBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = isActive;
    this.scene.add(points);
    this.effects.push({ group: points, mat, velocities });
    this.positions.push(positions);
  }

  update(weights: EraWeights, dt: number): void {
    const effC = blendColors(EFF_COLORS, weights, 0, this.tmpColor);
    const effD = blendScalar(EFF_DENSITY, weights, 0);

    for (let e = 0; e < ERA_COUNT; e++) {
      const w = weights[e];
      const data = this.effects[e];
      data.group.visible = w > 0.003;
      data.mat.color.copy(effC);
      data.mat.opacity = w * effD * 0.5;

      const positions = this.positions[e];
      const velocities = data.velocities;
      const attr = data.group.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 50;
        if (positions[i * 3 + 1] > 52) positions[i * 3 + 1] = 0;
        if (Math.abs(positions[i * 3]) > 32) positions[i * 3] *= -0.95;
        if (Math.abs(positions[i * 3 + 2]) > 22) positions[i * 3 + 2] *= -0.95;
      }
      attr.array = positions;
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const data of this.effects) {
      this.scene.remove(data.group);
      data.group.geometry.dispose();
      data.mat.dispose();
    }
    this.effects = [];
    this.positions = [];
  }
}
