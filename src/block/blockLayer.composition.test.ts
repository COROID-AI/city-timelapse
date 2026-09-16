// @vitest-environment node
/**
 * blockLayer.composition.test.ts — headless composition: BlockLayer integrates
 * with SceneRuntime and EraSystem, and an era walk through all five eras
 * transforms the block's attachments and materials. dispose() removes
 * everything from the runtime scene graph.
 */

import { describe, expect, it } from 'vitest';

import { SceneRuntime } from '../core/sceneRuntime';
import { getEraDefinition, EraSystem, type EraId } from '../eras/eraSystem';
import { BUILDING_VARIANT_BY_ERA } from './buildings';
import { BlockLayer, BLOCK_LOT_IDS, GLOW_GAIN } from './blockLayer';

const ERA_WALK: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/** Drives an EraSystem tween to completion by ticking its clock. */
function driveToSettled(system: EraSystem, stepSeconds = 0.05, maxSteps = 500): void {
  let steps = 0;
  while (system.getState().phase === 'transitioning' && steps < maxSteps) {
    system.update(stepSeconds);
    steps += 1;
  }
}

describe('BlockLayer composition with runtime and era system', () => {
  it('walks all five eras in the headless runtime and transforms the block', () => {
    const runtime = new SceneRuntime();
    const eraSystem = new EraSystem(1945);
    const layer = new BlockLayer({ eraSystem });

    runtime.attachLayer(layer);
    expect(runtime.layerCount).toBe(1);
    expect(runtime.hasLayer('block')).toBe(true);
    expect(runtime.scene.children).toContain(layer.createRoot());

    // Initial 1945 state.
    expect(layer.currentEra).toBe(1945);
    for (const lotId of BLOCK_LOT_IDS) {
      expect(layer.lotBuildings[lotId].variantKey).toBe('brick-brownstone');
    }

    const heights: number[] = [];
    for (const eraId of ERA_WALK) {
      if (eraId !== 1945) {
        eraSystem.selectEra(eraId);
        driveToSettled(eraSystem);
        runtime.step(1 / 60);
      }
      const era = getEraDefinition(eraId);
      expect(layer.currentEra).toBe(eraId);
      expect(layer.deployedEra).toBe(eraId);
      for (const lotId of BLOCK_LOT_IDS) {
        expect(layer.lotBuildings[lotId].variantKey).toBe(BUILDING_VARIANT_BY_ERA[eraId]);
      }
      expect(layer.storefronts[0].signageKey).toBe(era.storefronts.signage);
      expect(layer.advertisements[0].technology).toBe(era.advertisements.technology);
      expect(layer.street.styleLabel.length).toBeGreaterThan(0);
      heights.push(layer.lotBuildings.NW.heightMeters);
      runtime.step(0.05);
    }

    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }

    // Back to the beginning — 2025 LED-era features are replaced by the
    // 1945 trolley surface when the walk reverses.
    eraSystem.selectEra(1945);
    driveToSettled(eraSystem);
    runtime.step(1 / 60);
    expect(layer.currentEra).toBe(1945);
    expect(layer.street.trolleyRailCount).toBeGreaterThanOrEqual(2);
    expect(layer.street.bikeLaneBandCount).toBe(0);

    runtime.dispose();
    expect(runtime.layerCount).toBe(0);
    expect(runtime.scene.children).toHaveLength(0);
  });

  it('blends continuous materials through an EraSystem transition', () => {
    const runtime = new SceneRuntime();
    const eraSystem = new EraSystem(1945);
    const layer = new BlockLayer({ eraSystem });
    runtime.attachLayer(layer);

    const lowGlow = getEraDefinition(1945).atmosphere.bloom * GLOW_GAIN;
    const highGlow = getEraDefinition(1985).atmosphere.bloom * GLOW_GAIN;
    expect(layer.maxGlowIntensity()).toBeCloseTo(lowGlow, 5);

    eraSystem.selectEra(1985);
    // Advance the tween partway (eased progress well below the midpoint).
    eraSystem.update(0.3);
    eraSystem.update(0.3);
    const state = eraSystem.getState();
    expect(state.phase).toBe('transitioning');
    expect(state.progress).toBeGreaterThan(0);
    expect(state.progress).toBeLessThan(0.5);
    expect(layer.deployedEra).toBe(1945); // discrete variant not swapped yet
    const midGlow = layer.maxGlowIntensity();
    expect(midGlow).toBeGreaterThan(lowGlow);
    expect(midGlow).toBeLessThan(highGlow);

    driveToSettled(eraSystem);
    runtime.step(1 / 60);
    expect(layer.currentEra).toBe(1985);
    expect(layer.lotBuildings.NW.variantKey).toBe('glass-neon-tower');
    expect(layer.maxGlowIntensity()).toBeCloseTo(highGlow, 5);

    runtime.dispose();
  });

  it('animates era advertisement panels through runtime frames', () => {
    const runtime = new SceneRuntime();
    const eraSystem = new EraSystem(1945);
    const layer = new BlockLayer({ eraSystem });
    runtime.attachLayer(layer);

    eraSystem.selectEra(1985);
    driveToSettled(eraSystem);
    runtime.step(1 / 60);

    const animatedAds = layer.advertisements.filter((ad) => ad.animated);
    expect(animatedAds.length).toBeGreaterThan(0);
    const panel = animatedAds[0].panelMaterial;
    const before = panel.emissiveIntensity;
    layer.update({ time: 1, delta: 1 / 60 });
    const after = panel.emissiveIntensity;
    expect(after).not.toBeCloseTo(before, 8);

    runtime.dispose();
  });
});