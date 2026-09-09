/*
 * Goomba frames — walk1 / walk2 (16x16) and squashed (16x8).
 *
 * Palette string-map pixel art authored as data (no image assets).
 * '.' is transparent; every other character maps to a hex color in
 * `palette`. Rendered exclusively with Canvas 2D fillRect by
 * src/render/pixelArt.js drawPixels() — see the renderer for the frame
 * contract ({ palette, width, height, rows }).
 *
 * Original approximation art in the classic style; no ripped sprites.
 */
export const goomba = {
  'walk1': {
    palette: { 'b': '#8a4a1e', 'd': '#6a2e12', 'l': '#b87238', 'f': '#202020', 'w': '#f8f8f8', 'k': '#101010' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '....kkkkkkkk....',
        '..kkbbbbbbbbkk..',
        '.kbbbbbbbbbbbbk.',
        '.kbbwwbbbbwwbbk.',
        '.kbbkwbbbbkwbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kkbbbbbbbbbbkk.',
        '.kbbbbbddbbbbbk.',
        '.kbbbbddddbbbbk.',
        '..kbbbbbbbbbbk..',
        '..kfffbbbbfffk..',
        '..kffbbbbbbffk..',
        '..kffbbbbbbffk..'
    ],
  },
  'walk2': {
    palette: { 'b': '#8a4a1e', 'd': '#6a2e12', 'l': '#b87238', 'f': '#202020', 'w': '#f8f8f8', 'k': '#101010' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '....kkkkkkkk....',
        '..kkbbbbbbbbkk..',
        '.kbbbbbbbbbbbbk.',
        '.kbbwwbbbbwwbbk.',
        '.kbbkwbbbbkwbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kkbbbbbbbbbbkk.',
        '.kbbbbbddbbbbbk.',
        '.kbbbbddddbbbbk.',
        '..kbbbbbbbbbbk..',
        '..kffffbbbbffk..',
        '..kfbbbbbbbffk..',
        '..kfbbbbbbbffk..'
    ],
  },
  'squashed': {
    palette: { 'b': '#8a4a1e', 'd': '#6a2e12', 'l': '#b87238', 'f': '#202020', 'w': '#f8f8f8', 'k': '#101010' },
    width: 16,
    height: 8,
    rows: [
        '................',
        '..kkkkkkkkkkkk..',
        '.kbbbbbbbbbbbbk.',
        '.kbbwwbbbbwwbbk.',
        '.kbbkwbbbbkwbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kkbbbbbbbbbbkk.',
        '.kdddbbbbbbdddk.'
    ],
  },
};
