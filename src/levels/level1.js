/**
 * Level 1 (World 1-1 inspired) layout and configuration.
 *
 * Encodes a 212x15 ASCII tile grid with:
 * - Safe start region (cols 0-15)
 * - First ?-block cluster with mushroom block
 * - 4 green pipes of heights 2, 3, 4, 4
 * - 3 ground gaps
 * - Brick rows and elevated platforms with ?-blocks and multi-coin brick 'm'
 * - Stepping stones and staircases leading up to the flagpole
 * - Flagpole at tile 198 (F segments)
 * - Castle structure at tile 204 (C anchors)
 * - Scenery elements (clouds, hills, bushes)
 * - Player spawn at { x: 48, y: 192 } (over solid ground)
 * - timeLimit: 400
 */

const LEVEL_WIDTH = 212;
const LEVEL_HEIGHT = 15;

/**
 * Helper to build empty 2D char array.
 */
function createEmptyGrid(width, height) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill(' '));
  }
  return grid;
}

/**
 * Builds the 212x15 World 1-1 ASCII grid.
 */
function buildLevel1Grid() {
  const grid = createEmptyGrid(LEVEL_WIDTH, LEVEL_HEIGHT);

  // 1. Ground at rows 13 and 14 across the level, with 3 gaps:
  // Gap 1: cols 69-70 (width 2)
  // Gap 2: cols 86-88 (width 3)
  // Gap 3: cols 153-154 (width 2)
  for (let x = 0; x < LEVEL_WIDTH; x++) {
    const isGap1 = x >= 69 && x <= 70;
    const isGap2 = x >= 86 && x <= 88;
    const isGap3 = x >= 153 && x <= 154;

    if (!isGap1 && !isGap2 && !isGap3) {
      grid[13][x] = 'X';
      grid[14][x] = 'X';
    }
  }

  // 2. First ?-block cluster (cols 16 to 24)
  // col 16: ? (coin)
  grid[9][16] = '?';
  // cols 20-24: B, M (mushroom), ?, B, ?
  grid[9][20] = 'B';
  grid[9][21] = 'M';
  grid[9][22] = '?';
  grid[9][23] = 'B';
  grid[9][24] = '?';
  // elevated ?-block at row 5, col 22
  grid[5][22] = '?';

  // 3. Pipes of heights 2, 3, 4, 4:
  // Pipe 1: cols 28-29, height 2 (rows 11-12)
  grid[11][28] = '[';
  grid[11][29] = ']';
  grid[12][28] = '{';
  grid[12][29] = '}';

  // Pipe 2: cols 38-39, height 3 (rows 10-12)
  grid[10][38] = '[';
  grid[10][39] = ']';
  grid[11][38] = '{';
  grid[11][39] = '}';
  grid[12][38] = '{';
  grid[12][39] = '}';

  // Pipe 3: cols 46-47, height 4 (rows 9-12)
  grid[9][46] = '[';
  grid[9][47] = ']';
  grid[10][46] = '{';
  grid[10][47] = '}';
  grid[11][46] = '{';
  grid[11][47] = '}';
  grid[12][46] = '{';
  grid[12][47] = '}';

  // Pipe 4: cols 57-58, height 4 (rows 9-12)
  grid[9][57] = '[';
  grid[9][58] = ']';
  grid[10][57] = '{';
  grid[10][58] = '}';
  grid[11][57] = '{';
  grid[11][58] = '}';
  grid[12][57] = '{';
  grid[12][58] = '}';

  // 4. Multi-coin brick block 'm' at col 64, row 9
  grid[9][64] = 'm';

  // 5. Bricks & ?-blocks between Gap 1 and Gap 2 (cols 77 to 85)
  grid[9][77] = 'B';
  grid[9][78] = '?';
  grid[9][79] = 'B';

  // High platform of bricks at row 5 (cols 80-87)
  for (let x = 80; x <= 87; x++) {
    grid[5][x] = 'B';
  }

  // 6. Blocks between Gap 2 and Gap 3 (cols 91 to 150)
  // Platform at row 5 (cols 91-94) and row 9
  grid[5][91] = 'B';
  grid[5][92] = 'B';
  grid[5][93] = 'B';
  grid[5][94] = '?';
  grid[9][94] = 'B';

  // Bricks at cols 100-101
  grid[9][100] = 'B';
  grid[9][101] = 'B';

  // Brick cluster at cols 105-108
  grid[9][105] = 'B';
  grid[9][106] = '?';
  grid[9][107] = '?';
  grid[9][108] = 'B';

  // Elevated brick rows at cols 118-123
  grid[9][118] = 'B';
  grid[9][119] = 'B';
  grid[9][120] = 'B';
  grid[5][121] = 'B';
  grid[5][122] = 'B';
  grid[5][123] = 'B';

  grid[9][128] = 'B';
  grid[9][129] = '?';
  grid[9][130] = 'B';

  // 7. Staircases
  // Ascending stair before col 138: cols 134-137 (heights 1, 2, 3, 4)
  for (let h = 1; h <= 4; h++) {
    const col = 133 + h;
    for (let r = 13 - h; r <= 12; r++) {
      grid[r][col] = '#';
    }
  }

  // Descending stair: cols 140-143 (heights 4, 3, 2, 1)
  for (let h = 4; h >= 1; h--) {
    const col = 144 - h;
    for (let r = 13 - h; r <= 12; r++) {
      grid[r][col] = '#';
    }
  }

  // Ascending stair before Gap 3: cols 148-152 (heights 1, 2, 3, 4, 4)
  for (let h = 1; h <= 4; h++) {
    const col = 147 + h;
    for (let r = 13 - h; r <= 12; r++) {
      grid[r][col] = '#';
    }
  }
  for (let r = 9; r <= 12; r++) {
    grid[r][152] = '#';
  }

  // Descending stair after Gap 3: cols 155-158 (heights 4, 3, 2, 1)
  for (let h = 4; h >= 1; h--) {
    const col = 159 - h;
    for (let r = 13 - h; r <= 12; r++) {
      grid[r][col] = '#';
    }
  }

  // Pipe 5 (optional extra pipe before final stairs at cols 163-164, height 2)
  grid[11][163] = '[';
  grid[11][164] = ']';
  grid[12][163] = '{';
  grid[12][164] = '}';

  // Bricks before big stairs (cols 168-171)
  grid[9][168] = 'B';
  grid[9][169] = 'B';
  grid[9][170] = '?';
  grid[9][171] = 'B';

  // 8. Final Big Staircase before Flagpole: cols 181-189 (heights 1 to 8, with 8 on col 189)
  for (let h = 1; h <= 8; h++) {
    const col = 180 + h;
    for (let r = 13 - h; r <= 12; r++) {
      grid[r][col] = '#';
    }
  }
  // Col 189 also height 8
  for (let r = 5; r <= 12; r++) {
    grid[r][189] = '#';
  }

  // 9. Flagpole at col 198:
  // Base stone block at row 12, flagpole segments F from row 2 to 11
  grid[12][198] = '#';
  for (let r = 2; r <= 11; r++) {
    grid[r][198] = 'F';
  }

  // 10. Castle at cols 202 to 207 (anchors 'C')
  // Castle facade / anchors
  for (let x = 202; x <= 206; x++) {
    for (let y = 8; y <= 12; y++) {
      grid[y][x] = 'C';
    }
  }

  return grid.map((row) => row.join(''));
}

export const GRID_ROWS = buildLevel1Grid();

export const SCENERY = {
  clouds: [
    { x: 128, y: 48, type: 'single' },
    { x: 304, y: 32, type: 'triple' },
    { x: 448, y: 48, type: 'double' },
    { x: 576, y: 32, type: 'single' },
    { x: 768, y: 48, type: 'triple' },
    { x: 928, y: 32, type: 'double' },
    { x: 1200, y: 48, type: 'triple' },
    { x: 1440, y: 32, type: 'single' },
    { x: 1680, y: 48, type: 'double' },
    { x: 1920, y: 32, type: 'triple' },
    { x: 2200, y: 48, type: 'single' },
    { x: 2480, y: 32, type: 'double' },
    { x: 2750, y: 48, type: 'triple' },
    { x: 3050, y: 32, type: 'single' },
  ],
  hills: [
    { x: 0, y: 176, type: 'large' },
    { x: 256, y: 192, type: 'small' },
    { x: 768, y: 176, type: 'large' },
    { x: 1024, y: 192, type: 'small' },
    { x: 1536, y: 176, type: 'large' },
    { x: 1792, y: 192, type: 'small' },
    { x: 2304, y: 176, type: 'large' },
    { x: 2560, y: 192, type: 'small' },
    { x: 3072, y: 176, type: 'large' },
  ],
  bushes: [
    { x: 176, y: 192, type: 'triple' },
    { x: 368, y: 192, type: 'single' },
    { x: 656, y: 192, type: 'double' },
    { x: 944, y: 192, type: 'triple' },
    { x: 1136, y: 192, type: 'single' },
    { x: 1424, y: 192, type: 'double' },
    { x: 1712, y: 192, type: 'triple' },
    { x: 1904, y: 192, type: 'single' },
    { x: 2192, y: 192, type: 'double' },
    { x: 2480, y: 192, type: 'triple' },
    { x: 2672, y: 192, type: 'single' },
    { x: 2960, y: 192, type: 'double' },
  ],
};

export const LEVEL_ONE = {
  gridRows: GRID_ROWS,
  scenery: SCENERY,
  spawn: {
    x: 48,
    y: 192,
    tileX: 3,
    tileY: 12,
  },
  flagX: 198,
  flagTileX: 198,
  flagPixelX: 198 * 16,
  castleX: 204,
  castleTileX: 204,
  castlePixelX: 204 * 16,
  timeLimit: 400,
  width: LEVEL_WIDTH,
  height: LEVEL_HEIGHT,
  tileSize: 16,
};

export default LEVEL_ONE;
