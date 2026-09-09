/**
 * HUD tests.
 *
 * drawHud() must render all five classic regions from a real GameStats
 * object ({score, coins, world, time, lives}):
 *
 *   - 'MARIO' label + 6-digit zero-padded score,
 *   - coin icon (real SPRITES.items.coin spin frame) + '×NN',
 *   - 'WORLD 1-1',
 *   - 'TIME NNN',
 *   - '×N' lives.
 *
 * Every painted cell goes through the REAL drawText -> drawPixels pipeline
 * (fillRect-only; the mock context records fillStyle + coordinates), and the
 * whole line must fit inside the 256px viewport (CONSTANTS.VIEWPORT_WIDTH).
 */
import { drawHud, HUD_LAYOUT, HUD_REGIONS } from '../src/ui/hud.js';
import { GLYPHS } from '../src/ui/pixelFont.js';
import { SPRITES } from '../src/render/sprites/index.js';
import { CONSTANTS } from '../src/core/constants.js';

/** Recording 2D context: captures fillStyle + every fillRect as cells. */
function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    // Canvas text/API surface the HUD must never touch.
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    drawImage: jest.fn(),
  };
  return { ctx, calls };
}

/** Cells map 'x,y' -> {color, w, h} for lookups. */
function cellsMap(calls) {
  return new Map(calls.map((c) => [`${c.x},${c.y}`, { color: c.color, w: c.w, h: c.h }]));
}

/** True if the given cell was painted at all. */
function painted(map, x, y) {
  return map.has(`${x},${y}`);
}

/**
 * Assert the glyph `ch` is painted exactly at (x0 + col, top + row) for
 * every opaque '#' and transparent for every '.', per the real 5x7 map.
 */
function assertGlyph(map, ch, x0, top) {
  const rows = GLYPHS[ch];
  expect(rows).toBeDefined();
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      const opaque = rows[row][col] === '#';
      expect(painted(map, x0 + col, top + row)).toBe(opaque);
    }
  }
}

/** Assert a whole text run is painted at (x0, top), advancing 6px/glyph.
 *  Characters without a glyph (spaces) still advance the cursor. */
function assertText(map, text, x0, top) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const rows = GLYPHS[ch];
    if (rows) assertGlyph(map, ch, x, top);
    x += 6;
  }
}

/** Full stats object matching the GameStats contract. */
const STATS = {
  score: 1234,
  coins: 7,
  world: '1-1',
  time: 300,
  lives: 3,
};

describe('HUD layout', () => {
  test('region baselines match the hand-derived fixed model', () => {
    const { left, gap, scoreDigits, coinsDigits, timeDigits, coinScale } = HUD_LAYOUT;
    const labelX = left;
    const coinIconX = labelX + (5 + 1 + scoreDigits) * 6 + gap; // 'MARIO 001234'
    const coinsTextX = coinIconX + SPRITES.items.coin.spin1.width * coinScale + gap; // '×NN'
    const worldX = coinsTextX + (1 + coinsDigits) * 6 + gap; // 'WORLD 1-1'
    const timeX = worldX + (5 + 1 + 3) * 6 + gap; // 'TIME NNN'
    const livesX = timeX + (4 + 1 + timeDigits) * 6 + gap; // '×N'

    expect(HUD_REGIONS.labelX).toBe(labelX);
    expect(HUD_REGIONS.coinIconX).toBe(coinIconX);
    expect(HUD_REGIONS.coinsTextX).toBe(coinsTextX);
    expect(HUD_REGIONS.worldX).toBe(worldX);
    expect(HUD_REGIONS.timeX).toBe(timeX);
    expect(HUD_REGIONS.livesX).toBe(livesX);
  });

  test('the fixed-width fit: whole line stays inside the 256px viewport', () => {
    const { ctx, calls } = createMockContext();
    drawHud(ctx, STATS);
    for (const c of calls) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(CONSTANTS.VIEWPORT_WIDTH);
      expect(c.y + c.h).toBeLessThanOrEqual(CONSTANTS.VIEWPORT_HEIGHT);
    }
  });
});

describe('drawHud', () => {
  test('renders all five regions from a GameStats object', () => {
    const { ctx, calls } = createMockContext();
    drawHud(ctx, STATS);

    const map = cellsMap(calls);
    const top = HUD_LAYOUT.top;

    // MARIO + 6-digit zero-padded score (1234 -> 001234).
    assertText(map, 'MARIO 001234', HUD_REGIONS.labelX, top);

    // Coin icon drawn from the real coin spin frame at the icon origin.
    const icon = SPRITES.items.coin.spin1;
    const ix = HUD_REGIONS.coinIconX;
    const scale = HUD_LAYOUT.coinScale;
    for (let row = 0; row < icon.rows.length; row += 1) {
      for (let col = 0; col < icon.rows[row].length; col += 1) {
        expect(painted(map, ix + col * scale, top + row * scale)).toBe(icon.rows[row][col] !== '.');
      }
    }

    // Coin counter '×NN' (7 -> '07').
    assertText(map, '×07', HUD_REGIONS.coinsTextX, top);

    // World label.
    assertText(map, 'WORLD 1-1', HUD_REGIONS.worldX, top);

    // Timer NNN (300 -> '300').
    assertText(map, 'TIME 300', HUD_REGIONS.timeX, top);

    // Lives counter '×N'.
    assertText(map, '×3', HUD_REGIONS.livesX, top);
  });

  test('zero-pads score, coins and time to fixed widths', () => {
    const { ctx, calls } = createMockContext();
    drawHud(ctx, { score: 0, coins: 0, world: '1-1', time: 0, lives: 0 });

    const map = cellsMap(calls);
    const top = HUD_LAYOUT.top;
    assertText(map, 'MARIO 000000', HUD_REGIONS.labelX, top);
    assertText(map, '×00', HUD_REGIONS.coinsTextX, top);
    assertText(map, 'TIME 000', HUD_REGIONS.timeX, top);
    assertText(map, '×0', HUD_REGIONS.livesX, top);
  });

  test('huge counters wrap to the fixed digit windows (no region collisions)', () => {
    const { ctx, calls } = createMockContext();
    drawHud(ctx, { score: 1234567, coins: 12, world: '1-1', time: 999, lives: 99 });

    const map = cellsMap(calls);
    const top = HUD_LAYOUT.top;
    // Last 6 digits of 1234567 (leading digit drops off).
    assertText(map, 'MARIO 234567', HUD_REGIONS.labelX, top);
    assertText(map, '×12', HUD_REGIONS.coinsTextX, top);
    assertText(map, 'TIME 999', HUD_REGIONS.timeX, top);
    assertText(map, '×99', HUD_REGIONS.livesX, top);
  });

  test('never uses the canvas text or image API', () => {
    const { ctx } = createMockContext();
    drawHud(ctx, STATS);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.strokeText).not.toHaveBeenCalled();
    expect(ctx.measureText).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});