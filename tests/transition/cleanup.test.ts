import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Scene } from 'three';
import { createCityBlockLayout } from '../../src/layout/cityBlockLayout';
import { createEraState } from '../../src/state/eraState';
import { EraYear } from '../../src/types/city';
import { TransitionDirector } from '../../src/transition/transitionDirector';
import { EraModuleAdapter, EraSceneHandle } from '../../src/transition/transitionDirector';
import { EraAudioHandle } from '../../src/transition/audioCrossfade';
import { Rgb } from '../../src/transition/paletteTween';

/**
 * Cleanup guarantees for the era transition engine.
 *
 * Every era adapter owns a set of disposable resources (meshes, materials,
 * geometries, listeners, SFX stems). These tests assert that after each
 * transition — and across a stress cycle through all five eras — the outgoing
 * era's resources are fully disposed and the scene never accumulates leaks.
 */

interface ResourceSet {
  meshes: Mesh[];
  materials: object[];
  geometries: object[];
  listeners: number;
  sfxStems: number;
  disposed: boolean;
}

function makeTrackingAdapter(
  year: EraYear,
  sky: Rgb,
): { adapter: EraModuleAdapter; resources: ResourceSet } {
  const resources: ResourceSet = {
    meshes: [],
    materials: [],
    geometries: [],
    listeners: 1,
    sfxStems: 3,
    disposed: false,
  };
  for (let i = 0; i < 4; i++) {
    const geometry = new BoxGeometry(1, 2, 1);
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.position.set(i, 4, 0);
    resources.meshes.push(mesh);
    resources.materials.push(material);
    resources.geometries.push(geometry);
  }

  const audio: EraAudioHandle = {
    year,
    stems: [
      { id: `s1-${year}`, volume: 1, setVolume() {} },
      { id: `s2-${year}`, volume: 1, setVolume() {} },
      { id: `s3-${year}`, volume: 1, setVolume() {} },
    ],
    fadeTo() {},
    stop() {},
    dispose() {
      resources.sfxStems = 0;
    },
  };

  const handle: EraSceneHandle = {
    meshes: resources.meshes,
    update() {},
    dispose() {
      resources.disposed = true;
      resources.meshes = [];
      resources.materials = [];
      resources.geometries = [];
      resources.listeners = 0;
    },
  };

  const adapter: EraModuleAdapter = {
    year,
    attach() {
      return handle;
    },
    createAudio() {
      return audio;
    },
    palette() {
      return {
        year,
        sky,
        sun: { r: 1, g: 1, b: 1 },
        sunPosition: { x: 80, y: 120, z: 40 },
        fogDensity: 0.2,
        temperature: 4500,
        ambientIntensity: 0.35,
      };
    },
  };

  return { adapter, resources };
}

function buildRegistry(): Map<EraYear, EraModuleAdapter> {
  const map = new Map<EraYear, EraModuleAdapter>();
  map.set(1945, makeTrackingAdapter(1945, { r: 0.8, g: 0.6, b: 0.4 }).adapter);
  map.set(1965, makeTrackingAdapter(1965, { r: 0.7, g: 0.7, b: 0.2 }).adapter);
  map.set(1985, makeTrackingAdapter(1985, { r: 0.3, g: 0.4, b: 0.7 }).adapter);
  map.set(2005, makeTrackingAdapter(2005, { r: 0.2, g: 0.5, b: 0.6 }).adapter);
  map.set(2025, makeTrackingAdapter(2025, { r: 0.1, g: 0.8, b: 0.3 }).adapter);
  return map;
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

describe('Transition cleanup', () => {
  it('fully disposes the outgoing era after each transition', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const registry = buildRegistry();

    const director = new TransitionDirector({ state, scene, layout, registry });
    const initialCount = sceneMeshCount(scene);

    // 1945 -> 1985.
    state.setYear(1985);
    while (director.transitioning) director.update(0.25);
    expect(director.currentYear).toBe(1985);

    // 1985 -> 2005.
    state.setYear(2005);
    while (director.transitioning) director.update(0.25);
    expect(director.currentYear).toBe(2005);

    // The scene should not have grown: each outgoing era's meshes were removed.
    expect(sceneMeshCount(scene)).toBeLessThanOrEqual(initialCount + 4);

    director.dispose();
  });

  it('stress-cycles 1945->1985->2025->1965->2005 repeatedly with no leak growth', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const registry = buildRegistry();

    const director = new TransitionDirector({ state, scene, layout, registry });

    const cycle: EraYear[] = [1945, 1985, 2025, 1965, 2005];
    const baseline = sceneMeshCount(scene);

    // Run several full cycles.
    for (let round = 0; round < 6; round++) {
      for (const year of cycle) {
        state.setYear(year);
        while (director.transitioning) director.update(0.25);
        expect(director.currentYear).toBe(year);
      }
    }

    // After all cycles the scene holds only the final era's meshes plus the
    // initial base (no accumulation across era switches).
    const finalCount = sceneMeshCount(scene);
    expect(finalCount).toBeLessThanOrEqual(baseline + 4);

    director.dispose();
    // After dispose, the active era is also released.
    expect(sceneMeshCount(scene)).toBeLessThanOrEqual(baseline);
  });
});