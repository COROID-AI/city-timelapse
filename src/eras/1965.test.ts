import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EraRegistry, disposeEraSceneContent } from '../core/EraRegistry';
import { buildEra1965, era1965Audio, era1965Content } from './1965';

describe('era1965Content descriptor', () => {
  it('describes a complete 1965 EraContent', () => {
    expect(era1965Content.id).toBe('1965');
    expect(era1965Content.label.length).toBeGreaterThan(0);
    expect(era1965Content.description.length).toBeGreaterThan(0);

    // Buildings: mid-century low-rises with early rooftop plant.
    expect(era1965Content.buildings.facadePalette.length).toBeGreaterThan(2);
    expect(era1965Content.buildings.roofProps).toContain('ac-unit');
    expect(era1965Content.buildings.windows.emissiveColor).toBe('#ffe9b8');

    // '60s fleet: chrome cruisers + station wagons; no SUVs or EVs (anachronisms).
    expect(era1965Content.vehicles.kinds).toContain('chrome-cruiser');
    expect(era1965Content.vehicles.kinds).toContain('boxy-wagon');
    expect(era1965Content.vehicles.kinds).not.toContain('family-suv');
    expect(era1965Content.vehicles.kinds).not.toContain('ev-capsule');

    // Neon-era retail: diner + record shop, glowing signage.
    const names = era1965Content.storefronts.names.join('|');
    expect(names).toMatch(/DINER/i);
    expect(names).toMatch(/RECORDS/i);
    expect(era1965Content.storefronts.signageGlow).toBeGreaterThan(1);

    // Painted billboards carrying printed posters: static copy, soda + cigarette ads.
    expect(era1965Content.advertisements.billboards.length).toBeGreaterThanOrEqual(3);
    for (const board of era1965Content.advertisements.billboards) {
      expect(board.animated).toBe(false);
    }
    const adText = era1965Content.advertisements.billboards.map((b) => b.text).join('|');
    expect(adText).toMatch(/SODA/i);
    expect(adText).toMatch(/SMOKE|CIGARETTE|CHESTERFIELD/i);

    // Brighter pedestrian palette.
    expect(era1965Content.pedestrians.outfitPalette.length).toBeGreaterThanOrEqual(4);

    expect(era1965Content.ambience.streetLamps).toBe('cobra-neon');
  });

  it('replaces the streetcar with the bus in the SFX profile', () => {
    expect(era1965Content.sfx.trafficProfile).toBe('postwar-boom');
    expect(era1965Content.sfx.events).not.toContain('streetcar-bell');
    expect(era1965Content.sfx.events.length).toBeGreaterThan(0);
    expect(era1965Content.sfx.musicStyle).toBe('surf-rock');
    expect(era1965Content.sfx.eventIntervalSeconds[1]).toBeGreaterThan(
      era1965Content.sfx.eventIntervalSeconds[0],
    );
  });
});

describe('era1965Audio descriptor', () => {
  it('registers traffic hum, bus engine and diner chatter layers', () => {
    const data = era1965Audio.data as {
      ambienceLayers?: ReadonlyArray<{ id: string }>;
    };
    const ids = (data.ambienceLayers ?? []).map((layer) => layer.id);
    expect(ids).toContain('traffic-hum');
    expect(ids).toContain('bus-engine');
    expect(ids).toContain('diner-chatter');
    expect(era1965Audio.ambience).toBeGreaterThan(0);
    expect(era1965Audio.ambience).toBeLessThanOrEqual(1);
    expect(era1965Audio.sfx).toBeGreaterThan(0);
    expect(era1965Audio.sfx).toBeLessThanOrEqual(1);
  });
});

describe('buildEra1965 scene bundle', () => {
  it('builds a complete procedural group without a DOM (node-safe)', () => {
    const content = buildEra1965();
    try {
      expect(content.id).toBe('1965');
      expect(content.group).toBeInstanceOf(THREE.Group);
      expect(content.group.name).toBe('era-1965');

      const names = new Set<string>();
      let meshes = 0;
      content.group.traverse((object) => {
        names.add(object.name);
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          meshes += 1;
          expect(mesh.geometry).toBeDefined();
          expect(mesh.material).toBeDefined();
        }
      });

      const required = [
        'building-glass-office',
        'building-brick-renovated',
        'building-midcentury-a',
        'building-south-brick',
        'building-midcentury-c',
        'storefront-diner',
        'storefront-record-shop',
        'storefront-drug-store',
        'parking-lot',
        'vehicle-transit-bus',
        'vehicle-chrome-cruiser',
        'vehicle-boxy-wagon',
        'vehicle-delivery-van',
        'billboard-print-poster',
        'wall-ad-soda',
        'wall-ad-cigarettes',
        'sign-drive-in-pylon',
        'sign-parking',
        'street-lamp-cobra',
        'traffic-signal',
        'bus-shelter',
        'phone-booth',
        'hydrant',
        'mailbox',
        'tree',
        'bench',
        'pedestrian-woman',
        'pedestrian-man',
        'track-repair-seam',
        'neon-sign-starlite-diner',
        'neon-sign-spin-records',
      ];
      for (const name of required) {
        expect(names.has(name), `missing node: ${name}`).toBe(true);
      }

      // Reasonable scene budget for a single era bundle.
      expect(meshes).toBeGreaterThan(120);
      expect(meshes).toBeLessThan(800);
    } finally {
      disposeEraSceneContent(content);
    }
  });

  it('satisfies the EraRegistry build contract under EraId 1965', () => {
    const registry = new EraRegistry();
    registry.register('1965', buildEra1965);
    const built = registry.build('1965');
    expect(built.id).toBe('1965');
    expect(built.group).toBeInstanceOf(THREE.Group);
    expect(registry.peek('1965')).toBe(built);
    expect(registry.registeredIds()).toEqual(['1965']);
    registry.dispose();
  });
});
