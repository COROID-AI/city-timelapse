/**
 * Canonical era data contract for the City Time Period Timelapse.
 *
 * Every era (calendar year) configures every visual and audio aspect of the
 * city block: buildings, vehicles, storefronts, advertisements, pedestrian
 * outfits, sky/lighting, ground, and SFX keys. Era-specific content tasks
 * register a fully-typed {@link EraConfig} against {@link ERA_YEARS} without
 * editing these foundation files.
 */

/** A color expressed as a 24-bit hex number, e.g. `0x8a9bb0`. */
export type HexColor = number;

/** A normalized 0..1 value (density, intensity, roughness, ...). */
export type Normalized = number;

/** A named texture/model key resolved through the asset registry. */
export type AssetKey = string;

/** A named sound-effect key resolved through the asset registry. */
export type SfxKey = string;

/** The kinds of vehicles that can appear in an era. */
export type VehicleType =
  | 'sedan'
  | 'truck'
  | 'bus'
  | 'taxi'
  | 'trolley'
  | 'bicycle'
  | 'horse-cart';

export interface BuildingConfig {
  /** Average building height range in world units. */
  heightRange: [number, number];
  /** Dominant facade color palette. */
  palette: HexColor[];
  /** Window texture key (null for solid facades). */
  windowTexture?: AssetKey | null;
  /** Roof style descriptor. */
  roofStyle: 'flat' | 'peaked' | 'water-tower' | 'none';
  /** Density multiplier 0..1 controlling how many lots are built. */
  density: Normalized;
  /** Material roughness 0..1. */
  roughness: Normalized;
}

export interface VehicleConfig {
  /** Vehicle types active this era. */
  types: VehicleType[];
  /** Traffic density 0..1. */
  density: Normalized;
  /** Paint palette for active vehicles. */
  palette: HexColor[];
  /** Average cruising speed range in world units/second. */
  speedRange: [number, number];
}

export interface StorefrontConfig {
  /** Whether storefronts are present this era. */
  enabled: boolean;
  /** Sign texture keys. */
  signTextures: AssetKey[];
  /** Awning palette. */
  awningPalette: HexColor[];
  /** Window display brightness 0..1. */
  displayBrightness: Normalized;
}

export interface AdvertisementConfig {
  /** Billboard asset keys. */
  billboards: AssetKey[];
  /** Whether neon / backlit signage is present. */
  neon: boolean;
  /** Neon color palette. */
  neonPalette: HexColor[];
  /** Number of ad placements (0 disables advertising). */
  count: number;
}

export interface PedestrianOutfitConfig {
  /** Clothing palette for pedestrians. */
  palette: HexColor[];
  /** Accessory descriptors (hats, umbrellas, ...). */
  accessories: string[];
  /** Number of pedestrians. */
  population: number;
  /** Walking speed range in world units/second. */
  speedRange: [number, number];
}

export interface SkyConfig {
  /** Zenith sky color. */
  topColor: HexColor;
  /** Horizon sky color. */
  bottomColor: HexColor;
  /** Sun / light direction. */
  sunDirection: [number, number, number];
  /** Atmospheric haze 0..1. */
  haze: Normalized;
  /** Cloud texture key (null for clear skies). */
  cloudTexture?: AssetKey | null;
  /** Whether stars are visible (night eras). */
  stars: boolean;
}

export interface LightingConfig {
  /** Ambient light intensity 0..1. */
  ambientIntensity: Normalized;
  /** Directional (sun) light intensity 0..1. */
  sunIntensity: Normalized;
  /** Sun color. */
  sunColor: HexColor;
  /** Shadow softness 0..1. */
  shadowSoftness: Normalized;
  /** Street-lamp light intensity 0..1 (0 = no streetlights). */
  streetlightIntensity: Normalized;
  /** Window emissive glow intensity 0..1. */
  windowGlow: Normalized;
}

export interface GroundConfig {
  /** Ground surface material key. */
  surfaceTexture: AssetKey;
  /** Road texture key. */
  roadTexture: AssetKey;
  /** Sidewalk texture key. */
  sidewalkTexture: AssetKey;
  /** Ground color. */
  color: HexColor;
}

export interface SfxConfig {
  /** Ambient loop keys. */
  ambient: SfxKey[];
  /** One-shot event keys (car horn, birds, ...). */
  events: SfxKey[];
  /** UI / interaction sound keys. */
  ui: SfxKey[];
}

/** Complete per-era configuration for the city block. */
export interface EraConfig {
  /** The calendar year this config describes. */
  year: number;
  buildings: BuildingConfig;
  vehicles: VehicleConfig;
  storefronts: StorefrontConfig;
  advertisements: AdvertisementConfig;
  pedestrianOutfits: PedestrianOutfitConfig;
  sky: SkyConfig;
  lighting: LightingConfig;
  ground: GroundConfig;
  sfx: SfxConfig;
}
