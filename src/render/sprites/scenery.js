/*
 * Scenery frames — cloud, hill and bush (16x16).
 *
 * Palette string-map pixel art authored as data (no image assets).
 * '.' is transparent; every other character maps to a hex color in
 * `palette`. Rendered exclusively with Canvas 2D fillRect by
 * src/render/pixelArt.js drawPixels() — see the renderer for the frame
 * contract ({ palette, width, height, rows }).
 *
 * Original approximation art in the classic style; no ripped sprites.
 */
export const scenery = {
  'cloud': {
    palette: { 'w': '#f8f8f8', 's': '#d8d8d8' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '.....wwwww......',
        '...wwwwwwwww....',
        '..wwwwwwwwwww...',
        '..wwwwwwwwwww...',
        '.wwwwwwwwwwwww..',
        '.wwwwwwwwwwwww..',
        '.wwswwwwwwswww..',
        '.wswwwwwwwwsww..',
        '..swwwwwwwwwss..',
        '...ssssssssss...',
        '................',
        '................',
        '................',
        '................'
    ],
  },
  'hill': {
    palette: { 'l': '#58c858', 'g': '#28a038', 'd': '#1a7018', 'h': '#7ce85c' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '................',
        '........d.......',
        '.......ddd......',
        '......hggdd.....',
        '.....hhgggdd....',
        '....hhhgggddd...',
        '...hhllggggddd..',
        '..hhhlllggggddd.',
        '.hhhhlllgggggddd',
        'hhhhhlllgggggddd',
        'hhhhlllggggggddd',
        'dddddddddddddddd',
        'dddddddddddddddd',
        'dddddddddddddddd'
    ],
  },
  'bush': {
    palette: { 'l': '#58c858', 'g': '#28a038', 'd': '#1a7018', 'w': '#d8f8c8' },
    width: 16,
    height: 16,
    rows: [
        '................',
        '................',
        '......ddd.......',
        '.....ddddd......',
        '...ddgwggddd....',
        '..dggwwwwwggd...',
        '..dggwwwwwggd...',
        '..dgggwwwgggd...',
        '...dgggggggd....',
        '....ddddddd.....',
        '......ddd.......',
        '................',
        '................',
        '................',
        '................',
        '................'
    ],
  },
};
