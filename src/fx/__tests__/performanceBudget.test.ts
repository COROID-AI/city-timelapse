/**
 * Performance-budget tests for the composed scene's scene graph.
 *
 * Enforces draw-call and triangle budgets at the default (High) quality tier
 * so the 60fps target stays reachable on a mid-range GPU:
 *
 * - `countSceneGraphStats()` walks the composed scene graph and sums the
 *   draw calls (render-list projections count each material group as one draw
 *   call) and indexed triangles (geometry index buffers / instanced meshes).
 *   This happens *before* any GPU render, so it works headlessly and guards
 *   against regressions in building/signage/vehicle/pedestrian/atmosphere
 *   geometry at the source.
 * - The budget test asserts both stay under `MAX_DRAW_CALLS` and
 *   `MAX_TRIANGLES_ALL`.
 *
 * The same stats function is exported for the composed app's own tests.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeAudioContext } from '../../audio/audioEngine';
import {
  createStubRenderer,
  installCanvas2DStub,
  restoreCanvas2DStub,
} from '../../app/headlessStubs';
import { createSceneApp, type SceneApp } from '../../app/sceneApp';

/** Max draw calls per rendered frame at the High tier (measured: 915). */
export const MAX_DRAW_CALLS = 1200;
/** Max triangles (indexed) per rendered frame at the High tier (measured: 62k). */
export const MAX_TRIANGLES_ALL = 120_000;

export interface SceneGraphStats {
  /** Number of material-group draw calls (render-list projections). */
  drawCalls: number;
  /** Number of indexed triangles (instances counted multiplicatively). */
  triangles: number;
}

interface GraphNode {
  visible: boolean;
  children?: GraphNode[];
  material?: unknown;
  geometry?: {
    index?: { count: number } | null;
    groups?: Array<{ count: number }>;
  } | null;
  isInstancedMesh?: boolean;
  count?: number;
}

/**
 * Counts draw calls and indexed triangles for the composed scene graph.
 * Draw call = one material group entry in the render list (mirrors
 * WebGLRenderer.projectObject pushing per material). Triangles = index
 * buffer count / 3, multiplied by the instanced count when the node is an
 * InstancedMesh (the renderer's info.update does the same).
 */
export function countSceneGraphStats(root: GraphNode): SceneGraphStats {
  let drawCalls = 0;
  let triangles = 0;

  function walk(node: GraphNode): void {
    if (!node.visible) return;

    const geometry = node.geometry;
    if (node.material && geometry) {
      // Each material array group is a separate draw call.
      const groups = geometry.groups;
      drawCalls += Math.max(1, groups && groups.length ? groups.length : 1);

      // Triangles from indexed buffers.
      const indexCount = geometry.index?.count ?? 0;
      const baseTriangles = Math.floor(indexCount / 3);
      if (baseTriangles > 0) {
        const instances = node.isInstancedMesh === true ? Math.max(1, node.count ?? 1) : 1;
        triangles += baseTriangles * instances;
      }
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(root);
  return { drawCalls, triangles };
}

function bootApp(): SceneApp {
  const canvas = document.createElement('canvas');
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  document.body.appendChild(canvas);

  const app = createSceneApp(canvas, {
    seed: 'polish-performance-budget',
    initialEra: '1945',
    transitionDuration: 1.0,
    rendererFactory: (c, w, h) => createStubRenderer(c, { width: w, height: h }),
    audioContextFactory: () => createFakeAudioContext(),
  });
  // One warm-up frame so systems attach and settle.
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

  it('keeps the composed scene under the draw-call and triangle budgets', () => {
    const app = bootApp();
    try {
      const stats = countSceneGraphStats(app.scene as unknown as GraphNode);
      expect(stats.drawCalls).toBeGreaterThan(0);
      expect(stats.triangles).toBeGreaterThan(0);

      expect(stats.drawCalls).toBeLessThanOrEqual(MAX_DRAW_CALLS);
      expect(stats.triangles).toBeLessThanOrEqual(MAX_TRIANGLES_ALL);
    } finally {
      app.dispose();
      if (app.canvas.parentNode) app.canvas.parentNode.removeChild(app.canvas);
    }
  });
});