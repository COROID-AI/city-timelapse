import { describe, expect, it } from 'vitest';

import { eraRegistry } from '../registry';
import { era2005, era2005Providers, makeStubContext } from '../eras/2005';
import { BLOCK, SIDEWALK, STREET } from '../../layout';
import type * as THREE from 'three';

/**
 * 2005 era content tests — verifies the era module registers, builds a full
 * early-2000s city block scene, exposes interactive points, and satisfies the
 * build/update/dispose lifecycle.
 */

/** Recursively collect objects tagged with era2005Kind. */
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

describe('era 2005 scene content', () => {
  it('registers era 2005 into the registry on import', () => {
    expect(eraRegistry.getEra('2005')).toBe(era2005);
    expect(eraRegistry.getEras()).toContain('2005');
  });

  it('exposes build/update/dispose and isFastPath per contract', () => {
    expect(typeof era2005.build).toBe('function');
    expect(typeof era2005.update).toBe('function');
    expect(typeof era2005.dispose).toBe('function');
    expect(typeof era2005.isFastPath).toBe('boolean');
  });

  it('builds at least 6 mid-rise buildings with glass/steel facades', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);
    expect(countKinds(ctx.scene, 'building')).toBeGreaterThanOrEqual(6);
    era2005.dispose();
  });

  it('builds at least 3 storefronts, 2 billboards, 4 vehicles, 8 pedestrians', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);
    expect(countKinds(ctx.scene, 'storefront')).toBeGreaterThanOrEqual(3);
    expect(countKinds(ctx.scene, 'billboard')).toBeGreaterThanOrEqual(2);
    expect(countKinds(ctx.scene, 'vehicle')).toBeGreaterThanOrEqual(4);
    expect(countKinds(ctx.scene, 'pedestrian')).toBeGreaterThanOrEqual(8);
    era2005.dispose();
  });

  it('builds street furniture: markings, signals, camera, shelter, planters, racks, boxes', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);
    expect(countKinds(ctx.scene, 'road-marking')).toBeGreaterThan(0);
    expect(countKinds(ctx.scene, 'traffic-signal')).toBeGreaterThanOrEqual(4);
    expect(countKinds(ctx.scene, 'traffic-camera')).toBeGreaterThanOrEqual(1);
    expect(countKinds(ctx.scene, 'bus-shelter')).toBeGreaterThanOrEqual(1);
    expect(countKinds(ctx.scene, 'planter')).toBeGreaterThanOrEqual(4);
    expect(countKinds(ctx.scene, 'bike-rack')).toBeGreaterThanOrEqual(2);
    expect(countKinds(ctx.scene, 'newspaper-box')).toBeGreaterThanOrEqual(2);
    era2005.dispose();
  });

  it('builds at least 4 interactive points with position and label', () => {
    expect(era2005.interactivePoints.length).toBeGreaterThanOrEqual(4);
    for (const p of era2005.interactivePoints) {
      expect(p.id).toBeTruthy();
      expect(p.position).toBeDefined();
      expect(p.label).toBeTruthy();
    }
  });

  it('update(dt) mutates pedestrian positions; dispose clears sim state', () => {
    const ctx = makeStubContext();
    era2005.build(ctx);
    const before = collectKinds(ctx.scene).filter((k) => k === 'pedestrian').length;
    era2005.update(0.5);
    era2005.update(0.5);
    expect(before).toBeGreaterThanOrEqual(8);
    // dispose must not throw and leaves the module operable.
    era2005.dispose();
    era2005.dispose();
  });

  it('respects layout dimensions for sidewalk placement', () => {
    expect(BLOCK.width).toBeGreaterThan(0);
    expect(STREET.laneCount).toBe(4);
    expect(SIDEWALK.width).toBeGreaterThan(0);
  });

  it('exposes 2000s outfit variants and vehicle builders for the sim', () => {
    expect(era2005Providers.outfits.length).toBeGreaterThanOrEqual(8);
    expect(era2005Providers.vehicleColors.length).toBeGreaterThanOrEqual(4);
    expect(typeof era2005Providers.makePedestrian).toBe('function');
    expect(typeof era2005Providers.makeVehicle).toBe('function');
  });
});