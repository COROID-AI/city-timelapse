import * as THREE from 'three';
import type { BuildingStyle, SignageDef, RGB } from '../types';

// ---------------------------------------------------------------------------
// Procedural canvas textures — no external image assets.
// All textures are generated once at module load and cached. The colours are
// neutral (white-ish) because the building material tints them per-frame via
// material.color. This lets one texture serve every era.
// ---------------------------------------------------------------------------

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function toCss(rgb: RGB, mul = 1): string {
  const r = Math.round(Math.min(1, rgb[0] * mul) * 255);
  const g = Math.round(Math.min(1, rgb[1] * mul) * 255);
  const b = Math.round(Math.min(1, rgb[2] * mul) * 255);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Facade texture — a tiled window grid per architectural style.
// Returns both the base (diffuse) map and an emissive map (lit windows).
// The emissive map is the same pattern but with random lit windows.
// ---------------------------------------------------------------------------

export type FacadeTextures = {
  map: THREE.Texture;
  emissive: THREE.Texture;
};

function drawWindowGrid(
  ctx: CanvasRenderingContext2D,
  size: number,
  cols: number,
  rows: number,
  frameColor: string,
  glassColor: string,
  litFraction: number,
  litColor: string,
) {
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, size, size);

  const pad = size * 0.01;
  const cellW = (size - pad * 2) / cols;
  const cellH = (size - pad * 2) / rows;
  const winW = cellW * 0.7;
  const winH = cellH * 0.65;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * cellW + (cellW - winW) / 2;
      const y = pad + r * cellH + (cellH - winH) / 2;
      ctx.fillStyle = glassColor;
      ctx.fillRect(x, y, winW, winH);
      // subtle reflection streak
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, winW * 0.3, winH);
    }
  }
}

function drawWindowGridEmissive(
  ctx: CanvasRenderingContext2D,
  size: number,
  cols: number,
  rows: number,
  litFraction: number,
  litColor: string,
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const pad = size * 0.01;
  const cellW = (size - pad * 2) / cols;
  const cellH = (size - pad * 2) / rows;
  const winW = cellW * 0.7;
  const winH = cellH * 0.65;

  // Deterministic pseudo-random for stable lit windows
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < litFraction) {
        const x = pad + c * cellW + (cellW - winW) / 2;
        const y = pad + r * cellH + (cellH - winH) / 2;
        ctx.fillStyle = litColor;
        ctx.fillRect(x, y, winW, winH);
      }
    }
  }
}

function buildFacade(
  style: BuildingStyle,
  cols: number,
  rows: number,
): FacadeTextures {
  const size = 512;
  const frame: Record<BuildingStyle, string> = {
    brick: '#6b5a4a',
    artdeco: '#7a6e5a',
    concrete: '#8a8a8c',
    glass: '#9aa0a8',
    green: '#5a7a5a',
    future: '#3a4a5a',
  };
  const glass: Record<BuildingStyle, string> = {
    brick: '#4a5560',
    artdeco: '#5a6470',
    concrete: '#506070',
    glass: '#80a0c0',
    green: '#406050',
    future: '#4070a0',
  };

  const [c1, ctx1] = makeCanvas(size);
  drawWindowGrid(ctx1, size, cols, rows, frame[style], glass[style], 0.4, '#ffd080');

  const [c2, ctx2] = makeCanvas(size);
  drawWindowGridEmissive(ctx2, size, cols, rows, 0.4, '#ffe0a0');

  const map = new THREE.CanvasTexture(c1);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const emissive = new THREE.CanvasTexture(c2);
  emissive.wrapS = THREE.RepeatWrapping;
  emissive.wrapT = THREE.RepeatWrapping;
  emissive.colorSpace = THREE.SRGBColorSpace;

  return { map, emissive };
}

// Pre-build one set per style. These are shared across ALL buildings.
const facadeCache = new Map<BuildingStyle, FacadeTextures>();

export function getFacadeTextures(style: BuildingStyle): FacadeTextures {
  let f = facadeCache.get(style);
  if (!f) {
    const cfg: Record<BuildingStyle, [number, number]> = {
      brick: [4, 6],
      artdeco: [5, 8],
      concrete: [5, 7],
      glass: [6, 9],
      green: [4, 6],
      future: [6, 10],
    };
    f = buildFacade(style, ...cfg[style]);
    facadeCache.set(style, f);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Signage / billboard texture — text drawn onto a coloured canvas.
// ---------------------------------------------------------------------------

const signageCache = new Map<string, THREE.Texture>();

export function getSignageTexture(def: SignageDef): THREE.Texture {
  const key = `${def.text}-${def.style}`;
  let tex = signageCache.get(key);
  if (tex) return tex;

  const W = 512;
  const H = 256;
  const [canvas, ctx] = makeCanvas(H);
  canvas.width = W;
  canvas.height = H;

  // Background
  if (def.style === 'hologram') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, toCss(def.background, 0.5));
    grad.addColorStop(1, toCss(def.foreground, 0.3));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = toCss(def.background);
  }
  ctx.fillRect(0, 0, W, H);

  // Border / frame
  ctx.strokeStyle = toCss(def.foreground);
  ctx.lineWidth = def.style === 'neon' || def.style === 'hologram' ? 6 : 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Text
  ctx.fillStyle = toCss(def.foreground);
  const fontSize = def.text.length > 8 ? 64 : 80;
  ctx.font = `bold ${fontSize}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow for neon/hologram/led
  if (def.glow > 0.1) {
    ctx.shadowColor = toCss(def.foreground);
    ctx.shadowBlur = 20 * def.glow;
  }
  ctx.fillText(def.text, W / 2, H / 2);
  ctx.shadowBlur = 0;

  // CRT scanlines
  if (def.style === 'crt') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  }

  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  signageCache.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Asphalt / road texture with lane markings.
// ---------------------------------------------------------------------------

let asphaltTex: THREE.Texture | null = null;

export function getAsphaltTexture(): THREE.Texture {
  if (asphaltTex) return asphaltTex;
  const W = 512;
  const H = 512;
  const [canvas, ctx] = makeCanvas(W);
  canvas.width = W;
  canvas.height = H;

  // Base asphalt noise
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 28 + Math.random() * 24;
    d[i] = n;
    d[i + 1] = n;
    d[i + 2] = n + 2;
  }
  ctx.putImageData(img, 0, 0);

  // Dashed centre line
  ctx.fillStyle = '#c8b840';
  const laneY = H / 2 - 3;
  for (let x = 0; x < W; x += 64) {
    ctx.fillRect(x, laneY, 36, 6);
  }

  asphaltTex = new THREE.CanvasTexture(canvas);
  asphaltTex.wrapS = THREE.RepeatWrapping;
  asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.colorSpace = THREE.SRGBColorSpace;
  return asphaltTex;
}

// ---------------------------------------------------------------------------
// Sidewalk texture (concrete pavers).
// ---------------------------------------------------------------------------

let sidewalkTex: THREE.Texture | null = null;

export function getSidewalkTexture(): THREE.Texture {
  if (sidewalkTex) return sidewalkTex;
  const S = 256;
  const [canvas, ctx] = makeCanvas(S);

  ctx.fillStyle = '#9a9894';
  ctx.fillRect(0, 0, S, S);
  // Paver grid
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= S; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  sidewalkTex = new THREE.CanvasTexture(canvas);
  sidewalkTex.wrapS = THREE.RepeatWrapping;
  sidewalkTex.wrapT = THREE.RepeatWrapping;
  sidewalkTex.colorSpace = THREE.SRGBColorSpace;
  return sidewalkTex;
}
