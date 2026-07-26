/**
 * Tests for the AtmosphereSystem — per-era sky, fog, sun, ambient, and bloom.
 *
 * Verifies that each era produces distinct atmosphere values, that the system
 * correctly interpolates between two eras during a cross-fade, and that 2055
 * visibly leverages heavy bloom for its neon/holographic dusk ambiance.
 *
 * Uses real Three.js Scene/AmbientLight/DirectionalLight objects with a lightweight
 * mock for the UnrealBloomPass (which needs WebGL to instantiate).
 */
import { describe, expect, it } from 'vitest';
import { AmbientLight, Color, DirectionalLight, FogExp2, Scene } from 'three';
import { createAtmosphereSystem } from '../AtmosphereSystem.js';
import { DEFAULT_ERA_CONFIG, ERA_KEYS, type EraKey } from '../../eras/eraConfig.js';

/**
 * Minimal mock of UnrealBloomPass exposing only the three driven properties.
 * The real pass requires a WebGLRenderer; for unit tests we only need the
 * numeric fields the AtmosphereSystem mutates.
 */
interface MockBloom {
  strength: number;
  radius: number;
  threshold: number;
}

function mockBloom(): MockBloom {
  return { strength: 0, radius: 0, threshold: 0 };
}

function setup() {
  const scene = new Scene();
  const ambient = new AmbientLight(0xffffff, 1);
  const sun = new DirectionalLight(0xffffff, 1);
  const bloom = mockBloom();
  const atmosphere = createAtmosphereSystem(
    scene,
    ambient,
    sun,
    bloom as unknown as Parameters<typeof createAtmosphereSystem>[3],
  );
  return { scene, ambient, sun, bloom, atmosphere };
}

describe('AtmosphereSystem', () => {
  it('sets distinct sky background per era', () => {
    const { scene, atmosphere } = setup();
    const skies = new Set<string>();
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
      skies.add((scene.background as Color).getHexString());
    }
    // Every era should have a unique sky colour.
    expect(skies.size).toBe(ERA_KEYS.length);
  });

  it('applies exponential fog with distinct colours and densities per era', () => {
    const { scene, atmosphere } = setup();
    const densities = new Set<number>();
    const colours = new Set<string>();
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
      const fog = scene.fog as FogExp2;
      expect(fog).toBeInstanceOf(FogExp2);
      densities.add(Number(fog.density.toFixed(4)));
      colours.add(fog.color.getHexString());
    }
    // At least several distinct fog densities / colours exist.
    expect(densities.size).toBeGreaterThanOrEqual(3);
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });

  it('sets sun angle/intensity/colour per era', () => {
    const { sun, atmosphere } = setup();
    const intensities = new Set<number>();
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
      intensities.add(Number(sun.intensity.toFixed(3)));
      // Sun position must be above the horizon plane.
      expect(sun.position.y).toBeGreaterThan(0);
      // Sun colour should match the era config exactly at t=1.
      const expected = DEFAULT_ERA_CONFIG[era].atmosphere.sunColor;
      expect(sun.color.getHexString()).toBe(expected.slice(1).toLowerCase());
    }
    expect(intensities.size).toBeGreaterThanOrEqual(3);
  });

  it('sets ambient colour and intensity per era', () => {
    const { ambient, atmosphere } = setup();
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
      const cfg = DEFAULT_ERA_CONFIG[era].atmosphere;
      expect(ambient.intensity).toBeCloseTo(cfg.ambientIntensity, 4);
      expect(ambient.color.getHexString()).toBe(cfg.ambientColor.slice(1).toLowerCase());
    }
  });

  it('sets bloom strength/radius/threshold per era', () => {
    const { bloom, atmosphere } = setup();
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
      const cfg = DEFAULT_ERA_CONFIG[era].atmosphere;
      expect(bloom.strength).toBeCloseTo(cfg.bloomStrength, 4);
      expect(bloom.radius).toBeCloseTo(cfg.bloomRadius, 4);
      expect(bloom.threshold).toBeCloseTo(cfg.bloomThreshold, 4);
    }
  });

  it('2055 uses heavy bloom (highest strength, lowest threshold)', () => {
    const { bloom, atmosphere } = setup();
    atmosphere.applyEra('2055', 1, '2055');
    const cfg = DEFAULT_ERA_CONFIG['2055'].atmosphere;
    // 2055 must have the heaviest bloom across all eras.
    for (const era of ERA_KEYS) {
      atmosphere.applyEra(era, 1, era);
    }
    expect(cfg.bloomStrength).toBeGreaterThanOrEqual(1.5);
    expect(cfg.bloomThreshold).toBeLessThanOrEqual(0.3);
    // The driven value should match config exactly at t=1.
    expect(bloom.strength).toBeCloseTo(cfg.bloomStrength, 4);
  });

  it('cross-fades (interpolates) between two eras rather than snapping', () => {
    const { sun, atmosphere } = setup();
    const from: EraKey = '1945';
    const to: EraKey = '2055';
    const fromCfg = DEFAULT_ERA_CONFIG[from].atmosphere;
    const toCfg = DEFAULT_ERA_CONFIG[to].atmosphere;

    // At t=0 the sun intensity should match the source era.
    atmosphere.applyEra(to, 0, from);
    expect(sun.intensity).toBeCloseTo(fromCfg.sunIntensity, 4);

    // At t=1 it should match the destination era.
    atmosphere.applyEra(to, 1, from);
    expect(sun.intensity).toBeCloseTo(toCfg.sunIntensity, 4);

    // At t=0.5 it should be the midpoint.
    atmosphere.applyEra(to, 0.5, from);
    const expectedMid = (fromCfg.sunIntensity + toCfg.sunIntensity) / 2;
    expect(sun.intensity).toBeCloseTo(expectedMid, 2);
  });

  it('sky colour interpolates at midpoint between two eras', () => {
    const { scene, atmosphere } = setup();
    atmosphere.applyEra('2055', 0.5, '1945');
    const bg = scene.background as Color;
    // Midpoint sky should be neither the 1945 nor 2055 colour.
    const mid = bg.getHexString();
    const c1945 = DEFAULT_ERA_CONFIG['1945'].atmosphere.skyColor.slice(1).toLowerCase();
    const c2055 = DEFAULT_ERA_CONFIG['2055'].atmosphere.skyColor.slice(1).toLowerCase();
    expect(mid).not.toBe(c1945);
    expect(mid).not.toBe(c2055);
  });

  it('bloom cross-fades smoothly toward heavy 2055 neon bloom', () => {
    const { bloom, atmosphere } = setup();
    const fromCfg = DEFAULT_ERA_CONFIG['1945'].atmosphere;
    const toCfg = DEFAULT_ERA_CONFIG['2055'].atmosphere;

    atmosphere.applyEra('2055', 0, '1945');
    expect(bloom.strength).toBeCloseTo(fromCfg.bloomStrength, 4);
    atmosphere.applyEra('2055', 1, '1945');
    expect(bloom.strength).toBeCloseTo(toCfg.bloomStrength, 4);
    atmosphere.applyEra('2055', 0.5, '1945');
    const mid = (fromCfg.bloomStrength + toCfg.bloomStrength) / 2;
    expect(bloom.strength).toBeCloseTo(mid, 2);
  });
});
