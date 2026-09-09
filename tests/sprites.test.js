/**
 * Sprite inventory tests.
 *
 * Validates every frame of the palette string-map inventory (non-empty,
 * uniform row width, declared width/height match, ≤ 32 rows, no '.' in a
 * missing-palette position) and then pushes EVERY real frame through the
 * real drawPixels() renderer against a recording 2D context, asserting
 * fillRect-only emission, palette colors, flip mirroring and dimensions
 * end to end (composition check).
 */
import { drawPixels } from '../src/render/pixelArt.js';
import { SPRITES } from '../src/render/sprites/index.js';

/** The complete named frame inventory this task is contractually required to ship. */
const REQUIRED = {
  marioSmall: ['idle', 'walk1', 'walk2', 'walk3', 'jump', 'skid', 'death', 'flagSlide'],
  marioSuper: ['idle', 'walk1', 'walk2', 'walk3', 'jump', 'skid', 'flagSlide'],
  goomba: ['walk1', 'walk2', 'squashed'],
  koopa: ['walk1', 'walk2', 'shell'],
  // items group: mushroom + coin under a single `items` aggregator.
  mushroom: ['default'],
  coin: ['spin1', 'spin2', 'spin3', 'spin4'],
  tiles: [
    'ground', 'brick', 'usedBlock',
    'question1', 'question2', 'question3',
    'pipeTopLeft', 'pipeTopRight', 'pipeBodyLeft', 'pipeBodyRight',
    'flagpole', 'flag', 'castle',
  ],
  scenery: ['cloud', 'hill', 'bush'],
};

function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    drawImage: jest.fn(),
  };
  return { ctx, calls };
}

/** Flatten REQUIRED into [{ group, frame, frameData }]. */
function allFrames() {
  const frames = [];
  for (const name of REQUIRED.marioSmall) frames.push({ group: 'marioSmall', frame: name, data: SPRITES.marioSmall[name] });
  for (const name of REQUIRED.marioSuper) frames.push({ group: 'marioSuper', frame: name, data: SPRITES.marioSuper[name] });
  for (const name of REQUIRED.goomba) frames.push({ group: 'goomba', frame: name, data: SPRITES.goomba[name] });
  for (const name of REQUIRED.koopa) frames.push({ group: 'koopa', frame: name, data: SPRITES.koopa[name] });
  for (const name of REQUIRED.mushroom) frames.push({ group: 'items', frame: `mushroom:${name}`, data: SPRITES.items.mushroom });
  for (const name of REQUIRED.coin) frames.push({ group: 'items', frame: `coin:${name}`, data: SPRITES.items.coin[name] });
  for (const name of REQUIRED.tiles) frames.push({ group: 'tiles', frame: name, data: SPRITES.tiles[name] });
  for (const name of REQUIRED.scenery) frames.push({ group: 'scenery', frame: name, data: SPRITES.scenery[name] });
  return frames;
}

describe('sprite inventory', () => {
  test('exposes every required frame of the registry', () => {
    const seenSmall = Object.keys(SPRITES.marioSmall ?? {});
    const seenSuper = Object.keys(SPRITES.marioSuper ?? {});
    const seenGoomba = Object.keys(SPRITES.goomba ?? {});
    const seenKoopa = Object.keys(SPRITES.koopa ?? {});
    const seenItems = SPRITES.items ?? {};
    const seenCoin = Object.keys(seenItems.coin ?? {});
    const seenTiles = Object.keys(SPRITES.tiles ?? {});
    const seenScenery = Object.keys(SPRITES.scenery ?? {});

    expect(seenSmall).toBeDefined();
    for (const name of REQUIRED.marioSmall) expect(seenSmall).toContain(name);
    for (const name of REQUIRED.marioSuper) expect(seenSuper).toContain(name);
    for (const name of REQUIRED.goomba) expect(seenGoomba).toContain(name);
    for (const name of REQUIRED.koopa) expect(seenKoopa).toContain(name);
    for (const name of REQUIRED.mushroom) expect(SPRITES.items.mushroom).toBeDefined();
    for (const name of REQUIRED.coin) expect(seenCoin).toContain(name);
    for (const name of REQUIRED.tiles) expect(seenTiles).toContain(name);
    for (const name of REQUIRED.scenery) expect(seenScenery).toContain(name);
  });

  test('every frame is a non-empty, uniform string array with a matching palette', () => {
    for (const { group, frame, data } of allFrames()) {
      const label = `${group}.${frame}`;
      expect(Array.isArray(data.rows)).toBe(true);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.height).toBe(data.rows.length);
      expect(data.width).toBe(data.rows[0].length);

      for (const row of data.rows) {
        expect(typeof row).toBe('string');
        expect(row.length).toBe(data.width); // uniform width
      }
      // All standard frames are ≤ 32 rows; the castle is a single 80x80
      // large backdrop sprite (required by the tile inventory).
      if (frame !== 'castle') {
        expect(data.height).toBeLessThanOrEqual(32);
      }

      // Every non-'.' art character must be resolvable from the palette.
      for (const row of data.rows) {
        for (const ch of row) {
          if (ch !== '.') {
            expect(data.palette[ch]).toBeTruthy();
          }
        }
      }
    }
  });
});

describe('renderer + inventory composition (fillRect-only)', () => {
  test.each(allFrames().map((f) => [`${f.group}.${f.frame}`, f.data]))(
    'draws %s with fillRect only, honoring palette, flips and scale',
    (_label, data) => {
      const { ctx, calls } = createMockContext();
      drawPixels(ctx, data, 3, 4);

      expect(calls.length).toBeGreaterThan(0);
      expect(ctx.drawImage).not.toHaveBeenCalled();
      for (const c of calls) {
        expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(c.w).toBe(1);
        expect(c.h).toBe(1);
        expect(c.x).toBeGreaterThanOrEqual(3);
        expect(c.y).toBeGreaterThanOrEqual(4);
        expect(c.x).toBeLessThan(3 + data.width);
        expect(c.y).toBeLessThan(4 + data.height);
      }
      // One fillRect per opaque pixel (.* counts '.'), scaled by 1.
      const totalOpaque = data.rows.reduce((n, row) => n + (row.match(/[^.]/g) || []).length, 0);
      expect(calls.length).toBe(totalOpaque);

      // Scaled draw doubles the cell, keeping the same pixel count.
      const scaled = createMockContext();
      drawPixels(scaled.ctx, data, 3, 7, { scale: 2 });
      expect(scaled.calls).toHaveLength(totalOpaque);
      expect(scaled.calls.every((c) => c.w === 2 && c.h === 2)).toBe(true);
    },
  );

  test('flipX emits exactly the expected mirrored pixel set for every frame', () => {
    for (const { group, frame, data } of allFrames()) {
      const { ctx, calls } = createMockContext();
      drawPixels(ctx, data, 0, 0, { flipX: true });

      // Expected output: every opaque character mirrored around the frame's
      // vertical center line (column c becomes width-1-c, same row).
      const expected = [];
      data.rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c += 1) {
          const ch = row[c];
          if (ch === '.') continue;
          expected.push({
            color: data.palette[ch],
            x: data.width - 1 - c,
            y: r,
            w: 1,
            h: 1,
          });
        }
      });

      expect(calls).toHaveLength(expected.length);
      // Compare position -> color maps directly (fast on the 80x80 castle).
      const toMap = (list) => new Map(list.map((c) => [`${c.x},${c.y}`, c.color]));
      expect(toMap(calls)).toEqual(toMap(expected));
    }
  });
});