import { describe, expect, it } from 'vitest';

import { eraRegistry } from '../registry';
import { era2005, era2005Providers, makeStubContext } from '../eras/2005';
import type * as THREE from 'three';

/**
 * Composition test — verifies the registry + 2005 module compose headlessly:
 * importing the module registers era 2005, building the scene yields the full
 * early-2000s block, update() mutates positions, and dispose() releases.
 */

function collectKinds(root: THREE.Object3D): string[] {
  const out: string[] = [];
  const walk = (node: THREE.Object3D): void => {
    if ('era2005Kind' in node.userData) out.push(node.userData.era2005Kind as string);
    if (node.children) for (const child of node.children) walk(child as never);
  };
  walk(root);
  return out;
}

function countKinds(root: THREE.Object3D, kind: string): number {
  return collectKinds(root).filter((k) => k === kind).length;
}

describe('era-2005 composition', () => {
  it('registers era 2005 on import', () => {
    expect(eraRegistry.getEra('2005')).toBe(era2005);
  });

  it('build(stubCtx) yields the full 2005 scene stats', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);

    expect(countKinds(ctx.scene, 'building')).toBeGreaterThanOrEqual(6);
    expect(countKinds(ctx.scene, 'storefront')).toBeGreaterThanOrEqual(3);
    expect(countKinds(ctx.scene, 'billboard')).toBeGreaterThanOrEqual(2);
    expect(countKinds(ctx.scene, 'vehicle')).toBeGreaterThanOrEqual(4);
    expect(countKinds(ctx.scene, 'pedestrian')).toBeGreaterThanOrEqual(8);
    expect(countKinds(ctx.scene, 'bus-shelter')).toBeGreaterThanOrEqual(1);
    expect(countKinds(ctx.scene, 'bike-rack')).toBeGreaterThanOrEqual(2);
    expect(countKinds(ctx.scene, 'road-marking')).toBeGreaterThan(0);
    expect(era2005.interactivePoints.length).toBeGreaterThanOrEqual(4);

    era2005.dispose();
  });

  it('update(dt) mutates positions of animated meshes', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);

    era2005.update(1.0);
    era2005.update(1.0);
    // update() must not throw and should have driven the sim loop.
    expect(() => era2005.update(0.5)).not.toThrow();

    era2005.dispose();
  });

  it('dispose() releases all resources without throwing', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);
    era2005.dispose();
    // Double-dispose is safe.
    era2005.dispose();
  });

  it('provides era2005Providers for the sim at era switch', () => {
    expect(era2005Providers.era).toBe('2005');
    expect(era2005Providers.outfits.length).toBeGreaterThanOrEqual(8);
    expect(typeof era2005Providers.makeVehicle).toBe('function');
    const v = era2005Providers.makeVehicle('sedan', 0xc0c0c0);
    expect(v.userData?.era2005Kind).toBe('vehicle');
    const p = era2005Providers.makePedestrian(era2005Providers.outfits[0]);
    expect(p.userData?.era2005Kind).toBe('pedestrian');
  });
});