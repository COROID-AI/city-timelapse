/**
 * Procedural texture helpers.
 *
 * Everything is baked to CanvasTexture / DataTexture at startup: signage text,
 * window grids, brick / concrete / glass palettes, asphalt, sky gradients.
 * No external image assets are used.
 */

import * as THREE from 'three';

export function makeCanvas(w = 256, h = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 256,
  h = 256,
  srgb = true,
): THREE.CanvasTexture {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Asphalt / concrete surface with subtle noise. */
export function makeAsphaltTexture(base: string, speckles = 260): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < speckles; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = 0.75 + 0.5 * Math.random();
      ctx.fillStyle = shadeTo(base, shade);
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }, 256, 256);
}

/** Flat color texture (for cheap unlit materials). */
export function makeColorTexture(color: string): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }, 64, 64);
}

/** Window wall: repeating grid of lit/unlit windows on a dark facade. */
export function makeWindowTexture(
  facade: string,
  glassLit: string,
  glassDark: string,
  rows = 5,
  cols = 7,
  litRatio = 0.35,
  border = 0.12,
): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = facade;
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * border * 0.4;
        const y = r * ch + ch * border * 0.4;
        const lit = Math.random() < litRatio;
        ctx.fillStyle = lit ? glassLit : glassDark;
        ctx.fillRect(x, y, cw * (1 - border), ch * (1 - border));
        if (lit && Math.random() < 0.3) {
          ctx.fillStyle = 'rgba(255,244,214,0.35)';
          ctx.fillRect(x + 1, y + 1, cw * (1 - border) - 2, 1.5);
        }
      }
    }
  }, 256, 256);
}

/** Neon / storefront text texture. */
export function makeSignTexture(
  lines: string[],
  opts: {
    bg?: string;
    fg?: string;
    glow?: string;
    font?: string;
    pad?: number;
  } = {},
): THREE.CanvasTexture {
  const { bg = '#0a0c12', fg = '#ffd54a', glow = '#ff9800', font = 'bold 46px sans-serif', pad = 14 } = opts;
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = fg;
      ctx.font = font;
      const lineH = h / Math.max(1, lines.length);
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, pad + lineH * i + lineH / 2);
      });
    },
    256,
    128,
    true,
  );
}

function shadeTo(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Cartesian gradient used for the sky dome. */
export function makeSkyGradientTexture(
  top: string,
  mid: string,
  bottom: string,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(256 * 4), 1, 256, THREE.RGBAFormat);
  updateSkyGradientTexture(tex, top, mid, bottom);
  return tex;
}

/** Rewrites the stops of an existing 1x256 sky gradient texture in place. */
export function updateSkyGradientTexture(
  tex: THREE.DataTexture,
  top: string,
  mid: string,
  bottom: string,
): void {
  const data = tex.image?.data as Uint8Array | undefined;
  if (!data) return;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const c = t < 0.5 ? lerpColor(top, mid, t * 2) : lerpColor(mid, bottom, (t - 0.5) * 2);
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
  tex.needsUpdate = true;
}

function lerpColor(a: string, b: string, t: number): [number, number, number] {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  return [
    Math.round((((ca >> 16) & 255) * (1 - t)) + (((cb >> 16) & 255) * t)),
    Math.round((((ca >> 8) & 255) * (1 - t)) + (((cb >> 8) & 255) * t)),
    Math.round(((ca & 255) * (1 - t)) + ((cb & 255) * t)),
  ];
}