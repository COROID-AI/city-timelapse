import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { eraRegistry } from '../registry';
import { era1965, era1965Providers } from '../eras/1965';
import { PALETTE, buildPedestrian, buildSedan, buildStationWagon, buildMotorbike, buildStreetlight, buildParkingMeter, buildPhoneBooth, buildMailbox, buildBusStop } from '../eras/1965.parts';

/**
 * Unit tests for the 1965 era scene content stats.
 *
 * These assert the geometry helpers and the era's registered shape directly,
 * without requiring a DOM (all canvas helpers degrade gracefully in node).
 */

describe('1965 era content stats', () => {
  it('registers era 1965 with the full lifecycle', () => {
    const content = eraRegistry.getEra('1965');
    expect(content).toBeDefined();
    expect(typeof content?.build).toBe('function');
    expect(typeof content?.update).toBe('function');
    expect(typeof content?.dispose).toBe('function');
    expect(Array.isArray(content?.interactivePoints)).toBe(true);
    expect(content?.isFastPath).toBe(true);
  });

  it('provides ≥4 interactive points with position/lookAt/label', () => {
    era1965.build({ scene: new THREE.Group(), loader: { load: async () => '', release: () => undefined }, root: { tagName: 'div' } as unknown as HTMLElement, year: '1965' });
    expect(era1965.interactivePoints.length).toBeGreaterThanOrEqual(4);
    for (const p of era1965.interactivePoints) {
      expect(p.position).toBeDefined();
      expect(p.id).toBeTruthy();
      expect(typeof p.label).toBe('string');
    }
    era1965.dispose();
  });

  it('builds ≥6 buildings, ≥3 storefronts, ≥2 billboards, ≥3 vehicles, ≥8 pedestrians', () => {
    const scene = new THREE.Group();
    era1965.build({ scene, loader: { load: async () => '', release: () => undefined }, root: { tagName: 'div' } as unknown as HTMLElement, year: '1965' });

    const count = (name: string) => {
      const out: THREE.Object3D[] = [];
      const walk = (n: THREE.Object3D) => {
        if (n.name === name) out.push(n);
        n.children.forEach(walk);
      };
      walk(scene);
      return out.length;
    };
    const findNamed = (name: string): THREE.Object3D | undefined => {
      const out: THREE.Object3D[] = [];
      const walk = (n: THREE.Object3D) => {
        if (n.name === name) out.push(n);
        n.children.forEach(walk);
      };
      walk(scene);
      return out[0];
    };
    const vehicles = findNamed('vehicles');
    const pedestrians = findNamed('pedestrians');

    expect(count('building')).toBeGreaterThanOrEqual(6);
    expect(count('storefront-diner')).toBe(1);
    expect(count('storefront-records')).toBe(1);
    expect(count('storefront-showroom')).toBe(1);
    expect(count('billboard')).toBeGreaterThanOrEqual(2);
    expect(vehicles?.children.length).toBeGreaterThanOrEqual(3);
    expect(pedestrians?.children.length).toBeGreaterThanOrEqual(8);

    era1965.dispose();
  });

  it('builds the required procedural prop helpers', () => {
    const sedan = buildSedan(PALETTE.coral);
    const wagon = buildStationWagon(PALETTE.teal);
    const bike = buildMotorbike(PALETTE.pink);
    const light = buildStreetlight();
    const meter = buildParkingMeter();
    const booth = buildPhoneBooth();
    const mailbox = buildMailbox();
    const stop = buildBusStop();
    const person = buildPedestrian(era1965Providers.outfits[0], 'suit');

    expect(sedan.children.length).toBeGreaterThan(0);
    expect(wagon.children.length).toBeGreaterThan(0);
    expect(bike.children.length).toBeGreaterThan(0);
    expect(light.children.length).toBeGreaterThan(0);
    expect(meter.children.length).toBeGreaterThan(0);
    expect(booth.children.length).toBeGreaterThan(0);
    expect(mailbox.children.length).toBeGreaterThan(0);
    expect(stop.children.length).toBeGreaterThan(0);
    expect(person.children.length).toBeGreaterThan(0);
  });
});