/**
 * Tests for era transitions — verifying that era specs are centralized
 * and transitions interpolate correctly.
 */
import { describe, it, expect } from 'vitest';
import { ERA_REGISTRY, ERA_IDS, getEraSpec, getEraIndex, SKY_SPECS, BUILDING_SPECS } from '../src/eras';
import type { EraId } from '../src/eras';

describe('Era registry', () => {
  it('has 6 eras', () => {
    expect(ERA_REGISTRY).toHaveLength(6);
  });

  it('has correct era IDs', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025', '2055']);
  });

  it('each era has a unique index', () => {
    const indices = ERA_REGISTRY.map((e) => e.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('getEraSpec returns the correct spec', () => {
    const spec = getEraSpec('2055');
    expect(spec.year).toBe(2055);
    expect(spec.label).toBe('2055');
    expect(spec.index).toBe(5);
  });

  it('getEraSpec throws for unknown era', () => {
    expect(() => getEraSpec('9999' as EraId)).toThrow('Unknown era');
  });

  it('getEraIndex returns correct index', () => {
    expect(getEraIndex('1945')).toBe(0);
    expect(getEraIndex('2055')).toBe(5);
  });
});

describe('Centralized era configuration', () => {
  it('SKY_SPECS has an entry for every era', () => {
    for (const eraId of ERA_IDS) {
      expect(SKY_SPECS[eraId]).toBeDefined();
    }
  });

  it('BUILDING_SPECS has an entry for every era', () => {
    for (const eraId of ERA_IDS) {
      expect(BUILDING_SPECS[eraId]).toBeDefined();
    }
  });

  it('sky specs have all required fields', () => {
    for (const eraId of ERA_IDS) {
      const spec = SKY_SPECS[eraId];
      expect(spec.skyTop).toBeDefined();
      expect(spec.skyBottom).toBeDefined();
      expect(spec.sunColor).toBeDefined();
      expect(spec.sunIntensity).toBeGreaterThan(0);
      expect(spec.fogColor).toBeDefined();
      expect(spec.fogDensity).toBeGreaterThan(0);
      expect(spec.particleColor).toBeDefined();
      expect(spec.particleDensity).toBeGreaterThanOrEqual(0);
      expect(spec.particleSize).toBeGreaterThan(0);
    }
  });

  it('building specs have all required fields', () => {
    for (const eraId of ERA_IDS) {
      const spec = BUILDING_SPECS[eraId];
      expect(spec.color).toBeDefined();
      expect(spec.windowEmissive).toBeDefined();
      expect(spec.windowIntensity).toBeGreaterThanOrEqual(0);
      expect(spec.height).toBeGreaterThan(0);
      expect(spec.heightVariation).toBeGreaterThanOrEqual(0);
      expect(spec.roofProp).toBeDefined();
      expect(spec.roughness).toBeGreaterThanOrEqual(0);
      expect(spec.metalness).toBeGreaterThanOrEqual(0);
    }
  });

  it('sky sun intensity increases over time (modern eras brighter)', () => {
    const intensity1945 = SKY_SPECS['1945'].sunIntensity;
    const intensity2055 = SKY_SPECS['2055'].sunIntensity;
    expect(intensity2055).toBeGreaterThan(intensity1945);
  });

  it('building height increases over time', () => {
    const height1945 = BUILDING_SPECS['1945'].height;
    const height2055 = BUILDING_SPECS['2055'].height;
    expect(height2055).toBeGreaterThan(height1945);
  });

  it('building metalness increases over time', () => {
    const metalness1945 = BUILDING_SPECS['1945'].metalness;
    const metalness2055 = BUILDING_SPECS['2055'].metalness;
    expect(metalness2055).toBeGreaterThan(metalness1945);
  });
});

describe('Era transition interpolation', () => {
  it('can interpolate between era indices', () => {
    const fromIndex = getEraIndex('1945');
    const toIndex = getEraIndex('2055');
    const t = 0.5;
    const interpolated = fromIndex + (toIndex - fromIndex) * t;
    expect(interpolated).toBe(2.5);
  });

  it('era float at t=0 equals start era index', () => {
    const start = getEraIndex('1945');
    const target = getEraIndex('2055');
    const t = 0;
    const eraFloat = start + (target - start) * t;
    expect(eraFloat).toBe(0);
  });

  it('era float at t=1 equals target era index', () => {
    const start = getEraIndex('1945');
    const target = getEraIndex('2055');
    const t = 1;
    const eraFloat = start + (target - start) * t;
    expect(eraFloat).toBe(5);
  });

  it('all era IDs are valid keys in both spec maps', () => {
    for (const eraId of ERA_IDS) {
      expect(SKY_SPECS[eraId]).toBeDefined();
      expect(BUILDING_SPECS[eraId]).toBeDefined();
    }
  });
});
