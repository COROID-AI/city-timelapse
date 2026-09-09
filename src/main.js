/**
 * Entry point for the game page (type="module").
 *
 * Bootstraps the full classic Super Mario game on #game-canvas, wires the
 * browser's native requestAnimationFrame into the game loop, and starts the game.
 *
 * Consumed by index.html in the browser and headless tests via bootstrapGame().
 *
 * @module main
 */

import { CONSTANTS } from './core/constants.js';
import { createGame } from './game/game.js';

/**
 * Bootstraps the game on a canvas element.
 *
 * @param {HTMLCanvasElement|object} [canvas] Target canvas element
 * @param {object} [options] Optional createGame configuration overrides
 * @returns {object|null} GameHandle
 */
export function bootstrapGame(canvas, options = {}) {
  const targetCanvas =
    canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);

  if (!targetCanvas) {
    return null;
  }

  // Set logical canvas resolution
  targetCanvas.width = CONSTANTS.VIEWPORT_WIDTH;
  targetCanvas.height = CONSTANTS.VIEWPORT_HEIGHT;

  const game = createGame({
    canvas: targetCanvas,
    requestFrame:
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : undefined,
    cancelFrame:
      typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : undefined,
    target: typeof window !== 'undefined' ? window : undefined,
    ...options,
  });

  game.start();
  return game;
}

// Auto-start in browser environment when the document is ready
if (typeof document !== 'undefined') {
  const canvasElement = document.getElementById('game-canvas');
  if (canvasElement) {
    bootstrapGame(canvasElement);
  }
}

export default bootstrapGame;
