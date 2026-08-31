/**
 * Registry tests for era specs and the continuous range weight helper.
 */
import { describe, expect, it } from 'vitest';
import {
  ERA_IDS,
  ERA_REGISTRY,
  eraRangeWeight,
  getEraSpec,
  type EraId,
} from '../eras';

describe('ERA_REGISTRY', () => {
  it('exposes exactly the five required eras in order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
  });

  it('keeps registry and ids in sync', () => {
    expect(ERA_REGISTRY.map((s) => s.id)).toEqual([...ERA_IDS]);
  });

  it('provides year, label and description for every era', () => {
    for (const spec of ERA_REGISTRY) {
      expect(typeof spec.year).toBe('number');
      expect(spec.year).toBeGreaterThan(1900);
      expect(typeof spec.label).toBe('string');
      expect(spec.label.length).toBeGreaterThan(0);
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });

  it('labels match years', () => {
    for (const spec of ERA_REGISTRY) {
      expect(spec.label).toBe(String(spec.year));
    }
  });

  it('getEraSpec returns the matching spec', () => {
    expect(getEraSpec('1985').year).toBe(1985);
    expect(() => getEraSpec('3000' as EraId)).toThrow();
  });
});

describe('eraRangeWeight', () => {
  it('returns 1 inside an era window and 0 outside', () => {
    expect(eraRangeWeight(1, ['1945', '1965', '1985'])).toBeGreaterThan(0.99);
    expect(eraRangeWeight(4, ['1945'])).toBe(0);
  });

  it('fades across a half-index band at the window edges', () => {
    expect(eraRangeWeight(0.0, ['1945'])).toBe(1);
    expect(eraRangeWeight(0.25, ['1945'])).toBeCloseTo(0.5);
    expect(eraRangeWeight(0.5, ['1945'])).toBe(0);
    // A window spanning two adjacent eras stays fully on inside it.
    expect(eraRangeWeight(0.5, ['1945', '1965'])).toBe(1);
    expect(eraRangeWeight(1.5, ['1945', '1965'])).toBe(0);
  });

  it('handles an empty era list', () => {
    expect(eraRangeWeight(0.5, [])).toBe(0);
  });
});