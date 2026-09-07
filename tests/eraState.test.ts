import { describe, expect, it } from 'vitest';
import { createEraState } from '../src/state/eraState';
import { CANONICAL_ERAS, isEraYear } from '../src/types/city';

describe('EraState', () => {
  it('defaults to 1945', () => {
    const state = createEraState();
    expect(state.year).toBe(1945);
  });

  it('supports exactly the five canonical years', () => {
    const state = createEraState();
    for (const year of CANONICAL_ERAS) {
      state.setYear(year);
      expect(state.year).toBe(year);
    }
  });

  it('clamps invalid values to the nearest canonical year', () => {
    const state = createEraState();
    state.setYear(1930);
    expect(state.year).toBe(1945);
    state.setYear(2030);
    expect(state.year).toBe(2025);
    state.setYear(1975);
    expect(isEraYear(state.year)).toBe(true);
  });

  it('notifies subscribers on change with reactive updates', () => {
    const state = createEraState();
    const seen: number[] = [];
    state.subscribe((y) => seen.push(y));
    state.setYear(1985);
    state.setYear(2025);
    expect(seen).toEqual([1985, 2025]);
    expect(state.year).toBe(2025);
  });

  it('does not notify when set to the same year', () => {
    const state = createEraState(1945);
    let count = 0;
    state.subscribe(() => count++);
    state.setYear(1945);
    expect(count).toBe(0);
  });

  it('supports unsubscribe', () => {
    const state = createEraState();
    let count = 0;
    const unsub = state.subscribe(() => count++);
    unsub();
    state.setYear(2005);
    expect(count).toBe(0);
  });

  it('keeps reactive consumers in sync (no stale state)', () => {
    const state = createEraState();
    let current = state.year;
    state.subscribe((y) => {
      current = y;
    });
    for (const year of [1945, 1965, 1985, 2005, 2025, 1965]) {
      state.setYear(year);
      expect(current).toBe(state.year);
    }
  });
});