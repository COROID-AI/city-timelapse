/**
 * Shared procedural graphics library: canvas-generated textures, era materials,
 * and high-detail procedural shading foundation.
 *
 * All textures are generated deterministically on HTML5 Canvas at runtime.
 * No external images, HDRIs, or CDN assets are required.
 */

import * as THREE from 'three';
import {
  ERA_PALETTES,
  ERA_YEARS,
  type EraYear,
  type MaterialCategory,
  getEraPalette,
  getMaterialSwatch,
} from './palettes';
import * as GeometryBuilders from './geometry';
import * as InstancingHelpers from './instancing';

// ---------------------------------------------------------------------------
// Deterministic PRNG Helper (Mulberry32)
// ---------------------------------------------------------------------------

export interface PRNG {
  /** Return uniform float in [0, 1). */
  next(): number;
  /** Return float in [min, max). */
  range(min: number, max: number): number;
  /** Return integer in [min, max] inclusive. */
  rangeInt(min: number, max: number): number;
  /** Return boolean with true probability p. */
  chance(p: number): boolean;
  /** Pick random element from array. */
  pick<T>(items: readonly T[]): T;
}

export function createPRNG(seed: number = 1337): PRNG {
  let s = Math.floor(Math.abs(seed)) >>> 0;
  if (s === 0) s = 1;

  const next = (): number => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number): number => min + next() * (max - min);
  const rangeInt = (min: number, max: number): number => Math.floor(range(min, max + 1));
  const chance = (p: number): boolean => next() < p;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];

  return { next, range, rangeInt, chance, pick };
}

// ---------------------------------------------------------------------------
// Color and Canvas Utilities
// ---------------------------------------------------------------------------

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse hex (#rgb, #rrggbb, #rrggbbaa) or named color to RGBA (0-255, a in 0-1). */
export function parseColor(colorStr: string): RGBA {
  const str = colorStr.trim().replace(/^#/, '');
  if (str.length === 3) {
    const r = parseInt(str[0] + str[0], 16);
    const g = parseInt(str[1] + str[1], 16);
    const b = parseInt(str[2] + str[2], 16);
    return { r, g, b, a: 1 };
  }
  if (str.length === 6) {
    const r = parseInt(str.slice(0, 2), 16);
    const g = parseInt(str.slice(2, 4), 16);
    const b = parseInt(str.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }
  if (str.length === 8) {
    const r = parseInt(str.slice(0, 2), 16);
    const g = parseInt(str.slice(2, 4), 16);
    const b = parseInt(str.slice(4, 6), 16);
    const a = parseInt(str.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return { r: 128, g: 128, b: 128, a: 1 };
}

export function rgbaToString(c: RGBA): string {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a.toFixed(3)})`;
}

export function lerpColor(c1: RGBA, c2: RGBA, t: number): RGBA {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: c1.r + (c2.r - c1.r) * clamped,
    g: c1.g + (c2.g - c1.g) * clamped,
    b: c1.b + (c2.b - c1.b) * clamped,
    a: c1.a + (c2.a - c1.a) * clamped,
  };
}

export function adjustColor(c: RGBA, delta: number): RGBA {
  return {
    r: Math.max(0, Math.min(255, c.r + delta)),
    g: Math.max(0, Math.min(255, c.g + delta)),
    b: Math.max(0, Math.min(255, c.b + delta)),
    a: c.a,
  };
}

/**
 * Safe canvas creator that handles standard DOM and headless test environments.
 */
export function createSafeCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : ({ width, height } as unknown as HTMLCanvasElement);

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof (canvas as { getContext?: (type: string) => unknown }).getContext === 'function') {
    try {
      ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    } catch {
      ctx = null;
    }
  }

  return { canvas, ctx };
}

/**
 * Create a configured THREE.CanvasTexture from an HTMLCanvasElement with standard city settings.
 */
export function createCanvasTexture(
  canvas: HTMLCanvasElement,
  repeatX: number = 1,
  repeatY: number = 1,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Base Texture Options
// ---------------------------------------------------------------------------

export interface BaseTextureOptions {
  width?: number;
  height?: number;
  seed?: number;
  scale?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  weathering?: number;
}

// ---------------------------------------------------------------------------
// 1. Brick Texture Generator
// ---------------------------------------------------------------------------

export interface BrickTextureOptions extends BaseTextureOptions {
  mortarColor?: string;
  mortarThickness?: number;
  rows?: number;
  columns?: number;
  variation?: number;
}

export function generateBrickTextureSpec(options: BrickTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 42,
    primaryColor = '#8c3826',
    secondaryColor = '#6d281a',
    mortarColor = '#c4beb1',
    mortarThickness = 3,
    rows = 16,
    columns = 8,
    variation = 0.35,
    weathering = 0.25,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const colPrimary = parseColor(primaryColor);
    const colSecondary = parseColor(secondaryColor);
    const colMortar = parseColor(mortarColor);

    // Fill mortar background
    ctx.fillStyle = rgbaToString(colMortar);
    ctx.fillRect(0, 0, width, height);

    const rowH = height / rows;
    const colW = width / columns;

    for (let r = 0; r < rows; r++) {
      const isOffset = r % 2 === 1;
      const xOffset = isOffset ? -colW / 2 : 0;
      const numCols = columns + (isOffset ? 2 : 1);

      for (let c = 0; c < numCols; c++) {
        const bx = xOffset + c * colW + mortarThickness / 2;
        const by = r * rowH + mortarThickness / 2;
        const bw = colW - mortarThickness;
        const bh = rowH - mortarThickness;

        const brickBlend = rng.range(0, 1);
        let brickCol = lerpColor(colPrimary, colSecondary, brickBlend);

        // Subtle per-brick brightness jitter
        const jitter = rng.range(-30 * variation, 30 * variation);
        brickCol = adjustColor(brickCol, jitter);

        // Weathering soot overlay
        if (weathering > 0 && rng.chance(weathering * 0.7)) {
          brickCol = lerpColor(brickCol, { r: 35, g: 30, b: 28, a: 1 }, rng.range(0.2, 0.6) * weathering);
        }

        ctx.fillStyle = rgbaToString(brickCol);
        ctx.fillRect(bx, by, bw, bh);

        // Surface texture flecks
        const fleckCount = Math.floor(bw * bh * 0.05);
        for (let f = 0; f < fleckCount; f++) {
          const fx = bx + rng.range(1, Math.max(1, bw - 1));
          const fy = by + rng.range(1, Math.max(1, bh - 1));
          ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
          ctx.fillRect(fx, fy, 1, 1);
        }

        // Edge chipped wear
        if (weathering > 0.3 && rng.chance(0.4)) {
          ctx.fillStyle = rgbaToString(colMortar);
          const chipW = rng.range(2, 5);
          const chipH = rng.range(1, 3);
          ctx.fillRect(bx, by, chipW, chipH);
        }
      }
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 2. Stone & Ashlar Masonry Texture Generator
// ---------------------------------------------------------------------------

export interface StoneTextureOptions extends BaseTextureOptions {
  jointColor?: string;
  blockRows?: number;
  blockCols?: number;
  graniteNoise?: number;
}

export function generateStoneTextureSpec(options: StoneTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 101,
    primaryColor = '#a89f91',
    secondaryColor = '#80776b',
    jointColor = '#4b4740',
    blockRows = 8,
    blockCols = 4,
    graniteNoise = 0.4,
    weathering = 0.2,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const baseCol = parseColor(primaryColor);
    const darkCol = parseColor(secondaryColor);
    const jCol = parseColor(jointColor);

    ctx.fillStyle = rgbaToString(jCol);
    ctx.fillRect(0, 0, width, height);

    const rowH = height / blockRows;
    const colW = width / blockCols;

    for (let r = 0; r < blockRows; r++) {
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c <= blockCols + 1; c++) {
        const sx = c * colW + offset + 2;
        const sy = r * rowH + 2;
        const sw = colW - 4;
        const sh = rowH - 4;

        const stoneCol = lerpColor(baseCol, darkCol, rng.range(0, 0.8));
        ctx.fillStyle = rgbaToString(stoneCol);
        ctx.fillRect(sx, sy, sw, sh);

        // Granite speckling
        const noiseCount = Math.floor(sw * sh * graniteNoise * 0.15);
        for (let i = 0; i < noiseCount; i++) {
          const nx = sx + rng.range(0, sw);
          const ny = sy + rng.range(0, sh);
          ctx.fillStyle = rng.chance(0.5) ? 'rgba(30,28,25,0.22)' : 'rgba(240,235,225,0.25)';
          ctx.fillRect(nx, ny, rng.rangeInt(1, 2), rng.rangeInt(1, 2));
        }

        // Weathering wash streaks
        if (weathering > 0.2 && rng.chance(0.35)) {
          const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
          grad.addColorStop(0, 'rgba(0,0,0,0.3)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 3. Stucco / Plaster Texture Generator
// ---------------------------------------------------------------------------

export interface StuccoTextureOptions extends BaseTextureOptions {
  trowelMarkDensity?: number;
}

export function generateStuccoTextureSpec(options: StuccoTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 202,
    primaryColor = '#d9d0c1',
    secondaryColor = '#baaf9c',
    trowelMarkDensity = 0.5,
    weathering = 0.15,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);

    ctx.fillStyle = rgbaToString(c1);
    ctx.fillRect(0, 0, width, height);

    // Fine aggregate noise
    const dots = Math.floor(width * height * 0.12);
    for (let i = 0; i < dots; i++) {
      const x = rng.range(0, width);
      const y = rng.range(0, height);
      const bright = rng.chance(0.5);
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Trowel swirl strokes
    const strokeCount = Math.floor(30 * trowelMarkDensity);
    for (let s = 0; s < strokeCount; s++) {
      ctx.beginPath();
      const sx = rng.range(0, width);
      const sy = rng.range(0, height);
      const rad = rng.range(12, 35);
      ctx.arc(sx, sy, rad, rng.range(0, Math.PI), rng.range(Math.PI, Math.PI * 2));
      ctx.lineWidth = rng.range(3, 8);
      ctx.strokeStyle = rgbaToString(lerpColor(c1, c2, rng.range(0.3, 0.7)));
      ctx.stroke();
    }

    // Dirt staining at bottom
    if (weathering > 0) {
      const grad = ctx.createLinearGradient(0, height * 0.6, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(40,35,25,${(weathering * 0.5).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.6, width, height * 0.4);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 4. Siding / Clapboard Texture Generator
// ---------------------------------------------------------------------------

export interface SidingTextureOptions extends BaseTextureOptions {
  plankCount?: number;
  overlapShadow?: boolean;
}

export function generateSidingTextureSpec(options: SidingTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 303,
    primaryColor = '#e2dfd2',
    secondaryColor = '#b8b29e',
    plankCount = 12,
    overlapShadow = true,
    weathering = 0.15,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);
    const plankH = height / plankCount;

    for (let p = 0; p < plankCount; p++) {
      const py = p * plankH;
      const plankCol = lerpColor(c1, c2, rng.range(0, 0.3));

      ctx.fillStyle = rgbaToString(plankCol);
      ctx.fillRect(0, py, width, plankH);

      // Wood grain lines
      const grainCount = 6;
      for (let g = 0; g < grainCount; g++) {
        const gy = py + rng.range(1, plankH - 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy + rng.range(-1, 1));
        ctx.stroke();
      }

      // Bottom overlap shadow line
      if (overlapShadow) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, py + plankH - 2, width, 2);

        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, py, width, 1.5);
      }
    }

    if (weathering > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0.02)');
      grad.addColorStop(1, `rgba(40,30,20,${(weathering * 0.4).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 5. Asphalt Texture Generator
// ---------------------------------------------------------------------------

export interface AsphaltTextureOptions extends BaseTextureOptions {
  crackDensity?: number;
  roadLine?: 'none' | 'yellow-center' | 'white-edge' | 'crosswalk';
}

export function generateAsphaltTextureSpec(options: AsphaltTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 404,
    primaryColor = '#3a3a3d',
    secondaryColor = '#252527',
    crackDensity = 0.3,
    roadLine = 'none',
    weathering = 0.3,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);

    ctx.fillStyle = rgbaToString(c1);
    ctx.fillRect(0, 0, width, height);

    // Dense fine aggregate speckles
    const specks = Math.floor(width * height * 0.2);
    for (let i = 0; i < specks; i++) {
      const x = rng.range(0, width);
      const y = rng.range(0, height);
      const blend = rng.range(0, 1);
      const speckCol = lerpColor(c1, c2, blend);
      const light = rng.chance(0.4);
      ctx.fillStyle = light ? 'rgba(200,200,205,0.18)' : rgbaToString(adjustColor(speckCol, -20));
      ctx.fillRect(x, y, 1, 1);
    }

    // Road markings
    if (roadLine === 'yellow-center') {
      ctx.fillStyle = '#ffc83b';
      const lw = width * 0.08;
      const lh = height * 0.6;
      ctx.fillRect(width / 2 - lw / 2, height * 0.2, lw, lh);
    } else if (roadLine === 'white-edge') {
      ctx.fillStyle = '#f0f0ee';
      ctx.fillRect(width * 0.1, 0, width * 0.06, height);
    } else if (roadLine === 'crosswalk') {
      ctx.fillStyle = '#f5f5f5';
      const stripeW = width * 0.12;
      const gap = width * 0.08;
      for (let x = 10; x < width - 10; x += stripeW + gap) {
        ctx.fillRect(x, height * 0.15, stripeW, height * 0.7);
      }
    }

    // Asphalt cracks
    const numCracks = Math.floor(5 * crackDensity);
    for (let k = 0; k < numCracks; k++) {
      ctx.beginPath();
      let cx = rng.range(0, width);
      let cy = rng.range(0, height);
      ctx.moveTo(cx, cy);
      const segs = rng.rangeInt(4, 10);
      for (let s = 0; s < segs; s++) {
        cx += rng.range(-15, 15);
        cy += rng.range(5, 20);
        ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = 'rgba(10,10,10,0.55)';
      ctx.lineWidth = rng.range(1, 2);
      ctx.stroke();
    }

    // Tire wear tracks / oil stains
    if (weathering > 0.2) {
      ctx.fillStyle = `rgba(15,15,15,${(weathering * 0.35).toFixed(3)})`;
      ctx.fillRect(width * 0.2, 0, width * 0.2, height);
      ctx.fillRect(width * 0.6, 0, width * 0.2, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 6. Cobblestone Paver Texture Generator
// ---------------------------------------------------------------------------

export interface CobblestoneTextureOptions extends BaseTextureOptions {
  settRows?: number;
  settCols?: number;
}

export function generateCobblestoneTextureSpec(options: CobblestoneTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 505,
    primaryColor = '#5e5a52',
    secondaryColor = '#3a3832',
    settRows = 10,
    settCols = 10,
    weathering = 0.4,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    // Dark mortar valleys
    ctx.fillStyle = '#1c1b18';
    ctx.fillRect(0, 0, width, height);

    const rowH = height / settRows;
    const colW = width / settCols;
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);

    for (let r = 0; r < settRows; r++) {
      const rowOffset = (r % 2) * (colW / 2);
      for (let c = -1; c <= settCols + 1; c++) {
        const x = c * colW + rowOffset + 2;
        const y = r * rowH + 2;
        const w = colW - 4;
        const h = rowH - 4;

        const baseSett = lerpColor(c1, c2, rng.range(0, 0.9));
        ctx.fillStyle = rgbaToString(baseSett);
        ctx.beginPath();
        // Rounded cobblestone top
        ctx.roundRect ? ctx.roundRect(x, y, w, h, [4]) : ctx.rect(x, y, w, h);
        ctx.fill();

        // 3D dome bevel lighting (top-left highlight, bottom-right shadow)
        const radGrad = ctx.createRadialGradient(x + w * 0.35, y + h * 0.35, 2, x + w / 2, y + h / 2, w * 0.6);
        radGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
        radGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
        radGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, h, [4]) : ctx.rect(x, y, w, h);
        ctx.fill();
      }
    }

    if (weathering > 0) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `rgba(10,10,10,${(weathering * 0.3).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 7. Concrete / Formwork Texture Generator
// ---------------------------------------------------------------------------

export interface ConcreteTextureOptions extends BaseTextureOptions {
  seams?: boolean;
  tieHoles?: boolean;
  panelRows?: number;
}

export function generateConcreteTextureSpec(options: ConcreteTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 606,
    primaryColor = '#9a9891',
    secondaryColor = '#7a7873',
    seams = true,
    tieHoles = true,
    panelRows = 4,
    weathering = 0.25,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);

    ctx.fillStyle = rgbaToString(c1);
    ctx.fillRect(0, 0, width, height);

    // Aggregate specks
    const count = Math.floor(width * height * 0.15);
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, width);
      const y = rng.range(0, height);
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.12)' : rgbaToString(c2);
      ctx.fillRect(x, y, 1, 1);
    }

    // Formwork board seams
    if (seams) {
      const panelH = height / panelRows;
      for (let p = 1; p < panelRows; p++) {
        const py = p * panelH;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, py - 1, width, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(0, py + 1, width, 1);

        // Formwork tie-rod holes
        if (tieHoles) {
          const holeCols = 4;
          for (let hc = 1; hc <= holeCols; hc++) {
            const hx = (hc / (holeCols + 1)) * width;
            const hy = py - panelH * 0.5;

            ctx.fillStyle = '#22211f';
            ctx.beginPath();
            ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Subtle rust drip below hole
            if (weathering > 0.2) {
              const rustGrad = ctx.createLinearGradient(hx, hy, hx, hy + panelH * 0.4);
              rustGrad.addColorStop(0, 'rgba(120,60,20,0.4)');
              rustGrad.addColorStop(1, 'rgba(120,60,20,0)');
              ctx.fillStyle = rustGrad;
              ctx.fillRect(hx - 2, hy, 4, panelH * 0.4);
            }
          }
        }
      }
    }

    // Efflorescence & water stain washes
    if (weathering > 0) {
      const stainCount = 3;
      for (let s = 0; s < stainCount; s++) {
        const sx = rng.range(0, width);
        const sy = rng.range(0, height * 0.5);
        const sw = rng.range(20, 60);
        const sh = rng.range(40, 100);
        const stainGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
        stainGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        stainGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = stainGrad;
        ctx.fillRect(sx, sy, sw, sh);
      }
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 8. Wood Texture Generator
// ---------------------------------------------------------------------------

export interface WoodTextureOptions extends BaseTextureOptions {
  plankCount?: number;
  knots?: boolean;
}

export function generateWoodTextureSpec(options: WoodTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 707,
    primaryColor = '#7e532b',
    secondaryColor = '#503318',
    plankCount = 4,
    knots = true,
    weathering = 0.2,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);
    const plankW = width / plankCount;

    for (let p = 0; p < plankCount; p++) {
      const px = p * plankW;
      const pCol = lerpColor(c1, c2, rng.range(0, 0.4));
      ctx.fillStyle = rgbaToString(pCol);
      ctx.fillRect(px, 0, plankW, height);

      // Fine grain fibers along Y
      const fiberCount = Math.floor(plankW * 1.5);
      for (let f = 0; f < fiberCount; f++) {
        const fx = px + rng.range(1, plankW - 1);
        ctx.strokeStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = rng.range(0.5, 1.5);
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.bezierCurveTo(
          fx + rng.range(-4, 4),
          height * 0.33,
          fx + rng.range(-4, 4),
          height * 0.66,
          fx + rng.range(-2, 2),
          height,
        );
        ctx.stroke();
      }

      // Occasional wood knot
      if (knots && rng.chance(0.6)) {
        const kx = px + plankW * 0.5;
        const ky = rng.range(height * 0.2, height * 0.8);
        const kr = rng.range(4, 10);

        const knotGrad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
        knotGrad.addColorStop(0, '#2d1c0c');
        knotGrad.addColorStop(0.7, '#472d15');
        knotGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = knotGrad;
        ctx.beginPath();
        ctx.ellipse(kx, ky, kr * 0.7, kr, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Plank joint line
      ctx.fillStyle = '#1e1208';
      ctx.fillRect(px + plankW - 1.5, 0, 1.5, height);
    }

    if (weathering > 0.3) {
      // Gray weathering wash
      ctx.fillStyle = `rgba(120,120,120,${(weathering * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 9. Metal / Brushed Metal Texture Generator
// ---------------------------------------------------------------------------

export interface MetalTextureOptions extends BaseTextureOptions {
  brushed?: boolean;
  rivets?: boolean;
  panelLines?: boolean;
}

export function generateMetalTextureSpec(options: MetalTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 808,
    primaryColor = '#b0b5ba',
    secondaryColor = '#70777e',
    brushed = true,
    rivets = true,
    panelLines = true,
    weathering = 0.15,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);

    // Metal sheen gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, rgbaToString(c1));
    grad.addColorStop(0.5, rgbaToString(lerpColor(c1, c2, 0.5)));
    grad.addColorStop(1, rgbaToString(c1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Fine brushed directional streaks
    if (brushed) {
      const streakCount = Math.floor(height * 2);
      for (let i = 0; i < streakCount; i++) {
        const y = rng.range(0, height);
        ctx.strokeStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Panel boundary seams
    if (panelLines) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(width * 0.5 - 1, 0, 2, height);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(width * 0.5 + 1, 0, 1, height);
    }

    // Rivet studs
    if (rivets) {
      const rivetCount = 8;
      for (let r = 0; r < rivetCount; r++) {
        const ry = (r / (rivetCount - 1)) * (height - 20) + 10;
        for (const rx of [10, width * 0.5, width - 10]) {
          ctx.fillStyle = '#222';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(rx - 0.7, ry - 0.7, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Rust oxidation
    if (weathering > 0.25) {
      ctx.fillStyle = `rgba(130,55,18,${(weathering * 0.5).toFixed(3)})`;
      ctx.fillRect(0, height - 12, width, 12);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 10. Fabric & Awning Texture Generator
// ---------------------------------------------------------------------------

export interface FabricTextureOptions extends BaseTextureOptions {
  striped?: boolean;
  stripeCount?: number;
  stripeColor?: string;
  weaveNoise?: boolean;
}

export function generateFabricTextureSpec(options: FabricTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 909,
    primaryColor = '#802824',
    secondaryColor = '#5c1d1a',
    striped = true,
    stripeCount = 8,
    stripeColor = '#e8dccb',
    weaveNoise = true,
    weathering = 0.2,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const c1 = parseColor(primaryColor);
    const c2 = parseColor(secondaryColor);
    const sCol = parseColor(stripeColor);

    ctx.fillStyle = rgbaToString(c1);
    ctx.fillRect(0, 0, width, height);

    if (striped && stripeCount > 0) {
      const stripeW = width / stripeCount;
      for (let s = 0; s < stripeCount; s += 2) {
        ctx.fillStyle = rgbaToString(sCol);
        ctx.fillRect(s * stripeW, 0, stripeW, height);
      }
    }

    // Cross-hatch textile weave texture with secondary color blend
    if (weaveNoise) {
      ctx.fillStyle = rgbaToString(adjustColor(c2, -20));
      for (let x = 0; x < width; x += 4) {
        ctx.fillRect(x + rng.range(-0.5, 0.5), 0, 1, height);
      }
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y + rng.range(-0.5, 0.5), width, 1);
      }
    }

    // Sun-fade / weathering gradient
    if (weathering > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, `rgba(255,255,255,${(weathering * 0.25).toFixed(3)})`);
      grad.addColorStop(1, `rgba(0,0,0,${(weathering * 0.3).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 11. Glass Window Atlas Texture Generator
// ---------------------------------------------------------------------------

export interface WindowAtlasOptions extends BaseTextureOptions {
  rows?: number;
  columns?: number;
  litRatio?: number;
  frameColor?: string;
  curtainChance?: number;
  interiorSilhouettes?: boolean;
}

export function generateWindowAtlasSpec(options: WindowAtlasOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 512,
    height = 512,
    seed = 1010,
    primaryColor = '#1a2634',
    secondaryColor = '#ffdf85',
    frameColor = '#3a3d42',
    rows = 4,
    columns = 4,
    litRatio = 0.45,
    curtainChance = 0.5,
    interiorSilhouettes = true,
    weathering = 0.15,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const unlitCol = parseColor(primaryColor);
    const litCol = parseColor(secondaryColor);
    const frmCol = parseColor(frameColor);

    // Outer frame / wall background
    ctx.fillStyle = rgbaToString(frmCol);
    ctx.fillRect(0, 0, width, height);

    const cellW = width / columns;
    const cellH = height / rows;
    const margin = 8;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const wx = c * cellW + margin;
        const wy = r * cellH + margin;
        const ww = cellW - margin * 2;
        const wh = cellH - margin * 2;

        const isLit = rng.chance(litRatio);

        if (isLit) {
          // Warm glowing interior gradient
          const glow = ctx.createLinearGradient(wx, wy, wx, wy + wh);
          glow.addColorStop(0, rgbaToString(litCol));
          glow.addColorStop(1, rgbaToString(adjustColor(litCol, -40)));
          ctx.fillStyle = glow;
          ctx.fillRect(wx, wy, ww, wh);

          // Blinds or curtains
          if (rng.chance(curtainChance)) {
            ctx.fillStyle = 'rgba(60,40,20,0.6)';
            const curtainW = ww * rng.range(0.2, 0.45);
            ctx.fillRect(wx, wy, curtainW, wh);
            if (rng.chance(0.5)) {
              ctx.fillRect(wx + ww - curtainW, wy, curtainW, wh);
            }
          }

          // Interior human / plant silhouette
          if (interiorSilhouettes && rng.chance(0.4)) {
            ctx.fillStyle = '#1c1815';
            const sx = wx + ww * rng.range(0.3, 0.7);
            const sy = wy + wh * 0.4;
            // Person head + body
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(sx - 7, sy + 5, 14, wh * 0.5);
          }
        } else {
          // Dark reflective window
          const darkGrad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
          darkGrad.addColorStop(0, rgbaToString(unlitCol));
          darkGrad.addColorStop(1, rgbaToString(adjustColor(unlitCol, -20)));
          ctx.fillStyle = darkGrad;
          ctx.fillRect(wx, wy, ww, wh);

          // Sky / cloud reflection streak
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.moveTo(wx + ww * 0.2, wy);
          ctx.lineTo(wx + ww * 0.6, wy);
          ctx.lineTo(wx + ww * 0.4, wy + wh);
          ctx.lineTo(wx, wy + wh);
          ctx.fill();
        }

        // Window mullion crossbars
        ctx.fillStyle = rgbaToString(frmCol);
        // Vertical mullion
        ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
        // Horizontal mullion
        ctx.fillRect(wx, wy + wh / 2 - 1.5, ww, 3);

        // Glass pane specular edge highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(wx, wy, ww, 1.5);

        // Window weathering / grime film
        if (weathering > 0.1) {
          const grimeGrad = ctx.createLinearGradient(wx, wy + wh * 0.7, wx, wy + wh);
          grimeGrad.addColorStop(0, 'rgba(0,0,0,0)');
          grimeGrad.addColorStop(1, `rgba(30,25,20,${(weathering * 0.4).toFixed(3)})`);
          ctx.fillStyle = grimeGrad;
          ctx.fillRect(wx, wy + wh * 0.7, ww, wh * 0.3);
        }
      }
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 12. Painted Signage Texture Generator
// ---------------------------------------------------------------------------

export interface PaintedSignageOptions extends BaseTextureOptions {
  title?: string;
  subtitle?: string;
  style?: 'hand-painted' | 'painted-enamel' | 'neon-tube' | 'backlit-plastic' | 'led-panel';
  border?: boolean;
}

export function generateSignageTextureSpec(options: PaintedSignageOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 512,
    height = 256,
    seed = 1111,
    title = 'CITY HARDWARE & SUPPLY',
    subtitle = 'EST. 1924 • HIGH QUALITY GOODS',
    style = 'hand-painted',
    primaryColor = '#1f2e3d',
    secondaryColor = '#f4e8c1',
    accentColor = '#c93b2b',
    border = true,
    weathering = 0.3,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const bgCol = parseColor(primaryColor);
    const txtCol = parseColor(secondaryColor);
    const accCol = parseColor(accentColor);

    ctx.fillStyle = rgbaToString(bgCol);
    ctx.fillRect(0, 0, width, height);

    // Decorative border frame
    if (border) {
      ctx.strokeStyle = rgbaToString(accCol);
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      ctx.strokeStyle = rgbaToString(txtCol);
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, width - 32, height - 32);
    }

    // Render Title & Subtitle text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (style === 'hand-painted' || style === 'painted-enamel') {
      ctx.font = 'bold 34px serif';
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(title, width / 2 + 3, height * 0.42 + 3);

      ctx.fillStyle = rgbaToString(txtCol);
      ctx.fillText(title, width / 2, height * 0.42);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = rgbaToString(accCol);
      ctx.fillText(subtitle, width / 2, height * 0.72);
    } else if (style === 'neon-tube') {
      ctx.font = '900 36px sans-serif';
      // Neon tube blur glow
      ctx.shadowColor = rgbaToString(accCol);
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(title, width / 2, height * 0.44);

      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = rgbaToString(txtCol);
      ctx.fillText(subtitle, width / 2, height * 0.72);
      ctx.shadowBlur = 0;
    } else {
      // Modern clean typography (backlit / LED)
      ctx.font = '700 32px sans-serif';
      ctx.fillStyle = rgbaToString(txtCol);
      ctx.fillText(title, width / 2, height * 0.44);

      ctx.font = '500 16px sans-serif';
      ctx.fillStyle = rgbaToString(accCol);
      ctx.fillText(subtitle, width / 2, height * 0.72);
    }

    // Weathering paint chipping
    if (weathering > 0.2) {
      const chipCount = Math.floor(60 * weathering);
      for (let i = 0; i < chipCount; i++) {
        const cx = rng.range(0, width);
        const cy = rng.range(0, height);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(cx, cy, rng.range(2, 8), rng.range(2, 6));
      }
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 13. Neon Glow Texture Generator
// ---------------------------------------------------------------------------

export interface NeonTextureOptions extends BaseTextureOptions {
  glowRadius?: number;
  neonText?: string;
  tubeRadius?: number;
}

export function generateNeonTextureSpec(options: NeonTextureOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 1212,
    neonText = 'OPEN 24H',
    primaryColor = '#ff2b88',
    secondaryColor = '#ffffff',
    glowRadius = 24,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    const neonCol = parseColor(primaryColor);
    const coreCol = parseColor(secondaryColor);

    // Deep dark backing
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px sans-serif';

    const jitterX = rng.range(-1, 1);
    const jitterY = rng.range(-1, 1);

    // Broad soft bloom halo
    ctx.shadowColor = rgbaToString(neonCol);
    ctx.shadowBlur = glowRadius * 1.5;
    ctx.strokeStyle = rgbaToString(neonCol);
    ctx.lineWidth = 10;
    ctx.strokeText(neonText, width / 2 + jitterX, height / 2 + jitterY);

    // Inner bright glow
    ctx.shadowBlur = glowRadius * 0.6;
    ctx.strokeStyle = rgbaToString(neonCol);
    ctx.lineWidth = 4;
    ctx.strokeText(neonText, width / 2 + jitterX, height / 2 + jitterY);

    // White-hot filament center core
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = rgbaToString(coreCol);
    ctx.fillText(neonText, width / 2 + jitterX, height / 2 + jitterY);
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// 14. Grime & Weathering Overlay Texture Generator
// ---------------------------------------------------------------------------

export interface GrimeOverlayOptions extends BaseTextureOptions {
  sootDensity?: number;
  dripStreaks?: boolean;
  cornerVignette?: boolean;
}

export function generateGrimeOverlaySpec(options: GrimeOverlayOptions = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  seed: number;
} {
  const {
    width = 256,
    height = 256,
    seed = 1313,
    sootDensity = 0.5,
    dripStreaks = true,
    cornerVignette = true,
    weathering = 0.5,
  } = options;

  const rng = createPRNG(seed);
  const { canvas, ctx } = createSafeCanvas(width, height);

  if (ctx) {
    // Clear transparent base
    ctx.clearRect(0, 0, width, height);

    // Rain drip streaks running vertically
    if (dripStreaks) {
      const streakCount = Math.floor(15 * sootDensity);
      for (let s = 0; s < streakCount; s++) {
        const sx = rng.range(0, width);
        const sy = rng.range(0, height * 0.3);
        const sl = rng.range(height * 0.3, height * 0.7);
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + sl);
        grad.addColorStop(0, `rgba(18,14,10,${(weathering * 0.7).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(18,14,10,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, rng.range(2, 6), sl);
      }
    }

    // Corner / edge soot accumulation vignette
    if (cornerVignette) {
      const radGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.3,
        width / 2,
        height / 2,
        width * 0.72,
      );
      radGrad.addColorStop(0, 'rgba(0,0,0,0)');
      radGrad.addColorStop(1, `rgba(15,12,10,${(weathering * 0.8).toFixed(3)})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  return { canvas, width, height, seed };
}

// ---------------------------------------------------------------------------
// Material Cache and Material Factory
// ---------------------------------------------------------------------------

const MATERIAL_CACHE = new Map<string, THREE.Material>();

/** Clear all cached THREE materials and textures. */
export function clearMaterialCache(): void {
  for (const mat of MATERIAL_CACHE.values()) {
    mat.dispose();
  }
  MATERIAL_CACHE.clear();
}

export type ProceduralTextureType =
  | 'brick'
  | 'stone'
  | 'stucco'
  | 'siding'
  | 'asphalt'
  | 'cobblestone'
  | 'concrete'
  | 'wood'
  | 'metal'
  | 'fabric'
  | 'windowAtlas'
  | 'signage'
  | 'neon'
  | 'grime';

/**
 * Generate a standard THREE.CanvasTexture for any procedural texture type.
 */
export function createProceduralTexture(
  type: ProceduralTextureType,
  options: Record<string, unknown> = {},
): THREE.CanvasTexture {
  let spec: { canvas: HTMLCanvasElement };

  switch (type) {
    case 'brick':
      spec = generateBrickTextureSpec(options);
      break;
    case 'stone':
      spec = generateStoneTextureSpec(options);
      break;
    case 'stucco':
      spec = generateStuccoTextureSpec(options);
      break;
    case 'siding':
      spec = generateSidingTextureSpec(options);
      break;
    case 'asphalt':
      spec = generateAsphaltTextureSpec(options);
      break;
    case 'cobblestone':
      spec = generateCobblestoneTextureSpec(options);
      break;
    case 'concrete':
      spec = generateConcreteTextureSpec(options);
      break;
    case 'wood':
      spec = generateWoodTextureSpec(options);
      break;
    case 'metal':
      spec = generateMetalTextureSpec(options);
      break;
    case 'fabric':
      spec = generateFabricTextureSpec(options);
      break;
    case 'windowAtlas':
      spec = generateWindowAtlasSpec(options);
      break;
    case 'signage':
      spec = generateSignageTextureSpec(options);
      break;
    case 'neon':
      spec = generateNeonTextureSpec(options);
      break;
    case 'grime':
      spec = generateGrimeOverlaySpec(options);
      break;
    default:
      spec = generateBrickTextureSpec(options);
      break;
  }

  const repeatX = typeof options.repeatX === 'number' ? options.repeatX : 1;
  const repeatY = typeof options.repeatY === 'number' ? options.repeatY : 1;
  return createCanvasTexture(spec.canvas, repeatX, repeatY);
}

/**
 * Factory for creating domain-agnostic THREE.MeshStandardMaterial instances
 * wired to era palettes and canvas-generated procedural textures.
 */
export function createEraMaterial(
  category: MaterialCategory,
  eraYear: EraYear,
  overrides: {
    repeatX?: number;
    repeatY?: number;
    seed?: number;
    roughness?: number;
    metalness?: number;
    wireframe?: boolean;
    transparent?: boolean;
    opacity?: number;
  } = {},
): THREE.MeshStandardMaterial {
  const swatch = getMaterialSwatch(eraYear, category);
  const palette = getEraPalette(eraYear);

  let textureType: ProceduralTextureType = 'concrete';
  if (category === 'masonryConcrete') {
    textureType = eraYear === 1945 ? 'brick' : eraYear === 1985 ? 'concrete' : 'stucco';
  } else if (category === 'metal') {
    textureType = 'metal';
  } else if (category === 'glass') {
    textureType = 'windowAtlas';
  } else if (category === 'wood') {
    textureType = 'wood';
  } else if (category === 'fabric') {
    textureType = 'fabric';
  } else if (category === 'paintSignage') {
    textureType = 'signage';
  } else if (category === 'neonEmissive') {
    textureType = 'neon';
  } else if (category === 'asphaltStone') {
    textureType = eraYear === 1945 ? 'cobblestone' : 'asphalt';
  } else if (category === 'grimeSoil') {
    textureType = 'grime';
  }

  const map = createProceduralTexture(textureType, {
    primaryColor: swatch.color,
    weathering: swatch.grime * palette.defaultWeathering,
    seed: overrides.seed ?? eraYear,
    repeatX: overrides.repeatX ?? 1,
    repeatY: overrides.repeatY ?? 1,
  });

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(swatch.color),
    map,
    roughness: overrides.roughness ?? swatch.roughness,
    metalness: overrides.metalness ?? swatch.metalness,
    wireframe: overrides.wireframe ?? false,
    transparent: overrides.transparent ?? (category === 'glass' || category === 'grimeSoil'),
    opacity: overrides.opacity ?? (category === 'glass' ? 0.85 : 1.0),
  });

  if (swatch.emissive) {
    mat.emissive = new THREE.Color(swatch.emissive);
    mat.emissiveIntensity = swatch.emissiveIntensity ?? 1.0;
  }

  return mat;
}

// ---------------------------------------------------------------------------
// Consolidated ProceduralGfxLibrary Root Export
// ---------------------------------------------------------------------------

export const ProceduralGfxLibrary = {
  // Palettes
  ERA_YEARS,
  ERA_PALETTES,
  getEraPalette,
  getMaterialSwatch,

  // Textures
  createPRNG,
  parseColor,
  createSafeCanvas,
  createCanvasTexture,
  createProceduralTexture,
  generateBrickTextureSpec,
  generateStoneTextureSpec,
  generateStuccoTextureSpec,
  generateSidingTextureSpec,
  generateAsphaltTextureSpec,
  generateCobblestoneTextureSpec,
  generateConcreteTextureSpec,
  generateWoodTextureSpec,
  generateMetalTextureSpec,
  generateFabricTextureSpec,
  generateWindowAtlasSpec,
  generateSignageTextureSpec,
  generateNeonTextureSpec,
  generateGrimeOverlaySpec,

  // Materials
  createEraMaterial,
  clearMaterialCache,

  // Geometry Builders
  mergeBufferGeometries: GeometryBuilders.mergeBufferGeometries,
  createBeveledBoxGeometry: GeometryBuilders.createBeveledBoxGeometry,
  createWindowGridGeometry: GeometryBuilders.createWindowGridGeometry,
  createCorniceGeometry: GeometryBuilders.createCorniceGeometry,
  createLintelGeometry: GeometryBuilders.createLintelGeometry,
  createFireEscapeGeometry: GeometryBuilders.createFireEscapeGeometry,
  createBalconyGeometry: GeometryBuilders.createBalconyGeometry,
  createDoorGeometry: GeometryBuilders.createDoorGeometry,
  createRoofAccessoryGeometry: GeometryBuilders.createRoofAccessoryGeometry,

  // Instancing Helpers
  composeInstanceMatrix: InstancingHelpers.composeInstanceMatrix,
  createInstancedMesh: InstancingHelpers.createInstancedMesh,
  setInstanceTransform: InstancingHelpers.setInstanceTransform,
  setInstanceColor: InstancingHelpers.setInstanceColor,
  batchSetTransforms: InstancingHelpers.batchSetTransforms,
  batchSetColors: InstancingHelpers.batchSetColors,
  createWindowInstancedMesh: InstancingHelpers.createWindowInstancedMesh,
  createBrickInstancedMesh: InstancingHelpers.createBrickInstancedMesh,
  createCrowdInstancedMesh: InstancingHelpers.createCrowdInstancedMesh,
  populateInstancedGrid: InstancingHelpers.populateInstancedGrid,
};

export default ProceduralGfxLibrary;
