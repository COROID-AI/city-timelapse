import * as THREE from 'three';
import type { RGB } from './types';

/** Convert domain RGB (0..1) to a Three.Color in sRGB space. */
export function toColor(c: RGB): THREE.Color {
  return new THREE.Color(c.r, c.g, c.b);
}

/** Mix two colours returning a new THREE.Color. */
export function mixColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, t);
}

/**
 * Procedurally generate a window-grid texture for building facades using a
 * canvas. The emissive map uses the same grid so lit windows glow.
 */
export function makeWindowTexture(
  cols: number,
  rows: number,
  litRatio: number,
  baseColor: string,
  frameColor: string,
  litColor: string,
  seed: number,
): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const ecanvas = document.createElement('canvas');
  ecanvas.width = w;
  ecanvas.height = h;
  const ectx = ecanvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  const cellW = w / cols;
  const cellH = h / rows;
  const pad = Math.min(cellW, cellH) * 0.18;

  // Deterministic random
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + pad;
      const y = r * cellH + pad;
      const ww = cellW - pad * 2;
      const hh = cellH - pad * 2;
      const isLit = rand() < litRatio;
      ctx.fillStyle = isLit ? litColor : frameColor;
      ctx.fillRect(x, y, ww, hh);
      if (isLit) {
        ectx.fillStyle = litColor;
        ectx.fillRect(x, y, ww, hh);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(ecanvas);
  return { map, emissive };
}

/**
 * Generate a soft radial glow sprite texture (for light blooms, holograms).
 */
export function makeGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Generate a subtle noise texture for ground/asphalt variation. */
export function makeNoiseTexture(baseColor: string, speckColor: string, density: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  let s = 12345;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  ctx.fillStyle = speckColor;
  for (let i = 0; i < density; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = rand() * 1.5 + 0.3;
    ctx.globalAlpha = rand() * 0.3 + 0.1;
    ctx.fillRect(x, y, r, r);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
