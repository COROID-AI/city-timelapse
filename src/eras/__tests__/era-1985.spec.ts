import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';
import { era1985, era1985Providers } from '../eras/1985';

/**
 * 1985 era — scene content stats.
 *
 * Verifies the full 80s art direction is present: curtain-wall commercial
 * towers, retail storefronts with neon, saturated billboards, boxy vehicles
 * plus a bus/tram, 80s-fashion pedestrians, and street furniture. The scene
 * builds headlessly (node env: no DOM) with flat-color fallbacks for textures.
 */
describe('era 1985 scene content', () => {
  it('registers the era and exposes the contract shape', () => {
    expect(era1985.build).toBeTypeOf('function');
    expect(era1985.update).toBeTypeOf('function');
    expect(era1985.dispose).toBeTypeOf('function');
    expect(era1985.isFastPath).toBe(false);
    expect(Array.isArray(era1985.interactivePoints)).toBe(true);
  });

  it('builds ≥6 curtain-wall buildings with retail storefronts and neon', () => {
    const scene = new THREE.Group();
    const ctx = {
      scene,
      loader: { load: async () => '', release: () => undefined },
      root: undefined,
      year: '1985',
    };
    era1985.build(ctx as never);

    const stats = era1985Providers.getStats();
    expect(stats).not.toBeNull();
    expect(stats!.buildings).toBeGreaterThanOrEqual(6);
    expect(stats!.curtainWallBuildings).toBeGreaterThanOrEqual(6);
    expect(stats!.storefronts).toBeGreaterThanOrEqual(3);
    expect(stats!.billboards).toBeGreaterThanOrEqual(2);
    expect(stats!.vehicles).toBeGreaterThanOrEqual(3);
    expect(stats!.buses).toBeGreaterThanOrEqual(1); // bus or tram
    expect(stats!.pedestrians).toBeGreaterThanOrEqual(8);
    expect(stats!.signals).toBeGreaterThanOrEqual(1);
    expect(stats!.planters).toBeGreaterThanOrEqual(1);
    expect(stats!.bollards).toBeGreaterThanOrEqual(1);
    expect(stats!.graffiti).toBeGreaterThanOrEqual(1);
    expect(stats!.interactivePoints).toBeGreaterThanOrEqual(4);
    expect(stats!.disposed).toBe(false);

    // Scene graph actually attaches to the era scene root.
    expect(scene.children.length).toBeGreaterThan(0);

    era1985.dispose();
    expect(era1985Providers.getStats()).toBeNull();
  });

  it('respects the layout footprint constants', () => {
    expect(BLOCK.width).toBe(120);
    expect(BLOCK.depth).toBe(120);
    expect(STREET.laneCount).toBe(4);
    expect(SIDEWALK.width).toBe(4);
    expect(CURB.height).toBeGreaterThan(0);
  });
});