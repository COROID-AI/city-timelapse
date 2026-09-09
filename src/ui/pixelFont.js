/**
 * 5x7 pixel font — the game's only text renderer.
 *
 * Every glyph is authored as seven 5-character rows (see GLYPHS), one
 * character per screen pixel: '#' paints the requested color and '.'
 * is transparent. drawText() renders each glyph by handing that frame
 * to drawPixels(), so in-world text (HUD, score popups, titles) flows
 * through the exact same fillRect-only pipeline as every sprite in the
 * game — no ctx.fillText, no font loading, no image assets.
 *
 * Glyphs advance GLYPH_ADVANCE (6px: 5px cell + 1px spacing) horizontally,
 * scaled by `scale` for larger text (score popups, title screens). The
 * glyph registry itself is exported for other systems (score/coin popups,
 * title/level-complete text) to reuse.
 */
import { drawPixels } from '../render/pixelArt.js';

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_ADVANCE = 6;

/** Default text color (classic NES HUD white). */
export const DEFAULT_TEXT_COLOR = '#ffffff';

/**
 * Glyph registry: A-Z, 0-9, '-', '×', '©', '!', '.'.
 * Each value is an array of GLYPH_HEIGHT rows of exactly GLYPH_WIDTH
 * characters ('#' opaque, '.' transparent).
 */
export const GLYPHS = {
  A: [
    '..#..',
    '.#.#.',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
  ],
  B: [
    '####.',
    '#...#',
    '#...#',
    '####.',
    '#...#',
    '#...#',
    '####.',
  ],
  C: [
    '.###.',
    '#...#',
    '#....',
    '#....',
    '#....',
    '#...#',
    '.###.',
  ],
  D: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  E: [
    '#####',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#####',
  ],
  F: [
    '#####',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#....',
  ],
  G: [
    '.###.',
    '#...#',
    '#....',
    '#.###',
    '#...#',
    '#...#',
    '.###.',
  ],
  H: [
    '#...#',
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
  ],
  I: [
    '#####',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '#####',
  ],
  J: [
    '..###',
    '...#.',
    '...#.',
    '...#.',
    '...#.',
    '#..#.',
    '.##..',
  ],
  K: [
    '#...#',
    '#..#.',
    '#.#..',
    '##...',
    '#.#..',
    '#..#.',
    '#...#',
  ],
  L: [
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#####',
  ],
  M: [
    '#...#',
    '##.##',
    '#.#.#',
    '#.#.#',
    '#...#',
    '#...#',
    '#...#',
  ],
  N: [
    '#...#',
    '##..#',
    '#.#.#',
    '#..##',
    '#...#',
    '#...#',
    '#...#',
  ],
  O: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  P: [
    '####.',
    '#...#',
    '#...#',
    '####.',
    '#....',
    '#....',
    '#....',
  ],
  Q: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#.#.#',
    '#..#.',
    '.##.#',
  ],
  R: [
    '####.',
    '#...#',
    '#...#',
    '####.',
    '#.#..',
    '#..#.',
    '#...#',
  ],
  S: [
    '.####',
    '#....',
    '#....',
    '.###.',
    '....#',
    '....#',
    '####.',
  ],
  T: [
    '#####',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  U: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  V: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.#.#.',
    '..#..',
  ],
  W: [
    '#...#',
    '#...#',
    '#...#',
    '#.#.#',
    '#.#.#',
    '##.##',
    '#...#',
  ],
  X: [
    '#...#',
    '#...#',
    '.#.#.',
    '..#..',
    '.#.#.',
    '#...#',
    '#...#',
  ],
  Y: [
    '#...#',
    '#...#',
    '.#.#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  Z: [
    '#####',
    '....#',
    '...#.',
    '..#..',
    '.#...',
    '#....',
    '#####',
  ],
  '0': [
    '.###.',
    '#...#',
    '#...#',
    '#.#.#',
    '#...#',
    '#...#',
    '.###.',
  ],
  '1': [
    '..#..',
    '.##..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  '2': [
    '.###.',
    '#...#',
    '....#',
    '...#.',
    '..#..',
    '.#...',
    '#####',
  ],
  '3': [
    '.###.',
    '....#',
    '....#',
    '.###.',
    '....#',
    '....#',
    '.###.',
  ],
  '4': [
    '...#.',
    '..##.',
    '.#.#.',
    '#..#.',
    '#####',
    '...#.',
    '...#.',
  ],
  '5': [
    '.####',
    '#....',
    '####.',
    '....#',
    '....#',
    '#...#',
    '.###.',
  ],
  '6': [
    '.###.',
    '#....',
    '#....',
    '####.',
    '#...#',
    '#...#',
    '.###.',
  ],
  '7': [
    '#####',
    '....#',
    '...#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  '8': [
    '.###.',
    '#...#',
    '#...#',
    '.###.',
    '#...#',
    '#...#',
    '.###.',
  ],
  '9': [
    '.###.',
    '#...#',
    '#...#',
    '.####',
    '....#',
    '....#',
    '.###.',
  ],
  '-': [
    '.....',
    '.....',
    '.....',
    '#####',
    '.....',
    '.....',
    '.....',
  ],
  '×': [
    '#...#',
    '.#.#.',
    '..#..',
    '.#.#.',
    '#...#',
    '.....',
    '.....',
  ],
  '©': [
    '.###.',
    '#...#',
    '#.#..',
    '#.#..',
    '#.#..',
    '#...#',
    '.###.',
  ],
  '!': [
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.....',
    '..#..',
  ],
  '.': [
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '..#..',
  ],
};

/**
 * Draw text with the 5x7 pixel font onto a Canvas 2D context.
 *
 * Each glyph is drawn as its own palette string-map frame through
 * drawPixels() (fillRect only) at (x, y), then the cursor advances
 * GLYPH_ADVANCE * scale pixels. Characters without a glyph (spaces,
 * unknown symbols) advance without painting; input is upcased so
 * lowercase letters reuse the A-Z glyphs.
 *
 * @param {CanvasRenderingContext2D} ctx   2D canvas context (method fillRect).
 * @param {string} text                    text to render (A-Z 0-9 - × © ! .).
 * @param {number} x                       left edge of the first glyph.
 * @param {number} y                       top edge of the glyphs (7px tall).
 * @param {{color?: string, scale?: number}} [opts] options.
 * @returns {void}
 */
export function drawText(ctx, text, x, y, { color = DEFAULT_TEXT_COLOR, scale = 1 } = {}) {
  const size = Math.max(1, Math.floor(scale));
  const advance = GLYPH_ADVANCE * size;
  const str = String(text == null ? '' : text).toUpperCase();

  let cx = x;
  for (const ch of str) {
    const rows = GLYPHS[ch];
    if (!rows) {
      cx += advance; // space / unsupported glyph — just advance the cursor
      continue;
    }
    const frame = {
      palette: { '#': color },
      width: GLYPH_WIDTH,
      height: GLYPH_HEIGHT,
      rows,
    };
    drawPixels(ctx, frame, cx, y, { scale: size });
    cx += advance;
  }
}

export default drawText;