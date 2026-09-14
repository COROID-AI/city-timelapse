/**
 * Era domain contract for the City Time Period Timelapse.
 *
 * Every era-affected aspect of the city block — palette, buildings, vehicles,
 * storefronts, advertisements, pedestrians (incl. outfits), atmosphere and
 * ambience — is described by one `EraTheme` data object keyed by `EraId`.
 * This module owns the schema, the exact five timeline stops (`ERA_YEARS`)
 * and the derived `EraId`. Era content itself (building sets, vehicle fleets,
 * storefronts, ad copy, pedestrian outfits) is authored by the phase-3
 * builder tasks against these types.
 *
 * Timeline: the user requested exactly 1945, 1965, 1985, 2005 and 2025 (see
 * README.md). README also mentions a 2055 variant while saying "any of the 5
 * different years"; the five requested years are authoritative. The schema is
 * kept extensible so an extra era could later be added as data only — add the
 * literal to `ERA_YEARS` and ship one complete `EraTheme` for it.
 */

/** The five timeline stops, ascending, exactly as requested. */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

/**
 * Identifier of one timeline era. Derived from `ERA_YEARS` so the id set can
 * never drift from the shipped timeline stops.
 */
export type EraId = (typeof ERA_YEARS)[number];

/** Hex RGB color token, e.g. `#rrggbb`. */
export type ColorHex = string;

/** Sun / primary light-source token for an era. */
export interface EraSun {
  /** Sun light color. */
  color: ColorHex;
  /** Relative intensity; 0 = dark, 1 = reference, >1 = brighter. */
  intensity: number;
}

/** Curated per-era color tokens (see `ERA_PALETTES` in src/era/palette.ts). */
export interface EraPalette {
  /** Sky color. */
  sky: ColorHex;
  /** Fog / haze color. */
  fog: ColorHex;
  /** Sun color and intensity. */
  sun: EraSun;
  /** Street asphalt color. */
  asphalt: ColorHex;
  /** Sidewalk color. */
  sidewalk: ColorHex;
  /** Primary facade material colors (brick, stone, glass, panels...). */
  facadeMaterials: readonly ColorHex[];
  /** Accent / neon color for signs, awnings and trims. */
  accent: ColorHex;
  /** Color of signage / neon glow. */
  signageGlow: ColorHex;
}

/** Building appearance theme for an era. */
export interface EraBuildings {
  /** Typical building height band in meters, [min, max]. */
  heightRange: readonly [number, number];
  /** Dominant window treatment keyword (e.g. 'small-paned', 'glass-curtain'). */
  windowStyle: string;
  /** Dominant roof treatment keyword (e.g. 'cornice', 'flat', 'green-roof'). */
  roofStyle: string;
  /** Facade material keyword resolved together with `palette.facadeMaterials`. */
  facadeMaterial: string;
  /** Typical storefront frontage as a fraction of lot width (0..1). */
  storefrontFrontage: number;
}

/** Vehicle appearance theme for an era. */
export interface EraVehicles {
  /** Dominant body style keyword (e.g. 'sedan', 'muscle-car', 'crossover'). */
  bodyStyle: string;
  /** Typical paint colors sampled when spawning vehicles. */
  colors: readonly ColorHex[];
  /** Vehicle length band in meters, [min, max]. */
  lengthRange: readonly [number, number];
  /** Typical travel speed band in m/s, [min, max]. */
  speedRange: readonly [number, number];
  /** Headlight / tail-light glow strength (0 = none, 1 = strong). */
  lightGlow: number;
}

/** Storefront appearance theme for an era. */
export interface EraStorefronts {
  /** Sign style keyword (e.g. 'painted', 'neon', 'LED'). */
  signStyle: string;
  /** Awning / canopy style keyword (e.g. 'striped', 'flat', 'none'). */
  awningStyle: string;
  /** Display-window dressing keyword. */
  windowDressing: string;
  /** Proportion of storefronts fitted with awnings (0..1). */
  awningDensity: number;
}

/** Advertisement theme for an era. */
export interface EraAds {
  /** Dominant ad medium keyword (e.g. 'billboard', 'neon', 'digital-screen'). */
  medium: string;
  /** Ad brightness (0 = dim, 1 = bright). */
  brightness: number;
  /** Color palette sampled for ad artwork. */
  colors: readonly ColorHex[];
  /** Density of ads visible on the block (0..1). */
  density: number;
}

/** Pedestrian theme for an era, including outfits. */
export interface EraPedestrians {
  /** Dominant outfit style keyword (e.g. 'wartime-coats', 'pastel-suits'). */
  outfitStyle: string;
  /** Outfit color palette sampled when dressing pedestrians. */
  outfitColors: readonly ColorHex[];
  /** Walking speed band in m/s, [min, max]. */
  walkSpeedRange: readonly [number, number];
  /** Pedestrian density on the block (0..1). */
  density: number;
  /** Typical carried accessories (e.g. 'hat', 'umbrella', 'headphones'). */
  accessoryKeywords: readonly string[];
}

/** Atmospheric / weather character for an era. */
export interface EraAtmosphere {
  /** Air quality keyword (e.g. 'clear', 'smog'). */
  airQuality: string;
  /** Haze / dust density in the air (0..1). */
  haze: number;
  /** Precipitation type. */
  precipitation: 'none' | 'drizzle' | 'rain' | 'snow';
  /** Typical daylight mood keyword (e.g. 'soft-warm', 'harsh-smog'). */
  daylightMood: string;
}

/** Audible / ambient street character for an era (audio wiring input). */
export interface EraAmbience {
  /** Street noise level 0..1 — feeds the audio mixer. */
  streetNoise: number;
  /** Dominant soundscape keyword (e.g. 'big-band', 'synth-wave', 'ev-hum'). */
  soundscape: string;
  /** General street activity level 0..1 (crowd, bustle). */
  streetActivity: number;
}

/** The eight era-affected aspect sections of `EraTheme`. */
export type EraThemeAspect =
  | 'palette'
  | 'buildings'
  | 'vehicles'
  | 'storefronts'
  | 'ads'
  | 'pedestrians'
  | 'atmosphere'
  | 'ambience';

/** Runtime list of `EraTheme` aspect sections, for schema-completeness checks. */
export const ERA_THEME_ASPECTS: readonly EraThemeAspect[] = [
  'palette',
  'buildings',
  'vehicles',
  'storefronts',
  'ads',
  'pedestrians',
  'atmosphere',
  'ambience',
];

/** Complete data-driven description of one era for the whole block. */
export interface EraTheme {
  /** Era this theme describes. */
  id: EraId;
  /** Short human label, e.g. 'Wartime 1945'. */
  label: string;
  /** One-line period description for UI tooltips. */
  description: string;
  palette: EraPalette;
  buildings: EraBuildings;
  vehicles: EraVehicles;
  storefronts: EraStorefronts;
  ads: EraAds;
  pedestrians: EraPedestrians;
  atmosphere: EraAtmosphere;
  ambience: EraAmbience;
}