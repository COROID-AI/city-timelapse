/**
 * Procedural canvas sign painters for the storefront/signage system.
 *
 * Every sign board, poster, billboard, CRT screen, LED display, media facade,
 * awning, and graffiti panel is generated at runtime on an offscreen 2D
 * canvas — there are no binary assets. All painters are deterministic for a
 * given `seed` (mulberry32 fed from the seeded string) so the same seed
 * always reproduces the exact same texture and tests can assert that.
 *
 * Painters only use plain Canvas2D API calls (no gradients, no
 * `getImageData`, no `measureText`), which keeps drawing trackable in the
 * jsdom-based unit suite while still producing visually distinct eras.
 */

import { CanvasTexture, SRGBColorSpace } from 'three';

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

/** Deterministic mulberry32 PRNG seeded from a string (returns [0,1) each call). */
export function createSeededRng(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Small color / canvas helpers                                        */
/* ------------------------------------------------------------------ */

/** Convert '#rrggbb' to an `rgba(...)` string for layered painting. */
function toRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  return canvas;
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('signTextures: 2D canvas context unavailable');
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Typography helpers                                                  */
/* ------------------------------------------------------------------ */

/** Stacked copy lines (whitespace-trimmed, at least one line). */
function linesOf(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [' '];
}

/**
 * Font pixel size that keeps all `text` lines inside the panel (height is the
 * binding constraint; width uses an approximate 0.6em glyph advance).
 */
function fittedFontSize(text: string, width: number, height: number, margin: number): number {
  const lines = linesOf(text);
  const maxLen = Math.max(...lines.map((l) => l.length));
  const byHeight = (height - margin * 2) / (lines.length * 1.24);
  const byWidth = (width - margin * 2) / Math.max(1, maxLen * 0.62);
  return Math.max(8, Math.min(byHeight, byWidth));
}

/** Stroke font size for tube/phosphor copy (wide glows need extra margin). */
function strokeFontSize(text: string, width: number, height: number): number {
  return fittedFontSize(text, width, height, height * 0.12);
}

/** Draw centered stacked copy on `ctx`, optionally with an offset shadow. */
function drawCopy(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  color: string,
  fontFamily: string,
  weight: string,
  shadowOffsetX = 0,
  shadowOffsetY = 0,
  shadow = 'rgba(0,0,0,0.35)',
): void {
  const lines = linesOf(text);
  const size = fittedFontSize(text, width, height, Math.max(10, height * 0.05));
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i += 1) {
    const y = height / 2 + (i - (lines.length - 1) / 2) * size * 1.24;
    if (shadowOffsetX !== 0 || shadowOffsetY !== 0) {
      ctx.fillStyle = shadow;
      ctx.fillText(lines[i], width / 2 + shadowOffsetX, y + shadowOffsetY);
    }
    ctx.fillStyle = color;
    ctx.fillText(lines[i], width / 2, y);
  }
}

/* ------------------------------------------------------------------ */
/* Sign painting API                                                   */
/* ------------------------------------------------------------------ */

/** Which era-appropriate painting recipe a sign texture uses. */
export type SignTextureKind =
  | 'painted' // 1945 hand-painted wood/enamel
  | 'poster' // 1945 war-bond / local poster
  | 'awning' // 1945 striped canvas storefront awning
  | 'graffiti' // 1985 wall tagging
  | 'neon' // 1965 googie + 1985 neon
  | 'backlit' // 1985–2005 acrylic lightbox
  | 'crt' // 1985 CRT video board
  | 'led' // 2005 LED billboard / matrix
  | 'media'; // 2025 LED media facade / OLED panel

/** Full rendering spec for one procedural sign texture. */
export interface SignPaintSpec {
  /** Main lettering copy; '\n' separates stacked lines. */
  readonly text: string;
  /** Letter / tube / LED color. */
  readonly primary: string;
  /** Trim / border / adjacency color. */
  readonly accent: string;
  /** Panel background color. */
  readonly base: string;
  readonly kind: SignTextureKind;
  readonly width: number;
  readonly height: number;
  /** Determinism seed (typically `<layoutSeed>:<era>:<signId>`). */
  readonly seed: string;
  /** Googie starburst motif (1965 neon). */
  readonly burst?: boolean;
}

/**
 * Render one procedural sign texture to an offscreen canvas and wrap it in a
 * THREE CanvasTexture. Deterministic for the seed in `spec`.
 */
export function createSignTexture(spec: SignPaintSpec): CanvasTexture {
  const canvas = makeCanvas(spec.width, spec.height);
  const ctx = get2d(canvas);
  paintSign(ctx, spec);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Draw one era-authentic sign texture onto `ctx` (deterministic per seed). */
export function paintSign(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  switch (spec.kind) {
    case 'painted':
      paintPainted(ctx, spec);
      break;
    case 'poster':
      paintPoster(ctx, spec);
      break;
    case 'awning':
      paintAwning(ctx, spec);
      break;
    case 'graffiti':
      paintGraffiti(ctx, spec);
      break;
    case 'neon':
      paintNeon(ctx, spec);
      break;
    case 'backlit':
      paintBacklit(ctx, spec);
      break;
    case 'crt':
      paintCrt(ctx, spec);
      break;
    case 'led':
      paintLed(ctx, spec);
      break;
    case 'media':
      paintMedia(ctx, spec);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Era painters                                                        */
/* ------------------------------------------------------------------ */

/** 1945: hand-painted wooden / enamel board with grain and chipped paint. */
function paintPainted(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:painted`);

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);

  // Vertical wood grain: dark streaks over a lighter wash.
  ctx.fillStyle = toRgba('#2b1a08', 0.34);
  const streaks = 6 + Math.round(rng() * 7);
  for (let i = 0; i < streaks; i += 1) {
    const x = rng() * w;
    ctx.fillRect(x, 0, 1 + rng() * 4, h);
  }
  ctx.fillStyle = toRgba('#e8d9b0', 0.12);
  for (let i = 0; i < streaks; i += 1) {
    const x = rng() * w;
    ctx.fillRect(x, 0, 1 + rng() * 3, h);
  }
  // chipped / weathered speckle.
  ctx.fillStyle = toRgba('#171003', 0.24);
  const chips = 8 + Math.round(rng() * 14);
  for (let i = 0; i < chips; i += 1) {
    ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 5, 2 + rng() * 4);
  }
  // Enamel border with an inner hairline.
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = Math.max(3, h * 0.04);
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = toRgba(spec.accent, 0.4);
  ctx.lineWidth = Math.max(1, h * 0.014);
  ctx.strokeRect(2 + h * 0.06, 2 + h * 0.06, w - 4 - h * 0.12, h - 4 - h * 0.12);

  // Corner fasteners.
  ctx.fillStyle = '#23262c';
  const nail = Math.min(6, h * 0.05);
  const corners: ReadonlyArray<[number, number]> = [
    [nail, nail],
    [w - nail, nail],
    [nail, h - nail],
    [w - nail, h - nail],
  ];
  for (const [nx, ny] of corners) {
    ctx.beginPath();
    ctx.arc(nx, ny, nail * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCopy(ctx, spec.text, w, h, spec.primary, 'Georgia, "Times New Roman", serif', '700', 2, 2);
}

/** 1945: war-bond / local poster with a header band and body copy. */
function paintPoster(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:poster`);

  ctx.fillStyle = '#ece7d7'; // aged paper
  ctx.fillRect(0, 0, w, h);
  // Tea stains / creases.
  ctx.fillStyle = toRgba('#000000', 0.06);
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(rng() * w, rng() * h, 8 + rng() * 30, 1 + rng() * 2);
  }

  const lines = linesOf(spec.text);
  // Header band with the first line.
  ctx.fillStyle = spec.accent;
  ctx.fillRect(0, 0, w, h * 0.24);
  drawCopy(ctx, lines[0], w, h * 0.26, '#ffffff', '"Arial Black", Arial, sans-serif', '900', 1, 1);

  // Remaining lines as body copy in a deep ink color.
  const rest = lines.slice(1).join('\n');
  if (rest.length > 0) {
    drawCopy(ctx, rest, w, h * 0.72, toRgba(spec.primary, 0.95), 'Baskerville, "Times New Roman", serif', 'bold', 0, 0);
  }

  // Poster border.
  ctx.strokeStyle = spec.primary;
  ctx.lineWidth = Math.max(3, h * 0.03);
  ctx.strokeRect(3, 3, w - 6, h - 6);
}

/** 1945: striped canvas storefront awning with a scalloped front valance. */
function paintAwning(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:awning`);

  // Vertical canvas stripes (accent over base) with a subtle shadow fold.
  const stripes = 8 + Math.round(rng() * 4);
  const stripePx = w / stripes;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? spec.base : spec.accent;
    ctx.fillRect(i * stripePx, 0, stripePx, h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(i * stripePx + stripePx - 2, 0, 2, h);
  }

  // Scalloped valance along the bottom edge.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.82);
  const scallops = stripes * 2;
  const span = w / scallops;
  for (let i = 0; i < scallops; i += 1) {
    ctx.arc((i + 0.5) * span, h * 0.9, span * 0.52, Math.PI, 0, true);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = spec.accent;
  ctx.fill();
  ctx.strokeStyle = toRgba(spec.primary, 0.5);
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.stroke();
}

/** 1985: spray-paint graffiti tag on a wall panel. */
function paintGraffiti(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:graffiti`);

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);
  // Brick speckle.
  ctx.fillStyle = toRgba('#000000', 0.2);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
  }
  // Two overlapping spray strokes.
  ctx.fillStyle = toRgba(spec.primary, 0.85);
  ctx.fillRect(w * 0.06, h * 0.4, w * 0.24, h * 0.22);
  ctx.fillStyle = toRgba(spec.accent, 0.9);
  ctx.fillRect(w * 0.34, h * 0.48, w * 0.28, h * 0.18);

  // Bubble-letter headline.
  const size = fittedFontSize(spec.text, w * 0.95, h * 0.5, 4);
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cy = h * 0.6;
  ctx.fillStyle = toRgba('#000000', 0.5);
  ctx.fillText(linesOf(spec.text)[0], w / 2 + 3, cy + 3);
  ctx.fillStyle = spec.primary;
  ctx.fillText(linesOf(spec.text)[0], w / 2, cy);

  // Paint drips.
  ctx.fillStyle = toRgba(spec.accent, 0.8);
  for (let i = 0; i < 7; i += 1) {
    const dx = rng() * w;
    ctx.fillRect(dx, h * 0.72, 2 + rng() * 2, h * 0.16 + rng() * h * 0.08);
  }
}

/** Googie star-burst geometry (fill + outline) used on 1965 neon. */
function drawBurst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rng: () => number,
  primary: string,
  accent: string,
): void {
  const spikes = 10;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? r * 0.34 : r * (0.86 + rng() * 0.1);
    const angle = (i / (spikes * 2)) * Math.PI * 2 + rng() * 0.05;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = toRgba(primary, 0.6);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.stroke();
}

/**
 * Neon board (1965 googie & 1985 storefronts): near-black panel, layered tube
 * strokes, perimeter incandescent bulbs, optional starburst.
 */
function paintNeon(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:neon`);

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);

  if (spec.burst) {
    drawBurst(ctx, w * 0.14, h * 0.5, Math.min(w, h) * 0.4, rng, spec.primary, spec.accent);
  }

  // Neon tube text: wide glow -> core stroke -> white inner highlight.
  const lines = linesOf(spec.text);
  const size = strokeFontSize(spec.text, w, h);
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i += 1) {
    const cy = h / 2 + (i - (lines.length - 1) / 2) * size * 1.22;
    ctx.strokeStyle = toRgba(spec.primary, 0.28);
    ctx.lineWidth = size * 0.55;
    ctx.strokeText(lines[i], w / 2, cy);
    ctx.strokeStyle = spec.primary;
    ctx.lineWidth = size * 0.17;
    ctx.strokeText(lines[i], w / 2, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(lines[i], w / 2, cy);
  }

  // Perimeter incandescent bulbs on the top and bottom rails.
  ctx.fillStyle = spec.accent;
  const count = Math.max(8, Math.round(w / 40));
  const bulbR = Math.max(1.5, h * 0.03);
  for (let i = 0; i < count; i += 1) {
    const x = w * ((i + 0.5) / count);
    ctx.beginPath();
    ctx.arc(x, h * 0.05, bulbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, h * 0.95, bulbR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 1985–2005 backlit acrylic lightbox. */
function paintBacklit(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = Math.max(4, h * 0.06);
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = toRgba(spec.accent, 0.35);
  ctx.lineWidth = Math.max(2, h * 0.025);
  ctx.strokeRect(w * 0.05, h * 0.09, w * 0.9, h * 0.82);

  // Diagonal sheen bands (backlit plastic).
  ctx.fillStyle = toRgba('#ffffff', 0.16);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-0.5);
  for (let i = -2; i < 3; i += 1) {
    ctx.fillRect(-w, i * h * 0.34, w * 3, h * 0.07);
  }
  ctx.restore();

  drawCopy(ctx, spec.text, w, h, spec.primary, '"Arial Black", Arial, sans-serif', '900', 2, 2, 'rgba(0,0,0,0.6)');

  // Glossy corner glint.
  ctx.fillStyle = toRgba('#ffffff', 0.16);
  ctx.fillRect(0, 0, w * 0.14, h * 0.08);
}

/** 1985 CRT video scoreboard: dark glass, scanlines, RGB marquee. */
function paintCrt(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:crt`);

  ctx.fillStyle = '#0c1017';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#07121f';
  ctx.fillRect(w * 0.04, h * 0.08, w * 0.92, h * 0.84);

  // Phosphor speckle.
  ctx.fillStyle = toRgba(spec.primary, 0.14);
  for (let i = 0; i < 60; i += 1) {
    ctx.fillRect(w * 0.05 + rng() * w * 0.9, h * 0.1 + rng() * h * 0.7, 1 + rng() * 2, 1 + rng() * 2);
  }
  // Scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  for (let y = h * 0.1; y < h * 0.86; y += 5) {
    ctx.fillRect(w * 0.05, y, w * 0.9, 1);
  }
  // RGB marquee pickets.
  ctx.fillStyle = '#e8314f';
  ctx.fillRect(w * 0.04, h * 0.82, w * 0.28, h * 0.05);
  ctx.fillStyle = '#39e25f';
  ctx.fillRect(w * 0.4, h * 0.82, w * 0.24, h * 0.05);
  ctx.fillStyle = '#3f7fee';
  ctx.fillRect(w * 0.7, h * 0.82, w * 0.26, h * 0.05);

  // Bright phosphor content.
  const lines = linesOf(spec.text);
  const size = strokeFontSize(spec.text, w * 0.86, h * 0.6);
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i += 1) {
    const cy = h * 0.44 + (i - (lines.length - 1) / 2) * size * 1.18;
    ctx.strokeStyle = toRgba(spec.primary, 0.45);
    ctx.lineWidth = size * 0.32;
    ctx.strokeText(lines[i], w / 2, cy);
    ctx.fillStyle = '#dbfff0';
    ctx.fillText(lines[i], w / 2 + 1, cy + 1);
  }
}

/** 2005–2025 LED dot-matrix / large-format digital board. */
function paintLed(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);

  // Dim inactive pixel grid.
  ctx.fillStyle = toRgba(spec.primary, 0.15);
  const step = Math.max(4, Math.round(w / 40));
  for (let py = step / 2; py < h; py += step) {
    for (let px = step / 2; px < w; px += step) {
      ctx.fillRect(px - step * 0.2, py - step * 0.2, step * 0.4, step * 0.4);
    }
  }

  // Bright pixel-space lettering.
  const lines = linesOf(spec.text);
  const size = fittedFontSize(spec.text, w * 0.92, h * 0.7, 8);
  ctx.font = `700 ${size}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i += 1) {
    const cy = h * 0.48 + (i - (lines.length - 1) / 2) * size * 1.2;
    ctx.fillStyle = toRgba('#000000', 0.6);
    ctx.fillText(lines[i], w / 2 + 1.5, cy + 1.5);
    ctx.fillStyle = spec.primary;
    ctx.fillText(lines[i], w / 2, cy);
  }

  // Bottom ticker strip.
  ctx.fillStyle = spec.accent;
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  ctx.fillStyle = toRgba(spec.primary, 0.9);
  for (let x = 0; x < w; x += step * 2) {
    ctx.fillRect(x, h * 0.9 + 2, step * 0.7, h * 0.1 - 4);
  }
}

/** 2025 LED media facade: full-color glowing-glass panel. */
function paintMedia(ctx: CanvasRenderingContext2D, spec: SignPaintSpec): void {
  const { width: w, height: h } = spec;
  const rng = createSeededRng(`${spec.seed}:media`);

  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, w, h);

  // Motion color strips.
  for (let i = 0; i < 4; i += 1) {
    const color = i % 2 === 0 ? spec.primary : spec.accent;
    ctx.fillStyle = toRgba(color, 0.16 + rng() * 0.18);
    ctx.fillRect(0, i * h * 0.17, w, h * 0.1);
  }

  // Bright headline.
  const lines = linesOf(spec.text);
  const size = Math.max(14, fittedFontSize(spec.text, w * 0.96, h * 0.5, 20));
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i += 1) {
    const cy = h * 0.42 + (i - (lines.length - 1) / 2) * size * 1.22;
    ctx.strokeStyle = toRgba(spec.primary, 0.5);
    ctx.lineWidth = size * 0.22;
    ctx.strokeText(lines[i], w / 2 + 1, cy + 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lines[i], w / 2, cy);
  }

  // Edge light row.
  ctx.fillStyle = toRgba(spec.accent, 0.9);
  ctx.fillRect(0, h - 3, w, 3);
}