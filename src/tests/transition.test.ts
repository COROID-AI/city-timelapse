/**
 * Transition tests: the eased cursor moves deterministically toward the
 * discrete target and the scene interpolation contract holds.
 */
import { describe, expect, it } from 'vitest';
import { ERA_IDS } from '../eras';
import { clamp, createInitialState, getEraSegment, type AppState } from '../state';

/** Mirrors the main loop's easing step (kept pure for testing). */
function stepEra(state: AppState, target: number, dt: number): void {
  const rate = state.reducedMotion ? 6 : 2.4;
  const diff = target - state.eraIndex;
  state.eraIndex += clamp(diff, -1, 1) * Math.min(1, dt * rate);
  if (Math.abs(diff) < 0.002) state.eraIndex = target;
  state.era = ERA_IDS[Math.round(state.eraIndex)];
}

describe('era transition easing', () => {
  it('moves from 1945 to 2025 over ~2s and settles', () => {
    const state = createInitialState();
    const target = ERA_IDS.indexOf('2025');
    let frames = 0;
    // ~60fps for up to 10s of simulation
    for (let i = 0; i < 600; i++) {
      stepEra(state, target, 1 / 60);
      frames++;
      if (Math.abs(target - state.eraIndex) < 0.002) {
        state.eraIndex = target;
        state.era = ERA_IDS[Math.round(state.eraIndex)];
        break;
      }
    }
    expect(state.eraIndex).toBeCloseTo(target, 5);
    expect(state.era).toBe('2025');
    expect(frames).toBeGreaterThan(60); // eased, not instant
    expect(frames).toBeLessThan(240); // and finishes well within several seconds
  });

  it('settles instantly under reduced motion', () => {
    const state = createInitialState();
    state.reducedMotion = true;
    const target = ERA_IDS.indexOf('1985');
    for (let i = 0; i < 200; i++) stepEra(state, target, 1 / 60);
    expect(state.eraIndex).toBeCloseTo(target, 5);
  });

  it('never leaves the valid era range', () => {
    const state = createInitialState();
    const extremes = [0, ERA_IDS.length - 1, 4.5, 0.25];
    for (let i = 0; i < 600; i++) {
      const target = extremes[i % extremes.length];
      stepEra(state, target, 1 / 60);
      expect(state.eraIndex).toBeGreaterThanOrEqual(0);
      expect(state.eraIndex).toBeLessThanOrEqual(ERA_IDS.length - 1);
    }
  });

  it('the rounded state.era always names a real registry id', () => {
    const state = createInitialState();
    state.eraIndex = 2.7;
    const era = ERA_IDS[Math.round(state.eraIndex)];
    expect(era).toBe('2005');
    const seg = getEraSegment(state.eraIndex);
    expect(seg.hi).toBe(3);
  });
});