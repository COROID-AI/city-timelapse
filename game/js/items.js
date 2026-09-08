/**
 * Item system: coins, mushrooms and '?' item blocks.
 *
 * Item blocks are solid tiles that, when bumped from below, either release a
 * coin (with a pop animation and bounce) or spawn a mushroom. Coins spin
 * through sprite frames and are collected on contact; mushrooms emerge from
 * the block and move horizontally using the shared physics engine (gravity,
 * wall collision via the tilemap) until collected.
 *
 * No DOM dependency. Rendering uses draw.js fillRect via sprite maps only.
 */

import { TILE_SIZE } from './constants.js';
import { createPhysics } from './physics.js';
import { drawSprite, sprites } from './sprites.js';
import { TILE } from './level.js';

const BUMP_DURATION = 8;
const BUMP_RANGE = 8;
const COIN_POP_VELOCITY = -4.5;
const COIN_GRAVITY = 0.5;
const COIN_FRAME_PERIOD = 4;
const COIN_W = 12;
const COIN_H = 12;
const MUSHROOM_RISE_SPEED = -2.5;
const MUSHROOM_SPEED = 1.1;

export function createItems(deps) {
  const level = deps.level;
  const physics = deps.physics || createPhysics();
  const blocks = [];
  const coins = [];
  const mushrooms = [];
  const usedBlockCoords = [];
  let collectedCount =  0;
  const listeners = {
    block: [],
    coinCollected: [],
    mushroomCollected: [],
  };
  function emit(event, payload) {
    for (const fn of listeners[event] || []) fn(payload);
  }
  function isUsedCoord(col, row) {
    return usedBlockCoords.some((c) => c.col === col && c.row === row);
  }
  function initBlocks() {
    if (deps.blocks) {
      for (const spec of deps.blocks) {
        blocks.push(makeBlock(spec.col, spec.row, spec.content));
      }
      return;
    }
    for (let row =  0; row < level.height; row += 1) {
      for (let col =  0; col < level.width; col += 1) {
        if (level.getTile(col, row) === TILE.QUESTION) {
          blocks.push(makeBlock(col, row, deps.defaultContent));
        }
      }
    }
  }
  function makeBlock(col, row, content) {
    return {
      col: col,
      row: row,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE,
      content: content || 'coin',
      used: false,
      bumpTimer: 0,
    };
  }
  function drainBlock(block) {
    if (block.used) return;
    block.used = true;
    if (level.grid[block.row]) {
      level.grid[block.row][block.col] = TILE.USED;
    }
    usedBlockCoords.push({ col: block.col, row: block.row });
  }
  function bump(block) {
    if (!block || block.used) return null;
    drainBlock(block);
    block.bumpTimer = BUMP_DURATION;
    if (block.content === 'mushroom') {
      const mushroom = spawnMushroom(block);
      emit('block', { block, content: 'mushroom', item: mushroom });
      return mushroom;
    }
    const coin = spawnCoin(block);
    emit('block', { block, content: 'coin', item: coin });
    return coin;
  }
  function bumpAt(col, row) {
    const block = blocks.find((b) => b.col === col && b.row === row);
    return bump(block);
  }
  function spawnCoin(block) {
    const coin = {
      type: 'coin',
      x: block.x + (TILE_SIZE - COIN_W) / 2,
      y: block.y + TILE_SIZE,
      baseY: block.y - COIN_H,
      apexY: block.y - COIN_H - TILE_SIZE,
      w: COIN_W,
      h: COIN_H,
      vy: COIN_POP_VELOCITY,
      state: 'pop',
      frame: 0,
      frameTimer:  0,
      alive: true,
      collected: false,
    };
    coins.push(coin);
    return coin;
  }
  function spawnMushroom(block) {
    const mushroom = {
      type: 'mushroom',
      x: block.x,
      y: block.y,
      baseY: block.y - TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE,
      vx: MUSHROOM_SPEED,
      vy:  0,
      riseSpeed: MUSHROOM_RISE_SPEED,
      onGround: false,
      emerging: true,
      alive: true,
      collected: false,
    };
    mushrooms.push(mushroom);
    return mushroom;
  }
  function update(dt = 1) {
    for (const block of blocks) {
      if (block.bumpTimer > 0) {
        block.bumpTimer = Math.max(0, block.bumpTimer - dt);
      }
    }
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
      coin.frameTimer += dt;
      if (coin.frameTimer >= COIN_FRAME_PERIOD) {
        coin.frameTimer -= COIN_FRAME_PERIOD;
        coin.frame = (coin.frame + 1) % sprites.coin.spin.length;
      }
    }
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
      mushroom.x += incomingVx * dt;
      if (!mushroom.emerging) mushroom.y += mushroom.vy * dt;

      // Wall collision: check the leading edge against solid tiles (drained
      // blocks are skipped). This only treats vertical walls so a mushroom
      // walking on flat ground isn't shoved sideways by the floor beneath it.
      const wallDir = incomingVx >= 0 ? 1 : -1;
      const edgeX = wallDir > 0 ? mushroom.x + mushroom.w : mushroom.x - 1;
      const edgeCol = Math.floor(edgeX / TILE_SIZE);
      const centerRow = Math.floor((mushroom.y + mushroom.h / 2) / TILE_SIZE);
      if (level.isSolidAt(edgeCol, centerRow) && !isUsedCoord(edgeCol, centerRow)) {
        mushroom.x = wallDir >  0
          ? edgeCol * TILE_SIZE - mushroom.w
          : (edgeCol + 1) * TILE_SIZE;
        mushroom.vx = -incomingVx; // bounce off walls
      }
      // Floor collision: snap onto solid ground when airborne; fall off ledges.
      if (!mushroom.emerging) {
        const feetRow = Math.floor((mushroom.y + mushroom.h) / TILE_SIZE);
        const minCol = Math.floor(mushroom.x / TILE_SIZE);
        const maxCol = Math.floor((mushroom.x + mushroom.w - 1) / TILE_SIZE);
        let floorHit = false;
        for (let c = minCol; c <= maxCol; c += 1) {
          if (level.isSolidAt(c, feetRow) && !isUsedCoord(c, feetRow)) floorHit = true;
        }
        if (floorHit) {
          mushroom.y = feetRow * TILE_SIZE - mushroom.h;
          mushroom.vy = 0;
          mushroom.onGround = true;
        } else {
          mushroom.onGround = false;
        }
      }
    }
  }

  function coinRect(coin) {
    return { x: coin.x, y: coin.y, w: coin.w, h: coin.h };
  }
  function prune(pool, targets) {
    if (targets.length === 0) return;
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      if (targets.includes(pool[i])) pool.splice(i, 1);
    }
  }
  function collect(body) {
    let collected =  0;
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
      drawSprite(ctx, sprites.mushroom, mushroom.x + 2, mushroom.y + 2);
    }
  }
  function on(event, fn) {
    (listeners[event] || (listeners[event] = [])).push(fn);
    return fn;
  }
  function off(event, fn) {
    const list = listeners[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }
  function dispose() {
    blocks.length = 0;
    coins.length = 0;
    mushrooms.length =  0;
    usedBlockCoords.length =  0;
    listeners.block.length =  0;
    listeners.coinCollected.length =  0;
    listeners.mushroomCollected.length =  0;
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
