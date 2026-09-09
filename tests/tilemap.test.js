import { createTilemap, TILES, SOLID_TILES, isSolidTile } from '../src/world/tilemap.js';

describe('Tilemap engine (src/world/tilemap.js)', () => {
  const sampleGrid = [
    '   M   m      ',
    ' ?  B   U     ',
    ' []     {}    ',
    ' {}     {}  F ',
    'XXXXXXXXXXXXXX',
    '##############',
  ];

  test('parses ASCII grid dimensions correctly', () => {
    const map = createTilemap(sampleGrid, { tileSize: 16 });
    expect(map.width).toBe(14);
    expect(map.height).toBe(6);
    expect(map.tileSize).toBe(16);
    expect(map.pixelWidth).toBe(14 * 16);
    expect(map.pixelHeight).toBe(6 * 16);
  });

  test('tileAt queries characters and returns null out of bounds', () => {
    const map = createTilemap(sampleGrid);
    expect(map.tileAt(0, 0)).toBe(' ');
    expect(map.tileAt(3, 0)).toBe('M');
    expect(map.tileAt(7, 0)).toBe('m');
    expect(map.tileAt(1, 1)).toBe('?');
    expect(map.tileAt(4, 1)).toBe('B');
    expect(map.tileAt(8, 1)).toBe('U');
    expect(map.tileAt(1, 2)).toBe('[');
    expect(map.tileAt(2, 2)).toBe(']');
    expect(map.tileAt(12, 3)).toBe('F');
    expect(map.tileAt(0, 4)).toBe('X');
    expect(map.tileAt(0, 5)).toBe('#');

    expect(map.tileAt(-1, 0)).toBeNull();
    expect(map.tileAt(14, 0)).toBeNull();
    expect(map.tileAt(0, -1)).toBeNull();
    expect(map.tileAt(0, 6)).toBeNull();
  });

  test('isSolidTile correctly classifies solid vs non-solid tiles', () => {
    expect(isSolidTile('X')).toBe(true);
    expect(isSolidTile('#')).toBe(true);
    expect(isSolidTile('B')).toBe(true);
    expect(isSolidTile('?')).toBe(true);
    expect(isSolidTile('M')).toBe(true);
    expect(isSolidTile('m')).toBe(true);
    expect(isSolidTile('U')).toBe(true);
    expect(isSolidTile('[')).toBe(true);
    expect(isSolidTile(']')).toBe(true);
    expect(isSolidTile('{')).toBe(true);
    expect(isSolidTile('}')).toBe(true);

    // Non-solid tiles
    expect(isSolidTile(' ')).toBe(false);
    expect(isSolidTile('F')).toBe(false);
    expect(isSolidTile('C')).toBe(false);
    expect(isSolidTile(null)).toBe(false);
    expect(isSolidTile(undefined)).toBe(false);
  });

  test('isSolidAt resolves world pixel coordinates to solidity', () => {
    const map = createTilemap(sampleGrid, { tileSize: 16 });
    // Row 4 is ground 'X' -> y: 4*16 = 64px to 79px
    expect(map.isSolidAt(0, 64)).toBe(true);
    expect(map.isSolidAt(15, 70)).toBe(true);

    // Row 0, col 0 is empty air -> (0, 0)
    expect(map.isSolidAt(0, 0)).toBe(false);
    expect(map.isSolidAt(8, 8)).toBe(false);

    // Flagpole at (12, 3) -> (192, 48) is non-solid
    expect(map.isSolidAt(12 * 16 + 8, 3 * 16 + 8)).toBe(false);

    // Pipe top at (1, 2) -> (16, 32) is solid
    expect(map.isSolidAt(16 + 4, 32 + 4)).toBe(true);

    // Out of bounds is not solid
    expect(map.isSolidAt(-10, 0)).toBe(false);
    expect(map.isSolidAt(0, 500)).toBe(false);
  });

  test('setTile mutates tile code in grid', () => {
    const map = createTilemap(sampleGrid);
    expect(map.tileAt(0, 0)).toBe(' ');
    const res = map.setTile(0, 0, 'X');
    expect(res).toBe(true);
    expect(map.tileAt(0, 0)).toBe('X');

    expect(map.setTile(-1, 0, 'X')).toBe(false);
  });

  describe('bumpBlock state transitions and contents', () => {
    test('? coin block transitions to U, returns type coin, and tracks bump animation', () => {
      const map = createTilemap(sampleGrid);
      expect(map.tileAt(1, 1)).toBe('?');

      const hitResult = map.bumpBlock(1, 1);
      expect(hitResult).toEqual({
        type: 'coin',
        depleted: true,
        tile: 'U',
        tx: 1,
        ty: 1,
      });
      expect(map.tileAt(1, 1)).toBe('U');

      const anims = map.activeBumpAnimations();
      expect(anims.length).toBe(1);
      expect(anims[0].tx).toBe(1);
      expect(anims[0].ty).toBe(1);
      expect(anims[0].t).toBe(0);

      // Bumping a used block returns null
      expect(map.bumpBlock(1, 1)).toBeNull();
    });

    test('M mushroom block transitions to U, returns type mushroom', () => {
      const map = createTilemap(sampleGrid);
      expect(map.tileAt(3, 0)).toBe('M');

      const hitResult = map.bumpBlock(3, 0);
      expect(hitResult).toEqual({
        type: 'mushroom',
        depleted: true,
        tile: 'U',
        tx: 3,
        ty: 0,
      });
      expect(map.tileAt(3, 0)).toBe('U');
    });

    test('multi-coin brick m gives coins until depleted, then transitions to U', () => {
      const map = createTilemap(sampleGrid, { multiCoinHits: 3 });
      expect(map.tileAt(7, 0)).toBe('m');

      // Hit 1
      const hit1 = map.bumpBlock(7, 0);
      expect(hit1).toEqual({
        type: 'multi',
        depleted: false,
        tile: 'm',
        tx: 7,
        ty: 0,
        remaining: 2,
      });
      expect(map.tileAt(7, 0)).toBe('m');

      // Hit 2
      const hit2 = map.bumpBlock(7, 0);
      expect(hit2).toEqual({
        type: 'multi',
        depleted: false,
        tile: 'm',
        tx: 7,
        ty: 0,
        remaining: 1,
      });
      expect(map.tileAt(7, 0)).toBe('m');

      // Hit 3 -> Depletes to U
      const hit3 = map.bumpBlock(7, 0);
      expect(hit3).toEqual({
        type: 'multi',
        depleted: true,
        tile: 'U',
        tx: 7,
        ty: 0,
        remaining: 0,
      });
      expect(map.tileAt(7, 0)).toBe('U');

      // Hit 4 on U block returns null
      const hit4 = map.bumpBlock(7, 0);
      expect(hit4).toBeNull();
    });

    test('breakable brick B triggers bump animation and returns type brick', () => {
      const map = createTilemap(sampleGrid);
      expect(map.tileAt(4, 1)).toBe('B');

      const hitResult = map.bumpBlock(4, 1);
      expect(hitResult).toEqual({
        type: 'brick',
        depleted: false,
        tile: 'B',
        tx: 4,
        ty: 1,
      });
      expect(map.tileAt(4, 1)).toBe('B');
      expect(map.activeBumpAnimations().length).toBe(1);
    });

    test('activeBumpAnimations updates over time and removes finished animations', () => {
      const map = createTilemap(sampleGrid, { bumpDuration: 0.2, bumpHeight: 8 });
      map.bumpBlock(1, 1);

      expect(map.activeBumpAnimations().length).toBe(1);
      expect(map.getBumpOffset(1, 1)).toBe(0);

      // Advance by half duration (0.1s -> peak bump height ~ -8px)
      map.update(0.1);
      const anims = map.activeBumpAnimations();
      expect(anims.length).toBe(1);
      expect(anims[0].t).toBeCloseTo(0.5, 2);
      expect(map.getBumpOffset(1, 1)).toBeCloseTo(-8, 1);

      // Advance past duration (0.15s more -> 0.25s total)
      map.update(0.15);
      expect(map.activeBumpAnimations().length).toBe(0);
      expect(map.getBumpOffset(1, 1)).toBe(0);
    });

    test('findTiles finds all coordinates of given tile code', () => {
      const map = createTilemap(sampleGrid);
      const flags = map.findTiles('F');
      expect(flags).toEqual([{ tx: 12, ty: 3 }]);
    });
  });
});
