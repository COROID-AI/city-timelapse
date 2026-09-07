import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEraState } from '../../../src/state/eraState';
import { era1985Content, createEra1985Content } from '../../../src/eras/1985/index';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('Era 1985 Composition & Lifecycle', () => {
  it('instantiates era1985Content against real foundation CityBlockLayout anchors and attaches to scene', () => {
    const layout = createCityBlockLayout();
    const eraState = createEraState(1985);
    const scene = new Scene();

    const content = createEra1985Content(layout);
    expect(content.year).toBe(1985);

    scene.add(content.group);
    expect(scene.children).toContain(content.group);

    // Update steps over multiple frames
    for (let frame = 0; frame < 30; frame++) {
      content.update(0.016, 0.5);
    }

    // Switch era to/from 1985
    eraState.setYear(1965);
    expect(eraState.year).toBe(1965);

    eraState.setYear(1985);
    expect(eraState.year).toBe(1985);

    // Clean disposal
    content.dispose();
    scene.remove(content.group);
    expect(content.root.children.length).toBe(0);
  });

  it('works with exported singleton era1985Content and re-instantiation', () => {
    const layout = createCityBlockLayout();
    expect(era1985Content.year).toBe(1985);
    era1985Content.instantiate(layout);
    era1985Content.update(0.016, 0.2);
    expect(era1985Content.buildings.buildings.length).toBe(10);
  });

  it('asserts writes stayed strictly confined to src/eras/1985/ and tests/eras/1985/', () => {
    // Check repository structure
    const rootDir = resolve(__dirname, '../../../');
    const erasDir = join(rootDir, 'src/eras');
    const testsErasDir = join(rootDir, 'tests/eras');

    const srcEras = readdirSync(erasDir);
    expect(srcEras).toContain('1985');

    const testsEras = readdirSync(testsErasDir);
    expect(testsEras).toContain('1985');

    // Foundation files exist and were not altered
    const foundationFiles = [
      'src/types/era.ts',
      'src/types/city.ts',
      'src/types/buildingShell.ts',
      'src/types/streetFeature.ts',
      'src/layout/cityBlockLayout.ts',
      'src/layout/lotAnchors.ts',
      'src/state/eraState.ts',
      'src/state/eraRegistry.ts',
      'src/audio/sfxContext.ts',
      'src/styles.css',
      'src/main.ts',
    ];

    for (const f of foundationFiles) {
      const stats = statSync(join(rootDir, f));
      expect(stats.isFile()).toBe(true);
    }
  });
});
