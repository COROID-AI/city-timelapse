import { describe, it, expect, beforeEach } from 'vitest';
import { useEraTimeline, TRANSITION_DURATION } from './eraTimeline';
import { ERA_IDS, getEraSpec } from '../eras';

/**
 * The zustand store is a module-level singleton. `setState` is used to reset
 * it to a known baseline before each test so assertions are independent.
 */
function resetStore(): void {
  useEraTimeline.setState({
    currentEra: ERA_IDS[0],
    targetEra: ERA_IDS[0],
    transitionProgress: 1,
  });
}

describe('era timeline store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('setEra', () => {
    it('starts on the first era and is fully settled', () => {
      const s = useEraTimeline.getState();
      expect(s.currentEra).toBe('1945');
      expect(s.targetEra).toBe('1945');
      expect(s.transitionProgress).toBe(1);
    });

    it('selects a target era and restarts the transition', () => {
      useEraTimeline.getState().setEra('1985');
      const s = useEraTimeline.getState();
      expect(s.targetEra).toBe('1985');
      expect(s.currentEra).toBe('1945');
      expect(s.transitionProgress).toBe(0);
    });

    it('is a no-op when selecting the current target', () => {
      const before = useEraTimeline.getState().transitionProgress;
      useEraTimeline.getState().setEra('1945');
      expect(useEraTimeline.getState().transitionProgress).toBe(before);
    });

    it('folds a mid-transition progress into the starting era', () => {
      // Start a transition, then advance it partway.
      useEraTimeline.getState().setEra('1965');
      useEraTimeline.getState().transitionTick(TRANSITION_DURATION * 0.25);
      // Mid-transition (progress < 0.5) → current era stays as the starting era.
      useEraTimeline.getState().setEra('2005');
      const s = useEraTimeline.getState();
      expect(s.currentEra).toBe('1945');
      expect(s.targetEra).toBe('2005');
      expect(s.transitionProgress).toBe(0);
    });

    it('promotes the target era when folded past the halfway point', () => {
      useEraTimeline.getState().setEra('1965');
      useEraTimeline.getState().transitionTick(TRANSITION_DURATION * 0.6);
      // Past halfway → resolved starting era is the previous target ('1965').
      useEraTimeline.getState().setEra('2025');
      const s = useEraTimeline.getState();
      expect(s.currentEra).toBe('1965');
      expect(s.targetEra).toBe('2025');
    });
  });

  describe('transitionTick / interpolation', () => {
    it('advances progress proportionally to dt', () => {
      useEraTimeline.getState().setEra('1965');
      useEraTimeline.getState().transitionTick(1.0); // half of 2s
      const p = useEraTimeline.getState().transitionProgress;
      expect(p).toBeCloseTo(0.5, 5);
    });

    it('clamps progress at 1 and settles currentEra to targetEra', () => {
      useEraTimeline.getState().setEra('2025');
      useEraTimeline.getState().transitionTick(TRANSITION_DURATION * 2);
      const s = useEraTimeline.getState();
      expect(s.transitionProgress).toBe(1);
      expect(s.currentEra).toBe('2025');
      expect(s.targetEra).toBe('2025');
    });

    it('does not advance once fully settled', () => {
      useEraTimeline.getState().transitionTick(1);
      const s = useEraTimeline.getState();
      expect(s.transitionProgress).toBe(1);
      expect(s.currentEra).toBe('1945');
    });

    it('interpolateEra returns the dominant era across the halfway point', () => {
      useEraTimeline.getState().setEra('1965');
      expect(useEraTimeline.getState().interpolateEra(0.2).id).toBe('1945');
      expect(useEraTimeline.getState().interpolateEra(0.5).id).toBe('1965');
      expect(useEraTimeline.getState().interpolateEra(0.9).id).toBe('1965');
    });

    it('interpolateEra uses the live transition progress by default', () => {
      useEraTimeline.getState().setEra('1965');
      useEraTimeline.getState().transitionTick(0.5); // progress 0.25
      expect(useEraTimeline.getState().interpolateEra().id).toBe('1945');
      useEraTimeline.getState().transitionTick(TRANSITION_DURATION); // progress 1
      expect(useEraTimeline.getState().interpolateEra().id).toBe('1965');
    });

    it('lerpEraValue interpolates between the current and target values', () => {
      useEraTimeline.getState().setEra('1965');
      // easeInOut(0) = 0, easeInOut(1) = 1.
      expect(useEraTimeline.getState().lerpEraValue(0, 10, 0)).toBe(0);
      expect(useEraTimeline.getState().lerpEraValue(0, 10, 1)).toBe(10);
      // easeInOut(0.5) = 0.5.
      expect(useEraTimeline.getState().lerpEraValue(0, 10, 0.5)).toBe(5);
    });

    it('eraFloat sweeps across the era timeline index range', () => {
      useEraTimeline.getState().setEra('2025');
      expect(useEraTimeline.getState().eraFloat(0)).toBe(0);
      expect(useEraTimeline.getState().eraFloat(1)).toBe(4);
      // Mid-progress sits between the two era indices.
      const mid = useEraTimeline.getState().eraFloat(0.5);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(4);
    });

    it('resolves specs consistently through the store', () => {
      useEraTimeline.getState().setEra('2005');
      useEraTimeline.getState().transitionTick(TRANSITION_DURATION * 2);
      const s = useEraTimeline.getState();
      expect(s.currentEra).toBe('2005');
      expect(getEraSpec(s.currentEra).year).toBe(2005);
    });
  });
});
