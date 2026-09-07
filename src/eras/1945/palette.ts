import { AmbientLight, Scene } from 'three';

/**
 * 1945 palette and lighting grade.
 *
 * The post-war block is graded sepia-warm with low saturation, wrapped in a
 * coal-smoke haze, and lit after dark by warm 2700K incandescent bulbs.
 * Colors are expressed as normalized RGB triples (0..1) for direct use with
 * Three.js materials.
 */

/** A normalized RGB color (each channel in 0..1). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** The complete 1945 palette / lighting-grade definition. */
export interface EraPalette {
  /** Dominant masonry tint for post-war brick. */
  brick: Rgb;
  /** Coal-smoke-stained brick (darker, cooler-grey tint). */
  smokeStainedBrick: Rgb;
  /** Stone / trim color. */
  stone: Rgb;
  /** Sash window frame color (dark timber). */
  windowFrame: Rgb;
  /** Window glass color (dim, low-saturation). */
  windowGlass: Rgb;
  /** Warm incandescent glow (2700K). */
  incandescent: Rgb;
  /** Sepia-warm grade overlay applied to the whole scene. */
  sepia: Rgb;
  /** Coal-smoke haze overlay. */
  haze: Rgb;
  /** Overall saturation factor (0..1, low for 1945). */
  saturation: number;
  /** Whether the scene is graded sepia-warm. */
  sepiaWarm: boolean;
}

/** The 1945 palette / lighting grade. */
export const era1945Palette: EraPalette = Object.freeze({
  brick: Object.freeze({ r: 0.42, g: 0.29, b: 0.23 }),
  smokeStainedBrick: Object.freeze({ r: 0.3, g: 0.25, b: 0.23 }),
  stone: Object.freeze({ r: 0.62, g: 0.58, b: 0.53 }),
  windowFrame: Object.freeze({ r: 0.15, g: 0.11, b: 0.08 }),
  windowGlass: Object.freeze({ r: 0.34, g: 0.36, b: 0.38 }),
  incandescent: Object.freeze({ r: 1.0, g: 0.72, b: 0.45 }),
  sepia: Object.freeze({ r: 0.86, g: 0.76, b: 0.58 }),
  haze: Object.freeze({ r: 0.55, g: 0.53, b: 0.5 }),
  saturation: 0.45,
  sepiaWarm: true,
});

/** Clamp a channel into 0..1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Apply the 1945 sepia-warm, low-saturation grade to an RGB triple.
 * Desaturates toward luminance, then warms the result toward sepia.
 */
export function apply1945Grade(color: Rgb): Rgb {
  const l =
    0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  const s = era1945Palette.saturation;
  const desat: Rgb = {
    r: l + (color.r - l) * s,
    g: l + (color.g - l) * s,
    b: l + (color.b - l) * s,
  };
  const sepia = era1945Palette.sepia;
  const warmth = 0.18;
  return {
    r: clamp01(desat.r + (sepia.r - desat.r) * warmth),
    g: clamp01(desat.g + (sepia.g - desat.g) * warmth),
    b: clamp01(desat.b + (sepia.b - desat.b) * warmth),
  };
}

/**
 * Attach the 1945 lighting grade to a scene: a warm sepia ambient fill plus a
 * soft 2700K incandescent glow. Returns a dispose function that removes the
 * lights.
 */
export function applyEraLighting(scene: Scene): () => void {
  const sepiaAmbient = new AmbientLight();
  sepiaAmbient.color.setRGB(0.95, 0.86, 0.72);
  sepiaAmbient.intensity = 0.45;

  const glow = new AmbientLight();
  glow.color.setRGB(
    era1945Palette.incandescent.r,
    era1945Palette.incandescent.g,
    era1945Palette.incandescent.b,
  );
  glow.intensity = 0.16;

  scene.add(sepiaAmbient, glow);
  return () => {
    scene.remove(sepiaAmbient, glow);
  };
}