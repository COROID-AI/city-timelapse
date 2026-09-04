// Sky / environment module: gradient dome, sun disk, fog, ambient
// and directional lighting, plus the era-dependent atmospheric particle
// field (dust → smog → neon flakes). No textures — everything is
// vertex-colored geometry or shader-free materials.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { moodAt } from '../mood';
import { mulberry32, range } from './rand';

const DOME_RADIUS = 420;

interface ParticleState {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  basePositions: Float32Array;
  speeds: Float32Array;
  phases: Float32Array;
  count: number;
}

export class SkyModule implements SceneModule {
  readonly name = 'sky';
  readonly group: THREE.Group = new THREE.Group();

  private sun: THREE.Mesh;
  private sunMaterial: THREE.MeshBasicMaterial;
  private light: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private dome: THREE.Mesh;
  private domeMaterial: THREE.MeshBasicMaterial;
  private particles: ParticleState | null = null;

  constructor(scene: THREE.Scene) {
    this.domeMaterial = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: true,
      fog: false,
    });
    this.dome = this.makeDome();
    this.group.add(this.dome);

    this.sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sunGeo = new THREE.CircleGeometry(16, 24);
    this.sun = new THREE.Mesh(sunGeo, this.sunMaterial);
    this.sun.position.set(0, 90, -DOME_RADIUS + 20);
    this.sun.frustumCulled = false;
    this.group.add(this.sun);

    this.light = new THREE.DirectionalLight(0xffffff, 1.8);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);

    // The module owns the environment lights; main.ts adds nothing else.
    this.group.add(this.light);
    scene.add(this.ambient);

    this.particles = this.makeParticles();
    if (this.particles) this.group.add(this.particles.points);
  }

  private makeDome(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(DOME_RADIUS, 48, 24);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Drive per-vertex color from world Y (top → horizon → ground).
    // Colors are updated every frame from moodAt, so we fill in update().
    const mesh = new THREE.Mesh(geo, this.domeMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
  }

  setEra(_era: EraId): void {
    // Continuous updates happen in update(); discrete path is a no-op.
  }

  update(_dt: number, state: AppState): void {
    const m = moodAt(state.eraFloat);
    const sky = m.sky;

    const top = new THREE.Color(sky.skyTop);
    const horizon = new THREE.Color(sky.skyHorizon);
    const ground = new THREE.Color(sky.skyGround);
    const geo = this.dome.geometry as THREE.SphereGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = geo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / DOME_RADIUS; // -1..1
      let c: THREE.Color;
      if (y > 0) {
        c = top.clone().lerp(horizon, Math.min(1, 1 - y));
      } else {
        c = horizon.clone().lerp(ground, Math.min(1, -y * 1.4));
      }
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;

    const sunH = sky.sunHeight; // 0..1 maps to world elevation
    const sunY = -60 + sunH * 220;
    this.sun.position.set(120, sunY, -DOME_RADIUS + 30);
    this.sun.lookAt(0, sunY, -DOME_RADIUS);
    this.sunMaterial.color.set(sky.sunColor);

    this.light.color.set(sky.dirColor);
    this.light.intensity = sky.dirIntensity;
    this.light.position.set(160, sunY, 60);

    this.ambient.color.set(sky.ambientColor);
    this.ambient.intensity = sky.ambientIntensity;

    const fog = this.group.parent?.parent as THREE.Scene | undefined;
    if (fog) {
      fog.fog = new THREE.Fog(new THREE.Color(sky.fogColor), 40, 320);
      (fog.fog as THREE.Fog).color.set(sky.fogColor);
    }

    this.updateParticles(state, m.particle.color, m.particle.flutter);
  }

  private updateParticles(state: AppState, colorHex: string, flutter: number): void {
    if (!this.particles) return;
    const p = this.particles;
    const mat = p.material;
    const targetOpacity = moodAt(state.eraFloat).particle.opacity;
    mat.opacity += (targetOpacity - mat.opacity) * 0.05;
    mat.color.set(colorHex);

    const time = performance.now() * 0.0005;
    const positions = p.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    for (let i = 0; i < p.count; i++) {
      const i3 = i * 3;
      const base = p.basePositions;
      const speed = p.speeds[i];
      const phase = p.phases[i];
      arr[i3] = base[i3] + Math.sin(time * 0.5 + phase) * (2 + flutter * 7);
      arr[i3 + 1] = base[i3 + 1] + Math.sin(time * 0.35 + phase * 1.7) * 1.5 + speed * 0.4;
      arr[i3 + 2] = base[i3 + 2] + Math.cos(time * 0.45 + phase * 0.8) * (2 + flutter * 6);
    }
    positions.needsUpdate = true;
  }

  private makeParticles(): ParticleState | null {
    const m = moodAt(0);
    const count = m.particle.count;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const rnd = mulberry32(42);
    for (let i = 0; i < count; i++) {
      const x = range(rnd, -120, 120);
      const z = range(rnd, -120, 120);
      const y = range(rnd, 1, 70);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      speeds[i] = range(rnd, 0.2, 1.2);
      phases[i] = range(rnd, 0, Math.PI * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: m.particle.color,
      size: m.particle.size * 3,
      transparent: true,
      opacity: m.particle.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, material);
    const basePositions = positions.slice();
    return { points, material, basePositions, speeds, phases, count };
  }

  dispose(): void {
    this.dome.geometry.dispose();
    this.domeMaterial.dispose();
    this.sun.geometry.dispose();
    this.sunMaterial.dispose();
    this.particles?.points.geometry.dispose();
    this.particles?.material.dispose();
    this.ambient.dispose?.();
  }
}