import { describe, expect, it } from 'vitest';
import { eraRegistry } from '../src/state/eraRegistry';
import { CANONICAL_ERAS } from '../src/types/city';

describe('EraRegistry', () => {
  it('contains exactly the five canonical years', () => {
    expect(eraRegistry.eras).toHaveLength(5);
    expect(eraRegistry.eras.map((e) => e.year)).toEqual([1945, 1965, 1985, 2005, 2025]);
  });

  it('matches the CANONICAL_ERAS constant', () => {
    expect(eraRegistry.eras.map((e) => e.year)).toEqual([...CANONICAL_ERAS]);
  });

  it('is ordered ascending', () => {
    const years = eraRegistry.eras.map((e) => e.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeGreaterThan(years[i - 1]);
    }
  });

  it('looks up metadata by year', () => {
    const meta = eraRegistry.get(1985);
    expect(meta.year).toBe(1985);
    expect(meta.label).toBe('1985');
    expect(meta.description.length).toBeGreaterThan(0);
    expect(meta.accentColor).toBeTruthy();
  });

  it('find returns undefined for unknown years and throws for get', () => {
    expect(eraRegistry.find(1999)).toBeUndefined();
    expect(() => eraRegistry.get(1999 as never)).toThrow();
  });

  it('provides typed metadata for every era', () => {
    for (const meta of eraRegistry.eras) {
      expect(meta.year).toBeDefined();
      expect(meta.label).toMatch(/^\d{4}$/);
      expect(meta.description).toBeTruthy();
      expect(meta.accentColor).toMatch(/^#/);
      expect(Array.isArray(meta.tags)).toBe(true);
    }
  });
});