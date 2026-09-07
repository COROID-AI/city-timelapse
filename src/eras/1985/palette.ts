import { Color } from 'three';

/**
 * 1985 Era Palette and Lighting Grade
 *
 * Distinctive 1985 visual identity:
 * - Gritty, desaturated daylight with urban smog haze.
 * - Deep night punctuated by high-pressure sodium vapor streetlights (deep amber/orange ~2100K)
 *   and saturated neon storefront and billboard splash (hot magenta, electric cyan, vibrant lime).
 * - Mirrored glass tower reflecting the sky and streetlights.
 */

export interface Era1985Palette {
  readonly name: string;
  readonly year: 1985;
  readonly day: {
    readonly sky: string;
    readonly sun: string;
    readonly ambient: string;
    readonly ground: string;
    readonly asphalt: string;
    readonly sidewalk: string;
    readonly smogHaze: string;
  };
  readonly night: {
    readonly sky: string;
    readonly ambient: string;
    readonly sodiumGlow: string;
    readonly neonMagenta: string;
    readonly neonCyan: string;
    readonly neonYellow: string;
    readonly neonGreen: string;
    readonly neonRed: string;
  };
  readonly materials: {
    readonly glassTower: string;
    readonly weatheredBrick: string;
    readonly grimyBrickDark: string;
    readonly concreteGrime: string;
    readonly fireEscapeMetal: string;
    readonly asphaltParking: string;
    readonly chromeMetal: string;
    readonly taxiYellow: string;
  };
}

export const PALETTE_1985: Era1985Palette = Object.freeze({
  name: 'Neon & Glass Boom',
  year: 1985,
  day: {
    sky: '#78899b',
    sun: '#ffeed1',
    ambient: '#6d7580',
    ground: '#2b2d30',
    asphalt: '#1e2022',
    sidewalk: '#5a5c60',
    smogHaze: '#887d72',
  },
  night: {
    sky: '#0a0d14',
    ambient: '#0e111a',
    sodiumGlow: '#ff8a14',
    neonMagenta: '#ff007f',
    neonCyan: '#00e5ff',
    neonYellow: '#ffea00',
    neonGreen: '#00ff66',
    neonRed: '#ff2222',
  },
  materials: {
    glassTower: '#3f6888',
    weatheredBrick: '#5a3d31',
    grimyBrickDark: '#3e2a22',
    concreteGrime: '#4b4d50',
    fireEscapeMetal: '#222326',
    asphaltParking: '#1c1d1f',
    chromeMetal: '#c2c8cf',
    taxiYellow: '#f5b700',
  },
});

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

export function applyColorHex(target: Color, hex: string): void {
  const { r, g, b } = hexToRgb(hex);
  target.setRGB(r, g, b);
}

export function compute1985LightingGrade(timeOfDay: number): {
  sunColor: { r: number; g: number; b: number };
  sunIntensity: number;
  ambientColor: { r: number; g: number; b: number };
  ambientIntensity: number;
  sodiumGlowIntensity: number;
  neonIntensity: number;
  smogDensity: number;
} {
  const t = Math.max(0, Math.min(1, timeOfDay));
  // 0.5 is noon, 0 and 1 are night
  const nightFactor = Math.min(1, Math.abs(t - 0.5) * 2);
  const dayFactor = 1 - nightFactor;

  const daySun = hexToRgb(PALETTE_1985.day.sun);
  const nightSun = hexToRgb(PALETTE_1985.night.sodiumGlow);
  const dayAmb = hexToRgb(PALETTE_1985.day.ambient);
  const nightAmb = hexToRgb(PALETTE_1985.night.ambient);

  return {
    sunColor: {
      r: daySun.r * dayFactor + nightSun.r * nightFactor * 0.4,
      g: daySun.g * dayFactor + nightSun.g * nightFactor * 0.4,
      b: daySun.b * dayFactor + nightSun.b * nightFactor * 0.4,
    },
    sunIntensity: 0.1 + 1.1 * dayFactor,
    ambientColor: {
      r: dayAmb.r * dayFactor + nightAmb.r * nightFactor,
      g: dayAmb.g * dayFactor + nightAmb.g * nightFactor,
      b: dayAmb.b * dayFactor + nightAmb.b * nightFactor,
    },
    ambientIntensity: 0.15 + 0.35 * dayFactor,
    sodiumGlowIntensity: Math.pow(nightFactor, 1.5) * 1.4,
    neonIntensity: Math.pow(nightFactor, 1.2) * 1.6 + 0.3,
    smogDensity: 0.015 + 0.01 * dayFactor,
  };
}
