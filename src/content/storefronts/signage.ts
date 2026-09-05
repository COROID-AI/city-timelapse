/**
 * src/content/storefronts/signage.ts — synchronous, cacheable CanvasTexture
 * painting shared by the storefront and advertising builders.
 *
 * Extends the foundation CanvasTexture utility (canvas -> cached
 * THREE.CanvasTexture, sRGB, anisotropy) with period typography, colors and
 * layouts:
 *
 *  - every texture is drawn once on an offscreen canvas and wrapped in a
 *    THREE.CanvasTexture synchronously, then cached by a stable key from the
 *    draw spec — morph transitions only re-assign material.map (already
 *    uploaded), so there are no frame hitches,
 *  - drawing is deterministic: a seeded RNG keeps "hand-painted" lettering
 *    jitter stable across rebuilds,
 *  - the foundation helper is still used directly for small generic shapes
 *    (neon bulb dots) via createCanvasTextureCached.
 *
 * DOM-bound: these functions require a browser canvas. Node tests exercise
 * the pure spec/registration logic in the modules instead.
 */

import * as THREE from 'three';

import type { EraId } from '../../eras';

const CACHE = new Map<string, THREE.CanvasTexture>();

/** One drawn line of a wordmark (stacked inside a sign panel). */
export interface SignLineSpec {
  text: string;
  size: number;
  color: string;
  /** Optional per-line font override. */
  family?: string;
  /** Optional per-line font weight. */
  weight?: string | number;
  /** Extra letter spacing in px. */
  tracking?: number;
}

/** Stacking/glow/jitter options for a multi-line wordmark. */
export interface StackedTextOptions {
  glow?: string;
  glowBlur?: number;
  outline?: { color: string; width: number };
  /** Hand-painted look: per-letter offset from a seeded RNG. */
  handPainted?: boolean;
  /** Seed string for the hand-painted jitter (stable per sign). */
  handSeed?: string;
}

/** Painter options for a street sign panel (sign band / awning header). */
export interface SignPanelSpec {
  background: string;
  borderColor?: string;
  borderWidth?: number;
  lines: SignLineSpec[];
  /** Base family used by lines that do not override it. */
  familyDefault?: string;
  /** Stacked options for the wordmark. */
  stacked?: StackedTextOptions;
  /** Width in px (default 320). */
  width?: number;
  /** Height in px (default 88). */
  height?: number;
}

/** Painter options for a storefront display window. */
export interface WindowDisplaySpec {
  era: EraId;
  headline: string;
  sub: string;
  background: string;
  accent: string;
  ink: string;
}

/** Painter options for a storefront entrance door panel. */
export interface DoorTextureSpec {
  era: EraId;
}

/** Painter options for a transparent glass decal (2005/2025 storefronts). */
export interface DecalPaintSpec {
  text: string;
  sub: string;
  color: string;
  accent: string;
  family: string;
  weight: string | number;
  tracking: number;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (mulberry32) — stable texture pixels per seed string. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('signage: 2d canvas context unavailable');
  }
  return [canvas, ctx];
}

/** Cache-keyed texture builder: draws once per key+size, reuses on repeat. */
export function paintCanvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const cacheKey = `${key}|${width}x${height}`;
  const cached = CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }
  const [canvas, ctx] = makeCanvas(width, height);
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  CACHE.set(cacheKey, texture);
  return texture;
}

function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  const chars = [...text];
  let total = 0;
  for (let i = 0; i < chars.length; i += 1) {
    total += ctx.measureText(chars[i]).width;
    if (i < chars.length - 1) {
      total += tracking;
    }
  }
  return total;
}

/** Fit font size so the whole line fits `maxWidth`. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: string | number,
  family: string,
  tracking: number,
  maxWidth: number,
): number {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (measureText(ctx, text, tracking) > maxWidth && current > 8) {
    current -= 1;
    ctx.font = `${weight} ${current}px ${family}`;
  }
  return current;
}

/** Draw one wordmark line centered at (cx, cy). */
function drawLine(
  ctx: CanvasRenderingContext2D,
  line: SignLineSpec,
  cx: number,
  cy: number,
  baseFamily: string,
  options: StackedTextOptions,
  maxWidth: number,
): void {
  const family = line.family ?? baseFamily;
  const weight = line.weight ?? 700;
  const tracking = line.tracking ?? 0;
  const size = fitSize(ctx, line.text, line.size, weight, family, tracking, maxWidth);
  ctx.font = `${weight} ${size}px ${family}`;
  const totalWidth = measureText(ctx, line.text, tracking);
  let px = cx - totalWidth / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = line.color;
  ctx.strokeStyle = options.outline?.color ?? '#000000';
  ctx.lineWidth = options.outline?.width ?? 0;
  const chars = [...line.text];
  const rng =
    options.handPainted && options.handSeed
      ? mulberry32(hashString(options.handSeed))
      : null;
  const glow = options.glow;
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = options.glowBlur ?? 14;
  }
  for (const ch of chars) {
    const advance = ctx.measureText(ch).width;
    const dx = rng ? (rng() - 0.5) * size * 0.2 : 0;
    const dy = rng ? (rng() - 0.5) * size * 0.14 : 0;
    const rot = rng ? (rng() - 0.5) * 0.1 : 0;
    ctx.save();
    ctx.translate(px + advance / 2 + dx, cy + dy);
    ctx.rotate(rot);
    if (options.outline && options.outline.width > 0) {
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    px += advance + tracking;
  }
  if (glow) {
    ctx.restore();
  }
}

/** Stack several wordmark lines vertically around (cx, cy). */
function drawStacked(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  lines: SignLineSpec[],
  baseFamily: string,
  options: StackedTextOptions = {},
  maxWidth: number,
): void {
  const gap = 0.3;
  let total = 0;
  for (let i = 0; i < lines.length; i += 1) {
    total += lines[i].size * (i === lines.length - 1 ? 1 : 1 + gap);
  }
  let y = cy - total / 2 + (lines[0]?.size ?? 0) / 2;
  for (const line of lines) {
    drawLine(ctx, line, cx, y, baseFamily, options, maxWidth);
    y += line.size * (1 + gap);
  }
}

// ---------------------------------------------------------------------------
// Sign / awning / door / window textures
// ---------------------------------------------------------------------------

/** Rounded sign panel: background + border + stacked wordmark. */
export function paintStreetSign(spec: SignPanelSpec): THREE.CanvasTexture {
  const width = spec.width ?? 320;
  const height = spec.height ?? 88;
  const key = `streetSign|${JSON.stringify(spec)}`;
  return paintCanvasTexture(key, width, height, (ctx, w, h) => {
    if (spec.background !== 'transparent') {
      ctx.fillStyle = spec.background;
      ctx.fillRect(0, 0, w, h);
    }
    if (spec.borderColor && spec.borderWidth) {
      ctx.strokeStyle = spec.borderColor;
      ctx.lineWidth = spec.borderWidth;
      ctx.strokeRect(
        spec.borderWidth / 2,
        spec.borderWidth / 2,
        w - spec.borderWidth,
        h - spec.borderWidth,
      );
    }
    drawStacked(
      ctx,
      w / 2,
      h / 2 - 2,
      spec.lines,
      spec.familyDefault ?? '"Helvetica Neue", Arial, sans-serif',
      spec.stacked ?? {},
      w - 20,
    );
  });
}

/** Stripe pattern texture used by the canvas awnings of 1945. */
export function paintAwningStripeTexture(
  colors: string[],
  segments = 14,
  direction: 'vertical' | 'horizontal' = 'vertical',
): THREE.CanvasTexture {
  const key = `awning|${colors.join('')}|${segments}|${direction}`;
  return paintCanvasTexture(key, 256, 128, (ctx, w, h) => {
    const count = Math.max(2, Math.round(segments));
    const stripe = direction === 'vertical' ? w / count : h / count;
    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = colors[i % colors.length];
      if (direction === 'vertical') {
        ctx.fillRect(Math.floor(i * stripe), 0, Math.ceil(stripe), h);
      } else {
        ctx.fillRect(0, Math.floor(i * stripe), w, Math.ceil(stripe));
      }
    }
  });
}

/** Painted storefront display window: era motif + headline/sub. */
export function paintWindowDisplayTexture(
  spec: WindowDisplaySpec,
): THREE.CanvasTexture {
  const key = `display|${JSON.stringify(spec)}`;
  return paintCanvasTexture(key, 256, 160, (ctx, w, h) => {
    const rng = mulberry32(hashString(spec.era + spec.headline));
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, spec.background);
    bg.addColorStop(1, spec.background);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const shelY = h * 0.62;
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, shelY, w, h - shelY);
    drawDisplayMotif(ctx, spec, w, shelY, rng);
    ctx.fillStyle = spec.accent;
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = spec.ink;
    ctx.font = '700 15px "Georgia", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.headline, w / 2, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 12px "Arial", sans-serif';
    ctx.fillText(spec.sub, w / 2, h - 9);
  });
}

/** Era-specific motifs painted inside the display window. */
function drawDisplayMotif(
  ctx: CanvasRenderingContext2D,
  spec: WindowDisplaySpec,
  w: number,
  shelY: number,
  rng: () => number,
): void {
  const shelf = () => shelY + rng() * 4;
  switch (spec.era) {
    case '1945': {
      for (let i = 0; i < 3; i += 1) {
        const x = 34 + i * 62;
        const jw = 26;
        const jh = 40 + rng() * 20;
        ctx.fillStyle = i % 2 === 0 ? '#e8d9a0' : '#d8c9a8';
        ctx.fillRect(x - jw / 2, shelf() - jh, jw, jh);
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(x - jw / 2 - 3, shelf() - jh - 6, jw + 6, 6);
        ctx.fillStyle = '#3c2a1a';
        ctx.beginPath();
        ctx.arc(x, shelf() - jh / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      const pennant = ['#c9a227', '#b03a2e'];
      for (let i = 0; i < 2; i += 1) {
        const x = 40 + i * 130;
        ctx.fillStyle = pennant[i];
        ctx.beginPath();
        ctx.moveTo(x - 26, 26);
        ctx.lineTo(x + 26, 26);
        ctx.lineTo(x, 38);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case '1965': {
      ctx.fillStyle = '#f4e0c0';
      ctx.fillRect(0, shelY + 8, w, 14);
      ctx.fillStyle = '#c2576b';
      ctx.fillRect(16, shelY - 24, 54, 26);
      ctx.fillStyle = '#7ea3a5';
      ctx.fillRect(30, shelY - 24, 12, 26);
      ctx.fillRect(48, shelY - 24, 12, 26);
      ctx.fillRect(66, shelY - 24, 12, 26);
      ctx.fillStyle = '#1d2333';
      ctx.fillRect(w - 74, shelY - 44, 58, 58);
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = ['#ffd23f', '#ff5c8a', '#7fe8ff'][i];
        ctx.fillRect(w - 66, shelY - 36 + i * 16, 42, 6);
      }
      break;
    }
    case '1985': {
      for (let i = 0; i < 3; i += 1) {
        const x = 26 + i * 70;
        ctx.fillStyle = '#120a1e';
        ctx.fillRect(x, shelY - 46, 46, 60);
        for (let j = 0; j < 3; j += 1) {
          ctx.fillStyle = ['#ff2fd6', '#39ffd0', '#2fd6ff'][j];
          ctx.fillRect(x + 6 + j * 15, shelY - 40, 8, 48);
        }
      }
      ctx.save();
      ctx.shadowColor = '#ff2fd6';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff2fd6';
      ctx.font = '800 14px "Arial Black", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NOW RENTING', w / 2, 28);
      ctx.restore();
      break;
    }
    case '2005': {
      for (let i = 0; i < 2; i += 1) {
        const y = shelY - 12 - i * 26;
        ctx.strokeStyle = '#c4ccd4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(22, y);
        ctx.lineTo(w - 22, y);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i += 1) {
        const x = 40 + i * 52;
        const y = shelY - 34 - (i % 2) * 20;
        ctx.fillStyle = ['#155bd4', '#c0392b', '#1d6b3f', '#e0b25c'][i];
        ctx.fillRect(x - 12, y - 22, 24, 34);
        ctx.fillStyle = '#f4f0e6';
        ctx.fillRect(x - 8, y - 16, 16, 10);
      }
      ctx.fillStyle = '#c0392b';
      ctx.font = '800 13px "Arial", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOW PRICES', w / 2, 24);
      break;
    }
    case '2025': {
      ctx.fillStyle = '#3e6b52';
      ctx.beginPath();
      ctx.arc(46, shelY - 18, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(58, shelY - 40, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2622';
      ctx.fillRect(w - 84, shelY - 52, 56, 44);
      ctx.fillStyle = '#9fe8d6';
      ctx.fillRect(w - 78, shelY - 46, 44, 32);
      ctx.fillStyle = '#e8e4d8';
      ctx.font = '600 12px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PICKUP', w / 2, 22);
      break;
    }
  }
}

/** Door panel texture — the entrance "style" is stamped here per era. */
export function paintDoorTexture(spec: DoorTextureSpec): THREE.CanvasTexture {
  const era = spec.era;
  const key = `door|${JSON.stringify(spec)}`;
  return paintCanvasTexture(key, 128, 256, (ctx, w, h) => {
    if (era === '1945') {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#6b4a2f');
      g.addColorStop(1, '#46331f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i += 1) {
        ctx.strokeStyle = '#23190f';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 14 + i * 74, w - 16, 44);
      }
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.arc(w - 22, h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (era === '1965') {
      ctx.fillStyle = '#e8e2d4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#9c9c91';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#7c8ea8';
      ctx.fillRect(18, 18, w - 36, h - 80);
      ctx.fillStyle = '#3d5568';
      ctx.font = '700 18px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OPEN', w / 2, h - 52);
      return;
    }
    if (era === '1985') {
      ctx.fillStyle = '#10101c';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.shadowColor = '#ff2fd6';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ff2fd6';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.restore();
      ctx.fillStyle = '#39ffd0';
      ctx.font = '800 20px "Arial Black", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OPEN', w / 2, h - 46);
      return;
    }
    if (era === '2005') {
      ctx.fillStyle = '#dfe7ee';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8a929c';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(16, 40, w - 32, h - 80);
      ctx.fillStyle = '#155bd4';
      ctx.font = '700 14px "Arial", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AUTO', w / 2, h - 24);
      return;
    }
    ctx.fillStyle = '#232a33';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5d6f84';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#9fe8d6';
    ctx.font = '600 15px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AUTO', w / 2, h - 26);
  });
}

/** Transparent glass decal texture (vinyl sticker look, 2005/2025). */
export function paintDecalTexture(spec: DecalPaintSpec): THREE.CanvasTexture {
  const key = `decal|${JSON.stringify(spec)}`;
  return paintCanvasTexture(key, 256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = spec.color;
    ctx.font = `${spec.weight} 34px ${spec.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.text, w / 2, h / 2 - 10);
    ctx.fillStyle = spec.accent;
    ctx.font = `600 ${12 + spec.tracking * 0.2}px ${spec.family}`;
    ctx.fillText(spec.sub, w / 2, h / 2 + 16);
  });
}