import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EraRegistry, disposeEraSceneContent } from '../core/EraRegistry';
import { buildEra1945, era1945Audio, era1945Content } from './1945';

/** Max channel value (0-255) any muted-palette clothing color may reach. */
const MUTED_CHANNEL_MAX = 0xd0;

describe('era1945Content descriptor', () => {
  it('describes a complete 1945 EraContent', () => {
    expect(era1945Content.id).toBe('1945');
    expect(era1945Content.label.length).toBeGreaterThan(0);
    expect(era1945Content.description.length).toBeGreaterThan(0);

    // Buildings: low-rise wartime proportions with water towers and chimneys.
    expect(era1945Content.buildings.facadePalette.length).toBeGreaterThan(2);
    expect(era1945Content.buildings.maxHeightMeters).toBeLessThan(20);
    expect(era1945Content.buildings.minHeightMeters).toBeGreaterThan(0);
    expect(era1945Content.buildings.roofProps).toContain('water-tower');
    expect(era1945Content.buildings.roofProps).toContain('chimney');
    expect(era1945Content.buildings.windows.emissiveColor).toBe('#ffd9a0');
    expect(era1945Content.buildings.windows.litRatio).toBeLessThan(0.4);

    // Rationed fleet: boxy sedans only; no SUVs or EVs (anachronisms), and far
    // below the density of later eras.
    expect(era1945Content.vehicles.kinds).toEqual(['vintage-sedan']);
    expect(era1945Content.vehicles.kinds).not.toContain('family-suv');
    expect(era1945Content.vehicles.kinds).not.toContain('ev-capsule');
    expect(era1945Content.vehicles.density).toBeLessThan(0.6);

    // Small local shops with hand-painted signage: glow well below neon eras.
    const names = era1945Content.storefronts.names.join('|');
    expect(names).toMatch(/GROCER/i);
    expect(names).toMatch(/HARDWARE/i);
    expect(names).toMatch(/BARBER/i);
    expect(names).toMatch(/BAKERY/i);
    expect(names).toMatch(/DELICATESSEN|DELI/i);
    expect(era1945Content.storefronts.signageGlow).toBeLessThan(1);

    // Painted ads only: war bonds, soda, radio-era billboard copy; nothing animated.
    expect(era1945Content.advertisements.billboards.length).toBeGreaterThanOrEqual(3);
    for (const board of era1945Content.advertisements.billboards) {
      expect(board.animated).toBe(false);
      expect(era1945Content.advertisements.glowIntensity).toBeLessThan(1);
    }
    const adText = era1945Content.advertisements.billboards.map((b) => b.text).join('|');
    expect(adText).toMatch(/WAR BONDS/i);
    expect(adText).toMatch(/COCA-COLA|SODA/i);
    expect(adText).toMatch(/RADIO/i);

    // Pedestrians in a muted palette: no channel near white.
    expect(era1945Content.pedestrians.outfitPalette.length).toBeGreaterThanOrEqual(4);
    for (const hex of era1945Content.pedestrians.outfitPalette) {
      const match = /^#([0-9a-f]{6})$/i.exec(hex);
      expect(match, `outfit color ${hex} must be #rrggbb`).toBeTruthy();
      const channels = (match as RegExpExecArray)[1].match(/.{2}/g) as string[];
      for (const channel of channels) {
        expect(parseInt(channel, 16)).toBeLessThanOrEqual(MUTED_CHANNEL_MAX);
      }
    }

    // Gas lamps and coal smoke before the modern grid arrives.
    expect(era1945Content.ambience.streetLamps).toBe('gas-lamp');
    expect(era1945Content.ambience.particles).toBe('coal-smoke');
  });

  it('keeps the streetcar bell in the SFX profile', () => {
    expect(era1945Content.sfx.trafficProfile).toBe('wartime-rationed');
    expect(era1945Content.sfx.events).toContain('streetcar-bell');
    expect(era1945Content.sfx.musicStyle).toBe('radio-jazz');
    expect(era1945Content.sfx.eventIntervalSeconds[1]).toBeGreaterThan(
      era1945Content.sfx.eventIntervalSeconds[0],
    );
  });
});

describe('era1945Audio descriptor', () => {
  it('registers sparse traffic, trolley rumble and crowd murmur layers', () => {
    const data = era1945Audio.data as {
      ambienceLayers?: ReadonlyArray<{ id: string }>;
      oneShotEvents?: ReadonlyArray<{ id: string; kind?: string }>;
    };
    const layerIds = (data.ambienceLayers ?? []).map((layer) => layer.id);
    expect(layerIds).toContain('sparse-traffic');
    expect(layerIds).toContain('trolley-rumble');
    expect(layerIds).toContain('crowd-murmur');
    const eventKinds = (data.oneShotEvents ?? []).map((event) => event.kind);
    expect(eventKinds).toContain('streetcar-bell');
    expect(era1945Audio.ambience).toBeGreaterThan(0);
    expect(era1945Audio.ambience).toBeLessThanOrEqual(1);
    expect(era1945Audio.sfx).toBeGreaterThan(0);
    expect(era1945Audio.sfx).toBeLessThanOrEqual(1);
  });
});

describe('buildEra1945 scene bundle', () => {
  it('builds a complete procedural group without a DOM (node-safe)', () => {
    const content = buildEra1945();
    try {
      expect(content.id).toBe('1945');
      expect(content.group).toBeInstanceOf(THREE.Group);
      expect(content.group.name).toBe('era-1945');

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
        'streetcar-track',
        'overhead-wire',
        'building-brick-warehouse',
        'building-brick-tenement',
        'building-mixed-use-row',
        'building-wood-frame',
        'building-commercial-brick',
        'building-south-row',
        'vacant-lot-rubble',
        'hoarding-fence',
        'rubble-pile',
        'victory-garden',
        'building-south-warehouse',
        'water-tower',
        'chimney',
        'storefront-grocery',
        'storefront-barber-shop',
        'storefront-drug-store',
        'storefront-bakery',
        'storefront-shoe-repair',
        'storefront-hardware',
        'storefront-kosher-deli',
        'painted-sign-weinberg-grocer',
        'painted-sign-acme-hardware',
        'barber-pole',
        'wall-ad-war-bonds',
        'wall-ad-coca-cola',
        'billboard-radio-victor',
        'billboard-coca-cola',
        'newspaper-stand',
        'vehicle-streetcar',
        'vehicle-sedan',
        'vehicle-military-truck',
        'street-lamp-gas',
        'traffic-signal',
        'hydrant',
        'mailbox',
        'bench',
        'tree',
        'pedestrian-man',
        'pedestrian-woman',
        'pedestrian-child',
      ];
      for (const name of required) {
        expect(names.has(name), `missing node: ${name}`).toBe(true);
      }

      // Reasonable scene budget for a single era bundle.
      expect(meshes).toBeGreaterThan(150);
      expect(meshes).toBeLessThan(950);
    } finally {
      disposeEraSceneContent(content);
    }
  });

  it('satisfies the EraRegistry build contract under EraId 1945', () => {
    const registry = new EraRegistry();
    registry.register('1945', buildEra1945);
    const built = registry.build('1945');
    expect(built.id).toBe('1945');
    expect(built.group).toBeInstanceOf(THREE.Group);
    expect(registry.peek('1945')).toBe(built);
    expect(registry.registeredIds()).toEqual(['1945']);
    registry.dispose();
  });

  it('exposes the era audio descriptor through the built content', () => {
    const content = buildEra1945();
    try {
      expect(content.audio).toBeDefined();
      expect(content.audio?.data ? String(content.audio?.data['label'] ?? '') : '').toMatch(/1945/);
    } finally {
      disposeEraSceneContent(content);
    }
  });
});
