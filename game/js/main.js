/**
 * Final game entrypoint.
 *
 * Boots the canvas element from index.html and starts the fully composed game
 * (game.js createGame()}). It is intentionally thin: all composition lives
 * in game.js. This module only supplies the browser dependencies (the real
 * requestAnimationFrame/cancelAnimationFrame and the 2D canvas context) and
 * starts/stops the game loop.
 */

import { createGame } from './game.js';

/** @type {import('./game.js').Game|null} The live game instance. */
let game = null;

/**
 * Grab the canvas from the DOM and boot the composed game..
 *
 * @returns {object} The started game instance..
 */
export function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    throw new Error('game-canvas element not found');
  }
  const ctx = canvas.getContext('2d');

  game = createGame({
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    getContext: () => ctx,
  });
  game.start();
  return game;
}

/**
 * Stop the running game (used by tests / page teardown)..
 */
export function shutdown() {
  if (game) {
    game.stop();
    game = null;
  }
}

// Wait for the module to be parsed after the DOM is available..
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

export default { bootstrap, shutdown };
