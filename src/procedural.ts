// Procedural canvas textures. Every asset is generated at runtime — no network
// fetches occur, so the app works fully offline (acceptance criterion #11).

import * as THREE from 'three';
import { RNG } from './rng';

function makeCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return { canvas, ctx };
}

export interface FacadeTextures {
  /** Diffuse map: wall tinted by material colour, windows dark. */
  map: THREE.CanvasTexture;
  /** Emissive map: windows bright, wall black. */
  emissive: THREE.CanvasTexture;
}

/**
 * Generate a building facade pair for `floors` storeys. The texture maps a full
 * building height, so repeat.y stays 1 and the mesh's vertical scale stretches
 * the windows as the building grows/shrinks between eras.
 */
export function makeFacadeTextures(seed: number, floors = 6): FacadeTextures {
  const W = 128;
  const floorH = 26;
  const H = floorH * floors;
  const map = makeCanvas(W, H);
  const emi = makeCanvas(W, H);
  const rng = new RNG(seed);

  // Wall base.
  map.ctx.fillStyle = '#e9e9ec';
  map.ctx.fillRect(0, 0, W, H);
  emi.ctx.fillStyle = '#000000';
  emi.ctx.fillRect(0, 0, W, H);

  // Ground-floor storefront band (awnings).
  map.ctx.fillStyle = '#2a2c30';
  map.ctx.fillRect(0, H - floorH, W, floorH);
  map.ctx.fillStyle = '#3a3d44';
  for (let x = 0; x < W; x += 32) map.ctx.fillRect(x, H - floorH, 16, 6);

  // Windows per floor.
  for (let f = 0; f < floors; f++) {
    const y = H - (f + 1) * floorH + 4;
    for (let x = 8; x < W - 8; x += 22) {
      const lit = rng.next() > 0.32;
      const ww = 14;
      const wh = floorH - 12;
      // Diffuse: glass is darker than wall.
      map.ctx.fillStyle = lit ? '#9fb4c8' : '#23262c';
      map.ctx.fillRect(x, y, ww, wh);
      map.ctx.fillStyle = 'rgba(0,0,0,0.25)';
      map.ctx.fillRect(x + ww - 2, y, 2, wh);
      // Emissive mask: only lit windows glow.
      emi.ctx.fillStyle = lit ? '#ffffff' : '#000000';
      emi.ctx.fillRect(x, y, ww, wh);
    }
  }

  // Floor separators for structure.
  map.ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let f = 0; f <= floors; f++) {
    map.ctx.fillRect(0, H - f * floorH, W, 2);
  }

  const wrap = (t: THREE.CanvasTexture): THREE.CanvasTexture => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: wrap(new THREE.CanvasTexture(map.canvas)), emissive: wrap(new THREE.CanvasTexture(emi.canvas)) };
}

/** Glowing neon-style sign texture with the given text + colour. */
export function makeSignTexture(text: string, colorHex: number, w = 256, h = 80): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const col = new THREE.Color(colorHex);
  const css = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  ctx.font = '700 44px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Outer glow passes.
  ctx.shadowColor = css;
  ctx.shadowBlur = 22;
  ctx.fillStyle = css;
  ctx.fillText(text, w / 2, h / 2 + 2);
  ctx.shadowBlur = 10;
  ctx.fillText(text, w / 2, h / 2 + 2);
  // Crisp white core for a hot neon centre.
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt road with a dashed centre line + solid edge lines. Tiles along X. */
export function makeRoadTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#232327';
  ctx.fillRect(0, 0, W, H);
  // Speckle for asphalt grain.
  for (let i = 0; i < 1400; i++) {
    const v = 30 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // Centre dashed line.
  ctx.fillStyle = '#d9c86a';
  for (let y = 8; y < H; y += 40) ctx.fillRect(W / 2 - 2, y, 4, 22);
  // Edge lines.
  ctx.fillStyle = '#cfd2d6';
  ctx.fillRect(8, 0, 4, H);
  ctx.fillRect(W - 12, 0, 4, H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Concrete sidewalk with expansion joints. Tiles along X. */
export function makeSidewalkTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#9a9a92';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const v = 120 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v - 6},0.35)`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
