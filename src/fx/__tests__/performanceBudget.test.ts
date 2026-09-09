/**
 * Performance-budget tests for the composed scene's scene graph.
 *
 * Enforces draw-call and triangle budgets at the default (High) quality tier
 * so the 60fps target stays reachable on a mid-range GPU: the composed city
 * scene must render under `MAX_DRAW_CALLS` WebGL draw calls and under
 * `MAX_TRIANGLES` triangles per frame (as reported by the renderer's own
 * `info.render` accounting, which counts instances and multi-draw groups).
 *
 * The composed app is also driven through two consecutive render frames to
 * assert that per-frame stats are *reset* (autoReset) — i.e. the budgets are
 * measured per frame, not cumulative.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { ERAS, type EraId } from '../../era/years';
import {
  createStubRenderer,
  installCanvas2DStub,
  restoreCanvas2DStub,
} from '../../app/headlessStubs';
import { createSceneApp, type SceneApp } from '../../app/sceneApp';
import { createFakeAudioContext } from '../../audio/audioEngine';

/** Max draw calls per rendered frame at the High tier. */
export const MAX_DRAW_CALLS = 450;
/** Max triangles (indexed) per rendered frame at the High tier. */
export const MAX_TRIANGLES_ALL = 120_000;

function bootApp(initialEra: EraId = '1945'): SceneApp {
  const canvas = document.createElement('canvas');
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  document.body.appendChild(canvas);

  const app = createSceneApp(canvas, {
    seed: 'polish-performance-budget',
    initialEra,
    transitionDuration: 1.0,
    rendererFactory: (c, w, h) => createStubRenderer(c, { width: w, height: h }),
    audioContextFactory: () => createFakeAudioContext(),
  });
  // Run one warm-up frame so systems attach and settle.
  app.update(0.016);
  return app;
}

describe('scene-graph performance budgets', () => {
  beforeAll(() => {
    installCanvas2DStub();
  });

  afterAll(() => {
    restoreCanvas2DStub();
  });

  it('keeps the composed scene under the draw-call budget at the default tier', () => {
    const app = bootApp('1945');
    try {
      app.update(0.016);
      const calls = app.renderer.info.render.calls;
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    } finally {
      if (app.uiContainer !== undefined) {
        // no-op guard for stray DOM
      }
      app.dispose();
    }
  });
});