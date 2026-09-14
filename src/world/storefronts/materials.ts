/**
 * Procedural materials and the canvas-texture pipeline for the storefront
 * builders.
 *
 * Everything is generated in memory — there are no font files, image
 * downloads, fetches or external assets. Text and decorative artwork are
 * drawn as letterforms/glyphs (5x7 bitmaps scaled to size) through a tiny
 * `PaintSurface` abstraction:
 *
 *   - in a real browser the surface wraps the 2D canvas context so `three`
 *     `CanvasTexture` objects can be uploaded into emissive materials;
 *   - headless (jsdom/vitest) the same draw functions run against a
 *     `RecordSurface` allowing tests to assert painted coverage directly.
 *
 * Materials are cached per build (`MaterialCache`) and geometry is instanced
 * (`GeometryCache`) so the whole block stays within a sane draw-call budget.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  type Texture,
} from 'three';
import type { ColorHex } from '../../era/types';

// ============================================================================
// Paint surface abstraction
// ============================================================================

/** Minimal 2D draw contract used by every canvas recipe in this task. */
export interface PaintSurface {
  readonly width: number;
  readonly height: number;
  /** Fill a rectangle; (x, y) is the top-left corner, y grows downwards. */
  rect(x: number, y: number, w: number, h: number, color: string, alpha?: number): void;
}

/** One recorded draw operation (mirrors `PaintSurface.rect`). */
export interface PaintOp {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
}

/**
 * Headless paint target: records every draw op and accumulates per-pixel
 * coverage so tests can assert that text/props are actually painted.
 */
export class RecordSurface implements PaintSurface {
  readonly width: number;
  readonly height: number;
  readonly ops: PaintOp[] = [];
  private readonly cells: Float32Array;
  private readonly cellW: number;
  private readonly cellH: number;

  constructor(width: number, height: number, cellSize = 2) {
    this.width = width;
    this.height = height;
    this.cellW = cellSize;
    this.cellH = cellSize;
    this.cells = new Float32Array(this.cols * this.rows);
  }

  get cols(): number {
    return Math.ceil(this.width / this.cellW);
  }

  get rows(): number {
    return Math.ceil(this.height / this.cellH);
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    this.ops.push({ x, y, w, h, color, alpha });
    const c0 = Math.max(0, Math.floor(x / this.cellW));
    const c1 = Math.min(this.cols - 1, Math.floor((x + w - 0.001) / this.cellW));
    const r0 = Math.max(0, Math.floor(y / this.cellH));
    const r1 = Math.min(this.rows - 1, Math.floor((y + h - 0.001) / this.cellH));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const index = r * this.cols + c;
        this.cells[index] = Math.min(1, this.cells[index]! + alpha);
      }
    }
  }

  /** Coverage at one cell (0..1). */
  coverageAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return 0;
    return this.cells[row * this.cols + col]!;
  }

  /** True when any pixel inside the box has been painted. */
  boxPainted(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.boxCoverage(x0, y0, x1, y1) > 0;
  }

  /** Sum of coverage inside a box (0 when empty). */
  boxCoverage(x0: number, y0: number, x1: number, y1: number): number {
    const c0 = Math.max(0, Math.floor(x0 / this.cellW));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 - 0.001) / this.cellW));
    const r0 = Math.max(0, Math.floor(y0 / this.cellH));
    const r1 = Math.min(this.rows - 1, Math.floor((y1 - 0.001) / this.cellH));
    let sum = 0;
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        sum += this.cells[r * this.cols + c]!;
      }
    }
    return sum;
  }
}

/** Paint target wrapping a real 2D canvas context (browser path). */
class RealCanvasSurface implements PaintSurface {
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
}

/**
 * Create a real canvas paint surface on demand, or null headlessly
 * (no window, no jsdom canvas, or canvas without a 2D context).
 */
export function createCanvasSurface(width: number, height: number): PaintSurface | null {
  if (typeof document === 'undefined') return null;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return null;
  try {
    const ns = 'http://www.w3.org/1999/xhtml';
    const canvas =
      typeof document.createElementNS === 'function'
        ? document.createElementNS(ns, 'canvas')
        : document.createElement('canvas');
    const htmlCanvas = canvas as unknown as HTMLCanvasElement;
    htmlCanvas.width = Math.max(2, Math.ceil(width));
    htmlCanvas.height = Math.max(2, Math.ceil(height));
    if (htmlCanvas.getContext('2d') === null) return null;
    return new RealCanvasSurface(htmlCanvas);
  } catch {
    return null;
  }
}

/**
 * Render one canvas recipe to a THREE texture. Returns null in headless
 * environments — materials then fall back to plain emissive colors while the
 * same draw function remains fully testable with a `RecordSurface`.
 */
export function renderTexture(
  width: number,
  height: number,
  draw: (surface: PaintSurface) => void,
): Texture | null {
  const surface = createCanvasSurface(width, height);
  if (surface === null) return null;
  draw(surface);
  const real = surface as RealCanvasSurface;
  return new CanvasTexture(real.canvas);
}

// ============================================================================
// Color helpers
// ============================================================================

/** Parse `#rrggbb` into a THREE Color. */
export function hexToColor(hex: ColorHex): Color {
  return new Color(hex);
}

/** Serialize a THREE Color back to `#rrggbb` (linear → sRGB). */
export function colorToHex(color: Color): ColorHex {
  const toSrgb = (v: number): number => {
    const c = Math.min(1, Math.max(0, v));
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  const r = Math.round(toSrgb(color.r) * 255);
  const g = Math.round(toSrgb(color.g) * 255);
  const b = Math.round(toSrgb(color.b) * 255);
  const part = (v: number) => (v < 16 ? '0' : '') + v.toString(16);
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Darken a hex color by `factor` (0 = black, 1 = unchanged). */
export function shadeColor(hex: ColorHex, factor: number): ColorHex {
  const c = hexToColor(hex);
  return colorToHex(new Color(c.r * factor, c.g * factor, c.b * factor));
}

/** Linear mix between two hex colors; t in [0, 1]. */
export function mixColors(a: ColorHex, b: ColorHex, t: number): ColorHex {
  const ca = hexToColor(a);
  const cb = hexToColor(b);
  return colorToHex(
    new Color(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t),
  );
}

/** Convert a hex string to an [r,g,b] tuple in 0..255 for assertions. */
export function hexToRgb(hex: ColorHex): [number, number, number] {
  const c = hexToColor(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

// ============================================================================
// Texture drawing: 5x7 bitmap letterforms
// ============================================================================

/**
 * Compact 5x7 glyph set (public-domain style). Each glyph is 7 rows of 5-bit
 * masks (bit 4 = leftmost column).
 */
export const GLYPH_5X7: Record<string, readonly number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [30, 17, 16, 16, 16, 17, 30],
  F: [30, 17, 16, 16, 16, 16, 16],
  G: [14, 17, 17, 16, 18, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [4, 14, 4, 4, 4, 14, 4],
  J: [2, 18, 18, 18, 18, 18, 14],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 17, 30],
  M: [17, 27, 21, 17, 21, 19, 17],
  N: [17, 19, 21, 25, 21, 19, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 17, 18, 14],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [14, 17, 16, 16, 17, 17, 14],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 21, 21, 21, 21, 21, 17],
  X: [17, 18, 20, 8, 20, 18, 17],
  Y: [17, 17, 17, 31, 4, 4, 4],
  Z: [30, 16, 16, 4, 2, 2, 30],
  '0': [14, 17, 17, 17, 17, 17, 14],
  '1': [4, 14, 4, 4, 4, 4, 4],
  '2': [14, 16, 8, 4, 2, 2, 30],
  '3': [14, 17, 17, 4, 17, 17, 14],
  '4': [6, 18, 18, 31, 18, 18, 18],
  '5': [30, 17, 16, 16, 16, 17, 14],
  '6': [14, 17, 17, 17, 17, 17, 30],
  '7': [14, 16, 8, 4, 4, 4, 4],
  '8': [14, 17, 17, 31, 17, 17, 14],
  '9': [14, 17, 17, 17, 17, 18, 14],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '&': [0, 6, 9, 30, 17, 10, 4],
  "'": [2, 2, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 4],
  ',': [0, 0, 0, 0, 0, 4, 4],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  ':': [0, 0, 4, 0, 4, 0, 0],
  '/': [0, 2, 4, 4, 8, 16, 0],
  '+': [0, 0, 4, 31, 4, 0, 0],
  '#': [21, 31, 21, 31, 21, 21, 21],
};

/** Fallback glyph used for unknown characters. */
const GLYPH_FALLBACK = GLYPH_5X7['#']!;

export function glyphFor(char: string): readonly number[] {
  return GLYPH_5X7[char] ?? GLYPH_FALLBACK;
}

/** Letter rendering flavor drives the era-specific sign look. */
export type LetterformMode = 'plain' | 'shadow' | 'glow' | 'led' | 'outline';

export interface TextPaintOptions {
  text: string;
  /** Top-left of the text block (the very first glyph cell). */
  x: number;
  y: number;
  /** Pixel size of one glyph cell. */
  cell: number;
  color: string;
  mode: LetterformMode;
  glowColor?: string;
  shadowColor?: string;
  alpha?: number;
}

export interface CharPaintBox {
  char: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Number of lit glyph cells painted for this character. */
  litCells: number;
}

export interface TextPaintReport {
  /** Total glyph cells painted (each lit cell counts once regardless of mode). */
  paintedCells: number;
  /** Per-character bounding boxes + lit-cell counts for readability asserts. */
  charBoxes: CharPaintBox[];
  /** Width in pixels of the full painted text block. */
  width: number;
  /** Height in pixels of the full painted text block. */
  height: number;
}

/** Painted width of a text block at a given cell size. */
export function measureText(text: string, cell: number): number {
  return text.length * 6 * cell;
}

/**
 * Draw `text` as scaled 5x7 letterforms.
 *
 * Modes apply era-flavor paint treatments around the same readable glyph
 * core: `shadow` = painted sign double-strike, `glow` = neon bloom,
 * `led` = luminous pixels, `outline` = backlit punch-through.
 */
export function paintTextBitmap(
  surface: PaintSurface,
  options: TextPaintOptions,
): TextPaintReport {
  const { text, x, y, cell, color, mode, alpha = 1 } = options;
  const glowColor = options.glowColor ?? color;
  const shadowColor = options.shadowColor ?? shadeColor(color, 0.45);
  const boxes: CharPaintBox[] = [];
  let paintedCells = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const glyph = glyphFor(char);
    const gx = x + i * 6 * cell;
    const gy = y;
    let litCells = 0;

    for (let row = 0; row < 7; row += 1) {
      const mask = glyph[row]!;
      for (let col = 0; col < 5; col += 1) {
        if ((mask & (16 >> col)) === 0) continue;
        litCells += 1;
        const px = gx + col * cell;
        const py = gy + row * cell;
        if (mode === 'shadow') {
          surface.rect(px + cell, py + cell, cell, cell, shadowColor, alpha);
          surface.rect(px, py, cell, cell, color, alpha);
        } else if (mode === 'glow') {
          surface.rect(px - cell * 0.5, py - cell * 0.5, cell * 2, cell * 2, glowColor, alpha * 0.35);
          surface.rect(px, py, cell, cell, color, alpha);
        } else if (mode === 'led') {
          surface.rect(px - cell * 0.5, py - cell * 0.5, cell * 2, cell * 2, shadowColor, alpha * 0.5);
          surface.rect(px + cell * 0.15, py + cell * 0.15, cell * 0.7, cell * 0.7, color, alpha);
        } else if (mode === 'outline') {
          surface.rect(px - cell * 0.25, py - cell * 0.25, cell * 1.5, cell * 1.5, glowColor, alpha * 0.4);
          surface.rect(px, py, cell, cell, color, alpha);
        } else {
          surface.rect(px, py, cell, cell, color, alpha);
        }
      }
    }

    paintedCells += litCells;
    boxes.push({
      char,
      x0: gx,
      y0: gy,
      x1: gx + 5 * cell,
      y1: gy + 7 * cell,
      litCells,
    });
  }

  return { paintedCells, charBoxes: boxes, width: text.length * 6 * cell, height: 7 * cell };
}

/** Horizontal rule (painted sign underline / billboard divider). */
export function paintRule(surface: PaintSurface, x0: number, x1: number, y: number, h: number, color: string): void {
  surface.rect(x0, y, x1 - x0, h, color);
}

// ============================================================================
// Geometry & material caches (instancing for the draw-call budget)
// ============================================================================

/** Per-build shared geometry instances. */
export class GeometryCache {
  private readonly boxes = new Map<string, BoxGeometry>();
  private readonly cylinders = new Map<string, CylinderGeometry>();
  private readonly spheres = new Map<string, SphereGeometry>();

  private static key(parts: readonly number[]): string {
    return parts.map((p) => (Math.round(p * 1000) / 1000).toString()).join('x');
  }

  box(w: number, h: number, d: number): BoxGeometry {
    const key = `b:${GeometryCache.key([w, h, d])}`;
    let geo = this.boxes.get(key);
    if (geo === undefined) {
      geo = new BoxGeometry(w, h, d);
      this.boxes.set(key, geo);
    }
    return geo;
  }

  cylinder(r: number, h: number, segments = 8): CylinderGeometry {
    const key = `c:${GeometryCache.key([r, h, segments])}`;
    let geo = this.cylinders.get(key);
    if (geo === undefined) {
      geo = new CylinderGeometry(r, h, segments);
      this.cylinders.set(key, geo);
    }
    return geo;
  }

  sphere(r: number, widthSegments = 8, heightSegments = 6): SphereGeometry {
    const key = `s:${GeometryCache.key([r, widthSegments, heightSegments])}`;
    let geo = this.spheres.get(key);
    if (geo === undefined) {
      geo = new SphereGeometry(r, widthSegments, heightSegments);
      this.spheres.set(key, geo);
    }
    return geo;
  }
}

export interface EmissiveSpec {
  color: ColorHex;
  intensity: number;
}

/** Per-build shared materials. */
export class MaterialCache {
  private readonly lambertCache = new Map<string, MeshLambertMaterial>();
  private readonly basicCache = new Map<string, MeshBasicMaterial>();

  lambert(color: ColorHex, emissive?: EmissiveSpec, texture?: Texture | null): MeshLambertMaterial {
    const key = `l:${color}:${emissive?.color ?? '0'}:${emissive?.intensity ?? 0}`;
    let mat = this.lambertCache.get(key);
    if (mat === undefined) {
      mat = new MeshLambertMaterial({ color });
      if (emissive !== undefined) {
        mat.emissive = hexToColor(emissive.color);
        mat.emissiveIntensity = emissive.intensity;
      }
      this.lambertCache.set(key, mat);
    }
    if (texture !== null && texture !== undefined) {
      // Textured sign faces are per-sign; give this material instance its map.
      mat = new MeshLambertMaterial({ color });
      if (emissive !== undefined) {
        mat.emissive = hexToColor(emissive.color);
        mat.emissiveIntensity = emissive.intensity;
      }
      mat.map = texture;
    }
    return mat;
  }

  basic(color: ColorHex, glass = false, alpha = 0.35): MeshBasicMaterial {
    const key = `b:${color}:${glass ? 'g' : 's'}:${alpha}`;
    let mat = this.basicCache.get(key);
    if (mat === undefined) {
      const c = hexToColor(color);
      if (glass) {
        (c as unknown as { a: number }).a = alpha;
        mat = new MeshBasicMaterial({ color: c, transparent: true });
      } else {
        mat = new MeshBasicMaterial({ color });
      }
      this.basicCache.set(key, mat);
    }
    return mat;
  }
}