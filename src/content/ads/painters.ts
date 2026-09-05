/**
 * src/content/ads/painters.ts — ad texture painters (synchronous, cacheable).
 *
 * Each media family draws onto the same cached CanvasTexture pipeline as the
 * storefront signage:
 *   mural    — weathered hand-painted wall with border + headline + sub
 *   neon     — dark tube panel with glow text and a tipped neon frame
 *   billboard — bright printed paper with headline + sub + accent band
 *   screen   — dark LED panel with glowing text + scanline rows
 *
 * Every painter is deterministic and cached by the spec JSON, so swapping
 * between eras during a morph is a map-pointer swap only (no hitches).
 */

import * as THREE from 'three';

import { paintCanvasTexture } from '../storefronts/signage';
import type { AdSpec } from '../../eras';

function baseDims(media: AdSpec['media']): { w: number; h: number } {
  switch (media) {
    case 'mural':
      return { w: 320, h: 200 };
    case 'neon':
      return { w: 256, h: 128 };
    case 'billboard':
      return { w: 360, h: 180 };
    case 'screen':
      return { w: 320, h: 120 };
  }
}

/** Draw a horizontal LED scanline row pattern over dark blue-black. */
function drawScanlines(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Painted-wall mural: flat wash, border, halftone-ish texture, stacked text. */
export function drawMural(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: AdSpec,
): void {
  ctx.fillStyle = spec.palette.background;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = spec.palette.accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = spec.palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
}

/** Neon sign: dark panel, glow text, dotted frame, tips. */
export function drawNeon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: AdSpec,
): void {
  ctx.fillStyle = spec.palette.background;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = spec.palette.glow || '#ffffff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = spec.palette.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.restore();
  // tips
  ctx.fillStyle = spec.palette.accent;
  for (let x = 24; x < w - 16; x += 26) {
    ctx.fillRect(x, h - 10, 6, 5);
  }
}

/** Printed billboard: bright paper, headline band, sub line. */
export function drawBillboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: AdSpec,
): void {
  ctx.fillStyle = spec.palette.background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = spec.palette.accent;
  ctx.fillRect(0, 0, w, 26);
  ctx.strokeStyle = spec.palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, w - 8, h - 8);
}

/** Digital screen: dark panel, glow text, scanlines. */
export function drawScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: AdSpec,
): void {
  ctx.fillStyle = spec.palette.background;
  ctx.fillRect(0, 0, w, h);
  drawScanlines(ctx, w, h, '#9fe8ff');
  ctx.save();
  ctx.shadowColor = spec.palette.glow || '#9fe8ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = spec.palette.ink;
  ctx.font = `800 ${Math.round(h / 4)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.headline, w / 2, h / 2);
  ctx.restore();
}

/** Cache-keyed ad texture builder: dispatch by media. */
export function paintAdTexture(spec: AdSpec): THREE.CanvasTexture {
  const { w, h } = baseDims(spec.media);
  const key = `ad|${JSON.stringify(spec)}`;
  return paintCanvasTexture(key, w, h, (ctx) => {
    switch (spec.media) {
      case 'mural':
        drawMural(ctx, w, h, spec);
        break;
      case 'neon':
        drawNeon(ctx, w, h, spec);
        break;
      case 'billboard':
        drawBillboard(ctx, w, h, spec);
        break;
      case 'screen':
        drawScreen(ctx, w, h, spec);
        break;
    }
  });
}