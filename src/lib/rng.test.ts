import { describe, it, expect } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces values in [0, 1)', () => {
    const rng = new Rng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range returns values within bounds', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 50; i++) {
      const v = rng.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('int returns integer within bounds', () => {
    const rng = new Rng(77);
    for (let i = 0; i < 50; i++) {
      const v = rng.int(3, 8);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });

  it('pick selects from array', () => {
    const rng = new Rng(55);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      const v = rng.pick(arr);
      expect(arr).toContain(v);
    }
  });

  it('bool respects probability', () => {
    const rng = new Rng(11);
    let heads = 0;
    for (let i = 0; i < 100; i++) {
      if (rng.bool(0.5)) heads++;
    }
    // reasonable check: between 20% and 80% true
    expect(heads).toBeGreaterThan(20);
    expect(heads).toBeLessThan(80);
  });
});
