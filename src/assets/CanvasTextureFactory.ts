/**
 * src/assets/CanvasTextureFactory.ts — synchronous CanvasTexture generation.
 *
 * Every visual asset in this project is procedural: no runtime downloads. This
 * module turns canvas draws (text, gradients, shapes) into `THREE.CanvasTexture`
 * synchronously so scene and era-content modules can build materials inline.
 *
 * Textures are cached by a stable cache key so repeated calls for the same
 * visual (e.g. shared window grids) reuse the GPU upload.
 */

import * as THREE from 'three';

import type { TextureSpec } from '../eras';

export interface CanvasTextureResult {
  /** Canvas-backed texture ready to assign to a material. */
  texture: THREE.CanvasTexture;
  /** Dimensions used for the generated canvas. */
  width: number;
  height: number;
}

const DEFAULT_SIZE = 256;
const CACHE = new Map<string, THREE.CanvasTexture>();

function makeContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CanvasTextureFactory: 2d canvas context unavailable');
  }
  return ctx;
}

function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  options: { fill?: string; font?: string } = {},
): void {
  const fill = options.fill ?? '#ffffff';
  const font = options.font ?? 'bold 64px sans-serif';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, width / 2, height / 2, width - 16);
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: [number, string][],
  angleDeg = 0,
): void {
  const radians = (angleDeg * Math.PI) / 180;
  const x1 = width / 2 - Math.cos(radians) * width;
  const y1 = height / 2 - Math.sin(radians) * width;
  const x2 = width / 2 + Math.cos(radians) * width;
  const y2 = height / 2 + Math.sin(radians) * width;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: 'circle' | 'square' | 'diamond' | 'grid',
  color: string,
): void {
  ctx.fillStyle = color;
  const c = width / 2;
  const r = Math.min(width, height) / 2 - 8;
  switch (kind) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(c - r, c - r, r * 2, r * 2);
      break;
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(c, c - r);
      ctx.lineTo(c + r, c);
      ctx.lineTo(c, c + r);
      ctx.lineTo(c - r, c);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'grid': {
      const slots = 8;
      const margin = r * 0.5;
      const inner = r * 2 - margin * 2;
      const cell = inner / slots;
      for (let i = 0; i < slots; i += 1) {
        for (let j = 0; j < slots; j += 1) {
          if ((i + j) % 2 === 0) {
            ctx.fillRect(c - r + margin + i * cell, c - r + margin + j * cell, cell, cell);
          }
        }
      }
      break;
    }
  }
}

/**
 * Generate a canvas texture from a declarative spec.
 * `spec.kind` selects the drawing routine; `spec.text` is required for 'text'.
 */
export function createCanvasTexture(spec: TextureSpec): CanvasTextureResult {
  const size = spec.size ?? DEFAULT_SIZE;
  const ctx = makeContext(size, size);
  const colors = ['#ffffff'];
  switch (spec.kind) {
    case 'text':
      if (!spec.text) {
        throw new Error('createCanvasTexture: spec.kind "text" requires spec.text');
      }
      drawText(ctx, size, size, spec.text);
      break;
    case 'gradient':
      drawGradient(
        ctx,
        size,
        size,
        [
          [0, '#ff6b6b'],
          [0.5, '#4ecdc4'],
          [1, '#1a1a2e'],
        ],
        45,
      );
      break;
    case 'shape':
      drawShape(ctx, size, size, 'circle', colors[0]);
      break;
  }
  const texture = textureFromCanvas(ctx.canvas);
  return { texture, width: size, height: size };
}

/** Cached variant of `createCanvasTexture` keyed by the spec's JSON signature. */
export function createCanvasTextureCached(spec: TextureSpec): CanvasTextureResult {
  const key = JSON.stringify(spec);
  const cached = CACHE.get(key);
  if (cached) {
    return { texture: cached, width: cached.image.width, height: cached.image.height };
  }
  const result = createCanvasTexture(spec);
  CACHE.set(key, result.texture);
  return result;
}

/** Block-scoped helper for a labeled billboard or storefront sign texture. */
export function createLabelTexture(
  text: string,
  options: { fill?: string; size?: number } = {},
): THREE.CanvasTexture {
  return createCanvasTexture({ kind: 'text', text, size: options.size }).texture;
}

/** Clear all cached textures. Call during global cleanup/disposal. */
export function clearCanvasTextureCache(): void {
  for (const texture of CACHE.values()) {
    texture.dispose();
  }
  CACHE.clear();
}