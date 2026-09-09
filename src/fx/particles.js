/**
 * Particle and visual effects layer (src/fx/particles.js).
 *
 * Provides:
 *  - spawnBrickFragments(x, y): spawns 4 quarter-brick fragments on brick break
 *    (vx ±30/±60, vy -200/-260, gravity, 1.2s life).
 *  - spawnScorePopup(text, x, y): floating score popup rising 24px over 0.8s
 *    rendered with 5x7 pixel font via drawText.
 */

import { drawPixels } from '../render/pixelArt.js';
import { drawText } from '../ui/pixelFont.js';
import { SPRITES } from '../render/sprites/index.js';

export const BRICK_FRAGMENT_GRAVITY = 1200;
export const BRICK_FRAGMENT_LIFE = 1.2;
export const SCORE_POPUP_DURATION = 0.8;
export const SCORE_POPUP_FLOAT_DISTANCE = 24;

/**
 * 8x8 quarter-brick fragment sprite matching the brick palette.
 */
export const BRICK_FRAGMENT_SPRITE = {
  palette: SPRITES.tiles.brick.palette,
  width: 8,
  height: 8,
  rows: [
    'llbbbbbb',
    'bbbbbbbb',
    'bbbbbbss',
    'bbbbbbbb',
    'mmmmmmmm',
    'bbbbbbss',
    'llbbbbbb',
    'bbbbbbbb',
  ],
};

/**
 * Creates a single brick fragment particle entity.
 *
 * @param {Object} config
 * @param {number} config.x - World X.
 * @param {number} config.y - World Y.
 * @param {number} config.vx - Horizontal velocity (px/s).
 * @param {number} config.vy - Vertical velocity (px/s).
 * @param {number} [config.gravity=1200] - Gravity acceleration (px/s²).
 * @param {number} [config.life=1.2] - Total lifespan in seconds.
 * @returns {Object} Particle entity instance.
 */
export function createBrickFragment({
  x = 0,
  y = 0,
  vx = 0,
  vy = 0,
  gravity = BRICK_FRAGMENT_GRAVITY,
  life = BRICK_FRAGMENT_LIFE,
} = {}) {
  let posX = x;
  let posY = y;
  let currentVx = vx;
  let currentVy = vy;
  let elapsed = 0;
  let alive = true;

  const fragment = {
    type: 'brickFragment',
    get x() {
      return posX;
    },
    set x(val) {
      posX = val;
    },
    get y() {
      return posY;
    },
    set y(val) {
      posY = val;
    },
    w: 8,
    h: 8,
    get vx() {
      return currentVx;
    },
    set vx(val) {
      currentVx = val;
    },
    get vy() {
      return currentVy;
    },
    set vy(val) {
      currentVy = val;
    },
    gravity,
    life,
    maxLife: life,
    get elapsed() {
      return elapsed;
    },
    get alive() {
      return alive;
    },
    set alive(val) {
      alive = Boolean(val);
    },

    update(dt = 0) {
      if (!alive || dt <= 0) return;
      elapsed += dt;
      if (elapsed >= life) {
        alive = false;
        return;
      }
      currentVy += gravity * dt;
      posX += currentVx * dt;
      posY += currentVy * dt;
    },

    draw(ctx, camera = null) {
      if (!alive) return;
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

      drawPixels(ctx, BRICK_FRAGMENT_SPRITE, Math.round(screenX), Math.round(screenY));
    },

    dispose() {
      alive = false;
    },
  };

  return fragment;
}

/**
 * Spawns 4 quarter-brick fragments on brick break with speeds:
 * vx: ±30, ±60 and vy: -200, -260, gravity 1200 px/s², 1.2s life.
 *
 * @param {number|{x: number, y: number}} optsOrX - Block X coordinate or options object.
 * @param {number} [maybeY] - Block Y coordinate.
 * @returns {Array<Object>} Array of 4 fragment particle entities.
 */
export function spawnBrickFragments(optsOrX = 0, maybeY = 0) {
  const spawnX = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.x ?? 0) : optsOrX;
  const spawnY = typeof optsOrX === 'object' && optsOrX !== null ? (optsOrX.y ?? 0) : maybeY;

  // 4 quarter-brick configurations:
  // Top pieces arc higher (vy = -260), outer/inner velocities (vx = ±60, ±30)
  // Bottom pieces arc lower (vy = -200)
  const configs = [
    { x: spawnX, y: spawnY, vx: -60, vy: -260 }, // top-left outer
    { x: spawnX + 8, y: spawnY, vx: 60, vy: -260 }, // top-right outer
    { x: spawnX, y: spawnY + 8, vx: -30, vy: -200 }, // bottom-left inner
    { x: spawnX + 8, y: spawnY + 8, vx: 30, vy: -200 }, // bottom-right inner
  ];

  return configs.map((cfg) =>
    createBrickFragment({
      ...cfg,
      gravity: BRICK_FRAGMENT_GRAVITY,
      life: BRICK_FRAGMENT_LIFE,
    })
  );
}

/**
 * Creates a floating score popup entity that rises 24px over 0.8s using drawText.
 *
 * @param {string|number} text - Score text to display (e.g. '100', '200', '1000').
 * @param {number|{x: number, y: number}} optsOrX - World X or options.
 * @param {number} [maybeY] - World Y.
 * @returns {Object} Score popup entity.
 */
export function spawnScorePopup(text, optsOrX = 0, maybeY = 0) {
  let scoreText = text;
  let spawnX = optsOrX;
  let spawnY = maybeY;

  if (typeof text === 'object' && text !== null) {
    scoreText = text.text ?? '';
    spawnX = text.x ?? 0;
    spawnY = text.y ?? 0;
  } else if (typeof optsOrX === 'object' && optsOrX !== null) {
    spawnX = optsOrX.x ?? 0;
    spawnY = optsOrX.y ?? 0;
  }

  scoreText = String(scoreText == null ? '' : scoreText);
  const startY = spawnY;
  let currentX = spawnX;
  let currentY = spawnY;
  let elapsed = 0;
  let alive = true;

  const popup = {
    type: 'scorePopup',
    text: scoreText,
    get x() {
      return currentX;
    },
    set x(val) {
      currentX = val;
    },
    get y() {
      return currentY;
    },
    set y(val) {
      currentY = val;
    },
    startY,
    duration: SCORE_POPUP_DURATION,
    life: SCORE_POPUP_DURATION,
    maxLife: SCORE_POPUP_DURATION,
    floatDistance: SCORE_POPUP_FLOAT_DISTANCE,
    get elapsed() {
      return elapsed;
    },
    get alive() {
      return alive;
    },
    set alive(val) {
      alive = Boolean(val);
    },

    update(dt = 0) {
      if (!alive || dt <= 0) return;
      elapsed += dt;
      if (elapsed >= SCORE_POPUP_DURATION) {
        currentY = startY - SCORE_POPUP_FLOAT_DISTANCE;
        alive = false;
        return;
      }
      const progress = elapsed / SCORE_POPUP_DURATION;
      currentY = startY - progress * SCORE_POPUP_FLOAT_DISTANCE;
    },

    draw(ctx, camera = null) {
      if (!alive) return;
      let screenX = currentX;
      let screenY = currentY;

      if (camera && typeof camera.worldToScreen === 'function') {
        const screenPos = camera.worldToScreen(currentX, currentY);
        screenX = screenPos.x;
        screenY = screenPos.y;
      } else if (camera && typeof camera.x === 'number') {
        screenX = currentX - camera.x;
        screenY = currentY - (camera.y || 0);
      }

      drawText(ctx, scoreText, Math.round(screenX), Math.round(screenY), {
        color: '#ffffff',
        scale: 1,
      });
    },

    dispose() {
      alive = false;
    },
  };

  return popup;
}

export default {
  spawnBrickFragments,
  spawnScorePopup,
  createBrickFragment,
  BRICK_FRAGMENT_SPRITE,
  BRICK_FRAGMENT_GRAVITY,
  BRICK_FRAGMENT_LIFE,
  SCORE_POPUP_DURATION,
  SCORE_POPUP_FLOAT_DISTANCE,
};
