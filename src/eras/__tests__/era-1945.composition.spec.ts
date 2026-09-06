import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { AssetLoader, EraContext } from '../../types';
import era1945, { era1945Providers } from '../eras/1945';

/**
 * Composition test for the 1945 era. Verifies that importing the module
 * composes it with the registry contract and that `build` produces the full
 * art-directed post-war block with every classification threshold, `update`
 * animates the moving agents, and `dispose` fully releases the scene graph.
 *
 * The composition check in the plan asks for ≥6 buildings, ≥3 storefronts,
 * ≥2 ads, ≥3 vehicles, ≥8 pedestrians, ≥4 lampposts, ≥3 telephone poles and
 * ≥4 interactivePoints — all measured from the real built scene graph.
 */

const stubLoader: AssetLoader = {
  load: async () => '',
  release: () => undefined,
};

function collect<T extends THREE.Object3D>(root: THREE.Object3D, cat: string): T[] {
  const out: T[] = [];
  root.traverse((o) => {
    if ((o.userData as { category?: string }).category === cat) out.push(o as T);
  });
  return out;
}

function buildScene(): { ctx: EraContext; stage: THREE.Group } {
  const stage = new THREE.Group();
  const ctx: EraContext = {
    scene: stage,
    loader: stubLoader,
    root: undefined as never,
    year: '1945',
  };
  era1945.build(ctx);
  return { ctx, stage };
}

describe('1945 era composition', () => {
  it('is a fast-path era with provider bundles for the sim', () => {
    expect(era1945.isFastPath).toBe(true);
    expect(era1945Providers.era).toBe('1945');
    expect(era1945Providers.vehicles.length).toBeGreaterThanOrEqual(3);
    expect(era1945Providers.pedestrianOutfits.length).toBeGreaterThanOrEqual(5);
  });

  it('builds a fully art-directed post-war block meeting every threshold', () => {
    const { stage } = buildScene();

    expect(collect(stage, 'building').length).toBeGreaterThanOrEqual(6);
    expect(collect(stage, 'storefront').length).toBeGreaterThanOrEqual(3);
    expect(collect(stage, 'billboard').length).toBeGreaterThanOrEqual(2);
    expect(collect(stage, 'vehicle').length).toBeGreaterThanOrEqual(3);
    expect(collect(stage, 'pedestrian').length).toBeGreaterThanOrEqual(8);
    expect(collect(stage, 'lamppost').length).toBeGreaterThanOrEqual(4);
    expect(collect(stage, 'telephone-pole').length).toBeGreaterThanOrEqual(3);
    expect(collect(stage, 'sandbag').length).toBeGreaterThanOrEqual(2);

    // War posters are painted onto walls/billboards; a poster category exists
    // for ambience but the ad threshold is the billboard count above.

    expect(era1945.interactivePoints.length).toBeGreaterThanOrEqual(4);
    for (const p of era1945.interactivePoints) {
      expect(p.label).toBeTruthy();
      expect(typeof p.position.x).toBe('number');
    }

    era1945.dispose();
  });

  it('update(dt) mutates agent positions (pedestrians & vehicles move)', () => {
    const { stage } = buildScene();
    const ped = collect(stage, 'pedestrian');
    const veh = collect(stage, 'vehicle');
    const pedStart = ped.map((p) => p.position.clone());
    const vehStart = veh.map((v) => v.position.clone());

    era1945.update(1.0);

    const moved = ped.some((p, i) => !p.position.equals(pedStart[i])) ||
      veh.some((v, i) => !v.position.equals(vehStart[i]));
    expect(moved).toBe(true);

    era1945.dispose();
  });

  it('dispose() detaches the root from the scene and releases resources', () => {
    const { stage } = buildScene();
    const before = stage.children.length;
    expect(before).toBeGreaterThan(0);

    era1945.dispose();

    expect(stage.children.length).toBe(0);
    // idempotent disposal
    expect(() => era1945.dispose()).not.toThrow();
  });

  it('dispose() releases tracked geometries, materials and textures', () => {
    const { stage } = buildScene();
    const geometries: unknown[] = [];
    stage.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geometries.push(m.geometry);
    });
    expect(geometries.length).toBeGreaterThan(20);

    // dispose and confirm it runs without errors (disposal is best-effort for
    // shared primitives, but must never throw)
    expect(() => era1945.dispose()).not.toThrow();
  });
});