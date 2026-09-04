// Sky / environment module: gradient dome, sun disk, fog, ambient
// and directional lighting, plus the era-dependent atmospheric particle
// field (dust → smog → neon flakes). No textures — everything is
// vertex-colored geometry or shader-free materials.
//
// The module owns the environment lights, and receives the Scene so the
// era fog can be updated in place (one shared THREE.Fog instance, no
// parent-walking and no per-frame allocation). All mood-driven work is
// gated on eraFloat changes; idle frames only animate the particles.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { moodAt, type EraMood } from '../mood';
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

const SCRATCH_TOP = new THREE.Color();
const SCRATCH_HORIZON = new THREE.Color();
const SCRATCH_GROUND = new THREE.Color();
const SCRATCH_OUT = new THREE.Color();

export class SkyModule implements SceneModule {
  readonly name = 'sky';
  readonly group: THREE.Group = new THREE.Group();

  private scene: THREE.Scene;
  private sun: THREE.Mesh;
  private sunMaterial: THREE.MeshBasicMaterial;
  private light: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private dome: THREE.Mesh;
  private domeMaterial: THREE.MeshBasicMaterial;
  private particles: ParticleState | null = null;

  /** Static per-vertex normalized Y, computed once from the dome. */
  private domeY: Float32Array | null = null;

  /** Mood gate: only re-derive the mood when eraFloat actually moves. */
  private lastMoodT = Number.NaN;
  private cachedMood: EraMood | null = null;
  private particlesTargetOpacity = 0.3;
  private particlesFlutter = 0.3;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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
    const mesh = new THREE.Mesh(geo, this.domeMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
  }

  setEra(_era: EraId): void {
    // Continuous updates happen in update(); discrete path is a no-op.
  }

  update(_dt: number, state: AppState): void {
    const ft = state.eraFloat;
    if (ft !== this.lastMoodT) {
      this.lastMoodT = ft;
      this.cachedMood = moodAt(ft);
      if (this.cachedMood) this.applyMood(this.cachedMood);
    }
    this.updateParticles();
  }

  private applyMood(m: EraMood): void {
    const sky = m.sky;
    const geo = this.dome.geometry as THREE.SphereGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = geo.attributes.color as THREE.BufferAttribute;
    if (!this.domeY) {
      const ys = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) ys[i] = pos.getY(i) / DOME_RADIUS;
      this.domeY = ys;
    }

    const top = SCRATCH_TOP.set(sky.skyTop);
    const horizon = SCRATCH_HORIZON.set(sky.skyHorizon);
    const ground = SCRATCH_GROUND.set(sky.skyGround);
    const out = SCRATCH_OUT;
    const ys = this.domeY;
    for (let i = 0; i < pos.count; i++) {
      const y = ys[i];
      if (y > 0) {
        out.lerpColors(top, horizon, Math.min(1, (1 - y) * 0.9));
      } else {
        out.lerpColors(horizon, ground, Math.min(1, -y * 1.4));
      }
      colors.setXYZ(i, out.r, out.g, out.b);
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

    // Reuse the single Scene fog instance; the update is reachable because
    // the Scene is injected at construction instead of walking parents.
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.set(sky.fogColor);
      // THREE.Fog has no density; scale near/far so density data matters.
      const d = Math.max(0.006, Math.min(0.02, sky.fogDensity));
      fog.near = 30 + (d - 0.006) * 1400;
      fog.far = 380 - (d - 0.006) * 14000;
    } else if (fog instanceof THREE.FogExp2) {
      fog.color.set(sky.fogColor);
      fog.density = Math.max(0.0001, sky.fogDensity);
    }

    if (this.particles) {
      this.particles.material.color.set(m.particle.color);
      this.particlesTargetOpacity = m.particle.opacity;
      this.particlesFlutter = m.particle.flutter;
    }
  }

  private updateParticles(): void {
    if (!this.particles) return;
    const p = this.particles;
    const mat = p.material;
    mat.opacity += (this.particlesTargetOpacity - mat.opacity) * 0.05;

    const time = performance.now() * 0.0005;
    const positions = p.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    const flutter = this.particlesFlutter;
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