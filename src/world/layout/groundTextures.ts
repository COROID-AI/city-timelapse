/**
 * Procedural canvas-texture helpers for the city-block ground.
 *
 * Textures are generated at runtime on offscreen `<canvas>` elements and
 * applied as THREE textures — there are no binary assets. Every painter is
 * deterministic for an input `seed` plus the layout geometry it renders.
 */

import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Crosswalk, RoadMarkingLine, Street } from './types';

/** Pixels per layout meter for generated textures. */
const TEXTURE_RESOLUTION = 16;

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

/** Deterministic mulberry32 PRNG (returns [0,1) each call). */
function rngFor(seed: string): () => number {
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

function makeCanvas(widthPx: number, heightPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
}

/** Paint deterministic greyscale asphalt speckle over the whole canvas. */
function paintAsphaltNoise(canvas: HTMLCanvasElement, seed: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rng = rngFor(seed);
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = rng();
    const v = 122 + Math.round((n - 0.5) * 48);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Lane-marking painting                                               */
/* ------------------------------------------------------------------ */

export interface LaneMarkingStyle {
  color: string;
  dash: number; // on-length in world meters
  gap: number; // off-length in world meters
}

/**
 * Create a texture of horizontal dashed/solid lane markings.
 * The band is stretched across the texture width (no repeat seam).
 */
export function createLaneMarkingTexture(
  options: {
    widthMeters: number;
    heightMeters: number;
    seed: string;
    style: 'solid' | 'dashed';
    color: string;
    dash?: number;
    gap?: number;
  },
): CanvasTexture {
  const wPx = Math.max(2, Math.round(options.widthMeters * TEXTURE_RESOLUTION));
  const hPx = Math.max(2, Math.round(options.heightMeters * TEXTURE_RESOLUTION));
  const canvas = makeCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createLaneMarkingTexture: 2D context unavailable');
  }
  paintAsphaltNoise(canvas, options.seed + ':noise');
  ctx.fillStyle = options.color;
  if (options.style === 'solid') {
    ctx.fillRect(0, 0, wPx, hPx);
  } else {
    const dash = options.dash ?? 1.0;
    const gap = options.gap ?? 1.0;
    const dashPx = Math.max(1, Math.round(dash * TEXTURE_RESOLUTION));
    const gapPx = Math.max(1, Math.round(gap * TEXTURE_RESOLUTION));
    let x = 0;
    let on = true;
    while (x < wPx) {
      const len = on ? dashPx : gapPx;
      if (on) {
        ctx.fillRect(x, 0, Math.min(len, wPx - x), hPx);
      }
      x += len;
      on = !on;
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Street asphalt + markings texture                                   */
/* ------------------------------------------------------------------ */

/** Map a world-space point onto the street's texture UV (u along travel). */
function worldToStreetUV(street: Street, x: number, z: number): { u: number; v: number } {
  const c = street.carriageway;
  if (street.axis === 'x') {
    return { u: x - c.minX, v: z - c.minZ };
  }
  return { u: z - c.minZ, v: x - c.minX };
}

/** Draw one axis-aligned painted line (supports dashes). */
function paintMarking(
  ctx: CanvasRenderingContext2D,
  street: Street,
  marking: RoadMarkingLine,
  heightPx: number,
): void {
  const { u: u0, v: v0 } = worldToStreetUV(street, marking.from.x, marking.from.z);
  const { u: u1, v: v1 } = worldToStreetUV(street, marking.to.x, marking.to.z);
  const lineWidthPx = Math.max(1, Math.round(marking.width * TEXTURE_RESOLUTION));
  const horizontal = Math.abs(v1 - v0) < 1e-6;
  const lengthPx = horizontal ? Math.abs(u1 - u0) * TEXTURE_RESOLUTION : Math.abs(v1 - v0) * TEXTURE_RESOLUTION;

  ctx.fillStyle = '#f3f4f6';

  if (marking.style === 'solid') {
    if (horizontal) {
      const py = heightPx - (v0 * TEXTURE_RESOLUTION);
      ctx.fillRect(Math.min(u0, u1) * TEXTURE_RESOLUTION, py - lineWidthPx / 2, lengthPx, lineWidthPx);
    } else {
      const px = u0 * TEXTURE_RESOLUTION;
      ctx.fillRect(px - lineWidthPx / 2, heightPx - Math.max(v0, v1) * TEXTURE_RESOLUTION, lineWidthPx, lengthPx);
    }
    return;
  }

  // Dashed: iterate segments from start toward end.
  const dashPx = Math.max(4, Math.round((marking.dash ?? 1.1) * TEXTURE_RESOLUTION));
  const gapPx = Math.max(4, Math.round((marking.gap ?? 1.4) * TEXTURE_RESOLUTION));
  const totalPx = dashPx + gapPx;
  const steps = Math.ceil(lengthPx / totalPx);
  const clamped = lengthPx / steps;
  for (let i = 0; i < steps; i += 1) {
    const segStart = i * clamped;
    const segLen = Math.min(dashPx, clamped);
    if (horizontal) {
      const x0 = Math.min(u0, u1) * TEXTURE_RESOLUTION + segStart;
      const py = heightPx - v0 * TEXTURE_RESOLUTION;
      ctx.fillRect(x0, py - lineWidthPx / 2, segLen, lineWidthPx);
    } else {
      const z0 = Math.max(v0, v1) * TEXTURE_RESOLUTION - segStart - segLen;
      const px = u0 * TEXTURE_RESOLUTION;
      ctx.fillRect(px - lineWidthPx / 2, heightPx - z0, lineWidthPx, segLen);
    }
  }
}

/**
 * Build the full street surface texture: asphalt base + painted curb lines,
 * center dashes, and edge lines from the layout's `markings`.
 */
export function createStreetTexture(street: Street, seed: string): CanvasTexture {
  const c = street.carriageway;
  const lengthM = street.axis === 'x' ? c.maxX - c.minX : c.maxZ - c.minZ;
  const widthM = street.axis === 'x' ? c.maxZ - c.minZ : c.maxX - c.minX;
  const wPx = Math.max(2, Math.round(lengthM * TEXTURE_RESOLUTION));
  const hPx = Math.max(2, Math.round(widthM * TEXTURE_RESOLUTION));
  const canvas = makeCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createStreetTexture: 2D context unavailable');
  }
  paintAsphaltNoise(canvas, `${seed}:street:${street.id}`);
  for (const marking of street.markings) {
    paintMarking(ctx, street, marking, hPx);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Crosswalk zebra texture                                             */
/* ------------------------------------------------------------------ */

/**
 * Zebra-crossing texture: `stripeCount` white bars on a transparent ground
 * so the asphalt below shows through between bars. Bars run parallel to the
 * crossing direction (i.e. the direction pedestrians walk).
 */
export function createCrosswalkTexture(crosswalk: Crosswalk, seed: string): CanvasTexture {
  // `seed` is retained for API parity with createStreetTexture; the zebra
  // pattern is deterministic purely from the crossing geometry. Keep the
  // parameter so downstream callers can create textured variants later.
  void seed;
  const b = crosswalk.bounds;
  const lengthM = crosswalk.direction.x !== 0 ? b.maxZ - b.minZ : b.maxX - b.minX;
  const depthM = crosswalk.direction.x !== 0 ? b.maxX - b.minX : b.maxZ - b.minZ;
  const wPx = Math.max(2, Math.round(lengthM * TEXTURE_RESOLUTION));
  const hPx = Math.max(2, Math.round(depthM * TEXTURE_RESOLUTION));
  const canvas = makeCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createCrosswalkTexture: 2D context unavailable');
  }
  ctx.clearRect(0, 0, wPx, hPx);
  const stripeCount = Math.max(2, crosswalk.stripeCount);
  const barWidthPx = Math.max(2, Math.round(lengthM / stripeCount * TEXTURE_RESOLUTION * 0.42));
  ctx.fillStyle = 'rgba(246, 246, 248, 255)';
  const stepPx = lengthM * TEXTURE_RESOLUTION / stripeCount;
  if (crosswalk.direction.x !== 0) {
    // Bars run along x: full texture width, stacked along depth (v).
    for (let i = 0; i < stripeCount; i += 1) {
      const y = i * stepPx;
      ctx.fillRect(0, y, wPx, Math.min(barWidthPx, stepPx));
    }
  } else {
    // Bars run along z: full texture height, stacked along length (u).
    for (let i = 0; i < stripeCount; i += 1) {
      const x = i * stepPx;
      ctx.fillRect(x, 0, Math.min(barWidthPx, stepPx), hPx);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}