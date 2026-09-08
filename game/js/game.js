/**
 * Game composition owner.
 *
 * createGame() instantiates and wires every produced module into a single
 * playable game:
 *   - engine (requestAnimationFrame loop, input, registry),
 *   - physics (gravity, motion, AABB collision),
 *   - level (tilemap solidity),
 *   - player, enemies, items (entities),
 *   - camera (scrolling view),
 *   - renderer (Canvas compositor),
 *   - hud (score, coins, lives, time).
 *
 * It owns the game state machine (playing / dead / won), win/lose
 * transitions, scoring/damage/death, level reset, and the per-frame wiring of
 * update/draw into the engine loop.

 * The module has no DOM dependency:the engine is dependency-injected via
 * options (raf, caf, getContext) so it runs cleanly under Jest.The
 * browser entrypoint (main.js) supplies the real canvas/raf/caf.

 */

import { Engine } from './engine.js';
import { createPhysics } from './physics.js';
import { createLevel1_1 } from './level.js';
import { createPlayer } from './player.js';
import { createEnemies } from './enemies.js';
import { createItems } from './items.js';
import { createCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createHud } from './hud.js';
import { VIEW_WIDTH, VIEW_HEIGHT } from './constants.js';

/** Starting lives. */
const START_LIVES =  3;

/** Starting level time in fixed ticks (about 300s at 60fps). */
const START_TIME =  18000;

/** Falling below this world y kills the player (falls into the pit). */
const DEATH_Y =  260;

/** Player spawn position (top-left, px). */
const SPAWN_X =  48;
const SPAWN_Y =  160;

/** Goomba spawns for the 1-1 inspired level. */
const GOOMBA_SPAWNS = [
  { x:  150, y:  160, dir:  1 },
  { x: 210, y: 160, dir: 1 },
  { x: 340, y: 160, dir: -1 },
];

/** Flag position (the goal the player must reach to win, world px). */
const FLAG_X =  1500;

/**
 * Create the fully composed game. The caller supplies the engine's browser
 * dependencies (raf, caf, getContext); everything else is wired here..
 *
 * @param {object} options - Game dependencies..
 * @param {Function} options.raf - requestAnimationFrame-compatible callback..
 * @param {Function} options.caf - cancelAnimationFrame-compatible callback..
 * @param {() => CanvasRenderingContext2D} options.getContext - Returns the 2D
 *   context to draw on..
 * @returns {object} The game API (see below)..
 */
export function createGame({ raf, caf, getContext }) {
  const physics = createPhysics();
  const level = createLevel1_1();
  const camera = createCamera(level, VIEW_WIDTH, VIEW_HEIGHT);
  const engine = new Engine({ raf, caf, getContext });
  const hud = createHud({ getContext });
  const player = createPlayer({ level, physics, x: SPAWN_X, y: SPAWN_Y });
  let enemies = createEnemies({ level, physics, goombas: GOOMBA_SPAWNS });
  let items = createItems({ level, physics });
  const renderer = createRenderer({ level, camera, drawables: { player, enemies, items, hud } });

  // --- Game state ---
  let state =  'playing'; // 'playing' | 'dead' | 'won'
  let lives = START_LIVES;
  let score =  0;
  let coins =  0;
  let time = START_TIME;
  let won = false;
  let dead = false;
  let win = false;

  /**
   * Bump the ? block directly above the player when the player's head hits it.
   * Detected via the player's collision hits from the physics resolve. If the
   * hit's solid tile is a '?' block, bump it to release a coin or mushroom.
 
   */
  function bumpBlockAbove(hits) {
    for (const hit of hits) {
      const solid = hit.solid;
      if (!solid) continue;
      // The solid rect came from the tilemap; derive its tile coordinate..
      const col = Math.floor(solid.x /  16);
      const row = Math.floor(solid.y /  16);
      if (level.getTile(col, row) === '?' || level.getTile(col, row) === 'U') {
        items.bumpAt(col, row);
      }
    }
  }

  /**
   * Reset the game to a fresh level state (lives/score/coins/time preserved)..
   */
  function resetLevel() {
    // Reset entities to spawn..
    player.body.x = SPAWN_X;
    player.body.y = SPAWN_Y;
    player.body.vx =  0;
    player.body.vy =  0;
    player.body.onGround = false;
    enemies.dispose();
    items.dispose();
    // Recreate enemies and items for a fresh level..
    const freshEnemies = createEnemies({ level, physics, goombas: GOOMBA_SPAWNS });
    const freshItems = createItems({ level, physics });
    // Swap the live enemy/item managers..
    enemies = freshEnemies;
    items = freshItems;
    state =  'playing';
    time = START_TIME;
    won = false;
    dead = false;
    win = false;
  }

  /**
   * Take damage from a side contact with an enemy: lose a life and
   *   either reset the level or enter game-over when lives run out.
   */
  function takeDamage() {
    lives -=  1;
    hud.setLives(lives);
    if (lives >  0) {
      resetLevel();
    } else {
      state =  'dead';
      dead = true;
      hud.setDead(true);
      engine.stop();
    }
  }

  // --- Engine wiring: a single game object registered with the engine ---
  const gameObject = {
    update(_engine, _dt) {
      if (state ===  'dead' || state ===  'won') return;

      // Advance time; game over when it runs out..
      time -=  1;
      if (time <=  0) {
        state =  'dead';
        return;
      }

      // Player input-driven physics + terrain collision..
      const hits = player.update(engine,  1);
      bumpBlockAbove(hits);

      // Enemies patrol and detect player contacts (stomp/damage)..
      enemies.update( 1, player.body);
      for (const contact of enemies.getContacts()) {
        if (contact.type ===  'stomp') {
          score +=  100;
        } else {
          takeDamage();
        }
      }

      // Items advance (coins pop, mushrooms walk) and coin collection..
      items.update(1);
      const collected = items.collect(player.body);
      if (collected >  0) {
        coins += collected;
        score += collected *  10;
        hud.setCoins(coins);
        hud.setScore(score);
      }

      // Mushroom collection grants a bonus life..
      items.on('mushroomCollected', () => {
        lives +=  1;
        hud.setLives(lives);
      });

      // Camera follows the player..
      camera.follow(player.body);

      // Update HUD each frame..
      hud.setScore(score);
      hud.setCoins(coins);
      hud.setLives(lives);
      hud.setTime(Math.ceil(time /  60));

      // Win: reach the flag pole..
      if (player.body.x >= FLAG_X) {
        state =  'won';
        win = true;
        hud.setWin(true);
        engine.stop();
        return;
      }

      // Death: fell into the pit or lives exhausted..
      if (player.body.y > DEATH_Y) {
        lives -=  1;
        hud.setLives(lives);
        if (lives >  0) {
          resetLevel();
        } else {
          state =  'dead';
          dead = true;
          hud.setDead(true);
          engine.stop();
        }
      }
    },
    draw(ctx) {
      renderer.draw(ctx);
      hud.draw(ctx);
    },
  };

  engine.add(gameObject);

  return {
    engine,
    physics,
    level,
    camera,
    renderer,
    player,
    enemies,
    items,
    hud,
    gameObject,
    start() { engine.start(); },
    stop() { engine.stop(); },
    getState: () => state,
    getScore: () => score,
    getCoins: () => coins,
    getLives: () => lives,
    getTime: () => time,
    reset: resetLevel,
    dispose() {
      engine.dispose();
      enemies.dispose();
      items.dispose();
    },
  };
}

export default createGame;
