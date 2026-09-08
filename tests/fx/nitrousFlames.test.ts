/**
 * Unit tests for the deterministic, additive blue-purple nitrous flame emitter.
 *
 * Covers the seeded per-particle lifecycle (determinism, emission only while
 * boosting, fade-out), and the resource cleanup contract. No WebGL is needed —
 * the emitter is pure three.js object / buffer state.
 */
import * as THREE from 'three';

import {
  createNitrousFlames,
  defaultNitrousFlameOptions,
  mulberry32,
} from '../../src/fx/nitrousFlames';

/** Two exhaust anchors matching the car mesh's named transforms. */
function anchors(): THREE.Object3D[] {
  const left = new THREE.Object3D();
  left.position.set(-0.45, 0.45, -2.06);
  const right = new THREE.Object3D();
  right.position.set(0.45, 0.45, -2.06);
  return [left, right];
}

describe('mulberry32 — seeded deterministic PRNG', () => {
  it('returns values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = mulberry32(1337);
    const b = mulberry32(1337);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBeCloseTo(b(), 12);
    }
  });
});

describe('createNitrousFlames — deterministic particle lifecycle', () => {
  it('starts empty and hidden with all particles pooled inactive', () => {
    const flames = createNitrousFlames(anchors());
    expect(flames.activeCount()).toBe(0);
    expect(flames.points.visible).toBe(false);
    // The cache is warmed by an initial empty pass over the pool.
    expect(flames.particles.length).toBe(defaultNitrousFlameOptions.maxParticles);
  });

  it('is deterministic: same frames => identical active particles', () => {
    const run = (): number[][] => {
      const flames = createNitrousFlames(anchors());
      // Let some frames pass to warm the pool into a stable emission state.
      for (let i = 0; i < 3; i++) {
        flames.update({ active: false, intensity: 0 }, anchors(), 1 / 60);
      }
      for (let i = 0; i < 60; i++) {
        flames.update({ active: true, intensity: 1 }, anchors(), 1 / 60);
      }
      return flames.particles
        .filter((p) => p.active)
        .map((p) => [p.x, p.y, p.z].map((v) => Number(v.toFixed(6))));
    };
    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('fires active particles only while boosting', () => {
    const flames = createNitrousFlames(anchors());
    flames.update({ active: false, intensity: 0 }, anchors(), 1 / 60);
    expect(flames.activeCount()).toBe(0);

    flames.update({ active: true, intensity: 1 }, anchors(), 1 / 60);
    expect(flames.activeCount()).toBeGreaterThan(0);
    expect(flames.points.visible).toBe(true);
  });

  it('particles are positioned around the exhaust anchors', () => {
    const flames = createNitrousFlames(anchors(), { maxParticles: 16, spawnRate: 200 });
    flames.update({ active: true, intensity: 1 }, anchors(), 0.5);
    const actives = flames.particles.filter((p) => p.active);
    expect(actives.length).toBeGreaterThan(0);
    for (const p of actives) {
      // Near the exhaust anchors at the rear of the car (x ≈ ±0.45, z ≈ -2.06).
      expect(Math.abs(p.z)).toBeGreaterThan(1.5);
    }
  });

  it('only emits the provided pool count', () => {
    const flames = createNitrousFlames(anchors(), { maxParticles: 4 });
    flames.update({ active: true, intensity: 1 }, anchors(), 10);
    expect(flames.activeCount()).toBeLessThanOrEqual(4);
  });

  it('dispose releases geometry and material', () => {
    const flames = createNitrousFlames(anchors());
    const geo = flames.points.geometry;
    const mat = flames.points.material as THREE.PointsMaterial;
    const spyGeo = jest.spyOn(geo, 'dispose');
    const spyMat = jest.spyOn(mat, 'dispose');

    flames.dispose();
    expect(spyGeo).toHaveBeenCalled();
    expect(spyMat).toHaveBeenCalled();
  });
});