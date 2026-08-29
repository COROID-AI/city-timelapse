/**
 * Color grading state for the environment subsystem.
 *
 * Grading is a simple uniform-driven pass the foundation renderer can plug
 * into — no post-processing passes are added here. Each era maps to a 3x3
 * color matrix (row-major), an RGB offset, a saturation multiplier, and a
 * white-balance temperature. `lerpColorGrade` interpolates two era grades so
 * `applyEraBlend` can fade between sepia / neutral / magenta-cyan / cool
 * looks continuously.
 *
 * The module is pure math (no three.js imports) so unit tests can verify
 * grading lerps without a DOM or renderer.
 */

/** A per-era color grade. */
export interface ColorGradeState {
  /**
   * 3x3 color matrix in row-major order:
   * out.r = m[0]*r + m[1]*g + m[2]*b + offset[0], etc.
   */
  readonly matrix: readonly number[];
  /** RGB offset added after the matrix, per channel in 0..1 scale. */
  readonly offset: readonly number[];
  /** Saturation multiplier (1 = neutral). */
  readonly saturation: number;
  /** White-balance temperature, -1 (cool) .. +1 (warm). */
  readonly temperature: number;
  /** Era grading label from the environment payload. */
  readonly label: string;
}

/** Neutral grade used when the payload's grading label is unrecognized. */
export const NEUTRAL_GRADE: ColorGradeState = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  offset: [0, 0, 0],
  saturation: 1,
  temperature: 0,
  label: 'neutral',
};

/** Per-label grading presets matching the era environment payloads. */
const GRADE_PRESETS: Record<string, ColorGradeState> = {
  'muted-sepia': {
    matrix: [1.12, 0.08, 0.02, 0.05, 0.96, 0.04, 0.01, 0.06, 0.8],
    offset: [0.02, 0.012, 0.004],
    saturation: 0.9,
    temperature: 0.35,
    label: 'muted-sepia',
  },
  'warm-vivid': {
    matrix: [1.06, 0.02, 0, 0.02, 1.0, 0.02, 0, 0.03, 0.94],
    offset: [0.01, 0.005, 0],
    saturation: 1.12,
    temperature: 0.2,
    label: 'warm-vivid',
  },
  'neon-magenta-cyan-blue': {
    matrix: [1.0, 0.14, 0.04, 0.03, 0.9, 0.06, 0.1, 0.12, 1.08],
    offset: [0.01, 0.0, 0.015],
    saturation: 1.28,
    temperature: -0.2,
    label: 'neon-magenta-cyan-blue',
  },
  'cooler-neutral': {
    matrix: [0.96, 0.02, 0, 0.01, 1.0, 0.02, 0, 0.02, 1.05],
    offset: [0, 0, 0.005],
    saturation: 0.98,
    temperature: -0.15,
    label: 'cooler-neutral',
  },
};

/**
 * Resolves a grading label to a concrete grade state. Unknown labels fall
 * back to neutral so a malformed payload never breaks the renderer.
 */
export function buildColorGrade(label: string): ColorGradeState {
  return GRADE_PRESETS[label] ?? NEUTRAL_GRADE;
}

/** Lerps two grade states at progress `t` (0 = from, 1 = to). */
export function lerpColorGrade(from: ColorGradeState, to: ColorGradeState, t: number): ColorGradeState {
  const k = Math.min(1, Math.max(0, t));
  return {
    matrix: from.matrix.map((v, i) => v + (to.matrix[i] - v) * k),
    offset: from.offset.map((v, i) => v + (to.offset[i] - v) * k),
    saturation: from.saturation + (to.saturation - from.saturation) * k,
    temperature: from.temperature + (to.temperature - from.temperature) * k,
    label: k < 0.5 ? from.label : to.label,
  };
}

/**
 * Applies a grade to an RGB color {r,g,b} in 0..1 and returns the graded
 * color. Exposed for tests and for renderer shader data validation.
 */
export function applyColorGrade(
  grade: Pick<ColorGradeState, 'matrix' | 'offset' | 'saturation'>,
  rgb: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  const m = grade.matrix;
  const o = grade.offset;
  const { r, g, b } = rgb;
  let outR = m[0] * r + m[1] * g + m[2] * b + o[0];
  let outG = m[3] * r + m[4] * g + m[5] * b + o[1];
  let outB = m[6] * r + m[7] * g + m[8] * b + o[2];
  // Saturation: blend toward luminance.
  const luma = 0.2126 * outR + 0.7152 * outG + 0.0722 * outB;
  outR = luma + (outR - luma) * grade.saturation;
  outG = luma + (outG - luma) * grade.saturation;
  outB = luma + (outB - luma) * grade.saturation;
  return {
    r: Math.min(1, Math.max(0, outR)),
    g: Math.min(1, Math.max(0, outG)),
    b: Math.min(1, Math.max(0, outB)),
  };
}

/**
 * Uniform-friendly view of a grade for a renderer pass: 9 matrix floats, 3
 * offset floats, saturation, and temperature.
 */
export function getGradeUniforms(grade: ColorGradeState): {
  uColorMatrix: readonly number[];
  uColorOffset: readonly number[];
  uSaturation: number;
  uTemperature: number;
} {
  return {
    uColorMatrix: grade.matrix,
    uColorOffset: grade.offset,
    uSaturation: grade.saturation,
    uTemperature: grade.temperature,
  };
}