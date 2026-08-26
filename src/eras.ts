/**
 * Era configuration contract — the single source of truth for every time
 * period the city block can render.
 *
 * The contract is intentionally data-driven: consumers (the store and all
 * scene subsystems) read from `eraConfigs` keyed by `EraId` and never switch
 * on hard-coded era names. Adding a sixth era (e.g. 2055) is a pure data
 * addition:
 *
 *   1. extend the `EraId` union with `'2055'`,
 *   2. append `'2055'` to `ERA_IDS`,
 *   3. add an `EraConfig` entry to `eraConfigs`.
 *
 * No consumer refactoring is required.
 */

/** Discriminated union of every supported era. Extend here for 2055. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Human-facing metadata for an era. */
export interface EraSpec {
  id: EraId;
  /** Numeric calendar year used for ordering / math. */
  year: number;
  /** Short display label, e.g. for the timeline slider. */
  label: string;
  /** One-line description shown in UI / tooltips. */
  description: string;
}

/** Building height, facade, window and rooftop appearance per era. */
export interface BuildingsConfig {
  /** Facade color palette (hex strings) sampled across building blocks. */
  facadePalette: string[];
  /** Material name used for facade shading / roughness. */
  facadeMaterial: string;
  /** Window grid style rendered on facades. */
  windowStyle: string;
  /** Emissive color of lit windows at night. */
  windowEmissiveColor: string;
  /** Emissive intensity of lit windows (0..1). */
  windowEmissiveIntensity: number;
  /** [min, max] building scale along Y (units). */
  heightRange: [number, number];
  /** Rooftop props / silhouettes present this era. */
  rooftopProps: string[];
}

/** Vehicle types, colors and road behavior per era. */
export interface VehiclesConfig {
  /** Stylized vehicle types present on the road. */
  types: string[];
  /** Body color palette for vehicles. */
  colors: string[];
  /** Relative traffic density (0..1). */
  trafficDensity: number;
  /** Headlight color. */
  headlightColor: string;
  /** Special/notable vehicles (e.g. trolley, drone). */
  specialVehicles: string[];
}

/** Storefront style, awnings and signage per era. */
export interface StorefrontsConfig {
  /** Awning / canopy color palette. */
  awningColors: string[];
  /** Storefront door style. */
  doorStyle: string;
  /** Window display / merchandise style. */
  windowDisplay: string;
  /** Storefront facade palette. */
  signPalette: string[];
}

/** Advertisement content and media type per era. */
export interface AdvertisementsConfig {
  /** Media type (poster, neon, digital, LED, hologram). */
  mediaType: string;
  /** Sample ad copy shown on billboards / storefronts. */
  examples: string[];
  /** Emissive glow color of signage. */
  glowColor: string;
  /** Glow intensity (0..1). */
  glowIntensity: number;
}

/** Pedestrian outfit palettes and accessories per era. */
export interface PedestriansConfig {
  /** Clothing color palettes worn by pedestrians. */
  outfitPalettes: string[];
  /** Accessory styles (hats, bags, phones, etc.). */
  accessories: string[];
}

/** Day/night tone, neon and street-lamp lighting per era. */
export interface LightingConfig {
  /** Ambient color cast during daytime. */
  dayTone: string;
  /** Ambient color cast at night. */
  nightTone: string;
  /** Overall neon/emissive intensity (0..1). */
  neonIntensity: number;
  /** Street lamp type. */
  lampType: string;
  /** Street lamp light color. */
  lampLightColor: string;
  /** Street lamp intensity (0..1). */
  lampIntensity: number;
}

/** Atmospheric values: fog, sky, ambient SFX profile per era. */
export interface AtmosphereConfig {
  /** Fog color. */
  fogColor: string;
  /** Sky gradient top color. */
  skyGradientTop: string;
  /** Sky gradient bottom color. */
  skyGradientBottom: string;
  /** Ambient SFX profile name consumed by the audio layer. */
  ambientSfxProfile: string;
  /** Particle atmosphere type (dust, smog, neon flakes, clear). */
  hazeType: string;
  /** Exposure / brightness scale. */
  exposure: number;
  /** Fog density (0..1). */
  haze: number;
}

/**
 * The complete per-era configuration — the single source of truth every
 * subsystem (buildings, vehicles, storefronts, ads, pedestrians, lighting,
 * atmosphere, audio) reads from.
 */
export interface EraConfig {
  id: EraId;
  /** Human-facing metadata. */
  spec: EraSpec;
  buildings: BuildingsConfig;
  vehicles: VehiclesConfig;
  storefronts: StorefrontsConfig;
  advertisements: AdvertisementsConfig;
  pedestrians: PedestriansConfig;
  lighting: LightingConfig;
  atmosphere: AtmosphereConfig;
}

/** Ordered list of every supported era id (timeline order). */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/**
 * Ordered registry of era specs, aligned with ERA_IDS. Consumed by UI
 * components (e.g. the timeline slider) to render the era options.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick city, sepia tones, vintage cars, gas lamps.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastel, classic chrome cars, early neon.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete & glass, boxy cars, bright neon, sodium lamps.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Modern glass, SUVs, digital billboards, LED lighting.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'Contemporary, EVs & scooters, LED screens, clean air.',
  },
];

/** Index of an era id within the ordered timeline. */
export function eraIndex(id: EraId): number {
  return ERA_IDS.indexOf(id);
}

/** Look up the human-readable spec for an era id. */
export function getEraSpec(id: EraId): EraSpec {
  return eraConfigs[id].spec;
}

/** Look up the full config for an era id. */
export function getEraConfig(id: EraId): EraConfig {
  return eraConfigs[id];
}

/** All era ids in timeline order, as a frozen tuple for consumers. */
export function getEraIds(): readonly EraId[] {
  return ERA_IDS;
}

/**
 * Concrete, era-accurate configuration for all five supported eras.
 * Extend this record (and `EraId` / `ERA_IDS`) to add a sixth era.
 */
export const eraConfigs: Record<EraId, EraConfig> = {
  '1945': {
    id: '1945',
    spec: {
      id: '1945',
      year: 1945,
      label: '1945',
      description: 'Post-war brick, sepia tones, vintage cars and gas lamps.',
    },
    buildings: {
      facadePalette: ['#8a5a3a', '#7a4a2e', '#9a6a44', '#6b3f26'],
      facadeMaterial: 'brick',
      windowStyle: 'small-multi',
      windowEmissiveColor: '#ffd9a0',
      windowEmissiveIntensity: 0.35,
      heightRange: [6, 22],
      rooftopProps: ['water-tower', 'chimney', 'billboard'],
    },
    vehicles: {
      types: ['sedan', 'coupe', 'truck', 'trolley'],
      colors: ['#3a3a3a', '#5a4a3a', '#7a2a2a', '#2a2a4a'],
      trafficDensity: 0.25,
      headlightColor: '#ffd080',
      specialVehicles: ['trolley', 'delivery-truck'],
    },
    storefronts: {
      awningColors: ['#7a3a2a', '#5a3a2a', '#8a5a3a'],
      doorStyle: 'wooden-recess',
      windowDisplay: 'window-display',
      signPalette: ['#3a2a1a', '#5a3a2a'],
    },
    advertisements: {
      mediaType: 'painted-posters',
      examples: ['WAR BONDS', 'COCA-COLA 5C', 'VICTORY'],
      glowColor: '#ffd9a0',
      glowIntensity: 0.2,
    },
    pedestrians: {
      outfitPalettes: ['#4a4a3a', '#6b5a4a', '#3a3a2a', '#7a6a5a'],
      accessories: ['fedora', 'overcoat', 'satchel'],
    },
    lighting: {
      dayTone: '#d9c9a8',
      nightTone: '#3a3630',
      neonIntensity: 0.15,
      lampType: 'gas',
      lampLightColor: '#ffd080',
      lampIntensity: 0.5,
    },
    atmosphere: {
      fogColor: '#c9b89a',
      skyGradientTop: '#8a8a9a',
      skyGradientBottom: '#d9c9a8',
      ambientSfxProfile: 'sepia-street',
      hazeType: 'dust',
      exposure: 0.8,
      haze: 0.25,
    },
  },

  '1965': {
    id: '1965',
    spec: {
      id: '1965',
      year: 1965,
      label: '1965',
      description: 'Mid-century pastel, classic chrome cars and neon signs.',
    },
    buildings: {
      facadePalette: ['#7aa8b8', '#c8a0a0', '#d8c8a0', '#a8b8a0'],
      facadeMaterial: 'pastel-stucco',
      windowStyle: 'large-grid',
      windowEmissiveColor: '#ffe0b0',
      windowEmissiveIntensity: 0.45,
      heightRange: [8, 30],
      rooftopProps: ['neon-sign', 'water-tower', 'billboard'],
    },
    vehicles: {
      types: ['sedan', 'coupe', 'convertible', 'station-wagon'],
      colors: ['#c8d8e8', '#e8c8a0', '#a0c8c8', '#e0e0e0'],
      trafficDensity: 0.45,
      headlightColor: '#ffe8a0',
      specialVehicles: ['convertible', 'station-wagon'],
    },
    storefronts: {
      awningColors: ['#c84040', '#40a0c8', '#e8c840'],
      doorStyle: 'glass-swing',
      windowDisplay: 'neon-sign',
      signPalette: ['#c84040', '#40a0c8'],
    },
    advertisements: {
      mediaType: 'neon-signs',
      examples: ['McDONALDS', 'DINER', 'GAS'],
      glowColor: '#ff5a5a',
      glowIntensity: 0.55,
    },
    pedestrians: {
      outfitPalettes: ['#c8a0a8', '#a8c8c8', '#e8d8a8', '#c8c8e8'],
      accessories: ['hat', 'handbag', 'sunglasses'],
    },
    lighting: {
      dayTone: '#e8d8c0',
      nightTone: '#2a2a3a',
      neonIntensity: 0.55,
      lampType: 'cobra',
      lampLightColor: '#ffd080',
      lampIntensity: 0.6,
    },
    atmosphere: {
      fogColor: '#d0c8b8',
      skyGradientTop: '#a8b8d8',
      skyGradientBottom: '#e8d8c0',
      ambientSfxProfile: 'neon-street',
      hazeType: 'clear',
      exposure: 0.9,
      haze: 0.12,
    },
  },

  '1985': {
    id: '1985',
    spec: {
      id: '1985',
      year: 1985,
      label: '1985',
      description: 'Concrete and glass, boxy cars, bright neon and sodium lamps.',
    },
    buildings: {
      facadePalette: ['#9a9a9a', '#b0b0b0', '#8a8a8a', '#c8c8c8'],
      facadeMaterial: 'concrete-glass',
      windowStyle: 'brutalist-grid',
      windowEmissiveColor: '#ffd080',
      windowEmissiveIntensity: 0.6,
      heightRange: [10, 45],
      rooftopProps: ['ac-unit', 'satellite-dish', 'neon-sign'],
    },
    vehicles: {
      types: ['sedan', 'hatchback', 'minivan', 'taxi'],
      colors: ['#c84040', '#c8c8c8', '#4040c8', '#e8e8e8'],
      trafficDensity: 0.6,
      headlightColor: '#fff0c0',
      specialVehicles: ['taxi', 'vanagon'],
    },
    storefronts: {
      awningColors: ['#4040c8', '#c84040', '#c8c840'],
      doorStyle: 'sliding-glass',
      windowDisplay: 'neon-sign',
      signPalette: ['#4040c8', '#c84040'],
    },
    advertisements: {
      mediaType: 'bright-neon',
      examples: ['McDONALDS', 'MTV', 'ATARI'],
      glowColor: '#ff5ad8',
      glowIntensity: 0.85,
    },
    pedestrians: {
      outfitPalettes: ['#c840c8', '#40c8c8', '#e8e840', '#4040c8'],
      accessories: ['leg-warmers', 'boom-box', 'bandana'],
    },
    lighting: {
      dayTone: '#d8d8d8',
      nightTone: '#2a1a2a',
      neonIntensity: 0.85,
      lampType: 'sodium',
      lampLightColor: '#ffd080',
      lampIntensity: 0.75,
    },
    atmosphere: {
      fogColor: '#8a8a9a',
      skyGradientTop: '#4a4a6a',
      skyGradientBottom: '#c840a0',
      ambientSfxProfile: 'neon-arcade',
      hazeType: 'smog',
      exposure: 0.85,
      haze: 0.35,
    },
  },

  '2005': {
    id: '2005',
    spec: {
      id: '2005',
      year: 2005,
      label: '2005',
      description: 'Modern glass, SUVs, digital billboards and LED lighting.',
    },
    buildings: {
      facadePalette: ['#6aa0c8', '#5a8ab0', '#7ab0d8', '#4a7a9a'],
      facadeMaterial: 'glass-steel',
      windowStyle: 'curtain-wall',
      windowEmissiveColor: '#c0e0ff',
      windowEmissiveIntensity: 0.7,
      heightRange: [40, 70],
      rooftopProps: ['ac-unit', 'antenna', 'billboard'],
    },
    vehicles: {
      types: ['suv', 'sedan', 'minivan', 'bus'],
      colors: ['#c8c8c8', '#4a6a8a', '#e8e8e8', '#8a8a8a'],
      trafficDensity: 0.75,
      headlightColor: '#ffffff',
      specialVehicles: ['suv', 'bus'],
    },
    storefronts: {
      awningColors: ['#4a6a8a', '#8a8a8a', '#c8c8c8'],
      doorStyle: 'sliding-glass',
      windowDisplay: 'digital-billboard',
      signPalette: ['#4a6a8a', '#8a8a8a'],
    },
    advertisements: {
      mediaType: 'digital-billboards',
      examples: ['Apple', 'NOKIA', 'McDONALDS'],
      glowColor: '#ffffff',
      glowIntensity: 0.7,
    },
    pedestrians: {
      outfitPalettes: ['#8a8a8a', '#4a6a8a', '#c8c8c8', '#6a8a4a'],
      accessories: ['backpack', 'headphones', 'cellphone'],
    },
    lighting: {
      dayTone: '#c0d8e8',
      nightTone: '#2a2a3a',
      neonIntensity: 0.6,
      lampType: 'led',
      lampLightColor: '#c0e0ff',
      lampIntensity: 0.8,
    },
    atmosphere: {
      fogColor: '#b0c8d8',
      skyGradientTop: '#6a8ab0',
      skyGradientBottom: '#c0d8e8',
      ambientSfxProfile: 'city-hum',
      hazeType: 'clear',
      exposure: 1.0,
      haze: 0.15,
    },
  },

  '2025': {
    id: '2025',
    spec: {
      id: '2025',
      year: 2025,
      label: '2025',
      description: 'Contemporary: EVs, scooters and bright LED screens.',
    },
    buildings: {
      facadePalette: ['#6a8ab0', '#8ac0a0', '#a0b0d8', '#4a6a8a'],
      facadeMaterial: 'modern-glass',
      windowStyle: 'floor-to-ceiling',
      windowEmissiveColor: '#d8e8ff',
      windowEmissiveIntensity: 0.8,
      heightRange: [50, 90],
      rooftopProps: ['solar-panel', 'green-roof', 'led-screen'],
    },
    vehicles: {
      types: ['ev', 'scooter', 'sedan', 'bus'],
      colors: ['#c8d8e8', '#e8e8e8', '#4a8a8a', '#c8c8c8'],
      trafficDensity: 0.8,
      headlightColor: '#ffffff',
      specialVehicles: ['ev', 'electric-scooter', 'bus'],
    },
    storefronts: {
      awningColors: ['#6a8ab0', '#8aa0c8', '#b0c8e8'],
      doorStyle: 'automatic-glass',
      windowDisplay: 'led-screen',
      signPalette: ['#6a8ab0', '#8a8aa0'],
    },
    advertisements: {
      mediaType: 'led-screens',
      examples: ['NEXUS AI', 'EV CHARGING', 'STREAM'],
      glowColor: '#a0d8ff',
      glowIntensity: 0.9,
    },
    pedestrians: {
      outfitPalettes: ['#a0c8e8', '#c8c8d8', '#6a8ab0', '#d8e8c8'],
      accessories: ['smartphone', 'earbuds', 'coffee'],
    },
    lighting: {
      dayTone: '#c8d8e8',
      nightTone: '#1a1a2a',
      neonIntensity: 0.9,
      lampType: 'led',
      lampLightColor: '#c0d8ff',
      lampIntensity: 0.9,
    },
    atmosphere: {
      fogColor: '#c0d0e0',
      skyGradientTop: '#5a7aa0',
      skyGradientBottom: '#c0d8e8',
      ambientSfxProfile: 'modern-city',
      hazeType: 'clear',
      exposure: 1.0,
      haze: 0.1,
    },
  },
};