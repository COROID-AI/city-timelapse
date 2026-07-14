import * as THREE from 'three';
import { mulberry32, randFloat } from './math';

function canvasCtx(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/**
 * Procedurally generate a window-grid emissive map so lit windows glow at night.
 * Returns a canvas texture (sRGB) where lit cells are bright and unlit are dark.
 */
export function makeWindowTexture(
  cols: number,
  rows: number,
  litRatio: number,
  litColor: string,
  seed: number
): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = canvasCtx(size);
  const rng = mulberry32(seed);
  const cw = size / cols;
  const ch = size / rows;
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      const px = x * cw + cw * 0.15;
      const py = y * ch + ch * 0.15;
      const w = cw * 0.7;
      const h = ch * 0.7;
      if (lit) {
        const flicker = 0.75 + rng() * 0.25;
        ctx.fillStyle = litColor;
        ctx.globalAlpha = flicker;
        ctx.fillRect(px, py, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#10141a';
        ctx.fillRect(px, py, w, h);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/** Generate a noisy facade color map for subtle surface variation. */
export function makeNoiseTexture(baseColor: string, variance: number, seed: number): THREE.CanvasTexture {
  const size = 64;
  const { canvas, ctx } = canvasCtx(size);
  const rng = mulberry32(seed);
  const base = new THREE.Color(baseColor);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rng() - 0.5) * variance;
    const idx = i * 4;
    img.data[idx] = Math.max(0, Math.min(255, (base.r * 255 + n * 60) | 0));
    img.data[idx + 1] = Math.max(0, Math.min(255, (base.g * 255 + n * 60) | 0));
    img.data[idx + 2] = Math.max(0, Math.min(255, (base.b * 255 + n * 60) | 0));
    img.data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Generate a radial-gradient glow sprite for particles/lamps. */
export function makeGlowSprite(color: string, seed = 1): THREE.Texture {
  const size = 128;
  const { canvas, ctx } = canvasCtx(size);
  const c = new THREE.Color(color);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},1)`);
  g.addColorStop(0.4, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.35)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  void seed;
  return tex;
}

/** Simple 1px opaque white texture for when a sprite isn't needed. */
let _white: THREE.Texture | null = null;
export function whiteTexture(): THREE.Texture {
  if (_white) return _white;
  const { canvas, ctx } = canvasCtx(4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 4, 4);
  _white = new THREE.CanvasTexture(canvas);
  _white.colorSpace = THREE.SRGBColorSpace;
  return _white;
}

/** Small canvas with a word painted on it — used for billboards/holo-ads. */
export function makeTextTexture(
  text: string,
  bg: string,
  fg: string,
  seed: number
): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const { canvas, ctx } = canvasCtx2(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = fg;
  ctx.font = 'bold 52px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rng = mulberry32(seed);
  const x = w / 2 + randFloat(rng, -6, 6);
  const y = h / 2 + randFloat(rng, -4, 4);
  ctx.fillText(text.toUpperCase(), x, y);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function canvasCtx2(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}
