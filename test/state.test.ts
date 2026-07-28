/**
 * Tests for state management — StateStore era selection and transitions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StateStore } from '../src/state';
import type { AppState } from '../src/state';
import { ERA_REGISTRY } from '../src/eras';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  describe('initial state', () => {
    it('starts at era 1945', () => {
      const state = store.getState();
      expect(state.era).toBe('1945');
    });

    it('has transition completed initially', () => {
      const state = store.getState();
      expect(state.transition).toBe(1);
      expect(state.isTransitioning).toBe(false);
    });

    it('has default volume of 0.7', () => {
      const state = store.getState();
      expect(state.volume).toBe(0.7);
    });

    it('is not muted initially', () => {
      const state = store.getState();
      expect(state.muted).toBe(false);
    });
  });

  describe('setEra', () => {
    it('starts a transition when era changes', () => {
      store.setEra('2055');
      const state = store.getState();
      expect(state.era).toBe('2055');
      expect(state.isTransitioning).toBe(true);
      expect(state.transition).toBe(0);
      expect(state.prevEra).toBe('1945');
    });

    it('does nothing when setting the same era and not transitioning', () => {
      store.setEra('1945');
      const state = store.getState();
      expect(state.isTransitioning).toBe(false);
    });

    it('updates prevEra on each transition', () => {
      store.setEra('1965');
      expect(store.getState().prevEra).toBe('1945');

      // Wait for transition to complete
      store.update(3.0);
      expect(store.getState().isTransitioning).toBe(false);

      store.setEra('1985');
      expect(store.getState().prevEra).toBe('1965');
    });
  });

  describe('update (transition progress)', () => {
    it('advances transition progress over time', () => {
      store.setEra('2055');
      expect(store.getState().transition).toBe(0);

      store.update(1.0);
      expect(store.getState().transition).toBeGreaterThan(0);
      expect(store.getState().isTransitioning).toBe(true);
    });

    it('completes transition after duration', () => {
      store.setEra('2055');

      // Advance past the 2-second duration
      store.update(2.5);

      const state = store.getState();
      expect(state.isTransitioning).toBe(false);
      expect(state.transition).toBe(1);
    });

    it('snaps immediately under reduced motion', () => {
      // Create a store with reduced motion
      const reducedStore = new StateStore();
      // Simulate reduced motion preference
      (reducedStore as any).state.reducedMotion = true;

      reducedStore.setEra('2055');
      const state = reducedStore.getState();
      expect(state.isTransitioning).toBe(false);
      expect(state.transition).toBe(1);
      expect(state.era).toBe('2055');
    });

    it('returns false when not transitioning', () => {
      const changed = store.update(0.1);
      expect(changed).toBe(false);
    });

    it('returns true when transitioning', () => {
      store.setEra('2055');
      const changed = store.update(0.1);
      expect(changed).toBe(true);
    });
  });

  describe('volume and mute', () => {
    it('clamps volume to 0..1', () => {
      store.setVolume(1.5);
      expect(store.getState().volume).toBe(1);

      store.setVolume(-0.5);
      expect(store.getState().volume).toBe(0);
    });

    it('sets volume correctly within range', () => {
      store.setVolume(0.3);
      expect(store.getState().volume).toBe(0.3);
    });

    it('toggles mute state', () => {
      expect(store.getState().muted).toBe(false);
      store.setMuted(true);
      expect(store.getState().muted).toBe(true);
      store.setMuted(false);
      expect(store.getState().muted).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on state change', () => {
      let lastState: AppState | null = null;
      const unsubscribe = store.subscribe((state) => {
        lastState = state;
      });

      store.setEra('1965');

      expect(lastState).not.toBeNull();
      expect(lastState!.era).toBe('1965');

      unsubscribe();
    });

    it('stops notifying after unsubscribe', () => {
      let callCount = 0;
      const unsubscribe = store.subscribe(() => {
        callCount++;
      });

      store.setEra('1965');
      expect(callCount).toBe(1);

      unsubscribe();
      store.setEra('1985');
      expect(callCount).toBe(1);
    });
  });

  describe('all eras are valid', () => {
    it('can transition to every era in the registry', () => {
      for (const era of ERA_REGISTRY) {
        store.setEra(era.id);
        expect(store.getState().era).toBe(era.id);
        // Complete the transition
        store.update(3.0);
        expect(store.getState().isTransitioning).toBe(false);
      }
    });
  });
});
