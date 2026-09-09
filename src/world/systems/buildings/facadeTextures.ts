/**
 * Procedural canvas textures for building facades and roof props.
 *
 * Every texture is generated at runtime on offscreen `<canvas>` elements and
 * applied through THREE `CanvasTexture`s — there are **no binary assets**.
 * All painters are deterministic for a given material seed and the declared
 * era data. Textures are authored in **linear**-ish values but returned as
 * sRGB canvases; the golden-hour grading convention is respected by keeping
 * facade value ranges close to the material colors so the atmosphere system's
 * key light reads them correctly (dark sooty brick stays in the 30-55 L range,
 * mid-century pastels ~65-85, brutalist concrete ~55-70, 2000s glass ~50-75,
 * 2025 glass ~40-70).
 */

import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import type { BuildingsEraData } from './buildingEraData';
import { hexToRgb } from '../../../era/transition';

/** Pixels per layout meter for procedural textures. */
export const TEXTURE_RESOLUTION = 12;

/** Alias so consumers can type procedural texture handles without THREE. */
export type ProceduralTexture = Texture;

/** Deterministic mulberry32 PRNG seeded from a string. */
export function createSeedRng(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(widthPx: number, heightPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
}

function hexToRgb01(hex: string): [number, number, number] {
  const c = hexToRgb(hex);
  return [c.r / 255, c.g / 255, c.b / 255];
}

/** Vernier: scale an 0-1 channel value by a factor, clamped to [0,1]. */
function scaleChannel(v: number, factor: number): number {
  return Math.max(0, Math.min(1, v * factor));
}

/**
 * Picks one palette color heredity-stable for a seed; darker palettes show
 * less luminance variance so they read as "soot" rather than noise.
 */
function pickPaletteColor(era: BuildingsEraData, rng: () => number, jitter = 0.12): string {
  const palette = era.spec.facadePalette;
  const base = palette[Math.floor(rng() * palette.length)];
  if (jitter <= 0) return base;
  const [r, g, b] = hexToRgb01(base);
  const f = 1 + (rng() - 0.5) * jitter;
  return `rgb(${Math.round(scaleChannel(r, f) * 255)}, ${Math.round(scaleChannel(g, f) * 255)}, ${Math.round(scaleChannel(b, f) * 255)})`;
}

/** Full-bleed vertical gradient plus per-band brick/panel modulation. */
function fillGradient(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  era: BuildingsEraData,
  seed: string,
): void {
  const rng = createSeedRng(`${seed}:grad`);
  const top = pickPaletteColor(era, rng, 0.1);
  const bottom = pickPaletteColor(era, rng, 0.08);
  const gradient = ctx.createLinearGradient(0, 0, 0, hPx);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, wPx, hPx);

  // Weathering grime streaks + fine noise that keep the facade from being flat.
  const band = Math.max(6, hPx / 14);
  ctx.fillStyle = 'rgba(25, 20, 15, 0.06)';
  for (let y = 0; y < hPx; y += band) {
    if (rng() < era.weathering * 0.35) {
      const gx = rng() * wPx;
      const gw = Math.max(2, wPx * 0.04 * rng());
      ctx.fillRect(gx, y, gw, band * (0.4 + rng() * 0.8));
    }
  }
}

/**
 * Raster window grid for brick/tenement facades (1945): punched windows with
 * mullions and an art-deco sill line, drawn as dark recesses so the actual
 * emissive window geometry floats in front of them.
 */
export function paintRasterWindows(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  columns: number,
  rows: number,
  frameColor: string,
  seed: string,
): void {
  const rng = createSeedRng(`${seed}:win`);
  const marginX = Math.max(4, Math.round(wPx * 0.035));
  const marginY = Math.max(4, Math.round(hPx * 0.03));
  const cellW = (wPx - marginX * 2) / columns;
  const cellH = (hPx - marginY * 2) / rows;
  // Frame band behind every window: draw one long horizontal beam per row.
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, wPx, marginY);
  for (let r = 0; r < rows; r += 1) {
    const y = marginY + r * cellH;
    ctx.fillRect(0, Math.round(y + cellH * 0.92), wPx, Math.round(cellH * 0.08) + 1);
    for (let c = 0; c < columns; c += 1) {
      const x = marginX + c * cellW;
      const lit = rng() < 0.55; // interior glow visible even by day in older eras
      ctx.fillStyle = lit ? 'rgba(255, 240, 180, 0.5)' : 'rgba(28, 24, 20, 0.85)';
      ctx.fillRect(
        Math.round(x + cellW * 0.14),
        Math.round(y + cellH * 0.1),
        Math.max(2, Math.round(cellW * 0.72)),
        Math.max(2, Math.round(cellH * 0.82)),
      );
      // mullions
      ctx.fillStyle = 'rgba(28, 24, 20, 0.6)';
      ctx.fillRect(
        Math.round(x + cellW * 0.5),
        Math.round(y + cellH * 0.1),
        Math.max(1, Math.round(cellW * 0.05)),
        Math.max(2, Math.round(cellH * 0.82)),
      );
    }
  }
}

/**
 * Curtain-wall texture (1965/1985/2005/2025): continuous horizontal glass
 * bands with vertical mullions; the emissive window geometry uses the same
 * band layout so glow aligns with the glass.
 */
export function paintCurtainWindows(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  columns: number,
  rows: number,
  frameColor: string,
  seed: string,
  mullionDepth = 0.055,
): void {
  const rng = createSeedRng(`${seed}:curtain`);
  const marginX = Math.max(2, Math.round(wPx * 0.02));
  const marginY = Math.max(2, Math.round(hPx * 0.015));
  const cellW = (wPx - marginX * 2) / columns;
  const cellH = (hPx - marginY * 2) / rows;
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, wPx, marginY);
  for (let r = 0; r < rows; r += 1) {
    const y = marginY + r * cellH;
    ctx.fillRect(0, Math.round(y + cellH * 0.93), wPx, Math.round(cellH * 0.07) + 1);
    for (let c = 0; c < columns; c += 1) {
      const x = marginX + c * cellW;
      const cool = rng() < 0.3;
      ctx.fillStyle = cool
        ? 'rgba(190, 220, 245, 0.45)'
        : 'rgba(150, 175, 205, 0.4)';
      ctx.fillRect(
        Math.round(x + cellW * mullionDepth),
        Math.round(y + cellH * 0.08),
        Math.max(2, Math.round(cellW * (1 - mullionDepth * 2))),
        Math.max(2, Math.round(cellH * 0.84)),
      );
      // vertical mullion
      ctx.fillStyle = 'rgba(28, 28, 32, 0.55)';
      ctx.fillRect(
        Math.round(x + cellW * 0.5),
        Math.round(y + cellH * 0.08),
        Math.max(1, Math.round(cellW * mullionDepth)),
        Math.max(2, Math.round(cellH * 0.84)),
      );
    }
  }
}

/** Balcony slab texture (2005+): horizontal railed strips per story. */
export function paintBalconies(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  rows: number,
  seed: string,
): void {
  const rng = createSeedRng(`${seed}:balc`);
  const marginY = Math.max(2, Math.round(hPx * 0.02));
  const cellH = (hPx - marginY * 2) / rows;
  for (let r = 0; r < rows; r += 1) {
    const y = marginY + r * cellH;
    const bH = Math.max(2, Math.round(cellH * 0.2));
    if (rng() < 0.25) continue; // some stories have recessed balconies
    ctx.fillStyle = 'rgba(60, 66, 74, 0.8)';
    ctx.fillRect(0, Math.round(y + cellH * 0.78), wPx, bH);
    ctx.fillStyle = 'rgba(200, 204, 210, 0.35)';
    ctx.fillRect(0, Math.round(y + cellH * 0.78), wPx, Math.max(1, bH / 4));
  }
}

/**
 * Mirror-glass sheen (1985): strong specular diagonal bands over the curtain
 * grid so the facade reads as mirrored rather than plain glass.
 */
export function paintMirrorSheen(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  seed: string,
): void {
  const rng = createSeedRng(`${seed}:mirror`);
  const bands = 4 + Math.floor(rng() * 3);
  ctx.fillStyle = 'rgba(220, 230, 245, 0.10)';
  for (let i = 0; i < bands; i += 1) {
    const x0 = rng() * wPx;
    const y0 = i * (hPx / bands);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + wPx * 0.55, y0 + hPx * 0.3);
    ctx.lineTo(x0 + wPx * 0.2, y0 + hPx * 0.7);
    ctx.lineTo(x0 + wPx * 0.5, y0 + hPx);
    ctx.lineTo(x0 - wPx * 0.3, y0 + hPx);
    ctx.closePath();
    ctx.fill();
  }
}

/** Green-tint backlight for 2025 eco glass. */
export function paintGreenGlass(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  seed: string,
): void {
  const rng = createSeedRng(`${seed}:green`);
  const glows = 3 + Math.floor(rng() * 4);
  ctx.fillStyle = 'rgba(16, 60, 42, 0.10)';
  for (let i = 0; i < glows; i += 1) {
    const gx = rng() * wPx;
    const gy = rng() * hPx;
    const gr = Math.max(20, Math.min(wPx, hPx) * (0.35 + rng() * 0.5));
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, 'rgba(40, 120, 80, 0.5)');
    grad.addColorStop(1, 'rgba(40, 120, 80, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, wPx, hPx);
  }
}

/* ------------------------------------------------------------------ */
/* Public texture builders                                             */
/* ------------------------------------------------------------------ */

export interface FacadeTextureOptions {
  era: BuildingsEraData;
  columns: number;
  rows: number;
  widthMeters: number;
  heightMeters: number;
  seed: string;
  /** Used by the builder for balcony/mirror/green overlays. */
  kind: 'brick' | 'curtain' | 'curtain_mirror' | 'curtain_green';
}

/**
 * Builds the facade map texture for one face of a building. The returned
 * texture must be disposed by the owner together with the material.
 */
export function createFacadeTexture(options: FacadeTextureOptions): ProceduralTexture {
  const wPx = Math.max(4, Math.round(options.widthMeters * TEXTURE_RESOLUTION));
  const hPx = Math.max(4, Math.round(options.heightMeters * TEXTURE_RESOLUTION));
  const canvas = makeCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createFacadeTexture: 2D context unavailable');
  }

  fillGradient(ctx, wPx, hPx, options.era, options.seed);

  const frameColor = options.era.spec.frameColor;
  if (options.kind === 'brick') {
    paintRasterWindows(ctx, wPx, hPx, options.columns, options.rows, frameColor, options.seed);
  } else {
    paintCurtainWindows(ctx, wPx, hPx, options.columns, options.rows, frameColor, options.seed);
    if (options.kind === 'curtain_mirror') {
      paintMirrorSheen(ctx, wPx, hPx, options.seed);
    } else if (options.kind === 'curtain_green') {
      paintGreenGlass(ctx, wPx, hPx, options.seed);
    }
  }
  if (options.era.balconies) {
    paintBalconies(ctx, wPx, hPx, options.rows, options.seed);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Roof prop textures                                                  */
/* ------------------------------------------------------------------ */

export interface RoofTextureOptions {
  era: BuildingsEraData;
  widthMeters: number;
  depthMeters: number;
  seed: string;
}

/**
 * Procedural roof-deck texture: dark membrane with era prop silhouettes
 * (solar panel grid for 2025, faint AC boxes for the mid eras, plain tar
 * for 1945 where the water tower is a separate 3D prop).
 */
export function createRoofTexture(options: RoofTextureOptions): ProceduralTexture {
  const wPx = Math.max(4, Math.round(options.widthMeters * TEXTURE_RESOLUTION));
  const hPx = Math.max(4, Math.round(options.depthMeters * TEXTURE_RESOLUTION));
  const canvas = makeCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createRoofTexture: 2D context unavailable');
  }
  const rng = createSeedRng(`${options.seed}:roof`);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 0, wPx, hPx);
  // Membrane speckle
  const image = ctx.createImageData(wPx, hPx);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = 38 + Math.round((rng() - 0.5) * 22);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const prop = options.era.roofProp;
  if (prop === 'solar_panels') {
    // Solar array grid across the roof.
    const cols = Math.max(2, Math.floor(wPx / 8));
    const rowsR = Math.max(2, Math.floor(hPx / 8));
    const cw = wPx / cols;
    const ch = hPx / rowsR;
    for (let r = 0; r < rowsR; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (rng() < 0.12) continue; // gap between arrays
        ctx.fillStyle = rng() < 0.5 ? '#1b3a5c' : '#224a6e';
        ctx.fillRect(Math.round(c * cw + 1), Math.round(r * ch + 1), Math.max(2, Math.round(cw - 2)), Math.max(2, Math.round(ch - 2)));
        ctx.fillStyle = 'rgba(210, 220, 235, 0.5)';
        ctx.fillRect(Math.round(c * cw + 1), Math.round(r * ch + 1), Math.max(1, Math.round(cw / 2)), 1);
      }
    }
  } else if (prop === 'ac_units' || prop === 'antennas' || prop === 'satellite_dishes') {
    // Scattered dark mechanical boxes / dish shadows (3D props are separate).
    const units = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < units; i += 1) {
      const ux = rng() * (wPx - 6) + 3;
      const uy = rng() * (hPx - 6) + 3;
      const uw = 3 + rng() * 5;
      ctx.fillStyle = '#191919';
      ctx.fillRect(Math.round(ux), Math.round(uy), Math.round(uw), Math.round(uw * 0.6));
      ctx.fillStyle = 'rgba(220, 220, 220, 0.2)';
      ctx.fillRect(Math.round(ux + 1), Math.round(uy + 1), Math.round(uw * 0.5), 1);
    }
  } else if (prop === 'green_roof') {
    // Green roof membrane: mossy greens with path grid.
    ctx.fillStyle = '#3d5a30';
    ctx.fillRect(0, 0, wPx, hPx);
    const cells = 5;
    const cs = Math.min(wPx, hPx) / cells;
    for (let r = 0; r < cells; r += 1) {
      for (let c = 0; c < cells; c += 1) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#2f4a26';
          ctx.fillRect(Math.round(c * cs), Math.round(r * cs), Math.round(cs), Math.round(cs));
        }
      }
    }
  }
  // edge parapet shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, wPx, 3);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}