/**
 * Detail pass tests — the additive era-detail enrichment layer.
 *
 * Proves, headlessly (real three.js scene graphs, no WebGL):
 *
 *  - every one of the five eras gets night window glows, instanced street
 *    props and surface wear layered from the builder outputs and the shared
 *    BlockLayout anchors, attached under the buildings layer so the era
 *    morph drives them,
 *  - re-applying to the same scene object is an idempotent no-op (no
 *    duplicated polish objects), while a *rebuilt* era scene applies cleanly
 *    again,
 *  - repeated props are instanced: hundreds of instances behind a small fixed
 *    number of draw calls,
 *  - the fully-polished stage respects the draw-call budget for all five
 *    eras, and the budget enforcer releases polish groups lowest-priority
 *    first,
 *  - dispose detaches the layer resources.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ERA_YEARS, type EraId } from '../era/types';
import { EraStore } from '../era/state';
import { TransitionController } from '../transition/transitionController';
import { EraSceneRegistry, type EraScene } from '../integration/eraSceneRegistry';
import { resolveEraBuilding } from '../world/buildings/eraBuildingData';
import { applyPolishToApp } from './index';
import {
  applyDetailPass,
  DETAIL_PASS_MARKER,
  disposePolishDetail,
} from './detailPass';
import {
  DEFAULT_DRAW_CALL_BUDGET,
  POLISH_DRAW_CALL_BUDGET,
  POLISH_PRIORITIES,
  collectPolishGroups,
  countInstancedMeshes,
  countPolishDrawCalls,
  countSceneDrawCalls,
  enforceDrawCallBudget,
} from './perfBudget';

// ============================================================================
// Harness: a fresh registry per test (scenes are cached + disposable).
// ============================================================================

const freshRegistry = (): EraSceneRegistry => new EraSceneRegistry();
let registry: EraSceneRegistry;
let scenes: EraScene[] = [];

beforeEach(() => {
  registry = freshRegistry();
  scenes = [];
});

afterEach(() => {
  registry.dispose();
  scenes.length = 0;
});

function getScene(era: EraId): EraScene {
  const scene = registry.get(era);
  scenes.push(scene);
  return scene;
}

describe('applyDetailPass (src/polish/detailPass.ts)', () => {
  it('enriches every era with glows, props and wear from builder output + anchors', () => {
    for (const era of ERA_YEARS) {
      const scene = getScene(era);
      const report = applyDetailPass(scene);

      expect(report.era).toBe(era);
      expect(report.applied).toBe(true);
      expect(report.reapplySkipped).toBe(false);

      // Night window glows derived from the buildings layer descriptors.
      expect(report.glowInstances).toBeGreaterThan(0);
      expect(report.glowDrawCalls).toBeGreaterThan(0);

      // Small props placed from the shared layout anchors.
      expect(report.propInstances).toBeGreaterThan(0);
      expect(report.propDrawCalls).toBeGreaterThan(0);

      // Surface wear across asphalt/sidewalk/facades.
      expect(report.wearPatches).toBeGreaterThan(0);
      expect(report.wearDrawCalls).toBeGreaterThan(0);

      // Marker + group placement: under the buildings layer so the morph
      // (opacity/scale) drives the polish with the same law as the buildings.
      expect(scene.root.userData?.[DETAIL_PASS_MARKER]).toBe(true);
      expect(scene.buildings.children.some((child) => child === report.group)).toBe(true);
    }
  });

  it('re-application on the same scene is an idempotent no-op (no duplication)', () => {
    const scene = getScene(1945);
    const first = applyDetailPass(scene);
    const second = applyDetailPass(scene);

    expect(second.applied).toBe(false);
    expect(second.reapplySkipped).toBe(true);
    expect(second.glowInstances).toBe(0);

    // Exactly one tagged polish group; the draw count is unchanged.
    expect(collectPolishGroups(scene.root)).toHaveLength(1);
    expect(countSceneDrawCalls(scene.root)).toBe(first.totalDrawCalls);
  });

  it('rebuilt era scenes apply cleanly again (era rebuild is not skipped)', () => {
    const scene = getScene(1985);
    expect(applyDetailPass(scene).applied).toBe(true);

    // Era rebuild: the wiring disposes the old scene and builds a fresh one.
    scene.dispose();
    const rebuilt = registry.get(1985);
    expect(rebuilt).not.toBe(scene);
    expect(rebuilt.root.userData?.[DETAIL_PASS_MARKER]).not.toBe(true);

    const report = applyDetailPass(rebuilt);
    expect(report.applied).toBe(true);
    expect(report.glowInstances).toBeGreaterThan(0);
    expect(report.propInstances).toBeGreaterThan(0);
  });

  it('repeated props are instanced: many instances, few draw calls', () => {
    const scene = getScene(2025);
    const report = applyDetailPass(scene);

    const instanceCount =
      report.glowInstances + report.propInstances + report.wearPatches;
    const polishDrawCalls =
      report.glowDrawCalls + report.propDrawCalls + report.wearDrawCalls;

    // Hundreds of repeated elements...
    expect(instanceCount).toBeGreaterThan(200);
    // ...behind a small number of InstancedMesh draw calls (every polish
    // drawable in the whole era root is an InstancedMesh).
    expect(countInstancedMeshes(scene.root)).toBe(polishDrawCalls);
    expect(polishDrawCalls).toBeLessThanOrEqual(60);
  });

  it('keeps the fully-polished stage within the draw-call budget for every era', () => {
    const table: Array<{
      era: EraId;
      base: number;
      draws: number;
      polish: number;
      glow: number;
      props: number;
      wear: number;
    }> = [];
    for (const era of ERA_YEARS) {
      const scene = getScene(era);
      const base = countSceneDrawCalls(scene.root);
      const report = applyDetailPass(scene);
      table.push({
        era,
        base,
        draws: report.totalDrawCalls,
        polish: report.polishDrawCalls,
        glow: report.glowInstances,
        props: report.propInstances,
        wear: report.wearPatches,
      });
      // The additive layer's instanced accounting matches the scene scan.
      expect(countPolishDrawCalls(scene.root)).toBe(report.polishDrawCalls);
      // The additive layer stays far below its own 450 budget.
      expect(report.polishDrawCalls).toBeLessThanOrEqual(POLISH_DRAW_CALL_BUDGET);
    }
    // Evidence for docs/verification-polish-final-qa.md.
    // eslint-disable-next-line no-console
    console.log('[polish] per-era draw-call budget table:', JSON.stringify(table));
    for (const row of table) {
      expect(row.draws).toBeLessThanOrEqual(DEFAULT_DRAW_CALL_BUDGET);
    }
  });

  it('lays down era-distinct wear character (changes across the timeline)', () => {
    // The era recipes the pass layers from produce strictly decreasing wear
    // across the five stops: worn wartime blocks -> pristine eco-era.
    const wearByEra = ERA_YEARS.map((era) => ({
      era,
      wearLevel: resolveEraBuilding(era).detail.wear.levelBand[0] ?? 0,
    }));
    const distinct = new Set(wearByEra.map((row) => row.wearLevel.toFixed(3)));
    expect(distinct.size).toBe(5);
    // Strictly monotonic wear decrease confirms no two adjacent eras look alike.
    for (let i = 1; i < wearByEra.length; i += 1) {
      expect(wearByEra[i]!.wearLevel).toBeLessThan(wearByEra[i - 1]!.wearLevel);
    }
  });

  it('dispose detaches the polish layer from the buildings and releases resources', () => {
    const scene = getScene(1965);
    const report = applyDetailPass(scene);
    expect(scene.buildings.children).toContain(report.group);

    disposePolishDetail(report.group);
    expect(scene.buildings.children).not.toContain(report.group);
    expect(collectPolishGroups(scene.root)).toHaveLength(0);
  });

  it('budget enforcer hides lowest-priority polish groups first', () => {
    const root = new THREE.Group();
    for (let i = 0; i < 10; i += 1) {
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    const wear = new THREE.Group();
    wear.name = 'polish-wear';
    wear.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.wear, polishKind: 'wear' };
    const props = new THREE.Group();
    props.name = 'polish-props';
    props.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.props, polishKind: 'props' };
    const glows = new THREE.Group();
    glows.name = 'polish-glows';
    glows.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.glows, polishKind: 'glows' };
    for (let i = 0; i < 3; i += 1) {
      wear.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    for (let i = 0; i < 2; i += 1) {
      props.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    for (let i = 0; i < 5; i += 1) {
      glows.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    root.add(wear, props, glows);

    expect(countSceneDrawCalls(root)).toBe(20);
    // Budget 15: wear (3) then props (2) hide, landing exactly at 15; the
    // highest-priority glows (5) stay visible. 20 -> 17 -> 15.
    const result = enforceDrawCallBudget(root, 15);
    expect(result.before).toBe(20);
    expect(result.after).toBe(15);
    expect(result.hiddenGroups).toEqual(['polish-wear', 'polish-props']);
    expect(wear.visible).toBe(false);
    expect(props.visible).toBe(false);
    expect(glows.visible).toBe(true);
  });

  it('applyPolishToApp wires the pass into the running app (get wrapper + sweep + dispose)', () => {
    const registry = new EraSceneRegistry();
    const store = new EraStore();
    const controller = new TransitionController({ duration: 0.5 });
    const stage = new THREE.Group();
    const engine = {
      onFrame: () => () => {},
      getSize: () => ({ width: 800, height: 600 }),
      resize: () => {},
    };
    let appDisposed = false;
    const app = {
      registry,
      controller,
      engine,
      stage,
      store,
      dispose: () => {
        appDisposed = true;
      },
    };

    const handle = applyPolishToApp(app);

    // The boot scene (already cached by the app bootstrap) is polished.
    const initial = registry.get(store.current);
    expect(initial.root.userData?.[DETAIL_PASS_MARKER]).toBe(true);
    expect(handle.manager.activeCount).toBe(1);

    // Requesting a new era builds a fresh scene through the wrapped getter,
    // which applies the detail pass automatically (slider -> wiring path).
    store.requestEra(1985);
    const incoming = registry.get(store.current);
    expect(incoming.root.userData?.[DETAIL_PASS_MARKER]).toBe(true);
    expect(handle.manager.appliedCount).toBeGreaterThanOrEqual(2);

    // When the wiring disposes the outgoing content and reports completion,
    // the sweep releases the disposed scene's polish resources.
    controller.play(initial.bundle, incoming.bundle, 1985);
    controller.update(1); // finalize -> disposes outgoing bundle -> onComplete -> sweep
    expect(initial.isDisposed).toBe(true);
    expect(handle.manager.activeCount).toBe(1);

    // The wrapped app dispose tears down the manager and overlay.
    handle.dispose();
    expect(appDisposed).toBe(true);
    expect(handle.manager.activeCount).toBe(0);
  });
});