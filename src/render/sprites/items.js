/*
 * Items — mushroom 16x16 and coin spin1-4 (16x16).
 *
 * Palette string-map pixel art authored as data (no image assets).
 * '.' is transparent; every other character maps to a hex color in
 * `palette`. Rendered exclusively with Canvas 2D fillRect by
 * src/render/pixelArt.js drawPixels() — see the renderer for the frame
 * contract ({ palette, width, height, rows }).
 *
 * Original approximation art in the classic style; no ripped sprites.
 */
export const items = {
  'mushroom': {
    palette: { 'r': '#d03020', 'd': '#a02818', 'w': '#f8f8f8', 'c': '#f0d4a8', 'o': '#c89a70', 'k': '#7a2a1a' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '.....rrrrrr.....',
        '....rrrrrrrr....',
        '...rrwwrrrrrr...',
        '...rrrrrrwwrr...',
        '..rrrrrrrrrrrr..',
        '..rrrrrrrrrrrr..',
        '..rrrrrrrrrrrr..',
        '...rrrrrrrrrr...',
        '....rrrrrrrr....',
        '.....rrrrrr.....',
        '.....cccccc.....',
        '....cccccccc....',
        '...cccccccccc...',
        '...cccccccccc...',
        '....cccccccc....'
    ],
  },
  coin: {
  'spin1': {
    palette: { 'g': '#f8c828', 'G': '#ffe878', 'd': '#b08018' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '.....ggggg......',
        '...ggggggggg....',
        '..gGggggggggg...',
        '.gGggggggggggg..',
        '.ggggggggggggg..',
        '.ggggggggggggg..',
        '.ggggggggggggg..',
        '.ggggdgggggggg..',
        '.ggggggggggggg..',
        '.ggggggggggggg..',
        '.ggggggggggggg..',
        '..ggggggggggg...',
        '...ggggggggg....',
        '.....ggggg......',
        '................'
    ],
  },
  'spin2': {
    palette: { 'g': '#f8c828', 'G': '#ffe878', 'd': '#b08018' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '......gggg......',
        '....gggggggg....',
        '...gGgggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...ggdggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '....gggggggg....',
        '......gggg......',
        '................',
        '................'
    ],
  },
  'spin3': {
    palette: { 'g': '#f8c828', 'G': '#ffe878', 'd': '#b08018' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '................',
        '......gggg......',
        '......gGgg......',
        '......gggg......',
        '......gggg......',
        '......gggg......',
        '......gdgg......',
        '......gggg......',
        '......gggg......',
        '......gggg......',
        '......gggg......',
        '................',
        '................',
        '................'
    ],
  },
  'spin4': {
    palette: { 'g': '#f8c828', 'G': '#ffe878', 'd': '#b08018' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '......gggg......',
        '....gggggggg....',
        '...gggggggggG...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...gggggggdgg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '...gggggggggg...',
        '....gggggggg....',
        '......gggg......',
        '................',
        '................'
    ],
  },
  },
};
