/**
 * Atmosphere era-state tests — prove the atmosphere domain against the real
 * shared contracts:
 *
 * - era moods (sooty 1945, warm 1965, smog-orange/neon-night 1985, crisp 2005,
 *   clear green-tinged 2025) for sky, sun, lighting, fog, weather, and
 *   emissive glow;
 * - `EraTransformable` registration at the `lights` stage and crossfades
 *   driven by the real `EraMorphDriver` registry with no popping;
 * - emissive tuning sourced from the real `ProceduralGfxLibrary` palettes and
 *   particles built with the library's instancing helpers;
 * - restrained post-processing (bounded bloom/vignette/exposure) with a
 *   non-interactive vignette that cannot obscure the timeline UI.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createEraMorphSystem,
  createEraTransformRegistry,
  stageOffset,
} from '../era/contracts';
import type { EraTransformable } from '../era/contracts';
import { ERA_YEARS, blendForYear } from '../era/timeline';
import { ProceduralGfxLibrary } from '../gfx/materials';
import {
  ATMOSPHERE_DAY_CORES,
  ATMOSPHERE_NIGHT_CORES,
  ATMOSPHERE_STAGE,
  createAtmosphere,
  type AtmosphereModule,
  type CreateAtmosphereOptions,
} from './atmosphere';
import { SKY_DAY_STATES, createSkyDome, lerpSkyState, sunDirection } from './sky';
import { ERA_WEATHER, PARTICLE_KINDS } from './weather';
import { createPostFx } from './postfx';

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function createHarness(overrides: Partial<CreateAtmosphereOptions> = {}) {
  const scene = new THREE.Scene();
  const registry = createEraTransformRegistry();
  const atmosphere = createAtmosphere({
    scene,
    registry,
    container: document.body,
    ...overrides,
  });
  cleanup.push(() => atmosphere.dispose());
  return { scene, registry, atmosphere };
}

/** Drive the module to a pure era stop (optionally at the night option). */
function applyYear(atmosphere: AtmosphereModule, year: number, nightMix = 0): void {
  atmosphere.setNightMix(nightMix);
  atmosphere.applyEraBlend(blendForYear(year), stageOffset('lights'), 1);
}

interface EraSnapshot {
  fogNear: number;
  fogFar: number;
  fogColor: THREE.Color;
  zenith: THREE.Color;
  horizon: THREE.Color;
  sunElevation: number;
  keyColor: THREE.Color;
  keyIntensity: number;
  fillIntensity: number;
  ambientIntensity: number;
  streetColor: THREE.Color;
  streetIntensity: number;
  neonIntensity: number;
}

function snapshot(atmosphere: AtmosphereModule): EraSnapshot {
  const { fog, lighting, sky, emissive } = atmosphere.state;
  return {
    fogNear: fog.near,
    fogFar: fog.far,
    fogColor: fog.color.clone(),
    zenith: sky.zenith.clone(),
    horizon: sky.horizon.clone(),
    sunElevation: sky.sunElevationDeg,
    keyColor: lighting.keyColor.clone(),
    keyIntensity: lighting.keyIntensity,
    fillIntensity: lighting.fillIntensity,
    ambientIntensity: lighting.ambientIntensity,
    streetColor: emissive.streetlightColor.clone(),
    streetIntensity: emissive.streetlightIntensity,
    neonIntensity: emissive.neonIntensity,
  };
}

function colorSpread(color: THREE.Color): number {
  const channels = [color.r, color.g, color.b];
  return Math.max(...channels) - Math.min(...channels);
}

function maxStep(values: readonly number[]): number {
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    max = Math.max(max, Math.abs(values[i] - values[i - 1]));
  }
  return max;
}

function colorDistance(a: THREE.Color, b: THREE.Color): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function maxColorStep(colors: readonly THREE.Color[]): number {
  let max = 0;
  for (let i = 1; i < colors.length; i += 1) {
    max = Math.max(max, colorDistance(colors[i], colors[i - 1]));
  }
  return max;
}

describe('era sky, sun, lighting, and fog moods', () => {
  it('produces sooty 1945, warm 1965, smog-orange 1985, crisp 2005, clear green 2025', () => {
    const { atmosphere } = createHarness();
    const snaps = new Map<number, EraSnapshot>();
    for (const year of ERA_YEARS) {
      applyYear(atmosphere, year);
      snaps.set(year, snapshot(atmosphere));
    }
    const s1945 = snaps.get(1945)!;
    const s1965 = snaps.get(1965)!;
    const s1985 = snaps.get(1985)!;
    const s2005 = snaps.get(2005)!;
    const s2025 = snaps.get(2025)!;

    // 1945: densest, warm soot haze; low dim sun; weak sodium street spill.
    expect(s1945.fogFar).toBeLessThan(s1965.fogFar);
    expect(s1945.fogFar).toBeLessThan(s2005.fogFar);
    expect(s1945.fogNear).toBeLessThan(s2005.fogNear);
    expect(s1945.fogColor.r).toBeGreaterThan(s1945.fogColor.b);
    expect(s1945.sunElevation).toBeLessThan(s2025.sunElevation);
    expect(s1945.streetIntensity).toBeLessThan(s2005.streetIntensity);
    expect(colorSpread(s1945.streetColor)).toBeGreaterThan(0.5);

    // 1965: warm sunlight and mild smog — hazier than 2005, clearer than 1945.
    expect(s1965.horizon.r).toBeGreaterThan(s1965.horizon.b);
    expect(s1965.fogFar).toBeGreaterThan(s1945.fogFar);
    expect(s1965.fogFar).toBeLessThan(s2005.fogFar);
    expect(s1965.keyColor.r).toBeGreaterThan(s1965.keyColor.b);

    // 1985: smog-orange horizon (r > g > b).
    expect(s1985.horizon.r).toBeGreaterThan(s1985.horizon.g);
    expect(s1985.horizon.g).toBeGreaterThan(s1985.horizon.b);
    expect(s1985.fogFar).toBeLessThan(s2005.fogFar);

    // 2005: crisp blue sky, distant fog, clean near-white streetlight spill.
    expect(s2005.zenith.b - s2005.zenith.r).toBeGreaterThan(0.3);
    expect(s2005.fogFar).toBeGreaterThan(s1965.fogFar);
    expect(colorSpread(s2005.streetColor)).toBeLessThan(0.15);

    // 2025: clear, green-tinged daylight, the clearest air of the set.
    expect(s2025.keyColor.g).toBeGreaterThan(s2025.keyColor.r);
    expect(s2025.keyColor.g).toBeGreaterThan(s2025.keyColor.b);
    expect(s2025.horizon.g).toBeGreaterThan(s2025.horizon.r);
    expect(s2025.horizon.g).toBeGreaterThan(s2025.horizon.b);
    expect(s2025.fogFar).toBeGreaterThan(s2005.fogFar);
    expect(s2025.sunElevation).toBeGreaterThan(s1945.sunElevation);

    // Lighting hierarchy holds at every era: key beats fill beats none...
    for (const year of ERA_YEARS) {
      const snap = snaps.get(year)!;
      expect(snap.fillIntensity).toBeLessThan(snap.keyIntensity);
      expect(snap.ambientIntensity).toBeLessThan(snap.keyIntensity);
      expect(snap.keyIntensity).toBeGreaterThan(0);
    }
  });

  it('drives fog, background, and the key light from the blended sky sun', () => {
    // Mirror the app shell: a directional sun and hemisphere light already exist.
    const scene = new THREE.Scene();
    const shellSun = new THREE.DirectionalLight(0xfff3dd, 2.1);
    shellSun.name = 'sunLight';
    const shellHemi = new THREE.HemisphereLight(0xdfeaff, 0x4a4438, 0.85);
    shellHemi.name = 'hemisphereLight';
    scene.add(shellSun, shellHemi);

    const registry = createEraTransformRegistry();
    const atmosphere = createAtmosphere({ scene, registry, container: document.body });
    cleanup.push(() => atmosphere.dispose());
    applyYear(atmosphere, 1965);

    // Scene fog is applied and matches the era fog state exactly.
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    const fog = scene.fog as THREE.Fog;
    expect(fog.far).toBeGreaterThan(fog.near);
    expect(fog.color.getHex()).toBe(atmosphere.state.fog.color.getHex());

    // Background matches the horizon; sky dome is attached.
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect((scene.background as THREE.Color).getHex()).toBe(atmosphere.state.sky.horizon.getHex());
    expect(scene.getObjectByName('atmosphereSkyDome')).toBeDefined();

    // Key direction is the sky's sun direction, and the light sits on it.
    const sun = sunDirection(atmosphere.state.sky);
    expect(atmosphere.state.lighting.keyDirection.distanceTo(sun)).toBeLessThan(1e-9);
    expect(atmosphere.lights.key.position.clone().normalize().distanceTo(sun)).toBeLessThan(1e-5);
    expect(sun.y).toBeGreaterThan(0);

    // Fill comes from the opposite azimuth.
    const keyDir = atmosphere.state.lighting.keyDirection;
    const fillDir = atmosphere.lights.fill.position.clone().normalize();
    const keyFlat = new THREE.Vector2(keyDir.x, keyDir.z).normalize();
    const fillFlat = new THREE.Vector2(fillDir.x, fillDir.z).normalize();
    expect(keyFlat.dot(fillFlat)).toBeLessThan(-0.5);

    // The shell's own lights are reused and driven, not duplicated.
    expect(atmosphere.lights.ownsKey).toBe(false);
    expect(atmosphere.lights.ownsHemisphere).toBe(false);
    expect(atmosphere.lights.key).toBe(shellSun);
    expect(atmosphere.lights.key.name).toBe('sunLight');
    expect(atmosphere.lights.key.color.getHex()).toBe(atmosphere.state.lighting.keyColor.getHex());
    expect(atmosphere.lights.hemisphere).toBe(shellHemi);
    expect(atmosphere.lights.hemisphere.name).toBe('hemisphereLight');
    expect(atmosphere.lights.hemisphere.intensity).toBeGreaterThan(0);
    expect(atmosphere.lights.fill.name).toBe('atmosphereFillLight');
    expect(atmosphere.lights.ambient.name).toBe('atmosphereAmbientLight');
  });

  it('keeps post-processing restrained: bounded bloom, vignette, and exposure', () => {
    const { atmosphere } = createHarness();
    for (const year of ERA_YEARS) {
      for (const nightMix of [0, 1]) {
        applyYear(atmosphere, year, nightMix);
        const { bloomStrength, vignette, exposure } = atmosphere.state.postFx;
        expect(bloomStrength).toBeGreaterThan(0);
        expect(bloomStrength).toBeLessThanOrEqual(0.65);
        expect(vignette).toBeGreaterThanOrEqual(0.2);
        expect(vignette).toBeLessThanOrEqual(0.75);
        expect(exposure).toBeGreaterThan(0.85);
        expect(exposure).toBeLessThan(1.15);
      }
    }
  });
});

describe('era emissive glow and the neon night option', () => {
  it('sources neon glow from the real ProceduralGfxLibrary era palettes', () => {
    const { atmosphere } = createHarness();
    for (const year of ERA_YEARS) {
      applyYear(atmosphere, year);
      const swatch = ProceduralGfxLibrary.getEraPalette(year).materials.neonEmissive;
      expect(swatch.emissive).toBeDefined();
      expect(atmosphere.state.emissive.neonColor.getHexString().toLowerCase()).toBe(
        swatch.emissive!.slice(1).toLowerCase(),
      );
      expect(atmosphere.state.emissive.neonIntensity).toBeCloseTo(swatch.emissiveIntensity ?? 1, 5);
      expect(atmosphere.state.emissive.windowIntensity).toBeGreaterThan(0);
      expect(atmosphere.state.emissive.streetlightIntensity).toBeGreaterThan(0);
    }
  });

  it('powers up the 1985 smoggy neon night: darker sky, strongest bloom', () => {
    const { atmosphere } = createHarness();
    applyYear(atmosphere, 1985, 0);
    const day = snapshot(atmosphere);
    const dayBloom = atmosphere.state.postFx.bloomStrength;

    applyYear(atmosphere, 1985, 1);
    const night = snapshot(atmosphere);
    const nightBloom = atmosphere.state.postFx.bloomStrength;

    expect(night.zenith.r + night.zenith.g + night.zenith.b).toBeLessThan(
      day.zenith.r + day.zenith.g + day.zenith.b,
    );
    expect(night.neonIntensity).toBeGreaterThan(day.neonIntensity * 1.8);
    expect(night.streetIntensity).toBeGreaterThan(day.streetIntensity);
    expect(nightBloom).toBeGreaterThan(dayBloom);
    expect(atmosphere.state.emissive.windowIntensity).toBeGreaterThan(0.6);

    // The 1985 night is the bloom peak of the whole era set.
    const blooms = ERA_YEARS.map((year) => {
      applyYear(atmosphere, year, 1);
      return atmosphere.state.postFx.bloomStrength;
    });
    expect(Math.max(...blooms)).toBeCloseTo(blooms[ERA_YEARS.indexOf(1985)], 5);
  });
});

describe('era transform composition with the real shared contracts', () => {
  it('implements EraTransformable at the lights stage and auto-registers', () => {
    const { registry, atmosphere } = createHarness();
    const asTransformable: EraTransformable = atmosphere;
    expect(asTransformable.stage).toBe(ATMOSPHERE_STAGE);
    expect(atmosphere.stage).toBe('lights');
    expect(registry.has(atmosphere)).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.members[0]).toBe(atmosphere);
    expect(atmosphere.name).toBe('atmosphere');
  });

  it('crossfades 1945 -> 1985 through the real morph driver with no popping', () => {
    const scene = new THREE.Scene();
    const system = createEraMorphSystem();
    const atmosphere = createAtmosphere({
      scene,
      registry: system.registry,
      container: document.body,
    });
    cleanup.push(() => atmosphere.dispose());
    expect(system.registry.has(atmosphere)).toBe(true);

    const fogSamples = [atmosphere.state.fog.far];
    const neonSamples = [atmosphere.state.emissive.neonIntensity];
    const zenithSamples = [atmosphere.state.sky.zenith.clone()];

    const target = system.driver.transitionTo(1985, 2);
    expect(target).toBe(1985);

    let frames = 0;
    while (system.driver.isTransitioning && frames < 600) {
      system.driver.advance(1 / 60);
      frames += 1;
      fogSamples.push(atmosphere.state.fog.far);
      neonSamples.push(atmosphere.state.emissive.neonIntensity);
      zenithSamples.push(atmosphere.state.sky.zenith.clone());
    }
    expect(frames).toBeGreaterThan(60);

    // Settled exactly on the pure 1985 era state.
    expect(atmosphere.state.eraBlend).toEqual({ from: 1985, to: 2005, fraction: 0 });
    expect(atmosphere.state.fog.far).toBeCloseTo(ATMOSPHERE_DAY_CORES[1985].fogFar, 6);
    expect(atmosphere.state.emissive.neonIntensity).toBeCloseTo(
      ATMOSPHERE_DAY_CORES[1985].neonIntensity,
      6,
    );

    // Continuity: every per-frame step stays far below the total change, so a
    // discontinuity (a pop) of a whole era's delta would fail this bound.
    const fogRange = Math.abs(fogSamples[fogSamples.length - 1] - fogSamples[0]);
    const neonRange = Math.abs(neonSamples[neonSamples.length - 1] - neonSamples[0]);
    const zenithRange = colorDistance(
      zenithSamples[zenithSamples.length - 1],
      zenithSamples[0],
    );
    expect(maxStep(fogSamples)).toBeLessThan(fogRange / 6);
    expect(maxStep(neonSamples)).toBeLessThan(neonRange / 6);
    expect(maxColorStep(zenithSamples)).toBeLessThan(zenithRange / 6);
  });

  it('records the lights-stage dispatch offset and progress from the registry', () => {
    const scene = new THREE.Scene();
    const system = createEraMorphSystem();
    const atmosphere = createAtmosphere({ scene, registry: system.registry });
    cleanup.push(() => atmosphere.dispose());

    system.driver.transitionTo(2025, 1);
    let guard = 0;
    while (system.driver.isTransitioning && guard++ < 300) system.driver.advance(1 / 60);

    expect(atmosphere.lastDispatch).not.toBeNull();
    expect(atmosphere.lastDispatch!.stageOffset).toBeCloseTo(stageOffset('lights'), 10);
    expect(atmosphere.lastDispatch!.progress).toBeCloseTo(1, 10);
    expect(atmosphere.lastDispatch!.blend).toEqual({ from: 2005, to: 2025, fraction: 1 });
  });

  it('mid-segment dispatch equals the weighted average of the era stops', () => {
    const { registry, atmosphere } = createHarness();
    registry.dispatch({ from: 1945, to: 1965, fraction: 0.5 }, 0);

    const expectedFog =
      (ATMOSPHERE_DAY_CORES[1945].fogFar + ATMOSPHERE_DAY_CORES[1965].fogFar) / 2;
    const expectedNeon =
      (ATMOSPHERE_DAY_CORES[1945].neonIntensity + ATMOSPHERE_DAY_CORES[1965].neonIntensity) / 2;
    const expectedZenith =
      (SKY_DAY_STATES[1945].zenith.r + SKY_DAY_STATES[1965].zenith.r) / 2;

    expect(atmosphere.state.eraBlend).toEqual({ from: 1945, to: 1965, fraction: 0.5 });
    expect(atmosphere.state.fog.far).toBeCloseTo(expectedFog, 4);
    expect(atmosphere.state.emissive.neonIntensity).toBeCloseTo(expectedNeon, 5);
    expect(atmosphere.state.sky.zenith.r).toBeCloseTo(expectedZenith, 5);
  });

  it('crossfades every adjacent era pair continuously across the whole grid', () => {
    const { registry, atmosphere } = createHarness();

    for (let i = 0; i < ERA_YEARS.length - 1; i += 1) {
      const from = ERA_YEARS[i];
      const to = ERA_YEARS[i + 1];
      const fog: number[] = [];
      const neon: number[] = [];
      const soot: number[] = [];
      const zenith: THREE.Color[] = [];

      for (let step = 0; step <= 40; step += 1) {
        registry.dispatch({ from, to, fraction: step / 40 }, 0);
        fog.push(atmosphere.state.fog.far);
        neon.push(atmosphere.state.emissive.neonIntensity);
        soot.push(atmosphere.state.weather.soot);
        zenith.push(atmosphere.state.sky.zenith.clone());
      }

      const fogBound = Math.max(Math.abs(fog[40] - fog[0]) / 12, 1e-9);
      const neonBound = Math.max(Math.abs(neon[40] - neon[0]) / 12, 1e-9);
      const sootBound = Math.max(Math.abs(soot[40] - soot[0]) / 12, 1e-9);
      const zenithBound = Math.max(colorDistance(zenith[40], zenith[0]) / 12, 1e-9);

      expect(maxStep(fog)).toBeLessThanOrEqual(fogBound);
      expect(maxStep(neon)).toBeLessThanOrEqual(neonBound);
      expect(maxStep(soot)).toBeLessThanOrEqual(sootBound);
      expect(maxColorStep(zenith)).toBeLessThanOrEqual(zenithBound);
    }
  });

  it('crossfades the day/night option continuously within an era', () => {
    const { atmosphere } = createHarness();
    applyYear(atmosphere, 1985, 0);

    const fog: number[] = [];
    const neon: number[] = [];
    const zenith: THREE.Color[] = [];
    for (let step = 0; step <= 40; step += 1) {
      atmosphere.setNightMix(step / 40);
      fog.push(atmosphere.state.fog.far);
      neon.push(atmosphere.state.emissive.neonIntensity);
      zenith.push(atmosphere.state.sky.zenith.clone());
    }

    expect(atmosphere.state.fog.far).toBeCloseTo(ATMOSPHERE_NIGHT_CORES[1985].fogFar, 6);
    expect(maxStep(fog)).toBeLessThanOrEqual(Math.max(Math.abs(fog[40] - fog[0]) / 12, 1e-9));
    expect(maxStep(neon)).toBeLessThanOrEqual(Math.max(Math.abs(neon[40] - neon[0]) / 12, 1e-9));
    expect(maxColorStep(zenith)).toBeLessThanOrEqual(
      Math.max(colorDistance(zenith[40], zenith[0]) / 12, 1e-9),
    );
  });
});

describe('era weather particles', () => {
  it('builds instanced era particles and tracks the era particle mix', () => {
    const { scene, atmosphere } = createHarness();

    for (const kind of PARTICLE_KINDS) {
      const mesh = atmosphere.weather.meshes[kind];
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.name).toBe(`atmosphere-${kind}`);
      expect((mesh.material as THREE.Material).transparent).toBe(true);
    }
    expect(scene.getObjectByName('atmosphereWeather')).toBeDefined();

    // Era particle mix: soot rules 1945 and disappears by 2005; the 1945
    // drizzle is present but far weaker than 1985's rain.
    expect(ERA_WEATHER[1945].soot).toBeGreaterThan(ERA_WEATHER[2005].soot);
    expect(ERA_WEATHER[1945].rain).toBeLessThan(ERA_WEATHER[1985].rain);
    applyYear(atmosphere, 1945);
    expect(atmosphere.state.weather.soot).toBe(1);
    expect(atmosphere.weather.meshes.soot.visible).toBe(true);
    const rainOpacity1945 = (atmosphere.weather.meshes.rain.material as THREE.MeshBasicMaterial)
      .opacity;

    applyYear(atmosphere, 1985);
    expect(atmosphere.weather.meshes.soot.visible).toBe(true);
    expect(atmosphere.weather.meshes.rain.visible).toBe(true);
    expect(atmosphere.weather.meshes.snow.visible).toBe(true);
    const rainOpacity1985 = (atmosphere.weather.meshes.rain.material as THREE.MeshBasicMaterial)
      .opacity;
    expect(rainOpacity1945).toBeGreaterThan(0);
    expect(rainOpacity1945).toBeLessThan(rainOpacity1985);

    applyYear(atmosphere, 2005);
    expect(atmosphere.state.weather.soot).toBe(0);
    expect(atmosphere.weather.meshes.soot.visible).toBe(false);
    expect(atmosphere.weather.meshes.leaves.visible).toBe(true);
  });

  it('keeps particles in a low band under the top-of-screen timeline', () => {
    const { atmosphere } = createHarness();
    expect(atmosphere.weather.volume.height).toBeGreaterThan(0);
    expect(atmosphere.weather.volume.height).toBeLessThanOrEqual(40);
  });

  it('scales particle counts with quality and updates matrices safely', () => {
    const { atmosphere } = createHarness();
    const highSoot = atmosphere.weather.countFor('soot');
    const highRain = atmosphere.weather.countFor('rain');

    atmosphere.setQuality('low');
    expect(atmosphere.quality).toBe('low');
    expect(atmosphere.postFx.quality).toBe('low');
    expect(atmosphere.postFx.usesBloom).toBe(false); // renderer-free fallback
    expect(atmosphere.weather.countFor('soot')).toBeLessThan(highSoot);
    expect(atmosphere.weather.countFor('rain')).toBeLessThan(highRain);
    expect(atmosphere.weather.meshes.soot.visible).toBe(true);

    atmosphere.setQuality('high');
    expect(atmosphere.weather.countFor('soot')).toBe(highSoot);

    applyYear(atmosphere, 1945);
    expect(() => atmosphere.update(1 / 60)).not.toThrow();
    expect(() => atmosphere.update(1 / 60, new THREE.PerspectiveCamera())).not.toThrow();

    const matrix = new THREE.Matrix4();
    atmosphere.weather.meshes.soot.getMatrixAt(0, matrix);
    for (const element of matrix.elements) expect(Number.isFinite(element)).toBe(true);
  });
});

describe('restrained post-processing surfaces', () => {
  it('renders a non-interactive vignette below the timeline overlay', () => {
    const postFx = createPostFx({ container: document.body, quality: 'high' });
    cleanup.push(() => postFx.dispose());

    const element = postFx.vignetteElement;
    expect(element).not.toBeNull();
    expect(element!.style.pointerEvents).toBe('none');
    expect(element!.style.zIndex).toBe('5');
    expect(Number(element!.style.zIndex)).toBeLessThan(10); // .ui-overlay sits at z-index 10
    expect(element!.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.contains(element!)).toBe(true);

    postFx.apply({ exposure: 1.05, bloomStrength: 0.4, bloomThreshold: 0.8, bloomRadius: 0.5, vignette: 0.6 });
    expect(postFx.state.exposure).toBe(1.05);
    expect(element!.style.background).toContain('radial-gradient');

    expect(() => postFx.render(new THREE.Scene(), new THREE.PerspectiveCamera())).not.toThrow();
    expect(() => postFx.setQuality('low')).not.toThrow();
    expect(postFx.quality).toBe('low');
    expect(postFx.usesBloom).toBe(false);

    postFx.dispose();
    expect(document.body.contains(element!)).toBe(false);
  });

  it('disposes cleanly: unregisters, detaches scene objects, restores scene state', () => {
    const scene = new THREE.Scene();
    const originalFog = scene.fog; // captured before the atmosphere attaches
    const originalBackground = scene.background;
    const registry = createEraTransformRegistry();
    const atmosphere = createAtmosphere({ scene, registry, container: document.body });
    cleanup.push(() => atmosphere.dispose());
    const dome = atmosphere.sky;

    expect(scene.getObjectByName('atmosphereSkyDome')).toBeDefined();
    expect(scene.getObjectByName('atmosphereFillLight')).toBeDefined();

    atmosphere.dispose();
    expect(registry.has(atmosphere)).toBe(false);
    expect(registry.size).toBe(0);
    expect(scene.getObjectByName('atmosphereSkyDome')).toBeUndefined();
    expect(scene.getObjectByName('atmosphereFillLight')).toBeUndefined();
    expect(scene.fog).toBe(originalFog);
    expect(scene.background).toBe(originalBackground);
    expect(dome.mesh.parent).toBeNull();
  });
});

describe('procedural sky dome', () => {
  it('applies blended sky states into shader uniforms without allocations', () => {
    const dome = createSkyDome();
    cleanup.push(() => dome.dispose());

    expect(dome.material.type).toBe('ShaderMaterial');
    expect(dome.mesh.name).toBe('atmosphereSkyDome');
    expect(dome.mesh.renderOrder).toBeLessThan(0);

    const blended = lerpSkyState(SKY_DAY_STATES[1945], SKY_DAY_STATES[2005], 0.5);
    dome.apply(blended);

    const uniforms = dome.material.uniforms;
    expect((uniforms.uZenith.value as THREE.Color).getHex()).toBe(blended.zenith.getHex());
    expect((uniforms.uHorizon.value as THREE.Color).getHex()).toBe(blended.horizon.getHex());
    expect(uniforms.uSunIntensity.value).toBeCloseTo(blended.sunIntensity, 6);
    const direction = uniforms.uSunDirection.value as THREE.Vector3;
    expect(direction.length()).toBeCloseTo(1, 6);
    expect(direction.y).toBeGreaterThan(0);

    dome.dispose();
    expect(dome.mesh.parent).toBeNull();
  });
});
