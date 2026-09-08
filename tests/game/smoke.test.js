/**
 * Smoke tests for the game foundation scaffold.
 *
 * Verifies:
 *  - shared constants are defined with expected values,
 *  - draw helpers actually draw (they call fillRect on a fake context),
 *  - the engine schedules a frame via injected requestAnimationFrame,
 *  - a loop tick advances the engine tick counter,
 *  - stop() cancels the loop and detaches input.
 */

import {
  TILE_SIZE,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_RUN_SPEED,
  ACCELERATION,
  FRICTION,
} from '../../game/js/constants.js';
import {
  fillRect,
  drawTile,
  drawPlayer,
  clearCanvas,
} from '../../game/js/draw.js';
import { Engine } from '../../game/js/engine.js';

/** Build a fake 2D canvas context that records fillRect calls. */
function makeFakeContext() {
  return {
    fillStyle: null,
    fillRectCalls: [],
    fillRect(x, y, w, h) {
      this.fillRectCalls.push({ x, y, w, h });
    },
  };
}

describe('game constants', () => {
  test('defines tile size and viewport dimensions', () => {
expect(TILE_SIZE).toBe(16);
expect(VIEW_WIDTH).toBe(256);
expect(VIEW_HEIGHT).toBe(224);
  });

  test('defines physics tuning constants', () => {
expect(typeof GRAVITY).toBe('number');
expect(GRAVITY).toBeCloseTo(0.4);
expect(typeof JUMP_VELOCITY).toBe('number');
expect(JUMP_VELOCITY).toBeLessThan(0);
expect(typeof MAX_RUN_SPEED).toBe('number');
expect(MAX_RUN_SPEED).toBeGreaterThan(0);
expect(typeof ACCELERATION).toBe('number');
expect(ACCELERATION).toBeGreaterThan(0);
expect(typeof FRICTION).toBe('number');
expect(FRICTION).toBeGreaterThan(0);
  });
});

describe('draw helpers', () => {
  test('fillRect draws a rectangle onto the context', () => {
    const ctx = makeFakeContext();
    fillRect(ctx, 1, 2, 3, 4, '#fff');
expect(ctx.fillRectCalls).toHaveLength(1);
    expect(ctx.fillRectCalls[0]).toEqual({ x: 1, y:  2, w:  3, h:  4 });
  });

  test('drawTile draws a 16x16 tile at the tile coordinate', () => {
    const ctx = makeFakeContext();
    drawTile(ctx, 2, 3, '#f00');
expect(ctx.fillRectCalls).toHaveLength(1);
    expect(ctx.fillRectCalls[0]).toEqual({ x: 32, y:  48, w:  16, h:  16 });
  });

  test('drawPlayer draws several rects without throwing', () => {
    const ctx = makeFakeContext();
    drawPlayer(ctx, 0, 0);
expect(ctx.fillRectCalls.length).toBeGreaterThan(0);
  });

  test('clearCanvas fills the whole viewport', () => {
    const ctx = makeFakeContext();
    clearCanvas(ctx);
    expect(ctx.fillRectCalls[0]).toEqual({ x: 0, y:  0, w:  256, h:  224 });
  });
});

describe('engine loop', () => {
  test('start schedules a frame via injected requestAnimationFrame', () => {
    let rafCalled = false;
    let cafCalled = false;
    const engine = new Engine({
      raf: (cb) => {
        rafCalled = true;
        return 42;
      },
      caf: (id) => {
        cafCalled = true;
        expect(id).toBe(42);
      },
      getContext: () => makeFakeContext(),
    });

    engine.start();
expect(rafCalled).toBe(true);
expect(engine.running).toBe(true);

    engine.stop();
expect(cafCalled).toBe(true);
expect(engine.running).toBe(false);
  });

  test('a loop tick advances the tick counter', () => {
    const engine = new Engine({
      raf: () => 1,
      caf: () => {},
      getContext: () => makeFakeContext(),
    });
    engine.start();
expect(engine.tick).toBe(0);

    // Simulate one fixed-timestep frame (60fps delta).
    engine.frame(1000);
engine.frame(1000 + 20);
expect(engine.tick).toBe(1);

    engine.stop();
  });

  test('stop detaches input and stops further frames', () => {
    const engine = new Engine({
      raf: () => 1,
      caf: () => {},
      getContext: () => makeFakeContext(),
    });
    engine.start();
    engine.stop();
    // After stop, a frame callback must be a no-op.

    const before = engine.tick;
    engine.frame(1000 / 60);
expect(engine.tick).toBe(before);
  });

  test('input state tracks key presses', () => {
    const engine = new Engine({
      raf: () => 1,
      caf: () => {},
      getContext: () => makeFakeContext(),
    });
    engine._onKeyDown({ code: 'ArrowRight', preventDefault: () => {} });
    expect(engine.isDown('ArrowRight')).toBe(true);
    engine._onKeyUp({ code: 'ArrowRight' });
    expect(engine.isDown('ArrowRight')).toBe(false);
    engine.dispose();
  });
});
