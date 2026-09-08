/**
 * Full-composition integration tests for the game (game.js + hud.js + main.js).
 *
 * Verifies the composed game wires every produced module and drives them through
 * the engine loop:
 *   - entities are registered (engine registry + composed managers),
 *   - update/draw are invoked per engine frame,
 *   - stomping a Goomba increments the score,
 *   - coin pickup increments the HUD coin/score counters,
 *   - death (falling into the pit) decrements lives and eventually game-over,
 *   - reaching the flag pole triggers the win transition.


 */

import { createGame } from '../../game/js/game.js';

/** Build a fake 2D canvas context that records drawing calls. */
function makeFakeContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    font: null,
    textBaseline: null,
    calls,
    fillRect(x, y, w, h) {
      calls.push({ type: 'fillRect', x, y, w, h });
    },
    translate(x, y) {
      calls.push({ type: 'translate', x, y });
    },
    save() {
      calls.push({ type: 'save' });
    },
    restore() {
      calls.push({ type: 'restore' });
    },
    fillText(text, x, y) {
      calls.push({ type: 'fillText', text, x, y });
    },
    measureText(text) {
      return { width: String(text).length * 6 };
    },
  };
  return ctx;
}

/** A no-op raf/caf that never schedules a frame (tests drive steps directly). */
function makeLoopDeps(ctx) {
  let frameId =  0;
  return {
    raf: jest.fn((cb) => { frameId +=  1; return frameId; }),
    caf: jest.fn(),
    getContext: () => ctx,
  };
}

describe('game composition', () => {
  test('registers the composed game objectand exposes every module', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    expect(game.engine).toBeTruthy();
    expect(game.physics).toBeTruthy();
    expect(game.level).toBeTruthy();
    expect(game.camera).toBeTruthy();
    expect(game.player).toBeTruthy();
    expect(game.enemies).toBeTruthy();
    expect(game.items).toBeTruthy();
    expect(game.hud).toBeTruthy();
    expect(game.engine.objects.has(game.gameObject)).toBe(true);
  });

  test('drives update/draw every engine frame', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    const playerUpdate = jest.spyOn(game.player, 'update');
    const enemyUpdate = jest.spyOn(game.enemies, 'update');
    const itemUpdate = jest.spyOn(game.items, 'update');
    const rendererDraw = jest.spyOn(game.renderer, 'draw');
    const hudDraw = jest.spyOn(game.hud, 'draw');

    game.engine.step();
    game.engine.draw();

    expect(playerUpdate).toHaveBeenCalled();
    expect(enemyUpdate).toHaveBeenCalled();
    expect(itemUpdate).toHaveBeenCalled();
    expect(rendererDraw).toHaveBeenCalled();
    expect(hudDraw).toHaveBeenCalled();
  });

  test('stomping a Goomba increments the score', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    const before = game.getScore();

    const goomba = game.enemies.addGoomba({ x: game.player.body.x, y: game.player.body.y + game.player.body.h -  1, dir:  1 });
    game.player.body.vy =  0.5;
    game.player.body.onGround = false;
    game.player.body.y = goomba.y - game.player.body.h +  0.5;

    game.engine.step();

    expect(game.getScore()).toBe(before +  100);
    expect(game.enemies.getGoombas().some((g) => g.state ===  'squashed')).toBe(true);
  });

  test('coin pickup increments the HUD counters', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    const coinsBefore = game.getCoins();

    const block = game.items.blocks.find((b) => !b.used);
    expect(block).toBeTruthy();
    game.items.bump(block);
    const coin = game.items.coins[0];
    expect(coin).toBeTruthy();
    coin.x = game.player.body.x;
    coin.y = game.player.body.y;

    game.engine.step();

    expect(game.getCoins()).toBe(coinsBefore +  1);
    expect(game.getScore()).toBeGreaterThan(0);
    expect(game.hud.getCoins()).toBe(game.getCoins());
  });

  test('falling into the pit decrements livesand eventually game-over', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    while (game.getLives() >  1) {
      game.player.body.y =  9999;
      game.engine.step();
    }
    expect(game.getLives()).toBe(1);
    game.player.body.y =  9999;
    game.engine.step();
    expect(game.getState()).toBe('dead');
    expect(game.hud.isDead()).toBe(true);
    expect(game.engine.running).toBe(false);
  });

  test('reaching the flag pole triggers the win transition', () => {
    const ctx = makeFakeContext();
    const game = createGame(makeLoopDeps(ctx));
    game.player.body.x =  2000;

    game.engine.step();

    expect(game.getState()).toBe('won');
    expect(game.hud.isWin()).toBe(true);
    expect(game.engine.running).toBe(false);
  });
});
