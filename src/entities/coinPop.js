/**
 * Coin pop entity (src/entities/coinPop.js).
 *
 * Spawns from hitting a coin block: launches with vy = -260 under 1200 px/s² gravity,
 * spins through the 4 coin frames (spin1-4), expires when falling back to its start y,
 * and reports +200 score on expiry.
 */

import { drawPixels } from '../render/pixelArt.js';
import { SPRITES } from '../render/sprites/index.js';

export const COIN_POP_INITIAL_VY = -260;
export const COIN_POP_GRAVITY = 1200;
export const COIN_POP_SCORE = 200;
export const COIN_SPIN_FPS = 16;

/**
 * Creates an arcing coin pop entity.
 *
 * @param {{x: number, y: number}|number} optsOrX - Spawn position or options object.
 * @param {number} [maybeY] - Y coordinate if optsOrX is a number.
 * @returns {Object} Coin pop entity instance.
 */
export function createCoinPop(optsOrX = 0, maybeY = 0) {
  const spawnX = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.x ?? 0) : optsOrX;
  const spawnY = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.y ?? 0) : maybeY;

  const startY = spawnY;
  let x = spawnX;
  let y = spawnY;
  let vy = COIN_POP_INITIAL_VY;
  let elapsed = 0;
  let alive = true;
  let expired = false;

  const coinFrames = [
    SPRITES.items.coin.spin1,
    SPRITES.items.coin.spin2,
    SPRITES.items.coin.spin3,
    SPRITES.items.coin.spin4,
  ];

  const coinPop = {
    type: 'coinPop',
    get x() {
      return x;
    },
    set x(val) {
      x = val;
    },
    get y() {
      return y;
    },
    set y(val) {
      y = val;
    },
    w: 16,
    h: 16,
    get vy() {
      return vy;
    },
    set vy(val) {
      vy = val;
    },
    vx: 0,
    startY,
    gravity: COIN_POP_GRAVITY,
    score: COIN_POP_SCORE,
    scoreAwarded: COIN_POP_SCORE,
    get elapsed() {
      return elapsed;
    },
    get alive() {
      return alive;
    },
    set alive(val) {
      alive = Boolean(val);
    },
    get expired() {
      return expired;
    },
    get currentFrameIndex() {
      return Math.floor(elapsed * COIN_SPIN_FPS) % coinFrames.length;
    },
    get currentFrame() {
      return coinFrames[this.currentFrameIndex];
    },

    /**
     * Updates coin pop physics and checks expiry.
     *
     * @param {number} dt - Frame delta time in seconds.
     * @returns {{expired: boolean, score: number}|null} Expiry report if expired on this frame.
     */
    update(dt = 0) {
      if (!alive || dt <= 0) return null;

      elapsed += dt;
      vy += COIN_POP_GRAVITY * dt;
      y += vy * dt;

      // Expiry check: once falling downward (vy > 0) and reaches or passes startY
      if (vy > 0 && y >= startY) {
        y = startY;
        alive = false;
        expired = true;
        return {
          expired: true,
          score: COIN_POP_SCORE,
        };
      }

      return null;
    },

    /**
     * Renders the current spinning coin frame.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context.
     * @param {Object} [camera] - Camera instance for coordinate translation.
     */
    draw(ctx, camera = null) {
      if (!alive) return;

      let screenX = x;
      let screenY = y;

      if (camera && typeof camera.worldToScreen === 'function') {
        const screenPos = camera.worldToScreen(x, y);
        screenX = screenPos.x;
        screenY = screenPos.y;
      } else if (camera && typeof camera.x === 'number') {
        screenX = x - camera.x;
        screenY = y - (camera.y || 0);
      }

      const frame = this.currentFrame;
      drawPixels(ctx, frame, Math.round(screenX), Math.round(screenY));
    },

    /**
     * Optional collection hook.
     *
     * @returns {{type: string, score: number}}
     */
    onCollect() {
      alive = false;
      return {
        type: 'coin',
        score: COIN_POP_SCORE,
      };
    },

    /**
     * Disposes / destroys the entity.
     */
    dispose() {
      alive = false;
    },
  };

  return coinPop;
}

export default createCoinPop;
