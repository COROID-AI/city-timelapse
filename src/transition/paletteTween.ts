/**
 * PaletteTween: synchronized palette / lighting grade interpolation.
 *
 * The five era modules describe their palettes with heterogeneous shapes, so
 * this module normalizes each era palette into a small set of canonical
 * lighting parameters (sky color, sun position, fog density, light color
 * temperature) and exposes a pure interpolator that grades any tweened RGB
 * triple and computes a per-era lighting grade.
 *
 * The `TransitionDirector` applies the tweened grade to the shared sky and
 * light rig each frame and re-grades scene materials via the era grade
 * functions, so the whole scene shifts continuously between eras.
 */

/** An RGB color in normalized [0, 1] space. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Canonical lighting parameters interpolated between eras. These drive the
 * shared sky dome and light rig during a transition.
 */
export interface LightingGrade {
  /** Sky color (normalized RGB). */
  sky: Rgb;
  /** Sun disc color (normalized RGB). */
  sun: Rgb;
  /** Sun direction vector (position offset from origin). */
  sunPosition: { x: number; y: number; z: number };
  /** Fog / haze density in [0, 1]. */
  fogDensity: number;
  /** Light color temperature in Kelvin (warm ~2700K to cool ~6500K). */
  temperature: number;
  /** Ambient fill intensity in [0, 1]. */
  ambientIntensity: number;
}

/**
 * A normalized, era-agnostic palette snapshot derived from an era palette
 * object. The extractor accepts any object shape and pulls what it can,
 * falling back to sensible neutral defaults so every era module works.
 */
export interface EraPaletteSnapshot {
  /** The era year. */
  year: number;
  /** Sky color (normalized RGB). */
  sky: Rgb;
  /** Sun disc color (normalized RGB). */
  sun: Rgb;
  /** Sun position offset from origin. */
  sunPosition: { x: number; y: number; z: number };
  /** Fog / haze density in [0, 1]. */
  fogDensity: number;
  /** Light color temperature in Kelvin. */
  temperature: number;
  /** Ambient fill intensity in [0, 1]. */
  ambientIntensity: number;
}

/** Lerp a number. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lerp two RGB colors. */
export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

/** Convert a hex color string (#rrggbb) to normalized RGB. */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (Number.isNaN(bigint)) return { r: 0.5, g: 0.5, b: 0.5 };
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Read a nested string/number color value from a palette object. */
function readColor(
  obj: unknown,
  paths: string[][],
  fallback: Rgb,
): Rgb {
  for (const path of paths) {
    let node: unknown = obj;
    for (const key of path) {
      if (!node || typeof node !== 'object') break;
      node = (node as Record<string, unknown>)[key];
    }
    if (typeof node === 'string') return hexToRgb(node);
    if (node && typeof node === 'object') {
      const c = node as Record<string, unknown>;
      const r = typeof c.r === 'number' ? c.r : undefined;
      const g = typeof c.g === 'number' ? c.g : undefined;
      const b = typeof c.b === 'number' ? c.b : undefined;
      if (r !== undefined && g !== undefined && b !== undefined) {
        return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
      }
    }
  }
  return fallback;
}

function readNumber(
  obj: unknown,
  paths: string[][],
  fallback: number,
): number {
  for (const path of paths) {
    let node: unknown = obj;
    for (const key of path) {
      if (!node || typeof node !== 'object') break;
      node = (node as Record<string, unknown>)[key];
    }
    if (typeof node === 'number' && Number.isFinite(node)) return node;
  }
  return fallback;
}

/** Neutral fallback snapshot used when an era palette is missing. */
const NEUTRAL: EraPaletteSnapshot = {
  year: 0,
  sky: { r: 0.4, g: 0.6, b: 0.9 },
  sun: { r: 1.0, g: 0.9, b: 0.6 },
  sunPosition: { x: 80, y: 120, z: 40 },
  fogDensity: 0.2,
  temperature: 4500,
  ambientIntensity: 0.35,
};

/**
 * Normalize an era palette object into an {EraPaletteSnapshot}. The five era
 * modules expose very different palette shapes (1945 uses {r,g,b} triples,
 * 1985 uses hex strings under `day`/`night`, 2025 uses hex strings at the
 * top level, 1965 uses `grading`), so this extractor probes several known
 * shapes and falls back to neutral.
 */
export function snapshotPalette(era: { year: number; palette?: unknown }): EraPaletteSnapshot {
  const p = era.palette;
  if (!p || typeof p !== 'object') {
    return { ...NEUTRAL, year: era.year };
  }

  const sky = readColor(p, [
    ['sky'],
    ['day', 'sky'],
    ['grading', 'skyHaze'],
    ['sepia'],
    ['haze'],
  ], NEUTRAL.sky);

  const sun = readColor(p, [
    ['sun'],
    ['day', 'sun'],
    ['grading', 'sunDay'],
    ['incandescent'],
    ['accent'],
  ], NEUTRAL.sun);

  const fog = clamp01(readNumber(p, [
    ['grading', 'skyHaze', 'a'],
    ['smogDensity'],
    ['day', 'smogDensity'],
    ['saturation'],
  ], NEUTRAL.fogDensity));

  // Temperature: derive from the ambient/sky color warmth when not explicit.
  const explicitTemp = readNumber(p, [
    ['grade', 'temperature'],
    ['temperature'],
  ], NaN);
  const temp =
    Number.isNaN(explicitTemp)
      ? kelvinFromColor(sky)
      : explicitTemp;

  const ambient = clamp01(readNumber(p, [
    ['ambientIntensity'],
    ['grade', 'brightness'],
  ], NEUTRAL.ambientIntensity));

  return {
    year: era.year,
    sky,
    sun,
    sunPosition: { ...NEUTRAL.sunPosition },
    fogDensity: fog,
    temperature: temp,
    ambientIntensity: ambient,
  };
}

/** Approximate a color temperature in Kelvin from an RGB color's warmth. */
export function kelvinFromColor(color: Rgb): number {
  // Red-dominant -> warm (low K); blue-dominant -> cool (high K).
  const warmth = color.r / Math.max(0.001, color.b);
  const t = 2700 + (6500 - 2700) * (1 - clamp01((warmth - 0.6) / 1.4));
  return Math.round(t);
}

/** The result of interpolating two era palette snapshots. */
export interface PaletteTween {
  /** The era year being transitioned from. */
  fromYear: number;
  /** The era year being transitioned to. */
  toYear: number;
  /** Linear progress in [0, 1]. */
  progress: number;
  /** The interpolated lighting grade. */
  grade: LightingGrade;
  /**
   * Grade a scene RGB triple through the per-era grade functions (outgoing
   * fading out, incoming fading in) plus a crossfade toward the tweened grade.
   */
  gradeColor(color: Rgb): Rgb;
}

/**
 * A per-era grade function (from each era module's palette module), used to
 * apply the era's photographic grade to a color triple.
 */
export type EraGradeFn = (color: Rgb) => Rgb;

/**
 * Create a {PaletteTween} between two era palette snapshots. `fromGrade` /
 * `toGrade` optionally apply each era's photographic grade so the crossfade
 * blends the graded looks rather than the raw palette colors.
 */
export function createPaletteTween(
  from: EraPaletteSnapshot,
  to: EraPaletteSnapshot,
  fromGrade?: EraGradeFn,
  toGrade?: EraGradeFn,
): (progress: number) => PaletteTween {
  return (progress: number) => {
    const t = clamp01(progress);
    const grade: LightingGrade = {
      sky: lerpRgb(from.sky, to.sky, t),
      sun: lerpRgb(from.sun, to.sun, t),
      sunPosition: {
        x: lerp(from.sunPosition.x, to.sunPosition.x, t),
        y: lerp(from.sunPosition.y, to.sunPosition.y, t),
        z: lerp(from.sunPosition.z, to.sunPosition.z, t),
      },
      fogDensity: lerp(from.fogDensity, to.fogDensity, t),
      temperature: lerp(from.temperature, to.temperature, t),
      ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, t),
    };

    const gradeColor = (color: Rgb): Rgb => {
      const fg = fromGrade ? fromGrade(color) : color;
      const tg = toGrade ? toGrade(color) : color;
      return lerpRgb(fg, tg, t);
    };

    return {
      fromYear: from.year,
      toYear: to.year,
      progress: t,
      grade,
      gradeColor,
    };
  };
}