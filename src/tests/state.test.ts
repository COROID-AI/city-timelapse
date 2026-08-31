/**
 * Logic tests for the continuous era/state helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  clamp,
  createInitialState,
  eraTransitionActive,
  getEraSegment,
} from '../state';

describe('clamp', () => {
  it('clamps to [lo, hi]', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(5, -2, 2)).toBe(2);
  });
});

describe('getEraSegment', () => {
  it('returns lo/hi/t for a continuous index', () => {
    const seg = getEraSegment(2.4);
    expect(seg.lo).toBe(2);
    expect(seg.hi).toBe(3);
    expect(seg.t).toBeCloseTo(0.4);
  });

  it('clamps at the edges', () => {
    // hi is always the next index (or the last); t = 0 pins the value.
    expect(getEraSegment(-0.5)).toEqual({ lo: 0, hi: 1, t: 0 });
    expect(getEraSegment(99).hi).toBe(4);
  });

  it('at-rest cursor has t = 0', () => {
    expect(getEraSegment(3).t).toBe(0);
  });
});

describe('eraTransitionActive', () => {
  it('is false at an exact era endpoint', () => {
    expect(eraTransitionActive(0)).toBe(false);
    expect(eraTransitionActive(2)).toBe(false);
    expect(eraTransitionActive(4)).toBe(false);
  });

  it('is true mid-transition', () => {
    expect(eraTransitionActive(0.5)).toBe(true);
    expect(eraTransitionActive(2.999)).toBe(true);
  });
});

describe('createInitialState', () => {
  it('boots at 1945 with the continuous cursor at rest', () => {
    const state = createInitialState();
    expect(state.era).toBe('1945');
    expect(state.eraIndex).toBe(0);
    expect(state.muted).toBe(false);
    expect(state.time).toBe(0);
  });
});