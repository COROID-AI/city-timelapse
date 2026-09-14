import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';

describe('createSeededRng', () => {
  it('produces an identical sequence for identical seeds', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);

    const seqA = Array.from({ length: 32 }, () => a.next());
    const seqB = Array.from({ length: 32 }, () => b.next());

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);

    expect(a.next()).not.toBe(b.next());
  });

  it('next() returns floats in [0, 1)', () => {
    const rng = createSeededRng(42);

    for (let i = 0; i < 256; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('range(min, max) stays within the half-open interval', () => {
    const rng = createSeededRng(7);

    for (let i = 0; i < 256; i += 1) {
      const value = rng.range(-3.5, 12.25);
      expect(value).toBeGreaterThanOrEqual(-3.5);
      expect(value).toBeLessThan(12.25);
    }
  });

  it('int(min, max) returns inclusive integers across the whole range', () => {
    const rng = createSeededRng(99);
    const seen = new Set<number>();

    for (let i = 0; i < 512; i += 1) {
      const value = rng.int(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }

    // With a fixed seed and 512 samples over 6 buckets every bucket is hit,
    // proving the inclusive max is reachable while staying deterministic.
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('pick returns one of the provided items and rejects empty arrays', () => {
    const rng = createSeededRng(555);
    const items = ['a', 'b', 'c'];

    for (let i = 0; i < 64; i += 1) {
      expect(items).toContain(rng.pick(items));
    }

    expect(() => rng.pick([])).toThrow();
  });

  it('chance() yields both outcomes and respects the probability argument', () => {
    const rng = createSeededRng(2025);
    let trueCount = 0;

    for (let i = 0; i < 1000; i += 1) {
      if (rng.chance()) {
        trueCount += 1;
      }
    }

    expect(trueCount).toBeGreaterThan(0);
    expect(trueCount).toBeLessThan(1000);

    expect(rng.chance(1)).toBe(true);
    expect(rng.chance(0)).toBe(false);
  });
});