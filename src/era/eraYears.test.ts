import { describe, expect, it } from 'vitest';
import { ERA_YEARS, type EraId } from './types';

const REQUESTED_STOPS = [1945, 1965, 1985, 2005, 2025];

describe('ERA_YEARS', () => {
  it('is exactly the five requested timeline stops in ascending order', () => {
    expect(ERA_YEARS).toEqual(REQUESTED_STOPS);
  });

  it('has exactly one EraId per year (no duplicates) and length 5', () => {
    expect(new Set(ERA_YEARS).size).toBe(ERA_YEARS.length);
    expect(ERA_YEARS).toHaveLength(5);
  });

  it('contains no years outside the request', () => {
    expect(ERA_YEARS).not.toContain(2055);
    for (const year of ERA_YEARS) {
      expect(REQUESTED_STOPS).toContain(year);
    }
  });

  it('is strictly ascending', () => {
    for (let i = 1; i < ERA_YEARS.length; i += 1) {
      expect(ERA_YEARS[i]!).toBeGreaterThan(ERA_YEARS[i - 1]!);
    }
  });
});

describe('EraId', () => {
  it('accepts every shipped year at compile time', () => {
    const eras: EraId[] = [1945, 1965, 1985, 2005, 2025];
    expect(eras).toEqual(REQUESTED_STOPS);
  });

  it('rejects years outside the five stops at compile time', () => {
    // @ts-expect-error 2055 is deliberately not a shipped EraId.
    const extraStop: EraId = 2055;
    void extraStop;
  });
});