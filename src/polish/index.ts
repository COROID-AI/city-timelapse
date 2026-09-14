/**
 * Polish pass entry point — the additive detail + performance layer for the
 * integrated City Time Period Timelapse app.
 *
 * `applyPolishToApp` is the minimal hook src/main.ts imports after the
 * integrated scene boots (browser path only; headless tests drive `boot()`
 * with the auto-boot flag off, so the app wiring is untouched under Vitest).
 *
 * It composes, without editing any producer module:
 *
 *  - the **detail pass** (`applyDetailPass`): night window glows, instanced
 *    street props and surface wear on every era scene the registry creates
 *    (initial scene + lazily rebuilt scenes on era selection),
 *  - **resource sweep**: when the transition controller reports completion
 *    (and on every new era request), polish GL resources of disposed era
 *    scenes are released so repeated rapid swaps stay memory-bounded,
 *  - the **perf overlay** (`?perf=1`): live fps, capped pixel ratio and
 *    draw-call budget enforcement against the visible stage.
 *
 * `app.dispose` is wrapped so the manager, overlay and frame subscriptions
 * are torn down with the application.
 */

import type { EraId } from '../era/types';
import type { EraStore } from '../era/state';
import type { TransitionController } from '../transition/transitionController';
import type { EraScene, EraSceneRegistry } from '../integration/eraSceneRegistry';
import {
  applyDetailPass,
  disposePolishDetail,
  type PolishDetailOptions,
  type PolishDetailReport,
  type PolishSceneInput,
} from './detailPass';
import {
  cappedRenderSize,
  createPerfOverlay,
  isPerfOverlayRequested,
  projectDevicePixelRatio,
  type PerfOverlay,
} from './perfBudget';
import * as THREE from 'three';

/** Minimal engine surface `applyPolishToApp` needs (SceneEngine satisfies it). */
export interface PolishTargetEngine {
  onFrame(callback: (deltaSeconds: number) => void): () => void;
  getSize(): { readonly width: number; readonly height: number };
  resize(width?: number, height?: number): void;
}

/** Structural app surface `applyPolishToApp` consumes (CityApp satisfies it). */
export interface PolishTargetApp {
  /** Era scene registry whose lazily-built scenes get the detail pass. */
  readonly registry: EraSceneRegistry;
  /** Transition controller (completion events drive the resource sweep). */
  readonly controller: TransitionController;
  /** Engine used for overlay frame deltas, sizing and the pixel-ratio cap. */
  readonly engine: PolishTargetEngine;
  /** The shared stage holding attached era scene roots. */
  readonly stage: THREE.Group;
  /** Stores the currently selected era. */
  readonly store: EraStore;
  /** Application teardown (wrapped to release polish resources). */
  dispose(): void;
}

/** Handle returned by {@link applyPolishToApp}. */
export interface PolishAppHandle {
  readonly manager: PolishManager;
  /** Null unless `?perf=1` (or an injected search) requested the overlay. */
  readonly overlay: PerfOverlay | null;
  /** Release polish resources. Idempotent. */
  dispose(): void;
}

/** Tracks applied polish groups per era scene and releases them on dispose. */
export interface PolishManager {
  /**
   * Apply the detail pass to `scene` (idempotent per scene object). Returns
   * the report; `reapplySkipped` is true when the scene was already covered.
   */
  apply(scene: PolishSceneInput & { isDisposed: boolean }, options?: PolishDetailOptions): PolishDetailReport;
  /** Dispose polish resources of any tracked scene that is now disposed. */
  sweep(): void;
  /** Dispose every tracked polish resource. Idempotent. */
  dispose(): void;
  /** Number of distinct scenes the manager has polished. */
  readonly appliedCount: number;
  /** Number of tracked (not yet disposed) scenes. */
  readonly activeCount: number;
}

/**
 * Create the polish resource manager. Scenes enter when the detail pass is
 * applied and leave (with GL resources released) when they are disposed by
 * the era-swap pipeline.
 */
export function createPolishManager(): PolishManager {
  const tracked: Array<{ scene: { isDisposed: boolean }; group: THREE.Group }> = [];
  let appliedCount = 0;

  return {
    apply(scene, options = {}): PolishDetailReport {
      const report = applyDetailPass(scene, options);
      if (report.applied) {
        tracked.push({ scene, group: report.group });
        appliedCount += 1;
      }
      return report;
    },

    sweep(): void {
      for (let i = tracked.length - 1; i >= 0; i -= 1) {
        const entry = tracked[i];
        if (entry !== undefined && entry.scene.isDisposed) {
          disposePolishDetail(entry.group);
          tracked.splice(i, 1);
        }
      }
    },

    dispose(): void {
      for (const entry of tracked) {
        disposePolishDetail(entry.group);
      }
      tracked.length = 0;
    },

    get appliedCount(): number {
      return appliedCount;
    },

    get activeCount(): number {
      return tracked.length;
    },
  };
}

/**
 * Apply the polish pass to a booted application and return the handle.
 *
 * - Wraps `registry.get` so every era scene (initial + lazily built during
 *   slider selection and mid-transition interruption) receives the detail
 *   pass exactly once.
 * - Sweeps disposed scenes' polish resources on era completion *and* on each
 *   new registry request (covers mid-morph interrupts).
 * - Enables the perf overlay when requested (`?perf=1`).
 * - Applies the pixel-ratio cap (renderer backing <= 2x CSS) through the
 *   engine's public resize surface at boot.
 * - Wraps `app.dispose` so all polish state is released with the app.
 */
export function applyPolishToApp(app: PolishTargetApp): PolishAppHandle {
  const manager = createPolishManager();

  // Every scene the era wiring builds passes through here: initial boot scene
  // and all lazily rebuilt scenes on slider selection / interrupts.
  const originalGet = app.registry.get.bind(app.registry);
  app.registry.get = (era: EraId): EraScene => {
    manager.sweep();
    const scene = originalGet(era);
    manager.apply(scene);
    return scene;
  };

  // Polish the initial (boot) scene — already cached by boot().
  manager.apply(app.registry.get(app.store.current));

  // On morph completion the outgoing scene is disposed: release its polish
  // resources now (interrupts are covered by the sweep inside get above).
  const unsubscribeComplete = app.controller.onComplete(() => {
    manager.sweep();
  });

  // Pixel-ratio guardrail: renderer backing never exceeds 2x the CSS size.
  const size = app.engine.getSize();
  const capped = cappedRenderSize(size.width, size.height, projectDevicePixelRatio());
  app.engine.resize(capped.width, capped.height);

  // Perf overlay (bottom-left; never over the top timeline slider).
  const overlay = isPerfOverlayRequested()
    ? createPerfOverlay({
        engine: app.engine,
        stage: app.stage,
        getEra: () => String(app.store.current),
      })
    : null;
  overlay?.attach();

  const originalDispose = app.dispose;
  app.dispose = (): void => {
    unsubscribeComplete();
    overlay?.dispose();
    manager.dispose();
    originalDispose();
  };

  return {
    manager,
    overlay,
    dispose: () => app.dispose(),
  };
}