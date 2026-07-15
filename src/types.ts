// ---------------------------------------------------------------------------
// Domain types — intentionally free of any three.js import so the era model
// can be reasoned about and tested independently of the rendering layer.
// ---------------------------------------------------------------------------

/** Linear RGB triplet in 0..1 sRGB-ish space (used purely for interpolation). */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Identifiers for the six selectable eras on the timeline. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

/**
 * EraConfig describes every *continuous* aspect of the scene for one era.
 * A single blended config drives the whole scene at any moment via linear
 * interpolation between the two neighbouring eras.
 *
 * Discrete elements (flying cars, holograms, robots…) are derived from these
 * continuous weights and crossfaded with smoothstep by the scene modules.
 */
export interface EraConfig {
  // --- Atmosphere / sky ---
  skyTop: RGB;
  skyBottom: RGB;
  sunColor: RGB;
  sunIntensity: number;
  sunAzimuth: number; // degrees
  sunElevation: number; // degrees
  fogColor: RGB;
  fogDensity: number; // exponential fog density
  starsIntensity: number; // 0..1
  cloudiness: number; // 0..1

  // --- Lighting ---
  ambientColor: RGB;
  ambientIntensity: number;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;

  // --- Ground ---
  groundColor: RGB;
  roadColor: RGB;
  sidewalkColor: RGB;

  // --- Buildings ---
  buildingGlassiness: number; // 0..1
  windowGlow: number; // 0..1 emissive strength for lit windows
  windowLitRatio: number; // 0..1 fraction of lit windows
  buildingTint: RGB; // facade base colour
  buildingEmissive: RGB;
  buildingMetalness: number;
  buildingRoughness: number;

  // --- Storefronts (blend weights, roughly normalised per era) ---
  storefrontPaint: number;
  storefrontNeon: number;
  storefrontLED: number;
  storefrontHologram: number;

  // --- Billboards / advertisements ---
  billboardPaint: number;
  billboardNeon: number;
  billboardLED: number;
  billboardHologram: number;

  // --- People ---
  pedestrianDensity: number; // 0..1
  robotAmount: number; // 0..1 share of "pedestrians" that are robots
  pedestrianPalette: RGB[];

  // --- Vehicles ---
  vehicleDensity: number; // 0..1
  flyingCarAmount: number; // 0..1 share of vehicles that fly
  groundVehicleAmount: number; // 0..1 share that stay on the road
  vehiclePalette: RGB[];

  // --- Misc glow used to scale bloom-friendly emissive intensity ---
  neonIntensity: number;
}

export const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025', '2055'];

export const ERA_YEARS: Record<EraId, number> = {
  '1945': 1945,
  '1965': 1965,
  '1985': 1985,
  '2005': 2005,
  '2025': 2025,
  '2055': 2055,
};
