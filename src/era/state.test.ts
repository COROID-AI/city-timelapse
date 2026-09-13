import { describe, expect, it, vi } from 'vitest';
import { EraStore } from './state';
import { ERA_YEARS, type EraId } from './types';

describe('EraStore', () => {
  it('starts on the earliest era by default', () => {
    const store = new EraStore();
    expect(store.current).toBe(ERA_YEARS[0]);
    expect(store.transition).toBeNull();
  });

  it('honors an explicit initial era', () => {
    expect(new EraStore({ initialEra: 2005 }).current).toBe(2005);
  });

  it('rejects an unknown initial era', () => {
    expect(() => new EraStore({ initialEra: 2055 as EraId })).toThrow();
  });

  it('requestEra notifies subscribers with from/to/progress transition state', () => {
    const store = new EraStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.requestEra(1965);

    expect(store.current).toBe(1965);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      current: 1965,
      transition: { from: 1945, to: 1965, progress: 0 },
    });
  });

  it('requestEra returns the new snapshot', () => {
    const snapshot = new EraStore().requestEra(1985);
    expect(snapshot).toEqual({
      current: 1985,
      transition: { from: 1945, to: 1985, progress: 0 },
    });
  });

  it('is idempotent for same-era requests — no transition, no notification', () => {
    const store = new EraStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const snapshot = store.requestEra(1945);

    expect(store.current).toBe(1945);
    expect(store.transition).toBeNull();
    expect(snapshot.transition).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps an in-flight transition when its target is re-requested', () => {
    const store = new EraStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.requestEra(2005);
    store.setTransitionProgress(0.5);
    listener.mockClear();

    const snapshot = store.requestEra(2005);

    expect(store.current).toBe(2005);
    expect(snapshot.transition).toEqual({ from: 1945, to: 2005, progress: 0.5 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('setTransitionProgress updates progress and notifies', () => {
    const store = new EraStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.requestEra(1985);
    listener.mockClear();

    store.setTransitionProgress(0.25);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      current: 1985,
      transition: { from: 1945, to: 1985, progress: 0.25 },
    });
  });

  it('setTransitionProgress clamps to [0, 1] and settles at 1', () => {
    const store = new EraStore();
    store.requestEra(2005);

    store.setTransitionProgress(-5);
    expect(store.transition?.progress).toBe(0);

    store.setTransitionProgress(0.5);
    expect(store.transition?.progress).toBe(0.5);

    store.setTransitionProgress(2);
    expect(store.transition).toBeNull();
    expect(store.current).toBe(2005);
  });

  it('setTransitionProgress without an active transition is a silent no-op', () => {
    const store = new EraStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const snapshot = store.setTransitionProgress(0.5);

    expect(store.transition).toBeNull();
    expect(snapshot.transition).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications and is idempotent', () => {
    const store = new EraStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.requestEra(1965);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribe();

    store.requestEra(1985);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies all subscribers and keeps the rest active after one unsubscribes', () => {
    const store = new EraStore();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = store.subscribe(first);
    store.subscribe(second);

    store.requestEra(1985);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    store.requestEra(2025);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown eras at runtime', () => {
    const store = new EraStore();
    expect(() => store.requestEra(2055 as EraId)).toThrow();
  });

  it('getSnapshot returns fresh immutable copies on every call', () => {
    const store = new EraStore();
    store.requestEra(1965);

    const a = store.getSnapshot();
    const b = store.getSnapshot();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.transition).not.toBe(b.transition);
  });
});