/**
 * Blue-purple nitrous exhaust flames for the player car.
 *
 * Spawns additive flame particles at the car's two exhaust anchors while the
 * nitrous is boosting, and hides them otherwise. The particle lifecycle is
 * fully deterministic: every particle is driven by a seeded per-particle RNG
 * and a fixed time budget, so the same seed + frame sequence yields the same
 * flame every run (jest-testable, no clock / WebGL dependence).
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate(anchors, options)` -> build the additive emitter
 *   `update(target, dt)`            -> spawn / advance / hide by `dt`
 *   `dispose()`                     -> release geometry + materials
 */
import * as THREE from 'three';

/** Tuning for the nitrous flame emitter. */
export interface NitrousFlameOptions {
  /** Seeded PRNG seed for the per-particle lifecycle (deterministic). */
  readonly seed?: number;
  /** Maximum concurrent particles (pool size). */
  readonly maxParticles?: number;
  /** Particles spawned per second while boosting. */
  readonly spawnRate?: number;
  /** Particle lifetime in seconds. */
  readonly lifetime?: number;
  /** Individual particle scale (world units). */
  readonly size?: number;
  /** Base flame alpha; additive so overlap oversaturates to white-blue. */
  readonly opacity?: number;
  /** World-space speed at which particles drift backward from the anchors. */
  readonly emissionSpeed?: number;
  /** World-space spread around each anchor (x/z jitter). */
  readonly spread?: number;
  /** How strongly the particle pulses with the boost flame intensity. */
  readonly boostScaling?: number;
}

/** Default flame tuning. */
export const defaultNitrousFlameOptions: Readonly<Required<NitrousFlameOptions>> = {
  seed: 1337,
  maxParticles: 96,
  spawnRate: 90,
  lifetime: 0.55,
  size: 0.34,
  opacity: 0.9,
  emissionSpeed: 6,
  spread: 0.18,
  boostScaling: 1,
};

/** Deterministic mulberry32 PRNG: returns next float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A single active / pooled flame particle. */
export interface FlameParticle {
  /** Absolute world-space position (flame drifts backward from anchor). */
  x: number;
  y: number;
  z: number;
  /** Age in seconds (0 = just spawned). */
  age: number;
  /** Per-particle lifetime in seconds (deterministic from seed). */
  life: number;
  /** Per-particle speed, scale and fade jitter (deterministic). */
  speed: number;
  scale: number;
  fade: number;
  /** Which anchor this particle spawned from. */
  anchorIndex: number;
  active: boolean;
}

/** A fully wired nitrous flame emitter. */
export interface NitrousFlames {
  /** The Points object to add to the scene (hidden while not boosting). */
  readonly points: THREE.Points;
  /** Live copy of the particle pool (read-mostly for tests / debug). */
  readonly particles: readonly FlameParticle[];
  /** Update the emitter from the car's boost state each frame. */
  update(
    boost: { readonly active: boolean; readonly intensity: number },
    anchors: readonly THREE.Object3D[],
    dt: number,
  ): void;
  /** How many particles are currently alive. */
  activeCount(): number;
  /** Release geometry + material owned by the emitter. */
  dispose(): void;
}

/** Build the additive flame emitter hanging from `anchors`. */
export function createNitrousFlames(
  anchors: readonly THREE.Object3D[],
  options: NitrousFlameOptions = {},
): NitrousFlames {
  const cfg: Required<NitrousFlameOptions> = {
    ...defaultNitrousFlameOptions,
    ...options,
  };
  const count = cfg.maxParticles;

  // Per-particle deterministic RNG derived from the shared seed.
  const rng = mulberry32(cfg.seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const particles: FlameParticle[] = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: 0,
      y: 0,
      z: 0,
      age: 0,
      life: cfg.lifetime * (0.7 + 0.6 * rng()),
      speed: cfg.emissionSpeed * (0.6 + 0.8 * rng()),
      scale: cfg.size * (0.7 + 0.6 * rng()),
      fade: 0.5 + 0.5 * rng(),
      anchorIndex: i % Math.max(1, anchors.length),
      active: false,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Keep stable references for per-frame writes (attributes are always set here).
  const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

  // Additive blending gives the blue-purple neon "flame" read.
  const material = new THREE.PointsMaterial({
    size: cfg.size,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: cfg.opacity,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;

  const activeCount = (): number =>
    particles.reduce((n, p) => (p.active ? n + 1 : n), 0);

  let spawnBudget = 0;

  const update = (
    boost: { readonly active: boolean; readonly intensity: number },
    anchorList: readonly THREE.Object3D[],
    dt: number,
  ): void => {
    const anchorsNow = anchorList.length > 0 ? anchorList : anchors;
    const intensity = Math.max(0, Math.min(1, boost.intensity));

    if (boost.active && anchorsNow.length > 0) {
      points.visible = true;
      // Accumulate a spawn budget so low/high frame rates emit consistently.
      spawnBudget += cfg.spawnRate * intensity * dt;
    } else {
      points.visible = false;
      spawnBudget = 0;
    }

    // Spawn while we have both budget and free particles in the pool.
    while (spawnBudget >= 1) {
      const free = particles.find((p) => !p.active);
      if (!free) break;
      spawnBudget -= 1;
      activate(free, anchorsNow);
    }
    spawnBudget = Math.min(spawnBudget, 4);

    // Advance every particle by `dt` and write live vertex attributes.
    let cursor = 0;
    for (const p of particles) {
      if (p.active) {
        p.age += dt;
        if (p.age >= p.life) {
          p.active = false;
        } else {
          // Drift rearward (-Z, matching the tail anchor direction) + slight
          // upward rise, mottled by per-particle speed. All rates are per
          // second so the trail is identical regardless of the frame's dt.
          p.z -= p.speed * dt;
          p.x += (rng() - 0.5) * 0.6 * dt;
          p.y += (0.12 + (rng() - 0.5) * 0.3) * dt;
          p.z += (rng() - 0.5) * 0.4 * dt;
        }
      }
      writeVertex(p, cursor);
      cursor += 3;
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    material.size = cfg.size * (1 + cfg.boostScaling * intensity);
  };

  /** Spawn a pooled particle at a chosen anchor, seeded per-particle. */
  const activate = (
    p: FlameParticle,
    anchorList: readonly THREE.Object3D[],
  ): void => {
    const anchor = anchorList[p.anchorIndex % Math.max(1, anchorList.length)];
    const fx = anchor ? anchor.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    // Jitter around the anchor; deterministic from the shared seed stream.
    p.x = fx.x + (rng() - 0.5) * cfg.spread * 2;
    p.y = fx.y + (rng() - 0.5) * cfg.spread * 0.6;
    p.z = fx.z + (rng() - 0.5) * cfg.spread * 2;
    p.age = 0;
    p.active = true;
  };

  /** Write a particle's world pos + color into the vertex buffer arrays. */
  const writeVertex = (p: FlameParticle, offset: number): void => {
    positions[offset] = p.x;
    positions[offset + 1] = p.y;
    positions[offset + 2] = p.z;
    if (p.active) {
      // Blue-purple core fading outward with life + deterministic fade.
      const t = p.age / p.life;
      const fadeOut = 1 - t;
      const r = 0.35 + 0.3 * p.fade;
      const g = 0.2 + 0.35 * p.fade;
      const b = 0.95 + 0.05 * p.fade;
      const a = fadeOut;
      colors[offset] = r * a;
      colors[offset + 1] = g * a;
      colors[offset + 2] = b * a;
    } else {
      colors[offset] = 0;
      colors[offset + 1] = 0;
      colors[offset + 2] = 0;
    }
  };

  const dispose = (): void => {
    points.geometry.dispose();
    (points.material as THREE.Material).dispose();
  };

  return { points, particles, update, activeCount, dispose };
}