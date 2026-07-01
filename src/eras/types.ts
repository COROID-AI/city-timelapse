/**
 * Type contracts for the city-timelapse eras.
 *
 * These contracts drive rendering, vehicle/pedestrian factories, texture
 * generation, street layout, and asset bundles. Downstream modules import the
 * `Era` type and the canonical `PeriodYear` union to stay in sync across the
 * whole application.
 */

/** Canonical era years, in chronological order. */
export const PERIOD_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

/** A single calendar year that the timeline slider can select. */
export type PeriodYear = (typeof PERIOD_YEARS)[number];

/**
 * Backwards-compatible alias. The asset builder historically consumes eras as a
 * string-literal union of the years. `Era` mirrors `PeriodYear` so existing
 * `makeVehicle(era, variant)` / `makePedestrian(era)` calls keep type-checking.
 */
export type Era = PeriodYear;

/** A 3-channel linear RGB color in the 0..1 range. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** A named palette swatch (hex string kept for texture consumers + linear RGB for shaders). */
export interface PaletteColor {
  /** Human-readable name, e.g. "brick red". */
  name: string;
  /** sRGB hex, e.g. "#a83232". */
  hex: string;
  /** Linear-space RGB in 0..1, ready for three.js materials. */
  linear: RGB;
}

/** A complete per-era color palette used by textures and materials. */
export interface EraPalette {
  /** Sky / atmosphere tint. */
  sky: PaletteColor;
  /** Ground / sidewalk tone. */
  ground: PaletteColor;
  /** Dominant facade base color. */
  facade: PaletteColor;
  /** Accent color (trim, awnings). */
  accent: PaletteColor;
  /** Road surface color. */
  road: PaletteColor;
  /** Lane marking color. */
  markings: PaletteColor;
}

/** A building height profile describing the block skyline for an era. */
export interface BuildingProfile {
  /** Minimum building height, in meters. */
  min: number;
  /** Maximum building height, in meters. */
  max: number;
  /** Average / modal building height, in meters. */
  average: number;
}

/** Road / lane layout describing how the street is drawn for an era. */
export interface LaneSpec {
  /** Number of vehicle traffic lanes (both directions combined). */
  count: number;
 /** Lane width, in meters. */
  width: number;
  /** Whether there is a physical median between directions. */
  hasMedian: boolean;
}

/** Parking provision for an era. */
export interface ParkingSpec {
  /** Number of on-street parallel parking spots on the block. */
  count: number;
  /** Whether off-street surface lots are present. */
  hasLot: boolean;
}

/** Pedestrian walking pose / animation parameters for an era. */
export interface WalkPose {
  /** Walking speed, in meters per second. */
  speed: number;
  /** Stride length, in meters. */
  stride: number;
  /** Arm swing amplitude, in radians. */
  armSwing: number;
  /** Clothing palette hint for the rig (by name). */
  outfit: string;
}

/** A vehicle variant descriptor with model + color. */
export interface VehicleVariant {
  /** Variant key consumed by the vehicle factory: 'car' | 'truck' | etc. */
  variant: string;
  /** Human-readable model name, e.g. "sedan". */
  model: string;
  /** Body color hex, e.g. "#1a1a1a". */
  color: string;
  /** Relative abundance weight (0..1) used for random spawning. */
  weight: number;
}

/** Billboard / signage depth describing how "deep" signage feels for an era. */
export interface BillboardSpec {
  /** Number of billboard / sign panels on the block. */
  count: number;
  /** Whether signs are illuminated (neon / LED). */
  illuminated: boolean;
  /** Vertical extrusion depth of sign geometry, in meters. */
  depth: number;
}

/** Audio cue describing the ambient SFX layer for an era. */
export interface AudioCue {
  /** Identifier of the ambient sound bed asset. */
  ambient: string;
  /** Identifier of the one-shot accent sound asset. */
  accent: string;
  /** Overall ambient volume, 0..1. */
  volume: number;
}

/**
 * A complete, richly-detailed era record. Every field is consumed by at least
 * one downstream system (textures, street layout, vehicle/pedestrian factories,
 * asset bundles, audio).
 */
export interface EraRecord {
  /** Canonical calendar year. */
  year: PeriodYear;
  /** Human-readable label, e.g. "Postwar". */
  label: string;
  /** Short description of the era's character. */
  description: string;
  /** Color palette driving textures and materials. */
  palette: EraPalette;
  /** Building height profile for the skyline. */
  buildings: BuildingProfile;
  /** Road lane layout. */
  lanes: LaneSpec;
  /** On-street parking provision. */
  parking: ParkingSpec;
  /** Pedestrian walking pose parameters. */
  walk: WalkPose;
  /** Vehicle variants present on the street, with spawn weights. */
  vehicles: VehicleVariant[];
  /** Billboard / signage depth. */
  billboard: BillboardSpec;
  /** Ambient + accent audio cues. */
  audio: AudioCue;
}
