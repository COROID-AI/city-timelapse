/**
 * Minimal bootstrap: grab the canvas, clear it, and run the engine loop.
 *
 * This is intentionally thin — the full game composition (state machine,
 * player, enemies, HUD) is wired in later phases. Here we only prove the
 * scaffold runs: canvas cleared and a registered demo object drawing each frame.
 */

import { Engine } from './engine.js';
import { clearCanvas, drawPlayer } from './draw.js';
import { VIEW_WIDTH, VIEW_HEIGHT } from './constants.js';

function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    throw new Error('game-canvas element not found');
  }
  const ctx = canvas.getContext('2d');

  // Initial clear so the page never flashes uninitialized.
  clearCanvas(ctx);

  const engine = new Engine({
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
    getContext: () => ctx,
  });

  // Demo object: clears the canvas each frame and draws a placeholder player.
  engine.add({
    update(_engine, _dt) {
      // No simulation logic yet in the scaffold.
    },
    draw(context) {
      clearCanvas(context);
      drawPlayer(context, Math.round(VIEW_WIDTH / 2) - 8, Math.round(VIEW_HEIGHT / 2) - 8);
    },
  });

  engine.start();
}

// Wait for the module to be parsed after the DOM is available.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

export { bootstrap };