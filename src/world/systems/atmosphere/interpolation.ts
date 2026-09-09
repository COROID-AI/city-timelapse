/**
 * Shared interpolation context for the atmosphere system.
 *
 * Pure math + three.js-free color helpers. `atmosphereEraData.ts`,
 * `sky.ts`, `lamps.ts`, and `atmosphereSystem.ts` all consume this module so
 * every interpolated parameter uses ONE consistent easing + color-lerp path.
 *
 * Color interpolation happens in sRGB space and returns vendor-ready `Color`
 * constructor arguments (integer 0xRRGGBB) plus the hex string — renderer
 * exposure and ACES tonemapping remain the single source of the golden-hour
 * grade.
 */

import { Color, type ColorRepresentation } from 'three';
import {
  easeInOut,
  hexToRgb,
  lerpColor,
  lerpNumber,
  type RGBColor,
} from '../../../era/transition';
import type { AtmosphereEraSpec } from '../../../era/types';

export interface ColorPair {
  /** Vendor-ready 24-bit integer (0xRRGGBB). */
  readonly intColor: ColorRepresentation;
  /** Canonical '#rrggbb' string. */
  readonly hexColor: string;
}

/** One fully-interpolated color endpoint (hex string + integer pair). */
export interface InterpolatedColor extends ColorPair {
  readonly hex: string;
}

/** Hex parsing that falls back to a neutral mid-grey instead of pure black. */
export function parseHex(hex: string | number): RGBColor {
  const rgb = hexToRgb(hex);
  if (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) {
    return { r: 128, g: 128, b: 128 };
  }
  return rgb;
}

/** Parse a hex string into a three.js Color for constructing materials. */
export function toThreeColor(hex: string | number): Color {
  const rgb = parseHex(hex);
  return new Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
}

/** Interpolate two hex colors in sRGB and return both representations. */
export function interpolateColorHex(
  colorA: string | number,
  colorB: string | number,
  t: number,
): InterpolatedColor {
  const hex = lerpColor(colorA, colorB, t);
  const rgb = parseHex(hex);
  return {
    hex,
    hexColor: hex,
    intColor: (rgb.r << 16) | (rgb.g << 8) | rgb.b,
  };
}

/**
 * Interpolate every parameter between two atmosphere era specs.
 * `t` is the progress in [0,1]; gradient colors, lights, fog, haze,
 * and mood all interpolate continuously here.
 */
export function interpolateEraAtmosphere<T extends AtmosphereEraSpec>(
  fromSpec: T,
  toSpec: T,
  t: number,
): T {
  const eased = easeInOut(t);
  const interp = (a: string | number, b: string | number) => interpolateColorHex(a, b, eased).hexColor;

  return {
    ...fromSpec,
    skyGradient: {
      zenith: interp(fromSpec.skyGradient.zenith, toSpec.skyGradient.zenith),
      horizon: interp(fromSpec.skyGradient.horizon, toSpec.skyGradient.horizon),
      ground: interp(fromSpec.skyGradient.ground, toSpec.skyGradient.ground),
    },
    sunColor: interp(fromSpec.sunColor, toSpec.sunColor),
    sunIntensity: lerpNumber(fromSpec.sunIntensity, toSpec.sunIntensity, eased),
    sunPosition: [
      lerpNumber(fromSpec.sunPosition[0], toSpec.sunPosition[0], eased),
      lerpNumber(fromSpec.sunPosition[1], toSpec.sunPosition[1], eased),
      lerpNumber(fromSpec.sunPosition[2], toSpec.sunPosition[2], eased),
    ] as const,
    ambientColor: interp(fromSpec.ambientColor, toSpec.ambientColor),
    ambientIntensity: lerpNumber(fromSpec.ambientIntensity, toSpec.ambientIntensity, eased),
    fogColor: interp(fromSpec.fogColor, toSpec.fogColor),
    fogDensity: lerpNumber(fromSpec.fogDensity, toSpec.fogDensity, eased),
    streetLampColor: interp(fromSpec.streetLampColor, toSpec.streetLampColor),
    streetLampIntensity: lerpNumber(fromSpec.streetLampIntensity, toSpec.streetLampIntensity, eased),
    hazeFactor: lerpNumber(fromSpec.hazeFactor, toSpec.hazeFactor, eased),
    colorGradeMood: eased < 0.5 ? fromSpec.colorGradeMood : toSpec.colorGradeMood,
  };
}
