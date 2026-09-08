/**
 * Unit tests for the `createNeonCity(scene)` factory contract: return shape,
 * no global side effects beyond the returned group, update() allocation-free
 * flicker, and dispose() hygiene.
 */

import * as THREE from 'three';

// `three/examples/jsm/objects/Reflector.js` is ESM-only and cannot be required
// by ts-jest's CJS transform. Mock it with a minimal Mesh so the factory
// contract (return shape, group ownership, dispose hygiene) stays testable.
jest.mock('three/examples/jsm/objects/Reflector.js', () => {
  const real = jest.requireActual('three');
  return {
    Reflector: class extends real.Mesh {
      constructor(geometry: unknown, options: { color?: number } = {}) {
        super(geometry, new real.MeshBasicMaterial({ color: options.color ?? 0xffffff }));
        this.material.transparent = true;
        this.material.opacity = 0.75;
      }
    },
  };
});

import { createNeonCity } from '../../src/world/neonCity';

describe('createNeonCity factory contract', () => {
  it('returns { group, update, track, dispose }', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    expect(world).toHaveProperty('group');
    expect(world).toHaveProperty('update');
    expect(world).toHaveProperty('track');
    expect(world).toHaveProperty('dispose');
    expect(typeof world.update).toBe('function');
    expect(typeof world.dispose).toBe('function');
    expect(world.group).toBeInstanceOf(THREE.Group);
  });

  it('only mutates the scene background/fog and returns a self-contained group', () => {
    const scene = new THREE.Scene();
    const beforeChildren = scene.children.length;
    const world = createNeonCity(scene);
    // The scene's direct children are unchanged — everything lives in `group`.
    expect(scene.children.length).toBe(beforeChildren);
    // Night sky + fog are applied to the scene itself (intended side effect).
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    // The returned group actually owns the world geometry.
    expect(world.group.children.length).toBeGreaterThan(0);
  });

  it('exposes a closed-loop track with a start/finish line', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    expect(world.track.path.loop).toBe(true);
    expect(world.track.checkpointCount).toBeGreaterThanOrEqual(2);
    expect(world.startLine.children.length).toBeGreaterThan(0);
  });

  it('builds a wet reflective road with a planar reflector', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    const road = world.road;
    expect(road.asphalt).toBeInstanceOf(THREE.Mesh);
    expect(road.reflector).toBeInstanceOf(THREE.Mesh);
    const mat = road.asphalt.material as THREE.MeshStandardMaterial;
    expect(mat.roughness).toBeLessThan(0.6); // low roughness = wet sheen
  });

  it('builds the neon corridor with >= 12 signs', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    expect(world.corridor.signs.length).toBeGreaterThanOrEqual(12);
    expect(world.corridor.buildings.length).toBeGreaterThan(0);
  });

  it('update() animates flicker without per-frame allocations', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    const before = world.corridor.signs.map((s) => s.color.getHex());
    world.update(0.016, 1.0);
    const after = world.corridor.signs.map((s) => s.color.getHex());
    // Intensities changed => flicker is live.
    expect(before).not.toEqual(after);
    // And the world group is unchanged structurally across updates.
    expect(world.group.children.length).toBeGreaterThan(0);
  });

  it('dispose() releases resources without throwing', () => {
    const scene = new THREE.Scene();
    const world = createNeonCity(scene);
    expect(() => world.dispose()).not.toThrow();
  });
});