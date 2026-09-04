/**
 * Per-era visual theme parameters. Every scene module reads these values and
 * interpolates between neighbouring eras using the continuous `eraFloat`.
 */

import type { EraId } from './eras';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface LampTheme {
  /** Emissive colour of the lamp head. */
  color: Rgb;
  /** Light intensity. */
  intensity: number;
  /** Distance of the point light. */
  distance: number;
  /** Lamp style id — decides geometry (gas → cobra → sodium → LED). */
  style: 'gas' | 'cobra' | 'sodium' | 'led';
}

export interface BuildingTheme {
  /** Facade colour candidates (chosen per building). */
  facades: Rgb[];
  /** Roof / parapet accent colour. */
  roof: Rgb;
  /** Window emissive colour. */
  windowEmissive: Rgb;
  /** Window emissive intensity (0..1). */
  windowIntensity: number;
  /** Lit fraction of windows (0..1). */
  windowLit: number;
  /** Height range in world units. */
  heightMin: number;
  heightMax: number;
  /** Rooftop props enabled for this era. */
  waterTower: boolean;
  acUnit: boolean;
  antenna: boolean;
  billboard: boolean;
  solar: boolean;
  greenery: boolean;
}

export interface Theme {
  sky: {
    zenith: Rgb;
    horizon: Rgb;
    fog: Rgb;
    fogDensity: number;
    sunColor: Rgb;
    sunIntensity: number;
    /** Sun elevation in radians (affects shadows). */
    sunElevation: number;
  };
  ground: {
    asphalt: Rgb;
    sidewalk: Rgb;
    curb: Rgb;
    roadLine: Rgb;
    crosswalk: Rgb;
  };
  building: BuildingTheme;
  lamp: LampTheme;
  particles: {
    color: Rgb;
    count: number;
    size: number;
    speed: number;
    opacity: number;
  };
  billboard: {
    accent: Rgb;
    /** Overall emissive glow multiplier for signage. */
    glow: number;
  };
  vehicle: {
    palette: Rgb[];
  };
  pedestrian: {
    palette: Rgb[];
  };
  storefront: string[];
}

export const THEMES: Record<EraId, Theme> = {
  '1945': {
    sky: {
      zenith: { r: 0.42, g: 0.5, b: 0.62 },
      horizon: { r: 0.82, g: 0.7, b: 0.53 },
      fog: { r: 0.76, g: 0.66, b: 0.53 },
      fogDensity: 0.004,
      sunColor: { r: 1.0, g: 0.85, b: 0.62 },
      sunIntensity: 2.2,
      sunElevation: 0.55,
    },
    ground: {
      asphalt: { r: 0.2, g: 0.19, b: 0.18 },
      sidewalk: { r: 0.52, g: 0.49, b: 0.44 },
      curb: { r: 0.44, g: 0.42, b: 0.38 },
      roadLine: { r: 0.72, g: 0.7, b: 0.62 },
      crosswalk: { r: 0.78, g: 0.76, b: 0.7 },
    },
    building: {
      facades: [
        { r: 0.5, g: 0.24, b: 0.2 },
        { r: 0.38, g: 0.28, b: 0.2 },
        { r: 0.55, g: 0.48, b: 0.38 },
        { r: 0.3, g: 0.32, b: 0.36 },
        { r: 0.42, g: 0.3, b: 0.24 },
      ],
      roof: { r: 0.28, g: 0.24, b: 0.2 },
      windowEmissive: { r: 1.0, g: 0.72, b: 0.38 },
      windowIntensity: 0.55,
      windowLit: 0.4,
      heightMin: 7,
      heightMax: 16,
      waterTower: true,
      acUnit: false,
      antenna: true,
      billboard: false,
      solar: false,
      greenery: false,
    },
    lamp: {
      color: { r: 1.0, g: 0.68, b: 0.34 },
      intensity: 1.6,
      distance: 16,
      style: 'gas',
    },
    particles: {
      color: { r: 0.78, g: 0.68, b: 0.52 },
      count: 220,
      size: 0.05,
      speed: 0.4,
      opacity: 0.5,
    },
    billboard: { accent: { r: 0.9, g: 0.55, b: 0.25 }, glow: 0.8 },
    vehicle: {
      palette: [
        { r: 0.14, g: 0.12, b: 0.1 },
        { r: 0.16, g: 0.24, b: 0.2 },
        { r: 0.32, g: 0.14, b: 0.14 },
        { r: 0.78, g: 0.72, b: 0.6 },
      ],
    },
    pedestrian: {
      palette: [
        { r: 0.34, g: 0.28, b: 0.22 },
        { r: 0.3, g: 0.32, b: 0.38 },
        { r: 0.42, g: 0.3, b: 0.28 },
        { r: 0.4, g: 0.4, b: 0.34 },
      ],
    },
    storefront: ['WAR BONDS', 'COCA-COLA 5¢', 'VICTORY CAFE', 'DRUGS', 'BARBER'],
  },

  '1965': {
    sky: {
      zenith: { r: 0.5, g: 0.66, b: 0.82 },
      horizon: { r: 0.95, g: 0.82, b: 0.72 },
      fog: { r: 0.86, g: 0.8, b: 0.76 },
      fogDensity: 0.0032,
      sunColor: { r: 1.0, g: 0.95, b: 0.8 },
      sunIntensity: 2.4,
      sunElevation: 0.7,
    },
    ground: {
      asphalt: { r: 0.22, g: 0.22, b: 0.24 },
      sidewalk: { r: 0.68, g: 0.64, b: 0.6 },
      curb: { r: 0.58, g: 0.55, b: 0.52 },
      roadLine: { r: 0.9, g: 0.88, b: 0.8 },
      crosswalk: { r: 0.92, g: 0.9, b: 0.84 },
    },
    building: {
      facades: [
        { r: 0.62, g: 0.72, b: 0.68 },
        { r: 0.8, g: 0.66, b: 0.62 },
        { r: 0.92, g: 0.86, b: 0.7 },
        { r: 0.62, g: 0.7, b: 0.82 },
        { r: 0.84, g: 0.76, b: 0.7 },
      ],
      roof: { r: 0.5, g: 0.52, b: 0.55 },
      windowEmissive: { r: 0.85, g: 0.9, b: 1.0 },
      windowIntensity: 0.7,
      windowLit: 0.55,
      heightMin: 10,
      heightMax: 22,
      waterTower: false,
      acUnit: true,
      antenna: true,
      billboard: false,
      solar: false,
      greenery: false,
    },
    lamp: {
      color: { r: 1.0, g: 0.82, b: 0.6 },
      intensity: 1.9,
      distance: 18,
      style: 'cobra',
    },
    particles: {
      color: { r: 0.9, g: 0.84, b: 0.74 },
      count: 260,
      size: 0.05,
      speed: 0.5,
      opacity: 0.45,
    },
    billboard: { accent: { r: 0.95, g: 0.35, b: 0.5 }, glow: 1.1 },
    vehicle: {
      palette: [
        { r: 0.45, g: 0.68, b: 0.66 },
        { r: 0.82, g: 0.72, b: 0.62 },
        { r: 0.9, g: 0.5, b: 0.42 },
        { r: 0.55, g: 0.6, b: 0.68 },
      ],
    },
    pedestrian: {
      palette: [
        { r: 0.78, g: 0.72, b: 0.66 },
        { r: 0.6, g: 0.74, b: 0.78 },
        { r: 0.86, g: 0.6, b: 0.64 },
        { r: 0.5, g: 0.5, b: 0.6 },
      ],
    },
    storefront: ['DINER', 'COCA-COLA', 'MOTEL', 'CHEVROLET', 'NEON'],
  },

  '1985': {
    sky: {
      zenith: { r: 0.3, g: 0.3, b: 0.48 },
      horizon: { r: 0.86, g: 0.48, b: 0.3 },
      fog: { r: 0.52, g: 0.38, b: 0.3 },
      fogDensity: 0.0045,
      sunColor: { r: 1.0, g: 0.62, b: 0.3 },
      sunIntensity: 2.0,
      sunElevation: 0.42,
    },
    ground: {
      asphalt: { r: 0.18, g: 0.18, b: 0.2 },
      sidewalk: { r: 0.56, g: 0.55, b: 0.54 },
      curb: { r: 0.48, g: 0.47, b: 0.46 },
      roadLine: { r: 0.9, g: 0.72, b: 0.4 },
      crosswalk: { r: 0.92, g: 0.9, b: 0.86 },
    },
    building: {
      facades: [
        { r: 0.42, g: 0.44, b: 0.48 },
        { r: 0.55, g: 0.42, b: 0.34 },
        { r: 0.32, g: 0.4, b: 0.44 },
        { r: 0.6, g: 0.58, b: 0.52 },
        { r: 0.45, g: 0.5, b: 0.55 },
      ],
      roof: { r: 0.3, g: 0.32, b: 0.36 },
      windowEmissive: { r: 0.5, g: 1.0, b: 0.7 },
      windowIntensity: 0.85,
      windowLit: 0.65,
      heightMin: 14,
      heightMax: 30,
      waterTower: false,
      acUnit: true,
      antenna: false,
      billboard: true,
      solar: false,
      greenery: false,
    },
    lamp: {
      color: { r: 1.0, g: 0.58, b: 0.22 },
      intensity: 2.6,
      distance: 20,
      style: 'sodium',
    },
    particles: {
      color: { r: 0.9, g: 0.5, b: 0.3 },
      count: 320,
      size: 0.07,
      speed: 0.7,
      opacity: 0.55,
    },
    billboard: { accent: { r: 1.0, g: 0.2, b: 0.6 }, glow: 1.6 },
    vehicle: {
      palette: [
        { r: 0.72, g: 0.68, b: 0.58 },
        { r: 0.38, g: 0.16, b: 0.16 },
        { r: 0.4, g: 0.46, b: 0.55 },
        { r: 0.55, g: 0.4, b: 0.26 },
      ],
    },
    pedestrian: {
      palette: [
        { r: 0.8, g: 0.3, b: 0.45 },
        { r: 0.3, g: 0.4, b: 0.75 },
        { r: 0.9, g: 0.85, b: 0.3 },
        { r: 0.35, g: 0.35, b: 0.45 },
      ],
    },
    storefront: ['ARCADE', "McDONALD'S", 'VIDEO', 'COLA', 'BANK'],
  },

  '2005': {
    sky: {
      zenith: { r: 0.32, g: 0.52, b: 0.74 },
      horizon: { r: 0.78, g: 0.85, b: 0.9 },
      fog: { r: 0.6, g: 0.68, b: 0.76 },
      fogDensity: 0.003,
      sunColor: { r: 1.0, g: 0.97, b: 0.86 },
      sunIntensity: 2.5,
      sunElevation: 0.78,
    },
    ground: {
      asphalt: { r: 0.16, g: 0.17, b: 0.2 },
      sidewalk: { r: 0.62, g: 0.62, b: 0.64 },
      curb: { r: 0.52, g: 0.52, b: 0.54 },
      roadLine: { r: 0.92, g: 0.92, b: 0.9 },
      crosswalk: { r: 0.94, g: 0.94, b: 0.92 },
    },
    building: {
      facades: [
        { r: 0.4, g: 0.5, b: 0.62 },
        { r: 0.55, g: 0.58, b: 0.62 },
        { r: 0.35, g: 0.42, b: 0.5 },
        { r: 0.6, g: 0.55, b: 0.48 },
        { r: 0.3, g: 0.4, b: 0.52 },
      ],
      roof: { r: 0.42, g: 0.45, b: 0.5 },
      windowEmissive: { r: 0.75, g: 0.85, b: 1.0 },
      windowIntensity: 0.9,
      windowLit: 0.7,
      heightMin: 16,
      heightMax: 34,
      waterTower: false,
      acUnit: true,
      antenna: false,
      billboard: true,
      solar: false,
      greenery: false,
    },
    lamp: {
      color: { r: 0.85, g: 0.92, b: 1.0 },
      intensity: 2.2,
      distance: 22,
      style: 'led',
    },
    particles: {
      color: { r: 0.8, g: 0.88, b: 0.95 },
      count: 260,
      size: 0.05,
      speed: 0.6,
      opacity: 0.4,
    },
    billboard: { accent: { r: 0.2, g: 0.6, b: 1.0 }, glow: 1.4 },
    vehicle: {
      palette: [
        { r: 0.75, g: 0.77, b: 0.8 },
        { r: 0.92, g: 0.92, b: 0.9 },
        { r: 0.12, g: 0.12, b: 0.14 },
        { r: 0.22, g: 0.32, b: 0.55 },
      ],
    },
    pedestrian: {
      palette: [
        { r: 0.3, g: 0.32, b: 0.4 },
        { r: 0.55, g: 0.5, b: 0.45 },
        { r: 0.75, g: 0.75, b: 0.78 },
        { r: 0.4, g: 0.45, b: 0.6 },
      ],
    },
    storefront: ['Apple', 'STARBUCKS', 'SAMSUNG', 'BANK', 'GYM'],
  },

  '2025': {
    sky: {
      zenith: { r: 0.26, g: 0.5, b: 0.56 },
      horizon: { r: 0.72, g: 0.9, b: 0.85 },
      fog: { r: 0.52, g: 0.72, b: 0.7 },
      fogDensity: 0.0028,
      sunColor: { r: 0.92, g: 1.0, b: 0.95 },
      sunIntensity: 2.6,
      sunElevation: 0.85,
    },
    ground: {
      asphalt: { r: 0.15, g: 0.16, b: 0.19 },
      sidewalk: { r: 0.64, g: 0.65, b: 0.68 },
      curb: { r: 0.54, g: 0.55, b: 0.58 },
      roadLine: { r: 0.9, g: 0.95, b: 0.92 },
      crosswalk: { r: 0.93, g: 0.95, b: 0.94 },
    },
    building: {
      facades: [
        { r: 0.42, g: 0.6, b: 0.62 },
        { r: 0.82, g: 0.85, b: 0.84 },
        { r: 0.3, g: 0.5, b: 0.55 },
        { r: 0.55, g: 0.62, b: 0.58 },
        { r: 0.35, g: 0.45, b: 0.5 },
      ],
      roof: { r: 0.45, g: 0.6, b: 0.5 },
      windowEmissive: { r: 0.6, g: 0.95, b: 1.0 },
      windowIntensity: 1.0,
      windowLit: 0.75,
      heightMin: 18,
      heightMax: 38,
      waterTower: false,
      acUnit: false,
      antenna: false,
      billboard: true,
      solar: true,
      greenery: true,
    },
    lamp: {
      color: { r: 0.78, g: 0.95, b: 1.0 },
      intensity: 2.4,
      distance: 24,
      style: 'led',
    },
    particles: {
      color: { r: 0.7, g: 0.95, b: 0.9 },
      count: 300,
      size: 0.05,
      speed: 0.7,
      opacity: 0.45,
    },
    billboard: { accent: { r: 0.3, g: 0.9, b: 0.85 }, glow: 1.8 },
    vehicle: {
      palette: [
        { r: 0.9, g: 0.92, b: 0.94 },
        { r: 0.55, g: 0.58, b: 0.62 },
        { r: 0.2, g: 0.55, b: 0.5 },
        { r: 0.85, g: 0.3, b: 0.25 },
      ],
    },
    pedestrian: {
      palette: [
        { r: 0.55, g: 0.6, b: 0.7 },
        { r: 0.8, g: 0.6, b: 0.5 },
        { r: 0.4, g: 0.75, b: 0.7 },
        { r: 0.9, g: 0.8, b: 0.4 },
      ],
    },
    storefront: ['NEXUS AI', 'EV CHARGE', 'NEO BISTRO', 'CLOUD', 'GREEN'],
  },
};

/** Two themes for interpolation at a continuous era coordinate. */
export function themePairAt(eraFloat: number): { a: Theme; b: Theme; t: number } {
  const ids = Object.keys(THEMES) as EraId[];
  const x = Math.max(0, Math.min(ids.length - 1, eraFloat));
  const i0 = Math.floor(x);
  const i1 = Math.min(i0 + 1, ids.length - 1);
  const t = x - i0;
  return { a: THEMES[ids[i0]], b: THEMES[ids[i1]], t };
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

/** Convert an Rgb to a hex string usable by THREE.Color. */
export function rgbToHex(c: Rgb): string {
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}