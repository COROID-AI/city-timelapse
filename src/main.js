/**
 * Entry point for the game page (type="module").
 *
 * This is a replaceable stub owned by the foundation task: it wires the
 * logical canvas, clears it to the sky color, and renders each frame.
 * The composition task (game-states-composition) rewrites this module later
 * to start the real game loop.
 */
import { CONSTANTS } from './core/constants.js';

const canvas = document.getElementById('game-canvas');
const context = canvas.getContext('2d');

// The canvas is scaled to its CSS size by the stylesheet; the internal
// drawing surface stays at the logical 256x240 resolution.
canvas.width = CONSTANTS.VIEWPORT_WIDTH;
canvas.height = CONSTANTS.VIEWPORT_HEIGHT;

function frame() {
  context.fillStyle = CONSTANTS.COLORS.sky;
  context.fillRect(0, 0, CONSTANTS.VIEWPORT_WIDTH, CONSTANTS.VIEWPORT_HEIGHT);
}

frame();

// Keep the page alive and idle-ready for the composition task's game loop.
window.addEventListener('resize', frame);
