/**
 * Easing and interpolation helper math for era transitions.
 *
 * Types and pure logic only — no THREE imports and no DOM access.
 */

export interface RGBColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

/**
 * Standard cubic ease-in-out curve (smooth acceleration and deceleration).
 * Maps t in [0, 1] to an eased value in [0, 1].
 * Values outside [0, 1] are clamped.
 */
export function easeInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const f = 2 * t - 2;
  return 0.5 * f * f * f + 1;
}

/**
 * Linear interpolation between two scalar numbers.
 * `t` is typically in [0, 1]. Clamped or unclamped can be selected via `clamp` flag (default true).
 */
export function lerpNumber(a: number, b: number, t: number, clamp = true): number {
  const safeT = clamp ? Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0)) : t;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return a + (b - a) * safeT;
}

/**
 * Clamps a number to a [min, max] range.
 */
export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

/**
 * Normalizes a value from [min, max] to [0, 1].
 */
export function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((val - min) / (max - min), 0, 1);
}

/**
 * Parses a hex color string ('#rgb', '#rrggbb', 'rgb', 'rrggbb', or 0xRRGGBB) to RGB components [0..255].
 * Falls back to black { r: 0, g: 0, b: 0 } on invalid input.
 */
export function hexToRgb(hex: string | number): RGBColor {
  if (typeof hex === 'number') {
    const intVal = Math.max(0, Math.floor(hex)) & 0xffffff;
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
    };
  }

  if (typeof hex !== 'string') {
    return { r: 0, g: 0, b: 0 };
  }

  let clean = hex.trim().replace(/^#/, '');

  // 3-digit hex (#f0a -> #ff00aa)
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  if (clean.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  const parsed = Number.parseInt(clean, 16);
  if (Number.isNaN(parsed)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

/**
 * Converts RGB components [0..255] to a '#rrggbb' hex string.
 */
export function rgbToHex(rgb: RGBColor): string {
  const r = clamp(Math.round(rgb.r), 0, 255).toString(16).padStart(2, '0');
  const g = clamp(Math.round(rgb.g), 0, 255).toString(16).padStart(2, '0');
  const b = clamp(Math.round(rgb.b), 0, 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Converts RGB components [0..255] to a 24-bit integer (0xRRGGBB).
 */
export function rgbToHexInt(rgb: RGBColor): number {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  return (r << 16) | (g << 8) | b;
}

/**
 * Linear interpolation between two colors in RGB space.
 * Accepts hex strings (e.g. '#ff0000') or numbers (0xff0000).
 * Returns a 6-digit hex string '#rrggbb'.
 */
export function lerpColor(colorA: string | number, colorB: string | number, t: number): string {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const safeT = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));

  return rgbToHex({
    r: rgbA.r + (rgbB.r - rgbA.r) * safeT,
    g: rgbA.g + (rgbB.g - rgbA.g) * safeT,
    b: rgbA.b + (rgbB.b - rgbA.b) * safeT,
  });
}

/**
 * Linear interpolation between two colors returning a 24-bit hex integer (0xRRGGBB).
 */
export function lerpColorInt(colorA: string | number, colorB: string | number, t: number): number {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const safeT = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));

  return rgbToHexInt({
    r: rgbA.r + (rgbB.r - rgbA.r) * safeT,
    g: rgbA.g + (rgbB.g - rgbA.g) * safeT,
    b: rgbA.b + (rgbB.b - rgbA.b) * safeT,
  });
}

/**
 * Linear interpolation between two 3D vectors / tuples [x, y, z].
 */
export function lerpVector3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const safeT = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return [
    a[0] + (b[0] - a[0]) * safeT,
    a[1] + (b[1] - a[1]) * safeT,
    a[2] + (b[2] - a[2]) * safeT,
  ];
}
