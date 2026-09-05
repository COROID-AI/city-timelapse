/**
 * src/env/Weather.ts — era-aware weather system shell.
 *
 * Reads the era from EraState and applies period-appropriate atmospheric
 * settings through the shared morph timeline: haze color/density (dust, smog,
 * neon flakes) drives scene fog and a lightweight procedural particle layer.
 * Period values are declarative data in src/eras.ts (WEATHER_ERA_PRESETS); no
 * era logic is hardcoded here. This is a shell — later tasks can enrich the
 * particle behavior without changing the contract.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../core/MorphEngine';
import { WEATHER_ERA_PRESETS, type EraId, type WeatherEraPreset } from '../eras';
import { EraState } from '../state/EraState';

export interface ParticleField {
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
}

export class Weather {
  private readonly particles: THREE.Points;
  private readonly particleField: ParticleField;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly unsubscribe: () => void;

  constructor(scene: THREE.Scene, eraState: EraState, morphEngine: MorphEngine) {
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const geometry = new THREE.BufferGeometry();
    const count = WEATHER_ERA_PRESETS['1945'].particleCount;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = Math.random() * 0.2 - 0.1;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(geometry, pointsMaterial);
    this.particles.name = 'atmosphere-particles';
    scene.add(this.particles);

    this.particleField = { positions, velocities, count };

    this.uniforms = {
      hazeColor: { value: new THREE.Color('#ffffff') },
      hazeDensity: { value: 0.02 },
      particleColor: { value: new THREE.Color('#ffffff') },
      particleOpacity: { value: 0.55 },
    };

    const reader = (id: EraId): WeatherEraPreset => WEATHER_ERA_PRESETS[id];

    // Weather reads era + morph timeline like lighting: lerped uniforms drive
    // the haze color/density; particle visuals snap on era change via the
    // subscription below (a richer particle morph can be added by later tasks).
    morphEngine.bindColorUniform(
      this.uniforms,
      'hazeColor',
      (s) => new THREE.Color(reader(s.id).hazeColor),
      (s) => new THREE.Color(reader(s.id).hazeColor),
    );
    morphEngine.bindNumericUniform(
      this.uniforms,
      'hazeDensity',
      (s) => reader(s.id).hazeDensity,
      (s) => reader(s.id).hazeDensity,
    );

    this.unsubscribe = eraState.subscribe((id) => {
      const preset = reader(id);
      pointsMaterial.color.set(preset.hazeColor);
      pointsMaterial.opacity = Math.min(0.9, 0.4 + preset.hazeDensity * 12);
      // Simple era-appropriate cardinality switch: particles magnitude scales
      // with particleCount so the atmosphere feels denser in smog eras.
      const scale = preset.particleCount / WEATHER_ERA_PRESETS['1945'].particleCount;
      geometry.setDrawRange(0, Math.min(count, Math.round(count * scale)));
    });
  }

  /** Advance particle drift; exposes the shared haze for scenes to consume. */
  update(dtSeconds: number): void {
    const field = this.particleField;
    const positions = field.positions;
    for (let i = 0; i < field.count; i += 1) {
      positions[i * 3] += field.velocities[i * 3] * dtSeconds;
      positions[i * 3 + 1] += field.velocities[i * 3 + 1] * dtSeconds;
      positions[i * 3 + 2] += field.velocities[i * 3 + 2] * dtSeconds;
      if (positions[i * 3 + 1] < 0 || positions[i * 3 + 1] > 30) {
        field.velocities[i * 3 + 1] *= -1;
      }
    }
    this.particles.geometry.getAttribute('position').needsUpdate = true;
  }

  get hazeColor(): THREE.Color {
    return this.uniforms.hazeColor.value as THREE.Color;
  }

  get hazeDensity(): number {
    return this.uniforms.hazeDensity.value as number;
  }

  dispose(): void {
    this.unsubscribe();
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}