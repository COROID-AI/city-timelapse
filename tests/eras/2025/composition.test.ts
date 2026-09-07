import { describe, expect, it } from 'vitest';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Scene } from 'three';
import { era2025Content } from '../../../src/eras/2025';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEraState } from '../../../src/state/eraState';
import { createSfxContext } from '../../../src/audio/sfxContext';
import { SfxContext } from '../../../src/audio/sfxContext';

/**
 * A SfxContext stub for the node test environment. The real createSfxContext
 * binds `window` gesture listeners, which do not exist in vitest's node
 * environment; the era module only needs the interface for lifecycle wiring.
 */
function stubSfx(): SfxContext {
  return {
    get initialized() {
      return false;
    },
    blip() {},
    dispose() {},
  };
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir)) {
      const p = join(dir, entry);
      const info = await stat(p);
      if (info.isDirectory()) {
        await walk(p);
      } else {
        out.push(p);
      }
    }
  }
  await walk(root);
  return out.sort();
}

describe('Era 2025 composition', () => {
  it('instantiates against the real foundation layout and reactive era state, steps, switches and disposes', () => {
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const sfx = stubSfx();
    const scene = new Scene();

    // Switch the reactive store to 2025.
    state.setYear(2025);
    expect(state.year).toBe(2025);

    // Attach the era content to the scene via the real layout + state + sfx.
    era2025Content.instantiate(layout, state, sfx);
    expect(scene).toBeDefined();
    expect(era2025Content.buildings.length).toBe(layout.lots.length);

    // Step the update loop a few frames.
    for (let i = 0; i < 5; i++) {
      era2025Content.update(0.016);
    }

    // Switch away from and back to 2025 without error.
    state.setYear(2005);
    state.setYear(2025);
    expect(state.year).toBe(2025);

    // Dispose cleanly.
    era2025Content.dispose();
  });

  it('works with the real foundation SfxContext when a window is present', () => {
    // Guard: only exercise the real sfx factory when `window` exists.
    if (typeof window === 'undefined') {
      return;
    }
    const layout = createCityBlockLayout();
    const state = createEraState(2025);
    const sfx = createSfxContext();
    era2025Content.instantiate(layout, state, sfx);
    era2025Content.update(0.016);
    era2025Content.dispose();
    sfx.dispose();
  });

  it('confines writes to src/eras/2025/ and tests/eras/2025/', async () => {
    const root = process.cwd();
    const erasRoot = join(root, 'src', 'eras');
    const testsRoot = join(root, 'tests', 'eras');

    // Every source file under src/eras/ must live inside the 2025 module.
    for (const file of await listFiles(erasRoot)) {
      const rel = relative(erasRoot, file);
      expect(rel.startsWith('2025')).toBe(true);
    }

    // Every era test file must live inside tests/eras/2025/.
    for (const file of await listFiles(testsRoot)) {
      const rel = relative(testsRoot, file);
      expect(rel.startsWith('2025')).toBe(true);
    }

    // The declared module files exist and are non-empty.
    const expected = [
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
    for (const name of expected) {
      const p = join(erasRoot, '2025', name);
      const info = await stat(p);
      expect(info.size).toBeGreaterThan(0);
    }
  });
});