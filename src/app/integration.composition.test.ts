// @vitest-environment node
/**
 * integration.composition.test.ts — headless boot of the composed application.
 *
 * Boots AppComposition with a fake Web Audio context and no WebGL, rAF or DOM,
 * then walks all five slider stops through EraSystem.selectEra — the exact
 * method the timeline slider invokes — asserting every aspect transforms in
 * lockstep: buildings, storefronts, advertisements, street props, vehicles,
 * pedestrians, atmosphere, audio and navigation. Also verifies the slider
 * binding (composition.selectEra → EraSystem.selectEra), resize handling and
 * full teardown.
 */

import { describe, expect, it, vi } from 'vitest';
import { Color } from 'three';

import { ERA_IDS, ERAS, type EraId } from '../eras/eraSystem';
import { SceneRuntime } from '../core/sceneRuntime';
import { AppComposition, CONTROLLER_LAYER_ID } from './composition';
import { createFakeAudioContext } from '../audio/audioContextFake';
import { ATMOSPHERE_LAYER_ID } from '../atmosphere/atmosphereLayer';
import { PEDESTRIAN_LAYER_ID } from '../pedestrians/pedestrianLayer';
import { BUILDING_VARIANT_BY_ERA } from '../block/buildings';
import { BLOCK_LOT_IDS } from '../block/blockLayer';
import { TimelineUI } from '../ui/timeline';

const SLIDER_ORDER: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/** Advances the shared frame loop until the era tween settles. */
function driveToSettled(app: AppComposition, stepSeconds = 0.05, maxSteps = 2000): void {
  let guard = 0;
  while (app.eraSystem.getState().phase === 'transitioning' && guard < maxSteps) {
    app.runtime.step(stepSeconds);
    guard += 1;
  }
  expect(app.eraSystem.getState().phase).toBe('idle');
}

/** Sky color applied to the runtime scene by the atmosphere layer. */
function sceneSkyHex(app: AppComposition): string {
  const background = app.runtime.scene.background;
  expect(background).toBeInstanceOf(Color);
  return (background as Color).getHexString();
}

describe('AppComposition — composed city-block application', () => {
  it('boots headlessly with every layer registered on the initial era', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    // All five scene layers plus the per-frame controller are registered.
    expect(app.runtime.hasLayer('block')).toBe(true);
    expect(app.runtime.hasLayer('street-props')).toBe(true);
    expect(app.runtime.hasLayer('vehicles')).toBe(true);
    expect(app.runtime.hasLayer(PEDESTRIAN_LAYER_ID)).toBe(true);
    expect(app.runtime.hasLayer(ATMOSPHERE_LAYER_ID)).toBe(true);
    expect(app.runtime.hasLayer(CONTROLLER_LAYER_ID)).toBe(true);
    expect(app.runtime.layerCount).toBe(6);

    // Each layer root is attached to the runtime scene graph.
    const children = app.runtime.scene.children;
    expect(children).toContain(app.block.createRoot());
    expect(children).toContain(app.streetProps.createRoot());
    expect(children).toContain(app.vehicles.createRoot());
    expect(children).toContain(app.pedestrians.createRoot());
    expect(children).toContain(app.atmosphere.createRoot());

    // Controller-driven components exist and are bound to the era controller.
    expect(app.timeline).toBeInstanceOf(TimelineUI);
    expect(app.audio.nodeCount).toBeGreaterThan(0);
    expect(app.navigation.activeEraId).toBe(1945);

    // The slider exposes exactly the five required stops in registry order.
    expect(SLIDER_ORDER).toEqual([...ERA_IDS]);

    // The entire composition starts settled on 1945.
    expect(app.eraSystem.getState()).toMatchObject({ current: 1945, next: null, phase: 'idle' });
    expect(app.block.currentEra).toBe(1945);
    expect(app.streetProps.getState().activeEra).toBe(1945);
    expect(app.vehicles.currentEra).toBe(1945);
    expect(app.vehicles.count).toBeGreaterThan(0);
    expect(app.pedestrians.activeEra).toBe(1945);
    expect(app.pedestrians.pedestrianCount).toBeGreaterThan(0);
    expect(app.atmosphere.getState().eraId).toBe(1945);
    expect(sceneSkyHex(app)).toBe(ERAS[1945].palette.sky.slice(1).toLowerCase());
    expect(app.audio.activeEra).toBe(1945);

    app.dispose();
  });

  it('walks all five eras and transforms every aspect in lockstep', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    for (const eraId of SLIDER_ORDER) {
      // The timeline slider invokes exactly this method for its stops.
      app.selectEra(eraId);
      driveToSettled(app);
      app.runtime.step(1 / 60);

      const era = ERAS[eraId];
      expect(app.eraSystem.getState().current).toBe(eraId);

      // Buildings, storefronts and advertisements (BlockLayer).
      expect(app.block.currentEra).toBe(eraId);
      expect(app.block.deployedEra).toBe(eraId);
      for (const lotId of BLOCK_LOT_IDS) {
        expect(app.block.lotBuildings[lotId].variantKey).toBe(BUILDING_VARIANT_BY_ERA[eraId]);
      }
      expect(app.block.storefronts[0].signageKey).toBe(era.storefronts.signage);
      expect(app.block.advertisements[0].technology).toBe(era.advertisements.technology);

      // Street props.
      expect(app.streetProps.getState().activeEra).toBe(eraId);

      // Vehicles.
      expect(app.vehicles.currentEra).toBe(eraId);
      expect(app.vehicles.count).toBeGreaterThan(0);

      // Pedestrians with era outfits.
      expect(app.pedestrians.activeEra).toBe(eraId);
      expect(app.pedestrians.outfits().every((outfit) => outfit.era === eraId)).toBe(true);

      // Atmosphere (sky, fog, lighting).
      expect(app.atmosphere.getState().eraId).toBe(eraId);
      expect(sceneSkyHex(app)).toBe(era.palette.sky.slice(1).toLowerCase());

      // Audio ambience settled on the destination era.
      expect(app.audio.activeEra).toBe(eraId);

      // Navigation adopted the era's orbit envelope.
      expect(app.navigation.activeEraId).toBe(eraId);
    }

    // Four slider selections after the 1945 boot each fired the whoosh.
    expect(app.audio.stats.whooshes).toBe(ERA_IDS.length - 1);
    expect(app.audio.activeEra).toBe(2025);

    // The walk reverses cleanly back to 1945.
    app.selectEra(1945);
    driveToSettled(app);
    expect(app.block.currentEra).toBe(1945);
    expect(app.vehicles.currentEra).toBe(1945);
    expect(app.pedestrians.activeEra).toBe(1945);
    expect(app.audio.activeEra).toBe(1945);
    expect(sceneSkyHex(app)).toBe(ERAS[1945].palette.sky.slice(1).toLowerCase());

    app.dispose();
  });

  it('drives a mid-transition blend through the shared tween', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    app.selectEra(2025);
    expect(app.eraSystem.getState().next).toBe(2025);

    // Advance the frame loop partway through the 2s eased tween.
    for (let i = 0; i < 12; i += 1) app.runtime.step(1 / 30);
    const state = app.eraSystem.getState();
    expect(state.phase).toBe('transitioning');
    expect(state.progress).toBeGreaterThan(0);
    expect(state.progress).toBeLessThan(1);

    // Streett props defer until settle; atmosphere blends continuously.
    expect(app.streetProps.getState().pendingEra).toBe(2025);
    expect(app.streetProps.getState().activeEra).toBe(1945);
    expect(app.atmosphere.getState().transitioning).toBe(true);
    expect(app.vehicles.currentEra).toBe(2025); // discrete fleet swapped at selection

    driveToSettled(app);
    expect(app.eraSystem.getState()).toMatchObject({ current: 2025, next: null, phase: 'idle' });
    expect(app.streetProps.getState().activeEra).toBe(2025);
    expect(app.atmosphere.getState().transitioning).toBe(false);

    app.dispose();
  });

  it('binds slider selection to EraSystem.selectEra through the composition', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });
    const selectSpy = vi.spyOn(app.eraSystem, 'selectEra');

    // composition.selectEra is the onSelect handler wired into TimelineUI.
    app.selectEra(1985);
    expect(selectSpy).toHaveBeenCalledWith(1985);
    expect(app.eraSystem.getState().next).toBe(1985);

    driveToSettled(app);
    expect(app.eraSystem.getState().current).toBe(1985);

    app.dispose();
  });

  it('handles resize and disposes every owned resource idempotently', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    app.resize(800, 600);
    expect(app.runtime.camera.aspect).toBeCloseTo(800 / 600, 6);
    app.resize(1024, 768);
    expect(app.runtime.camera.aspect).toBeCloseTo(1024 / 768, 6);

    app.dispose();
    expect(app.isDisposed).toBe(true);
    expect(app.runtime.layerCount).toBe(0);
    expect(app.runtime.scene.children).toHaveLength(0);
    expect(app.audio.nodeCount).toBe(0);
    expect(app.eraSystem.getState().phase).toBe('idle');

    // Teardown is idempotent and safe to repeat.
    expect(() => app.dispose()).not.toThrow();
  });

  it('remains driven by any SceneRuntime frame loop (headless step or browser rAF)', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });
    expect(app.runtime.isRunning).toBe(false);

    // Headless: stepping the runtime advances the shared era tween through the
    // controller layer, exactly like the browser's rAF loop does.
    app.selectEra(2005);
    let guard = 0;
    while (app.eraSystem.getState().phase === 'transitioning' && guard < 2000) {
      app.runtime.step(0.05);
      guard += 1;
    }
    expect(app.block.currentEra).toBe(2005);
    expect(app.timeline).toBeDefined();

    app.dispose();
    expect(() => app.selectEra(1945)).toThrow(/disposed/i);
  });
});

describe('AppComposition standalone runtime contract', () => {
  it('supports headless construction with renderer:null and a null runtime', () => {
    // The composed graph never requires WebGL or a DOM; renderer stays null.
    const runtime = new SceneRuntime({ renderer: null });
    expect(runtime.layerCount).toBe(0);
    runtime.step(1 / 60); // frame loop advances without a renderer
    expect(runtime.isRunning).toBe(false);
    runtime.dispose();
  });
});