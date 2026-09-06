import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { eraRegistry } from '../registry';
import { era1965, era1965Providers } from '../eras/1965';

/**
 * Composition test for the 1965 era module.
 *
 * Verifies that importing the module registers era '1965', that building the
 * scene yields the required mid-century content counts, that update mutates
 * positions, and that dispose detaches and releases resources.
 */

/** A headless scene graph root that supports add/remove and child traversal. */
const makeStubContext = () => {
  const scene = new THREE.Group();
  const loader = {
    load: async () => '',
    release: () => undefined,
  };
  const root = { tagName: 'div' } as unknown as HTMLElement;
  return {
    context: { scene, loader, root, year: '1965' as const },
    scene,
  };
};

/** Recursively collect meshes/groups by name. */
const collectByName = (node: THREE.Object3D, name: string, out: THREE.Object3D[] = []): THREE.Object3D[] => {
  if (node.name === name) {
    out.push(node);
  }
  for (const child of node.children) {
    collectByName(child, name, out);
  }
  return out;
};

describe('1965 era composition', () => {
  it('registers era 1965 on import', () => {
    expect(eraRegistry.getEra('1965')).toBeDefined();
    expect(era1965.isFastPath).toBe(true);
  });

  it('builds a full mid-century scene with the required content stats', () => {
    const { context, scene } = makeStubContext();
    era1965.build(context);

    // Buildings (≥6) + storefronts (3, which are also buildings).
    const buildings = collectByName(scene, 'building');
    const storefronts = [
      collectByName(scene, 'storefront-diner'),
      collectByName(scene, 'storefront-records'),
      collectByName(scene, 'storefront-showroom'),
    ];
    expect(buildings.length).toBeGreaterThanOrEqual(6);
    for (const s of storefronts) {
      expect(s.length).toBe(1);
    }

    // Billboards (≥2).
    expect(collectByName(scene, 'billboard').length).toBeGreaterThanOrEqual(2);

    // Vehicles (≥3).
    expect(collectByName(scene, 'vehicles')).toHaveLength(1);
    const vehicles = collectByName(scene, 'vehicles')[0];
    expect(vehicles.children.length).toBeGreaterThanOrEqual(3);

    // Pedestrians (≥8).
    expect(collectByName(scene, 'pedestrians')).toHaveLength(1);
    const pedestrians = collectByName(scene, 'pedestrians')[0];
    expect(pedestrians.children.length).toBeGreaterThanOrEqual(8);

    // Street furniture.
    expect(collectByName(scene, 'streetlight').length).toBeGreaterThanOrEqual(1);
    expect(collectByName(scene, 'parking-meter').length).toBeGreaterThanOrEqual(1);
    expect(collectByName(scene, 'bus-stop')).toHaveLength(1);
    expect(collectByName(scene, 'phone-booth')).toHaveLength(1);
    expect(collectByName(scene, 'mailbox')).toHaveLength(1);

    // Interactive points (≥4).
    expect(era1965.interactivePoints.length).toBeGreaterThanOrEqual(4);
    for (const point of era1965.interactivePoints) {
      expect(point.position).toBeDefined();
      expect(point.id).toBeTruthy();
      expect(point.label).toBeTruthy();
    }

    // Clean up.
    era1965.dispose();
  });

  it('update mutates pedestrian and vehicle positions', () => {
    const { context, scene } = makeStubContext();
    era1965.build(context);

    const pedestrians = collectByName(scene, 'pedestrians')[0];
    const vehicles = collectByName(scene, 'vehicles')[0];
    const pedBefore = pedestrians.children.map((c) => c.position.y);
    const vehBefore = vehicles.children.map((c) => c.position.z);

    era1965.update(0.5);
    era1965.update(0.5);

    const pedAfter = pedestrians.children.map((c) => c.position.y);
    const vehAfter = vehicles.children.map((c) => c.position.z);

    const pedMoved = pedBefore.some((v, i) => Math.abs(pedAfter[i] - v) > 1e-4);
    const vehMoved = vehBefore.some((v, i) => Math.abs(vehAfter[i] - v) > 1e-4);
    expect(pedMoved).toBe(true);
    expect(vehMoved).toBe(true);

    era1965.dispose();
  });

  it('dispose detaches the scene graph and clears interactive points', () => {
    const { context, scene } = makeStubContext();
    era1965.build(context);
    expect(scene.children.length).toBeGreaterThan(0);
    expect(era1965.interactivePoints.length).toBeGreaterThanOrEqual(4);

    era1965.dispose();

    // Root group removed from the scene.
    expect(scene.children.some((c) => c.name === 'era-1965')).toBe(false);
    expect(era1965.interactivePoints).toEqual([]);

    // Dispose is idempotent.
    era1965.dispose();
  });

  it('exposes 1965 mesh providers for the simulation', () => {
    expect(era1965Providers.outfits.length).toBeGreaterThanOrEqual(8);
    expect(typeof era1965Providers.buildPedestrian).toBe('function');
    expect(typeof era1965Providers.vehicleBuilders.sedan).toBe('function');
    expect(typeof era1965Providers.vehicleBuilders.stationWagon).toBe('function');
    expect(typeof era1965Providers.vehicleBuilders.motorbike).toBe('function');
  });
});