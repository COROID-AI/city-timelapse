/**
 * Procedural canvas-based texture generation for era-appropriate visuals.
 *
 * Every texture is generated deterministically from the {@link EraSpec} — the
 * same era always yields the same pixels. Textures are cached by
 * (eraId, category[, variant]) and reused on subsequent calls.
 *
 * No external image files are used; everything is drawn on an offscreen canvas
 * and wrapped in a `THREE.CanvasTexture`.
 */
import * as THREE from 'three';
import type { EraSpec } from '../eraRegistry';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random number generator (shared with other builders)
// ---------------------------------------------------------------------------

/** Hash an arbitrary string into a 32-bit unsigned integer seed. */
function hashStringToSeed(str: string): number {
  let h = 1779033703 ^ str.length;
 for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Mulberry32 — a fast, deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic random generator producing floats in [0, 1). */
export type Rng = () => number;

/** Build a deterministic RNG from a seed string. */
export function makeRng(seedString: string): Rng {
  return mulberry32(hashStringToSeed(seedString));
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round((percent / 100) * 255);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseInt(a.replace('#', ''), 16);
  const cb = parseInt(b.replace('#', ''), 16);
  const ar = (ca >> 16) & 0xff;
  const ag = (ca >> 8) & 0xff;
  const ab = ca & 0xff;
  const br = (cb >> 16) & 0xff;
  const bg = (cb >> 8) & 0xff;
  const bb = cb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bch = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bch).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function createCanvas(width: number, height: number): CanvasHandle {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D canvas context for procedural texture');
  return { canvas, ctx };
}

function toCanvasTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Clone a cached texture so the caller can set an independent `repeat`. */
export function cloneForRepeat(
  tex: THREE.CanvasTexture,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  const clone = tex.clone();
  clone.needsUpdate = true;
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(repeatX, repeatY);
  return clone;
}

// ---------------------------------------------------------------------------
// Facade textures (per era building style)
// ---------------------------------------------------------------------------

interface FacadePair {
  albedo: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

const facadeCache = new Map<string, FacadePair>();

/**
 * Draw a single window into both the albedo and emissive contexts.
 * Lit windows glow with the era's emissive colour on the emissive map.
 */
function drawWindow(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spec: EraSpec,
  rng: Rng,
  litChance: number,
): void {
  const building = spec.buildings;
  // Frame
  a.fillStyle = building.trimColor;
  a.fillRect(x - 3, y - 3, w + 6, h + 6);
  // Glass
  a.fillStyle = building.windowColor;
  a.fillRect(x, y, w, h);
  // Reflection streak
  a.fillStyle = 'rgba(255,255,255,0.07)';
  a.fillRect(x, y, w * 0.3, h);
  // Emissive (lit at night)
  if (rng() < litChance) {
    e.fillStyle = building.windowEmissiveColor;
    e.fillRect(x, y, w, h);
    // warm inner glow
    e.fillStyle = shadeColor(building.windowEmissiveColor, 12);
    e.fillRect(x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5);
  }
}

function drawBrickWalkup(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  size: number,
  spec: EraSpec,
  rng: Rng,
  facadeColor: string,
): void {
  const building = spec.buildings;
  // Wall base
  a.fillStyle = facadeColor;
  a.fillRect(0, 0, size, size);

  // Brick mortar lines
  const rows = 14;
  const brickH = size / rows;
  a.strokeStyle = 'rgba(0,0,0,0.22)';
  a.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(r * brickH) + 0.5;
    a.beginPath();
    a.moveTo(0, y);
    a.lineTo(size, y);
    a.stroke();
    const offset = (r % 2) * (size / 4);
    for (let bx = 0; bx <= 4; bx++) {
      const x = Math.round(offset + bx * (size / 2)) + 0.5;
      a.beginPath();
      a.moveTo(x, y - brickH);
      a.lineTo(x, y);
      a.stroke();
    }
  }
  // Subtle brick variation
  for (let i = 0; i < 70; i++) {
    a.fillStyle = `rgba(0,0,0,${rng() * 0.12})`;
    a.fillRect(rng() * size, rng() * size, 3, brickH * 0.5);
  }

  // Double-hung window (centred)
  const winW = size * 0.46;
  const winH = size * 0.58;
  const winX = (size - winW) / 2;
  const winY = (size - winH) / 2;
  drawWindow(a, e, winX, winY, winW, winH, spec, rng, 0.45);
  // Horizontal mullion (double-hung)
  a.fillStyle = building.trimColor;
  a.fillRect(winX, winY + winH / 2 - 1.5, winW, 3);
  // Sill
  a.fillStyle = shadeColor(building.trimColor, -18);
  a.fillRect(winX - 6, winY + winH + 4, winW + 12, 5);
}

function drawMidCentury(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  size: number,
  spec: EraSpec,
  rng: Rng,
  facadeColor: string,
): void {
  const building = spec.buildings;
  // Concrete base
  a.fillStyle = facadeColor;
  a.fillRect(0, 0, size, size);

  // Horizontal concrete panel lines (spandrel)
  a.strokeStyle = 'rgba(0,0,0,0.18)';
  a.lineWidth = 2;
  a.beginPath();
  a.moveTo(0, size * 0.28);
  a.lineTo(size, size * 0.28);
  a.stroke();

  // Spandrel band (slightly darker)
  a.fillStyle = shadeColor(facadeColor, -10);
  a.fillRect(0, 0, size, size * 0.26);

  // Ribbon window (wide, short)
  const winW = size * 0.82;
  const winH = size * 0.5;
  const winX = (size - winW) / 2;
  const winY = size * 0.3;
  drawWindow(a, e, winX, winY, winW, winH, spec, rng, 0.4);
  // Vertical mullions dividing the ribbon
  a.fillStyle = building.trimColor;
  for (let m = 1; m < 4; m++) {
    a.fillRect(winX + (winW / 4) * m - 1, winY, 2, winH);
  }
}

function drawCurtainWall(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  size: number,
  spec: EraSpec,
  rng: Rng,
  facadeColor: string,
): void {
  const building = spec.buildings;
  // Glass base (mostly window)
  a.fillStyle = lerpColor(building.windowColor, facadeColor, 0.25);
  a.fillRect(0, 0, size, size);

  // Reflective tint streaks
  for (let i = 0; i < 8; i++) {
    a.fillStyle = `rgba(255,255,255,${0.04 + rng() * 0.05})`;
    a.fillRect(0, rng() * size, size, 4 + rng() * 8);
  }

  // Thin mullion grid (frameless curtain wall) — edges + centre
  a.fillStyle = building.trimColor;
  a.fillRect(0, 0, size, 4);
  a.fillRect(0, size - 4, size, 4);
  a.fillRect(0, 0, 4, size);
  a.fillRect(size - 4, 0, 4, size);
  a.fillRect(size / 2 - 1.5, 0, 3, size);
  a.fillRect(0, size / 2 - 1.5, size, 3);

  // Glass panes — four lit panes independently
  const panes = [
    [4, 4, size / 2 - 6, size / 2 - 8],
    [size / 2 + 2, 4, size / 2 - 6, size / 2 - 8],
    [4, size / 2 + 2, size / 2 - 6, size / 2 - 6],
    [size / 2 + 2, size / 2 + 2, size / 2 - 6, size / 2 - 6],
  ];
  for (const [px, py, pw, ph] of panes) {
    if (rng() < 0.5) {
      e.fillStyle = building.windowEmissiveColor;
      e.fillRect(px, py, pw, ph);
    }
  }
}

function drawMixedUseGlass(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  size: number,
  spec: EraSpec,
  rng: Rng,
  facadeColor: string,
): void {
  const building = spec.buildings;
  // Spandrel band (opaque) at bottom 30%
  a.fillStyle = shadeColor(facadeColor, -14);
  a.fillRect(0, 0, size, size * 0.3);
  // Glass above
  a.fillStyle = lerpColor(building.windowColor, facadeColor, 0.15);
  a.fillRect(0, size * 0.3, size, size * 0.7);

  // Frame trim around glass zone
  a.fillStyle = building.trimColor;
  a.fillRect(0, size * 0.3 - 3, size, 3);
  a.fillRect(0, 0, 3, size);
  a.fillRect(size - 3, 0, 3, size);

  // Two large windows
  const winW = (size - 12) / 2;
  const winH = size * 0.55;
  drawWindow(a, e, 6, size * 0.34, winW, winH, spec, rng, 0.35);
  drawWindow(a, e, 6 + winW, size * 0.34, winW, winH, spec, rng, 0.35);
}

function drawEcoSmartGlass(
  a: CanvasRenderingContext2D,
  e: CanvasRenderingContext2D,
  size: number,
  spec: EraSpec,
  rng: Rng,
  facadeColor: string,
): void {
  const building = spec.buildings;
  // Seamless gradient glass (smart-glass tint)
  const grad = a.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, lerpColor(building.windowColor, facadeColor, 0.4));
  grad.addColorStop(1, lerpColor(building.windowColor, facadeColor, 0.1));
  a.fillStyle = grad;
  a.fillRect(0, 0, size, size);

  // Smart-glass tint variation (some panels darker)
  for (let i = 0; i < 5; i++) {
    a.fillStyle = `rgba(20,30,40,${0.05 + rng() * 0.1})`;
    a.fillRect(rng() * size, rng() * size, size * 0.3, size * 0.3);
  }

  // Frameless: very thin mullions
  a.fillStyle = 'rgba(180,190,200,0.25)';
  a.fillRect(size / 2 - 0.5, 0, 1, size);
  a.fillRect(0, size / 2 - 0.5, size, 1);

  // Glass panes lit
  const cells = [
    [0, 0, size / 2, size / 2],
    [size / 2, 0, size / 2, size / 2],
    [0, size / 2, size / 2, size / 2],
    [size / 2, size / 2, size / 2, size / 2],
  ];
  for (const [px, py, pw, ph] of cells) {
    if (rng() < 0.4) {
      e.fillStyle = building.windowEmissiveColor;
      e.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    }
  }
}

function generateFacadePair(spec: EraSpec, paletteIndex: number): FacadePair {
  const size = 256;
  const albedo = createCanvas(size, size);
  const emissive = createCanvas(size, size);
  emissive.ctx.fillStyle = '#000000';
  emissive.ctx.fillRect(0, 0, size, size);

  const facadeColor =
    spec.buildings.facadePalette[paletteIndex % spec.buildings.facadePalette.length];
  const rng = makeRng(`${spec.eraId}:facade:${paletteIndex}`);

  switch (spec.buildings.style) {
    case 'brick-walkup':
      drawBrickWalkup(albedo.ctx, emissive.ctx, size, spec, rng, facadeColor);
      break;
    case 'mid-century-concrete':
      drawMidCentury(albedo.ctx, emissive.ctx, size, spec, rng, facadeColor);
      break;
    case 'glass-curtain-wall':
      drawCurtainWall(albedo.ctx, emissive.ctx, size, spec, rng, facadeColor);
      break;
    case 'mixed-use-glass':
      drawMixedUseGlass(albedo.ctx, emissive.ctx, size, spec, rng, facadeColor);
      break;
    case 'eco-smart-glass':
      drawEcoSmartGlass(albedo.ctx, emissive.ctx, size, spec, rng, facadeColor);
      break;
  }

  return { albedo: toCanvasTexture(albedo.canvas, true), emissive: toCanvasTexture(emissive.canvas, true) };
}

function getFacadePair(spec: EraSpec, paletteIndex: number): FacadePair {
  const key = `${spec.eraId}:facade:${paletteIndex % spec.buildings.facadePalette.length}`;
  let pair = facadeCache.get(key);
  if (!pair) {
    pair = generateFacadePair(spec, paletteIndex);
    facadeCache.set(key, pair);
  }
  return pair;
}

export function getFacadeTexture(spec: EraSpec, paletteIndex: number): THREE.CanvasTexture {
  return getFacadePair(spec, paletteIndex).albedo;
}

export function getWindowEmissiveTexture(spec: EraSpec, paletteIndex: number): THREE.CanvasTexture {
  return getFacadePair(spec, paletteIndex).emissive;
}

// ---------------------------------------------------------------------------
// Asphalt texture
// ---------------------------------------------------------------------------

const asphaltCache = new Map<string, THREE.CanvasTexture>();

function generateAsphaltTexture(spec: EraSpec): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const street = spec.streets;
  ctx.fillStyle = street.asphaltColor;
  ctx.fillRect(0, 0, size, size);
  const rng = makeRng(`${spec.eraId}:asphalt`);

  // Grain / speckle
  for (let i = 0; i < 1400; i++) {
    const v = rng();
    ctx.fillStyle = v < 0.5
      ? `rgba(0,0,0,${0.04 + rng() * 0.08})`
      : `rgba(255,255,255,${0.02 + rng() * 0.05})`;
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }

  // Cracks
  const cracks = Math.floor(street.asphaltCrackiness * 6);
  for (let c = 0; c < cracks; c++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.2 + rng() * 0.25})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let x = rng() * size;
    let y = rng() * size;
    ctx.moveTo(x, y);
    const segs = randInt(rng, 3, 6);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Patch marks (era-dependent: older eras more patched)
  if (rng() < street.asphaltCrackiness) {
    ctx.fillStyle = `rgba(0,0,0,0.12)`;
    ctx.fillRect(rng() * size, rng() * size, 30 + rng() * 50, 20 + rng() * 40);
  }

  return toCanvasTexture(canvas, true);
}

export function getAsphaltTexture(spec: EraSpec): THREE.CanvasTexture {
  const key = `${spec.eraId}:asphalt`;
  let tex = asphaltCache.get(key);
  if (!tex) {
    tex = generateAsphaltTexture(spec);
    asphaltCache.set(key, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Sidewalk texture
// ---------------------------------------------------------------------------

const sidewalkCache = new Map<string, THREE.CanvasTexture>();

function generateSidewalkTexture(spec: EraSpec): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const street = spec.streets;
  ctx.fillStyle = street.sidewalkColor;
  ctx.fillRect(0, 0, size, size);
  const rng = makeRng(`${spec.eraId}:sidewalk`);

  // Concrete speckle
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.06})`;
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }

  // Expansion joints (grid) — represents one slab tile
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  // Subtle inner joint for larger slabs
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Stains (older eras = more stains)
  const stains = Math.floor((1 - street.asphaltCrackiness) * 0 + 4);
  for (let s = 0; s < stains; s++) {
    ctx.fillStyle = `rgba(80,70,50,${0.05 + rng() * 0.08})`;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 4 + rng() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  return toCanvasTexture(canvas, true);
}

export function getSidewalkTexture(spec: EraSpec): THREE.CanvasTexture {
  const key = `${spec.eraId}:sidewalk`;
  let tex = sidewalkCache.get(key);
  if (!tex) {
    tex = generateSidewalkTexture(spec);
    sidewalkCache.set(key, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Lane-marking texture (for road centre line)
// ---------------------------------------------------------------------------

const laneCache = new Map<string, THREE.CanvasTexture>();

function generateLaneTexture(spec: EraSpec): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const street = spec.streets;
  ctx.fillStyle = street.laneMarkingColor;
  const style = street.laneMarkingStyle;
  if (style === 'solid-white' || style === 'dashed-white') {
    if (style === 'solid-white') {
      ctx.fillRect(0, h * 0.35, w, h * 0.3);
    } else {
      const dash = 48;
      for (let x = 0; x < w; x += dash * 2) {
        ctx.fillRect(x, h * 0.35, dash, h * 0.3);
      }
    }
  } else if (style === 'dashed-yellow') {
    const dash = 48;
    for (let x = 0; x < w; x += dash * 2) {
      ctx.fillRect(x, h * 0.35, dash, h * 0.3);
    }
  } else if (style === 'double-yellow') {
    ctx.fillRect(0, h * 0.28, w, h * 0.12);
    ctx.fillRect(0, h * 0.6, w, h * 0.12);
  }
  return toCanvasTexture(canvas, true);
}

export function getLaneMarkingTexture(spec: EraSpec): THREE.CanvasTexture {
  const key = `${spec.eraId}:lane`;
  let tex = laneCache.get(key);
  if (!tex) {
    tex = generateLaneTexture(spec);
    laneCache.set(key, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Signage texture (storefronts / ads)
// ---------------------------------------------------------------------------

const signageCache = new Map<string, THREE.CanvasTexture>();

function generateSignageTexture(spec: EraSpec, contentIndex: number): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const { canvas, ctx } = createCanvas(w, h);
  const sign = spec.signage;
  const content = sign.adContent[contentIndex % sign.adContent.length];
  const color = pick(makeRng(`${spec.eraId}:sign:${contentIndex}`), sign.palette);
  const rng = makeRng(`${spec.eraId}:sign:${contentIndex}:draw`);
  const fontSize = randInt(rng, sign.fontSizes[0], sign.fontSizes[1]);

  switch (sign.style) {
    case 'hand-painted-awning': {
      // Painted board
      ctx.fillStyle = shadeColor(color, -30);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#f5ecd0';
      ctx.font = `bold ${fontSize}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(content, w / 2, h * 0.42);
      // Awning stripes below
      const stripeH = 18;
      for (let x = 0; x < w; x += 24) {
        ctx.fillStyle = x % 48 === 0 ? shadeColor(color, 10) : '#f5ecd0';
        ctx.fillRect(x, h - stripeH, 24, stripeH);
      }
      break;
    }
    case 'neon-tube': {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `bold ${fontSize}px "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = color;
      ctx.fillText(content, w / 2, h / 2);
      ctx.shadowBlur = 8;
      ctx.fillText(content, w / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.fillText(content, w / 2, h / 2);
      ctx.globalAlpha = 1;
      break;
    }
    case 'fluorescent-box': {
      ctx.fillStyle = shadeColor(color, 40);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#101010';
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(content, w / 2, h / 2);
      break;
    }
    case 'backlit-vinyl': {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, shadeColor(color, 25));
      grad.addColorStop(1, shadeColor(color, -5));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${fontSize}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(content, w / 2, h / 2);
      // backlit glow border
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      break;
    }
    case 'led-digital': {
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
      // pixel grid hint
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 1, h);
      for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.fillText(content, w / 2, h / 2);
      ctx.shadowBlur = 0;
      break;
    }
  }

  return toCanvasTexture(canvas, false);
}

export function getSignageTexture(spec: EraSpec, contentIndex: number): THREE.CanvasTexture {
  const key = `${spec.eraId}:sign:${contentIndex % spec.signage.adContent.length}`;
  let tex = signageCache.get(key);
  if (!tex) {
    tex = generateSignageTexture(spec, contentIndex);
    signageCache.set(key, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Sky texture (vertical gradient + era atmosphere)
// ---------------------------------------------------------------------------

const skyCache = new Map<string, THREE.CanvasTexture>();

function generateSkyTexture(spec: EraSpec): THREE.CanvasTexture {
  const w = 64;
  const h = 512;
  const { canvas, ctx } = createCanvas(w, h);
  const sky = spec.sky;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, sky.topColor);
  grad.addColorStop(1, sky.bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rng = makeRng(`${spec.eraId}:sky`);

  // Era atmosphere: 1985 = smoggy haze, others = clouds
  if (spec.eraId === '1985') {
    // smog band near horizon
    ctx.fillStyle = sky.fogColor;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.globalAlpha = 1;
  } else {
    // soft clouds
    for (let i = 0; i < 6; i++) {
      const cy = rng() * h * 0.6 + h * 0.1;
      const cr = 20 + rng() * 50;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + rng() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(rng() * w, cy, cr * 0.6, cr, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return toCanvasTexture(canvas, false);
}

export function getSkyTexture(spec: EraSpec): THREE.CanvasTexture {
  const key = `${spec.eraId}:sky`;
  let tex = skyCache.get(key);
  if (!tex) {
    tex = generateSkyTexture(spec);
    skyCache.set(key, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Aggregate texture set + materials
// ---------------------------------------------------------------------------

export interface EraTextureSet {
  facadeTextures: THREE.CanvasTexture[];
  windowEmissiveTextures: THREE.CanvasTexture[];
  asphaltTexture: THREE.CanvasTexture;
  sidewalkTexture: THREE.CanvasTexture;
  laneMarkingTexture: THREE.CanvasTexture;
  skyTexture: THREE.CanvasTexture;
}

const textureSetCache = new Map<string, EraTextureSet>();

export function getEraTextureSet(spec: EraSpec): EraTextureSet {
  const key = spec.eraId;
  let set = textureSetCache.get(key);
  if (!set) {
    const facadeTextures = spec.buildings.facadePalette.map((_, i) => getFacadeTexture(spec, i));
    const windowEmissiveTextures = spec.buildings.facadePalette.map((_, i) =>
      getWindowEmissiveTexture(spec, i),
    );
    set = {
      facadeTextures,
      windowEmissiveTextures,
      asphaltTexture: getAsphaltTexture(spec),
      sidewalkTexture: getSidewalkTexture(spec),
      laneMarkingTexture: getLaneMarkingTexture(spec),
      skyTexture: getSkyTexture(spec),
    };
    textureSetCache.set(key, set);
  }
  return set;
}

/** Era-appropriate roughness/metalness for a building facade material. */
function facadeMaterialParams(style: EraSpec['buildings']['style']): {
  roughness: number;
  metalness: number;
} {
  switch (style) {
    case 'brick-walkup':
      return { roughness: 0.85, metalness: 0.0 };
    case 'mid-century-concrete':
      return { roughness: 0.8, metalness: 0.0 };
    case 'glass-curtain-wall':
      return { roughness: 0.18, metalness: 0.15 };
    case 'mixed-use-glass':
      return { roughness: 0.22, metalness: 0.1 };
    case 'eco-smart-glass':
      return { roughness: 0.12, metalness: 0.2 };
  }
}

/**
 * Build a facade material for a specific building, cloning the cached texture
 * with the correct repeat for the given face dimensions.
 */
export function buildFacadeMaterial(
  spec: EraSpec,
  paletteIndex: number,
  repeatX: number,
  repeatY: number,
): THREE.MeshStandardMaterial {
  const params = facadeMaterialParams(spec.buildings.style);
  const map = cloneForRepeat(getFacadeTexture(spec, paletteIndex), repeatX, repeatY);
  const emissiveMap = cloneForRepeat(getWindowEmissiveTexture(spec, paletteIndex), repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: '#ffffff',
    emissiveIntensity: 0.7,
    roughness: params.roughness,
    metalness: params.metalness,
  });
}

export function buildAsphaltMaterial(
  spec: EraSpec,
  repeatX: number,
  repeatY: number,
): THREE.MeshStandardMaterial {
  const map = cloneForRepeat(getAsphaltTexture(spec), repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.0 });
}

export function buildSidewalkMaterial(
  spec: EraSpec,
  repeatX: number,
  repeatY: number,
): THREE.MeshStandardMaterial {
  const map = cloneForRepeat(getSidewalkTexture(spec), repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.0 });
}

export function buildSkyMaterial(spec: EraSpec): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: getSkyTexture(spec),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

export function clearTextureCache(): void {
  for (const tex of facadeCache.values()) {
    tex.albedo.dispose();
    tex.emissive.dispose();
  }
  facadeCache.clear();
  for (const tex of asphaltCache.values()) tex.dispose();
  asphaltCache.clear();
  for (const tex of sidewalkCache.values()) tex.dispose();
  sidewalkCache.clear();
  for (const tex of laneCache.values()) tex.dispose();
  laneCache.clear();
  for (const tex of signageCache.values()) tex.dispose();
  signageCache.clear();
  for (const tex of skyCache.values()) tex.dispose();
  skyCache.clear();
  textureSetCache.clear();
}
