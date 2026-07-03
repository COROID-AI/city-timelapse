/**
 * Era data layer for the City Time Period Timelapse.
 *
 * This module is the single source of truth for every decade represented on
 * the timeline slider. It is intentionally **declarative and serializable** —
 * every value is a plain object literal (no functions, no class instances) so
 * the registry can be frozen, deep-cloned, or shipped over a message channel
 * without loss.
 *
 * Downstream systems (procedural asset builders, traffic, pedestrians, the
 * SFX mixer, the timeline HUD) all consume the typed structures exported here
 * and never hard-code era-specific behaviour themselves.
 */

// ---------------------------------------------------------------------------
// Core identifiers
// ---------------------------------------------------------------------------

/**
 * The five selectable years on the timeline slider.
 * Declared as a literal union so exhaustive `switch` checks are enforced by the
 * compiler everywhere an era is consumed.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Ordered, readonly list of every {@link EraId} value (oldest → newest). */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Convenience alias — a tuple of all era ids. */
export type EraIdTuple = typeof ERA_IDS;

// ---------------------------------------------------------------------------
// Category-specific data interfaces
// ---------------------------------------------------------------------------

/**
 * Building stock for a decade.
 *
 * Every field is a palette / vocabulary used by the procedural building
 * builder to synthesise period-appropriate facades. Values are *descriptive
 * hints*, not pixel coordinates — the builder interprets them.
 */
export interface BuildingEraData {
  /** Dominant exterior wall colours (hex). */
  palette: readonly string[];
  /** Architectural vocabulary the builder should draw from. */
  style: 'art-deco' | 'mid-century' | 'brutalist' | 'postmodern' | 'contemporary';
  /** Typical number of storeys for low-rise blocks. */
  storeyRange: readonly [number, number];
  /** Probability (0–1) that a given lot hosts a high-rise tower. */
  towerProbability: number;
  /** Fenestration style passed to the window generator. */
  windowStyle: 'steel-casement' | 'ribbon' | 'punched' | 'curtain-wall' | 'floor-to-ceiling';
  /** Roofline treatment. */
  roofline: 'flat-parapet' | 'setback-pyramid' | 'mansard' | 'crown' | 'green-roof';
  /** True when neon accent strips should be considered. */
  neonAccents: boolean;
  /** Saturation multiplier (0–2) applied to base materials. */
  saturation: number;
  /** Amount of soot / grime overlay (0–1). */
  grime: number;
}

/** Vehicle fleet for a decade. */
export interface VehicleEraData {
  /** Body-style vocabulary for the car generator. */
  bodyStyles: readonly ('sedan' | 'coupe' | 'wagon' | 'pickup' | 'hatchback' | 'suv' | 'roadster' | 'microcar')[];
  /** Paint colours (hex). */
  palette: readonly string[];
  /** Approximate vehicle length in metres. */
  lengthRange: readonly [number, number];
  /** Approximate vehicle height in metres. */
  heightRange: readonly [number, number];
  /** Mean traffic density — vehicles per lane per minute. */
  density: number;
  /** Top speed the AI drivers will target (m/s). */
  targetSpeed: number;
  /** Headlight colour temperature hint (hex). */
  headlightColor: string;
  /** True when electric / hybrid vehicles appear in the mix. */
  hasElectric: boolean;
  /** Fraction of commercial trucks/buses in the fleet (0–1). */
  commercialFraction: number;
}

/** Storefront vocabulary for a decade. */
export interface StorefrontEraData {
  /** Retail typology labels the builder can place. */
  shopTypes: readonly string[];
  /** Awning / signage colours (hex). */
  palette: readonly string[];
  /** Signage rendering style. */
  signStyle: 'hand-painted' | 'neon' | 'backlit-box' | 'led-strip' | 'digital';
  /** Typical ground-floor window transparency (0–1). */
  windowTransparency: number;
  /** Probability (0–1) that a shop has an awning. */
  awningProbability: number;
  /** Hours-of-operation string shown on doors (display only). */
  hoursLabel: string;
}

/** Advertisement vocabulary for a decade. */
export interface AdvertisementEraData {
  /** Mediums the ad generator may instantiate. */
  mediums: readonly ('billboard' | 'painted-wall' | 'neon-sign' | 'backlit-box' | 'lcd-screen' | 'holographic' | 'projection')[];
  /** Sample product / brand copy fragments. */
  slogans: readonly string[];
  /** Colour palette for ad artwork (hex). */
  palette: readonly string[];
  /** Probability (0–1) that a given façade carries an ad. */
  coverage: number;
  /** True when ads animate (neon flicker, video, holograms). */
  animated: boolean;
}

/** Pedestrian wardrobe vocabulary for a decade. */
export interface PedestrianOutfitEraData {
  /** Silhouette labels for the character builder. */
  silhouettes: readonly ('zoot' | 'sheath-dress' | 'business-suit' | 'mod-mini' | 'bohemian' | 'power-suit' | 'casual-jeans' | 'streetwear' | 'athleisure')[];
  /** Clothing colours (hex). */
  palette: readonly string[];
  /** Hat / headwear vocabulary. */
  headwear: readonly string[];
  /** Relative pedestrian density on sidewalks (0–1). */
  density: number;
  /** Mean walking speed (m/s). */
  walkSpeed: number;
  /** True when smartphones / handheld props should appear. */
  hasPhones: boolean;
}

/**
 * Sound-design parameters for a decade.
 *
 * The procedural SFX generator synthesises an {@link EraAudioBuffers} set from
 * these numbers — there are no external audio files.
 */
export interface SfxEraData {
  /** Low-frequency ambient drone tones (Hz). */
  ambientTones: readonly number[];
  /** Gain of the ambient bed (0–1). */
  ambientGain: number;
  /** Traffic engine sound character. */
  trafficProfile: 'horse-clop' | 'straight-six' | 'small-block' | 'electric-hum' | 'mixed-quiet';
  /** Traffic loop gain (0–1). */
  trafficGain: number;
  /** One-shot event labels the scheduler can trigger. */
  eventTypes: readonly ('trolley-bell' | 'horn' | 'siren' | 'church-bell' | 'jackhammer' | 'bus-kneel' | 'notification' | 'drone-buzz')[];
  /** Mean interval between one-shot events (seconds). */
  eventInterval: number;
  /** Gain of one-shot events (0–1). */
  eventGain: number;
  /** Music bed style. */
  musicStyle: 'big-band' | 'motown' | 'synthpop' | 'crunk' | 'hyperpop';
  /** Music bed gain (0–1). */
  musicGain: number;
  /** Reverb / early-reflection amount (0–1). */
  reverb: number;
}

// ---------------------------------------------------------------------------
// Top-level era configuration
// ---------------------------------------------------------------------------

/**
 * The complete, serialisable description of one decade on the timeline.
 *
 * An {@link EraSpec} is pure data — it never references three.js, the DOM, or
 * any mutable runtime state. Procedural builders read it and *produce* the
 * heavy objects (meshes, materials, AudioBuffers).
 */
export interface EraSpec {
  /** Timeline identifier, e.g. `'1965'`. */
  id: EraId;
  /** Integer year for display, e.g. `1965`. */
  year: number;
  /** Short human label, e.g. `"Mid-Century"`. */
  label: string;
  /** One-paragraph description shown in the HUD / narration. */
  description: string;
  /** Building stock configuration. */
  buildings: BuildingEraData;
  /** Vehicle fleet configuration. */
  vehicles: VehicleEraData;
  /** Storefront configuration. */
  storefronts: StorefrontEraData;
  /** Advertisement configuration. */
  advertisements: AdvertisementEraData;
  /** Pedestrian wardrobe configuration. */
  pedestrians: PedestrianOutfitEraData;
  /** Sound-design configuration. */
  sfx: SfxEraData;
}
// ---------------------------------------------------------------------------
// Registry — full entries for every decade
// ---------------------------------------------------------------------------

/**
 * The ordered era registry. Frozen at module load so downstream consumers can
 * treat it as immutable. Every entry is a plain object literal — no functions
 * — which keeps the whole structure JSON-serialisable.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'War’s End',
    description:
      'The city stirs back to life as wartime rationing eases. Trolleys still clang down the avenue, Art Deco façades bear soot from coal furnaces, and pedestrians sport tailored suits and Victory-roll hair.',
    buildings: {
      palette: ['#8b8378', '#6f6358', '#a89b86', '#5c5048', '#b0a48f'],
      style: 'art-deco',
      storeyRange: [3, 12],
      towerProbability: 0.12,
      windowStyle: 'steel-casement',
      roofline: 'flat-parapet',
      neonAccents: true,
      saturation: 0.7,
      grime: 0.65,
    },
    vehicles: {
      bodyStyles: ['sedan', 'coupe', 'wagon', 'roadster'],
      palette: ['#1a1a1a', '#3b2f2f', '#4a4a4a', '#6b5d4f', '#7a2020'],
      lengthRange: [4.4, 5.2],
      heightRange: [1.5, 1.7],
      density: 6,
      targetSpeed: 8,
      headlightColor: '#fff1c1',
      hasElectric: false,
      commercialFraction: 0.22,
    },
    storefronts: {
      shopTypes: ['diner', 'barber', 'apothecary', 'tailor', 'newsstand', 'cobbler'],
      palette: ['#7a2020', '#1f3a5f', '#3a5f3a', '#8a6d3b', '#4a4a4a'],
      signStyle: 'hand-painted',
      windowTransparency: 0.55,
      awningProbability: 0.7,
      hoursLabel: '9 to 5',
    },
    advertisements: {
      mediums: ['billboard', 'painted-wall', 'neon-sign'],
      slogans: ['Buy Bonds', 'Drink Coca-Cola', 'For Victory', 'See America', 'Lucky Strike'],
      palette: ['#c8102e', '#f2c14e', '#1f3a5f', '#e8e0c8'],
      coverage: 0.3,
      animated: false,
    },
    pedestrians: {
      silhouettes: ['zoot', 'sheath-dress', 'business-suit'],
      palette: ['#2b2b2b', '#4a3b2f', '#6b5d4f', '#7a2020', '#1f3a5f'],
      headwear: ['fedora', 'trilby', 'beret', 'pillbox-hat'],
      density: 0.5,
      walkSpeed: 1.1,
      hasPhones: false,
    },
    sfx: {
      ambientTones: [55, 110],
      ambientGain: 0.35,
      trafficProfile: 'horse-clop',
      trafficGain: 0.4,
      eventTypes: ['trolley-bell', 'horn', 'church-bell'],
      eventInterval: 6,
      eventGain: 0.4,
      musicStyle: 'big-band',
      musicGain: 0.18,
      reverb: 0.45,
    },
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century',
    description:
      'Optimism hums through the block. Tail-fin cruisers idle at the light, neon signs buzz above chrome-trimmed diners, and office workers in narrow-lapel suits pour onto the sidewalks at noon.',
    buildings: {
      palette: ['#c4c2bc', '#9aa0a6', '#d8d2c0', '#7d8589', '#b8a890'],
      style: 'mid-century',
      storeyRange: [4, 18],
      towerProbability: 0.2,
      windowStyle: 'ribbon',
      roofline: 'setback-pyramid',
      neonAccents: true,
      saturation: 0.95,
      grime: 0.35,
    },
    vehicles: {
      bodyStyles: ['sedan', 'coupe', 'wagon', 'pickup', 'roadster'],
      palette: ['#c8102e', '#f2c14e', '#1f3a5f', '#e8e0c8', '#2b2b2b', '#7a9bbf'],
      lengthRange: [4.8, 5.6],
      heightRange: [1.4, 1.6],
      density: 10,
      targetSpeed: 10,
      headlightColor: '#fff4d6',
      hasElectric: false,
      commercialFraction: 0.18,
    },
    storefronts: {
      shopTypes: ['diner', 'barber', 'department-store', 'record-shop', 'drugstore', 'bank'],
      palette: ['#c8102e', '#f2c14e', '#1f3a5f', '#e8e0c8', '#2b6b4f'],
      signStyle: 'neon',
      windowTransparency: 0.7,
      awningProbability: 0.55,
      hoursLabel: '9 to 9',
    },
    advertisements: {
      mediums: ['billboard', 'neon-sign', 'painted-wall'],
      slogans: ['See the USA', 'Think Small', 'It’s the Real Thing', 'Fly the Friendly Skies', 'The Pepsi Generation'],
      palette: ['#c8102e', '#f2c14e', '#1f3a5f', '#ffffff', '#2b6b4f'],
      coverage: 0.45,
      animated: true,
    },
    pedestrians: {
      silhouettes: ['business-suit', 'mod-mini', 'bohemian'],
      palette: ['#2b2b2b', '#7a2020', '#1f3a5f', '#e8e0c8', '#c8102e'],
      headwear: ['pillbox-hat', 'fedora', 'headband'],
      density: 0.65,
      walkSpeed: 1.2,
      hasPhones: false,
    },
    sfx: {
      ambientTones: [65, 130],
      ambientGain: 0.3,
      trafficProfile: 'straight-six',
      trafficGain: 0.45,
      eventTypes: ['horn', 'siren', 'church-bell'],
      eventInterval: 5,
      eventGain: 0.4,
      musicStyle: 'motown',
      musicGain: 0.22,
      reverb: 0.35,
    },
  },
  {
    id: '1985',
    year: 1985,
    label: 'Neon Boom',
    description:
      'Concrete towers and mirrored glass loom over a block awash in neon. Boom-boxes blare synth-pop, shoulder-padded power suits jostle past arcade marquees, and boxy sedans weave between delivery vans.',
    buildings: {
      palette: ['#6e6e6e', '#8a8d8f', '#5a5a5a', '#b0b0b0', '#3a3a3a'],
      style: 'brutalist',
      storeyRange: [6, 30],
      towerProbability: 0.32,
      windowStyle: 'punched',
      roofline: 'flat-parapet',
      neonAccents: true,
      saturation: 1.1,
      grime: 0.3,
    },
    vehicles: {
      bodyStyles: ['sedan', 'coupe', 'wagon', 'hatchback', 'pickup'],
      palette: ['#2b2b2b', '#7a2020', '#1f3a5f', '#b0b0b0', '#6b6b6b', '#8a2be2'],
      lengthRange: [4.2, 4.9],
      heightRange: [1.3, 1.5],
      density: 14,
      targetSpeed: 11,
      headlightColor: '#fff8e7',
      hasElectric: false,
      commercialFraction: 0.2,
    },
    storefronts: {
      shopTypes: ['arcade', 'video-rental', 'diner', 'sneaker-store', 'electronics', 'bank'],
      palette: ['#ff00ff', '#00ffff', '#ffff00', '#ff4500', '#1f3a5f'],
      signStyle: 'backlit-box',
      windowTransparency: 0.8,
      awningProbability: 0.4,
      hoursLabel: '10 to 10',
    },
    advertisements: {
      mediums: ['billboard', 'neon-sign', 'backlit-box'],
      slogans: ['Just Do It', 'Where’s the Beef?', 'I Love the 80s', 'Max Headroom', 'Pac-Man Fever'],
      palette: ['#ff00ff', '#00ffff', '#ffff00', '#ff4500', '#1f3a5f'],
      coverage: 0.6,
      animated: true,
    },
    pedestrians: {
      silhouettes: ['power-suit', 'casual-jeans', 'bohemian'],
      palette: ['#2b2b2b', '#ff00ff', '#00ffff', '#1f3a5f', '#ff4500'],
      headwear: ['baseball-cap', 'headband', 'beret'],
      density: 0.8,
      walkSpeed: 1.25,
      hasPhones: false,
    },
    sfx: {
      ambientTones: [70, 140, 210],
      ambientGain: 0.28,
      trafficProfile: 'small-block',
      trafficGain: 0.5,
      eventTypes: ['horn', 'siren', 'jackhammer'],
      eventInterval: 4,
      eventGain: 0.42,
      musicStyle: 'synthpop',
      musicGain: 0.25,
      reverb: 0.3,
    },
  },
  {
    id: '2005',
    year: 2005,
    label: 'Dot-Com Glow',
    description:
      'Glass curtain walls reflect the blue glow of early flat-screens. SUVs dominate the curb, flip-phones flip open on every corner, and big-box storefronts hum with fluorescent efficiency.',
    buildings: {
      palette: ['#aeb7c0', '#cdd6dd', '#8a99a6', '#e8ecef', '#727e88'],
      style: 'postmodern',
      storeyRange: [6, 40],
      towerProbability: 0.4,
      windowStyle: 'curtain-wall',
      roofline: 'crown',
      neonAccents: false,
      saturation: 1.0,
      grime: 0.15,
    },
    vehicles: {
      bodyStyles: ['sedan', 'coupe', 'hatchback', 'suv', 'pickup'],
      palette: ['#2b2b2b', '#b0b0b0', '#1f3a5f', '#7a2020', '#c0c0c0', '#3a5f3a'],
      lengthRange: [4.3, 5.0],
      heightRange: [1.4, 1.8],
      density: 18,
      targetSpeed: 12,
      headlightColor: '#ffffff',
      hasElectric: false,
      commercialFraction: 0.25,
    },
    storefronts: {
      shopTypes: ['coffee-shop', 'electronics', 'bank', 'big-box', 'cellular-store', 'pharmacy'],
      palette: ['#1f3a5f', '#3a5f3a', '#c8102e', '#e8e0c8', '#2b6b4f'],
      signStyle: 'backlit-box',
      windowTransparency: 0.85,
      awningProbability: 0.35,
      hoursLabel: 'Open 24 Hours',
    },
    advertisements: {
      mediums: ['billboard', 'backlit-box', 'lcd-screen'],
      slogans: ['Think Different', 'Can You Hear Me Now?', 'Get a Mac', 'Google It', 'Unlimited Nights'],
      palette: ['#1f3a5f', '#c8102e', '#3a5f3a', '#ffffff', '#f2c14e'],
      coverage: 0.5,
      animated: true,
    },
    pedestrians: {
      silhouettes: ['casual-jeans', 'business-suit', 'streetwear'],
      palette: ['#2b2b2b', '#1f3a5f', '#7a2020', '#3a5f3a', '#b0b0b0'],
      headwear: ['beanie', 'baseball-cap', 'none'],
      density: 0.85,
      walkSpeed: 1.3,
      hasPhones: true,
    },
    sfx: {
      ambientTones: [60, 120, 240],
      ambientGain: 0.25,
      trafficProfile: 'mixed-quiet',
      trafficGain: 0.45,
      eventTypes: ['horn', 'siren', 'bus-kneel', 'notification'],
      eventInterval: 4,
      eventGain: 0.38,
      musicStyle: 'crunk',
      musicGain: 0.2,
      reverb: 0.25,
    },
  },
  {
    id: '2025',
    year: 2025,
    label: 'Smart City',
    description:
      'A quiet, electric streetscape. Glass towers wear living green roofs, silent EVs glide past bike lanes, pedestrians scroll smartphones under holographic ad projections, and delivery drones hum overhead.',
    buildings: {
      palette: ['#dfe7ec', '#bcd4c6', '#a9c4d8', '#f0f3f5', '#8fa8b5'],
      style: 'contemporary',
      storeyRange: [8, 50],
      towerProbability: 0.5,
      windowStyle: 'floor-to-ceiling',
      roofline: 'green-roof',
      neonAccents: false,
      saturation: 1.05,
      grime: 0.05,
    },
    vehicles: {
      bodyStyles: ['sedan', 'suv', 'hatchback', 'microcar', 'pickup'],
      palette: ['#2b2b2b', '#e8e8e8', '#1f3a5f', '#3a5f3a', '#b0b0b0', '#7a7a7a'],
      lengthRange: [4.0, 5.1],
      heightRange: [1.4, 1.9],
      density: 16,
      targetSpeed: 9,
      headlightColor: '#eaf4ff',
      hasElectric: true,
      commercialFraction: 0.15,
    },
    storefronts: {
      shopTypes: ['cafe', 'micro-fulfillment', 'gym', 'bank', 'tech-repair', 'pop-up'],
      palette: ['#3a5f3a', '#1f3a5f', '#e8e0c8', '#2b6b4f', '#c8102e'],
      signStyle: 'led-strip',
      windowTransparency: 0.9,
      awningProbability: 0.3,
      hoursLabel: 'Always Open',
    },
    advertisements: {
      mediums: ['lcd-screen', 'holographic', 'projection', 'billboard'],
      slogans: ['Sustainable Future', 'AI for All', 'Stream Anywhere', 'Carbon Neutral', 'Deliver in 10'],
      palette: ['#3a5f3a', '#1f3a5f', '#e8e0c8', '#00ffff', '#f2c14e'],
      coverage: 0.55,
      animated: true,
    },
    pedestrians: {
      silhouettes: ['casual-jeans', 'streetwear', 'athleisure'],
      palette: ['#2b2b2b', '#3a5f3a', '#1f3a5f', '#b0b0b0', '#e8e8e8'],
      headwear: ['beanie', 'baseball-cap', 'none', 'bike-helmet'],
      density: 0.9,
      walkSpeed: 1.25,
      hasPhones: true,
    },
    sfx: {
      ambientTones: [50, 100, 200],
      ambientGain: 0.2,
      trafficProfile: 'electric-hum',
      trafficGain: 0.35,
      eventTypes: ['notification', 'drone-buzz', 'bus-kneel', 'siren'],
      eventInterval: 5,
      eventGain: 0.32,
      musicStyle: 'hyperpop',
      musicGain: 0.18,
      reverb: 0.2,
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Pre-built id → spec map for O(1) lookups without re-scanning the array. */
const ERA_BY_ID: Readonly<Record<EraId, EraSpec>> = Object.freeze(
  ERA_REGISTRY.reduce(
    (acc, spec) => {
      acc[spec.id] = spec;
      return acc;
    },
    {} as Record<EraId, EraSpec>,
  ),
);

/**
 * Pre-built id → SFX data map for O(1) lookups.
 *
 * This is a convenience accessor that extracts the `sfx` field from each
 * {@link EraSpec} in the registry. The procedural audio generator can use it
 * directly without needing to resolve the full {@link EraSpec} first.
 */
export const SFX_ERA_DATA: Readonly<Record<EraId, SfxEraData>> = Object.freeze(
  ERA_REGISTRY.reduce(
    (acc, spec) => {
      acc[spec.id] = spec.sfx;
      return acc;
    },
    {} as Record<EraId, SfxEraData>,
  ),
);

/**
 * Resolve a single {@link EraSpec} by id.
 * @throws {Error} when `id` is not one of the registered eras.
 */
export function getEra(id: EraId): EraSpec {
  const spec = ERA_BY_ID[id];
  if (!spec) {
    throw new Error(`Unknown era id: "${id}". Expected one of: ${ERA_IDS.join(', ')}`);
  }
  return spec;
}

/**
 * Return every {@link EraSpec} in chronological order (oldest first).
 * The same frozen array reference is returned each call — callers must not mutate it.
 */
export function getAllEras(): readonly EraSpec[] {
  return ERA_REGISTRY;
}
