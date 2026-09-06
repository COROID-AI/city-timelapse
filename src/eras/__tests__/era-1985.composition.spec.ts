import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { EraContext } from '../../types';
import { eraRegistry } from '../registry';
import '../eras/1985';

/**
 * 1985 era — registry composition.
 *
 * Verifies that importing the 1985 module registers the era into the shared
 * singleton registry, that the registered content builds a full 80s scene,
 * that update() actually moves animated elements, and that dispose() releases
 * all resources (detaches the scene graph and clears state).
 */
describe('era 1985 registry composition', () => {
  const makeContext = (): { ctx: EraContext; scene: THREE.Group } => {
    const scene = new THREE.Group();
    const ctx: EraContext = {
      scene,
      loader: { load: async () => '', release: () => undefined },
      root: undefined as unknown as HTMLElement,
      year: '1985',
    };
    return { ctx, scene };
  };

  it('registers era 1985 on import', () => {
    const content = eraRegistry.getEra('1985');
    expect(content).toBeDefined();
    expect(eraRegistry.getEras()).toContain('1985');
    const info = eraRegistry.eraCompositionInfo().find((e) => e.era === '1985');
    expect(info?.build).toEqual(content?.build);
  });

  it('builds a full 80s scene, updates positions, and disposes cleanly', () => {
    const { ctx, scene } = makeContext();
    const content = eraRegistry.getEra('1985');
    expect(content).toBeDefined();

    // build
    content!.build(ctx);
    expect(scene.children).toHaveLength(1);
    const root = scene.children[0] as THREE.Group;
    expect(root.name).toBe('era-1985');

    // Count scene graph children as a sanity check of real content.
    const countMeshes = (group: THREE.Object3D): number => {
      let n = 0;
      for (const child of group.children) {
        n += 1;
        if (child.children && child.children.length > 0) n += countMeshes(child);
      }
      return n;
    };
    expect(countMeshes(root)).toBeGreaterThan(40);

    // interactivePoints ≥4
    expect(content!.interactivePoints.length).toBeGreaterThanOrEqual(4);
    content!.interactivePoints.forEach((p) => {
      expect(p.position).toBeDefined();
      expect(p.id).toBeTruthy();
    });

    // update mutates positions (animated vehicles / pedestrians).
    const moveTargets = (group: THREE.Group): THREE.Group[] => {
      const out: THREE.Group[] = [];
      for (const child of group.children) {
        if (child.name?.startsWith('vehicle-') || child.name?.startsWith('pedestrian-')) {
          out.push(child as THREE.Group);
        }
        if (child.children && child.children.length > 0) out.push(...moveTargets(child as THREE.Group));
      }
      return out;
    };
    const targets = moveTargets(root);
    expect(targets.length).toBeGreaterThan(0);
    const before = targets.map((t) => ({ x: t.position.x, z: t.position.z }));
    content!.update(0.5);
    const after = targets.map((t) => ({ x: t.position.x, z: t.position.z }));
    const moved = before.some((b, i) => b.x !== after[i].x || b.z !== after[i].z);
    expect(moved).toBe(true);

    // dispose releases resources and detaches the scene graph.
    content!.dispose();
    expect(scene.children).toHaveLength(0);
    expect(content!.interactivePoints).toHaveLength(0);
  });
});