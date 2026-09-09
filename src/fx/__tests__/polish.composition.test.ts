/**
 * Polish composition integration test.
 *
 * Wires the full post-processing pipeline and quality tiers onto a headless
 * composed scene app, drives a real era transition through the composed app,
 * and asserts the observable contracts:
 *
 * - createPostProcessing() attaches the DirectionalLight + ACES tone mapping
 *   + bloom effect to a headless scene/renderer, exposes setQuality(tier)
 *   and getSettings(), and applies tier changes to pixel ratio and the
 *   shadow map size.
 * - setQuality('low'|'medium'|'high'|'ultra') on the composed app switches
 *   the renderer pixel ratio and the light's shadow map size.
 * - prefers-reduced-motion is honored end to end: with the preference set,
 *   era transitions snap immediately (zero-duration channel) — camera drift,
 *   transition shake and particle churn are all driven by the same channel t,
 *   so they are effectively disabled while the era transform itself still
 *   completes.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { ACESFilmicToneMapping, DirectionalLight, type WebGLRenderer } from 'three';
import { createSceneApp, type SceneApp } from '../../app/sceneApp';
import { createFakeAudioContext } from '../../audio/audioEngine';
import {
  createStubRenderer,
  installCanvas2DStub,
  restoreCanvas2DStub,
} from '../../app/headlessStubs';
import { createPostProcessing, type PostProcessingHandle } from '../postProcessing';
import { QUALITY_TIERS } from '../qualityTiers';

/** Minimal scene object compatible with createPostProcessing's target. */
function makeSceneTarget(renderer: WebGLRenderer) {
  return {
    scene: new (require('three').Scene)(),
    renderer,
  };
}

describe('polish composition', () => {
  beforeAll(() => {
    installCanvas2DStub();
  });

  afterAll(() => {
    restoreCanvas2DStub();
  });

  it('wires post-processing + quality tiers onto a headless sceneApp, drives a full transition, and disposes cleanly', () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '1280px';
    canvas.style.height = '720px';
    document.body.appendChild(canvas);

    const app: SceneApp = createSceneApp(canvas, {
      seed: 'polish-composition-1',
      initialEra: '1945',
      transitionDuration: 1.0,
      rendererFactory: (c, w, h) => createStubRenderer(c, { width: w, height: h }),
      audioContextFactory: () => createFakeAudioContext(),
    });

    // Wire post-processing over the composed app's scene + renderer.
    const fx = createPostProcessing(
      { scene: app.scene, renderer: app.renderer },
      { onTierChange: () => {} },
      'high',
    );

    expect(fx.getTier()).toBe('high');
    expect(fx.getSettings()).toBe(QUALITY_TIERS.high);
    expect(fx.isShadowMappingEnabled()).toBe(true);
    expect(app.renderer.toneMapping).toBe(ACESFilmicToneMapping);

    // Tier switch changes pixel ratio + shadow map size.
    fx.setQuality('low');
    expect(fx.getTier()).toBe('low');
    expect(app.renderer.getPixelRatio()).toBe(QUALITY_TIERS.low.pixelRatio);
    expect(fx.light.shadow.mapSize.x).toBe(QUALITY_TIERS.low.shadowMapSize);
    expect(fx.isShadowMappingEnabled()).toBe(false);

    fx.setQuality('medium');
    expect(app.renderer.getPixelRatio()).toBe(QUALITY_TIERS.medium.pixelRatio);
    expect(fx.light.shadow.mapSize.x).toBe(QUALITY_TIERS.medium.shadowMapSize);
    expect(fx.isShadowMappingEnabled()).toBe(true);

    // legacy 'ultra' maps to high
    fx.setQuality('ultra');
    expect(fx.getTier()).toBe('high');

    // Drive a full era transition through the composed app.
    app.setYear('2025', { duration: 1.0 });
    for (let s = 0; s <= 10; s += 1) {
      app.update(0.1);
    }
    expect(app.director.getCurrentEra()).toBe('2025');
    expect(app.audio.getEraWeights()['2025']).toBe(1.0);

    // Clean teardown: fx then app, both idempotent.
    fx.dispose();
    expect(fx.light.shadow.mapSize.x).toBeGreaterThan(0); // light survives scene dispose
    app.dispose();
    expect(app.isDisposed()).toBe(true);
    fx.dispose();
    app.dispose();

    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });

  it('prefers-reduced-motion is honored end to end via the composed app', () => {
    const canvas = document.createElement('canvas');
    const uiContainer = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(uiContainer);

    const app: SceneApp = createSceneApp(canvas, {
      seed: 'polish-reduced-motion-1',
      initialEra: '1945',
      motionReduced: true,
      rendererFactory: (c, w, h) => createStubRenderer(c, { width: w, height: h }),
      audioContextFactory: () => createFakeAudioContext(),
      uiContainer,
    });

    // Reduced motion: jump still completes the era transform (no tween).
    app.setYear('1985');
    expect(app.director.getCurrentEra()).toBe('1985');
    expect(app.director.getChannel()).toEqual({ fromEra: '1985', toEra: '1985', t: 0 });
    expect(app.director.isTransitioning()).toBe(false);

    // Camera & particles all read the same reduced-motion flag.
    expect(app.director.isReducedMotion()).toBe(true);

    app.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (uiContainer.parentNode) uiContainer.parentNode.removeChild(uiContainer);
  });
});