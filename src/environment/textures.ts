/**
 * Procedural canvas textures for the environment subsystem.
 *
 * Ground, road, sidewalk, and curb materials are generated at runtime with
 * the 2D canvas API — no external asset downloads are required for the base
 * ground. Each generator returns a `THREE.CanvasTexture` plus the underlying
 * canvas so the era blend can repaint lane markings per era.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** A generated texture plus the canvas it was painted on. */
export interface ProceduralSurfaceTexture {
  readonly texture: CanvasTexture;
  readonly canvas: HTMLCanvasElement;
}

/** Creates a canvas with device pixels and returns a 2D context. */
function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Environment: 2D canvas context unavailable.');
  }
  return { canvas, ctx };
}

/** Wraps a canvas in a repeatable sRGB `CanvasTexture`. */
function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Draws a seeded noise speckle over the whole canvas. */
function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, alpha: number): void {
  let seed = 0x2f6e2b1;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < count; i += 1) {
    const shade = 80 + Math.floor(rand() * 90);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    const w = 1 + Math.floor(rand() * 3);
    ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), w, w);
  }
}

/**
 * Asphalt road texture with a subtle worn grain. Lane markings are painted
 * on top by `paintLaneMarkings()` per era.
 */
export function generateAsphaltTexture(size = 256): ProceduralSurfaceTexture {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#33383d';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 2600, 0.5);
  // Faint longitudinal wear streaks along the driving direction.
  ctx.strokeStyle = 'rgba(20,22,24,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.lineTo(Math.random() * size, size);
    ctx.stroke();
  }
  return { texture: toTexture(canvas), canvas };
}

/**
 * Concrete sidewalk texture: light pavers with a subtle grid and grout lines.
 * The grid pitch is chosen so the paver rhythm reads at sidewalk scale.
 */
export function generateConcreteTexture(size = 256, paverPx = 32): ProceduralSurfaceTexture {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#9a948c';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 1800, 0.3);

  const cols = Math.ceil(size / paverPx);
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const x = i * paverPx;
      const y = j * paverPx;
      const tone = 148 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 12})`;
      ctx.fillRect(x + 1, y + 1, paverPx - 2, paverPx - 2);
    }
  }
  // Grout lines between pavers.
  ctx.strokeStyle = 'rgba(64,60,54,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= cols; i += 1) {
    const p = i * paverPx;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  speckle(ctx, size, 500, 0.25);
  return { texture: toTexture(canvas), canvas };
}

/**
 * Curb texture: a plain dark concrete band used on the raised sidewalk edges.
 */
export function generateCurbTexture(size = 128): ProceduralSurfaceTexture {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#6f6b64';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 500, 0.35);
  return { texture: toTexture(canvas), canvas };
}

/** Lane-marking paint styles supported by the era data. */
export type LaneMarkingStyle = 'center' | 'center-double' | 'dashed' | 'none';

/**
 * Repaints the era's lane markings onto the asphalt canvas. The canvas is
 * cleared back to asphalt first, so calling this during a blend repaints the
 * road surface continuously.
 */
export function paintLaneMarkings(surface: ProceduralSurfaceTexture, style: LaneMarkingStyle): void {
  const { canvas } = surface;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const size = canvas.width;
  ctx.fillStyle = '#33383d';
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 2600, 0.5);
  ctx.strokeStyle = 'rgba(20,22,24,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.lineTo(Math.random() * size, size);
    ctx.stroke();
  }

  const paint = (color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  };

  if (style === 'center') {
    paint('#d8d2c2');
  } else if (style === 'center-double') {
    paint('#d8d2c2');
    ctx.beginPath();
    ctx.moveTo(0, size / 2 - 9);
    ctx.lineTo(size, size / 2 - 9);
    ctx.stroke();
  } else if (style === 'dashed') {
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 5;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 'none' leaves a plain asphalt road (wartime: markings worn away).
  surface.texture.needsUpdate = true;
}