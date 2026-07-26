/**
 * Era configuration — the single source of era truth.
 *
 * Every domain module (buildings, vehicles, storefronts, ads, pedestrians,
 * atmosphere, SFX) reads its per-era state from `DEFAULT_ERA_CONFIG`, keyed by
 * `EraKey`. No module should hardcode era identity or era-specific values; they
 * all flow through the typed contract below. The config is intentionally plain,
 * serializable data (hex strings, numbers, string identifiers) so eras stay
 * editable in one file.
 */

// ---------------------------------------------------------------------------
// Era identity
// ---------------------------------------------------------------------------

/**
 * The six eras the city block transforms between, as strongly-typed string
 * keys. This union is the canonical era identifier across the whole app.
 */
export const ERA_KEYS = ['1945', '1965', '1985', '2005', '2025', '2055'] as const;
export type EraKey = (typeof ERA_KEYS)[number];

/** Ordered era list, useful for index lookups and adjacency checks. */
export const ERA_ORDER: readonly EraKey[] = ERA_KEYS;

/** Index of an era within the ordered timeline (0 = earliest). */
export function eraIndex(key: EraKey): number {
  return ERA_ORDER.indexOf(key);
}

// ---------------------------------------------------------------------------
// Domain type definitions
// ---------------------------------------------------------------------------

/** PBR material palette describing the look of a building facade. */
export interface MaterialPalette {
  /** Hex color tokens used for facades and roofs. */
  colors: string[];
  /** PBR roughness range [min, max]. */
  roughness: [number, number];
  /** PBR metalness range [min, max]. */
  metalness: [number, number];
}

/** Per-era building style descriptor. */
export interface BuildingStyle {
  /** Architectural style name, e.g. "Art Deco". */
  style: string;
  /** Min/max building height in world units. */
  heightRange: [number, number];
  /** Dominant footprint density (0 = sparse, 1 = dense). */
  density: number;
  /** Material palette for facades and roofs. */
  palette: MaterialPalette;
}

/** Set of vehicle archetypes present on the streets in this era. */
export interface VehicleSet {
  vehicles: string[];
}

/** Set of storefront and exterior sign archetypes for this era. */
export interface StorefrontSet {
  storefronts: string[];
}

/** Set of billboard / advertisement archetypes for this era. */
export interface AdvertisementSet {
  ads: string[];
}

/** Set of pedestrian outfit archetypes for this era. */
export interface PedestrianOutfitSet {
  outfits: string[];
}

/** Atmospheric environment descriptor for sky, fog, and lighting. */
export interface Atmosphere {
  /** Sky background color as a hex token. */
  skyColor: string;
  /** Fog color as a hex token. */
  fogColor: string;
  /** Exponential fog density. */
  fogDensity: number;
  /** Sun elevation angle in radians above the horizon. */
  sunAngle: number;
  /** Sun color as a hex token. */
  sunColor: string;
  /** Sun directional intensity. */
  sunIntensity: number;
  /** Ambient light color as a hex token. */
  ambientColor: string;
  /** Ambient light intensity. */
  ambientIntensity: number;
  /** UnrealBloom strength multiplier (higher = more glow; 2055 is heavy). */
  bloomStrength: number;
  /** UnrealBloom radius [0, 1] (how far the bloom spreads). */
  bloomRadius: number;
  /** UnrealBloom luminance threshold [0, 1] (lower = more surfaces bloom). */
  bloomThreshold: number;
}

/** Audio bed descriptor for the era's ambient SFX. */
export interface SfxBed {
  /** Human-readable description of the era's soundscape. */
  description: string;
  /** Looping ambient track identifier (resolved by the audio system). */
  ambientTrack: string;
  /** One-shot accent identifiers sprinkled over the bed. */
  accents: string[];
}

/**
 * Per-era streetscape / road appearance, driven through the transition engine
 * so lane markings, signal brightness, and the road surface cross-fade between
 * eras (older eras use simpler, dimmer markings; 2025+ use high-contrast "smart"
 * markings). Owned by the BlockLayout domain.
 */
export interface RoadAppearance {
  /**
   * Lane-marking vocabulary. `simple` = a single faded dashed centerline;
   * `standard` = centerline + solid edge lines + basic zebra crosswalks;
   * `smart` = high-contrast markings, bike-lane symbology, decorative crosswalks.
   */
  markingStyle: 'simple' | 'standard' | 'smart';
  /** Traffic-signal emissive intensity multiplier (older eras are dimmer). */
  signalIntensity: number;
  /** Road surface base color (hex token). */
  surfaceColor: string;
  /** Lane-marking paint color (hex token). */
  markingColor: string;
  /** Road surface PBR roughness [0,1]; older eras are rougher. */
  surfaceRoughness: number;
}

/**
 * Complete per-era configuration. One of these exists for every `EraKey` in
 * `DEFAULT_ERA_CONFIG`; together they define the entire transformable scene.
 */
export interface EraConfig {
  /** Human-readable label shown in the HUD. */
  label: string;
  buildings: BuildingStyle;
  vehicles: VehicleSet;
  storefronts: StorefrontSet;
  ads: AdvertisementSet;
  pedestrians: PedestrianOutfitSet;
  atmosphere: Atmosphere;
  sfx: SfxBed;
  road: RoadAppearance;
}

// ---------------------------------------------------------------------------
// Default era configuration (placeholder-but-typed for all six eras)
// ---------------------------------------------------------------------------

/**
 * The default, data-driven configuration covering all six eras. These values
 * are deliberately typed placeholders — downstream tasks refine the geometry and
 * assets, but the *contract* (which fields every era exposes) is fixed here.
 */
export const DEFAULT_ERA_CONFIG: Record<EraKey, EraConfig> = {
  '1945': {
    label: '1945 · Postwar rebuild',
    buildings: {
      style: 'Postwar masonry',
      heightRange: [6, 14],
      density: 0.45,
      palette: {
        colors: ['#8a7a66', '#6e6052', '#b5a98f', '#4a443c'],
        roughness: [0.85, 0.98],
        metalness: [0.0, 0.05],
      },
    },
    vehicles: { vehicles: ['sedan_40s', 'truck_utility', 'streetcar'] },
    storefronts: { storefronts: ['handpainted_sign', 'awning_shop', 'apothecary'] },
    ads: { ads: ['painted_wall_ad', 'streetcar_poster'] },
    pedestrians: { outfits: ['suit_fedora', 'house_dress', 'overalls'] },
    atmosphere: {
      skyColor: '#c9b896',
      fogColor: '#d0c0a0',
      fogDensity: 0.013,
      sunAngle: 1.0,
      sunColor: '#ffe0b0',
      sunIntensity: 1.8,
      ambientColor: '#a0907a',
      ambientIntensity: 0.6,
      bloomStrength: 0.4,
      bloomRadius: 0.3,
      bloomThreshold: 0.9,
    },
    sfx: {
      description: 'Sparse traffic, distant streetcar bells, wind',
      ambientTrack: 'ambient_1945_city',
      accents: ['streetcar_bell', 'footstep_gravel'],
    },
    road: {
      markingStyle: 'simple',
      signalIntensity: 0.5,
      surfaceColor: '#3a3a3e',
      markingColor: '#b8b0a0',
      surfaceRoughness: 0.92,
    },
  },
  '1965': {
    label: '1965 · Mid-century boom',
    buildings: {
      style: 'Mid-century modern',
      heightRange: [10, 26],
      density: 0.6,
      palette: {
        colors: ['#c9c2b6', '#9aa7b0', '#e0d8c8', '#5d6b6e'],
        roughness: [0.6, 0.85],
        metalness: [0.05, 0.2],
      },
    },
    vehicles: { vehicles: ['muscle_car', 'station_wagon', 'delivery_van'] },
    storefronts: { storefronts: ['neon_channel', 'glass storefront', 'diner'] },
    ads: { ads: ['rooftop_billboard', 'neon_sign'] },
    pedestrians: { outfits: ['mod_dress', 'slacks_sweater', 'business_suit'] },
    atmosphere: {
      skyColor: '#aed8f5',
      fogColor: '#c0d8ee',
      fogDensity: 0.008,
      sunAngle: 1.1,
      sunColor: '#fff4e0',
      sunIntensity: 2.2,
      ambientColor: '#9ab8d4',
      ambientIntensity: 0.65,
      bloomStrength: 0.5,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
    },
    sfx: {
      description: 'Busier traffic, gasoline engines, pop radio bleed',
      ambientTrack: 'ambient_1965_city',
      accents: ['engine_v8', 'radio_pop'],
    },
    road: {
      markingStyle: 'simple',
      signalIntensity: 0.6,
      surfaceColor: '#34343a',
      markingColor: '#cfcab8',
      surfaceRoughness: 0.88,
    },
  },
  '1985': {
    label: '1985 · Neon dawn',
    buildings: {
      style: 'Brutalist concrete + glass',
      heightRange: [16, 40],
      density: 0.72,
      palette: {
        colors: ['#6f7479', '#8a8f96', '#3c3f44', '#b8467a'],
        roughness: [0.5, 0.8],
        metalness: [0.1, 0.35],
      },
    },
    vehicles: { vehicles: ['boxy_sedan', 'hatchback', 'panel_van'] },
    storefronts: { storefronts: ['backlit_sign', 'mirrored_glass', 'arcade'] },
    ads: { ads: ['led_billboard_static', 'neon_billboard'] },
    pedestrians: { outfits: ['power_suit', 'denim_jacket', 'tracksuit'] },
    atmosphere: {
      skyColor: '#4a3a5a',
      fogColor: '#5a4868',
      fogDensity: 0.017,
      sunAngle: 0.35,
      sunColor: '#ff9a5c',
      sunIntensity: 1.6,
      ambientColor: '#7a5f8a',
      ambientIntensity: 0.7,
      bloomStrength: 0.9,
      bloomRadius: 0.6,
      bloomThreshold: 0.6,
    },
    sfx: {
      description: 'Dusk traffic, synth hum, arcade bleeps',
      ambientTrack: 'ambient_1985_neon',
      accents: ['arcade_bleed', 'synth_pad'],
    },
    road: {
      markingStyle: 'standard',
      signalIntensity: 0.85,
      surfaceColor: '#2e2e34',
      markingColor: '#e8e4d6',
      surfaceRoughness: 0.82,
    },
  },
  '2005': {
    label: '2005 · Digital metropolis',
    buildings: {
      style: 'Glass-curtain tower',
      heightRange: [24, 60],
      density: 0.82,
      palette: {
        colors: ['#4a6f8a', '#6d92ad', '#2c3e50', '#8fb4cc'],
        roughness: [0.2, 0.5],
        metalness: [0.3, 0.6],
      },
    },
    vehicles: { vehicles: ['modern_sedan', 'suv', 'delivery_box_truck'] },
    storefronts: { storefronts: ['led_storefront', 'brand_glass', 'coffee_chain'] },
    ads: { ads: ['led_billboard_video', 'digital_kiosk'] },
    pedestrians: { outfits: ['smart_casual', 'hoodie_jeans', 'business_modern'] },
    atmosphere: {
      skyColor: '#6fa3d6',
      fogColor: '#82b2e0',
      fogDensity: 0.006,
      sunAngle: 1.2,
      sunColor: '#ffefdc',
      sunIntensity: 2.3,
      ambientColor: '#7fa8c8',
      ambientIntensity: 0.62,
      bloomStrength: 0.55,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
    },
    sfx: {
      description: 'Dense traffic, HVAC drone, digital chimes',
      ambientTrack: 'ambient_2005_digital',
      accents: ['ev_chime', 'hvac_drone'],
    },
    road: {
      markingStyle: 'standard',
      signalIntensity: 1.0,
      surfaceColor: '#2a2a30',
      markingColor: '#f2f0e4',
      surfaceRoughness: 0.78,
    },
  },
  '2025': {
    label: '2025 · Present day',
    buildings: {
      style: 'Mixed-use eco-glass',
      heightRange: [20, 54],
      density: 0.85,
      palette: {
        colors: ['#5a8f7a', '#88b0a0', '#3a4a52', '#cfe8dc'],
        roughness: [0.25, 0.55],
        metalness: [0.25, 0.55],
      },
    },
    vehicles: { vehicles: ['ev_sedan', 'hybrid_suv', 'e_scooter'] },
    storefronts: { storefronts: ['oled_storefront', 'green_wall', 'ghost_kitchen'] },
    ads: { ads: ['programmatic_billboard', 'ar_overlay'] },
    pedestrians: { outfits: ['athleisure', 'tech_wear', 'minimalist'] },
    atmosphere: {
      skyColor: '#9ed0f0',
      fogColor: '#b4d8f0',
      fogDensity: 0.004,
      sunAngle: 1.25,
      sunColor: '#fff8ec',
      sunIntensity: 2.5,
      ambientColor: '#90c0e0',
      ambientIntensity: 0.65,
      bloomStrength: 0.7,
      bloomRadius: 0.5,
      bloomThreshold: 0.75,
    },
    sfx: {
      description: 'Quiet EV traffic, urban birdsong, distant construction',
      ambientTrack: 'ambient_2025_present',
      accents: ['ev_whir', 'construction_drill'],
    },
    road: {
      markingStyle: 'smart',
      signalIntensity: 1.3,
      surfaceColor: '#26262c',
      markingColor: '#f6f6ee',
      surfaceRoughness: 0.72,
    },
  },
  '2055': {
    label: '2055 · Future vision',
    buildings: {
      style: 'Bio-integrated megatower',
      heightRange: [40, 110],
      density: 0.7,
      palette: {
        colors: ['#1e3a5f', '#2d6a9f', '#0f2027', '#9fffe0'],
        roughness: [0.1, 0.3],
        metalness: [0.5, 0.85],
      },
    },
    vehicles: { vehicles: ['autonomous_pod', 'eVTOL_drone', 'maglev_cab'] },
    storefronts: { storefronts: ['holographic_kiosk', 'transparent_oled', 'drone_port'] },
    ads: { ads: ['hologram_billboard', 'volumetric_ad'] },
    pedestrians: { outfits: ['smart_fabric', 'utility_exo', 'climate_suit'] },
    atmosphere: {
      skyColor: '#0d1a2e',
      fogColor: '#0a1828',
      fogDensity: 0.009,
      sunAngle: 0.12,
      sunColor: '#3a6fae',
      sunIntensity: 0.8,
      ambientColor: '#2a4a7a',
      ambientIntensity: 0.45,
      bloomStrength: 1.8,
      bloomRadius: 0.9,
      bloomThreshold: 0.2,
    },
    sfx: {
      description: 'Hushed magnetic transit, ambient data hum, drone buzz',
      ambientTrack: 'ambient_2055_future',
      accents: ['drone_buzz', 'maglev_whoosh'],
    },
    road: {
      markingStyle: 'smart',
      signalIntensity: 1.6,
      surfaceColor: '#1f242b',
      markingColor: '#8fffe0',
      surfaceRoughness: 0.6,
    },
  },
};

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for every era, derived from the config so the HUD and
 * timeline never drift from the single source of truth.
 */
export const ERA_LABELS: Record<EraKey, string> = Object.fromEntries(
  ERA_KEYS.map((key) => [key, DEFAULT_ERA_CONFIG[key].label]),
) as Record<EraKey, string>;

// ---------------------------------------------------------------------------
// Interpolation utilities (domains use these to cross-fade between eras)
// ---------------------------------------------------------------------------

/** Linear interpolation between two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolate between two hex color tokens, returning a hex string. */
export function lerpHex(fromHex: string, toHex: string, t: number): string {
  const fr = parseInt(fromHex.slice(1, 3), 16);
  const fg = parseInt(fromHex.slice(3, 5), 16);
  const fb = parseInt(fromHex.slice(5, 7), 16);
  const tr = parseInt(toHex.slice(1, 3), 16);
  const tg = parseInt(toHex.slice(3, 5), 16);
  const tb = parseInt(toHex.slice(5, 7), 16);
  const r = Math.round(lerp(fr, tr, t));
  const g = Math.round(lerp(fg, tg, t));
  const b = Math.round(lerp(fb, tb, t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * A domain's per-frame era-application callback.
 *
 * The TransitionManager calls this every frame during a cross-fade, passing the
 * destination era (`toKey`), the eased normalized progress `t` in [0, 1], and
 * the source era (`fromKey`) so the domain can interpolate between the two
 * configs. Domains that do not need the source era may simply omit the third
 * parameter (e.g. `applyEra: (key, t) => { ... }`).
 */
export type ApplyEraFn = (toKey: EraKey, t: number, fromKey: EraKey) => void;
