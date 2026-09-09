/**
 * 2D procedural screen-space shader for the cinematic film grade and
 * vignette used by the composed scene's post-processing pipeline.
 *
 * Instead of a texture atlas (which would need an asset pipeline), the grade
 * and vignette are baked into a single low-resolution procedural canvas:
 *
 * - The **vignette** is a per-pixel radial darkening sampled from a small
 *   lookup canvas (bilinear interpolation via moveTo/lineTo is avoided; we
 *   directly set pixels with `fillRect` into the tiny canvas).
 * - The **film grade** (warm temperature, saturation, contrast, exposure
 *   curve) is applied as per-channel arithmetic in the vertex shader by the
 *   renderer's tone-mapping pipeline. This module only stores the grade
 *   parameters and renders the vignette canvas.
 *
 * The rendered vignette canvas is consumed by `src/fx/postProcessing.ts` as
 * a cheap uniform texture, so the vignette costs one texture + one shader
 * uniform instead of a full-screen per-pixel CPU loop every frame.
 *
 * Pure canvas + math only — no THREE engine objects are created here.
 */

/** Reasonably small vignette canvas: 64x64 is invisible at typical HUD scale. */
export const VIGNETTE_SIZE = 64;

/** Radial profile: how dark the corner is relative to the frame center (0..1). */
export const VIGNETTE_STRENGTH = 0.52;

/** Grade parameters applied by the renderer's tone-mapping (see README). */
export interface FilmGrade {
  /** Warm-tint shift of midtones/highlights, 0..1 (0 = neutral). */
  readonly temperature: number;
  /** Saturation multiplier (1.0 = neutral). */
  readonly saturation: number;
  /** Contrast multiplier (1.0 = neutral). */
  readonly contrast: number;
  /** Exposure offset in stops applied by the renderer (ACES-friendly). */
  readonly exposure: number;
  /** Highlight roll-off (shoulder) 0..1 — keeps emissive bloom smooth. */
  readonly highlightRolloff: number;
}

/** The one consistent golden-hour grade shared across the five eras. */
export const GOLDEN_HOUR_GRADE: FilmGrade = Object.freeze({
  temperature: 0.14,
  saturation: 1.06,
  contrast: 1.04,
  exposure: 0,
  highlightRolloff: 0.4,
});

export interface VignetteCanvas {
  /** The generated canvas holding the radial falloff (RGBA). */
  readonly canvas: HTMLCanvasElement;
  /** 0..1 corner-darkening strength that produced the canvas. */
  readonly strength: number;
}

/**
 * Builds a small square canvas whose pixel alpha encodes a smooth radial
 * vignette: 1.0 at the center, falling to `1 - strength` at the corners.
 * The returned canvas is cheap to upload as a uniform texture.
 */
export function renderVignetteCanvas(size = VIGNETTE_SIZE, strength = VIGNETTE_STRENGTH): VignetteCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Headless/jsdom fallback: still return a canvas so callers stay uniform.
    return { canvas, strength };
  }

  // Solid white base, then per-pixel radial darkening.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const half = (size - 1) / 2;
  const invHalf = 1 / half;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) * invHalf;
      const dy = (y - half) * invHalf;
      const r = Math.sqrt(dx * dx + dy * dy);
      // Radial profile: 1 at center -> (1-strength) at the corners, smooth.
      const t = Math.min(1, r);
      const alpha = strength * t * t;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return { canvas, strength };
}