import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { ERA_IDS } from '../src/eras';
import type { EraId } from '../src/eras';
import {
  ENVIRONMENT_PROFILES,
  WEATHER_MOODS,
  applyEnvironmentProfile,
  colorTemperatureToColor,
  findSceneEnvironmentLights,
  getEnvironmentProfile,
} from '../src/environment/profiles';
import type { EnvironmentLights } from '../src/environment/profiles';

const EXPECTED_ORDER = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Builds a scene with the full default rig: sun + hemisphere + ambient. */
function buildRiggedScene(): { scene: THREE.Scene; sun: THREE.DirectionalLight; hemisphere: THREE.HemisphereLight; ambient: THREE.AmbientLight } {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const hemisphere = new THREE.HemisphereLight(0x000000, 0x000000, 0);
  const ambient = new THREE.AmbientLight(0x000000, 0);
  scene.add(sun, hemisphere, ambient);
  return { scene, sun, hemisphere, ambient };
}

describe('ENVIRONMENT_PROFILES coverage', () => {
  it('is keyed by exactly the five EraIds', () => {
    expect(Object.keys(ENVIRONMENT_PROFILES).sort()).toEqual([...EXPECTED_ORDER].sort());
    for (const id of ERA_IDS) {
      expect(ENVIRONMENT_PROFILES[id]).toBeDefined();
      expect(ENVIRONMENT_PROFILES[id].id).toBe(id);
    }
  });

  it('getEnvironmentProfile resolves every era and throws otherwise', () => {
    for (const id of ERA_IDS) {
      expect(getEnvironmentProfile(id)).toBe(ENVIRONMENT_PROFILES[id]);
    }
    expect(() => getEnvironmentProfile('1999' as EraId)).toThrow(/Unknown environment profile/i);
  });
});

describe('profile completeness per era', () => {
  it('defines sky, fog, sun, ambient/hemisphere rig and weather mood for all five eras', () => {
    for (const id of ERA_IDS) {
      const p = ENVIRONMENT_PROFILES[id];

      // Sky
      expect(Number.isFinite(p.sky.color) && p.sky.color >= 0).toBe(true);

      // Fog
      expect(Number.isFinite(p.fog.color) && p.fog.color >= 0).toBe(true);
      expect(p.fog.density).toBeGreaterThan(0);
      expect(p.fog.density).toBeLessThanOrEqual(0.05);

      // Sun
      expect(p.sun.position).toHaveLength(3);
      for (const axis of p.sun.position) expect(Number.isFinite(axis)).toBe(true);
      expect(p.sun.intensity).toBeGreaterThan(0);
      expect(p.sun.colorTemperatureKelvin).toBeGreaterThanOrEqual(1500);
      expect(p.sun.colorTemperatureKelvin).toBeLessThanOrEqual(12000);

      // Ambient / hemisphere rig
      expect(p.lights.hemisphere.intensity).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(p.lights.hemisphere.skyTint)).toBe(true);
      expect(Number.isFinite(p.lights.hemisphere.groundTint)).toBe(true);
      expect(p.lights.ambient.intensity).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(p.lights.ambient.tint)).toBe(true);

      // Weather mood flag
      expect(WEATHER_MOODS).toContain(p.weather.mood);
    }
  });

  it('gives every era a distinct sky and fog palette', () => {
    const skies = new Set(ERA_IDS.map((id) => ENVIRONMENT_PROFILES[id].sky.color));
    const fogs = new Set(ERA_IDS.map((id) => ENVIRONMENT_PROFILES[id].fog.color));
    const densities = new Set(ERA_IDS.map((id) => ENVIRONMENT_PROFILES[id].fog.density));
    expect(skies.size).toBe(5);
    expect(fogs.size).toBe(5);
    expect(densities.size).toBe(5);
  });

  it('matches the documented moods: 1985 smog haze, 2005 overcast, 2025 crisp clear', () => {
    expect(ENVIRONMENT_PROFILES['1945'].weather.mood).toBe('haze');
    expect(ENVIRONMENT_PROFILES['1965'].weather.mood).toBe('clear');
    expect(ENVIRONMENT_PROFILES['1985'].weather.mood).toBe('smog');
    expect(ENVIRONMENT_PROFILES['2005'].weather.mood).toBe('overcast');
    expect(ENVIRONMENT_PROFILES['2025'].weather.mood).toBe('clear');

    // Smoggy 1985 must be the murkiest era; crisp 2025 the clearest.
    const densities = ERA_IDS.map((id) => ENVIRONMENT_PROFILES[id].fog.density);
    expect(Math.max(...densities)).toBe(ENVIRONMENT_PROFILES['1985'].fog.density);
    expect(Math.min(...densities)).toBe(ENVIRONMENT_PROFILES['2025'].fog.density);
  });
});

describe('colorTemperatureToColor', () => {
  it('runs warm temperatures toward red and cool ones toward blue-white', () => {
    const warm = colorTemperatureToColor(2000);
    const neutral = colorTemperatureToColor(6500);
    expect(warm.r).toBeGreaterThan(warm.g);
    expect(warm.g).toBeGreaterThanOrEqual(warm.b);
    expect(neutral.b).toBeGreaterThan(0.95);
    expect(neutral.r).toBeGreaterThan(0.8);

    const into = new THREE.Color();
    expect(colorTemperatureToColor(3000, into)).toBe(into);
  });
});

describe('applyEnvironmentProfile mutation contract', () => {
  let rig: ReturnType<typeof buildRiggedScene>;

  beforeEach(() => {
    rig = buildRiggedScene();
    rig.scene.background = new THREE.Color(0x000000);
    rig.scene.fog = new THREE.FogExp2(0x000000, 0.001);
  });

  it('mutates scene.background to the profile sky color in place', () => {
    const background = rig.scene.background as THREE.Color;
    applyEnvironmentProfile(rig.scene, ENVIRONMENT_PROFILES['1985']);
    expect(rig.scene.background).toBe(background);
    expect(background.getHex()).toBe(ENVIRONMENT_PROFILES['1985'].sky.color);
    expect(background.getHexString()).toBe(new THREE.Color(0xbf8f5e).getHexString());
  });

  it('assigns a FogExp2 when the scene has none and mutates an existing one in place', () => {
    const fresh = new THREE.Scene();
    expect(fresh.fog).toBeNull();
    applyEnvironmentProfile(fresh, ENVIRONMENT_PROFILES['1965']);
    expect(fresh.fog).toBeInstanceOf(THREE.FogExp2);
    expect((fresh.fog as THREE.FogExp2).color.getHex()).toBe(ENVIRONMENT_PROFILES['1965'].fog.color);
    expect((fresh.fog as THREE.FogExp2).density).toBeCloseTo(ENVIRONMENT_PROFILES['1965'].fog.density, 10);

    const existing = rig.scene.fog as THREE.FogExp2;
    applyEnvironmentProfile(rig.scene, ENVIRONMENT_PROFILES['2005']);
    expect(rig.scene.fog).toBe(existing);
    expect(existing.color.getHex()).toBe(ENVIRONMENT_PROFILES['2005'].fog.color);
    expect(existing.density).toBeCloseTo(ENVIRONMENT_PROFILES['2005'].fog.density, 10);
  });

  it('updates the sun position, intensity and kelvin-derived color without recreating it', () => {
    const { scene, sun } = rig;
    const before = sun.uuid;
    applyEnvironmentProfile(scene, ENVIRONMENT_PROFILES['1945']);

    const p = ENVIRONMENT_PROFILES['1945'];
    expect(sun.uuid).toBe(before);
    expect(sun.position.x).toBeCloseTo(p.sun.position[0], 6);
    expect(sun.position.y).toBeCloseTo(p.sun.position[1], 6);
    expect(sun.position.z).toBeCloseTo(p.sun.position[2], 6);
    expect(sun.intensity).toBeCloseTo(p.sun.intensity, 10);
    expect(sun.color.getHex()).toBe(colorTemperatureToColor(p.sun.colorTemperatureKelvin).getHex());
  });

  it('updates hemisphere and ambient intensities and tints', () => {
    const { scene, hemisphere, ambient } = rig;
    applyEnvironmentProfile(scene, ENVIRONMENT_PROFILES['2025']);

    const lights = ENVIRONMENT_PROFILES['2025'].lights;
    expect(hemisphere.intensity).toBeCloseTo(lights.hemisphere.intensity, 10);
    expect(hemisphere.color.getHex()).toBe(lights.hemisphere.skyTint);
    expect(hemisphere.groundColor.getHex()).toBe(lights.hemisphere.groundTint);
    expect(ambient.intensity).toBeCloseTo(lights.ambient.intensity, 10);
    expect(ambient.color.getHex()).toBe(lights.ambient.tint);
  });

  it('never disposes or rebuilds geometry or removes scene children', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const material = new THREE.MeshStandardMaterial();
    const materialSpy = vi.spyOn(material, 'dispose');
    const mesh = new THREE.Mesh(geometry, material);
    rig.scene.add(mesh);

    const childCountBefore = rig.scene.children.length;
    const positionCountBefore = geometry.getAttribute('position').count;

    for (const id of ERA_IDS) {
      applyEnvironmentProfile(rig.scene, ENVIRONMENT_PROFILES[id]);
    }

    expect(rig.scene.children.length).toBe(childCountBefore);
    expect(mesh.parent).toBe(rig.scene);
    expect(geometry.getAttribute('position').count).toBe(positionCountBefore);
    expect(geometrySpy).not.toHaveBeenCalled();
    expect(materialSpy).not.toHaveBeenCalled();
  });

  it('discovers rig lights from the scene when no explicit rig is passed', () => {
    const discovered = findSceneEnvironmentLights(rig.scene);
    expect(discovered.sun).toBe(rig.sun);
    expect(discovered.hemisphere).toBe(rig.hemisphere);
    expect(discovered.ambient).toBe(rig.ambient);
  });

  it('honors an explicit light rig instead of scene discovery', () => {
    const detachedSun = new THREE.DirectionalLight(0xffffff, 9);
    const explicit: EnvironmentLights = { sun: detachedSun };
    applyEnvironmentProfile(rig.scene, ENVIRONMENT_PROFILES['1985'], { lights: explicit });

    // Explicit rig is mutated...
    expect(detachedSun.intensity).toBeCloseTo(ENVIRONMENT_PROFILES['1985'].sun.intensity, 10);
    expect(detachedSun.color.getHex()).toBe(
      colorTemperatureToColor(ENVIRONMENT_PROFILES['1985'].sun.colorTemperatureKelvin).getHex(),
    );
    // ...while undiscovered scene lights keep their previous values.
    expect(rig.hemisphere.intensity).toBe(0);
  });

  it('applies all five profiles sequentially to one live scene', () => {
    for (const id of ERA_IDS) {
      expect(() => applyEnvironmentProfile(rig.scene, ENVIRONMENT_PROFILES[id])).not.toThrow();
      expect((rig.scene.background as THREE.Color).getHex()).toBe(ENVIRONMENT_PROFILES[id].sky.color);
    }
  });
});
