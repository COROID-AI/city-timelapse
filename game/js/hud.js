/**
 * HUD module: score, coin count, lives and time drawn with Canvas text/rect
 * primitives only (no images, no spritesheets).
 *
 * The HUD is a plain drawable: its draw(ctx) renders a status bar along the
 * top of the viewport. Values are mutated via setter methods (setScore, setCoins,
 * setLives, setTime, setWin, setDead) which the composition owner (game.js)
 * calls each frame from the game state.
 *
 * No DOM dependency: the canvas context is supplied to draw(ctx). It runs
 * cleanly under Jest. 
 */

import { VIEW_WIDTH, VIEW_HEIGHT } from './constants.js';
import { fillRect } from './draw.js';

/** Status bar background color. */
const BAR_COLOR = '#000000';

/** Status bar height in px. */
const BAR_HEIGHT =  16;

/** Bar label color. */
const TEXT_COLOR = '#ffffff';

/** Accent color for the score/coin values. */
const VALUE_COLOR = '#ffd700';

/**
 * Create the HUD.
 *
 * @param {object} [options] - Optional dependencies (unused, kept for API
 *   symmetry with the other factories).
 * @returns {object} The HUD API with setters and a draw(ctx) method.
 */
export function createHud(_options = {}) {
  let score =  0;
  let coins =  0;
  let lives =  3;
  let time =  0;
  let win = false;
  let dead = false;

  return {
    setScore(v) { score = v; },
    setCoins(v) { coins = v; },
    setLives(v) { lives = v; },
    setTime(v) { time = v; },
    setWin(v) { win = v; },
    setDead(v) { dead = v; },

    getScore: () => score,
    getCoins: () => coins,
    getLives: () => lives,
    getTime: () => time,
    isWin: () => win,
    isDead: () => dead,

    /**
     * Draw the status bar onto the canvas context.
     *
     * @param {CanvasRenderingContext2D} ctx - The 2D canvas context.

     */
    draw(ctx) {
      // Solid black status bar along the top.
      fillRect(ctx, 0, 0, VIEW_WIDTH, BAR_HEIGHT, BAR_COLOR);
      // White labels + gold values, drawn with native Canvas text primitives..
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 8px monospace';
      ctx.textBaseline = 'top';

      ctx.fillText(`SCORE ${String(score).padStart(6, '0')}`, 4, 4);
      ctx.fillText(`COINS ${String(coins).padStart(2, '0')}`, 84, 4);
      ctx.fillText(`LIVES ${lives}`, 150, 4);
      ctx.fillText(`TIME ${String(Math.max(0, time)).padStart(3, '0')}`, 196, 4);

      // Win / Game Over overlay message centered in the viewport..
      if (win) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px monospace';
        const msg = 'YOU WIN!';
        const x = Math.round((VIEW_WIDTH - ctx.measureText(msg).width) / 2);
        ctx.fillText(msg, x, Math.round(VIEW_HEIGHT / 2) - 8);
      } else if (dead) {
        ctx.fillStyle = '#ff4d4d';
        ctx.font = 'bold 10px monospace';
        const msg = 'GAME OVER';
        const x = Math.round((VIEW_WIDTH - ctx.measureText(msg).width) / 2);
        ctx.fillText(msg, x, Math.round(VIEW_HEIGHT / 2) - 8);
      }
    },
  };
}

export default createHud;
