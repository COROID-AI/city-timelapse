/*
 * Koopa Troopa frames — walk1 / walk2 (16x16) and shell (16x10).
 *
 * Palette string-map pixel art authored as data (no image assets).
 * '.' is transparent; every other character maps to a hex color in
 * `palette`. Rendered exclusively with Canvas 2D fillRect by
 * src/render/pixelArt.js drawPixels() — see the renderer for the frame
 * contract ({ palette, width, height, rows }).
 *
 * Original approximation art in the classic style; no ripped sprites.
 */
export const koopa = {
  'walk1': {
    palette: { 'g': '#38b048', 'h': '#2a9038', 'd': '#1e6a1e', 'l': '#8ce058', 'y': '#e8d048', 'k': '#222222', 'w': '#f8f8f8', 'f': '#c9a860' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '...kkkkkk.......',
        '..kgwwwgk.......',
        '..kggggggk......',
        '..kggggggk......',
        '.kkhhhhhhkk.....',
        '.khhhhhhhhk.....',
        '.khhhhhhhhd.....',
        '.khhhhhhhhd.....',
        '.kkhhhhhhhk.....',
        '.kgggyygggk.....',
        '.kggyyyyggk.....',
        '..kggyyyyk......',
        '..kffffffk......',
        '.kffkkkkffk.....',
        '.kffkkkkffk.....'
    ],
  },
  'walk2': {
    palette: { 'g': '#38b048', 'h': '#2a9038', 'd': '#1e6a1e', 'l': '#8ce058', 'y': '#e8d048', 'k': '#222222', 'w': '#f8f8f8', 'f': '#c9a860' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '...kkkkkk.......',
        '..kgwwwgk.......',
        '..kggggggk......',
        '..kggggggk......',
        '.kkhhhhhhkk.....',
        '.khhhhhhhhk.....',
        '.khhhhhhhhd.....',
        '.khhhhhhhhd.....',
        '.kkhhhhhhhk.....',
        '.kgggyygggk.....',
        '.kggyyyyggk.....',
        '..kggyyyyk......',
        '..kffffffk......',
        '..kffkkkffk.....',
        '..kffkkkffk.....'
    ],
  },
  'shell': {
    palette: { 'g': '#38b048', 'h': '#2a9038', 'd': '#1e6a1e', 'l': '#8ce058', 'y': '#e8d048', 'k': '#222222', 'w': '#f8f8f8', 'f': '#c9a860' },
    width: 16,
    height: 10,
    rows: [
        '................',
        '................',
        '..kkhhhhhhkk....',
        '.khhhhhhhhhhk...',
        '.khhllhhhhhhk...',
        '.khhlhhhllhhk...',
        '.khhhhhhhhhhk...',
        '..kkhhhhhhkk....',
        '..kkhhhhhhkk....',
        '................'
    ],
  },
};
