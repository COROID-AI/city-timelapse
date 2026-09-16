// @vitest-environment node
//
// Atmosphere layer unit tests: per-era parameter derivation and procedural
// lighting / post-processing application. Runs in the default Node environment
// — three.js scene work needs no DOM and no WebGL renderer.

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Scene,
} from 'three';
import { describe, expect, it } from 'vitest';

import { type FrameState, SceneRuntime } from '../core/sceneRuntime';
import { ERA_IDS, ERAS, type EraId } from '../eras/eraSystem';
import {
  AtmosphereLayer,
  PostProcessingController,
  buildBrightPassShader,
  buildCompositeShader,
  deriveAtmosphereParams,
  lerpAtmosphereParams,
  type AtmosphereParams,
} from './atmosphereLayer';

describe('per-era atmosphere derivation', () => {
  it('derives a complete atmosphere vector for each of the five eras', () => {
    const byEra = new Map<EraId, AtmosphereParams>(
      ERA_IDS.map((id) => [id, deriveAtmosphereParams(ERAS[id])]),
    );
    expect(byEra.size).toBe(5);

    for (const id of ERA_IDS) {
      const params = byEra.get(id) as AtmosphereParams;
      const era = ERAS[id];
      // sky / fog / haze tint
      expect(params.skyColor).toBe(era.palette.sky.toLowerCase());
      expect(params.hazeColor).toBe(era.palette.haze.toLowerCase());
      expect(params.fogColor).toBe(era.atmosphere.fogColor.toLowerCase());
      expect(params.fogDensity).toBe(era.atmosphere.fogDensity);
      // sun elevation + warmth
      expect(params.sunElevationDeg).toBe(era.atmosphere.sunElevationDeg);
      expect(params.sunIntensity).toBe(era.atmosphere.sunIntensity);
      expect(params.sunColor).toBe(era.atmosphere.sunColor.toLowerCase());
      expect(params.sunAzimuthDeg).toBeGreaterThanOrEqual(0);
      // ambient + hemisphere light
      expect(params.ambientIntensity).toBe(era.atmosphere.ambientIntensity);
      expect(params.ambientColor).toBe(era.atmosphere.ambientColor.toLowerCase());
      expect(params.hemisphereSkyColor).toBe(era.atmosphere.ambientColor.toLowerCase());
      expect(params.hemisphereIntensity).toBeGreaterThan(0.1);
      // bloom + tone mapping / vignette theme
      expect(params.post.bloomStrength).toBe(era.atmosphere.bloom);
      expect(params.post.vignetteStrength).toBeGreaterThanOrEqual(0);
      expect(params.post.vignetteStrength).toBeLessThanOrEqual(1);
      expect(params.post.exposure).toBeGreaterThanOrEqual(0.6);
      expect(params.post.exposure).toBeLessThanOrEqual(1.25);
    }

    // All five eras resolve to distinct skies, fog tints and bloom strengths.
    expect(new Set([...byEra.values()].map((p) => p.skyColor)).size).toBe(5);
    expect(new Set([...byEra.values()].map((p) => p.fogColor)).size).toBe(5);
    expect(new Set([...byEra.values()].map((p) => p.post.bloomStrength)).size).toBe(5);
  });

  it('selects the era-appropriate tone mapping and vignette theme', () => {
    const themes = ERA_IDS.map((id) => deriveAtmosphereParams(ERAS[id]).post);
    // 1945 post-war dusk: muted grade, soft vignette, low bloom.
    expect(themes[0].toneMapping).toBe('muted');
    expect(themes[0].vignette).toBe('soft');
    // 1965 clear day: bright and clean.
    expect(themes[1].toneMapping).toBe('bright-clean');
    // 1985 neon-soaked night: noir grade, strongest bloom, cinematic vignette.
    expect(themes[2].toneMapping).toBe('neon-noir');
    expect(themes[2].vignette).toBe('cinematic');
    expect(themes[2].bloomStrength).toBe(ERAS[1985].atmosphere.bloom);
    expect(themes[2].bloomStrength).toBeGreaterThan(themes[0].bloomStrength);
    expect(themes[2].vignetteStrength).toBeGreaterThan(themes[1].vignetteStrength);
    // 2005 early digital: soft haze.
    expect(themes[3].toneMapping).toBe('soft-haze');
    // 2025 LED saturated: crisp grade, moderate bloom.
    expect(themes[4].toneMapping).toBe('crisp-led');
    expect(themes[4].bloomStrength).toBe(ERAS[2025].atmosphere.bloom);
    // Each era has its own post theme.
    expect(new Set(themes.map((t) => t.toneMapping)).size).toBe(5);
  });

  it('lerps atmosphere parameter groups toward the target era', () => {
    const from = deriveAtmosphereParams(ERAS[1945]);
    const to = deriveAtmosphereParams(ERAS[2025]);
    const mid = lerpAtmosphereParams(from, to, 0.25);

    expect(mid.fogDensity).toBeCloseTo(
      from.fogDensity + (to.fogDensity - from.fogDensity) * 0.25,
      8,
    );
    expect(mid.sunElevationDeg).toBeCloseTo(
      from.sunElevationDeg + (to.sunElevationDeg - from.sunElevationDeg) * 0.25,
      8,
    );
    expect(mid.post.bloomStrength).toBeCloseTo(
      from.post.bloomStrength + (to.post.bloomStrength - from.post.bloomStrength) * 0.25,
      8,
    );
    expect(mid.post.vignetteStrength).toBeCloseTo(
      from.post.vignetteStrength + (to.post.vignetteStrength - from.post.vignetteStrength) * 0.25,
      8,
    );
    // mid-blend sky is strictly between the two discrete era skies
    expect(mid.skyColor).not.toBe(from.skyColor);
    expect(mid.skyColor).not.toBe(to.skyColor);
    // endpoints snap exactly
    expect(lerpAtmosphereParams(from, to, 0).fogDensity).toBe(from.fogDensity);
    expect(lerpAtmosphereParams(from, to, 1).fogDensity).toBe(to.fogDensity);
  });
});

describe('procedural lighting controllers', () => {
  it('applies era parameters to the light rig, background and fog', () => {
    const scene = new Scene();
    const group = new Group();
    const layer = new AtmosphereLayer({ scene, initialEra: 1945 });
    layer.attach(group);

    // attach registers the light rig into the scene graph
    expect(group.children.some((child) => child.name === 'atmosphere:light-rig')).toBe(true);

    const { ambient, hemisphere, sun } = layer.controllers;
    expect(ambient).toBeInstanceOf(AmbientLight);
    expect(hemisphere).toBeInstanceOf(HemisphereLight);
    expect(sun).toBeInstanceOf(DirectionalLight);

    // 1945 post-war dusk: warm but dim sun, cool ambient fill, ground bounce
    expect(ambient.intensity).toBe(ERAS[1945].atmosphere.ambientIntensity);
    expect(ambient.color.getHexString()).toBe(ERAS[1945].atmosphere.ambientColor.slice(1));
    expect(hemisphere.groundColor.getHexString()).toBe(ERAS[1945].palette.ground.slice(1));
    expect(sun.intensity).toBe(ERAS[1945].atmosphere.sunIntensity);
    expect(sun.color.getHexString()).toBe(ERAS[1945].atmosphere.sunColor.slice(1));
    expect(sun.position.y).toBeGreaterThan(0); // 14° above the horizon

    // sky + fog applied to the scene
    expect(scene.background).toBeInstanceOf(Color);
    expect((scene.background as Color).getHexString()).toBe(ERAS[1945].palette.sky.slice(1));
    expect(scene.fog).toBeInstanceOf(FogExp2);
    expect((scene.fog as FogExp2).color.getHexString()).toBe(ERAS[1945].atmosphere.fogColor.slice(1));
    expect((scene.fog as FogExp2).density).toBe(ERAS[1945].atmosphere.fogDensity);

    // 1985 neon night: sun drops near the horizon and dims below the fill
    const sunY1945 = sun.position.y;
    layer.applyEra(1985, 1);
    expect(sun.intensity).toBe(ERAS[1985].atmosphere.sunIntensity);
    expect(sun.position.y).toBeLessThan(sunY1945);
    expect(sun.intensity).toBeLessThan(ambient.intensity);
    expect((scene.background as Color).getHexString()).toBe(ERAS[1985].palette.sky.slice(1));
  });

  it('updates per frame from the selected era', () => {
    const runtime = new SceneRuntime({ scene: new Scene() });
    const layer = new AtmosphereLayer({ scene: runtime.scene, initialEra: 1945 });
    runtime.attachLayer(layer);

    layer.applyEra(2005, 1);
    runtime.step(0.016); // per-frame update applies the era to the graph
    expect((runtime.scene.background as Color).getHexString()).toBe(
      ERAS[2005].palette.sky.slice(1),
    );
    expect(layer.controllers.sun.intensity).toBe(ERAS[2005].atmosphere.sunIntensity);
    expect(layer.postProcessing.bloomStrength).toBe(ERAS[2005].atmosphere.bloom);

    layer.applyEra(1985, 1);
    runtime.step(0.016);
    expect((runtime.scene.background as Color).getHexString()).toBe(
      ERAS[1985].palette.sky.slice(1),
    );
    expect((runtime.scene.fog as FogExp2).density).toBe(ERAS[1985].atmosphere.fogDensity);
  });
});

describe('applyEra transition blending', () => {
  it('lerps sky, fog, lighting and post-processing while transitioning', () => {
    const scene = new Scene();
    const layer = new AtmosphereLayer({ scene, initialEra: 1945 });
    layer.attach(scene);

    layer.applyEra(1965, 0.5);
    const state = layer.getState();
    expect(state.transitioning).toBe(true);
    expect(state.progress).toBeCloseTo(0.5, 8);
    expect(state.target).toBe(1965);
    expect(state.eraId).toBe(1945);

    const from = deriveAtmosphereParams(ERAS[1945]);
    const to = deriveAtmosphereParams(ERAS[1965]);
    expect(state.params.fogDensity).toBeGreaterThan(to.fogDensity);
    expect(state.params.fogDensity).toBeLessThan(from.fogDensity);
    expect(state.params.sunElevationDeg).toBeGreaterThan(from.sunElevationDeg);
    expect(state.params.sunElevationDeg).toBeLessThan(to.sunElevationDeg);
    expect(state.params.skyColor).not.toBe(from.skyColor);
    expect(state.params.skyColor).not.toBe(to.skyColor);
    // the blended state is exactly what the scene shows right now
    expect((scene.fog as FogExp2).density).toBe(state.params.fogDensity);

    // completing the tween settles on the era and applies its exact parameters
    layer.applyEra(1965, 1);
    expect(layer.getState().transitioning).toBe(false);
    expect(layer.getState().eraId).toBe(1965);
    expect(layer.getState().params.skyColor).toBe(to.skyColor);
    expect(layer.postProcessing).toEqual(to.post);

    // re-applying the settled era is a no-op
    const before = layer.getState();
    layer.applyEra(1965, 1);
    expect(layer.getState()).toEqual(before);
  });
});

describe('dispose', () => {
  it('clears scene effects and makes the layer inert', () => {
    const scene = new Scene();
    const group = new Group();
    scene.add(group);
    const layer = new AtmosphereLayer({ scene, initialEra: 1945 });
    layer.attach(group);
    expect(scene.background).not.toBeNull();
    expect(scene.fog).not.toBeNull();

    layer.dispose();
    expect(scene.background).toBeNull();
    expect(scene.fog).toBeNull();
    expect(group.children).toHaveLength(0);
    expect(() => layer.applyEra(1965, 1)).toThrow(/disposed/i);
    expect(() => layer.attach(group)).toThrow(/disposed/i);

    // update() becomes a no-op after disposal
    const frame: FrameState = { time: 1, delta: 0.016 };
    expect(() => layer.update(frame)).not.toThrow();
    expect(scene.background).toBeNull();
    expect(scene.fog).toBeNull();
  });
});

describe('code-only post-processing effects', () => {
  it('exposes era-driven uniforms and shader sources', () => {
    const params = deriveAtmosphereParams(ERAS[1985]).post;
    const controller = new PostProcessingController(params);
    expect(controller.snapshot.toneMapping).toBe('neon-noir');

    const uniforms = controller.toUniforms();
    expect(uniforms.uBloomStrength).toBe(ERAS[1985].atmosphere.bloom);
    expect(uniforms.uBloomThreshold).toBeLessThan(0.4); // low bar → neon glows
    expect(uniforms.uVignetteColor).toHaveLength(3);

    const bright = controller.brightPass;
    const composite = controller.composite;
    expect(bright.vertexShader).toContain('gl_Position');
    expect(bright.fragmentShader).toMatch(/uBloomThreshold/);
    expect(bright.fragmentShader).toMatch(/smoothstep/);
    expect(composite.fragmentShader).toMatch(/filmic/);
    expect(composite.fragmentShader).toMatch(/vignette/);
    expect(composite.fragmentShader).toContain('neon-noir');

    // re-configuring for a far less glowy era lowers the bloom pass
    controller.configure(deriveAtmosphereParams(ERAS[1945]).post);
    expect(controller.toUniforms().uBloomStrength).toBe(ERAS[1945].atmosphere.bloom);
    expect(controller.brightPass.fragmentShader).toContain('muted');
  });

  it('builds shader fragments directly from post-processing params', () => {
    const params = deriveAtmosphereParams(ERAS[2025]).post;
    expect(params.toneMapping).toBe('crisp-led');
    expect(buildBrightPassShader(params)).toMatch(/uBloomStrength/);
    expect(buildCompositeShader(params)).toContain('crisp-led');
  });
});