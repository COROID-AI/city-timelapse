import { Object3D, Scene } from 'three';
import { CityBlockLayout } from '../layout/cityBlockLayout';
import { createCityBlockLayout } from '../layout/cityBlockLayout';
import { EraState } from '../types/era';
import { EraYear } from '../types/city';
import { SfxContext } from '../audio/sfxContext';
import { createEraState } from '../state/eraState';
import { era1945Content } from '../eras/1945/index';
import { createEra1965Content } from '../eras/1965/index';
import { createEra1985Content } from '../eras/1985/index';
import { createEra2005Content } from '../eras/2005/index';
import { era2025Content } from '../eras/2025/index';
import { apply1945Grade } from '../eras/1945/palette';
import { TransitionDirector, TransitionDirectorOptions } from './transitionDirector';
import { EraModuleAdapter, collectMeshes } from './transitionDirector';
import { createEraAudioHandle, EraAudioHandle } from './audioCrossfade';
import { EraPaletteSnapshot, Rgb, snapshotPalette } from './paletteTween';

/**
 * Era transition engine public API.
 *
 * Re-exports the typed surface consumed by the Phase 6 integration task:
 *   - `TransitionDirector` — subscribes to EraState and animates the handoff.
 *   - `AnimationTimeline` — configurable duration/easing.
 *   - `transitionRegistry` — concrete adapters over the five era modules.
 *   - `createTransitionDirector` — one-call wiring helper.
 *
 * The director is generic; the adapters here normalize the five heterogeneous
 * era content modules (1945/1965/1985/2005/2025) behind a uniform attach /
 * update / dispose / audio / palette surface.
 */

export { TransitionDirector, collectMeshes } from './transitionDirector';
export type { EraModuleAdapter } from './transitionDirector';
export { AnimationTimeline, cubicInOut, buildInOvershoot, DEFAULT_DURATION } from './animationTimeline';
export { snapshotPalette, createPaletteTween, lerpRgb } from './paletteTween';
export { createEraAudioHandle, createAudioCrossfade } from './audioCrossfade';
export type { EraAudioHandle, AudioCrossfade, CrossfadeStem } from './audioCrossfade';
export type { EraSceneHandle, SceneGrade, TransitionDirectorOptions } from './transitionDirector';
export type { LightingGrade, EraPaletteSnapshot, Rgb } from './paletteTween';
export type { Easing } from './animationTimeline';

/** A stub SfxContext for eras whose audio rig requires a hook. */
function stubSfx(): SfxContext {
  return {
    get initialized() {
      return false;
    },
    blip() {},
    dispose() {},
  };
}

/** Capture meshes added to a scene by an attach call. */
function attachViaSceneDiff(
  scene: Scene,
  attachFn: () => void,
): Object3D[] {
  const before = new Set(scene.children);
  attachFn();
  const added: Object3D[] = [];
  for (const child of scene.children) {
    if (!before.has(child)) added.push(child);
  }
  return added;
}

/** Build an era adapter for the 1945 module. */
function adapt1945(): EraModuleAdapter {
  return {
    year: 1945,
    attach(scene: Scene, layout: CityBlockLayout) {
      const roots = attachViaSceneDiff(scene, () => {
        era1945Content.attach(scene, layout);
      });
      return {
        meshes: collectMeshes(new Object3D().add(...roots)),
        update(dt: number) {
          // 1945 attaches its own vehicle/pedestrian update loop internally;
          // the returned handle does not expose an update, so drive a no-op
          // here (the content steps itself during attach).
          void dt;
        },
        dispose() {
          for (const root of roots) scene.remove(root);
        },
      };
    },
    createAudio(): EraAudioHandle {
      const audio = era1945Content.createAudio(stubSfx());
      return createEraAudioHandle(1945, audio);
    },
    palette(): EraPaletteSnapshot {
      return snapshotPalette({ year: 1945, palette: era1945Content.palette });
    },
    grade(color: Rgb): Rgb {
      return apply1945Grade(color);
    },
  };
}

/** Build an era adapter for the 1965 module. */
function adapt1965(): EraModuleAdapter {
  return {
    year: 1965,
    attach(scene: Scene, layout: CityBlockLayout) {
      const content = createEra1965Content();
      content.instantiate({ scene, layout });
      const root = content.root;
      return {
        meshes: collectMeshes(root),
        update(dt: number) {
          content.update(dt);
        },
        dispose() {
          content.dispose();
        },
      };
    },
    createAudio(): EraAudioHandle {
      const content = createEra1965Content();
      return createEraAudioHandle(1965, content.audio);
    },
    palette(): EraPaletteSnapshot {
      const content = createEra1965Content();
      return snapshotPalette({ year: 1965, palette: content.palette });
    },
  };
}

/** Build an era adapter for the 1985 module. */
function adapt1985(): EraModuleAdapter {
  return {
    year: 1985,
    attach(scene: Scene, layout: CityBlockLayout) {
      const content = createEra1985Content(layout);
      content.instantiate(layout);
      // Re-import the root so the mesh set reflects the instantiated content.
      const root = content.root;
      if (!scene.children.includes(root)) scene.add(root);
      return {
        meshes: collectMeshes(root),
        update(dt: number) {
          content.update(dt);
        },
        dispose() {
          content.dispose();
          scene.remove(root);
        },
      };
    },
    createAudio(): EraAudioHandle {
      const content = createEra1985Content();
      return createEraAudioHandle(1985, content.audio);
    },
    palette(): EraPaletteSnapshot {
      const content = createEra1985Content();
      return snapshotPalette({ year: 1985, palette: content.palette });
    },
  };
}

/** Build an era adapter for the 2005 module. */
function adapt2005(): EraModuleAdapter {
  return {
    year: 2005,
    attach(scene: Scene, layout: CityBlockLayout) {
      const state = createEraState(2005);
      const content = createEra2005Content(layout, state, scene);
      content.instantiate();
      return {
        meshes: [] as Object3D[],
        update(dt: number) {
          content.update(dt);
        },
        dispose() {
          content.dispose();
        },
      };
    },
    createAudio(): EraAudioHandle {
      const state = createEraState(2005);
      const content = createEra2005Content(createCityBlockLayout(), state, new Scene());
      return createEraAudioHandle(2005, content.audio);
    },
    palette(): EraPaletteSnapshot {
      const state = createEraState(2005);
      const content = createEra2005Content(createCityBlockLayout(), state, new Scene());
      return snapshotPalette({ year: 2005, palette: content.palette });
    },
  };
}

/** Build an era adapter for the 2025 module. */
function adapt2025(): EraModuleAdapter {
  return {
    year: 2025,
    attach(scene: Scene, layout: CityBlockLayout) {
      const state = { year: 2025 } as EraState;
      era2025Content.instantiate(layout, state, stubSfx());
      // 2025 is a static data module; it registers no mutable meshes.
      void scene;
      return {
        meshes: [] as Object3D[],
        update(dt: number) {
          era2025Content.update(dt);
        },
        dispose() {
          era2025Content.dispose();
        },
      };
    },
    createAudio(): EraAudioHandle {
      return createEraAudioHandle(2025, era2025Content.audio);
    },
    palette(): EraPaletteSnapshot {
      return snapshotPalette({ year: 2025, palette: era2025Content.palette });
    },
  };
}

/** The five era module adapters, keyed by canonical year. */
function buildRegistry(): Map<EraYear, EraModuleAdapter> {
  const map = new Map<EraYear, EraModuleAdapter>();
  map.set(1945, adapt1945());
  map.set(1965, adapt1965());
  map.set(1985, adapt1985());
  map.set(2005, adapt2005());
  map.set(2025, adapt2025());
  return map;
}

/** The shared transition registry over all five era modules. */
export const transitionRegistry: ReadonlyMap<EraYear, EraModuleAdapter> =
  buildRegistry();

/**
 * Convenience: create a fully-wired TransitionDirector against the shared
 * registry. Accepts the same options as {TransitionDirector} minus `registry`.
 */
export function createTransitionDirector(
  options: Omit<TransitionDirectorOptions, 'registry'>,
): TransitionDirector {
  return new TransitionDirector({ ...options, registry: transitionRegistry });
}