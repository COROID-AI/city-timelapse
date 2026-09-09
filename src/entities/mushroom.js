/**
 * Mushroom item entity (src/entities/mushroom.js).
 *
 * Emerges vertically 16px over 0.6s from a block without tile collision,
 * then becomes a 14x14 physics walker moving right at 45 px/s with gravity
 * and moveAndCollide. Bounces (reverses direction) upon hitting walls.
 *
 * Exposes onCollect() to award power-up and 1000 score.
 */

import { CONSTANTS } from '../core/constants.js';
import { createBody, applyGravity } from '../physics/body.js';
import { moveAndCollide } from '../collision/tileCollision.js';
import { drawPixels } from '../render/pixelArt.js';
import { SPRITES } from '../render/sprites/index.js';

export const MUSHROOM_WIDTH = 14;
export const MUSHROOM_HEIGHT = 14;
export const MUSHROOM_SPEED = 45;
export const EMERGE_DURATION = 0.6;
export const EMERGE_DISTANCE = 16;
export const MUSHROOM_SCORE = 1000;

/**
 * Creates a mushroom item entity.
 *
 * @param {{x: number, y: number}|number} optsOrX - Spawn position or options object.
 * @param {number} [maybeY] - Y coordinate if optsOrX is a number.
 * @returns {Object} Mushroom entity instance.
 */
export function createMushroom(optsOrX = 0, maybeY = 0) {
  const spawnX = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.x ?? 0) : optsOrX;
  const spawnY = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.y ?? 0) : maybeY;

  const startY = spawnY;
  let currentX = spawnX;
  let currentY = spawnY;
  let elapsed = 0;
  let state = 'emerging'; // 'emerging' | 'walking'
  let direction = 1; // 1 = right, -1 = left (always walks right after emerging)
  let alive = true;

  let body = null;

  function initBody(posX, posY) {
    body = createBody({
      x: posX,
      y: posY,
      w: MUSHROOM_WIDTH,
      h: MUSHROOM_HEIGHT,
    });
    body.vx = direction * MUSHROOM_SPEED;
    body.vy = 0;
    body.facing = direction;
    body.onGround = false;
  }

  const mushroom = {
    type: 'mushroom',
    get x() {
      return body ? body.x : currentX;
    },
    set x(val) {
      currentX = val;
      if (body) body.x = val;
    },
    get y() {
      return body ? body.y : currentY;
    },
    set y(val) {
      currentY = val;
      if (body) body.y = val;
    },
    w: MUSHROOM_WIDTH,
    h: MUSHROOM_HEIGHT,
    get vx() {
      return body ? body.vx : 0;
    },
    set vx(val) {
      if (body) body.vx = val;
    },
    get vy() {
      return body ? body.vy : 0;
    },
    set vy(val) {
      if (body) body.vy = val;
    },
    get facing() {
      return direction;
    },
    get direction() {
      return direction;
    },
    get state() {
      return state;
    },
    get isEmerging() {
      return state === 'emerging';
    },
    get elapsed() {
      return elapsed;
    },
    get alive() {
      return alive;
    },
    set alive(val) {
      alive = Boolean(val);
    },
    get body() {
      return body;
    },

    /**
     * Updates mushroom state per frame.
     *
     * @param {number} dt - Frame delta time in seconds.
     * @param {Object} [tilemap] - Tilemap instance for collision resolution.
     */
    update(dt = 0, tilemap = null) {
      if (!alive || dt <= 0) return;

      if (state === 'emerging') {
        elapsed += dt;
        if (elapsed < EMERGE_DURATION) {
          const progress = elapsed / EMERGE_DURATION;
          currentY = startY - progress * EMERGE_DISTANCE;
          return;
        }

        // Emerging finished: transition to walking
        const remainingDt = elapsed - EMERGE_DURATION;
        state = 'walking';
        currentY = startY - EMERGE_DISTANCE;
        initBody(currentX, currentY);

        if (remainingDt > 0) {
          this._updateWalking(remainingDt, tilemap);
        }
      } else {
        this._updateWalking(dt, tilemap);
      }
    },

    _updateWalking(dt, tilemap) {
      if (!body) {
        initBody(currentX, currentY);
      }

      body.vx = direction * MUSHROOM_SPEED;
      applyGravity(body, false, dt);

      if (tilemap) {
        const collision = moveAndCollide(body, tilemap, dt);
        if (collision.hitWall) {
          direction = -direction;
          body.vx = direction * MUSHROOM_SPEED;
          body.facing = direction;
        }
      } else {
        body.x += body.vx * dt;
        body.y += body.vy * dt;
      }

      currentX = body.x;
      currentY = body.y;

      // Despawn if fallen far below screen
      if (body.y > CONSTANTS.VIEWPORT_HEIGHT + 64) {
        alive = false;
      }
    },

    /**
     * Renders the mushroom sprite.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context.
     * @param {Object} [camera] - Camera instance for coordinate translation.
     */
    draw(ctx, camera = null) {
      if (!alive) return;
      const posX = body ? body.x : currentX;
      const posY = body ? body.y : currentY;

      let screenX = posX;
      let screenY = posY;

      if (camera && typeof camera.worldToScreen === 'function') {
        const screenPos = camera.worldToScreen(posX, posY);
        screenX = screenPos.x;
        screenY = screenPos.y;
      } else if (camera && typeof camera.x === 'number') {
        screenX = posX - camera.x;
        screenY = posY - (camera.y || 0);
      }

      const sprite = SPRITES.items.mushroom;
      // Hitbox is 14x14; sprite is 16x16.
      // Offset by -1, -2 so the mushroom stem aligns with the hitbox base.
      drawPixels(ctx, sprite, Math.round(screenX - 1), Math.round(screenY - 2));
    },

    /**
     * Handles collection by player.
     *
     * @returns {{type: string, score: number, powerup: string}} Collection result payload.
     */
    onCollect() {
      alive = false;
      return {
        type: 'mushroom',
        score: MUSHROOM_SCORE,
        powerup: 'super',
      };
    },

    /**
     * Disposes / destroys the entity.
     */
    dispose() {
      alive = false;
    },
  };

  return mushroom;
}

export default createMushroom;
