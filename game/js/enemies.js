/**
 * Goomba enemy module.
 *
 * Manages a collection of Goomba GameObjects that patrol horizontally on a
 * level. Each Goomba:
 *   - walks in a fixed direction at a constant speed,
 *   - turns around at walls and at ledge edges using the tilemap's solidity
 *     queries (no DOM dependency),
 *   - is rendered with the fillRect-based sprite maps from sprites.js
 *     (walk frames + a squashed frame),
 *   - squashes and is removed (scored) when the player stomps on top,
 *   - reports a damage event when the player touches its side.
 *
 * The module has no DOM dependency and runs cleanly under Jest. It depends on
 * a level (for solidity queries), the physics module (gravity + AABB
 * collision + overlap helpers) and the shared constants/tile size.
 */

import { TILE_SIZE } from './constants.js';
import { drawSprite, sprites } from './sprites.js';

/** Goomba body width in pixels (matches the 12px-wide sprite). */
export const GOOMBA_WIDTH = 12;

/** Goomba body height in pixels (matches the 12px-tall walk sprite). */
export const GOOMBA_HEIGHT = 12;

/** Fixed horizontal patrol speed in px/frame. */
export const GOOMBA_SPEED = 0.6;

/** Frames a squashed Goomba lingers before being removed. */
export const SQUASH_TIME = 30;

/** Upward bounce applied to the player on a successful stomp. */
export const STOMP_BOUNCE = -4.0;

/** Walk frames per animation step (higher = slower leg cycle). */
const WALK_FRAME_TICKS = 8;

/**
 * Convert every solid tile in a level into AABB solid rectangles so the
 * physics engine can resolve the Goomba against terrain.
 *
 * @param {object} level - A level exposing `width`, `height` and `isSolidAt`.
 * @returns {Array<{x: number, y: number, w: number, h: number}>} Solid rects.
 */
function collectSolids(level) {
  const solids = [];
  for (let row = 0; row < level.height; row += 1) {
    for (let col = 0; col < level.width; col += 1) {
      if (level.isSolidAt(col, row)) {
        solids.push({
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
        });
      }
    }
  }
  return solids;
}

/**
 * Normalize a spawn descriptor into a full Goomba state.
 *
 * @param {{x: number, y: number, dir?: number}} spawn - Spawn position and
 *   optional initial direction (defaults to walking right).
 * @returns {object} The Goomba body/state model.
 */
function makeGoomba(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    w: spawn.w || GOOMBA_WIDTH,
    h: spawn.h || GOOMBA_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: false,
    dir: spawn.dir || 1,
    state: 'walking', // 'walking' | 'squashed'
    squashTimer: 0,
    frame: 0,
  };
}

/**
 * Advance a single Goomba by `dt` frames.
 *
 * Turning is decided up front via tilemap solidity:
 *   - a wall ahead (solid tile at the Goomba's body row) flips direction,
 *   - a ledge edge ahead (no solid tile below the Goomba's feet) flips
 *     direction.
 * The Goomba then integrates gravity and resolves AABB collisions with solid
 * tiles so it stays grounded and never clips into terrain.
 *
 * @param {object} goomba - The Goomba state model.
 * @param {number} dt - Fixed-timestep multiplier (frames).
 * @param {object} level - Level providing `isSolidAt`.
 * @param {Array<object>} solids - Pre-collected solid tile rects.
 * @param {object} physics - Physics module (applyGravity, resolveCollisions).
 */
function updateGoomba(goomba, dt, level, solids, physics) {
  if (goomba.state === 'squashed') {
    goomba.squashTimer -= dt;
    return;
  }

  const dir = goomba.dir;
  const frontX = goomba.x + (dir > 0 ? goomba.w : 0);
  const frontCol = Math.floor(frontX / TILE_SIZE);
  // Body row (mid-height) is where a wall would block the Goomba.
  const bodyRow = Math.floor((goomba.y + goomba.h * 0.5) / TILE_SIZE);
  // Foot row is the tile the Goomba would step onto next.
  const footRow = Math.floor((goomba.y + goomba.h) / TILE_SIZE);

  const wallAhead = level.isSolidAt(frontCol, bodyRow);
  const edgeAhead = !level.isSolidAt(frontCol, footRow);

  if (wallAhead || edgeAhead) {
    goomba.dir = -dir;
  }

  // Integrate horizontal patrol at fixed speed.
  goomba.x += goomba.dir * GOOMBA_SPEED * dt;

  // Apply gravity and integrate vertically so the Goomba stays grounded.
  physics.applyGravity(goomba, dt);
  goomba.y += goomba.vy * dt;

  // Resolve against terrain (grounding + any accidental wall clip).
  physics.resolveCollisions(goomba, solids);

  // Advance the walk animation clock.
  goomba.frame += dt;
}

/**
 * Detect whether the player touched a Goomba and classify the contact.
 *
 * A stomp happens when the player's feet land on the top half of the Goomba
 * while falling; the Goomba squashes, scores a stomp event and bounces the
 * player. Any other overlap is reported as a side-damage event.
 *
 * @param {object} goomba - The Goomba state model.
 * @param {object} player - Player body {x, y, w, h, vx, vy, onGround}.
 * @param {Array<object>} contacts - Pending contact-event queue.
 * @param {object} physics - Physics module (overlaps).
 */
function detectPlayerContact(goomba, player, contacts, physics) {
  if (goomba.state !== 'walking') return;
  if (!physics.overlaps(player, goomba)) return;

  const feetAboveMid = player.y + player.h <= goomba.y + goomba.h * 0.5;
  if (feetAboveMid && player.vy > 0) {
    goomba.state = 'squashed';
    goomba.squashTimer = SQUASH_TIME;
    contacts.push({ type: 'stomp', goomba, x: goomba.x, y: goomba.y });
    // Bounce the player off the squashed Goomba for a satisfying stomp.
    player.vy = STOMP_BOUNCE;
    player.onGround = false;
  } else {
    contacts.push({ type: 'damage', goomba, x: goomba.x, y: goomba.y });
  }
}

/**
 * Create the Goomba enemy manager.
 *
 * @param {object} options
 * @param {object} options.level - Level providing `isSolidAt`, `width`,
 *   `height` (used for wall/edge turning and grounding).
 * @param {object} options.physics - Physics module (applyGravity,
 *   resolveCollisions, overlaps).
 * @param {Array<{x: number, y: number, dir?: number}>} [options.goombas] -
 *   Initial Goomba spawns.
 * @returns {object} The enemy manager API.
 */
export function createEnemies({ level, physics, goombas = [] }) {
  const solids = collectSolids(level);
  const contacts = [];
  const list = goombas.map(makeGoomba);

  /**
   * Advance every Goomba and detect player contacts.
   *
   * @param {number} [dt=1] - Fixed-timestep multiplier (frames).
   * @param {object} [player] - Player body used for stomp/damage detection.
   *   Omit (or pass null) to skip contact detection.
   */
  function update(dt = 1, player = null) {
    const remaining = [];
    for (const goomba of list) {
      updateGoomba(goomba, dt, level, solids, physics);
      if (goomba.state === 'squashed' && goomba.squashTimer <= 0) {
        continue; // Remove the fully-squashed Goomba.
      }
      remaining.push(goomba);
      if (player) {
        detectPlayerContact(goomba, player, contacts, physics);
      }
    }
    list.length = 0;
    list.push(...remaining);
  }

  /**
   * Draw every Goomba with its current sprite frame.
   *
   * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.
   */
  function draw(ctx) {
    for (const goomba of list) {
      if (goomba.state === 'squashed') {
        const squashH = sprites.goomba.squash.length;
        drawSprite(ctx, sprites.goomba.squash, goomba.x, goomba.y + goomba.h - squashH);
      } else {
        const frame = Math.floor(goomba.frame / WALK_FRAME_TICKS) % 2;
        drawSprite(ctx, sprites.goomba.walk[frame], goomba.x, goomba.y);
      }
    }
  }

  /**
   * Query for pending player-contact events (stomp/damage) and clear the
   * queue. Each event is {type: 'stomp'|'damage', goomba, x, y}.
   *
   * @returns {Array<object>} The pending contact events.
   */
  function getContacts() {
    const out = contacts.slice();
    contacts.length = 0;
    return out;
  }

  /** @returns {Array<object>} The live Goomba list (for inspection/debug). */
  function getGoombas() {
    return list;
  }

  /**
   * Spawn an additional Goomba.
   *
   * @param {{x: number, y: number, dir?: number}} spawn - Spawn descriptor.
   * @returns {object} The newly created Goomba.
   */
  function addGoomba(spawn) {
    const goomba = makeGoomba(spawn);
    list.push(goomba);
    return goomba;
  }

  /** Release resources (clears contacts and Goombas). */
  function dispose() {
    contacts.length = 0;
    list.length = 0;
  }

  return {
    update,
    draw,
    getContacts,
    getGoombas,
    addGoomba,
    dispose,
  };
}

export default createEnemies;