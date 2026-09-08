/**
 * Item system: coins, mushrooms and '?' item blocks.
 *
 * Item blocks are solid tiles that, when bumped from below, either release a
 * coin (with a pop animation and bounce) or spawn a mushroom. Coins spin
 * through sprite frames and are collected on contact; mushrooms emerge from
 * the block and move horizontally using the shared physics engine (gravity,
 * wall collision via the tilemap) until collected.
 *
 * This module has no DOM dependency. Rendering is done exclusively with the
 * draw.js fillRect helper via the pixel-art sprite maps in sprites.js — no
 * images, no external assets.
 *
 * Consumes:
 *   - physics (game/js/physics.js): gravity, AABB overlap + collision resolve
 *   - level  (game/js/level.js):  tilemap solidity query + tile mutation
 *   - sprites/draw (game/js/sprites.js, game/js/draw.js): fillRect sprite maps
 */

import { TILE_SIZE } from './constants.js';
import { createPhysics } from './physics.js';
import { drawSprite, sprites } from './sprites.js';
import { TILE } from './level.js';

/** Duration (in frames) of the block bump pop animation. */
const BUMP_DURATION = 8;
/** Peak upward offset (px) of a bumped block above its resting position. */
const BUMP_RANGE = 8;

/* --- Coin pop tuning --- */
/** Initial upward velocity (px/frame) when a coin pops out of a block. */
const COIN_POP_VELOCITY = -4.5;
/** Gravity applied to a coin during its pop-and-bounce arc. */
const COIN_GRAVITY = 0.5;
/** Sprite-frame swap interval (frames) for the spinning animation. */
const COIN_FRAME_PERIOD = 4;
/** Coin sprite / hitbox width (px). */
const COIN_W = 12;
/** Coin sprite / hitbox height (px). */
const COIN_H = 12;

/* --- Mushroom tuning --- */
/** Upward emergence speed (px/frame) while the mushroom exits a block. */
const MUSHROOM_RISE_SPEED = -2.5;
/** Horizontal walk speed (px/frame) once emerged. */
const MUSHROOM_SPEED = 1.1;

/**
 * Build an item-control object bound to a level and physics engine.
 *
 * @param {object} deps
 * @param {object} deps.level - Level from createLevel() (see game/js/level.js).
 * @param {object} [deps.physics] - Physics API (defaults to createPhysics()).
 * @param {Array<{col:number,row:number,content?:'coin'|'mushroom'}>} [deps.blocks]
 *   - Explicit '?' block list. When omitted, '?' blocks are discovered from the
 *     level grid (all default to 'coin' unless deps.defaultContent is set).
 * @param {'coin'|'mushroom'} [deps.defaultContent='coin'] - Content used for
 *   blocks discovered from the grid when not otherwise specified.
 * @returns {object} items API (update/draw/bump/collect/on/dispose helpers).
 */
export function createItems(deps) {
  const level = deps.level;
  const physics = deps.physics || createPhysics();

  /** All pooled item blocks (discovered or explicitly supplied). */
  const blocks = [];

  /** Active coin entities (popping or resting on a block top). */
  const coins = [];
  /** Active mushroom entities. */
  const mushrooms = [];

  /** Tile coords of drained '?' blocks, excluded from tilemap solidity. */
  const usedBlockCoords = [];
  /** Running count of coins collected this run (survives pool pruning). */
  let collectedCount = 0;

  /** Simple event emitter. */
  const listeners = {
    block: [],
    coinCollected: [],
    mushroomCollected: [],
  };

  function emit(event, payload) {
    for (const fn of listeners[event] || []) fn(payload);
  }

  /** Whether a tile coordinate belongs to a drained block. */
  function isUsedCoord(col, row) {
    return usedBlockCoords.some((c) => c.col === col && c.row === row);
  }

  /** Build the initial block list. */
  function initBlocks() {
    if (deps.blocks) {
      for (const spec of deps.blocks) {
        blocks.push(makeBlock(spec.col, spec.row, spec.content));
      }
      return;
    }
    // Scan the level grid for '?' tiles not already drained.
    for (let row = 0; row < level.height; row += 1) {
      for (let col = 0; col < level.width; col += 1) {
        if (level.getTile(col, row) === TILE.QUESTION) {
          blocks.push(makeBlock(col, row, deps.defaultContent));
        }
      }
    }
  }

  /** Create a block record at a tile coordinate. */
  function makeBlock(col, row, content) {
    return {
      col,
      row,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE,
      content: content || 'coin',
      used: false,
      bumpTimer: 0,
    };
  }

  /**
   * Collect the solid tile rects overlapping a body, skipping drained blocks.
   * Used blocks are not solid, so an emitted item isn't trapped by the block
   * it just came out of.
   */
  function collectSolids(body) {
    const solids = [];
    const minCol = Math.floor(body.x / TILE_SIZE);
    const maxCol = Math.floor((body.x + body.w - 1) / TILE_SIZE);
    const minRow = Math.floor(body.y / TILE_SIZE);
    const maxRow = Math.floor((body.y + body.h - 1) / TILE_SIZE);
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        if (c < 0 || r < 0 || c >= level.width || r >= level.height) continue;
        if (isUsedCoord(c, r)) continue;
        if (!level.isSolidAt(c, r)) continue;
        solids.push({
          x: c * TILE_SIZE,
          y: r * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
        });
      }
    }
    return solids;
  }

  /** Mark a block drained and update the tilemap + exclusion set. */
  function drainBlock(block) {
    if (block.used) return;
    block.used = true;
    if (level.grid[block.row]) {
      level.grid[block.row][block.col] = TILE.USED;
    }
    usedBlockCoords.push({ col: block.col, row: block.row });
  }

  /** Create a spinning/pop coin attached to a just-bumped block. */
  function spawnCoin(block) {
    const coin = {
      type: 'coin',
      x: block.x + (TILE_SIZE - COIN_W) / 2,
      // Start just below the block, then pop up and bounce back to rest.
      y: block.y + TILE_SIZE,
      baseY: block.y - COIN_H, // resting position on top of the block
      apexY: block.y - COIN_H - TILE_SIZE, // pop bounce apex
      w: COIN_W,
      h: COIN_H,
      vy: COIN_POP_VELOCITY,
      state: 'pop',
      frame: 0,
      frameTimer: 0,
      alive: true,
      collected: false,
    };
    coins.push(coin);
    return coin;
  }

  /** Spawn a mushroom emerging from a just-bumped block. */
  function spawnMushroom(block) {
    const mushroom = {
      type: 'mushroom',
      x: block.x,
      y: block.y, // starts inside the block
      baseY: block.y - TILE_SIZE, // fully emerged position
      w: TILE_SIZE,
      h: TILE_SIZE,
      vx: MUSHROOM_SPEED,
      vy: 0,
      riseSpeed: MUSHROOM_RISE_SPEED,
      onGround: false,
      emerging: true,
      alive: true,
      collected: false,
    };
    mushrooms.push(mushroom);
    return mushroom;
  }

  /**
   * Bump a block from below, releasing its content. No-op (returns null) for
   * drained or non-existent blocks.
   *
   * @returns {object|null} The spawned coin/mushroom, or null if empty/invalid.
   */
  function bump(block) {
    if (!block || block.used) return null;
    block.used = true;
    block.bumpTimer = BUMP_DURATION;
    drainBlock(block);

    if (block.content === 'mushroom') {
      const mushroom = spawnMushroom(block);
      emit('block', { block, content: 'mushroom', item: mushroom });
      return mushroom;
    }

    const coin = spawnCoin(block);
    emit('block', { block, content: 'coin', item: coin });
    return coin;
  }

  /**
   * Find the item block at a tile coordinate and bump it. Convenience for
   * callers that know the tile (e.g. collision with the tile grid).
   *
   * @returns {object|null} Anything released, else null.
   */
  function bumpAt(col, row) {
    const block = blocks.find((b) => b.col === col && b.row === row);
    return bump(block);
  }

  /**
   * Advance the simulation one (or dt) condensed update.
   *
   * @param {number} [dt=1] - Fixed-timestep multiplier (1 frame).
   */
  function update(dt = 1) {
    // Advance block pop animation.
    for (const block of blocks) {
      if (block.bumpTimer > 0) {
        block.bumpTimer = Math.max(0, block.bumpTimer - dt);
      }
    }

    // Coins: pop-and-bounce, then idle spin animation.
    for (const coin of coins) {
      if (coin.collected) continue;
      if (coin.state === 'pop') {
        if (coin.vy < 0) {
          coin.y += coin.vy * dt;
          if (coin.y <= coin.apexY) {
            coin.y = coin.apexY;
            coin.vy = 0;
          }
        } else {
          coin.vy += COIN_GRAVITY * dt;
          coin.y += coin.vy * dt;
          if (coin.y >= coin.baseY) {
            coin.y = coin.baseY;
            coin.vy = 0;
            coin.state = 'rest';
          }
        }
      }
      // Always spin the animation frames.
      coin.frameTimer += dt;
      if (coin.frameTimer >= COIN_FRAME_PERIOD) {
        coin.frameTimer -= COIN_FRAME_PERIOD;
        coin.frame = (coin.frame + 1) % sprites.coin.spin.length;
      }
    }

    // Mushrooms: emerge, then walk using physics (gravity + tile collision).
    for (const mushroom of mushrooms) {
      if (mushroom.collected) continue;
      const incomingVx = mushroom.vx;

      if (mushroom.emerging) {
        mushroom.y += mushroom.riseSpeed * dt;
        if (mushroom.y <= mushroom.baseY) {
          mushroom.y = mushroom.baseY;
          mushroom.emerging = false;
        }
      } else {
        physics.applyGravity(mushroom, dt);
      }

      // Integrate horizontal always; vertical only from gravity after emerge.
      mushroom.x += incomingVx * dt;
      if (!mushroom.emerging) mushroom.y += mushroom.vy * dt;

      // Wall / floor collision via the tilemap — drained blocks are skipped.
      const hits = physics.resolveCollisions(mushroom, collectSolids(mushroom));
      const sideHit = hits.find((h) => h.side === 'left' || h.side === 'right');
      if (sideHit) {
        mushroom.vx = -incomingVx; // bounce off walls
      }
    }
  }

  /** Return a body rect for a coin for AABB contact checks. */
  function coinRect(coin) {
    return { x: coin.x, y: coin.y, w: coin.w, h: coin.h };
  }

  /** Remove collected items from a live pool. */
  function prune(pool, targets) {
    if (targets.length === 0) return;
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      if (targets.includes(pool[i])) pool.splice(i, 1);
    }
  }

  /**
   * Resolve player contact: collect coins on touch and stop mushrooms once
   * the player overlaps them.
   *
   * @param {object} body - Player body model {x,y,w,h}.
   * @returns {number} Number of coins collected this call.
   */
  function collect(body) {
    let collected = 0;
    const coinTargets = [];
    const mushroomTargets = [];

    for (const coin of coins) {
      if (coin.collected) continue;
      if (physics.overlaps(body, coinRect(coin))) {
        coin.collected = true;
        coin.alive = false;
        collected += 1;
        collectedCount += 1;
        emit('coinCollected', { coin, count: collectedCount });
        coinTargets.push(coin);
      }
    }
    for (const mushroom of mushrooms) {
      if (mushroom.collected) continue;
      if (physics.overlaps(body, mushroom)) {
        mushroom.collected = true;
        mushroom.alive = false;
        emit('mushroomCollected', { mushroom });
        mushroomTargets.push(mushroom);
      }
    }
    prune(coins, coinTargets);
    prune(mushrooms, mushroomTargets);
    return collected;
  }

  /**
   * Render all item blocks, coins and mushrooms — fillRect sprite maps only.
   *
   * @param {CanvasRenderingContext2D} ctx - 2D canvas context.
   */
  function draw(ctx) {
    for (const block of blocks) {
      const offset = block.bumpTimer > 0
        ? (block.bumpTimer / BUMP_DURATION) * BUMP_RANGE
        : 0;
      const grid = block.used ? sprites.tiles.used : sprites.tiles.question;
      drawSprite(ctx, grid, block.x, block.y - offset);
    }
    for (const coin of coins) {
      if (coin.collected) continue;
      const frame = sprites.coin.spin[coin.frame % sprites.coin.spin.length];
      drawSprite(ctx, frame, coin.x, coin.y);
    }
    for (const mushroom of mushrooms) {
      if (mushroom.collected) continue;
      // Mushroom sprite is 12x12 inside a 16x16 body; center it.
      drawSprite(ctx, sprites.mushroom, mushroom.x + 2, mushroom.y + 2);
    }
  }

  /** Register an event listener ('block'|'coinCollected'|'mushroomCollected'). */
  function on(event, fn) {
    (listeners[event] || (listeners[event] = [])).push(fn);
    return fn;
  }

  /** Remove an event listener. */
  function off(event, fn) {
    const list = listeners[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  /** Release all pooled entities and listeners (idempotent). */
  function dispose() {
    blocks.length = 0;
    coins.length = 0;
    mushrooms.length = 0;
    usedBlockCoords.length = 0;
    listeners.block.length = 0;
    listeners.coinCollected.length = 0;
    listeners.mushroomCollected.length = 0;
  }

  initBlocks();

  return {
    blocks,
    coins,
    mushrooms,
    bump,
    bumpAt,
    update,
    draw,
    collect,
    coinCount: () => collectedCount,
    on,
    off,
    dispose,
  };
}

export default createItems;