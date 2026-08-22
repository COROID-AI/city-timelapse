/**
 * Fallback-path tests: the composer module promise rejects — exactly like a
 * failed dynamic import in production — so createPostFX must still hand back
 * a working direct-rendering API and the scene keeps displaying through
 * plain renderer.render().
 */

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createPostFX } from '../src/scene/postfx';
import type { ComposerModules } from '../src/scene/postfx';

const MODULE_LOAD_FAILURE = new Error('Simulated EffectComposer module load failure');

/** Rejected module promise with its unhandled-rejection warning defused. */
function failingModules(): Promise<ComposerModules> {
  const promise = Promise.reject<ComposerModules>(MODULE_LOAD_FAILURE);
  promise.catch(() => {});
  return promise;
}

function createStubRenderer(): THREE.WebGLRenderer {
  return {
    render: vi.fn(),
    setSize: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
}

/** Lets the bootstrap's rejection path settle deterministically. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createPostFX when composer modules fail to load', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('still returns the full render/resize/dispose API shape', () => {
    const api = createPostFX(createStubRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: failingModules(),
    });

    expect(Object.keys(api).sort()).toEqual(['dispose', 'render', 'resize']);
    expect(typeof api.render).toBe('function');
    expect(typeof api.resize).toBe('function');
    expect(typeof api.dispose).toBe('function');

    api.dispose();
  });

  it('render() delegates straight to renderer.render(scene, camera)', async () => {
    const renderer = createStubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const api = createPostFX(renderer, scene, camera, { modules: failingModules() });

    await flushMicrotasks();

    api.render();
    api.render();

    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenLastCalledWith(scene, camera);
    // Exactly one warning for the failed load, no spam afterwards.
    expect(warnSpy).toHaveBeenCalledTimes(1);

    api.dispose();
  });

  it('resize() and dispose() remain safe without a composer', async () => {
    const renderer = createStubRenderer();
    const api = createPostFX(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), {
      modules: failingModules(),
    });

    api.resize(800, 600);
    api.resize(-1, 0);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 600, false);

    api.dispose();
    api.dispose();

    // Renders after dispose are inert no-ops.
    expect(() => api.render()).not.toThrow();
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
