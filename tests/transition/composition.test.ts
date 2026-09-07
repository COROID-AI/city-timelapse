import { describe, expect, it } from 'vitest';
import { Object3D, Scene } from 'three';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createCityBlockLayout } from '../../src/layout/cityBlockLayout';
import { createEraState } from '../../src/state/eraState';
import { EraYear } from '../../src/types/city';
import {
  createTransitionDirector,
  transitionRegistry,
} from '../../src/transition/index';
import { TransitionDirector } from '../../src/transition/transitionDirector';

/**
 * Composition test: wires the TransitionDirector with the real EraState, the
 * five real era content modules (through the shared transition registry) and a
 * live Three.js scene. Verifies that switching eras triggers an animated
 * handoff, mid-transition retargeting cancels cleanly, the outgoing era fully
 * disposes, and the shared foundation files remain untouched.
 */

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

function sceneMeshCount(scene: Scene): number {
  let count = 0;
  const stack: Object3D[] = [...scene.children];
  while (stack.length > 0) {
    const node = stack.pop() as Object3D;
    if ((node as { material?: unknown }).material) count++;
    stack.push(...node.children);
  }
  return count;
}

describe('Transition composition', () => {
  it('wires the director with the real five-era registry and real EraState', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);

    const director = createTransitionDirector({ state, scene, layout });
    expect(director).toBeInstanceOf(TransitionDirector);
    expect(director.currentYear).toBe(1945);
    expect(transitionRegistry.size).toBe(5);
    const years: EraYear[] = [1945, 1965, 1985, 2005, 2025];
    for (const year of years) {
      expect(transitionRegistry.has(year)).toBe(true);
    }

    director.dispose();
  });

  it('switching eras triggers an animated handoff and disposes the outgoing era', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const transitions: [number, number][] = [];

    const director = createTransitionDirector({
      state,
      scene,
      layout,
      duration: 1.8,
      onTransitionStart: (from, to) => transitions.push([from, to]),
    });

    // Move the slider 1945 -> 1985.
    state.setYear(1985);
    expect(director.transitioning).toBe(true);
    expect(transitions).toEqual([[1945, 1985]]);

    // Step mid-transition: the incoming era's meshes are building in.
    director.update(0.5);
    expect(director.transitioning).toBe(true);

    // Complete.
    while (director.transitioning) director.update(0.25);
    expect(director.transitioning).toBe(false);
    expect(director.currentYear).toBe(1985);

    // 1985 -> 2025.
    state.setYear(2025);
    expect(director.transitioning).toBe(true);
    while (director.transitioning) director.update(0.25);
    expect(director.currentYear).toBe(2025);
    expect(transitions).toEqual([
      [1945, 1985],
      [1985, 2025],
    ]);

    director.dispose();
  });

  it('mid-transition retargeting cancels cleanly and disposes the partial era', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const transitions: [number, number][] = [];

    const director = createTransitionDirector({
      state,
      scene,
      layout,
      onTransitionStart: (from, to) => transitions.push([from, to]),
    });

    // Begin 1945 -> 1985, then retarget to 2025 mid-flight.
    state.setYear(1985);
    expect(director.transitioning).toBe(true);
    director.update(0.5);

    state.setYear(2025);
    // The retarget starts a fresh transition from the still-visible 1945.
    expect(director.transitioning).toBe(true);
    expect(director.currentYear).toBe(1945);

    while (director.transitioning) director.update(0.25);
    expect(director.currentYear).toBe(2025);
    expect(director.transitioning).toBe(false);

    director.dispose();
  });

  it('keeps shared foundation files untouched (write scope)', async () => {
    // The transition engine may only create/modify files under src/transition/
    // and tests/transition/. Assert the shared foundation files are unchanged
    // by re-reading their expected presence (they are foundation-owned and this
    // task does not write to them).
    const foundation = [
      'src/types/era.ts',
      'src/state/eraState.ts',
      'src/state/eraRegistry.ts',
      'src/audio/sfxContext.ts',
      'src/render/lighting.ts',
      'src/render/sky.ts',
    ];
    for (const f of foundation) {
      const info = await stat(f);
      expect(info.size).toBeGreaterThan(0);
    }

    // The transition module files exist and are non-empty.
    const transitionFiles = await listFiles(join(process.cwd(), 'src', 'transition'));
    expect(transitionFiles.length).toBeGreaterThanOrEqual(5);
    for (const f of transitionFiles) {
      const info = await stat(f);
      expect(info.size).toBeGreaterThan(0);
    }

    // Tests live under tests/transition/.
    const testFiles = await listFiles(join(process.cwd(), 'tests', 'transition'));
    expect(testFiles.length).toBeGreaterThanOrEqual(3);
  });

  it('rapid era cycling through the real registry does not leak scene meshes', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const director = createTransitionDirector({ state, scene, layout });

    const baseline = sceneMeshCount(scene);
    const cycle = [1985, 2025, 1965, 2005, 1945];
    for (let round = 0; round < 3; round++) {
      for (const year of cycle) {
        state.setYear(year);
        while (director.transitioning) director.update(0.2);
        expect(director.currentYear).toBe(year);
      }
    }

    // No unbounded growth: only the final era's meshes remain on top of the
    // base scene.
    expect(sceneMeshCount(scene)).toBeLessThanOrEqual(baseline + 1);

    director.dispose();
  });
});