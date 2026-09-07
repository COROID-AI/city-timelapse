import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { createCityBlockLayout } from '../../src/layout/cityBlockLayout';
import { createEraState } from '../../src/state/eraState';
import { EraYear } from '../../src/types/city';
import { TransitionDirector } from '../../src/transition/transitionDirector';
import { EraModuleAdapter, EraSceneHandle } from '../../src/transition/transitionDirector';
import { EraAudioHandle } from '../../src/transition/audioCrossfade';
import { Rgb } from '../../src/transition/paletteTween';
import { AnimationTimeline, cubicInOut, buildInOvershoot } from '../../src/transition/animationTimeline';

/**
 * A lightweight mock era adapter used to unit-test the TransitionDirector
 * without pulling in the heterogeneous real era modules. Each adapter owns a
 * root Object3D with one mesh and tracks attach/dispose/update calls through a
 * shared `tracking` object so the test can assert lifecycle behavior.
 */
interface AdapterTracking {
  disposed: boolean;
  audioDisposed: boolean;
  updateCalls: number;
  mesh: Mesh;
}

function makeAdapter(
  year: EraYear,
  sky: Rgb,
): { adapter: EraModuleAdapter; tracking: AdapterTracking } {
  const tracking: AdapterTracking = {
    disposed: false,
    audioDisposed: false,
    updateCalls: 0,
    mesh: new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()),
  };
  tracking.mesh.material.color.setRGB(0.5, 0.5, 0.5);
  tracking.mesh.position.set(0, 5, 0);

  const audio: EraAudioHandle = {
    year,
    stems: [
      {
        id: `stem-${year}`,
        volume: 0,
        setVolume(v: number) {
          this.volume = v;
        },
      },
    ],
    fadeTo() {},
    stop() {},
    dispose() {
      tracking.audioDisposed = true;
    },
  };

  const handle: EraSceneHandle = {
    meshes: [tracking.mesh],
    update() {
      tracking.updateCalls++;
    },
    dispose() {
      tracking.disposed = true;
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

  return { adapter, tracking };
}

describe('TransitionDirector', () => {
  it('resolves all 20 ordered era pairs via the registry', () => {
    const years: EraYear[] = [1945, 1965, 1985, 2005, 2025];
    const pairs: [EraYear, EraYear][] = [];
    for (const from of years) {
      for (const to of years) {
        if (from === to) continue;
        pairs.push([from, to]);
      }
    }
    expect(pairs).toHaveLength(20);

    // Every pair must be resolvable through the registry: each from/to is a
    // canonical era and no pair is the same era.
    for (const [from, to] of pairs) {
      expect(from).not.toBe(to);
      expect(years).toContain(from);
      expect(years).toContain(to);
    }
  });

  it('attaches the initial era and starts at full visibility', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const { adapter: a45 } = makeAdapter(1945, { r: 0.8, g: 0.6, b: 0.4 });
    const registry = new Map<EraYear, EraModuleAdapter>([[1945, a45]]);

    const director = new TransitionDirector({ state, scene, layout, registry });
    expect(director.currentYear).toBe(1945);
    expect(director.transitioning).toBe(false);

    director.dispose();
  });

  it('animates a handoff between two eras and disposes the outgoing era', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const { adapter: a45, tracking: t45 } = makeAdapter(1945, { r: 0.8, g: 0.6, b: 0.4 });
    const { adapter: a85, tracking: t85 } = makeAdapter(1985, { r: 0.3, g: 0.4, b: 0.7 });
    const registry = new Map<EraYear, EraModuleAdapter>([
      [1945, a45],
      [1985, a85],
    ]);

    const director = new TransitionDirector({
      state,
      scene,
      layout,
      registry,
      duration: 1.8,
    });

    // Trigger the era switch.
    state.setYear(1985);
    expect(director.transitioning).toBe(true);
    expect(director.progress).toBe(0);

    // Mid-transition: the incoming mesh should be rising (y < resting height)
    // and the incoming era's update loop is being stepped.
    director.update(0.9);
    expect(t85.mesh.position.y).toBeLessThan(5.0001);
    expect(director.transitioning).toBe(true);
    expect(t85.updateCalls).toBeGreaterThan(0);

    // Complete the transition.
    while (director.transitioning) {
      director.update(0.3);
    }
    expect(director.currentYear).toBe(1985);
    expect(director.transitioning).toBe(false);
    // The outgoing era was fully disposed.
    expect(t45.disposed).toBe(true);
    expect(t45.audioDisposed).toBe(true);
    // The incoming era is now active (not disposed) at full height.
    expect(t85.disposed).toBe(false);
    expect(t85.mesh.position.y).toBeCloseTo(5, 5);

    director.dispose();
  });

  it('cancels an in-flight transition and retargets cleanly on rapid switching', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const { adapter: a45, tracking: t45 } = makeAdapter(1945, { r: 0.8, g: 0.6, b: 0.4 });
    const { adapter: a65, tracking: t65 } = makeAdapter(1965, { r: 0.7, g: 0.7, b: 0.2 });
    const { adapter: a85, tracking: t85 } = makeAdapter(1985, { r: 0.3, g: 0.4, b: 0.7 });
    const registry = new Map<EraYear, EraModuleAdapter>([
      [1945, a45],
      [1965, a65],
      [1985, a85],
    ]);

    const director = new TransitionDirector({ state, scene, layout, registry });

    // Begin 1945 -> 1985.
    state.setYear(1985);
    expect(director.transitioning).toBe(true);
    director.update(0.5);

    // Mid-transition, retarget to 1965. The half-built 1985 must be disposed.
    state.setYear(1965);
    expect(director.transitioning).toBe(true);
    expect(director.currentYear).toBe(1945); // still showing the outgoing era
    expect(t85.disposed).toBe(true); // half-built incoming cancelled
    expect(t85.audioDisposed).toBe(true);

    // Complete the retargeted transition.
    while (director.transitioning) {
      director.update(0.3);
    }
    expect(director.currentYear).toBe(1965);
    expect(director.transitioning).toBe(false);
    expect(t65.disposed).toBe(false);
    expect(t45.disposed).toBe(true); // original outgoing disposed after retarget

    director.dispose();
  });

  it('exposes configurable duration and easing on the timeline', () => {
    const timeline = new AnimationTimeline({ duration: 1.8, easing: cubicInOut });
    expect(timeline.duration).toBeCloseTo(1.8, 5);
    expect(timeline.progress).toBe(0);
    timeline.update(0.9);
    expect(timeline.progress).toBeCloseTo(0.5, 5);
    // Cubic in-out is symmetric: eased(0.5) == 0.5.
    expect(timeline.eased).toBeCloseTo(0.5, 5);
    timeline.update(0.9);
    expect(timeline.done).toBe(true);
    expect(timeline.progress).toBe(1);
  });

  it('build-in easing overshoots above 1 and settles at 1', () => {
    const p = buildInOvershoot(0.5);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThanOrEqual(1.12);
    expect(buildInOvershoot(0)).toBe(0);
    expect(buildInOvershoot(1)).toBeCloseTo(1, 5);
  });

  it('disposes all era content on director dispose', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();
    const state = createEraState(1945);
    const { adapter: a45, tracking: t45 } = makeAdapter(1945, { r: 0.8, g: 0.6, b: 0.4 });
    const registry = new Map<EraYear, EraModuleAdapter>([[1945, a45]]);

    const director = new TransitionDirector({ state, scene, layout, registry });
    director.dispose();
    expect(t45.disposed).toBe(true);
    expect(t45.audioDisposed).toBe(true);
    expect(director.currentYear).toBeNull();
    expect(director.transitioning).toBe(false);
  });
});