/**
 * Procedural canvas texture generators for the building content module.
 *
 * Every texture is generated at runtime from a 2D canvas — no external asset
 * files. Textures are deterministic (seeded PRNG) so the scene is reproducible
 * across reloads. The canvas factory is injectable so the module can also run
 * in headless environments (tests / verification) that lack a DOM.
 */
import * as THREE from 'three';
import { PRNG } from '../core/prng';

export type CanvasFactory = () => HTMLCanvasElement;

/** Default factory uses the DOM. Override for headless environments. */
let createCanvas: CanvasFactory = () => document.createElement('canvas');

/** Inject a canvas factory (e.g. a headless stub). Call before building. */
export function setCanvasFactory(factory: CanvasFactory): void {
  createCanvas = factory;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = createCanvas();
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }
  return [canvas, ctx];
}

function finalize(
  canvas: HTMLCanvasElement,
  repeat?: [number, number],
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function rgb(hex: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Brick pattern with per-brick tone variation. */
export function makeBrickTexture(
  opts: { brick?: number; mortar?: number; size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const brick = opts.brick ?? 0xa03c2a;
  const mortar = opts.mortar ?? 0xcfc4b4;
  const rng = new PRNG(0x1945b01);
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(mortar);
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 8;
  const bw = size / cols;
  const bh = size / rows;
  const [br, bg, bb] = hexToRgb(brick);

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col < cols; col++) {
      const shade = 0.82 + rng.next() * 0.36;
      ctx.fillStyle = `rgb(${Math.min(255, br * shade) | 0},${Math.min(255, bg * shade) | 0},${Math.min(255, bb * shade) | 0})`;
      ctx.fillRect(col * bw + offset + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  return finalize(canvas, opts.repeat);
}

/** Cut-stone block pattern with soft tone variation. */
export function makeStoneTexture(
  opts: { base?: number; size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const base = opts.base ?? 0xcfc9bd;
  const rng = new PRNG(0x1945a01);
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 6;
  const bw = size / cols;
  const bh = size / rows;
  const [br, bg, bb] = hexToRgb(base);

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col < cols; col++) {
      const shade = 0.9 + rng.next() * 0.2;
      ctx.fillStyle = `rgb(${Math.min(255, br * shade) | 0},${Math.min(255, bg * shade) | 0},${Math.min(255, bb * shade) | 0})`;
      ctx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  // soft horizontal joints
  ctx.strokeStyle = 'rgba(90,85,75,0.35)';
  ctx.lineWidth = 1.5;
  for (let row = 1; row < rows; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * bh);
    ctx.lineTo(size, row * bh);
    ctx.stroke();
  }
  return finalize(canvas, opts.repeat);
}

/** Raw concrete with subtle noise and panel seams. */
export function makeConcreteTexture(
  opts: { base?: number; size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const base = opts.base ?? 0xb6bcc2;
  const rng = new PRNG(0x1965c01);
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, size, size);

  const [br, bg, bb] = hexToRgb(base);
  for (let i = 0; i < 2200; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const shade = 0.85 + rng.next() * 0.3;
    ctx.fillStyle = `rgba(${Math.min(255, br * shade) | 0},${Math.min(255, bg * shade) | 0},${Math.min(255, bb * shade) | 0},0.5)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  // horizontal panel seams
  ctx.strokeStyle = 'rgba(70,75,80,0.4)';
  ctx.lineWidth = 2;
  for (let row = 1; row < 4; row++) {
    ctx.beginPath();
    ctx.moveTo(0, (row * size) / 4);
    ctx.lineTo(size, (row * size) / 4);
    ctx.stroke();
  }
  return finalize(canvas, opts.repeat);
}

/** Window grid (frames + glass panes) for walk-ups / mid-rises. */
export function makeWindowGridTexture(
  opts: { frame?: number; glass?: number; size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const frame = opts.frame ?? 0x3a3f44;
  const glass = opts.glass ?? 0x9fb8c8;
  const rng = new PRNG(0x1965a01);
  const [canvas, ctx] = makeCanvas(size);

  const cols = 3;
  const rows = 4;
  const cw = size / cols;
  const ch = size / rows;
  const [gr, gg, gb] = hexToRgb(glass);

  ctx.fillStyle = rgb(frame);
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tint = 0.7 + rng.next() * 0.6;
      ctx.fillStyle = `rgb(${Math.min(255, gr * tint) | 0},${Math.min(255, gg * tint) | 0},${Math.min(255, gb * tint) | 0})`;
      ctx.fillRect(c * cw + 5, r * ch + 5, cw - 10, ch - 10);
      // reflection streak
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(c * cw + 6, r * ch + 6, (cw - 12) * 0.4, 2);
    }
  }
  return finalize(canvas, opts.repeat);
}

/** Glass curtain wall with mullions and per-pane tint. */
export function makeGlassCurtainTexture(
  opts: { glass?: number; mullion?: number; size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const glass = opts.glass ?? 0x9fc3d8;
  const mullion = opts.mullion ?? 0x3a4a55;
  const rng = new PRNG(0x1985a01);
  const [canvas, ctx] = makeCanvas(size);

  const cols = 6;
  const rows = 8;
  const cw = size / cols;
  const ch = size / rows;
  const [gr, gg, gb] = hexToRgb(glass);

  ctx.fillStyle = rgb(glass);
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tint = 0.72 + rng.next() * 0.56;
      ctx.fillStyle = `rgb(${Math.min(255, gr * tint) | 0},${Math.min(255, gg * tint) | 0},${Math.min(255, gb * tint) | 0})`;
      ctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(c * cw + 3, r * ch + 3, (cw - 8) * 0.45, 2.5);
    }
  }
  ctx.strokeStyle = rgb(mullion);
  ctx.lineWidth = 3;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, size);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * ch);
    ctx.lineTo(size, r * ch);
    ctx.stroke();
  }
  return finalize(canvas, opts.repeat);
}

/** Vertical-garden foliage panel (dense green leaves on a dark backing). */
export function makeGreenFacadeTexture(
  opts: { size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const rng = new PRNG(0x2025a01);
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(0x16281c);
  ctx.fillRect(0, 0, size, size);

  const greens = [0x2e7d3b, 0x4caf50, 0x66bb6a, 0x1b5e20, 0x81c784, 0x388e3c];
  for (let i = 0; i < 420; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const radius = 2 + rng.next() * 6;
    const color = greens[Math.floor(rng.next() * greens.length)];
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few leaf clusters
  for (let i = 0; i < 60; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    ctx.fillStyle = 'rgba(120,200,120,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + rng.next() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas, opts.repeat);
}

/** Photovoltaic solar panel with a cell grid. */
export function makeSolarTexture(
  opts: { size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const rng = new PRNG(0x2025b01);
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(0x0c1a28);
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const cw = size / cols;
  const ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tint = 0.75 + rng.next() * 0.4;
      ctx.fillStyle = `rgba(30,70,120,${tint})`;
      ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
      // bus bar
      ctx.fillStyle = 'rgba(200,215,230,0.6)';
      ctx.fillRect(c * cw + cw / 2 - 0.5, r * ch + 1, 1, ch - 2);
    }
  }
  ctx.strokeStyle = 'rgba(160,180,200,0.7)';
  ctx.lineWidth = 1.5;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, size);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * ch);
    ctx.lineTo(size, r * ch);
    ctx.stroke();
  }
  return finalize(canvas, opts.repeat);
}

/** Striped fabric awning. */
export function makeAwningTexture(
  base: number,
  accent: number,
  opts: { size?: number; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const size = opts.size ?? 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, size, size);
  const stripe = size / 6;
  ctx.fillStyle = rgb(accent);
  for (let i = 0; i < 6; i += 2) {
    ctx.fillRect(i * stripe, 0, stripe, size);
  }
  // subtle scalloped shading lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * stripe, 0);
    ctx.lineTo(i * stripe, size);
    ctx.stroke();
  }
  return finalize(canvas, opts.repeat);
}
