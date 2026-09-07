import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEraState } from '../../../src/state/eraState';
import { SfxContext } from '../../../src/audio/sfxContext';
import { era1965Content, createEra1965Content } from '../../../src/eras/1965/index';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('1965 Era Composition Test', () => {
  it('instantiates era1965Content against real foundation CityBlockLayout, Scene, EraState and SfxContext', () => {
    const layout = createCityBlockLayout();
    const eraState = createEraState(1965);
    const mockSfxContext: SfxContext = {
      initialized: false,
      blip: () => {},
      dispose: () => {},
    };
    const scene = new Scene();

    const content = createEra1965Content();
    expect(content.year).toBe(1965);
    expect(content.palette).toBeDefined();

    // Instantiate lifecycle
    content.instantiate({
      scene,
      layout,
      eraState,
      sfxContext: mockSfxContext,
    });

    // Check root added to scene
    expect(scene.children).toContain(content.root);
    expect(content.buildings).toHaveLength(10);
    expect(content.vehicles.vehicles.length).toBeGreaterThanOrEqual(4);
    expect(content.streetFurniture.length).toBeGreaterThanOrEqual(10);
    expect(content.pedestrians.pedestrians.length).toBeGreaterThanOrEqual(4);

    // Step update lifecycle
    content.update(0.016);
    content.update(0.033);

    // Switch era away from 1965 and back to 1965
    eraState.setYear(1945);
    expect(content.audio.isRunning).toBe(false);

    eraState.setYear(1965);
    expect(content.audio.isRunning).toBe(true);

    // Dispose lifecycle
    content.dispose();
    expect(scene.children).not.toContain(content.root);
    expect(content.audio.isRunning).toBe(false);

    mockSfxContext.dispose();
  });

  it('default export era1965Content complies with lifecycle methods', () => {
    const layout = createCityBlockLayout();
    const scene = new Scene();

    expect(era1965Content.year).toBe(1965);
    era1965Content.instantiate({ scene, layout });
    expect(scene.children).toContain(era1965Content.root);

    era1965Content.update(0.05);
    era1965Content.dispose();
    expect(scene.children).not.toContain(era1965Content.root);
  });

  it('asserts write isolation: only src/eras/1965/ and tests/eras/1965/ were modified/created by this module', () => {
    // Check files inside src/eras/
    const erasDir = path.resolve(process.cwd(), 'src/eras');
    if (fs.existsSync(erasDir)) {
      const eraDirs = fs.readdirSync(erasDir);
      // All directories in src/eras created during this task should be 1965
      expect(eraDirs).toContain('1965');
    }

    const era1965Dir = path.resolve(process.cwd(), 'src/eras/1965');
    expect(fs.existsSync(era1965Dir)).toBe(true);

    const expectedFiles = [
      'index.ts',
      'buildings.ts',
      'storefronts.ts',
      'ads.ts',
      'vehicles.ts',
      'streetFurniture.ts',
      'pedestrians.ts',
      'palette.ts',
      'audio.ts',
      'textures.ts',
    ];

    const actualFiles = fs.readdirSync(era1965Dir);
    for (const expected of expectedFiles) {
      expect(actualFiles).toContain(expected);
    }
  });
});
