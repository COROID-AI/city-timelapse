/**
 * Renderer tests — drawPixels() against a mock 2D context.
 *
 * The mock records every fillRect call (fillStyle + coordinates) so the
 * tests can assert the full rendering contract without a real canvas:
 *   - only ctx.fillRect is used (no drawImage / other canvas methods),
 *   - '.' (transparent) pixels never produce a fillRect for that cell,
 *   - palette characters map to their exact hex color,
 *   - flipX mirrors art around the frame's vertical center line,
 *   - scale multiplies each pixel cell by the requested factor.
 */
import { drawPixels } from '../src/render/pixelArt.js';

/**
 * Minimal recording 2D context. Every method other than the renderer's
 * contract (fillRect plus save/restore) is a spy, so tests can assert
 * drawPixels never touches them.
 */
function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    // Explicitly forbidden / unrelated canvas API — must never be called.
    drawImage: jest.fn(),
    createPattern: jest.fn(),
  };
  return { ctx, calls };
}

/** Opaque-pixel summary of recorded fillRect calls. */
function cells(calls) {
  return new Map(calls.map((c) => [`${c.x},${c.y}`, { color: c.color, w: c.w, h: c.h }]));
}

/**
 * A tiny 4x3 frame that exercises transparency, gaps and both palette keys.
 *
 *   a.ab   -> opaque: (0,0)a (2,0)a (3,0)b   ('.' at (1,0) is skipped)
 *   b..b   -> opaque: (0,1)b (3,1)b
 *   ....   -> fully transparent row
 */
const miniSprite = {
  palette: { a: '#a0a0a0', b: '#bbbbbb' },
  width: 4,
  height: 3,
  rows: ['a.ab', 'b..b', '....'],
};

describe('drawPixels', () => {
  test('emits one fillRect per opaque pixel with the palette color', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 0, 0);

    // 5 opaque pixels: (0,0)a (2,0)a (3,0)b (0,1)b (3,1)b.
    expect(calls).toHaveLength(5);

    const painted = cells(calls);
    expect(painted.get('0,0').color).toBe('#a0a0a0');
    expect(painted.get('2,0').color).toBe('#a0a0a0');
    expect(painted.get('3,0').color).toBe('#bbbbbb');
    expect(painted.get('0,1').color).toBe('#bbbbbb');
    expect(painted.get('3,1').color).toBe('#bbbbbb');
  });

  test('honors transparency — no fillRect for (.) cells or empty rows', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 0, 0);

    const painted = cells(calls);
    expect(painted.has('1,0')).toBe(false); // '.' between a and a
    expect(painted.has('1,1')).toBe(false); // '.' in row 1
    expect(painted.has('2,1')).toBe(false); // '.' in row 1
    expect(painted.has('0,2')).toBe(false); // blank row entirely
    expect(painted.has('3,2')).toBe(false);
  });

  test('draws at the requested (x, y) origin with default scale 1', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 5, 7);

    const coords = calls.map((c) => [c.x, c.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(coords).toEqual([
      [5, 7], // pixel (0,0)
      [5, 8], // pixel (0,1)
      [7, 7], // pixel (2,0)
      [8, 7], // pixel (3,0)
      [8, 8], // pixel (3,1)
    ]);
    expect(calls.every((c) => c.w === 1 && c.h === 1)).toBe(true);
  });

  test('scales every cell by the requested factor (integer scale)', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 10, 10, { scale: 3 });

    expect(calls).toHaveLength(5);
    expect(calls.every((c) => c.w === 3 && c.h === 3)).toBe(true);

    const painted = cells(calls);
    // pixel (0,0) => 10,10
    expect(painted.get('10,10').color).toBe('#a0a0a0');
    // pixel (3,1) => x=10+3*3=19, y=10+1*3=13
    expect(painted.get('19,13').color).toBe('#bbbbbb');
  });

  test('flipX mirrors each pixel around the vertical center line', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 0, 0, { flipX: true });

    const painted = cells(calls);
    // width=4 -> mirrored column = 3 - col.
    const mirrored = {
      '3,0': painted.get('3,0'), // original (0,0) 'a'
      '1,0': painted.get('1,0'), // original (2,0) 'a'
      '0,0': painted.get('0,0'), // original (3,0) 'b'
      '3,1': painted.get('3,1'), // original (0,1) 'b'
      '0,1': painted.get('0,1'), // original (3,1) 'b'
    };
    expect(mirrored['3,0'].color).toBe('#a0a0a0');
    expect(mirrored['1,0'].color).toBe('#a0a0a0');
    expect(mirrored['0,0'].color).toBe('#bbbbbb');
    expect(mirrored['3,1'].color).toBe('#bbbbbb');
    expect(mirrored['0,1'].color).toBe('#bbbbbb');
  });

  test('flipX keeps the same bounding box as the unflipped draw', () => {
    const { ctx, calls: plain } = createMockContext();
    drawPixels(ctx, miniSprite, 0, 0);

    const flipCtx = createMockContext();
    drawPixels(flipCtx.ctx, miniSprite, 0, 0, { flipX: true });

    const xs = (list) => list.map((c) => c.x);
    expect(Math.max(...xs(flipCtx.calls))).toBe(Math.max(...xs(plain)));
    expect(Math.min(...xs(flipCtx.calls))).toBe(Math.min(...xs(plain)));

    const ys = (list) => list.map((c) => c.y);
    expect(Math.max(...ys(flipCtx.calls))).toBe(Math.max(...ys(plain)));
    expect(Math.min(...ys(flipCtx.calls))).toBe(Math.min(...ys(plain)));
  });

  test('never touches image APIs — pure fillRect rendering', () => {
    const { ctx, calls } = createMockContext();
    drawPixels(ctx, miniSprite, 0, 0, { scale: 2 });

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.createPattern).not.toHaveBeenCalled();
    // Every recorded pixel op is a plain fillRect with a color + 4 numbers.
    for (const c of calls) {
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect([c.x, c.y, c.w, c.h].every((n) => typeof n === 'number')).toBe(true);
    }
  });
});