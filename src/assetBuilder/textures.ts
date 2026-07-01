import * as THREE from 'three';
import { BuildingType, Era, EraBuildingStyle, EraStorefront } from '../eras/types';

function makeCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Build a tiling facade texture for a given era + building type. */
export function makeFacadeTexture(era: Era, buildingType: BuildingType, style: EraBuildingStyle): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = seeded(era * 7 + buildingType.length * 101);

  // base wall
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, W, H);

  switch (style.facade) {
    case 'wood': {
      // horizontal clapboard planks
      for (let y = 0; y < H; y += 8) {
        const shade = 0.82 + rng() * 0.18;
        ctx.fillStyle = mix(style.wall, '#000000', 1 - shade);
        ctx.fillRect(0, y, W, 7);
      }
      drawWindows(ctx, W, H, style, 4, 4, rng);
      break;
    }
    case 'brick': {
      const bw = 24;
      const bh = 12;
      for (let y = 0; y < H; y += bh) {
        const offset = (Math.floor(y / bh) % 2) * (bw / 2);
        for (let x = -bw; x < W; x += bw) {
          ctx.fillStyle = mix(style.wall, '#000000', 0.1 + rng() * 0.1);
          ctx.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2);
          ctx.fillStyle = mix(style.wall, '#ffffff', 0.05);
          ctx.fillRect(x + offset, y, bw, 1);
        }
      }
      drawWindows(ctx, W, H, style, 5, 5, rng);
      break;
    }
    case 'concrete': {
      // subtle noise panels
      for (let i = 0; i < 600; i++) {
        const x = rng() * W;
        const y = rng() * H;
        ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
        ctx.fillRect(x, y, 2, 2);
      }
      // panel seams
      ctx.strokeStyle = mix(style.wall, '#000000', 0.3);
      for (let x = W / 3; x < W; x += W / 3) {
        ctx.fillRect(x - 1, 0, 2, H);
      }
      drawWindows(ctx, W, H, style, 6, 6, rng);
      break;
    }
    case 'glass': {
      // curtain-wall mullion grid
      ctx.fillStyle = mix(style.wall, '#000000', 0.2);
      ctx.fillRect(0, 0, W, H);
      const cols = 8;
      const rows = 8;
      const cw = W / cols;
      const ch = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const grad = ctx.createLinearGradient(c * cw, r * ch, (c + 1) * cw, (r + 1) * ch);
          grad.addColorStop(0, mix(style.window, '#ffffff', 0.4));
          grad.addColorStop(1, mix(style.window, '#000000', 0.2));
          ctx.fillStyle = grad;
          ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
      break;
    }
    case 'parametric': {
      // vertical fins + glow
      for (let x = 0; x < W; x += 12) {
        ctx.fillStyle = mix(style.wall, '#000000', 0.15);
        ctx.fillRect(x, 0, 6, H);
      }
      for (let y = 0; y < H; y += 6) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`;
        ctx.fillRect(0, y, W, 2);
      }
      // glowing window strips
      ctx.fillStyle = style.window;
      ctx.globalAlpha = 0.5;
      for (let y = 16; y < H; y += 32) {
        ctx.fillRect(6, y, W - 12, 6);
      }
      ctx.globalAlpha = 1;
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function drawWindows(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  style: EraBuildingStyle,
  cols: number,
  rows: number,
  rng: () => number,
): void {
  const margin = 8;
  const cw = (W - margin * 2) / cols;
  const ch = (H - margin * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.55;
      ctx.fillStyle = lit ? style.window : mix(style.window, '#000000', 0.6);
      ctx.fillRect(margin + c * cw + 2, margin + r * ch + 2, cw - 4, ch - 4);
      ctx.strokeStyle = style.trim;
      ctx.lineWidth = 1;
      ctx.strokeRect(margin + c * cw + 2, margin + r * ch + 2, cw - 4, ch - 4);
    }
  }
}

/** Build a storefront sign texture (with optional neon glow). */
export function makeSignTexture(storefront: EraStorefront): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = storefront.bg;
  ctx.fillRect(0, 0, W, H);

  // neon glow
  if (storefront.glow) {
    ctx.save();
    ctx.shadowColor = storefront.glow;
    ctx.shadowBlur = 30;
    ctx.fillStyle = storefront.fg;
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storefront.sign, W / 2, H / 2);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storefront.sign, W / 2, H / 2);
  } else {
    ctx.fillStyle = storefront.fg;
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storefront.sign, W / 2, H / 2);
  }
  // border
  ctx.strokeStyle = storefront.fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Ground / road texture. */
export function makeGroundTexture(base: string): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const rng = seeded(base.length * 31);
  for (let i = 0; i < 2000; i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.06})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // lane markings
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(W / 2 - 2, 0, 4, H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Linear interpolation between two hex colors. t in [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
