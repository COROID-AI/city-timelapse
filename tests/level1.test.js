import { LEVEL_ONE, GRID_ROWS, SCENERY } from '../src/levels/level1.js';
import { createTilemap, TILES, isSolidTile } from '../src/world/tilemap.js';

describe('Level 1 layout and configuration (src/levels/level1.js)', () => {
  test('exports LEVEL_ONE matching expected contract structure', () => {
    expect(LEVEL_ONE).toBeDefined();
    expect(Array.isArray(LEVEL_ONE.gridRows)).toBe(true);
    expect(LEVEL_ONE.gridRows.length).toBe(15);
    expect(LEVEL_ONE.width).toBe(212);
    expect(LEVEL_ONE.height).toBe(15);
    expect(LEVEL_ONE.tileSize).toBe(16);
    expect(LEVEL_ONE.timeLimit).toBe(400);
    expect(LEVEL_ONE.spawn).toBeDefined();
    expect(LEVEL_ONE.flagX).toBe(198);
    expect(LEVEL_ONE.castleX).toBe(204);
  });

  test('grid has uniform row widths of exactly 212 characters', () => {
    expect(GRID_ROWS.length).toBe(15);
    for (let r = 0; r < GRID_ROWS.length; r++) {
      expect(GRID_ROWS[r].length).toBe(212);
    }
  });

  test('spawn is placed over solid ground with empty space for player', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    const { x, y } = LEVEL_ONE.spawn;
    expect(x).toBe(48); // tileX = 3
    expect(y).toBe(192); // tileY = 12

    const spawnTileX = Math.floor(x / 16);
    const spawnTileY = Math.floor(y / 16);

    // Spawn location itself is air
    expect(map.tileAt(spawnTileX, spawnTileY)).toBe(' ');
    // Head space is air
    expect(map.tileAt(spawnTileX, spawnTileY - 1)).toBe(' ');
    // Directly beneath spawn (tileY = 13) is solid ground
    expect(map.tileAt(spawnTileX, spawnTileY + 1)).toBe('X');
    expect(map.isSolidAt(x, y + 16)).toBe(true);
  });

  test('safe start region (first 15 columns) has solid ground and no hazards', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    for (let col = 0; col <= 15; col++) {
      expect(map.tileAt(col, 13)).toBe('X');
      expect(map.tileAt(col, 14)).toBe('X');
    }
  });

  test('contains the 4 standard pipes of heights 2, 3, 4, 4', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);

    // Helper to measure pipe height
    function getPipeHeight(topCol, topRow) {
      expect(map.tileAt(topCol, topRow)).toBe('[');
      expect(map.tileAt(topCol + 1, topRow)).toBe(']');
      let h = 1;
      let r = topRow + 1;
      while (r < 13 && map.tileAt(topCol, r) === '{' && map.tileAt(topCol + 1, r) === '}') {
        h++;
        r++;
      }
      return h;
    }

    // Pipe 1 at col 28, row 11 -> height 2 (rows 11-12)
    expect(getPipeHeight(28, 11)).toBe(2);

    // Pipe 2 at col 38, row 10 -> height 3 (rows 10-12)
    expect(getPipeHeight(38, 10)).toBe(3);

    // Pipe 3 at col 46, row 9 -> height 4 (rows 9-12)
    expect(getPipeHeight(46, 9)).toBe(4);

    // Pipe 4 at col 57, row 9 -> height 4 (rows 9-12)
    expect(getPipeHeight(57, 9)).toBe(4);
  });

  test('contains exactly three ground gaps (pitfalls)', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    let gapCount = 0;
    let inGap = false;

    for (let col = 0; col < LEVEL_ONE.width; col++) {
      const isGroundSolid = map.tileAt(col, 13) === 'X' || map.tileAt(col, 14) === 'X';
      if (!isGroundSolid) {
        if (!inGap) {
          gapCount++;
          inGap = true;
        }
      } else {
        inGap = false;
      }
    }

    expect(gapCount).toBe(3);
  });

  test('contains first ?-block cluster with mushroom block M and coin blocks ?', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    expect(map.tileAt(16, 9)).toBe('?');
    expect(map.tileAt(20, 9)).toBe('B');
    expect(map.tileAt(21, 9)).toBe('M');
    expect(map.tileAt(22, 9)).toBe('?');
    expect(map.tileAt(23, 9)).toBe('B');
    expect(map.tileAt(24, 9)).toBe('?');
  });

  test('contains multi-coin brick block m', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    const multiCoins = map.findTiles('m');
    expect(multiCoins.length).toBeGreaterThanOrEqual(1);
    expect(multiCoins.some((t) => t.tx === 64 && t.ty === 9)).toBe(true);
  });

  test('contains flagpole near tile 198 and castle near tile 204', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);
    const flagTiles = map.findTiles('F');
    expect(flagTiles.length).toBeGreaterThan(0);
    expect(flagTiles.every((t) => t.tx === 198)).toBe(true);
    // Flagpole segments are non-solid
    expect(map.isSolidTile('F')).toBe(false);

    const castleTiles = map.findTiles('C');
    expect(castleTiles.length).toBeGreaterThan(0);
    expect(castleTiles.some((t) => t.tx >= 202 && t.tx <= 206)).toBe(true);
  });

  test('scenery arrays (clouds, hills, bushes) exist with valid coordinates', () => {
    expect(SCENERY).toBeDefined();
    expect(Array.isArray(SCENERY.clouds)).toBe(true);
    expect(Array.isArray(SCENERY.hills)).toBe(true);
    expect(Array.isArray(SCENERY.bushes)).toBe(true);

    expect(SCENERY.clouds.length).toBeGreaterThan(0);
    expect(SCENERY.hills.length).toBeGreaterThan(0);
    expect(SCENERY.bushes.length).toBeGreaterThan(0);

    for (const item of [...SCENERY.clouds, ...SCENERY.hills, ...SCENERY.bushes]) {
      expect(typeof item.x).toBe('number');
      expect(typeof item.y).toBe('number');
      expect(typeof item.type).toBe('string');
    }
  });

  test('integrated tilemap + level1 composition: solidity queries & bump transitions across level', () => {
    const map = createTilemap(LEVEL_ONE.gridRows);

    // Spawn point solidity check
    expect(map.isSolidAt(LEVEL_ONE.spawn.x, LEVEL_ONE.spawn.y)).toBe(false);
    expect(map.isSolidAt(LEVEL_ONE.spawn.x, LEVEL_ONE.spawn.y + 16)).toBe(true);

    // Pipe solidity check (Pipe 1)
    expect(map.isSolidAt(28 * 16 + 8, 11 * 16 + 8)).toBe(true);

    // Gap pitfall check (Gap 1 around col 70)
    expect(map.isSolidAt(70 * 16 + 8, 13 * 16 + 8)).toBe(false);
    expect(map.isSolidAt(70 * 16 + 8, 14 * 16 + 8)).toBe(false);

    // Bump mushroom block
    const mRes = map.bumpBlock(21, 9);
    expect(mRes).toEqual({
      type: 'mushroom',
      depleted: true,
      tile: 'U',
      tx: 21,
      ty: 9,
    });
    expect(map.tileAt(21, 9)).toBe('U');

    // Bump coin block
    const cRes = map.bumpBlock(16, 9);
    expect(cRes).toEqual({
      type: 'coin',
      depleted: true,
      tile: 'U',
      tx: 16,
      ty: 9,
    });
    expect(map.tileAt(16, 9)).toBe('U');

    // Bump multi-coin block repeatedly until depleted
    const multiPos = map.findTiles('m')[0];
    let hits = 0;
    let lastRes;
    while (map.tileAt(multiPos.tx, multiPos.ty) === 'm') {
      lastRes = map.bumpBlock(multiPos.tx, multiPos.ty);
      hits++;
    }
    expect(hits).toBe(5);
    expect(lastRes.depleted).toBe(true);
    expect(lastRes.tile).toBe('U');
    expect(map.tileAt(multiPos.tx, multiPos.ty)).toBe('U');
  });
});
