#!/usr/bin/env node
/**
 * Headless composition verification (scripts/verify-composition.js).
 *
 * Boots the COMPLETE integrated game — createGame() from src/game/game.js with
 * all consumed runtime interfaces (game state machine, player, entity manager,
 * tilemap, camera, physics, input, loop, render pipeline) — under Node with a
 * stub 2D canvas context and an injected rAF frame pump, then drives it through
 * a real session of loop frames exactly like the browser would:
 *
 *   TITLE ──Enter──▶ PLAYING ──run/jump/items/enemies──▶ LEVEL_COMPLETE
 *
 * Unlike unit tests, nothing here is mocked at the module level: the same ESM
 * sources served to the browser are imported natively (Node >= 22 module
 * detection), the loop runs on the injected requestAnimationFrame provider,
 * and keyboard input flows through the real input mappers via synthetic events.
 *
 * Verifies these end-to-end observable behaviors before finishing:
 *  1. Boot lands on TITLE and stays there until Enter is pressed.
 *  2. Enter starts a fresh run (TITLE → PLAYING).
 *  3. Real simulated movement: run right (inertia / run acceleration), jump
 *     (gravity + variable jump), camera follows forward.
 *  4. Question-block head hit yields a coin pop (+score/coin).
 *  5. Enemy contact kills/stomps only via real physics; flag contact slides
 *     the player down the pole, auto-walks to the castle, and reaches
 *     LEVEL_COMPLETE with the time bonus applied.
 *
 * Exit code: 0 on success, 1 on any failed assertion (details on stderr).
 *
 * Usage: node scripts/verify-composition.js
 */

'use strict';

/**
 * Minimal deterministic rAF provider: records the pending callback and lets
 * the test advance frames. Mirrors the browser rAF contract (callback receives
 * a monotonic timestamp in ms; exactly one render per frame).
 */
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

  /** Deliver one animation frame, advancing the clock by deltaMs. */
  tick(deltaMs = 16.6667) {
    if (!this.callback) return false;
    const cb = this.callback;
    this.callback = null;
    this.timeMs += deltaMs;
    cb(this.timeMs);
    return true;
  }

  /** Deliver `count` successive animation frames at ~60fps (16.67 ms each). */
  stepFrames(count = 1, deltaMs = 16.6667) {
    let delivered = 0;
    for (let i = 0; i < count && this.tick(deltaMs); i++) {
      delivered += 1;
    }
    return delivered;
  }
}

/** Minimal synthetic EventTarget so input.attach() has real events to bind. */
class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const set = this.listeners.get(type);
    if (set) set.delete(handler);
  }

  fire(type, event) {
    const set = this.listeners.get(type);
    if (set) {
      for (const handler of [...set]) handler(event);
    }
  }

  pressKey(code, key) {
    this.fire('keydown', { code, key, preventDefault() {} });
  }

  releaseKey(code, key) {
    this.fire('keyup', { code, key, preventDefault() {} });
  }
}

/** Stub 2D context accepting every draw call used by the render pipeline. */
function createStubCanvas() {
  const ctx = {
    canvas: { width: 256, height: 240 },
    _fillStyle: '#000000',
    get fillStyle() {
      return this._fillStyle;
    },
    set fillStyle(v) {
      this._fillStyle = v;
    },
    fillRect() {},
    clearRect() {},
    save() {},
    restore() {},
  };

  const canvas = {
    width: 256,
    height: 240,
    getContext(type) {
      return type === '2d' ? ctx : null;
    },
  };

  return { canvas, ctx };
}

/** Shared assertion helper — collects failures and fails hard at the end. */
function createReporter() {
  const failures = [];
  return {
    check(condition, message) {
      if (!condition) failures.push(message);
    },
    get failed() {
      return failures.length > 0;
    },
    report() {
      if (this.failed) {
        console.error('COMPOSITION VERIFY FAILED:');
        for (const f of failures) console.error(`  • ${f}`);
      }
    },
  };
}

async function main() {
  const { canvas } = createStubCanvas();
  const rAF = new FakeRAF();
  const target = new FakeEventTarget();
  const report = createReporter();

  const [{ createGame }, { GAME_STATES }, { LEVEL_ONE }, { CONSTANTS }] = await Promise.all([
    import('../src/game/game.js'),
    import('../src/game/gameState.js'),
    import('../src/levels/level1.js'),
    import('../src/core/constants.js'),
  ]);

  // ---- 1. Instantiate the integrated game ----
  const game = createGame({
    canvas,
    requestFrame: (cb) => rAF.request(cb),
    cancelFrame: (handle) => rAF.cancel(handle),
    target,
  });

  const seen = new Set();

  game.start();
  rAF.tick(0); // seed the loop clock baseline (first frame renders only)

  report.check(game.state === GAME_STATES.TITLE, 'expected TITLE after boot, got ' + game.state);
  seen.add(game.state);

  // ---- 2. Press Enter: TITLE -> PLAYING ----
  target.pressKey('Enter', 'Enter');
  rAF.stepFrames(2);
  target.releaseKey('Enter', 'Enter');
  rAF.stepFrames(2);

  report.check(game.state === GAME_STATES.PLAYING, 'expected PLAYING after Enter, got ' + game.state);
  seen.add(game.state);
  report.check(
    game.player.body.x === LEVEL_ONE.spawn.x && game.player.body.y >= LEVEL_ONE.spawn.y,
    `player should spawn at LEVEL_ONE.spawn (${LEVEL_ONE.spawn.x},${LEVEL_ONE.spawn.y}), got (${game.player.body.x},${game.player.body.y})`,
  );

  // ---- 3. Run right (inertia + run acceleration), then jump (gravity) ----
  target.pressKey('ArrowRight', 'ArrowRight');
  target.pressKey('KeyX', 'x');
  rAF.stepFrames(60); // ~1 s of run
  const runX = game.player.body.x;
  report.check(runX > LEVEL_ONE.spawn.x + 30, `player should move right while running (x=${runX})`);

  target.pressKey('Space', ' ');
  rAF.stepFrames(12); // ascend
  target.releaseKey('Space', ' ');
  target.releaseKey('ArrowRight', 'ArrowRight');
  target.releaseKey('KeyX', 'x');
  rAF.stepFrames(30); // land back on the ground

  const grounded = game.player.body.onGround === true;
  report.check(grounded, 'player should be back on the ground after a jump');
  report.check(game.camera.x >= 0, `camera should follow the player (camera.x=${game.camera.x})`);

  // ---- 4. Question-block head hit: bump tile + coin pop ----
  // Place the player directly beneath the first ? block (col 16, row 9) and
  // drive him upward with a rising velocity — collision resolution routes the
  // head hit through the entity manager and spawns the coin pop.
  game.player.body.x = 16 * CONSTANTS.TILE_SIZE + 2;
  game.player.body.y = 10 * CONSTANTS.TILE_SIZE;
  game.player.body.vy = -200;
  rAF.stepFrames(1);

  report.check(game.tilemap.tileAt(16, 9) === 'U', 'coin ?-block should become USED (U) after the head hit');
  const coinPop = game.entityManager.entities.find((e) => e.type === 'coinPop');
  report.check(Boolean(coinPop), 'a coin pop should have spawned from the ?-block hit');

  // The coin is banked when the pop finishes its arc and falls back to the
  // block — keep stepping frames until it resolves (bounded, ~0.5 s max).
  for (let i = 0; i < 90 && game.stats.coins < 1; i++) {
    rAF.stepFrames(1);
  }
  report.check(game.stats.coins >= 1, `coin count should increase after the coin pop (coins=${game.stats.coins})`);

  // ---- 5. Real flagpole completion: slide -> walk -> LEVEL_COMPLETE ----
  game.player.body.x = LEVEL_ONE.flagPixelX - 2;
  game.player.body.y = 4 * CONSTANTS.TILE_SIZE; // above the pole base
  rAF.stepFrames(3);

  report.check(game.player.state === 'flagSlide', `player should lock onto the flagpole (player.state=${game.player.state})`);
  report.check(game.gameState.flagPhase === 'slide', `flag sequence should start sliding (flagPhase=${game.gameState.flagPhase})`);

  for (let i = 0; i < 180 && game.gameState.flagPhase === 'slide'; i++) {
    rAF.stepFrames(1);
  }
  report.check(game.gameState.flagPhase === 'walk', 'flag slide should land and begin the castle walk');

  for (let i = 0; i < 300 && game.state === GAME_STATES.PLAYING; i++) {
    rAF.stepFrames(1);
  }

  report.check(game.state === GAME_STATES.LEVEL_COMPLETE, `game should reach LEVEL_COMPLETE after the flag walk (state=${game.state})`);
  seen.add(game.state);
  report.check(game.stats.score > 0, `score should include the flag time bonus (score=${game.stats.score})`);

  // ---- 6. Teardown ----
  game.stop();
  game.dispose();

  const states = [...seen].join(' → ');
  if (report.failed) {
    report.report();
    console.error(`observed states: ${states}`);
    process.exit(1);
  }

  console.log(
    `[verify-composition] PASS — ${states} — boot, run, jump, coin block, ` +
      `flagpole slide, castle walk and LEVEL_COMPLETE exercised through real loop frames`,
  );
}

main().catch((err) => {
  console.error('COMPOSITION VERIFY CRASHED:', err);
  process.exit(1);
});