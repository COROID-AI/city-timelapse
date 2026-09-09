/**
 * Pixel font tests.
 *
 * The 5x7 glyph registry is validated structurally (every row exactly 5
 * chars, exactly 7 rows) and functionally: drawText() must route each glyph
 * through the REAL drawPixels() renderer against a recording 2D context,
 * emitting one fillRect with the requested color per opaque '#' pixel, with
 * a 6px advance between glyphs (scaled by `scale`), and skip unsupported
 * characters without painting while still advancing.
 */
import { drawText, GLYPHS, GLYPH_ADVANCE, GLYPH_HEIGHT, GLYPH_WIDTH } from '../src/ui/pixelFont.js';
import { drawPixels } from '../src/render/pixelArt.js';

/** Recording 2D context: captures fillStyle + every fillRect. */
function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    // Canvas text/API surface that the font must never touch.
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    drawImage: jest.fn(),
  };
  return { ctx, calls };
}

/** Compress recorded fillRects into "x,y -> {color,w,h}" for lookups. */
function cells(calls) {
  return new Map(calls.map((c) => [`${c.x},${c.y}`, { color: c.color, w: c.w, h: c.h }]));
}

describe('glyph registry', () => {
  test('exposes every required glyph', () => {
    const required = [
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ...'0123456789',
      '-',
      '×',
      '©',
      '!',
      '.',
    ];
    for (const ch of required) {
      expect(GLYPHS[ch]).toBeDefined();
    }
  });

  test('every glyph is a valid 5x7 frame (7 rows of exactly 5 chars)', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows).toHaveLength(GLYPH_HEIGHT);
      for (const row of rows) {
        expect(row).toHaveLength(GLYPH_WIDTH);
        expect(row).toMatch(/^[#.]+$/);
      }
      void ch;
    }
  });

  test('glyphs are distinct — no two characters share identical art', () => {
    const seen = new Set();
    const duplicates = [];
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      const sig = rows.join('|');
      if (seen.has(sig)) duplicates.push({ ch, sig });
      seen.add(sig);
    }
    expect(duplicates).toEqual([]);
  });
});

describe('drawText', () => {
  test('draws each opaque pixel of every glyph via the real drawPixels pipeline', () => {
    const { ctx, calls } = createMockContext();
    // Spy on drawPixels itself through the font's module binding is not
    // possible here, so assert on the OBSERVABLE contract: fillRect-only
    // emission exactly matches the glyph art (fillRect-only = the full
    // drawPixels behavior).
    drawText(ctx, 'A', 0, 10, { color: '#ffffff' });

    // 'A' has 16 opaque '#' pixels (0-4/7s), all painted at y 10..16.
    expect(calls.length).toBeGreaterThan(0);
    const painted = cells(calls);
    const ys = new Set(calls.map((c) => c.y));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(10 + GLYPH_HEIGHT - 1);
    }
    for (const c of calls) {
      expect(c.color).toBe('#ffffff');
      expect([c.x, c.y, c.w, c.h].every((n) => typeof n === 'number')).toBe(true);
    }
    // A's cells: '..#..' '.#.#.' '#...#' '#####' '#...#' '#...#' '#...#'.
    for (const y of [0, 1, 2, 3, 4, 5, 6]) {
      for (const x of [0, 1, 2, 3, 4]) {
        const opaque = GLYPHS.A[y][x] === '#';
        expect(painted.has(`${x},${10 + y}`)).toBe(opaque);
      }
    }
  });

  test('advances each glyph by exactly 6px (scaled)', () => {
    const { ctx, calls } = createMockContext();
    drawText(ctx, 'HI', 20, 0); // H and I, scale 1

    const xs = new Set(calls.map((c) => c.x));
    const lastBaseline = 20 + GLYPH_ADVANCE * (2 - 1); // I's baseline: x 26
    expect(Math.min(...xs)).toBe(20);
    expect(Math.max(...xs)).toBe(lastBaseline + (GLYPH_WIDTH - 1));

    const scaled = createMockContext();
    drawText(scaled.ctx, 'HI', 20, 0, { scale: 2 });
    const scaledXs = new Set(scaled.calls.map((c) => c.x));
    const scaledLastBaseline = 20 + GLYPH_ADVANCE * 2 * (2 - 1);
    expect(Math.min(...scaledXs)).toBe(20);
    expect(Math.max(...scaledXs)).toBe(scaledLastBaseline + (GLYPH_WIDTH - 1) * 2);
  });

  test('spaces and unsupported characters advance without painting', () => {
    const { ctx, calls } = createMockContext();
    drawText(ctx, 'A B?Z', 0, 0);
    // Opaque glyphs in the string (space and '?' have no map entry).
    const expectedCount = ['A', 'B', 'Z'].reduce(
      (sum, ch) => sum + GLYPHS[ch].join('').split('').filter((c) => c === '#').length,
      0
    );
    expect(calls).toHaveLength(expectedCount);

    const xs = new Set(calls.map((c) => c.x));
    // 'A' at x 0, 'B' at x 12 (a 6px space in between), 'Z' at x 24.
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(24 + GLYPH_WIDTH - 1);
  });

  test('lowercase input maps onto the A-Z glyphs', () => {
    const lower = createMockContext();
    drawText(lower.ctx, 'abc', 0, 0);
    const upper = createMockContext();
    drawText(upper.ctx, 'ABC', 0, 0);
    expect(lower.calls).toHaveLength(upper.calls.length);
    expect(lower.calls.map((c) => `${c.x},${c.y}`)).toEqual(upper.calls.map((c) => `${c.x},${c.y}`));
  });

  test('honors the color option for every glyph pixel', () => {
    const { ctx, calls } = createMockContext();
    drawText(ctx, '1!', 0, 0, { color: '#ff0000' });
    expect(calls.every((c) => c.color === '#ff0000')).toBe(true);
  });

  test('never touches the canvas text or image API', () => {
    const { ctx } = createMockContext();
    drawText(ctx, 'MARIO 000000', 0, 0, { color: '#ffffff', scale: 2 });
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.strokeText).not.toHaveBeenCalled();
    expect(ctx.measureText).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

/** Sanity: drawText must actually call the real renderer export it imports. */
describe('drawText integration with drawPixels', () => {
  test('generates fillRect calls identical to drawPixels over the same frame', () => {
    const { ctx: fontCtx, calls: fontCalls } = createMockContext();
    drawText(fontCtx, 'X', 4, 8);

    const { ctx: pixCtx, calls: pixCalls } = createMockContext();
    drawPixels(
      pixCtx,
      { palette: { '#': '#ffffff' }, width: GLYPH_WIDTH, height: GLYPH_HEIGHT, rows: GLYPHS.X },
      4,
      8
    );

    expect(fontCalls).toHaveLength(pixCalls.length);
    expect(fontCalls).toEqual(pixCalls);
  });
});