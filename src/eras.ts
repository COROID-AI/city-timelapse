/**
 * eras.ts — Shared Era Types & Registry
 *
 * The declarative foundation for the city timelapse experience. Defines the
 * five eras (1945, 1965, 1985, 2005, 2025) and all era-specific data for
 * buildings, vehicles, storefronts, advertisements, pedestrian outfits,
 * and SFX parameters. The scene, asset builders, traffic system, pedestrian
 * system, audio mixer, and HUD all consume this registry.
 */

// ---------------------------------------------------------------------------
// Core era identity
// ---------------------------------------------------------------------------

/** The five selectable years, in chronological order. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Ordered readonly list of all EraId values. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'] as const;

// ---------------------------------------------------------------------------
// Era spec — top-level metadata
// ---------------------------------------------------------------------------

/** High-level descriptor for a single era. */
export interface EraSpec {
  /** The year identifier. */
  id: EraId;
  /** Display year (number form for formatting). */
  year: number;
  /** Short human-readable label, e.g. "Post-War Boom". */
  label: string;
  /** Longer description shown in the HUD when the era is active. */
  description: string;
}

/** Ordered registry of all era specs. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Recovery',
    description:
      'The war has just ended. Low-rise brick buildings line quiet streets. ' +
      'Few cars — mostly dark sedans and trucks. Pedestrians in muted wool ' +
      'and utility clothing. Hand-painted storefront signs.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century Modern',
    description:
      ' optimism and chrome. Mid-rise concrete and glass buildings appear. ' +
      'Pastel-colored cars with tailfins crowd the streets. Neon signs glow. ' +
      'Pedestrians in slim suits and A-line dresses.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Era',
    description:
      'Glass-and-steel towers rise above the block. Box-shaped sedans in bold ' +
      'colors dominate. Fluorescent and neon signage everywhere. Pedestrians in ' +
      'denim, bright windbreakers, and big hair.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Digital Dawn',
    description:
      'Sleek skyscrapers with curtain walls. Silver SUVs and hybrids mix with ' +
      'older cars. Digital LED billboards replace neon. Pedestrians in baggy ' +
      'jeans, cargo pants, and early smartphones.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Smart City',
    description:
      'Eco-glass towers with vertical gardens. Electric vehicles and rideshare ' +
      'fleets silently navigate. Massive OLED billboards stream dynamic ads. ' +
      'Pedestrians in athleisure, e-scooters, and wireless earbuds.',
  },
];

/** Look up an era spec by id. Throws if the id is not in the registry. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) throw new Error(`Unknown era id: ${id}`);
  return spec;
}

/** Index of an era in the registry (0-based). Useful for timeline position. */
export function getEraIndex(id: EraId): number {
  const idx = ERA_IDS.indexOf(id);
  if (idx < 0) throw new Error(`Unknown era id: ${id}`);
  return idx;
}

// ---------------------------------------------------------------------------
// Building data
// ---------------------------------------------------------------------------

/** Architectural style descriptor for buildings in an era. */
export interface EraBuildingStyle {
  /** Style name for asset generation. */
  style: 'lowrise-brick' | 'midcentury-modern' | 'glass-steel' | 'curtain-wall' | 'eco-glass';
  /** Typical building height range in world units. */
  heightMin: number;
  heightMax: number;
  /** Dominant facade colors (hex strings). */
  facadeColors: string[];
  /** Roof type. */
  roof: 'flat' | 'parapet' | 'stepped' | 'green';
  /** Window pattern. */
  windowPattern: 'small-grid' | 'ribbon' | 'curtain' | 'smart-glass';
  /** Whether buildings have awnings over storefronts. */
  hasAwnings: boolean;
}

// ---------------------------------------------------------------------------
// Vehicle data
// ---------------------------------------------------------------------------

/** Vehicle style descriptor for an era. */
export interface EraVehicleStyle {
  /** Body shape archetype. */
  shape: 'sedan-boxy' | 'finned-cruiser' | 'aero-sedan' | 'crossover' | 'ev-pod';
  /** Typical body colors. */
  colors: string[];
  /** Relative traffic density (0..1). */
  density: number;
  /** Whether vehicles are electric/silent. */
  electric: boolean;
}

// ---------------------------------------------------------------------------
// Storefront & advertisement data
// ---------------------------------------------------------------------------

/** Storefront style descriptor for an era. */
export interface EraStorefrontStyle {
  /** Signage technology. */
  signage: 'hand-painted' | 'neon' | 'fluorescent' | 'led-backlit' | 'oled-dynamic';
  /** Awning colors. */
  awningColors: string[];
  /** Typical storefront words / product types. */
  productTypes: string[];
}

/** Advertisement style descriptor for an era. */
export interface EraAdStyle {
  /** Medium of the advertisement. */
  medium: 'painted-wall' | 'neon-sign' | 'billboard-static' | 'led-billboard' | 'oled-screen';
  /** Typical ad content themes. */
  themes: string[];
  /** Whether ads are animated. */
  animated: boolean;
}

// ---------------------------------------------------------------------------
// Pedestrian outfit data
// ---------------------------------------------------------------------------

/** Pedestrian outfit style descriptor for an era. */
export interface EraPedestrianStyle {
  /** Clothing silhouette. */
  silhouette: 'wool-utilitarian' | 'slim-tailored' | 'denim-bright' | 'baggy-cargo' | 'athleisure';
  /** Clothing colors. */
  colors: string[];
  /** Accessories present in this era. */
  accessories: string[];
  /** Relative pedestrian density on sidewalks (0..1). */
  density: number;
}

// ---------------------------------------------------------------------------
// SFX data — consumed by the audio system
// ---------------------------------------------------------------------------

/** A one-shot sound event type for an era. */
export interface SfxEventType {
  /** Type of event sound. */
  type: 'horn' | 'bell' | 'siren' | 'chime' | 'beep' | 'announcement';
  /** Base frequency in Hz. */
  frequency: number;
  /** Duration in seconds. */
  duration: number;
  /** Relative likelihood of occurrence (0..1). */
  weight: number;
}

/** Sound parameters for a single era, consumed by the SFX generator. */
export interface SfxEraData {
  /** Era id this data belongs to. */
  eraId: EraId;
  /** Ambient bed: low-frequency drone frequencies (Hz). */
  ambientTones: number[];
  /** Ambient bed: noise filter cutoff frequency (Hz). */
  ambientNoiseCutoff: number;
  /** Ambient bed: overall gain (0..1). */
  ambientGain: number;
  /** Traffic engine sound profile. */
  traffic: {
    /** Base engine frequency (Hz). */
    baseFrequency: number;
    /** Frequency modulation depth (Hz). */
    modulationDepth: number;
    /** Modulation rate (Hz). */
    modulationRate: number;
    /** Whether engines are electric/silent. */
    electric: boolean;
    /** Overall traffic gain (0..1). */
    gain: number;
  };
  /** One-shot event sounds for this era. */
  events: SfxEventType[];
  /** Music style descriptor. */
  music: {
    /** Musical style name. */
    style: 'swing-jazz' | 'motown-pop' | 'synth-pop' | 'alt-rock' | 'electronic';
    /** Root note frequency (Hz). */
    rootFrequency: number;
    /** Scale intervals (semitones from root). */
    scale: number[];
    /** Tempo (BPM). */
    tempo: number;
    /** Overall music gain (0..1). */
    gain: number;
  };
}

// ---------------------------------------------------------------------------
// Full era data record
// ---------------------------------------------------------------------------

/** Complete visual + audio data for a single era. */
export interface EraData {
  spec: EraSpec;
  buildings: EraBuildingStyle;
  vehicles: EraVehicleStyle;
  storefronts: EraStorefrontStyle;
  ads: EraAdStyle;
  pedestrians: EraPedestrianStyle;
  sfx: SfxEraData;
}

// ---------------------------------------------------------------------------
// SFX_ERA_DATA — per-era sound parameters
// ---------------------------------------------------------------------------

/** Distinct period-appropriate sound parameters for each era. */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    eraId: '1945',
    ambientTones: [55, 82.5, 110],
    ambientNoiseCutoff: 400,
    ambientGain: 0.12,
    traffic: {
      baseFrequency: 70,
      modulationDepth: 12,
      modulationRate: 3,
      electric: false,
      gain: 0.18,
    },
    events: [
      { type: 'horn', frequency: 280, duration: 0.4, weight: 0.4 },
      { type: 'bell', frequency: 440, duration: 0.8, weight: 0.3 },
      { type: 'announcement', frequency: 200, duration: 1.5, weight: 0.1 },
    ],
    music: {
      style: 'swing-jazz',
      rootFrequency: 146.83,
      scale: [0, 3, 5, 6, 7, 10, 12],
      tempo: 120,
      gain: 0.08,
    },
  },
  '1965': {
    eraId: '1965',
    ambientTones: [65, 97.5, 130],
    ambientNoiseCutoff: 600,
    ambientGain: 0.14,
    traffic: {
      baseFrequency: 80,
      modulationDepth: 15,
      modulationRate: 4,
      electric: false,
      gain: 0.25,
    },
    events: [
      { type: 'horn', frequency: 320, duration: 0.35, weight: 0.5 },
      { type: 'bell', frequency: 523, duration: 0.6, weight: 0.2 },
      { type: 'siren', frequency: 700, duration: 1.2, weight: 0.15 },
    ],
    music: {
      style: 'motown-pop',
      rootFrequency: 174.61,
      scale: [0, 2, 4, 5, 7, 9, 12],
      tempo: 132,
      gain: 0.1,
    },
  },
  '1985': {
    eraId: '1985',
    ambientTones: [73, 110, 146.8],
    ambientNoiseCutoff: 900,
    ambientGain: 0.16,
    traffic: {
      baseFrequency: 90,
      modulationDepth: 18,
      modulationRate: 5,
      electric: false,
      gain: 0.3,
    },
    events: [
      { type: 'horn', frequency: 350, duration: 0.3, weight: 0.55 },
      { type: 'siren', frequency: 850, duration: 1.0, weight: 0.25 },
      { type: 'beep', frequency: 1000, duration: 0.1, weight: 0.3 },
    ],
    music: {
      style: 'synth-pop',
      rootFrequency: 196,
      scale: [0, 2, 3, 5, 7, 8, 10, 12],
      tempo: 140,
      gain: 0.12,
    },
  },
  '2005': {
    eraId: '2005',
    ambientTones: [82, 123, 164.8],
    ambientNoiseCutoff: 1200,
    ambientGain: 0.15,
    traffic: {
      baseFrequency: 85,
      modulationDepth: 10,
      modulationRate: 6,
      electric: false,
      gain: 0.28,
    },
    events: [
      { type: 'horn', frequency: 340, duration: 0.3, weight: 0.5 },
      { type: 'beep', frequency: 1200, duration: 0.08, weight: 0.35 },
      { type: 'chime', frequency: 880, duration: 0.5, weight: 0.2 },
    ],
    music: {
      style: 'alt-rock',
      rootFrequency: 220,
      scale: [0, 2, 4, 5, 7, 9, 12],
      tempo: 128,
      gain: 0.1,
    },
  },
  '2025': {
    eraId: '2025',
    ambientTones: [98, 147, 196],
    ambientNoiseCutoff: 1800,
    ambientGain: 0.13,
    traffic: {
      baseFrequency: 120,
      modulationDepth: 5,
      modulationRate: 8,
      electric: true,
      gain: 0.15,
    },
    events: [
      { type: 'beep', frequency: 1500, duration: 0.06, weight: 0.4 },
      { type: 'chime', frequency: 1100, duration: 0.4, weight: 0.3 },
      { type: 'announcement', frequency: 300, duration: 1.2, weight: 0.15 },
    ],
    music: {
      style: 'electronic',
      rootFrequency: 261.63,
      scale: [0, 2, 4, 7, 9, 12],
      tempo: 124,
      gain: 0.11,
    },
  },
};

// ---------------------------------------------------------------------------
// ERA_DATA — complete visual + audio data for all eras
// ---------------------------------------------------------------------------

/** Complete data (visuals + audio) for all five eras. */
export const ERA_DATA: Record<EraId, EraData> = {
  '1945': {
    spec: getEraSpec('1945'),
    buildings: {
      style: 'lowrise-brick',
      heightMin: 6,
      heightMax: 14,
      facadeColors: ['#8b4513', '#a0522d', '#6d4c3d', '#7a5c42'],
      roof: 'flat',
      windowPattern: 'small-grid',
      hasAwnings: true,
    },
    vehicles: {
      shape: 'sedan-boxy',
      colors: ['#1a1a1a', '#2d2d2d', '#4a4a3a', '#5c3a2a'],
      density: 0.2,
      electric: false,
    },
    storefronts: {
      signage: 'hand-painted',
      awningColors: ['#8b6b3a', '#6d8b3a', '#8b3a3a'],
      productTypes: ['Grocery', 'Bakery', 'Hardware', 'Tailor', 'Diner'],
    },
    ads: {
      medium: 'painted-wall',
      themes: ['War Bonds', 'Coca-Cola', 'Chesterfield', 'Ford'],
      animated: false,
    },
    pedestrians: {
      silhouette: 'wool-utilitarian',
      colors: ['#3d3d3d', '#4a4a3a', '#5c4a3d', '#3d3d4a'],
      accessories: ['fedora', 'flat-cap', 'overcoat'],
      density: 0.3,
    },
    sfx: SFX_ERA_DATA['1945'],
  },
  '1965': {
    spec: getEraSpec('1965'),
    buildings: {
      style: 'midcentury-modern',
      heightMin: 10,
      heightMax: 24,
      facadeColors: ['#c0c0c0', '#d0c8b0', '#a0a8a0', '#b8a890'],
      roof: 'parapet',
      windowPattern: 'ribbon',
      hasAwnings: true,
    },
    vehicles: {
      shape: 'finned-cruiser',
      colors: ['#d4a017', '#c8463a', '#4a7ac8', '#e8e8e8', '#3a8b3a'],
      density: 0.45,
      electric: false,
    },
    storefronts: {
      signage: 'neon',
      awningColors: ['#c83a3a', '#3a7ac8', '#c8b03a'],
      productTypes: ['Diner', 'Boutique', 'Record Shop', 'Drugstore', 'Gas Station'],
    },
    ads: {
      medium: 'neon-sign',
      themes: ['Camel', 'GM', 'Pan Am', 'Coca-Cola', 'Motorola'],
      animated: false,
    },
    pedestrians: {
      silhouette: 'slim-tailored',
      colors: ['#3a3a5c', '#5c3a3a', '#3a5c3a', '#5c5c3a', '#3a3a3a'],
      accessories: ['pillbox-hat', 'skinny-tie', 'sunglasses'],
      density: 0.5,
    },
    sfx: SFX_ERA_DATA['1965'],
  },
  '1985': {
    spec: getEraSpec('1985'),
    buildings: {
      style: 'glass-steel',
      heightMin: 16,
      heightMax: 40,
      facadeColors: ['#5c7a8c', '#6c8a9c', '#4a6a7c', '#7c9aac'],
      roof: 'stepped',
      windowPattern: 'curtain',
      hasAwnings: false,
    },
    vehicles: {
      shape: 'aero-sedan',
      colors: ['#c83a3a', '#3a7ac8', '#e8e8e8', '#3a3a3a', '#c8c83a', '#8b3ac8'],
      density: 0.6,
      electric: false,
    },
    storefronts: {
      signage: 'fluorescent',
      awningColors: ['#3ac8c8', '#c83ac8', '#c8c83a'],
      productTypes: ['Video Store', 'Arcade', 'Fast Food', 'Music Shop', 'Electronics'],
    },
    ads: {
      medium: 'billboard-static',
      themes: ['Sony', 'Coca-Cola', 'McDonalds', 'Nike', 'Apple'],
      animated: false,
    },
    pedestrians: {
      silhouette: 'denim-bright',
      colors: ['#3a6ac8', '#c83a5c', '#c8a03a', '#3ac86a', '#c83ac8'],
      accessories: ['walkman', 'mullets', 'leg-warmers'],
      density: 0.65,
    },
    sfx: SFX_ERA_DATA['1985'],
  },
  '2005': {
    spec: getEraSpec('2005'),
    buildings: {
      style: 'curtain-wall',
      heightMin: 20,
      heightMax: 56,
      facadeColors: ['#8a9aac', '#9aabbc', '#6a7a8c', '#aabccc'],
      roof: 'flat',
      windowPattern: 'curtain',
      hasAwnings: false,
    },
    vehicles: {
      shape: 'crossover',
      colors: ['#c0c0c0', '#3a3a3a', '#8a8a8a', '#3a5c8a', '#5c3a3a', '#c8c8c8'],
      density: 0.7,
      electric: false,
    },
    storefronts: {
      signage: 'led-backlit',
      awningColors: ['#3a8ac8', '#c86a3a', '#5c8a3a'],
      productTypes: ['Coffee Shop', 'Cell Phone Store', 'Bookstore', 'Gym', 'Pharmacy'],
    },
    ads: {
      medium: 'led-billboard',
      themes: ['Apple', 'Google', 'Nike', 'Toyota', 'Coca-Cola'],
      animated: true,
    },
    pedestrians: {
      silhouette: 'baggy-cargo',
      colors: ['#3a3a5c', '#5c5c5c', '#3a5c3a', '#5c3a3a', '#3a3a3a'],
      accessories: ['flip-phone', 'ipod', 'hoodie'],
      density: 0.7,
    },
    sfx: SFX_ERA_DATA['2005'],
  },
  '2025': {
    spec: getEraSpec('2025'),
    buildings: {
      style: 'eco-glass',
      heightMin: 24,
      heightMax: 72,
      facadeColors: ['#4a8a6c', '#5a9a7c', '#3a7a5c', '#6aaa8c'],
      roof: 'green',
      windowPattern: 'smart-glass',
      hasAwnings: false,
    },
    vehicles: {
      shape: 'ev-pod',
      colors: ['#e8e8e8', '#3a3a3a', '#c0c0c0', '#3a6a8a', '#e0e0e0'],
      density: 0.55,
      electric: true,
    },
    storefronts: {
      signage: 'oled-dynamic',
      awningColors: ['#3ac8c8', '#3ac8aa', '#5ac83a'],
      productTypes: ['EV Charging', 'Tech Hub', 'Plant-Based Cafe', 'Delivery Hub', 'Wellness Studio'],
    },
    ads: {
      medium: 'oled-screen',
      themes: ['Tesla', 'Apple', 'Spotify', 'Uber', 'Google', 'OpenAI'],
      animated: true,
    },
    pedestrians: {
      silhouette: 'athleisure',
      colors: ['#3a3a3a', '#2a2a3a', '#3a3a2a', '#2a3a3a', '#3a2a3a'],
      accessories: ['earbuds', 'smart-watch', 'e-scooter'],
      density: 0.75,
    },
    sfx: SFX_ERA_DATA['2025'],
  },
};
