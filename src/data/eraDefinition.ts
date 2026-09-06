/**
 * Shared era data contract for city-timelapse.
 *
 * Every era (1945, 1965, 1985, 2005, 2025) is described by a single
 * `EraDefinition`. This is the single source of truth that downstream era
 * modules (buildings, vehicles, storefronts, ads, street props, lighting,
 * audio) implement against. It intentionally carries no Three.js scene
 * content — this file only defines the *contract* shape.
 */

/** The set of all supported years, used as a discriminated key. */
export type EraKey = 1945 | 1965 | 1985 | 2005 | 2025;

/** A named color expressed in CSS hex form, e.g. "#b3a48c". */
export type HexColor = string;

/** A named palette swatch key used across era visuals. */
export type PaletteKey =
  | 'sky'
  | 'ground'
  | 'buildingBase'
  | 'buildingAccent'
  | 'accent'
  | 'nightfall';

/** Audio cue identifiers that the era audio layer can resolve. */
export type AudioCueId =
  | 'ambient'
  | 'sfxBirds'
  | 'sfxTraffic'
  | 'sfxCarHorn'
  | 'sfxRail'
  | 'sfxConstruction'
  | 'sfxPedestrians'
  | 'sfxRadio'
  | 'sfxNeon';

/** A named vehicle type used by the era vehicle module. */
export type VehicleType =
  | 'sedan'
  | 'truck'
  | 'bus'
  | 'taxi'
  | 'motorcycle'
  | 'police'
  | 'suv';

/**
 * A single building style descriptor. The concrete procedural building
 * generator consumes these fields; no scene geometry lives here.
 */
export interface BuildingStyle {
  /** Human-readable style name, e.g. "prewar-brick". */
  name: string;
  /** Preferred height range in world units. */
  heightRange: [number, number];
  /** Number of floors to render for the facade. */
  floors: number;
  /** Palette keys used for the facade. */
  palette: PaletteKey[];
  /** Roughness / material feel hint. */
  material: 'brick' | 'stone' | 'glass' | 'concrete' | 'metal';
  /** Optional decorative identifiers (cornices, water towers, antennas). */
  features?: string[];
}

/** Per-era lighting configuration. */
export interface EraLighting {
  /** Ambient/hemisphere intensity. */
  ambientIntensity: number;
  /** Directional (sun/moon) intensity. */
  directionalIntensity: number;
  /** Warmth of the key light; 0 cool -> 1 warm. */
  warmth: number;
  /** Whether the era uses night/neon lighting. */
  isNight: boolean;
  /** Optional hex tint for fog / atmosphere. */
  fogColor?: HexColor;
}

/** Aggregate definition for one year. */
export interface EraDefinition {
  /** The year this definition describes. */
  year: EraKey;
  /** Named color palette used across the era. */
  palette: Record<PaletteKey, HexColor>;
  /** Building style descriptors for the procedural architecture module. */
  buildingStyles: BuildingStyle[];
  /** Vehicle types present in this era (ordered by prevalence). */
  vehicles: VehicleType[];
  /** Storefront type identifiers, e.g. "butcher", "cafe", "electronics". */
  storefronts: string[];
  /** Advertisement type identifiers, e.g. "sign", "billboard", "neon". */
  ads: string[];
  /** Street prop identifiers, e.g. "hydrant", "bench", "lamp". */
  streetProps: string[];
  /** Lighting configuration for the era. */
  lighting: EraLighting;
  /** Audio cue ids the era audio layer should load. */
  audioCues: AudioCueId[];
}