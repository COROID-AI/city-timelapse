/**
 * Era data model — the single source of truth describing what visually and
 * aurally distinguishes each of the five timeline stops (1945, 1965, 1985,
 * 2005, 2025).
 *
 * This module is deliberately pure: it declares only types. There are no
 * runtime values, no DOM access, and no Three.js imports. It describes the
 * contract that every downstream module (scene, city block, audio, timeline)
 * reads from.
 */
import type { PeriodYear } from '../timeline';

/** The year label identifying a timeline stop. */
export type Year = PeriodYear;

/** A hexadecimal RGB color string, e.g. "#aabbcc". */
export type HexColor = string;

/** Semantic color palette consumed by the scene + material builders. */
export interface EraPalette {
  /** Ground / terrain tint. */
  readonly ground: HexColor;
  /** Asphalt / street surface. */
  readonly road: HexColor;
  /** Paving / sidewalk surface. */
  readonly sidewalk: HexColor;
  /** Dominant building facade color. */
  readonly buildingPrimary: HexColor;
  /** Secondary building trim / band color. */
  readonly buildingSecondary: HexColor;
  /** Highlight / signage accent color. */
  readonly accent: HexColor;
  /** Tree / planting foliage color. */
  readonly foliage: HexColor;
}

/** Atmospheric fog parameters. */
export interface EraFog {
  /** Fog tint, usually close to the sky tint. */
  readonly color: HexColor;
  /** Distance from the camera at which fog begins (world units). */
  readonly near: number;
  /** Distance at which fog is fully opaque (world units). */
  readonly far: number;
}

/** An archetype describing how buildings of an era look and are built. */
export interface BuildingStyle {
  /** Human-readable archetype name, e.g. "Art Deco office block". */
  readonly name: string;
  /** Dominant construction material category. */
  readonly material:
    | 'red-brick'
    | 'limestone'
    | 'reinforced-concrete'
    | 'glass-curtain-wall'
    | 'structural-steel'
    | 'smart-glass';
  /** Storey range [min, max] guiding procedural height. */
  readonly heightRange: readonly [number, number];
  /** Facade treatment descriptor. */
  readonly facade: string;
  /** Roofline silhouette descriptor. */
  readonly roofline: string;
}

/** A vehicle archetype traversing the era's streets. */
export interface VehicleProfile {
  /** Human-readable model name, e.g. "Chevy Bel Air". */
  readonly name: string;
  /** Vehicle category. */
  readonly type:
    | 'tram'
    | 'streetcar'
    | 'sedan'
    | 'wagon'
    | 'muscle-car'
    | 'suv'
    | 'delivery-van'
    | 'bus'
    | 'drone';
  /** Propulsion category. */
  readonly powertrain:
    | 'electric-overhead'
    | 'petrol'
    | 'diesel'
    | 'hybrid'
    | 'battery-electric';
  /** Outline / proportion descriptor for procedural modelling. */
  readonly silhouette: string;
}

/** A pedestrian wardrobe archetype for populating sidewalks. */
export interface WardrobeProfile {
  /** Human-readable style name, e.g. "Zoot-suited clerk". */
  readonly name: string;
  /** Outline / proportion descriptor. */
  readonly silhouette: string;
  /** Clothing colors (hex), used to vary NPC shading. */
  readonly palette: readonly HexColor[];
  /** Notable props carried by NPCs of this archetype. */
  readonly accessories: readonly string[];
}

/** A signage treatment applied to shopfronts and hoardings. */
export interface SignageStyle {
  /** Display technology category. */
  readonly medium:
    | 'painted'
    | 'incandescent'
    | 'neon'
    | 'fluorescent'
    | 'crt'
    | 'led-array'
    | 'lcd-screen'
    | 'holographic';
  /** Typical advertised content / wording motif. */
  readonly content: string;
  /** How the sign is lit. */
  readonly illumination: 'none' | 'front-lit' | 'back-lit' | 'self-emissive';
}

/**
 * The complete typed description of a single era. Assembled into the `ERAS`
 * record keyed by {@link Year} in `./data.ts`.
 */
export interface EraDefinition {
  /** Short human label, e.g. "Post-war recovery". */
  readonly label: string;
  /** Semantic color palette for scene and materials. */
  readonly palette: EraPalette;
  /** Sky dome tint. */
  readonly skyTint: HexColor;
  /** Directional (sun) light intensity, in lux-like 0–~2 range. */
  readonly sunIntensity: number;
  /** Atmospheric fog parameters. */
  readonly fog: EraFog;
  /** Ordered building archetypes populating the block plots. */
  readonly buildingStyles: readonly BuildingStyle[];
  /** Vehicles traversing the streets. */
  readonly vehicleSet: readonly VehicleProfile[];
  /** Pedestrian wardrobe archetypes. */
  readonly pedestrianWardrobe: readonly WardrobeProfile[];
  /** Signage treatments applied to shopfronts. */
  readonly signageStyles: readonly SignageStyle[];
  /** Audio cue identifiers consumed by the procedural SFX mixer. */
  readonly audioTags: readonly string[];
}
