/** The five era stop ids, mirrored by the timeline UI. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Coarse building archetype used across eras. */
export type BuildingType = 'residential' | 'commercial' | 'office';

/** Vehicle archetypes. */
export type VehicleVariant = 'car' | 'truck';

/** A storefront/sign label attached to a building for hover tooltips. */
export interface Storefront {
  name: string;
  /** Vertical placement of the sign on the facade (0 = street level). */
  floor: number;
}

/**
 * Full per-era description consumed by the asset builders and the scene. Every
 * field is intentionally era-specific so adjacent eras look visibly different.
 */
export interface EraDescriptor {
  id: EraId;
  year: number;
  label: string;
  /** Sky gradient top color. */
  skyTop: string;
  /** Sky gradient bottom / horizon color. */
  skyBottom: string;
  /** Fog color (also the scene background haze). */
  fogColor: string;
  /** Fog density. */
  fogDensity: number;
  /** Sun/directional light color. */
  sunColor: string;
  /** Sun intensity. */
  sunIntensity: number;
  /** Ambient light color. */
  ambientColor: string;
  /** Ambient light intensity. */
  ambientIntensity: number;
  /** Ground/asphalt base color. */
  groundColor: string;
  /** Sidewalk color. */
  sidewalkColor: string;
  /** Dominant building facade color. */
  facadeColor: string;
  /** Window glow color (lit windows). */
  windowColor: string;
  /** Probability a given window is lit at night. */
  windowLitChance: number;
  /** Roofline style hint for builders. */
  silhouette: 'flat' | 'stepped' | 'setback' | 'glass';
  /** Typical number of floors per downtown lot. */
  typicalFloors: number;
  /** Vehicle variants present this era. */
  vehicles: VehicleVariant[];
  /** Pedestrian outfit palette (hex). */
  pedestrianColors: string[];
  /** Signage / storefront entries for this era. */
  storefronts: Storefront[];
  /** Advertising billboard text for this era. */
  billboard: string;
  /** Seeded RNG seed so layouts are stable per era. */
  seed: number;
}
