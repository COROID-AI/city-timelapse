/**
 * Procedural canvas textures — the "Budget" deliverable maximizes impact with
 * zero external binary assets. Every texture is painted into a 2D canvas and
 * uploaded to a THREE.CanvasTexture.
 *
 * Each generator is deterministic (seeded) and parameterized by era values so
 * the textures can be regenerated cheaply when an era changes, or blended.
 */

import * as THREE from "three";
import { mulberry32 } from "./interp";

function makeCanvas(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Build a facade texture: base wall + grid of windows + grime. */
export function buildFacadeTexture(opts: {
  hue: number;
  saturation: number;
  lightness: number;
  windowColor: string;
  windowGlow: number;
  cols: number;
  rows: number;
  facade: string;
  grime: number;
  seed: number;
}): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  const rnd = mulberry32(opts.seed);

  // Base wall.
  ctx.fillStyle = `hsl(${opts.hue * 360}, ${opts.saturation * 100}%, ${
    opts.lightness * 100
  }%)`;
  ctx.fillRect(0, 0, size, size);

  // Facade-specific micro texture.
  if (opts.facade === "brick") {
    ctx.strokeStyle = `hsla(${opts.hue * 360}, 30%, 25%, 0.5)`;
    ctx.lineWidth = 2;
    const bh = 16;
    for (let y = 0; y < size; y += bh) {
      const offset = (Math.floor(y / bh) % 2) * 16;
      for (let x = -16; x < size; x += 32) {
        ctx.strokeRect(x + offset, y, 32, bh);
      }
    }
  } else if (opts.facade === "concrete") {
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`;
      ctx.fillRect(rnd() * size, rnd() * size, 2, 2);
    }
  } else if (opts.facade === "glass" || opts.facade === "neo-glass") {
    // vertical mullions
    ctx.fillStyle = `hsla(${opts.hue * 360}, 10%, 30%, 0.4)`;
    for (let x = 0; x < size; x += size / opts.cols) {
      ctx.fillRect(x, 0, 2, size);
    }
  }

  // Windows grid.
  const pad = 4;
  const cw = size / opts.cols;
  const ch = size / opts.rows;
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      const lit = rnd() < 0.45 + opts.windowGlow * 0.4;
      const x = c * cw + pad;
      const y = r * ch + pad;
      const w = cw - pad * 2;
      const h = ch - pad * 2;
      if (lit) {
        ctx.fillStyle = opts.windowColor;
        ctx.globalAlpha = 0.5 + opts.windowGlow * 0.5;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `hsla(${opts.hue * 360}, 15%, 18%, 0.85)`;
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  // Grime overlay.
  if (opts.grime > 0) {
    for (let i = 0; i < 400 * opts.grime; i++) {
      ctx.fillStyle = `rgba(40,30,20,${rnd() * 0.25})`;
      const y = rnd() * size;
      ctx.fillRect(rnd() * size, y, rnd() * 6, rnd() * 6);
    }
  }

  return toTexture(canvas);
}

/** A small glowing emissive map matching the facade window layout. */
export function buildEmissiveTexture(opts: {
  windowColor: string;
  glow: number;
  cols: number;
  rows: number;
  seed: number;
}): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  const rnd = mulberry32(opts.seed + 7);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const pad = 4;
  const cw = size / opts.cols;
  const ch = size / opts.rows;
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      if (rnd() < 0.45 + opts.glow * 0.4) {
        ctx.fillStyle = opts.windowColor;
        ctx.globalAlpha = Math.min(1, 0.6 + opts.glow);
        ctx.fillRect(c * cw + pad, r * ch + pad, cw - pad * 2, ch - pad * 2);
      }
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Asphalt with lane markings. */
export function buildRoadTexture(opts: {
  asphalt: string;
  marking: string;
  wetness: number;
}): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const { canvas, ctx } = makeCanvas(256);
  const rnd = mulberry32(99);
  ctx.fillStyle = opts.asphalt;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1, 1);
  }
  // dashed center line
  ctx.fillStyle = opts.marking;
  for (let y = 0; y < h; y += 48) {
    ctx.fillRect(w / 2 - 3, y, 6, 28);
  }
  if (opts.wetness > 0.2) {
    ctx.globalAlpha = opts.wetness * 0.25;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  void h;
  return toTexture(canvas);
}

/** A billboard / ad face. */
export function buildBillboardTexture(opts: {
  palette: string[];
  text: string;
  emissive: number;
  seed: number;
}): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rnd = mulberry32(opts.seed);
  const bg = opts.palette[Math.floor(rnd() * opts.palette.length)]!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // geometric accents
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = opts.palette[Math.floor(rnd() * opts.palette.length)]!;
    ctx.globalAlpha = 0.5 + opts.emissive * 0.4;
    if (rnd() > 0.5) {
      ctx.fillRect(rnd() * w, rnd() * h, rnd() * 80, rnd() * 30);
    } else {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 8 + rnd() * 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opts.text, w / 2, h / 2);
  return toTexture(canvas);
}

/** Procedural sky gradient as a texture (used as backdrop + fog tinting). */
export function buildSkyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, h);
  return toTexture(canvas);
}
