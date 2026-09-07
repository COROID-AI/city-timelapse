import { era1945Palette, Rgb } from './palette';

/**
 * 1945 procedural textures.
 *
 * Coal-smoke staining and masonry variation are data-driven so the renderer /
 * tests can verify them without image assets. Each texture is a small grid of
 * RGB swatches. (The Three.js scaffold uses flat-box materials; these swatches
 * document the intended surface variation and are used by the content tests.)
 */

/** A single texture swatch grid. */
export interface TextureGrid {
  /** Stable texture id. */
  id: string;
  /** Grid width (cells). */
  width: number;
  /** Grid height (cells). */
  height: number;
  /** Per-cell RGB colours. */
  cells: readonly Rgb[];
}

function mul(a: Rgb, f: number): Rgb {
  return { r: a.r * f, g: a.g * f, b: a.b * f };
}

/**
 * Build a coal-smoke-stained masonry texture: brick base with a darker,
 * desaturated soot gradient toward the top.
 */
export function createCoalSmokeTexture(
  id: string,
  width: number,
  height: number,
): TextureGrid {
  const base = era1945Palette.brick;
  const cells: Rgb[] = [];
  for (let y = 0; y < height; y++) {
    // 0 at bottom (clean) -> 1 at top (sooty).
    const soot = y / (height - 1);
    const darken = 1 - soot * 0.5;
    const grey = mul(base, darken);
    for (let x = 0; x < width; x++) {
      // Subtle horizontal mortar-line variation.
      const mortar = (x % 3 === 2) ? 0.9 : 1.0;
      cells.push(mul(grey, mortar));
    }
  }
  return { id, width, height, cells };
}

/**
 * Build a plain masonry texture (brick or stone) with subtle per-brick
 * variation.
 */
export function createMasonryTexture(
  id: string,
  width: number,
  height: number,
  base: Rgb,
): TextureGrid {
  const cells: Rgb[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const jitter = 0.94 + ((x * 7 + y * 13) % 5) * 0.02;
      cells.push(mul(base, jitter));
    }
  }
  return { id, width, height, cells };
}

/** The 1945 texture set. */
export const era1945Textures: readonly TextureGrid[] = Object.freeze([
  createCoalSmokeTexture('smoke-stained-brick', 8, 4),
  createMasonryTexture('brick', 8, 4, era1945Palette.brick),
  createMasonryTexture('stone', 8, 4, era1945Palette.stone),
  createCoalSmokeTexture('smoke-stained-stone', 8, 4),
]);

/** Look up a texture by id. */
export function findTexture(id: string): TextureGrid | undefined {
  return era1945Textures.find((t) => t.id === id);
}