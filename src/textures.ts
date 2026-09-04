/**
 * Procedural CanvasTexture generation — no external assets.
 * All textures are generated once at startup and shared between meshes.
 */

import * as THREE from 'three';

export type ProceduralTexture = THREE.CanvasTexture;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, srgb = true): ProceduralTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Deterministic pseudo-random generator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WindowTextureOptions {
  facade: string;
  frame: string;
  glass: string;
  emissive: string;
  lit: number;
  columns: number;
  rows: number;
  litAlpha?: number;
}

/** A repeating grid of lit/unlit windows for a building facade. */
export function createWindowTexture(opts: WindowTextureOptions): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  const rnd = mulberry32(0x9e3779b9 ^ opts.columns * 7919 ^ opts.rows * 104729);
  ctx.fillStyle = opts.facade;
  ctx.fillRect(0, 0, 256, 512);
  const cw = 256 / opts.columns;
  const ch = 512 / opts.rows;
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.columns; c++) {
      const x = c * cw;
      const y = r * ch;
      ctx.fillStyle = opts.frame;
      ctx.fillRect(x, y, cw, ch);
      const lit = rnd() < opts.lit;
      ctx.fillStyle = lit ? opts.emissive : opts.glass;
      ctx.globalAlpha = lit ? (opts.litAlpha ?? 0.95) : 0.9;
      ctx.fillRect(x + cw * 0.12, y + ch * 0.12, cw * 0.76, ch * 0.76);
      ctx.globalAlpha = 1;
      // subtle frame highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + cw * 0.12, y + ch * 0.12, cw * 0.76, ch * 0.76);
    }
  }
  return toTexture(canvas);
}

export interface BrickTextureOptions {
  base: string;
  mortar: string;
  rows?: number;
}

/** Brick wall texture with per-brick colour variation. */
export function createBrickTexture(opts: BrickTextureOptions): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rnd = mulberry32(0xabcd1234);
  const rows = opts.rows ?? 12;
  const bh = 256 / rows;
  const bw = 32;
  ctx.fillStyle = opts.mortar;
  ctx.fillRect(0, 0, 256, 256);
  const base = hexToRgb(opts.base);
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -bw / 2;
    for (let x = -1; x < 256 / bw + 1; x++) {
      const v = 0.75 + rnd() * 0.5;
      const col = `rgb(${Math.round(base[0] * v)},${Math.round(base[1] * v)},${Math.round(base[2] * v)})`;
      ctx.fillStyle = col;
      ctx.fillRect(x * bw + offset, r * bh + 1, bw - 2, bh - 2);
    }
  }
  return toTexture(canvas);
}

export interface AsphaltTextureOptions {
  base: string;
  noise?: number;
}

/** Asphalt with speckle noise. */
export function createAsphaltTexture(opts: AsphaltTextureOptions): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rnd = mulberry32(0xfeedface);
  ctx.fillStyle = opts.base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const v = 0.6 + rnd() * 0.8;
    ctx.fillStyle = `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${(opts.noise ?? 0.06) * rnd()})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return toTexture(canvas);
}

export interface CanvasTextureOptions {
  text: string;
  bg: string;
  fg: string;
  accent?: string;
  glow?: number;
  font?: string;
  sub?: string;
}

/** A billboard / sign texture with crisp text and a glow band. */
export function createSignTexture(opts: CanvasTextureOptions): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, 512, 256);
  // accent stripe
  if (opts.accent) {
    ctx.fillStyle = opts.accent;
    ctx.fillRect(0, 0, 512, 24);
    ctx.fillRect(0, 232, 512, 24);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = opts.font ?? 'bold 64px system-ui, sans-serif';
  ctx.font = font;
  if (opts.glow) {
    ctx.shadowColor = opts.fg;
    ctx.shadowBlur = opts.glow * 12;
  }
  ctx.fillStyle = opts.fg;
  ctx.fillText(opts.text, 256, opts.sub ? 100 : 128);
  if (opts.sub) {
    ctx.shadowBlur = 0;
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(opts.sub, 256, 176);
  }
  return toTexture(canvas);
}

/** Faint checkout-lane dashes for the road. */
export function createRoadLineTexture(): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(64, 128);
  ctx.clearRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(8, 8, 48, 40);
  return toTexture(canvas, false);
}

/** Simple noise texture for terrain variation. */
export function createNoiseTexture(seed = 0x12345678): ProceduralTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const rnd = mulberry32(seed);
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(110 + rnd() * 40);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, false);
}

/** Soft radial glow sprite used for lamps and neon. */
export function createGlowSprite(color: string, size = 128): THREE.Texture {
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color.replace(')', ',0.5)').replace('rgb', 'rgba'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface TextureSet {
  window: ProceduralTexture;
  brick: ProceduralTexture;
  asphalt: ProceduralTexture;
  roadLine: ProceduralTexture;
  noise: ProceduralTexture;
  glow: THREE.Texture;
}

/** Generate the shared texture set once at startup. */
export function createTextureSet(): TextureSet {
  return {
    window: createWindowTexture({
      facade: '#40444a',
      frame: '#26282d',
      glass: '#1b2a33',
      emissive: '#ffd9a0',
      lit: 0.55,
      columns: 6,
      rows: 12,
    }),
    brick: createBrickTexture({ base: '#7a4a3a', mortar: '#3a2a22' }),
    asphalt: createAsphaltTexture({ base: '#2c2c30' }),
    roadLine: createRoadLineTexture(),
    noise: createNoiseTexture(),
    glow: createGlowSprite('rgb(255,220,150)'),
  };
}