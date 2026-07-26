import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { SignStyle } from './slotContract.js';

/**
 * Canvas-generated signage textures.
 *
 * Every storefront sign is drawn on a 2D canvas and uploaded as a
 * `CanvasTexture` — keeping the project **license-free** (no external image
 * assets). Each `SignStyle` gets its own painting routine tuned to its era:
 *
 * - `painted`      → hand-lettered type on a wood/wall background (1945).
 * - `neon`         → glowing tube strokes on a dark panel (1965/1985).
 * - `backlit`      → translucent plastic lightbox with printed letters (1985/2005).
 * - `led`          → bright high-contrast digital lightbox (2005/2025).
 * - `holographic`  → scanline, chromatic aberration, additive look (2055).
 *
 * Neon / LED / holographic signs emit bright colors above the bloom threshold so
 * the post-processing pipeline makes them glow; painted signs stay matte.
 */

/** Result of painting a sign: the diffuse map and an emissive-intensity hint. */
export interface PaintedSign {
  /** Canvas texture to use as the sign's map (and emissive map for glow). */
  texture: CanvasTexture;
  /**
   * Emissive intensity multiplier. Emissive styles (neon/led/holographic) get a
   * high value so they clear the bloom threshold; painted signs get 0.
   */
  emissiveIntensity: number;
}

/** Default sign canvas dimensions (2:1 aspect, wide storefront signage). */
const SIGN_W = 512;
const SIGN_H = 256;

// ---------------------------------------------------------------------------
// Era-correct typography
// ---------------------------------------------------------------------------

/** Font stack preferences per sign style. */
function fontStyle(style: SignStyle): string {
  switch (style) {
    case 'painted':
      // Serif "painted board" feel.
      return `bold ${SIGN_H * 0.34}px "Georgia", "Times New Roman", serif`;
    case 'neon':
      // Rounded tube look.
      return `bold ${SIGN_H * 0.4}px "Arial Black", "Helvetica Neue", sans-serif`;
    case 'backlit':
      // Condensed lightbox print.
      return `bold ${SIGN_H * 0.36}px "Arial Narrow", "Helvetica Neue", sans-serif`;
    case 'led':
      // Pixel/digital scoreboard feel.
      return `bold ${SIGN_H * 0.42}px "Consolas", "Courier New", monospace`;
    case 'holographic':
      // Sleek future type.
      return `bold ${SIGN_H * 0.4}px "Segoe UI", "Helvetica Neue", sans-serif`;
  }
}

/** Era-appropriate accent color for the sign lettering. */
function defaultLetterColor(style: SignStyle): string {
  switch (style) {
    case 'painted':
      return '#f0e2c8';
    case 'neon':
      return '#ff4d8a';
    case 'backlit':
      return '#fff0c0';
    case 'led':
      return '#5dffce';
    case 'holographic':
      return '#9fffe0';
  }
}

// ---------------------------------------------------------------------------
// Background painters
// ---------------------------------------------------------------------------

function paintPaintedBackground(ctx: CanvasRenderingContext2D): void {
  // Warm wood / painted-board backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, SIGN_H);
  grad.addColorStop(0, '#3a2e20');
  grad.addColorStop(1, '#241b12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
  // Wood-grain streaks.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = 10; y < SIGN_H; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= SIGN_W; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 2);
    }
    ctx.stroke();
  }
  // Faded border frame.
  ctx.strokeStyle = '#6b5d4a';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, SIGN_W - 12, SIGN_H - 12);
}

function paintNeonBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
  // Subtle vignette.
  const radial = ctx.createRadialGradient(
    SIGN_W / 2, SIGN_H / 2, 20,
    SIGN_W / 2, SIGN_H / 2, SIGN_W / 1.5,
  );
  radial.addColorStop(0, 'rgba(255,77,138,0.12)');
  radial.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
}

function paintBacklitBackground(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, SIGN_H);
  grad.addColorStop(0, '#3a3328');
  grad.addColorStop(0.5, '#4a4030');
  grad.addColorStop(1, '#3a3328');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
}

function paintLedBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#08120e';
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
}

function paintHolographicBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#04101a';
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
  // Cyan-magenta gradient sweep.
  const grad = ctx.createLinearGradient(0, 0, SIGN_W, 0);
  grad.addColorStop(0, 'rgba(159,255,224,0.10)');
  grad.addColorStop(0.5, 'rgba(128,224,255,0.14)');
  grad.addColorStop(1, 'rgba(192,128,255,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);
  // Scanlines.
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < SIGN_H; y += 4) {
    ctx.fillRect(0, y, SIGN_W, 1);
  }
}

// ---------------------------------------------------------------------------
// Lettering painters
// ---------------------------------------------------------------------------

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  fill: string,
  baselineY: number,
): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, SIGN_W / 2, baselineY);
}

function paintPaintedText(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  // Hand-lettered look: serif type with a subtle dark outline + drop shadow.
  const font = fontStyle('painted');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 3;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a120a';
  drawCenteredText(ctx, text, font, 'transparent', SIGN_H / 2); // outline pass
  ctx.restore();
  drawCenteredText(ctx, text, font, color, SIGN_H / 2);
}

function paintNeonText(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  const font = fontStyle('neon');
  ctx.save();
  ctx.shadowColor = color;
  // Multiple glow passes simulate a neon tube halo.
  ctx.shadowBlur = 30;
  drawCenteredText(ctx, text, font, color, SIGN_H / 2);
  ctx.shadowBlur = 18;
  drawCenteredText(ctx, text, font, color, SIGN_H / 2);
  ctx.shadowBlur = 8;
  drawCenteredText(ctx, text, font, '#ffffff', SIGN_H / 2); // hot core
  ctx.restore();
}

function paintBacklitText(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  const font = fontStyle('backlit');
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  drawCenteredText(ctx, text, font, color, SIGN_H / 2);
  ctx.shadowBlur = 4;
  drawCenteredText(ctx, text, font, '#ffffff', SIGN_H / 2);
  ctx.restore();
}

function paintLedText(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  const font = fontStyle('led');
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  drawCenteredText(ctx, text, font, color, SIGN_H / 2);
  ctx.shadowBlur = 6;
  drawCenteredText(ctx, text, font, '#ffffff', SIGN_H / 2);
  ctx.restore();
}

function paintHolographicText(ctx: CanvasRenderingContext2D, text: string): void {
  const font = fontStyle('holographic');
  ctx.save();
  // Chromatic-aberration offsets (red/cyan ghosts).
  ctx.shadowBlur = 0;
  drawCenteredText(ctx, text, font, 'rgba(255,60,120,0.7)', SIGN_H / 2 + 3);
  drawCenteredText(ctx, text, font, 'rgba(60,255,220,0.7)', SIGN_H / 2 - 3);
  // Bright additive core.
  ctx.shadowColor = '#9fffe0';
  ctx.shadowBlur = 24;
  drawCenteredText(ctx, text, font, '#eafff8', SIGN_H / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Paint a storefront sign onto a canvas texture. The sign's text, style, and
 * accent color are derived from the era-appropriate storefront definition.
 *
 * @param text   shop name to render.
 * @param style  sign rendering style.
 * @param color  accent color override for the lettering (falls back to the
 *               style default when omitted).
 */
export function paintStorefrontSign(
  text: string,
  style: SignStyle,
  color?: string,
): PaintedSign {
  const canvas = document.createElement('canvas');
  canvas.width = SIGN_W;
  canvas.height = SIGN_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for storefront sign');
  }

  // Background per style.
  switch (style) {
    case 'painted':
      paintPaintedBackground(ctx);
      break;
    case 'neon':
      paintNeonBackground(ctx);
      break;
    case 'backlit':
      paintBacklitBackground(ctx);
      break;
    case 'led':
      paintLedBackground(ctx);
      break;
    case 'holographic':
      paintHolographicBackground(ctx);
      break;
  }

  // Lettering per style with explicit accent color.
  const accent = color ?? defaultLetterColor(style);
  switch (style) {
    case 'painted':
      paintPaintedText(ctx, text, accent);
      break;
    case 'neon':
      paintNeonText(ctx, text, accent);
      break;
    case 'backlit':
      paintBacklitText(ctx, text, accent);
      break;
    case 'led':
      paintLedText(ctx, text, accent);
      break;
    case 'holographic':
      paintHolographicText(ctx, text);
      break;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  // Emissive intensity: high for glowing styles, zero for matte painted signs.
  const emissiveIntensity =
    style === 'painted'
      ? 0
      : style === 'backlit'
        ? 1.6
        : style === 'neon'
          ? 2.4
          : style === 'led'
            ? 2.2
            : 2.8; // holographic

  return { texture, emissiveIntensity };
}
