/**
 * Shared era domain: typed contracts for every city-block aspect that changes
 * across the timeline (1945 -> 2025).
 *
 * All discrete (string/enum) fields describe era-authentic families; all
 * numeric fields are scaled 0..1 (or unit-footed counts / meters) so that the
 * interpolation engine can blend two eras deterministically.
 */

/** An RGB triplet in 0..255 space. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Architecture style + building palette / height profile for an era. */
export interface Architecture {
  /** Canonical style id, e.g. `'art-deco'`, `'mid-century'`, `'glass-tower'`. */
  styleId: string;
  /** Facade color palette (hex strings) used for residential/commercial faces. */
  facadePalette: string[];
  /** Roof profile id: `'gable'`, `'flat'`, `'parapet'`, `'green-roof'`. */
  roofStyle: string;
  /** Shortest permissible building height in meters. */
  minHeightM: number;
  /** Tallest permissible building height in meters. */
  maxHeightM: number;
  /** Block coverage proportion (0..1) — how much of the lot is built up. */
  blockDensity: number;
  /** Probability that a facade wall gains windows (0..1). */
  windowChance: number;
  /** Fraction of facade area that is glazing (0..1). */
  glassRatio: number;
  /** Rooftop / upper-floor architectural lighting level (0..1). */
  roofLighting: number;
  /** Historic masonry weight vs modern structural feel (0..1). */
  masonry: number;
  /** Setback / step-back discipline id for skylines. */
  setbackStyle: string;
}

/** A discrete member of an era's vehicle fleet. */
export interface VehicleKind {
  id: string;
  label: string;
}

/** Vehicle fleet set + traffic behavior profile. */
export interface Vehicles {
  fleet: VehicleKind[];
  /** Average traffic density on the block (0..1). */
  trafficDensity: number;
  /** Share of fleet that is electric / quiet (0..1). */
  electricRatio: number;
  /** Paintwork reflectivity (0 matt..1 gloss). */
  bodyGloss: number;
  /** Chrome / brightwork coverage (0..1). */
  chrome: number;
  /** Headlamp colour: 0 = warm tungsten, 1 = cool white/LED. */
  headlightCool: number;
  /** Engine/exhaust audible level (0..1). */
  engineNoise: number;
  /** Horn / occasional klaxon level (0..1) (period-specific). */
  hornLevel: number;
}

/** Storefront facade design descriptors. */
export interface Storefronts {
  /** Storefront genre id: `'awning-facade'`, `'plate-glass'`, `'neon-store'`, `'green-glass'`. */
  styleId: string;
  /** Awning / canopy style id, or `'none'`. */
  awning: string;
  /** Storefront signage lighting (0..1). */
  signageLighting: number;
  /** Proportions of plate glass storefront (0..1). */
  glassFront: number;
  /** Door closure design id: `'panel-wood'`, `'aluminum'`, `'sliding-glass'`, `'automatic-slide'`. */
  doorClosure: string;
  /** Neon / luminous store ornament intensity (0..1). */
  neonLevel: number;
  /** Window dressing / merchandise display richness (0..1). */
  windowDressing: number;
}

/** Advertisement set for the era. */
export interface Advertisements {
  /** Dominant advertising medium id. */
  medium: string;
  /** Number of ad placings on the block (count). */
  count: number;
  /** Illumination intensity of signage ads (0..1). */
  intensity: number;
  /** Neon share (warm) vs LED share (cool) of the glow (0..1: 0 warm..1 cool). */
  neonToLed: number;
  /** Colour poster saturation (0 muted..1 vivid). */
  posterSaturation: number;
  /** Fraction of ads that are moving / screen-based (0..1). */
  animatedRatio: number;
  /** Representative ad panel palette. */
  panelPalette: string[];
}

/** Pedestrian outfit variants for the era. */
export interface PedestrianOutfit {
  /** Outfit catalogue / style id for the era. */
  styleId: string;
  /** Distinct outfit-variant weight within the population (0..1). */
  variety: number;
  /** Colourfulness vs monotone (0..1). */
  colorfulness: number;
  /** Headwear popularity (hats/caps, 0..1). */
  hatLevel: number;
  /** Formal suiting vs casual wear (0..1). */
  formality: number;
  /** Fabric shine / synthetic sheen (0..1). */
  materialShine: number;
  /** Representative outfit palette. */
  palette: string[];
}

/** Atmosphere & lighting profile. */
export interface Atmosphere {
  /** Profile id, `'golden-haze'`, `'pastel-day'`, `'neon-dusk'`, `'crisp-cold'`, `'led-clean'`. */
  profileId: string;
  /** Sky colour used for lighting keys. */
  skyTint: Rgb;
  /** Sun / primary-source intensity (0..1). */
  sunGlow: number;
  /** Warmth of light: 0 candle warm .. 1 cool white. */
  lightWarmth: number;
  /** Sky exposure / ambient brightness (0..1). */
  skyExposure: number;
  /** Atmospheric haze / pollution fog (0..1). */
  haze: number;
  /** Dust / particle shimmer (0..1). */
  dust: number;
  /** Global contrast (0..1). */
  contrast: number;
  /** Global colour saturation (0..1). */
  saturation: number;
  /** Softness of shadows (0 hard..1 soft). */
  shadowSoftness: number;
}

/** Per-era sound design (SFX) profile. */
export interface SfxProfile {
  /** Soundbank id, e.g. `'sfx-1945'`. */
  id: string;
  /** Ambient bed clip id. */
  ambient: string;
  /** Master ambiance gain (0..1). */
  ambienceLevel: number;
  /** Traffic bed gain (0..1). */
  traffic: number;
  /** Audible engine / motor level (0..1). */
  engineNoise: number;
  /** Electrical hum / mains drone (0..1). */
  electricalHum: number;
  /** Wind / air movement gain (0..1). */
  wind: number;
  /** Bird / natural sound gain (0..1). */
  birds: number;
  /** Retro clock / harmonic chime gain (0..1). */
  dayChime: number;
  /** Modern glass / panelling resonance gain (0..1). */
  glassHum: number;
  /** Digital artefact / interface gain (0..1). */
  digitalLevel: number;
  /** Retro tape / reel hum against modern digital floor (0..1). */
  reelTape: number;
}

/**
 * The complete era profile for one timeline year. Every transformed aspect of
 * the city block is expressed: architecture (palettes/heights/style), vehicles,
 * storefronts, advertisements, pedestrian outfits, atmosphere, and SFX.
 */
export interface EraData {
  year: number;
  architecture: Architecture;
  vehicles: Vehicles;
  storefronts: Storefronts;
  advertisements: Advertisements;
  pedestrians: PedestrianOutfit;
  atmosphere: Atmosphere;
  sfx: SfxProfile;
}