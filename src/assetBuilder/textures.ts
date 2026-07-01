import * as THREE from 'three';
import { type Era, paletteFor } from './eras';

/** Coarse building classification used by {@link makeFacadeTexture}. */
export type BuildingType = 'residential' | 'commercial' | 'office';

/** Texture dimensions shared by signage assets (wider than tall). */
const SIGN_W = 512;
const SIGN_H = 256;

/** Square facade texture size. */
const FACADE = 512;

/** Create a fresh canvas + 2D context; throws if the 2D context is unavailable. */
function createCanvas(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(
      '2D canvas context unavailable; procedural textures require it.',
    );
  }
  return { canvas, ctx };
}

/** Wrap a drawn canvas in a configured CanvasTexture. */
function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Convert a `#rrggbb` colour into an `rgba()` string with the given alpha. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Draw a filled five-point star centred at (cx, cy). */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Manual rounded-rectangle path (caller strokes/fills). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Signage styles — one distinct look per era.
// ---------------------------------------------------------------------------

/** 1945: stenciled poster lettering on kraft paper with a red rule + stars. */
function drawStencilSign(
  ctx: CanvasRenderingContext2D,
  bg: string,
  ink: string,
  accent: string,
  text: string,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  // worn border
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, SIGN_W - 16, SIGN_H - 16);

  // top stencil rule bar
  ctx.fillStyle = accent;
  ctx.fillRect(40, 30, SIGN_W - 80, 22);

  // flanking star motifs
  ctx.fillStyle = ink;
  drawStar(ctx, 64, SIGN_H - 52, 20);
  drawStar(ctx, SIGN_W - 64, SIGN_H - 52, 20);

  ctx.save();
  ctx.font = '900 92px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  ctx.fillText(text, SIGN_W / 2, SIGN_H / 2 + 4);
  // stencil vertical slits cut across the glyphs
  ctx.fillStyle = bg;
  for (let x = SIGN_W / 2 - 170; x < SIGN_W / 2 + 170; x += 34) {
    ctx.fillRect(x, SIGN_H / 2 - 36, 5, 72);
  }
  ctx.restore();
}

/** 1965: glowing neon tube signage on a dark board. */
function drawNeonSign(
  ctx: CanvasRenderingContext2D,
  bg: string,
  tube: string,
  accent: string,
  text: string,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  // soft centre vignette
  const grad = ctx.createRadialGradient(
    SIGN_W / 2,
    SIGN_H / 2,
    40,
    SIGN_W / 2,
    SIGN_H / 2,
    SIGN_W / 1.4,
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 100px "Arial Black", Impact, sans-serif';

  // outer halo
  ctx.shadowColor = accent;
  ctx.shadowBlur = 40;
  ctx.lineWidth = 10;
  ctx.strokeStyle = accent;
  ctx.strokeText(text, SIGN_W / 2, SIGN_H / 2);

  // bright tube core
  ctx.shadowColor = tube;
  ctx.shadowBlur = 22;
  ctx.lineWidth = 6;
  ctx.strokeStyle = tube;
  ctx.strokeText(text, SIGN_W / 2, SIGN_H / 2);
  ctx.restore();

  // mounting frame
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, SIGN_W - 28, SIGN_H - 28);
}

/** 1985: amber/green LED dot-matrix message board. */
function drawDotMatrixSign(
  ctx: CanvasRenderingContext2D,
  bg: string,
  led: string,
  text: string,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  // Render the label to an offscreen mask, then re-plot it as lit LEDs.
  const off = document.createElement('canvas');
  off.width = SIGN_W;
  off.height = SIGN_H;
  const octx = off.getContext('2d');
  if (!octx) return;
  octx.fillStyle = '#fff';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.font = '900 120px "Arial Black", Impact, sans-serif';
  octx.fillText(text, SIGN_W / 2, SIGN_H / 2);
  const data = octx.getImageData(0, 0, SIGN_W, SIGN_H).data;

  const cell = 8;
  for (let y = cell / 2; y < SIGN_H; y += cell) {
    for (let x = cell / 2; x < SIGN_W; x += cell) {
      const idx = (Math.floor(y) * SIGN_W + Math.floor(x)) * 4;
      if (data[idx + 3] > 128) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = led;
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(led, 0.05);
        ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
    }
  }
}

/** 2005: backlit digital panel with a blue gradient and ticker bar. */
function drawBacklitSign(
  ctx: CanvasRenderingContext2D,
  bg: string,
  primary: string,
  accent: string,
  text: string,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, SIGN_H);
  grad.addColorStop(0, '#1b3a5a');
  grad.addColorStop(1, bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  ctx.strokeStyle = rgba(primary, 0.8);
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, SIGN_W - 32, SIGN_H - 32);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 94px "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = primary;
  ctx.shadowBlur = 30;
  ctx.fillStyle = accent;
  ctx.fillText(text, SIGN_W / 2, SIGN_H / 2 - 10);
  ctx.restore();

  // ticker strip
  ctx.fillStyle = rgba(primary, 0.9);
  ctx.fillRect(40, SIGN_H - 44, SIGN_W - 80, 6);
}

/** 2025: iridescent holographic LED signage with scanlines. */
function drawHolographicSign(
  ctx: CanvasRenderingContext2D,
  primary: string,
  accent: string,
  text: string,
): void {
  const grad = ctx.createLinearGradient(0, 0, SIGN_W, 0);
  grad.addColorStop(0, '#0a0a18');
  grad.addColorStop(0.5, '#13213a');
  grad.addColorStop(1, '#0a0a18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  // iridescent sheen
  const ir = ctx.createLinearGradient(0, 0, SIGN_W, SIGN_H);
  ir.addColorStop(0, rgba(primary, 0.25));
  ir.addColorStop(0.5, rgba(accent, 0.18));
  ir.addColorStop(1, rgba(primary, 0.25));
  ctx.fillStyle = ir;
  ctx.fillRect(0, 0, SIGN_W, SIGN_H);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 98px "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = primary;
  ctx.shadowBlur = 35;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, SIGN_W / 2, SIGN_H / 2);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(primary, 0.9);
  ctx.strokeText(text, SIGN_W / 2, SIGN_H / 2);
  ctx.restore();

  // horizontal scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < SIGN_H; y += 4) ctx.fillRect(0, y, SIGN_W, 1);
}

/**
 * Builds a period-appropriate storefront / billboard sign texture.
 *
 * The returned {@link THREE.CanvasTexture} is always non-empty, and its pixel
 * content visibly changes with the `era` argument (stencil -> neon ->
 * dot-matrix -> backlit -> holographic).
 */
export function makeSignTexture(era: Era, label: string): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(SIGN_W, SIGN_H);
  const palette = paletteFor(era);
  const text = (label || ' ').toUpperCase();

  switch (era) {
    case 1945:
      drawStencilSign(ctx, palette.signBackground, palette.primary, palette.accent, text);
      break;
    case 1965:
      drawNeonSign(ctx, palette.signBackground, palette.primary, palette.accent, text);
      break;
    case 1985:
      drawDotMatrixSign(ctx, palette.signBackground, palette.primary, text);
      break;
    case 2005:
      drawBacklitSign(ctx, palette.signBackground, palette.primary, palette.accent, text);
      break;
    case 2025:
      drawHolographicSign(ctx, palette.primary, palette.accent, text);
      break;
  }

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Facade styles — wall + window grid per era / building type.
// ---------------------------------------------------------------------------

function wallColor(era: Era): string {
  switch (era) {
    case 1945:
      return '#6b3a2a';
    case 1965:
      return '#9a958a';
    case 1985:
      return '#c7a86a';
    case 2005:
      return '#3c566e';
    case 2025:
      return '#26384a';
  }
}

function glassColor(era: Era): string {
  switch (era) {
    case 1945:
      return '#2a2a2e';
    case 1965:
      return '#5a6a78';
    case 1985:
      return '#3a6a9a';
    case 2005:
      return '#6aa0c8';
    case 2025:
      return '#7fd0e8';
  }
}

/** Warm "lit window" glow colour, varying slightly per era for variety. */
function warmLight(era: Era): string {
  switch (era) {
    case 1945:
      return '#ffcf6e';
    case 1965:
      return '#ffd98a';
    case 1985:
      return '#ffe9a8';
    case 2005:
      return '#fff0c0';
    case 2025:
      return '#cfeeff';
  }
}

function drawBrick(ctx: CanvasRenderingContext2D): void {
  const rowH = 22;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let y = 0; y < FACADE; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FACADE, y);
    ctx.stroke();
    const offset = (y / rowH) % 2 === 0 ? 0 : 48;
    for (let x = offset; x < FACADE; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
    }
  }
}

function drawConcrete(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let y = 0; y < FACADE; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FACADE, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 32; y < FACADE; y += 64) {
    for (let x = 48; x < FACADE; x += 96) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPastel(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, FACADE, FACADE);
  g.addColorStop(0, 'rgba(255,255,255,0.25)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  g.addColorStop(1, 'rgba(120,140,200,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACADE, FACADE);
}

function drawCurtain(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  for (let x = 0; x < FACADE; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FACADE);
    ctx.stroke();
  }
}

function drawSmartGlass(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, FACADE);
  g.addColorStop(0, '#2a4a5a');
  g.addColorStop(1, '#1a2632');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACADE, FACADE);
  ctx.fillStyle = 'rgba(40,180,120,0.25)';
  for (let x = 24; x < FACADE; x += 160) ctx.fillRect(x, 0, 18, FACADE);
}

function drawWindows(
  ctx: CanvasRenderingContext2D,
  era: Era,
  buildingType: BuildingType,
): void {
  const glass = glassColor(era);
  const margin = 24;
  const groundH = buildingType === 'commercial' ? 96 : 52;
  const cols = 6;
  const rows = 8;
  const areaTop = FACADE - margin;
  const areaBottom = groundH;
  const usableH = areaTop - areaBottom;
  const cellW = (FACADE - margin * 2) / cols;
  const cellH = usableH / rows;
  const ww = cellW * 0.66;
  const wh = cellH * 0.72;

  if (buildingType === 'commercial') {
    ctx.fillStyle = rgba(glass, 0.9);
    ctx.fillRect(margin, margin, FACADE - margin * 2, groundH - margin);
    ctx.fillStyle = paletteFor(era).accent;
    ctx.fillRect(margin, groundH, FACADE - margin * 2, 14);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * cellW + (cellW - ww) / 2;
      const y = areaBottom + r * cellH + (cellH - wh) / 2;

      if (buildingType === 'residential' && (c === 0 || c === cols - 1)) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, ww + 8, wh + 8);
      }

      // Deterministic pseudo-random lit state that also depends on era, so
      // the facade visibly changes between eras.
      const lit = (r * 7 + c * 13 + era) % 5 === 0;
      ctx.fillStyle = lit ? warmLight(era) : rgba(glass, 0.85);
      roundRect(ctx, x, y, ww, wh, 4);
      ctx.fill();

      // mullion cross
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + ww / 2, y);
      ctx.lineTo(x + ww / 2, y + wh);
      ctx.moveTo(x, y + wh / 2);
      ctx.lineTo(x + ww, y + wh / 2);
      ctx.stroke();
    }
  }
}

/**
 * Builds a period-appropriate building facade texture. Wall material, window
 * style and lighting all shift with the `era` argument, while `buildingType`
 * controls ground-floor layout (shopfronts, balconies, or even office grids).
 */
export function makeFacadeTexture(
  era: Era,
  buildingType: BuildingType,
): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(FACADE, FACADE);

  ctx.fillStyle = wallColor(era);
  ctx.fillRect(0, 0, FACADE, FACADE);

  switch (era) {
    case 1945:
      drawBrick(ctx);
      break;
    case 1965:
      drawConcrete(ctx);
      break;
    case 1985:
      drawPastel(ctx);
      break;
    case 2005:
      drawCurtain(ctx);
      break;
    case 2025:
      drawSmartGlass(ctx);
      break;
  }

  drawWindows(ctx, era, buildingType);
  return toTexture(canvas);
}
