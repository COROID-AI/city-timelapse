/**
 * Procedural canvas-based textures for era-appropriate city visuals.
 *
 * All textures are generated at runtime using a 2D canvas — no external image
 * files are loaded. Each generator accepts an {@link EraSpec} (or its relevant
 * sub-data) and returns a `THREE.CanvasTexture` that can be applied to building
 * facades, road surfaces, sky domes, and signage.
 *
 * Textures are cached per-era by the {@link TextureCache} so that repeated
 * requests for the same era return the same GPU texture without re-painting
 * the canvas.
 */

import * as THREE from 'three';
import type {
  EraSpec,
  BuildingEraData,
  StorefrontEraData,
  AdvertisementEraData,
} from '../eras/types.js';
import { cacheKey, createRng, eraSeed } from './util.js';

// ---------------------------------------------------------------------------
// Texture resolution constants
// ---------------------------------------------------------------------------

const FACADE_W = 512;
const FACADE_H = 512;
const ASPHALT_SIZE = 512;
const SKY_W = 1024;
const SKY_H = 256;
const SIGN_W = 256;
const SIGN_H = 128;

// ---------------------------------------------------------------------------
// Texture cache
// ---------------------------------------------------------------------------

/**
 * Per-era texture cache. Textures are expensive to generate (canvas painting
 * + GPU upload) so they are memoised by `eraId:textureName`. The cache stores
 * `THREE.CanvasTexture` instances which are safe to share across meshes.
 */
export class TextureCache {
  private readonly store = new Map<string, THREE.CanvasTexture>();

  /** Get a cached texture by key, or `undefined`. */
  get(key: string): THREE.CanvasTexture | undefined {
    return this.store.get(key);
  }

  /** Store a texture under a key and return it for chaining. */
  set(key: string, tex: THREE.CanvasTexture): THREE.CanvasTexture {
    this.store.set(key, tex);
    return tex;
  }

  /** Whether a cached texture exists for the key. */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Dispose and remove all cached textures. Call on era cleanup. */
  dispose(): void {
    for (const tex of this.store.values()) {
      tex.dispose();
    }
    this.store.clear();
  }

  /** Dispose and remove a single cached texture. */
  disposeKey(key: string): void {
    const tex = this.store.get(key);
    if (tex) {
      tex.dispose();
      this.store.delete(key);
    }
  }
}

/** The shared, module-level texture cache. */
export const textureCache = new TextureCache();

// ---------------------------------------------------------------------------
// Canvas helper
// ---------------------------------------------------------------------------

/**
 * Create a 2D canvas of the given dimensions.
 * In a DOM environment this uses `document.createElement('canvas')`.
 */
function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context — WebGL/Canvas not available.');
  }
  return { canvas, ctx };
}

/** Convert a canvas to a configured `THREE.CanvasTexture`. */
function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Building facade textures
// ---------------------------------------------------------------------------

/**
 * Generate an era-appropriate building facade texture.
 *
 * The texture depicts a tiled wall with windows whose style, density, and
 * lighting match the decade:
 *
 * - **art-deco / steel-casement**: small grid windows, sooty warm wall
 * - **mid-century / ribbon**: horizontal ribbon windows, cleaner concrete
 * - **brutalist / punched**: sparse punched openings, raw concrete
 * - **postmodern / curtain-wall**: blue-glass curtain wall grid
 * - **contemporary / floor-to-ceiling**: large glass panels, green tints
 *
 * @param era  The era spec (uses `era.buildings`).
 * @returns A cached `THREE.CanvasTexture` for facade materials.
 */
export function getFacadeTexture(era: EraSpec): THREE.CanvasTexture {
  const key = cacheKey(era.id, 'facade');
  const cached = textureCache.get(key);
  if (cached) return cached;

  const b = era.buildings;
  const rng = createRng(eraSeed(era, 'facade'));
  const { canvas, ctx } = createCanvas(FACADE_W, FACADE_H);

  // --- Wall base ---
  const wallColor = b.palette[Math.floor(rng() * b.palette.length)] ?? '#8b8378';
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, FACADE_W, FACADE_H);

  // Apply grime overlay
  if (b.grime > 0) {
    ctx.fillStyle = `rgba(40,35,30,${b.grime * 0.35})`;
    ctx.fillRect(0, 0, FACADE_W, FACADE_H);
  }

  drawWindows(ctx, b, rng);
  drawArchitecturalDetails(ctx, b, rng);

  return textureCache.set(key, toTexture(canvas));
}

/** Draw the fenestration pattern for a building facade. */
function drawWindows(
  ctx: CanvasRenderingContext2D,
  b: BuildingEraData,
  rng: () => number,
): void {
  const w = FACADE_W;
  const h = FACADE_H;

  // Window lit/unlit colours
  const litColor = b.style === 'brutalist' ? '#4a4035' : '#ffe9a8';
  const unlitColor = b.style === 'postmodern' || b.style === 'contemporary' ? '#2a3a4a' : '#2b2b2b';

  switch (b.windowStyle) {
    case 'steel-casement': {
      // Small grid of casement windows
      const cols = 8;
      const rows = 10;
      const padX = 18;
      const padY = 14;
      const cw = (w - padX * (cols + 1)) / cols;
      const ch = (h - padY * (rows + 1)) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = padX + c * (cw + padX);
          const y = padY + r * (ch + padY);
          ctx.fillStyle = rng() > 0.6 ? litColor : unlitColor;
          ctx.fillRect(x, y, cw, ch);
          // Window frame cross
          ctx.strokeStyle = 'rgba(20,20,20,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + cw / 2, y);
          ctx.lineTo(x + cw / 2, y + ch);
          ctx.moveTo(x, y + ch / 2);
          ctx.lineTo(x + cw, y + ch / 2);
          ctx.stroke();
        }
      }
      break;
    }
    case 'ribbon': {
      // Horizontal ribbon windows
      const bands = 12;
      const bh = h / bands;
      const ribbonH = bh * 0.45;
      for (let r = 0; r < bands; r++) {
        const y = r * bh + (bh - ribbonH) / 2;
        ctx.fillStyle = rng() > 0.5 ? litColor : unlitColor;
        ctx.fillRect(10, y, w - 20, ribbonH);
        // Mullions
        ctx.strokeStyle = wallMullion(b);
        ctx.lineWidth = 2;
        for (let mx = 60; mx < w - 10; mx += 60) {
          ctx.beginPath();
          ctx.moveTo(mx, y);
          ctx.lineTo(mx, y + ribbonH);
          ctx.stroke();
        }
      }
      break;
    }
    case 'punched': {
      // Sparse rectangular openings in concrete
      const cols = 5;
      const rows = 7;
      const cw = 50;
      const ch = 65;
      const gapX = (w - cols * cw) / (cols + 1);
      const gapY = (h - rows * ch) / (rows + 1);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gapX + c * (cw + gapX);
          const y = gapY + r * (ch + gapY);
          ctx.fillStyle = rng() > 0.65 ? litColor : unlitColor;
          ctx.fillRect(x, y, cw, ch);
        }
      }
      break;
    }
    case 'curtain-wall': {
      // Blue-glass curtain wall grid
      const cellW = 40;
      const cellH = 50;
      for (let y = 0; y < h; y += cellH) {
        for (let x = 0; x < w; x += cellW) {
          const glassTint = rng() > 0.5 ? '#5a7a9a' : '#6a8aaa';
          ctx.fillStyle = glassTint;
          ctx.fillRect(x, y, cellW - 2, cellH - 2);
          // Reflection highlight
          if (rng() > 0.7) {
            ctx.fillStyle = 'rgba(200,220,240,0.25)';
            ctx.fillRect(x + 4, y + 4, cellW * 0.4, cellH * 0.3);
          }
        }
      }
      break;
    }
    case 'floor-to-ceiling': {
      // Large glass panels with green/blue tints
      const panelW = 120;
      const panelH = 100;
      for (let y = 0; y < h; y += panelH) {
        for (let x = 0; x < w; x += panelW) {
          const tint = rng() > 0.5 ? '#3a5f5a' : '#4a6a7a';
          ctx.fillStyle = tint;
          ctx.fillRect(x, y, panelW - 3, panelH - 3);
          // Subtle vertical reflection streak
          ctx.fillStyle = 'rgba(180,200,210,0.15)';
          ctx.fillRect(x + panelW * 0.3, y, 4, panelH - 3);
        }
      }
      break;
    }
  }
}

/** Return a mullion/frame colour appropriate to the building style. */
function wallMullion(b: BuildingEraData): string {
  switch (b.style) {
    case 'mid-century':
      return 'rgba(80,80,80,0.6)';
    case 'brutalist':
      return 'rgba(60,60,60,0.7)';
    case 'postmodern':
      return 'rgba(120,130,140,0.5)';
    case 'contemporary':
      return 'rgba(160,170,180,0.4)';
    default:
      return 'rgba(50,45,40,0.6)';
  }
}

/** Draw era-specific architectural details (cornices, neon strips, etc.). */
function drawArchitecturalDetails(
  ctx: CanvasRenderingContext2D,
  b: BuildingEraData,
  rng: () => number,
): void {
  const w = FACADE_W;

  // Art-deco: vertical fluting and decorative cornice
  if (b.style === 'art-deco') {
    ctx.strokeStyle = 'rgba(30,25,20,0.3)';
    ctx.lineWidth = 2;
    for (let x = 32; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FACADE_H);
      ctx.stroke();
    }
    // Cornice band at top
    ctx.fillStyle = 'rgba(50,45,38,0.6)';
    ctx.fillRect(0, 0, w, 20);
  }

  // Mid-century: setback banding
  if (b.style === 'mid-century') {
    ctx.fillStyle = 'rgba(200,195,180,0.2)';
    ctx.fillRect(0, FACADE_H / 3, w, 6);
    ctx.fillRect(0, (FACADE_H * 2) / 3, w, 6);
  }

  // Neon accent strips
  if (b.neonAccents && rng() > 0.5) {
    const neonColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff4500'];
    ctx.fillStyle = neonColors[Math.floor(rng() * neonColors.length)] ?? '#ff00ff';
    ctx.fillRect(0, FACADE_H - 30, w, 4);
    ctx.shadowColor = ctx.fillStyle as string;
    ctx.shadowBlur = 8;
    ctx.fillRect(0, FACADE_H - 30, w, 4);
    ctx.shadowBlur = 0;
  }

  // Contemporary: green roof hint at top
  if (b.roofline === 'green-roof') {
    ctx.fillStyle = '#3a5f3a';
    ctx.fillRect(0, 0, w, 15);
    // Foliage dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rng() > 0.5 ? '#4a7a4a' : '#2a4a2a';
      ctx.fillRect(rng() * w, rng() * 15, 4, 4);
    }
  }
}
// ---------------------------------------------------------------------------
// Asphalt / road texture
// ---------------------------------------------------------------------------

/**
 * Generate an era-appropriate road surface texture.
 *
 * Earlier eras have rougher, darker asphalt with visible aggregate and wear;
 * later eras feature smoother, lighter pavement with lane markings. The 2025
 * era adds faint bike-lane markings.
 *
 * @param era  The era spec.
 * @returns A cached `THREE.CanvasTexture` for road materials.
 */
export function getAsphaltTexture(era: EraSpec): THREE.CanvasTexture {
  const key = cacheKey(era.id, 'asphalt');
  const cached = textureCache.get(key);
  if (cached) return cached;

  const rng = createRng(eraSeed(era, 'asphalt'));
  const { canvas, ctx } = createCanvas(ASPHALT_SIZE, ASPHALT_SIZE);

  // Base colour darkens with age
  const baseShade = era.year >= 2005 ? '#3a3a3e' : era.year >= 1985 ? '#2e2e30' : '#262420';
  ctx.fillStyle = baseShade;
  ctx.fillRect(0, 0, ASPHALT_SIZE, ASPHALT_SIZE);

  // Aggregate noise
  const aggregateCount = era.year >= 2005 ? 2000 : 4000;
  for (let i = 0; i < aggregateCount; i++) {
    const x = rng() * ASPHALT_SIZE;
    const y = rng() * ASPHALT_SIZE;
    const s = rng() * 3 + 0.5;
    const v = Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${v + 30},${v + 28},${v + 25},${0.3 + rng() * 0.4})`;
    ctx.fillRect(x, y, s, s);
  }

  // Cracks for older eras
  if (era.year <= 1985) {
    ctx.strokeStyle = 'rgba(10,10,10,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(rng() * ASPHALT_SIZE, rng() * ASPHALT_SIZE);
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(rng() * ASPHALT_SIZE, rng() * ASPHALT_SIZE);
      }
      ctx.stroke();
    }
  }

  // Center lane marking (dashed yellow)
  ctx.fillStyle = era.year >= 2005 ? '#d4a017' : '#c8a020';
  const dashLen = 40;
  const dashGap = 30;
  for (let x = 0; x < ASPHALT_SIZE; x += dashLen + dashGap) {
    ctx.fillRect(x, ASPHALT_SIZE / 2 - 3, dashLen, 6);
  }

  // 2025: bike lane marking (solid green stripe on edge)
  if (era.year >= 2025) {
    ctx.fillStyle = '#2b6b4f';
    ctx.fillRect(0, ASPHALT_SIZE - 20, ASPHALT_SIZE, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, ASPHALT_SIZE - 14, ASPHALT_SIZE, 2);
  }

  return textureCache.set(key, toTexture(canvas));
}

// ---------------------------------------------------------------------------
// Sky texture
// ---------------------------------------------------------------------------

/**
 * Generate an era-appropriate sky gradient for the background dome.
 *
 * - **1945**: warm sepia haze from coal smoke.
 * - **1965**: clear optimistic blue.
 * - **1985**: slightly hazy smoggy blue.
 * - **2005**: bright clean blue.
 * - **2025**: crisp blue-green with a faint horizon glow.
 *
 * @param era  The era spec.
 * @returns A cached `THREE.CanvasTexture` for the sky dome.
 */
export function getSkyTexture(era: EraSpec): THREE.CanvasTexture {
  const key = cacheKey(era.id, 'sky');
  const cached = textureCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createCanvas(SKY_W, SKY_H);

  let topColor: string;
  let bottomColor: string;

  switch (era.id) {
    case '1945':
      topColor = '#6b6555';
      bottomColor = '#a89b82';
      break;
    case '1965':
      topColor = '#2b5d9e';
      bottomColor = '#8ec5e8';
      break;
    case '1985':
      topColor = '#4a6a8a';
      bottomColor = '#a0b8c8';
      break;
    case '2005':
      topColor = '#2a6dbf';
      bottomColor = '#9ed5f0';
      break;
    case '2025':
      topColor = '#1a5d8e';
      bottomColor = '#8ed8c8';
      break;
  }

  const grad = ctx.createLinearGradient(0, 0, 0, SKY_H);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SKY_W, SKY_H);

  // Add subtle clouds for non-smog eras
  if (era.year >= 1965) {
    const rng = createRng(eraSeed(era, 'sky'));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 8; i++) {
      const cx = rng() * SKY_W;
      const cy = rng() * SKY_H * 0.6;
      const cw = 80 + rng() * 120;
      const ch = 15 + rng() * 20;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2025: horizon glow
  if (era.year >= 2025) {
    const glow = ctx.createLinearGradient(0, SKY_H * 0.7, 0, SKY_H);
    glow.addColorStop(0, 'rgba(100,200,180,0)');
    glow.addColorStop(1, 'rgba(100,200,180,0.3)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, SKY_H * 0.7, SKY_W, SKY_H * 0.3);
  }

  const tex = toTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return textureCache.set(key, tex);
}

// ---------------------------------------------------------------------------
// Signage textures
// ---------------------------------------------------------------------------

/**
 * Generate an era-appropriate signage texture for storefronts and ads.
 *
 * The style (hand-painted, neon, backlit-box, led-strip, digital) controls
 * the rendering technique: flat paint, glowing neon tubes, illuminated boxes,
 * LED dot matrices, or digital screen gradients.
 *
 * @param era        The era spec.
 * @param text       Optional slogan text to render. Falls back to a shop type.
 * @param colorIndex Index into the palette array (deterministic colour pick).
 * @returns A cached `THREE.CanvasTexture` for sign materials.
 */
export function getSignageTexture(
  era: EraSpec,
  text?: string,
  colorIndex = 0,
): THREE.CanvasTexture {
  const sf = era.storefronts;
  const ad = era.advertisements;
  const label = text ?? sf.shopTypes[colorIndex % sf.shopTypes.length] ?? 'SHOP';
  const key = cacheKey(era.id, `sign:${label}:${colorIndex}`);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createCanvas(SIGN_W, SIGN_H);
  const rng = createRng(eraSeed(era, `sign:${label}:${colorIndex}`));

  const palette = [...sf.palette, ...ad.palette];
  const fg = palette[colorIndex % palette.length] ?? '#ff00ff';

  drawSignageByStyle(ctx, sf, ad, label, fg, rng);

  return textureCache.set(key, toTexture(canvas));
}

/** Render signage using the era's sign style. */
function drawSignageByStyle(
  ctx: CanvasRenderingContext2D,
  sf: StorefrontEraData,
  _ad: AdvertisementEraData,
  label: string,
  fg: string,
  rng: () => number,
): void {
  // Background depends on medium
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  switch (sf.signStyle) {
    case 'hand-painted': {
      // Wood/panel background with painted lettering
      ctx.fillStyle = '#3a3025';
      ctx.fillRect(0, 0, SIGN_W, SIGN_H);
      // Wood grain
      ctx.strokeStyle = 'rgba(20,15,10,0.2)';
      ctx.lineWidth = 1;
      for (let y = 5; y < SIGN_H; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y + rng() * 3);
        ctx.lineTo(SIGN_W, y + rng() * 3);
        ctx.stroke();
      }
      ctx.fillStyle = fg;
      ctx.font = 'bold 28px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      break;
    }
    case 'neon': {
      // Dark background with glowing neon tube text
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, SIGN_W, SIGN_H);
      ctx.shadowColor = fg;
      ctx.shadowBlur = 15;
      ctx.fillStyle = fg;
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      // Second pass for brighter core
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      ctx.shadowBlur = 0;
      break;
    }
    case 'backlit-box': {
      // Translucent illuminated box
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, SIGN_W, SIGN_H);
      // Inner glow panel
      const grad = ctx.createLinearGradient(0, 0, 0, SIGN_H);
      grad.addColorStop(0, 'rgba(255,255,255,0.15)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = fg;
      ctx.fillRect(8, 8, SIGN_W - 16, SIGN_H - 16);
      ctx.fillStyle = grad;
      ctx.fillRect(8, 8, SIGN_W - 16, SIGN_H - 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      break;
    }
    case 'led-strip': {
      // Dark panel with LED dot-matrix text
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, SIGN_W, SIGN_H);
      // LED dot grid
      const dotR = 3;
      const stepX = 8;
      const stepY = 8;
      for (let y = 4; y < SIGN_H; y += stepY) {
        for (let x = 4; x < SIGN_W; x += stepX) {
          // Randomly light some LEDs as background scatter
          if (rng() > 0.92) {
            ctx.fillStyle = fg;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      ctx.fillStyle = fg;
      ctx.shadowColor = fg;
      ctx.shadowBlur = 8;
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      ctx.shadowBlur = 0;
      break;
    }
    case 'digital': {
      // Digital screen with gradient
      const grad = ctx.createLinearGradient(0, 0, SIGN_W, SIGN_H);
      grad.addColorStop(0, '#0a1a2a');
      grad.addColorStop(0.5, fg);
      grad.addColorStop(1, '#0a1a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIGN_W, SIGN_H);
      // Scan lines
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < SIGN_H; y += 3) {
        ctx.fillRect(0, y, SIGN_W, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), SIGN_W / 2, SIGN_H / 2);
      break;
    }
  }
}
// ---------------------------------------------------------------------------
// Billboard / advertisement textures
// ---------------------------------------------------------------------------

/**
 * Generate an era-appropriate billboard or wall advertisement texture.
 *
 * Uses the era's advertisement data (mediums, slogans, palette) to produce a
 * large-format ad image. The medium controls the visual treatment:
 *
 * - **billboard**: painted poster with bold text
 * - **painted-wall**: faded wall-painted ad
 * - **neon-sign**: dark field with glowing tube outline
 * - **backlit-box**: translucent panel with inner glow
 * - **lcd-screen**: digital screen with scan lines
 * - **holographic**: iridescent gradient with glitch artifacts
 * - **projection**: hazy projected light on a wall
 *
 * @param era        The era spec.
 * @param index      Index into the slogans array for deterministic copy.
 * @returns A cached `THREE.CanvasTexture` for ad materials.
 */
export function getBillboardTexture(era: EraSpec, index = 0): THREE.CanvasTexture {
  const ad = era.advertisements;
  const slogan = ad.slogans[index % ad.slogans.length] ?? 'AD';
  const key = cacheKey(era.id, `billboard:${slogan}:${index}`);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createCanvas(512, 256);
  const rng = createRng(eraSeed(era, `billboard:${slogan}:${index}`));
  const palette = ad.palette;
  const fg = palette[index % palette.length] ?? '#ff00ff';
  const bg = palette[(index + 1) % palette.length] ?? '#1a1a1a';

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 512, 256);

  switch (ad.mediums[index % ad.mediums.length] ?? 'billboard') {
    case 'billboard': {
      // Bold painted poster
      ctx.fillStyle = bg;
      ctx.fillRect(4, 4, 504, 248);
      ctx.fillStyle = fg;
      ctx.fillRect(20, 20, 472, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 170);
      // Decorative border
      ctx.strokeStyle = fg;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 504, 248);
      break;
    }
    case 'painted-wall': {
      // Faded wall ad
      ctx.fillStyle = '#5a5045';
      ctx.fillRect(0, 0, 512, 256);
      // Brick texture
      ctx.strokeStyle = 'rgba(40,35,30,0.3)';
      ctx.lineWidth = 1;
      for (let y = 0; y < 256; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
        const off = (y / 16) % 2 === 0 ? 0 : 32;
        for (let x = off; x < 512; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 16);
          ctx.stroke();
        }
      }
      // Faded painted text
      ctx.fillStyle = `rgba(${fg},${0.35})`;
      ctx.font = 'bold 32px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      break;
    }
    case 'neon-sign': {
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, 512, 256);
      ctx.shadowColor = fg;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 30, 452, 196);
      ctx.fillStyle = fg;
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      ctx.shadowBlur = 0;
      break;
    }
    case 'backlit-box': {
      ctx.fillStyle = fg;
      ctx.fillRect(8, 8, 496, 240);
      const grad = ctx.createRadialGradient(256, 128, 50, 256, 128, 300);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(8, 8, 496, 240);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      break;
    }
    case 'lcd-screen': {
      const grad = ctx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, '#0a1a2a');
      grad.addColorStop(0.5, fg);
      grad.addColorStop(1, '#0a1a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      // Scan lines
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < 256; y += 4) {
        ctx.fillRect(0, y, 512, 2);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      // Pixel artifacts
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.3})`;
        ctx.fillRect(rng() * 512, rng() * 256, 3, 3);
      }
      break;
    }
    case 'holographic': {
      // Iridescent gradient
      const grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, '#ff00ff');
      grad.addColorStop(0.33, '#00ffff');
      grad.addColorStop(0.66, '#ffff00');
      grad.addColorStop(1, '#ff00ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      // Glitch bands
      for (let i = 0; i < 8; i++) {
        const gy = rng() * 256;
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.3})`;
        ctx.fillRect(0, gy, 512, 2 + rng() * 6);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 100, 512, 56);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      break;
    }
    case 'projection': {
      // Hazy projected light on a dark wall
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, 512, 256);
      const grad = ctx.createRadialGradient(256, 128, 40, 256, 128, 260);
      grad.addColorStop(0, fg);
      grad.addColorStop(0.5, `${fg}80`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slogan.toUpperCase(), 256, 128);
      break;
    }
  }

  return textureCache.set(key, toTexture(canvas));
}

// ---------------------------------------------------------------------------
// Convenience: get all textures for an era at once
// ---------------------------------------------------------------------------

/**
 * Bundle of all procedural textures for a single era.
 * Returned by {@link getEraTextures}.
 */
export interface EraTextures {
  facade: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  sky: THREE.CanvasTexture;
  signs: THREE.CanvasTexture[];
  billboards: THREE.CanvasTexture[];
}

/**
 * Generate (or fetch from cache) the complete set of textures for an era.
 *
 * This is the main entry point used by the scene composition layer: it calls
 * each individual generator and returns a bundle so the caller doesn't need
 * to know the internal cache keys.
 *
 * @param era  The era spec.
 * @returns A bundle of cached textures for the era.
 */
export function getEraTextures(era: EraSpec): EraTextures {
  const signs: THREE.CanvasTexture[] = [];
  for (let i = 0; i < era.storefronts.shopTypes.length; i++) {
    signs.push(getSignageTexture(era, undefined, i));
  }

  const billboards: THREE.CanvasTexture[] = [];
  for (let i = 0; i < era.advertisements.slogans.length; i++) {
    billboards.push(getBillboardTexture(era, i));
  }

  return {
    facade: getFacadeTexture(era),
    asphalt: getAsphaltTexture(era),
    sky: getSkyTexture(era),
    signs,
    billboards,
  };
}

/**
 * Pre-generate textures for all eras. Useful at load time to avoid
 * frame hitches when the user first switches to each era.
 *
 * @param eras  The full era registry (from `getAllEras()`).
 */
export function pregenerateAllTextures(eras: readonly EraSpec[]): void {
  for (const era of eras) {
    getEraTextures(era);
  }
}
