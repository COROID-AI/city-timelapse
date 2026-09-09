/**
 * Sanity suite for src/app/renderLoop.ts under jsdom.
 *
 * A deterministic fake requestAnimationFrame drives frames manually so
 * delta-time, pause/dispose, and validation semantics are asserted without a
 * real browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRenderLoop, type RenderLoopHandle } from '../renderLoop';

type FrameCallback = (now: number) => void;

let nextFrameId: number;
let scheduled: Map<number, FrameCallback>;
let nowValue: number;

/** Fires the next due frame, advancing the fake clock by `gapMs`. */
function flushFrame(gapMs = 16.7): void {
  nowValue += gapMs;
  const due = [...scheduled.entries()];
  scheduled.clear();
  for (const [, callback] of due) {
    callback(nowValue);
  }
}

function createCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

beforeEach(() => {
  nextFrameId = 1;
  scheduled = new Map();
  nowValue = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback): number => {
    const id = nextFrameId;
    nextFrameId += 1;
    scheduled.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    scheduled.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startRenderLoop', () => {
  it('calls update once per frame with delta seconds measured between frames', () => {
    const updates: number[] = [];
    const handle = startRenderLoop(createCanvas(), {
      update: (deltaSeconds) => updates.push(deltaSeconds),
    });

    expect(handle.running).toBe(true);
    expect(scheduled.size).toBe(1);

    flushFrame(16.7); // first frame: delta is 0
    flushFrame(20); // 20ms elapsed
    flushFrame(10); // 10ms elapsed

    expect(updates).toHaveLength(3);
    expect(updates[0]).toBeCloseTo(0, 10);
    expect(updates[1]).toBeCloseTo(0.02, 10);
    expect(updates[2]).toBeCloseTo(0.01, 10);
    handle.dispose();
  });

  it('clamps delta time to non-negative values', () => {
    const updates: number[] = [];
    const handle = startRenderLoop(createCanvas(), {
      update: (deltaSeconds) => updates.push(deltaSeconds),
    });

    flushFrame(16.7);
    flushFrame(-5); // simulated clock regression

    expect(updates).toEqual([0, 0]);
    handle.dispose();
  });

  it('dispose cancels the pending frame and calls onDispose exactly once', () => {
    const onDispose = vi.fn();
    const handle = startRenderLoop(createCanvas(), { update: () => {}, onDispose });

    flushFrame();
    expect(scheduled.size).toBe(1);

    handle.dispose();

    expect(scheduled.size).toBe(0);
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(handle.running).toBe(false);

    // dispose is idempotent
    handle.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling when disposed from inside update', () => {
    let handle: RenderLoopHandle;
    const updates: number[] = [];
    handle = startRenderLoop(createCanvas(), {
      update: (deltaSeconds) => {
        updates.push(deltaSeconds);
        if (updates.length === 2) handle.dispose();
      },
    });

    flushFrame();
    flushFrame();

    expect(updates).toHaveLength(2);
    expect(scheduled.size).toBe(0);
    expect(handle.running).toBe(false);
  });

  it('rejects a non-canvas first argument', () => {
    const div = document.createElement('div');
    expect(() =>
      startRenderLoop(div as unknown as HTMLCanvasElement, { update: () => {} }),
    ).toThrow(/HTMLCanvasElement/);
  });

  it('rejects a missing update callback', () => {
    expect(() =>
      startRenderLoop(createCanvas(), {
        update: undefined as unknown as (deltaSeconds: number) => void,
      }),
    ).toThrow(/update callback/);
  });
});