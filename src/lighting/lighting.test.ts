import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createDaytimeLighting,
  createSkyDome,
  createSunLight,
  updateSkyDome,
  SUN_DIRECTION,
} from '.';

describe('createDaytimeLighting', () => {
  it('wires sky, ambient, hemisphere and sun into the scene', () => {
    const scene = new THREE.Scene();
    const lighting = createDaytimeLighting(scene);

    // sky + ambient + hemisphere + sun + sun.target
    expect(scene.children).toHaveLength(5);
    expect(scene.children).toContain(lighting.sky);
    expect(scene.children).toContain(lighting.ambient);
    expect(scene.children).toContain(lighting.hemisphere);
    expect(scene.children).toContain(lighting.sun);
    expect(scene.children).toContain(lighting.sun.target);
  });

  it('configures a shadow-casting sun aimed at the scene origin', () => {
    const scene = new THREE.Scene();
    const { sun } = createDaytimeLighting(scene);

    expect(sun.castShadow).toBe(true);
    // Light sits along SUN_DIRECTION at the configured distance.
    expect(sun.position.clone().normalize().distanceTo(SUN_DIRECTION)).toBeLessThan(0.001);
    expect(sun.position.length()).toBeCloseTo(170, 5);
    // Target stays at the origin so the light looks at the city center.
    expect(sun.target.position.length()).toBe(0);
  });

  it('tunes the shadow camera to cover the city', () => {
    const scene = new THREE.Scene();
    const { sun } = createDaytimeLighting(scene);

    const shadow = sun.shadow;
    expect(shadow.mapSize.width).toBe(2048);
    expect(shadow.mapSize.height).toBe(2048);
    expect(shadow.camera.left).toBe(-170);
    expect(shadow.camera.right).toBe(170);
    expect(shadow.camera.top).toBe(170);
    expect(shadow.camera.bottom).toBe(-170);
    expect(shadow.camera.near).toBe(10);
    expect(shadow.camera.far).toBe(400);
    expect(shadow.bias).toBeLessThan(0);
  });

  it('applies strong enough fill for street-level detail', () => {
    const scene = new THREE.Scene();
    const { ambient, hemisphere } = createDaytimeLighting(scene);

    expect(ambient.intensity).toBe(0.3);
    expect(hemisphere.intensity).toBe(1.0);
  });

  it('honors option overrides', () => {
    const scene = new THREE.Scene();
    const lighting = createDaytimeLighting(scene, {
      ambientIntensity: 0.45,
      hemisphereIntensity: 0.7,
      sun: { shadowMapSize: 1024, shadowBounds: 120 },
    });

    expect(lighting.ambient.intensity).toBe(0.45);
    expect(lighting.hemisphere.intensity).toBe(0.7);
    expect(lighting.sun.shadow.mapSize.width).toBe(1024);
    expect(lighting.sun.shadow.camera.right).toBe(120);
  });
});

describe('createSkyDome', () => {
  it('creates a back-sided, non-depth-writing dome that always renders', () => {
    const sky = createSkyDome();
    const material = sky.material as THREE.ShaderMaterial;

    expect(sky.name).toBe('skyDome');
    expect(sky.frustumCulled).toBe(false);
    expect(material.side).toBe(THREE.BackSide);
    expect(material.depthWrite).toBe(false);
    // Large enough to enclose the city and camera.
    expect((sky.geometry as THREE.SphereGeometry).parameters.radius).toBe(900);
  });

  it('draws a sun disc along the configured sun direction', () => {
    const sky = createSkyDome();
    const material = sky.material as THREE.ShaderMaterial;
    const sunDir = material.uniforms.uSunDirection.value as THREE.Vector3;

    expect(sunDir.clone().normalize().distanceTo(SUN_DIRECTION)).toBeLessThan(0.001);
    expect(material.uniforms.uSunDiscPower.value).toBe(400);
    expect(material.uniforms.uSunHaloPower.value).toBe(24);
  });
});

describe('updateSkyDome', () => {
  it('keeps the sky shader camera uniform in sync', () => {
    const sky = createSkyDome();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(12, 34, 56);

    updateSkyDome(sky, camera);
    const uniform = (sky.material as THREE.ShaderMaterial).uniforms.uCameraPosition
      .value as THREE.Vector3;
    expect(uniform.toArray()).toEqual([12, 34, 56]);
  });
});

describe('createSunLight', () => {
  it('defaults to the shared sun direction and casts shadows', () => {
    const light = createSunLight();

    expect(light.name).toBe('sunLight');
    expect(light.castShadow).toBe(true);
    expect(light.position.clone().normalize().distanceTo(SUN_DIRECTION)).toBeLessThan(0.001);
  });
});
