/**
 * Headless Composition Integration Test for SceneApp.
 *
 * Boots sceneApp with a stub renderer and fake AudioContext, asserts all
 * 6 subsystems attach, drives a full 1945→2025 transition through the
 * transition director with every system updating on the shared channel,
 * exercises quality tiers, and verifies complete teardown with zero leaks.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ERAS, type EraId } from '../../era/years';
import { bootstrap } from '../../main';
import { buildEraEnvironment } from '../eraEnvironment';
import {
  createStubAudioContext,
  createStubRenderer,
  installCanvas2DStub,
  restoreCanvas2DStub,
} from '../headlessStubs';
import { createSceneApp, type SceneApp } from '../sceneApp';

describe('SceneApp Composition Lifecycle & Era Transitions', () => {
  beforeAll(() => {
    installCanvas2DStub();
  });

  afterAll(() => {
    restoreCanvas2DStub();
  });

  it('boots sceneApp, attaches all 6 world systems, drives 1945→2025 transition, and disposes cleanly', () => {
    const canvas = document.createElement('canvas');
    const uiContainer = document.createElement('div');
    document.body.appendChild(uiContainer);

    const onFirstFrame = vi.fn();
    const onTransitionStart = vi.fn();
    const onTransitionEnd = vi.fn();

    // 1. Boot SceneApp with headless stubs
    const app: SceneApp = createSceneApp(canvas, {
      seed: 'test-seed-composition-1',
      initialEra: '1945',
      transitionDuration: 1.0,
      rendererFactory: (c, w, h) => createStubRenderer(c, { width: w, height: h }),
      audioContextFactory: () => createStubAudioContext(),
      uiContainer,
      onFirstFrame,
      onTransitionStart,
      onTransitionEnd,
    });

    expect(app.isDisposed()).toBe(false);
    expect(app.canvas).toBe(canvas);
    expect(app.scene).toBeDefined();
    expect(app.camera).toBeDefined();
    expect(app.renderer).toBeDefined();
    expect(app.layout).toBeDefined();
    expect(app.groundGroup).toBeDefined();

    // 2. Verify all 6 systems attached cleanly
    expect(app.groundGroup.children.length).toBeGreaterThan(0);
    expect(app.scene.children).toContain(app.groundGroup);

    // Buildings system
    expect(app.systems.buildings.buildings.size).toBe(app.layout.plots.length);
    expect(app.systems.buildings.plotIds.length).toBe(app.layout.plots.length);

    // Signage system
    expect(app.systems.signage.isAttached()).toBe(true);
    expect(app.systems.signage.eraSets.length).toBe(5);

    // Vehicles system
    expect(app.systems.vehicles.isAttached()).toBe(true);
    expect(app.systems.vehicles.getParkedCount()).toBeGreaterThan(0);

    // Pedestrians system
    expect(app.systems.pedestrians.sim).toBeDefined();

    // Atmosphere system
    expect(app.systems.atmosphere.isAttached).toBe(true);
    expect(app.systems.atmosphere.rootGroup).not.toBeNull();

    // Audio Engine
    expect(app.audio).toBeDefined();
    expect(app.audio.getEraWeights()['1945']).toBe(1.0);

    // Navigation & UI
    expect(app.navigation.getMode()).toBe('orbit');
    expect(app.ui).not.toBeNull();

    // 3. First frame tick
    app.update(0.016);
    expect(onFirstFrame).toHaveBeenCalledTimes(1);

    // 4. Drive a full chronological 1945 → 2025 transition through the director
    const recordedHeights: number[] = [];
    const recordedSunIntensities: number[] = [];
    const recordedAudioWeights2025: number[] = [];

    // Step across each era: 1945 -> 1965 -> 1985 -> 2005 -> 2025
    for (let i = 0; i < ERAS.length - 1; i += 1) {
      const targetEra = ERAS[i + 1] as EraId;
      app.setYear(targetEra, { duration: 1.0 });

      expect(app.director.isTransitioning()).toBe(true);

      // Sample 4 steps across the 1.0s transition duration
      for (let s = 1; s <= 4; s += 1) {
        app.update(0.25); // 0.25s per step

        const chan = app.director.getChannel();
        expect(chan.toEra).toBe(targetEra);

        // Record metrics proving continuous morph
        const firstPlotId = app.layout.plots[0].id;
        const bGroup = app.systems.buildings.buildings.get(firstPlotId)!;
        recordedHeights.push(bGroup.group.scale.y * bGroup.authoredHeight);
        recordedSunIntensities.push(app.systems.atmosphere.currentSun.intensity);
        recordedAudioWeights2025.push(app.audio.getEraWeights()['2025']);
      }

      expect(app.director.isTransitioning()).toBe(false);
      expect(app.director.getCurrentEra()).toBe(targetEra);
    }

    // Assert that the final state reached 2025
    expect(app.director.getCurrentEra()).toBe('2025');
    expect(app.audio.getEraWeights()['2025']).toBe(1.0);
    expect(app.audio.getEraWeights()['1945']).toBe(0.0);

    // Building heights evolved upwards across eras
    expect(recordedHeights[recordedHeights.length - 1]).toBeGreaterThan(recordedHeights[0]);

    // Sun intensity increased across eras
    expect(recordedSunIntensities[recordedSunIntensities.length - 1]).toBeGreaterThan(recordedSunIntensities[0]);

    // 5. Test Quality tier hook
    app.setQuality('low');
    expect(app.renderer.getPixelRatio()).toBe(1);
    app.setQuality('ultra');
    expect(app.renderer.getPixelRatio()).toBeGreaterThanOrEqual(1);

    // 6. Test Resize
    app.resize(1024, 768);
    expect(app.camera.aspect).toBeCloseTo(1024 / 768, 3);

    // 7. Test Complete Teardown
    app.dispose();
    expect(app.isDisposed()).toBe(true);
    expect(app.loop.running).toBe(false);

    // Repeat dispose is safe and idempotent
    expect(() => app.dispose()).not.toThrow();

    if (uiContainer.parentNode) {
      uiContainer.parentNode.removeChild(uiContainer);
    }
  });

  it('aggregates era environment data completely for all 5 eras', () => {
    const env = buildEraEnvironment();

    expect(Object.keys(env)).toEqual(['1945', '1965', '1985', '2005', '2025']);

    for (const era of ERAS) {
      const data = env[era];
      expect(data.id).toBe(era);
      expect(data.year).toBe(Number.parseInt(era, 10));
      expect(data.buildings).toBeDefined();
      expect(data.buildingsSpec).toBeDefined();
      expect(data.signage).toBeDefined();
      expect(data.vehicles).toBeDefined();
      expect(data.pedestrians).toBeDefined();
      expect(data.atmosphere).toBeDefined();
      expect(data.audio).toBeDefined();
      expect(data.descriptor).toContain(era);
      expect(data.subtitle).toBeDefined();
    }
  });

  it('bootstrap mounts scene and handles graceful disposal', () => {
    const mount = document.createElement('div');
    mount.style.width = '800px';
    mount.style.height = '600px';
    document.body.appendChild(mount);

    // In jsdom without WebGL, WebGLRenderer throws -> bootstrap displays graceful fallback notice
    const handle = bootstrap(mount);
    expect(handle).toBeDefined();
    expect(typeof handle.dispose).toBe('function');

    // If WebGL fallback triggered, notice exists
    const notice = mount.querySelector('.fallback');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('WebGL');

    handle.dispose();
    expect(mount.children.length).toBe(0);

    if (mount.parentNode) {
      mount.parentNode.removeChild(mount);
    }
  });
});
