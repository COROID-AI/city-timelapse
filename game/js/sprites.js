/**
 * Pixel-art sprite maps (pure data) + a fillRect-based drawing helper.
 *
 * Every sprite is a 2D grid of single-character color keys. Each key resolves
 * to a named color in palette.js (see game/js/palette.js). A '.' key means
 * "transparent" (skip). The art is drawn exclusively with Canvas `fillRect`
 * primitives — no images, no spritesheets, no external assets.
 *
 * These grids are declarative data so player/enemies/items/renderer can all
 * consume them without knowing how the pixels are laid out.
 */

import { fillRect } from './draw.js';
import { palette } from './palette.js';

/** Number of pixels per sprite cell. */
export const SPRITE_SCALE = 1;

/**
 * Draw a sprite grid onto a canvas context using only `fillRect`.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context to draw on.
 * @param {Array<string>} grid - The sprite map (each string is one row).
 * @param {number} x - Left edge in pixels.
 * @param {number} y - Top edge in pixels.
 * @param {number} [scale=SPRITE_SCALE] - Pixel multiplier per cell.
 */
export function drawSprite(ctx, grid, x, y, scale = SPRITE_SCALE) {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const key = line[col];
      if (key === '.') {
        continue; // transparent pixel
      }
      const color = palette[key];
      if (!color) {
        throw new Error(`Unknown sprite color key '${key}' in grid`);
      }
      fillRect(
        ctx,
        x + col * scale,
        y + row * scale,
        scale,
        scale,
        color
      );
    }
  }
}

/**
 * All sprite maps. Grouped by entity so the renderer and game logic can pull
 * exactly the frames they need.
 *
 * @type {Object}
 */
export const sprites = {
  // --- Small Mario (12 wide x 16 tall) ---
  mario: {
    /** Standing / idle pose. */
    idle: [
      '....RRRR....',
      '...RRRRRR...',
      '...RRRRRR...',
      '...SSSSSS...',
      '...SSSSSS...',
      '...SSSSSS...',
      '..KSSSSSSK..',
      '..KKSSSSKK..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '...BBBBBB...',
      '...BBBBBB...',
      '..BBKKKKBB..',
      '...BBBBBB...',
      '..HH....HH..',
      '..HH....HH..',
    ],
    /** Two running frames (legs together, then legs apart). */
    run: [
      [
        '....RRRR....',
        '...RRRRRR...',
        '...RRRRRR...',
        '...SSSSSS...',
        '...SSSSSS...',
        '...SSSSSS...',
        '..KSSSSSSK..',
        '..KKSSSSKK..',
        '..HHHHHHHH..',
        '..HHHHHHHH..',
        '...BBBBBB...',
        '...BBBBBB...',
        '..BBKKKKBB..',
        '...BBBBBB...',
        '..HH....HH..',
        '..HHHHHHHH..',
      ],
      [
        '....RRRR....',
        '...RRRRRR...',
        '...RRRRRR...',
        '...SSSSSS...',
        '...SSSSSS...',
        '...SSSSSS...',
        '..KSSSSSSK..',
        '..KKSSSSKK..',
        '..HHHHHHHH..',
        '..HHHHHHHH..',
        '...BBBBBB...',
        '...BBBBBB...',
        '..BBKKKKBB..',
        '...BBBBBB...',
        '..HH..HH..HH',
        '..HH..HH..HH',
      ],
    ],
    /** Jumping pose (legs tucked). */
    jump: [
      '....RRRR....',
      '...RRRRRR...',
      '...RRRRRR...',
      '...SSSSSS...',
      '...SSSSSS...',
      '...SSSSSS...',
      '..KSSSSSSK..',
      '..KKSSSSKK..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '...BBBBBB...',
      '...BBBBBB...',
      '..BBKKKKBB..',
      '...BBBBBB...',
      '..HH....HH..',
      '...HHHHHH...',
    ],
  },

  // --- Goomba (12 wide x 12 tall) ---
  goomba: {
    /** Two walking frames (feet together / apart). */
    walk: [
      [
        '...CCCCCC...',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..GWWGGWWG..',
        '..GKKGGKKG..',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..HH....HH..',
        '..HH....HH..',
      ],
      [
        '...CCCCCC...',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..GWWGGWWG..',
        '..GKKGGKKG..',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..HHHHHHHH..',
        '..HHHHHHHH..',
        '..HHHHHHHH..',
      ],
    ],
    /** Squashed (stomped) pose. */
    squash: [
      '..CCCCCCCC..',
      '..GGGGGGGG..',
      '.WGKKGGKKGW.',
      '..GGGGGGGG..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
    ],
  },

  // --- Coin (12 wide x 12 tall) ---
  coin: {
    /** Three spin frames: full, tilted, edge-on. */
    spin: [
      [
        '....OOOO....',
        '...OOOOOO...',
        '..OOOOOOOO..',
        '.OOOOOOOOOO.',
        '.OOOOOOOOOO.',
        '.OOOOOOOOOO.',
        '.OOOOOOOOOO.',
        '.OOOOOOOOOO.',
        '..OOOOOOOO..',
        '...OOOOOO...',
        '....OOOO....',
        '............',
      ],
      [
        '............',
        '....OOOO....',
        '...OOOOOO...',
        '..OOOOOOOO..',
        '..OOOOOOOO..',
        '.OOOOOOOOOO.',
        '.OOOOOOOOOO.',
        '..OOOOOOOO..',
        '..OOOOOOOO..',
        '...OOOOOO...',
        '....OOOO....',
        '............',
      ],
      [
        '............',
        '............',
        '....DDDD....',
        '....DDDD....',
        '....DDDD....',
        '....DDDD....',
        '....DDDD....',
        '....DDDD....',
        '....DDDD....',
        '............',
        '............',
        '............',
      ],
    ],
  },

  // --- Mushroom (12 wide x 12 tall) ---
  mushroom: [
    '....RRRR....',
    '...RRRRRR...',
    '..RRRRRRRR..',
    '..RWWRWWRW..',
    '..RWWRWWRW..',
    '..WWWWWWWW..',
    '..MMMMMMMM..',
    '...MMMMMM...',
    '...MMMMMM...',
    '...MMMMMM...',
    '...MMMMMM...',
    '..HH....HH..',
  ],

  // --- Tile decorations (16 wide x 16 tall) ---
  tiles: {
    /** Brick wall pattern. */
    brick: [
      'gggggggggggggggg',
      'g..............g',
      'g.g.g.g.g.g.g.g.',
      'g..............g',
      'g.g.g.g.g.g.g.g.',
      'g..............g',
      'g.g.g.g.g.g.g.g.',
      'g..............g',
      'gggggggggggggggg',
      'g..............g',
      '.g.g.g.g.g.g.g.g',
      'g..............g',
      '.g.g.g.g.g.g.g.g',
      'g..............g',
      '.g.g.g.g.g.g.g.g',
      'g..............g',
    ],
    /** ? block with a question mark. */
    question: [
      'KKKKKKKKKKKKKKKK',
      'KOOOOOOOOOOOOOOK',
      'KOOOOOOOOOOOOOOK',
      'KOOOKKKKKKKKOOOK',
      'KOOOKKKKKKKKOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOKKKKKKOOOOK',
      'KOOOOOKKKKOOOOOK',
      'KOOOOOKKKKOOOOOK',
      'KOOOOOOOOOOOOOOK',
      'KOOOOOOOOOOOOOOK',
      'KKKKKKKKKKKKKKKK',
    ],
    /** Used block (empty, brick-toned). */
    used: [
      'tttttttttttttttt',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      't..............t',
      'tttttttttttttttt',
    ],
    /** Ground texture with speckles. */
    ground: [
      'eeeeeeeeeeeeeeee',
      'eeeeefeeeeeleeee',
      'eeeeeeeeeeeeeeee',
      'eeeleeeeefeeeeee',
      'eeeeeeeeeeeeeeee',
      'eeefeeeeeeeleeee',
      'eeeeeeeeeeeeeeee',
      'eeeleeeeefeeeeee',
      'eeeeeeeeeeeeeeee',
      'eeefeeeeeeeleeee',
      'eeeeeeeeeeeeeeee',
      'eeeleeeeefeeeeee',
      'eeeeeeeeeeeeeeee',
      'eeefeeeeeeeleeee',
      'eeeeeeeeeeeeeeee',
      'eeeeeeeeeeeeeeee',
    ],
    /** Vertical pipe segment with highlight and shadow. */
    pipe: [
      'pppppppppppppppp',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
      'lppppppppppppppD',
    ],
  },
};