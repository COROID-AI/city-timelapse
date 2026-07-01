/**
 * Procedural era textures.
 *
 * Every visible surface in the city timelapse is painted from a canvas texture
 * generated here — no external image assets are used. `createEraTextures(era)`
 * builds a full surface set (sky, ground, facade, road, sidewalk, lane marking
 * and crosswalk) whose colors are derived from the era's palette record, so a
 * single call yields a coherent, era-appropriate look.
 *
 * Each texture is a `THREE.CanvasTexture` (a subclass of `THREE.Texture`) and
 * therefore `dispose()`s cleanly to free its GPU memory when an era is torn down.
 *
 * The era palette may be supplied explicitly (matching the `EraContent.palette`
 * contract from `src/eras/types.ts`) or omitted, in which case the built-in
 * per-era palettes below are used. This keeps the module self-contained even
 * before the era dataset module is wired in.
 */

import * as THREE from 'three';
import type { Era } from '../eras/types';

/**
 * Color palette driving every generated surface for an era. Mirrors the
 * `EraContent.palette` shape so an era record can be passed straight through.
 * All entries are CSS color strings (hex or otherwise).
 */
export interface EraTexturePalette {
  /** Sky / horizon color. */
  sky: string;
  /** Ground (grass / lot / earth) color. */
  ground: string;
  /** Road asphalt base color. */
  road: string;
  /** Accent color used for trim, signage frames and window glows. */
  accent: string;
}

/**
 * The full surface set produced for one era. Each entry is an independent
 * `CanvasTexture` that the caller owns and must `dispose()` when done.
 */
export interface EraTextures {
  /** Vertical sky gradient with a soft horizon band. */
  sky: THREE.CanvasTexture;
  /** Tileable ground (grass / lot / earth) with era-appropriate detailing. */
  ground: THREE.CanvasTexture;
  /** Building facade with windows, doors and era trim. */
  facade: THREE.CanvasTexture;
  /** Weathered, tileable asphalt road surface. */
  road: THREE.CanvasTexture;
  /** Concrete sidewalk slab with seams and aging. */
  sidewalk: THREE.CanvasTexture;
  /** Tileable lane marking (dashed center line). */
  laneMarking: THREE.CanvasTexture;
  /** Crosswalk (zebra) stripe pattern. */
  crosswalk: THREE.CanvasTexture;
}

/**
 * Input to `createEraTextures`. Accepts either a bare era key (uses built-in
 * palettes) or a full record carrying an explicit palette.
 */
export type EraTextureInput =
  | Era
  | ({ era: Era } & Partial<EraTexturePalette>)
  | (Partial<EraTexturePalette> & { era?: Era });

// ---------------------------------------------------------------------------
// Built-in era palettes
// ---------------------------------------------------------------------------

/**
 * Default per-era palettes. These are hand-tuned, era-evocative colors so the
 * textures read correctly even when no explicit palette is supplied. Earlier
 * eras lean warm/sepia; later eras cool toward glass-and-steel neutrality.
 */
const DEFAULT_PALETTES: Record<Era, EraTexturePalette> = {
  1945: { sky: '#c9b79a', ground: '#6b6a4a', road: '#3a3530', accent: '#8a5a2a' },
  1965: { sky: '#a7c4d6', ground: '#746e4e', road: '#34302c', accent: '#b5651d' },
  1985: { sky: '#8fa9bf', ground: '#67684e', road: '#2e2b28', accent: '#3a6b8a' },
  2005: { sky: '#9fb8c8', ground: '#5f6650', road: '#2a2725', accent: '#4a6a8a' },
  2025: { sky: '#b6c6d2', ground: '#586055', road: '#262423', accent: '#2a7a8a' },
};

/**
 * Per-era facade tuning: base wall color, window pane tint and mullion color.
 * Drives the facade texture so each era has a distinct architectural feel
 * (warm brick mid-century -> reflective glass towers today).
 */
const FACADE_PARAMS: Record<Era, { wall: string; pane: string; mullion: string; rows: number; cols: number }> = {
  1945: { wall: '#8a7060', pane: '#3a4a5a', mullion: '#4a3a2a', rows: 4, cols: 3 },
  1965: { wall: '#9a8a72', pane: '#4a5a6a', mullion: '#5a4a3a', rows: 6, cols: 4 },
  1985: { wall: '#8a8a82', pane: '#3a5a7a', mullion: '#3a3a3a', rows: 8, cols: 5 },
  2005: { wall: '#7a7a78', pane: '#4a7a9a', mullion: '#4a4a4a', rows: 10, cols: 6 },
  2025: { wall: '#6a7078', pane: '#5a9aaa', mullion: '#5a606a', rows: 14, cols: 7 },
};

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the palette for an input. Built-in defaults are merged with any
 * explicit overrides so callers can tweak a single channel.
 */
function resolvePalette(input: EraTextureInput): { era: Era; palette: EraTexturePalette } {
  if (typeof input === 'number') {
    return { era: input, palette: { ...DEFAULT_PALETTES[input] } };
  }
  const era = (input.era ?? 1985) as Era;
  return { era, palette: { ...DEFAULT_PALETTES[era], ...input } };
}

/** Creates a fresh canvas element of the given pixel size. */
function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Wraps a drawn canvas as a configured `CanvasTexture`: sRGB color space,
 * mipmap-friendly and flagged for a GPU update. `repeat` controls tiling across
 * the surface (set to {1,1} for non-tiling textures like the sky).
 */
function toTexture(
  canvas: HTMLCanvasElement,
  repeat: { x: number; y: number } = { x: 1, y: 1 },
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat.x, repeat.y);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Tiny deterministic PRNG (mulberry32) so texture noise is reproducible per era
 * seed rather than flickering between regenerations.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converts a hex color (`#rrggbb`) to an `{r,g,b}` triple in [0,255]. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

/** Linearly interpolates between two hex colors, returning a `rgb()` string. */
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Darkens a hex color by `amount` in [0,1] (0 = unchanged, 1 = black). */
function darken(hex: string, amount: number): string {
  return mixHex(hex, '#000000', amount);
}

/** Lightens a hex color by `amount` in [0,1] (0 = unchanged, 1 = white). */
function lighten(hex: string, amount: number): string {
  return mixHex(hex, '#ffffff', amount);
}

// ---------------------------------------------------------------------------
// Surface painters
// ---------------------------------------------------------------------------

/**
 * Paints a vertical sky gradient: a deeper zenith at the top fading to a soft,
 * hazy horizon band near the bottom. A few faint clouds are dabbed in with
 * translucent white for atmosphere. Non-tiling (single vertical strip).
 */
function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, palette: EraTexturePalette): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, darken(palette.sky, 0.28));
  grad.addColorStop(0.55, palette.sky);
  grad.addColorStop(0.85, lighten(palette.sky, 0.2));
  grad.addColorStop(1, lighten(palette.sky, 0.35));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft, deterministic cloud dabs.
  const rng = mulberry32(99);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 10; i++) {
    const cx = rng() * w;
    const cy = h * (0.2 + rng() * 0.5);
    const cw = w * (0.12 + rng() * 0.2);
    const ch = h * (0.02 + rng() * 0.03);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Paints a tileable ground surface. The base is the era ground color, mottled
 * with deterministic light/dark splotches for grass or bare-earth texture, plus
 * a faint grid of era tiling (garden plots / paving) that repeats seamlessly.
 */
function paintGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: EraTexturePalette,
  seed: number,
): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  // Mottling: many small translucent blotches for organic variation.
  for (let i = 0; i < 1800; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 1 + rng() * 3;
    const shade = rng();
    ctx.fillStyle = shade > 0.5
      ? `rgba(255,255,255,${(shade - 0.5) * 0.16})`
      : `rgba(0,0,0,${(0.5 - shade) * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint tile grid (seamless: drawn so edges meet when repeated).
  const tile = Math.max(16, Math.floor(w / 8));
  ctx.strokeStyle = darken(palette.ground, 0.35);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let x = 0; x <= w; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Paints a building facade: era wall color with a regular grid of windows
 * (panes + mullions), a ground-floor door and accent trim along the roofline.
 * The window grid density and glass tint evolve with the era.
 */
function paintFacade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: EraTexturePalette,
  era: Era,
): void {
  const params = FACADE_PARAMS[era];

  // Wall base with a subtle vertical gradient (top slightly lit, base shaded).
  const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
  wallGrad.addColorStop(0, lighten(params.wall, 0.08));
  wallGrad.addColorStop(1, darken(params.wall, 0.12));
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, h);

  // Roofline accent band.
  const bandH = Math.max(4, Math.floor(h * 0.03));
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, w, bandH);
  ctx.globalAlpha = 1;

  // Window grid.
  const rows = params.rows;
  const cols = params.cols;
  const margin = Math.floor(w * 0.06);
  const usableW = w - margin * 2;
  const usableH = h - bandH - margin;
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const winW = cellW * 0.62;
  const winH = cellH * 0.66;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = margin + c * cellW + (cellW - winW) / 2;
      // Leave a door gap on the ground floor, center column.
      const isDoor = r === rows - 1 && c === Math.floor(cols / 2);
      const cy = bandH + margin + r * cellH + (cellH - winH) / 2;

      if (isDoor) {
        // Door slab with a slightly darker frame.
        ctx.fillStyle = darken(params.mullion, 0.2);
        ctx.fillRect(cx - 2, cy - 2, winW + 4, winH + 4);
        ctx.fillStyle = darken(palette.accent, 0.1);
        ctx.fillRect(cx, cy, winW, winH);
        continue;
      }

      // Mullion frame.
      ctx.fillStyle = params.mullion;
      ctx.fillRect(cx - 2, cy - 2, winW + 4, winH + 4);
      // Glass pane with a soft vertical gradient (reflection top -> tint base).
      const paneGrad = ctx.createLinearGradient(0, cy, 0, cy + winH);
      paneGrad.addColorStop(0, lighten(params.pane, 0.25));
      paneGrad.addColorStop(1, params.pane);
      ctx.fillStyle = paneGrad;
      ctx.fillRect(cx, cy, winW, winH);
      // Central mullion cross.
      ctx.fillStyle = params.mullion;
      ctx.fillRect(cx + winW / 2 - 1, cy, 2, winH);
      ctx.fillRect(cx, cy + winH / 2 - 1, winW, 2);
    }
  }
}

/**
 * Paints weathered, tileable asphalt. Base road color with fine gravel noise,
 * scattered cracks and subtle oil stains so the surface reads as worn rather
 * than flat. Tileable horizontally and vertically.
 */
function paintRoad(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: EraTexturePalette,
  seed: number,
): void {
  ctx.fillStyle = palette.road;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  // Fine gravel speckle.
  for (let i = 0; i < 6000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const shade = rng();
    ctx.fillStyle = shade > 0.5
      ? `rgba(255,255,255,${(shade - 0.5) * 0.08})`
      : `rgba(0,0,0,${(0.5 - shade) * 0.18})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // A few scattered cracks (jagged polylines).
  ctx.strokeStyle = darken(palette.road, 0.55);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rng() * w;
    let y = rng() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Faint oil stains.
  for (let i = 0; i < 8; i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = 6 + rng() * 18;
    const stain = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    stain.addColorStop(0, 'rgba(0,0,0,0.28)');
    stain.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Paints a concrete sidewalk: light slab base with expansion-joint seams forming
 * a regular grid, plus subtle dirt build-up along the seams. Tileable.
 */
function paintSidewalk(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: EraTexturePalette,
  seed: number,
): void {
  const base = lighten(palette.ground, 0.55);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  // Fine concrete speckle.
  for (let i = 0; i < 3000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const shade = rng();
    ctx.fillStyle = shade > 0.5
      ? `rgba(255,255,255,${(shade - 0.5) * 0.1})`
      : `rgba(0,0,0,${(0.5 - shade) * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Slab seams: seamless grid.
  const slab = Math.max(24, Math.floor(w / 4));
  ctx.strokeStyle = darken(base, 0.35);
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += slab) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += slab) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Dirt build-up along seams.
  ctx.fillStyle = 'rgba(60,50,35,0.25)';
  for (let x = 0; x <= w; x += slab) {
    for (let i = 0; i < 40; i++) {
      const yy = rng() * h;
      ctx.fillRect(x - 1 + (rng() - 0.5) * 3, yy, 1, 1);
    }
  }
}

/**
 * Paints a tileable dashed lane marking: a row of bright markings centered on a
 * transparent (alpha 0) strip so only the paint shows when layered over the
 * road. The dash/gap ratio matches typical center-line geometry.
 */
function paintLaneMarking(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const lineW = Math.max(3, Math.floor(w * 0.04));
  const dashH = h * 0.32;
  const gapH = h * 0.32;
  const cx = w / 2;
  ctx.fillStyle = '#f4f0dc';
  for (let y = 0; y < h; y += dashH + gapH) {
    ctx.fillRect(cx - lineW / 2, y, lineW, dashH);
  }
}

/**
 * Paints a crosswalk (zebra) stripe pattern on a transparent strip. Bars run
 * vertically across the texture; the bar/gap ratio produces the classic
 * pedestrian crossing look. Transparent background layers cleanly over road.
 */
function paintCrosswalk(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const barW = w * 0.16;
  const gapW = w * 0.12;
  ctx.fillStyle = '#eae6d2';
  let x = 0;
  while (x < w) {
    ctx.fillRect(x, 0, barW, h);
    x += barW + gapW;
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Builds the full era surface set as procedural canvas textures.
 *
 * @param input  An era key (`1945 | 1965 | 1985 | 2005 | 2025`) or a record with
 *               an `era` and optional palette overrides. When overrides are
 *               omitted, built-in era-appropriate palettes are used.
 * @returns The `EraTextures` set. The caller owns each texture and must call
 *          `.dispose()` on them (e.g. via `disposeEraTextures`) when the era is
 *          torn down to free GPU memory.
 */
export function createEraTextures(input: EraTextureInput): EraTextures {
  const { era, palette } = resolvePalette(input);
  // Deterministic per-era seed so a given era always paints the same noise.
  const seed = era * 7919 + 13;

  // --- sky (non-tiling vertical strip) ---
  const skyCanvas = makeCanvas(256, 1024);
  paintSky(skyCanvas.getContext('2d')!, skyCanvas.width, skyCanvas.height, palette);
  const sky = toTexture(skyCanvas, { x: 1, y: 1 });

  // --- ground (tileable) ---
  const groundCanvas = makeCanvas(512, 512);
  paintGround(groundCanvas.getContext('2d')!, groundCanvas.width, groundCanvas.height, palette, seed);
  const ground = toTexture(groundCanvas, { x: 8, y: 8 });

  // --- facade (single vertical panel, non-tiling vertically) ---
  const facadeCanvas = makeCanvas(512, 1024);
  paintFacade(facadeCanvas.getContext('2d')!, facadeCanvas.width, facadeCanvas.height, palette, era);
  const facade = toTexture(facadeCanvas, { x: 1, y: 1 });

  // --- road (tileable asphalt) ---
  const roadCanvas = makeCanvas(512, 512);
  paintRoad(roadCanvas.getContext('2d')!, roadCanvas.width, roadCanvas.height, palette, seed + 1);
  const road = toTexture(roadCanvas, { x: 4, y: 4 });

  // --- sidewalk (tileable concrete) ---
  const sidewalkCanvas = makeCanvas(512, 512);
  paintSidewalk(sidewalkCanvas.getContext('2d')!, sidewalkCanvas.width, sidewalkCanvas.height, palette, seed + 2);
  const sidewalk = toTexture(sidewalkCanvas, { x: 4, y: 4 });

  // --- lane marking (tileable dashed line on transparent strip) ---
  const laneCanvas = makeCanvas(128, 512);
  paintLaneMarking(laneCanvas.getContext('2d')!, laneCanvas.width, laneCanvas.height);
  const laneMarking = toTexture(laneCanvas, { x: 1, y: 8 });

  // --- crosswalk (zebra stripes on transparent strip) ---
  const crosswalkCanvas = makeCanvas(512, 256);
  paintCrosswalk(crosswalkCanvas.getContext('2d')!, crosswalkCanvas.width, crosswalkCanvas.height);
  const crosswalk = toTexture(crosswalkCanvas, { x: 1, y: 1 });

  return { sky, ground, facade, road, sidewalk, laneMarking, crosswalk };
}

/**
 * Disposes every texture in an `EraTextures` set. Safe to call on an already-
 * disposed set (each `dispose()` is idempotent). Use this when tearing down an
 * era to avoid GPU memory leaks.
 */
export function disposeEraTextures(textures: EraTextures): void {
  textures.sky.dispose();
  textures.ground.dispose();
  textures.facade.dispose();
  textures.road.dispose();
  textures.sidewalk.dispose();
  textures.laneMarking.dispose();
  textures.crosswalk.dispose();
}
