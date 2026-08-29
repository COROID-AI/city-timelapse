import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLAY_STEP_SECONDS,
  ERA_COUNT,
  TRANSITION_END,
  TRANSITION_START,
  createEraStateStore,
  eraStateStore,
  type EraState,
} from '../EraStateStore';
import { ERA_IDS } from '../eras';
import type { EraId } from '../eras';

const YEARS_ASCENDING = [...ERA_IDS];

describe('EraStateStore — initial state', () => {
  it('starts at 1945 with previousYear 1945, progress 0, not playing', () => {
    const store = createEraStateStore();
    const snap = store.getSnapshot();
    expect(snap.selectedYear).toBe('1945');
    expect(snap.previousYear).toBe('1945');
    expect(snap.transitionProgress).toBe(TRANSITION_START);
    expect(snap.isPlaying).toBe(false);
    expect(snap.playingYearIndex).toBe(0);
    expect(ERA_COUNT).toBe(5);
  });

  it('getSnapshot returns current state without subscribing', () => {
    const store = createEraStateStore();
    const snapA = store.getSnapshot();
    expect(snapA.selectedYear).toBe('1945');
    store.setYear('2005');
    const snapB = store.getSnapshot();
    expect(snapB.selectedYear).toBe('2005');
    expect(snapB.previousYear).toBe('1945');
    // No subscription was created, so no listeners to leak.
  });

  it('exposes a module-level singleton store', () => {
    expect(eraStateStore.getSnapshot().selectedYear).toBe('1945');
  });
});

describe('EraStateStore — setYear and subscribers', () => {
  it('setYear only accepts one of the five valid years and throws otherwise', () => {
    const store = createEraStateStore();
    for (const year of ['1945', '1965', '1985', '2005', '2025'] as const) {
      expect(() => store.setYear(year)).not.toThrow();
    }
    // Reset to a known base first so the invalid call below is comparing cleanly.
    store.setYear('1945');
    expect(() => store.setYear('2019' as EraId)).toThrow(TypeError);
    expect(() => store.setYear('1999' as EraId)).toThrow(TypeError);
    expect(() => store.setYear('' as EraId)).toThrow(TypeError);
  });

  it('setYear notifies subscribers synchronously with the new era state', () => {
    const store = createEraStateStore();
    const received: EraState[] = [];
    store.subscribe((state) => received.push(state));

    store.setYear('1965');
    store.setYear('1985');

    expect(received).toHaveLength(2);
    expect(received[0].selectedYear).toBe('1965');
    expect(received[0].previousYear).toBe('1945');
    expect(received[0].transitionProgress).toBe(TRANSITION_START);
    expect(received[0].isPlaying).toBe(false);
    expect(received[1].selectedYear).toBe('1985');
    expect(received[1].previousYear).toBe('1965');
  });

  it('setYear does not notify when the year is unchanged', () => {
    const store = createEraStateStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setYear('1945');
    expect(listener).not.toHaveBeenCalled();
  });

  it('two different subscribers both receive the same event payload', () => {
    const store = createEraStateStore();
    const seenA: EraState[] = [];
    const seenB: EraState[] = [];
    store.subscribe((state) => seenA.push(state));
    store.subscribe((state) => seenB.push(state));

    store.setYear('2005');

    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(1);
    expect(seenA[0]).toEqual(seenB[0]);
    expect(seenA[0].selectedYear).toBe('2005');
    expect(seenA[0].previousYear).toBe('1945');
  });

  it('unsubscribe stops notification and returned function is idempotent', () => {
    const store = createEraStateStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setYear('1965');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setYear('1985');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribe();
    store.setYear('2005');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one subscriber does not affect the other', () => {
    const store = createEraStateStore();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = store.subscribe(a);
    store.subscribe(b);

    store.setYear('1965');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeA();
    store.setYear('1985');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('clear() drops all subscribers without leaking listeners', () => {
    const store = createEraStateStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.clear();

    store.setYear('1965');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});

describe('EraStateStore — auto-advance play mode', () => {
  it('play() freezes in place mid-transition when stopped without throwing', () => {
    vi.useFakeTimers();
    try {
      const store = createEraStateStore();
      const seen = new Set<EraId>();
      store.subscribe((state) => seen.add(state.selectedYear));

      store.play();
      expect(store.getSnapshot().isPlaying).toBe(true);

      store.stop(); // Before the first step fires: frozen at 1945, nothing thrown.
      expect(store.getSnapshot().isPlaying).toBe(false);
      expect(store.getSnapshot().selectedYear).toBe('1945');
      expect(seen.size).toBe(0);

      vi.advanceTimersByTime(DEFAULT_PLAY_STEP_SECONDS * 1000 * 4);
      expect(store.getSnapshot().selectedYear).toBe('1945');

      // Stopping again is a safe no-op.
      expect(() => store.stop()).not.toThrow();
      const returnedStop = store.play();
      expect(() => returnedStop()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('play() walks all 5 years in ascending order and stops after the last', () => {
    vi.useFakeTimers();
    try {
      const store = createEraStateStore();
      // The store starts at 1945; play() then advances through the remaining
      // eras. Capture the initial year so the full walk is 1945→…→2025.
      const seen: EraId[] = [store.getSnapshot().selectedYear];
      store.subscribe((state) => seen.push(state.selectedYear));

      const returnedStop = store.play();

      const stepMs = DEFAULT_PLAY_STEP_SECONDS * 1000;
      for (let i = 0; i < 10; i += 1) {
        vi.advanceTimersByTime(stepMs);
      }

      expect(seen).toEqual(YEARS_ASCENDING); // 1945 → 1965 → 1985 → 2005 → 2025
      expect(seen).toHaveLength(5);

      const snap = store.getSnapshot();
      expect(snap.selectedYear).toBe('2025');
      expect(snap.playingYearIndex).toBe(0);
      expect(snap.isPlaying).toBe(false);

      expect(returnedStop).toBeTypeOf('function');
      expect(() => returnedStop()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('play() sets isPlaying and playingYearIndex while advancing', () => {
    vi.useFakeTimers();
    try {
      const store = createEraStateStore();
      store.play();
      expect(store.getSnapshot().isPlaying).toBe(true);

      vi.advanceTimersByTime(DEFAULT_PLAY_STEP_SECONDS * 1000);
      expect(store.getSnapshot().selectedYear).toBe('1965');
      expect(store.getSnapshot().playingYearIndex).toBe(2);

      store.stop();
      expect(store.getSnapshot().isPlaying).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() freezes in place mid-transition without throwing', () => {
    const store = createEraStateStore();
    expect(() => store.stop()).not.toThrow();
    store.stop();
    expect(store.getSnapshot().isPlaying).toBe(false);
    expect(store.getSnapshot().transitionProgress).toBe(TRANSITION_START);
    expect(store.getSnapshot().selectedYear).toBe('1945');
    expect(store.getSnapshot().previousYear).toBe('1945');
  });

  it('play() leaves transition progress at the start for each step and reaches the end cap after the run', () => {
    vi.useFakeTimers();
    try {
      const store = createEraStateStore();
      const progresses: number[] = [];
      store.subscribe((state) => progresses.push(state.transitionProgress));

      store.play();
      const stepMs = DEFAULT_PLAY_STEP_SECONDS * 1000;
      for (let i = 0; i < 10; i += 1) {
        vi.advanceTimersByTime(stepMs);
      }

      expect(progresses.every((p) => p === TRANSITION_START)).toBe(true);
      // The store only owns the discrete era state; a downstream engine can
      // push transitionProgress toward TRANSITION_END across the step window.
      expect(TRANSITION_END).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});