import { describe, expect, it } from 'vitest';
import { ERA_IDS, ERA_REGISTRY, getEraSpec, isTimeEra } from '../../src/engine/eras';
import type { TimeEra } from '../../src/engine/eras';
import {
  registerEraModule,
  clearEraModules,
  getEraModule,
  listEraModules,
  applyEraToModules,
} from '../../src/engine/SceneRegistry';
import type { SceneModule } from '../../src/engine/SceneRegistry';
import { Group } from 'three';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ERA_DATA } from '../../src/data/eras';

describe('shared era contract', () => {
  it('exposes the five eras in chronological order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    expect(ERA_REGISTRY.map((e) => e.year)).toEqual([1945, 1965, 1985, 2005, 2025]);
  });

  it('every registry entry has a unique id, year, label, and description', () => {
    const ids = new Set<string>();
    for (const era of ERA_REGISTRY) {
      expect(typeof era.label).toBe('string');
      expect(era.label.length).toBeGreaterThan(0);
      expect(typeof era.description).toBe('string');
      expect(era.description.length).toBeGreaterThan(0);
      expect(ids.has(era.id)).toBe(false);
      ids.add(era.id);
    }
  });

  it('getEraSpec returns the matching spec and throws for unknown ids', () => {
    expect(getEraSpec('1965').year).toBe(1965);
    expect(() => getEraSpec('9999' as never)).toThrow();
  });
});

describe('SceneRegistry pattern', () => {
  const makeModule = (): SceneModule => ({
    group: new Group(),
    update: () => undefined,
    setEra: () => undefined,
    dispose: () => undefined,
  });

  it('registers, retrieves, and lists modules by era', () => {
    clearEraModules();
    const mod = makeModule();
    registerEraModule(mod, '1985');
    expect(getEraModule('1985')).toBe(mod);
    expect(listEraModules()).toContain(mod);
    clearEraModules();
  });

  it('rejects duplicate registrations for the same era', () => {
    clearEraModules();
    registerEraModule(makeModule(), '2005');
    expect(() => registerEraModule(makeModule(), '2005')).toThrow();
    clearEraModules();
  });

  it('applies a single selected era to all modules in one pass', () => {
    clearEraModules();
    const seen: Array<{ era: string; t: number }> = [];
    const modA = makeModule();
    modA.setEra = (era, t) => seen.push({ era, t });
    const modB = makeModule();
    modB.setEra = (era, t) => seen.push({ era, t });
    registerEraModule(modA, '1945');
    registerEraModule(modB, '1965');

    applyEraToModules('1985', 0.5);

    expect(seen).toEqual([
      { era: '1985', t: 0.5 },
      { era: '1985', t: 0.5 },
    ]);
    clearEraModules();
  });
});

describe('TimeEra era datasets', () => {
  // Vitest executes from the repository root; resolve assets from cwd so the
  // check is independent of the test file location.
  const repoRoot = process.cwd();

  const allAssetPaths = (era: TimeEra): string[] => {
    const assets: string[] = [];
    assets.push(era.buildings.facadeTexture.path);
    assets.push(era.buildings.windows.shutterTexture.path);
    assets.push(era.buildings.rubbleLots.texture.path);
    for (const storefront of era.storefronts) {
      assets.push(storefront.sign.texture.path);
    }
    for (const ad of era.advertisements) {
      assets.push(ad.texture.path);
    }
    for (const prop of era.props) {
      if (prop.texture) {
        assets.push(prop.texture.path);
      }
    }
    return assets;
  };

  it('every authored dataset is a valid TimeEra for a registered era', () => {
    const ids = ERA_DATA ? Object.keys(ERA_DATA) : [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const era = ERA_DATA[id as keyof typeof ERA_DATA];
      expect(era, `missing dataset for ${id}`).toBeDefined();
      expect(isTimeEra(era)).toBe(true);
      expect(ERA_IDS).toContain((era as TimeEra).id);
      expect((era as TimeEra).year).toBe(Number((era as TimeEra).id));
    }
  });

  it('1945 dataset exists and exposes the wartime/rebuilding surface', () => {
    const era = ERA_DATA['1945'];
    expect(era).toBeDefined();
    if (!era) {
      return;
    }
    expect(era.year).toBe(1945);
    expect(era.label.length).toBeGreaterThan(0);
    expect(era.description.length).toBeGreaterThan(0);

    // Environment
    expect(era.environment.grading).toMatch(/sepia/i);
    expect(era.environment.fogStart).toBeLessThan(era.environment.fogEnd);
    expect(era.environment.streetlights.intensity).toBeGreaterThan(0);

    // Buildings: wartime austerity details
    expect(era.buildings.windows.blackoutShutters).toBe(true);
    expect(era.buildings.rubbleLots.count).toBeGreaterThan(0);
    expect(era.buildings.rubbleLots.temporaryShoring).toBe(true);

    // Vehicles: 1940s civilian + military, no modern types
    expect(era.vehicles.length).toBeGreaterThan(0);
    const kinds = era.vehicles.map((v) => v.kind);
    expect(kinds).toContain('civilian');
    expect(kinds).toContain('military');

    // Storefronts: butcher, greengrocer, cobbler, newsstand
    const storefrontKinds = era.storefronts.map((s) => s.kind);
    expect(storefrontKinds).toEqual(
      expect.arrayContaining(['butcher', 'greengrocer', 'cobbler', 'newsstand']),
    );

    // Advertisements: painted masonry + enamel
    const adKinds = era.advertisements.map((a) => a.kind);
    expect(adKinds).toContain('painted-masonry');
    expect(adKinds).toContain('enamel-sign');

    // Props: sandbags, ration posters, bicycle racks, wooden barrels, gas lamps
    const propKinds = era.props.map((p) => p.kind);
    expect(propKinds).toEqual(
      expect.arrayContaining([
        'gas-lamp',
        'sandbag-stack',
        'ration-poster',
        'bicycle-rack',
        'wooden-barrel',
      ]),
    );

    // Pedestrians: wartime civilian + uniforms
    expect(era.pedestrians.totalCount).toBeGreaterThan(0);
    const outfitCategories = era.pedestrians.outfits.map((o) => o.category);
    expect(outfitCategories).toContain('civilian');
    expect(outfitCategories).toContain('uniformed');

    // Audio: ambient, traffic, event, and radio cues
    const cueCategories = era.audio.cues.map((c) => c.category);
    expect(cueCategories).toEqual(expect.arrayContaining(['ambient', 'traffic', 'event', 'radio']));

    // Camera vantage point for the timeline slider
    expect(era.camera.position).toBeDefined();
    expect(era.camera.target).toBeDefined();
    expect(era.camera.fov).toBeGreaterThan(0);
    expect(era.camera.fov).toBeLessThan(180);
  });

  it('every referenced texture resolves to a file under src/assets/', () => {
    for (const id of Object.keys(ERA_DATA)) {
      const era = ERA_DATA[id as keyof typeof ERA_DATA] as TimeEra;
      const paths = allAssetPaths(era);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.startsWith('textures/')).toBe(true);
        const abs = join(repoRoot, 'src', 'assets', p);
        expect(existsSync(abs), `missing texture asset: ${p}`).toBe(true);
      }
    }
  });

  it('every referenced audio cue resolves to a file under src/audio/', () => {
    for (const id of Object.keys(ERA_DATA)) {
      const era = ERA_DATA[id as keyof typeof ERA_DATA] as TimeEra;
      expect(era.audio.cues.length).toBeGreaterThan(0);
      for (const cue of era.audio.cues) {
        const abs = join(repoRoot, 'src', 'audio', cue.path);
        expect(existsSync(abs), `missing audio cue: ${cue.path}`).toBe(true);
      }
    }
  });
});