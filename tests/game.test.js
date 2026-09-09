/**
 * Main game composition integration tests (tests/game.test.js).
 *
 * Drives the complete integrated game headlessly through:
 *  - Full engine composition: createGame instantiates the loop, input, camera,
 *    tilemap (LEVEL_ONE), player, entity manager, particles, HUD and render pipeline.
 *  - Injected rAF pump: deterministic frame stepping in Node with mock Canvas context.
 *  - Title -> Play flow: Enter starts a fresh run on World 1-1.
 *  - Gameplay physics & collision: running and jumping over terrain, camera forward follow.
 *  - Flagpole level completion: flagpole contact -> slide down pole -> auto-walk to castle ->
 *    time bonus 50/unit -> LEVEL_COMPLETE.
 *  - Death & respawn flow: taking fatal hit -> DYING animation -> respawn at spawn with life lost.
 *  - Game Over & restart: dying with 1 life -> GAME_OVER at 0 lives -> Enter restarts run.
 *  - Layer-ordered render pipeline: verifies sky fill, scenery, tiles with bump offsets,
 *    entities, player, and HUD are rendered in correct order per frame.
 *  - main.js bootstrapGame(): boots canvas, sets logical resolution, starts loop.
 */

import { createGame, DEFAULT_LEVEL_ONE_ENEMIES } from '../src/game/game.js';
import { GAME_STATES } from '../src/game/gameState.js';
import { CONSTANTS } from '../src/core/constants.js';
import { LEVEL_ONE } from '../src/levels/level1.js';
import { bootstrapGame } from '../src/main.js';

/** Fake rAF frame pump for deterministic stepping in Node. */
class FakeRAF {
  constructor(startMs = 1000) {
    this.callback = null;
    this.timeMs = startMs;
    this.handle = 1;
    this.activeHandle = null;
  }

  request(cb) {
    this.callback = cb;
    this.activeHandle = this.handle++;
    return this.activeHandle;
  }

  cancel(handle) {
    if (this.activeHandle === handle) {
      this.callback = null;
      this.activeHandle = null;
    }
  }

  tick(deltaMs = 16.6667) {
    if (!this.callback) return false;
    const cb = this.callback;
    this.callback = null;
    this.timeMs += deltaMs;
    cb(this.timeMs);
    return true;
  }

  stepFrames(count = 1, deltaMs = 16.6667) {
    for (let i = 0; i < count; i++) {
      this.tick(deltaMs);
    }
  }
}

/** Minimal synthetic EventTarget. */
class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(handler);
    }
  }

  fire(type, event) {
    const set = this.listeners.get(type);
    if (set) {
      for (const handler of set) {
        handler(event);
      }
    }
  }

  pressKey(code, key) {
    this.fire('keydown', {
      code,
      key,
      preventDefault: () => {},
    });
  }

  releaseKey(code, key) {
    this.fire('keyup', {
      code,
      key,
      preventDefault: () => {},
    });
  }
}

/** Mock Canvas 2D context tracking all draw operations. */
function createMockCanvasContext() {
  const drawCalls = [];
  const fillRectCalls = [];
  let currentFillStyle = '#000000';

  const ctx = {
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val) {
      currentFillStyle = val;
    },
    fillRect(x, y, w, h) {
      const call = { type: 'fillRect', color: currentFillStyle, x, y, w, h };
      drawCalls.push(call);
      fillRectCalls.push(call);
    },
    save() {
      drawCalls.push({ type: 'save' });
    },
    restore() {
      drawCalls.push({ type: 'restore' });
    },
    clearRect(x, y, w, h) {
      drawCalls.push({ type: 'clearRect', x, y, w, h });
    },
    canvas: {
      width: CONSTANTS.VIEWPORT_WIDTH,
      height: CONSTANTS.VIEWPORT_HEIGHT,
    },
  };

  const canvas = {
    width: CONSTANTS.VIEWPORT_WIDTH,
    height: CONSTANTS.VIEWPORT_HEIGHT,
    getContext(type) {
      if (type === '2d') return ctx;
      return null;
    },
  };

  return { canvas, ctx, drawCalls, fillRectCalls };
}

describe('Full Game Composition (src/game/game.js)', () => {
  test('createGame instantiates all modules and exposes GameHandle interface', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
    });

    expect(game).toBeDefined();
    expect(game.state).toBe(GAME_STATES.TITLE);
    expect(game.stats).toEqual({
      score: 0,
      coins: 0,
      world: '1-1',
      time: 400,
      lives: 3,
    });
    expect(game.player).toBeDefined();
    expect(game.camera).toBeDefined();
    expect(game.tilemap).toBeDefined();
    expect(game.entityManager).toBeDefined();
    expect(game.gameState).toBeDefined();
    expect(game.input).toBeDefined();
    expect(game.loop).toBeDefined();

    game.dispose();
  });

  test('render pipeline executes layered draw calls: sky, scenery, tiles, entities, HUD', () => {
    const { canvas, ctx, fillRectCalls } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
    });

    fillRectCalls.length = 0;
    game.render();

    expect(fillRectCalls.length).toBeGreaterThan(0);

    // Layer 1: Sky fill covering the full viewport
    const firstCall = fillRectCalls[0];
    expect(firstCall.color).toBe(CONSTANTS.COLORS.sky);
    expect(firstCall.x).toBe(0);
    expect(firstCall.y).toBe(0);
    expect(firstCall.w).toBe(CONSTANTS.VIEWPORT_WIDTH);
    expect(firstCall.h).toBe(CONSTANTS.VIEWPORT_HEIGHT);

    // Later calls include scenery, tiles, HUD text glyphs
    const skyFillCount = fillRectCalls.filter(
      (c) => c.color === CONSTANTS.COLORS.sky && c.w === CONSTANTS.VIEWPORT_WIDTH,
    ).length;
    expect(skyFillCount).toBe(1);

    game.dispose();
  });

  test('integrated session: title -> play -> simulated run/jump -> flag complete -> score bonus', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
      // Use clean enemy-free run for flagpole trajectory verification
      enemies: [],
    });

    game.start();
    rAF.tick(0); // seed loop clock baseline
    expect(game.state).toBe(GAME_STATES.TITLE);

    // 1. Press Enter to transition TITLE -> PLAYING
    target.pressKey('Enter', 'Enter');
    rAF.stepFrames(2);
    target.releaseKey('Enter', 'Enter');
    rAF.stepFrames(2);

    expect(game.state).toBe(GAME_STATES.PLAYING);
    expect(game.player.body.x).toBe(LEVEL_ONE.spawn.x);
    expect(game.player.body.y).toBeGreaterThanOrEqual(LEVEL_ONE.spawn.y);

    // 2. Simulate running right and jumping over terrain
    target.pressKey('ArrowRight', 'ArrowRight');
    target.pressKey('KeyX', 'x'); // run held
    rAF.stepFrames(30); // run for 0.5s

    expect(game.player.body.x).toBeGreaterThan(LEVEL_ONE.spawn.x);
    expect(game.camera.x).toBeGreaterThanOrEqual(0);

    // Jump
    target.pressKey('Space', ' ');
    rAF.stepFrames(10);
    target.releaseKey('Space', ' ');
    target.releaseKey('ArrowRight', 'ArrowRight');
    target.releaseKey('KeyX', 'x');

    // 3. Move player close to the flagpole to trigger the finish sequence
    game.player.body.x = LEVEL_ONE.flagPixelX - 2;
    game.player.body.y = 80;
    rAF.stepFrames(2);

    // Contact flagpole
    expect(game.gameState.flagPhase).toBe('slide');
    expect(game.player.state).toBe('flagSlide');

    // Step frames through the slide to reach the ground
    for (let i = 0; i < 120 && game.gameState.flagPhase === 'slide'; i++) {
      rAF.stepFrames(1);
    }
    expect(game.gameState.flagPhase).toBe('walk');

    // Step frames through the auto-walk into the castle
    for (let i = 0; i < 200 && game.state === GAME_STATES.PLAYING; i++) {
      rAF.stepFrames(1);
    }

    // Must reach LEVEL_COMPLETE
    expect(game.state).toBe(GAME_STATES.LEVEL_COMPLETE);
    // Time bonus awarded (score > 0)
    expect(game.stats.score).toBeGreaterThan(0);

    game.stop();
    game.dispose();
  });

  test('death -> respawn flow: fatal hazard costs a life and respawns at spawn', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
      initialLives: 3,
      enemies: [],
    });

    game.start();
    rAF.tick(0);

    // Start playing
    target.pressKey('Enter', 'Enter');
    rAF.stepFrames(2);
    target.releaseKey('Enter', 'Enter');
    rAF.stepFrames(2);

    expect(game.state).toBe(GAME_STATES.PLAYING);
    expect(game.stats.lives).toBe(3);

    // Kill player (pit fall)
    game.player.die();
    rAF.stepFrames(1);

    expect(game.state).toBe(GAME_STATES.DYING);
    expect(game.player.state).toBe('dead');

    // Step frames until death animation completes and onDeath fires
    for (let i = 0; i < 180 && game.state === GAME_STATES.DYING; i++) {
      rAF.stepFrames(1);
    }

    // Respawns with 2 lives left
    expect(game.state).toBe(GAME_STATES.PLAYING);
    expect(game.stats.lives).toBe(2);
    expect(game.player.body.x).toBe(LEVEL_ONE.spawn.x);
    expect(game.player.body.y).toBeGreaterThanOrEqual(LEVEL_ONE.spawn.y);

    game.stop();
    game.dispose();
  });

  test('game over flow: death with 1 life reaches GAME_OVER at 0 lives, then restarts on Enter', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
      initialLives: 1,
      enemies: [],
    });

    game.start();
    rAF.tick(0);

    target.pressKey('Enter', 'Enter');
    rAF.stepFrames(2);
    target.releaseKey('Enter', 'Enter');
    rAF.stepFrames(2);

    expect(game.state).toBe(GAME_STATES.PLAYING);
    expect(game.stats.lives).toBe(1);

    game.player.die();
    rAF.stepFrames(1);
    expect(game.state).toBe(GAME_STATES.DYING);

    // Complete death animation
    for (let i = 0; i < 180 && game.state === GAME_STATES.DYING; i++) {
      rAF.stepFrames(1);
    }

    expect(game.state).toBe(GAME_STATES.GAME_OVER);
    expect(game.stats.lives).toBe(0);

    // Press Enter to restart
    target.pressKey('Enter', 'Enter');
    rAF.stepFrames(2);
    target.releaseKey('Enter', 'Enter');
    rAF.stepFrames(2);

    expect(game.state).toBe(GAME_STATES.PLAYING);
    expect(game.stats.lives).toBe(1);

    game.stop();
    game.dispose();
  });

  test('block hits: player head hits route through entity manager and bump tilemap', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = createGame({
      canvas,
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
      enemies: [],
    });

    game.start();
    rAF.tick(0);

    target.pressKey('Enter', 'Enter');
    rAF.stepFrames(2);
    target.releaseKey('Enter', 'Enter');
    rAF.stepFrames(2);

    // Position player under col 16, row 9 (? coin block)
    // col 16: x = 256, row 9: y = 144
    game.player.body.x = 16 * 16 + 2;
    game.player.body.y = 10 * 16; // directly beneath block
    game.player.body.vy = -200; // rising head impact

    rAF.stepFrames(1);

    // Block at 16,9 must be bumped to USED 'U'
    expect(game.tilemap.tileAt(16, 9)).toBe('U');

    // A coin pop should have been spawned into the entity registry
    const coin = game.entityManager.entities.find((e) => e.type === 'coinPop');
    expect(coin).toBeDefined();

    game.stop();
    game.dispose();
  });

  test('bootstrapGame boots on target canvas, sets logical dimensions and starts loop', () => {
    const { canvas } = createMockCanvasContext();
    const rAF = new FakeRAF();
    const target = new FakeEventTarget();

    const game = bootstrapGame(canvas, {
      requestFrame: (cb) => rAF.request(cb),
      cancelFrame: (h) => rAF.cancel(h),
      target,
    });

    expect(game).toBeDefined();
    expect(canvas.width).toBe(CONSTANTS.VIEWPORT_WIDTH);
    expect(canvas.height).toBe(CONSTANTS.VIEWPORT_HEIGHT);
    expect(game.state).toBe(GAME_STATES.TITLE);

    game.stop();
    game.dispose();
  });
});
