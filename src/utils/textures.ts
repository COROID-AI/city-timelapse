import * as THREE from "three";
import { SeededRNG } from "./math";

/**
 * Procedural canvas textures. Every color/emissive texture is tagged
 * SRGBColorSpace. These are shared across all six eras (textures are not
 * opacity-sensitive, so crossfading is handled at the material level).
 */

export interface TextureSet {
  /** Grayscale window facades of varying density — tinted per building. */
  readonly facades: THREE.CanvasTexture[];
  /** Glass curtain-wall facade — modern eras. */
  readonly glass: THREE.CanvasTexture;
  /** Asphalt with subtle noise. */
  readonly asphalt: THREE.CanvasTexture;
  /** Concrete sidewalk. */
  readonly concrete: THREE.CanvasTexture;
  /** Dashed road center line. */
  readonly dashLine: THREE.CanvasTexture;
  /** Leaf/foliage sprite. */
  readonly foliage: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finalize(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

interface FacadeOpts {
  cols: number;
  rows: number;
  windowChance: number;
  frame: string;
  wall: string;
  glassLight: string;
  glassDark: string;
}

function drawFacade(
  canvas: HTMLCanvasElement,
  o: FacadeOpts,
  rng: SeededRNG
): void {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = o.wall;
  ctx.fillRect(0, 0, w, h);

  const mx = 6;
  const my = 8;
  const cw = (w - mx * 2) / o.cols;
  const ch = (h - my * 2) / o.rows;
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const x = mx + c * cw;
      const y = my + r * ch;
      const lit = rng.chance(o.windowChance * 0.18);
      ctx.fillStyle = lit ? o.glassLight : o.glassDark;
      ctx.fillRect(x + cw * 0.16, y + ch * 0.14, cw * 0.68, ch * 0.66);
    }
  }
  // frame trim
  ctx.strokeStyle = o.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function makeFacadeTexture(opts: FacadeOpts): THREE.CanvasTexture {
  const rng = new SeededRNG(opts.cols * 911 + opts.rows * 131 + 7);
  const canvas = makeCanvas(128, 128);
  drawFacade(canvas, opts, rng);
  return finalize(canvas);
}

function makeGlassTexture(): THREE.CanvasTexture {
  const rng = new SeededRNG(4242);
  const canvas = makeCanvas(128, 256);
  const ctx = canvas.getContext("2d")!;
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#c7d6e6");
  grd.addColorStop(1, "#8fa6c2");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cols = 6;
  const rows = 14;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng.chance(0.22)) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(c * cw + cw * 0.2, r * ch + ch * 0.2, cw * 0.5, ch * 0.4);
      }
    }
  }
  return finalize(canvas);
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  const rng = new SeededRNG(99);
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3a3d42";
  ctx.fillRect(0, 0, 128, 128);
  const img = ctx.getImageData(0, 0, 128, 128);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = rng.range(-16, 16);
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const tex = finalize(canvas);
  texWrapRepeat(tex, 6, 6);
  return tex;
}

function makeConcreteTexture(): THREE.CanvasTexture {
  const rng = new SeededRNG(17);
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#9a9a96";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  for (let y = 0; y <= 128; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, 128, 128);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = rng.range(-12, 8);
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return finalize(canvas);
}

function makeDashLineTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(64, 8);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 8);
  ctx.fillStyle = "#f3e9c0";
  ctx.fillRect(6, 2, 40, 4);
  const tex = finalize(canvas);
  texWrapRepeat(tex, 1, 40);
  return tex;
}

function makeFoliageTexture(): THREE.CanvasTexture {
  const rng = new SeededRNG(2024);
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 44);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const cy = -i * 11;
    const r = 18 - i * 2.5;
    ctx.moveTo(-r, cy);
    ctx.lineTo(0, cy - r - 6);
    ctx.lineTo(r, cy);
    ctx.closePath();
    const g = 110 + rng.range(-25, 35);
    ctx.fillStyle = `rgb(${g * 0.5}, ${g}, ${g * 0.5})`;
    ctx.fill();
  }
  return finalize(canvas);
}

function texWrapRepeat(tex: THREE.Texture, rx: number, ry: number): void {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
}

/** Generate a sign/billboard CanvasTexture with era text. */
export interface SignOpts {
  text: string;
  bg: string;
  fg: string;
  accent?: string;
  w?: number;
  h?: number;
  sub?: string;
  neon?: boolean;
}

export function makeSignTexture(opts: SignOpts): THREE.CanvasTexture {
  const w = opts.w ?? 256;
  const h = opts.h ?? 96;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, w, h);
  if (opts.accent) {
    ctx.fillStyle = opts.accent;
    ctx.fillRect(0, h - 8, w, 8);
  }
  // glow border for neon
  if (opts.neon) {
    ctx.shadowColor = opts.fg;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = opts.fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = opts.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.floor(h * 0.5);
  ctx.font = `800 ${fs}px ${"'Arial Black', Impact, sans-serif"}`;
  ctx.fillText(opts.text, w / 2, h * (opts.sub ? 0.42 : 0.5));
  if (opts.sub) {
    ctx.font = `600 ${Math.floor(h * 0.2)}px sans-serif`;
    ctx.fillStyle = opts.fg;
    ctx.globalAlpha = 0.8;
    ctx.fillText(opts.sub, w / 2, h * 0.78);
    ctx.globalAlpha = 1;
  }
  return finalize(canvas);
}

export function createTextureSet(): TextureSet {
  const facades: THREE.CanvasTexture[] = [
    makeFacadeTexture({
      cols: 4,
      rows: 5,
      windowChance: 0.85,
      frame: "#2a2a2a",
      wall: "#3a3a3a",
      glassLight: "#d9c9a0",
      glassDark: "#16181d",
    }),
    makeFacadeTexture({
      cols: 5,
      rows: 7,
      windowChance: 0.9,
      frame: "#262626",
      wall: "#323234",
      glassLight: "#cfe0ee",
      glassDark: "#14161b",
    }),
    makeFacadeTexture({
      cols: 3,
      rows: 4,
      windowChance: 0.7,
      frame: "#33302a",
      wall: "#403a32",
      glassLight: "#e6d3a8",
      glassDark: "#1b1714",
    }),
    makeFacadeTexture({
      cols: 6,
      rows: 9,
      windowChance: 0.95,
      frame: "#202428",
      wall: "#2c3036",
      glassLight: "#bcd4ee",
      glassDark: "#101216",
    }),
  ];

  return {
    facades,
    glass: makeGlassTexture(),
    asphalt: makeAsphaltTexture(),
    concrete: makeConcreteTexture(),
    dashLine: makeDashLineTexture(),
    foliage: makeFoliageTexture(),
  };
}

export function disposeTextureSet(set: TextureSet): void {
  set.facades.forEach((t) => t.dispose());
  set.glass.dispose();
  set.asphalt.dispose();
  set.concrete.dispose();
  set.dashLine.dispose();
  set.foliage.dispose();
}
