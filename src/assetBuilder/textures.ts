/**
 * Procedural canvas-based texture generator.
 *
 * All textures (facades, signage, asphalt, sky) are drawn onto 2D canvases at
 * build time and wrapped in `THREE.CanvasTexture`. No external image files are
 * loaded — everything is synthesised so the scene boots instantly and every
 * era is self-contained. Textures are cached per (eraId + variant) key.
 */

import * as THREE from 'three';

import type { AssetSet, BuildingAssetData, WindowStyle } from './eras.js';
import type { EraId } from '../eras.js';

// ─────────────────────────────────────────────────────────────────────────────
// Texture cache
// ─────────────────────────────────────────────────────────────────────────────

/** Cache key: `${eraId}:${kind}:${variant}` */
function key(era: EraId, kind: string, variant: number | string = 0): string {
  return `${era}:${kind}:${variant}`;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Get-or-create a cached CanvasTexture. The factory receives a fresh 2D
 * canvas context already sized; it should paint the texture and return.
 */
function cached(
  cacheKey: string,
  width: number,
  height: number,
  factory: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  options: { repeat?: [number, number]; srgb?: boolean } = {},
): THREE.CanvasTexture {
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[textures] 2D canvas context unavailable');

  factory(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (options.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(options.repeat[0], options.repeat[1]);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  textureCache.set(cacheKey, tex);
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random from a numeric seed (mulberry32). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix two hex colors by t (0..1). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** Slightly darken a hex color. */
function darken(hex: string, amount: number): string {
  return mixHex(hex, '#000000', amount);
}

/** Slightly lighten a hex color. */
function lighten(hex: string, amount: number): string {
  return mixHex(hex, '#ffffff', amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Facade texture — the wall + windows of a building
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paint a facade texture for one building variant.
 * The texture maps onto a box whose U axis = width, V axis = height.
 */
export function getFacadeTexture(
  set: AssetSet,
  variant: number,
  stories: number,
  bays: number,
): THREE.CanvasTexture {
  const b = set.building;
  const ck = key(set.eraId, 'facade', variant);
  return cached(ck, 512, 512, (ctx, w, h) => {
    drawFacade(ctx, w, h, b, stories, bays, variant);
  }, { srgb: true });
}

function drawFacade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  b: BuildingAssetData,
  stories: number,
  bays: number,
  variant: number,
): void {
  const rng = makeRng(variant * 9973 + 42);

  // Base wall
  const baseColor = b.facadePalette[variant % b.facadePalette.length];
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  // Masonry texture
  if (b.masonry === 'brick') {
    drawBrick(ctx, w, h, baseColor, rng);
  } else if (b.masonry === 'concrete') {
    drawConcrete(ctx, w, h, baseColor, rng);
  } else if (b.masonry === 'composite') {
    drawComposite(ctx, w, h, baseColor, rng);
  }
  // steel-glass / curtain have minimal wall — windows dominate

  // Windows
  drawWindows(ctx, w, h, b, stories, bays, rng);

  // Accent trim — ground floor lintel + top cornice
  ctx.fillStyle = b.accentColor;
  ctx.fillRect(0, h - h / stories * 0.6, w, 3);
  ctx.fillRect(0, 2, w, 4);
}

function drawBrick(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  rng: () => number,
): void {
  const brickH = 14;
  const brickW = 32;
  for (let y = 0; y < h; y += brickH) {
    const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
    for (let x = -brickW; x < w + brickW; x += brickW) {
      const shade = rng() * 0.12 - 0.06;
      ctx.fillStyle = shade >= 0 ? lighten(base, shade) : darken(base, -shade);
      ctx.fillRect(x + offset, y, brickW - 1, brickH - 1);
    }
  }
}

function drawConcrete(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  rng: () => number,
): void {
  // Large panels with seams
  const panelH = 64;
  for (let y = 0; y < h; y += panelH) {
    const shade = rng() * 0.08 - 0.04;
    ctx.fillStyle = shade >= 0 ? lighten(base, shade) : darken(base, -shade);
    ctx.fillRect(0, y, w, panelH);
    ctx.fillStyle = darken(base, 0.3);
    ctx.fillRect(0, y, w, 2);
  }
  // Subtle vertical seams
  for (let x = w / 3; x < w; x += w / 3) {
    ctx.fillStyle = darken(base, 0.25);
    ctx.fillRect(x, 0, 1, h);
  }
}

function drawComposite(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  rng: () => number,
): void {
  // Modern composite panels with metallic sheen
  const panelH = 48;
  for (let y = 0; y < h; y += panelH) {
    const grad = ctx.createLinearGradient(0, y, 0, y + panelH);
    const c1 = lighten(base, rng() * 0.1);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, base);
    grad.addColorStop(1, darken(base, 0.08));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, panelH);
  }
}

function drawWindows(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  b: BuildingAssetData,
  stories: number,
  bays: number,
  rng: () => number,
): void {
  const style: WindowStyle = b.windowStyle;
  const storyH = h / stories;
  const bayW = w / bays;

  // Window glass color — reflective/dark by day
  const glassDark = '#1a2030';
  const glassLit = '#5a6a8a';

  for (let s = 0; s < stories; s++) {
    const yBase = h - (s + 1) * storyH;
    for (let by = 0; by < bays; by++) {
      const xBase = by * bayW;
      const lit = rng() < 0.3;
      const glass = lit ? glassLit : glassDark;

      switch (style) {
        case 'double-hung': {
          // Two stacked sashes with a frame
          const fw = bayW * 0.6;
          const fh = storyH * 0.5;
          const fx = xBase + (bayW - fw) / 2;
          const fy = yBase + (storyH - fh) / 2;
          ctx.fillStyle = b.windowFrameColor;
          ctx.fillRect(fx - 2, fy - 2, fw + 4, fh + 4);
          ctx.fillStyle = glass;
          ctx.fillRect(fx, fy, fw, fh / 2 - 1);
          ctx.fillRect(fx, fy + fh / 2 + 1, fw, fh / 2 - 1);
          ctx.fillStyle = b.windowFrameColor;
          ctx.fillRect(fx, fy + fh / 2 - 1, fw, 2); // meeting rail
          break;
        }
        case 'small-grid': {
          const fw = bayW * 0.7;
          const fh = storyH * 0.6;
          const fx = xBase + (bayW - fw) / 2;
          const fy = yBase + (storyH - fh) / 2;
          ctx.fillStyle = glass;
          ctx.fillRect(fx, fy, fw, fh);
          ctx.fillStyle = b.windowFrameColor;
          // muntins
          ctx.fillRect(fx + fw / 2 - 0.5, fy, 1, fh);
          ctx.fillRect(fx, fy + fh / 2 - 0.5, fw, 1);
          break;
        }
        case 'ribbon': {
          // Horizontal strip windows
          const fh = storyH * 0.4;
          const fy = yBase + (storyH - fh) / 2;
          ctx.fillStyle = glass;
          ctx.fillRect(xBase + 2, fy, bayW - 4, fh);
          ctx.fillStyle = b.windowFrameColor;
          ctx.fillRect(xBase + bayW / 2 - 0.5, fy, 1, fh);
          break;
        }
        case 'curtain-wall':
        case 'glass-tower': {
          // Full curtain wall — glass with mullion grid
          ctx.fillStyle = glass;
          ctx.fillRect(xBase, yBase, bayW, storyH);
          ctx.fillStyle = darken(b.windowFrameColor, 0.1);
          ctx.fillRect(xBase, yBase + storyH - 1.5, bayW, 1.5);
          ctx.fillRect(xBase + bayW - 1.5, yBase, 1.5, storyH);
          // Reflection streak
          if (rng() < 0.4) {
            ctx.fillStyle = 'rgba(180,200,220,0.15)';
            ctx.fillRect(xBase + 2, yBase + 2, bayW * 0.3, storyH * 0.6);
          }
          break;
        }
        case 'smart-glass': {
          // Tinted smart glass — variable opacity
          const tint = rng() < 0.5 ? '#2a3a4a' : '#4a6a8a';
          ctx.fillStyle = tint;
          ctx.fillRect(xBase, yBase, bayW, storyH);
          ctx.fillStyle = 'rgba(100,200,255,0.08)';
          ctx.fillRect(xBase + 2, yBase + 2, bayW - 4, storyH - 4);
          // LED accent line
          if (rng() < 0.3) {
            ctx.fillStyle = '#3acaff';
            ctx.fillRect(xBase, yBase + storyH - 2, bayW, 1.5);
          }
          break;
        }
        default:
          break;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signage texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paint a signage / storefront-ad texture with era-appropriate text and style.
 */
export function getSignageTexture(
  set: AssetSet,
  wordIndex: number,
  variant: number = 0,
): THREE.CanvasTexture {
  const b = set.building;
  const ck = key(set.eraId, `sign:${variant}`, wordIndex);
  return cached(ck, 256, 128, (ctx, w, h) => {
    drawSignage(ctx, w, h, b.adStyle, b.signageWords, wordIndex, set.eraId);
  }, { srgb: true });
}

function drawSignage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: BuildingAssetData['adStyle'],
  words: readonly string[],
  wordIndex: number,
  eraId: EraId,
): void {
  const word = words[wordIndex % words.length];
  const rng = makeRng(wordIndex * 31 + 7);

  // Background depends on ad style
  switch (style) {
    case 'painted': {
      ctx.fillStyle = '#d8c8a8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3a2a1a';
      ctx.font = 'bold 52px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, w / 2, h / 2);
      // Painted border
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      break;
    }
    case 'neon': {
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(0, 0, w, h);
      const neonColors = ['#ff3a6a', '#3affaa', '#3a6aff', '#ffaa3a', '#ff3aff'];
      const nc = neonColors[wordIndex % neonColors.length];
      ctx.shadowColor = nc;
      ctx.shadowBlur = 18;
      ctx.fillStyle = nc;
      ctx.font = 'bold 50px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, w / 2, h / 2);
      ctx.shadowBlur = 0;
      // Flicker — randomly darken some pixels
      if (rng() < 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, h * 0.3, w, h * 0.1);
      }
      break;
    }
    case 'backlit': {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, 0, w, h);
      // Backlit panel
      ctx.fillStyle = '#fff8d0';
      ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#1a1a2a';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, w / 2, h / 2);
      // Glow border
      ctx.strokeStyle = 'rgba(255,248,208,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      break;
    }
    case 'led-screen': {
      // Dark screen with bright pixelated text
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
      // Pixel grid background
      ctx.fillStyle = 'rgba(40,60,80,0.3)';
      for (let x = 0; x < w; x += 8) {
        for (let y = 0; y < h; y += 8) {
          if (rng() < 0.15) ctx.fillRect(x, y, 6, 6);
        }
      }
      ctx.fillStyle = '#3acaff';
      ctx.font = 'bold 44px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, w / 2, h / 2);
      break;
    }
    case 'holographic': {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, w, h);
      // Holographic gradient text
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#3acaff');
      grad.addColorStop(0.5, '#ff3aff');
      grad.addColorStop(1, '#3affaa');
      ctx.fillStyle = grad;
      ctx.font = 'bold 46px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#3acaff';
      ctx.shadowBlur = 12;
      ctx.fillText(word, w / 2, h / 2);
      ctx.shadowBlur = 0;
      // Scanline
      ctx.fillStyle = 'rgba(0,255,255,0.08)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      break;
    }
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Asphalt / road texture
// ─────────────────────────────────────────────────────────────────────────────

/** A tiling asphalt texture tinted to the era's road color. */
export function getAsphaltTexture(set: AssetSet): THREE.CanvasTexture {
  const ck = key(set.eraId, 'asphalt');
  return cached(ck, 256, 256, (ctx, w, h) => {
    const base = set.street.roadColor;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const rng = makeRng(1234);
    // Noise speckle
    for (let i = 0; i < 3000; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const shade = rng() * 0.15 - 0.075;
      ctx.fillStyle = shade >= 0 ? lighten(base, shade) : darken(base, -shade);
      ctx.fillRect(x, y, 2, 2);
    }
    // Crack lines
    ctx.strokeStyle = darken(base, 0.4);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(rng() * w, 0);
      ctx.lineTo(rng() * w, h);
      ctx.stroke();
    }
  }, { repeat: [8, 8], srgb: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidewalk texture
// ─────────────────────────────────────────────────────────────────────────────

/** A tiling concrete sidewalk texture with expansion joints. */
export function getSidewalkTexture(set: AssetSet): THREE.CanvasTexture {
  const ck = key(set.eraId, 'sidewalk');
  return cached(ck, 256, 256, (ctx, w, h) => {
    const base = set.street.sidewalkColor;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const rng = makeRng(5678);
    // Speckle
    for (let i = 0; i < 1500; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const shade = rng() * 0.1 - 0.05;
      ctx.fillStyle = shade >= 0 ? lighten(base, shade) : darken(base, -shade);
      ctx.fillRect(x, y, 2, 2);
    }
    // Expansion joint grid
    ctx.strokeStyle = darken(base, 0.35);
    ctx.lineWidth = 2;
    const tile = 64;
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
  }, { repeat: [4, 4], srgb: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sky gradient texture
// ─────────────────────────────────────────────────────────────────────────────

/** A vertical sky-gradient texture for the era's dome/background. */
export function getSkyTexture(set: AssetSet): THREE.CanvasTexture {
  const ck = key(set.eraId, 'sky');
  return cached(ck, 16, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, set.skyTop);
    grad.addColorStop(1, set.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposal
// ─────────────────────────────────────────────────────────────────────────────

/** Dispose all cached textures (called on full scene teardown). */
export function disposeAllTextures(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}
