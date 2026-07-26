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
      skyColor: '#9fb0bf',
      fogColor: '#aebbc6',
      fogDensity: 0.012,
      sunAngle: 0.9,
      sunColor: '#fff2d6',
      sunIntensity: 1.8,
      ambientColor: '#7d8a99',
      ambientIntensity: 0.55,
    },
    sfx: {
      description: 'Sparse traffic, distant streetcar bells, wind',
      ambientTrack: 'ambient_1945_city',
      accents: ['streetcar_bell', 'footstep_gravel'],
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
      skyColor: '#aecbe6',
      fogColor: '#bcd0e4',
      fogDensity: 0.009,
      sunAngle: 1.05,
      sunColor: '#fff4e0',
      sunIntensity: 2.0,
      ambientColor: '#8aa0b8',
      ambientIntensity: 0.6,
    },
    sfx: {
      description: 'Busier traffic, gasoline engines, pop radio bleed',
      ambientTrack: 'ambient_1965_city',
      accents: ['engine_v8', 'radio_pop'],
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
      skyColor: '#3a2f4a',
      fogColor: '#453850',
      fogDensity: 0.016,
      sunAngle: 0.5,
      sunColor: '#ff9a6b',
      sunIntensity: 1.5,
      ambientColor: '#6a4f7a',
      ambientIntensity: 0.7,
    },
    sfx: {
      description: 'Dusk traffic, synth hum, arcade bleeps',
      ambientTrack: 'ambient_1985_neon',
      accents: ['arcade_bleed', 'synth_pad'],
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
      fogColor: '#7fb0dc',
      fogDensity: 0.007,
      sunAngle: 1.15,
      sunColor: '#ffefdc',
      sunIntensity: 2.3,
      ambientColor: '#7fa8c8',
      ambientIntensity: 0.62,
    },
    sfx: {
      description: 'Dense traffic, HVAC drone, digital chimes',
      ambientTrack: 'ambient_2005_digital',
      accents: ['ev_chime', 'hvac_drone'],
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
      skyColor: '#8fc4e8',
      fogColor: '#a6cdec',
      fogDensity: 0.005,
      sunAngle: 1.2,
      sunColor: '#fff6e8',
      sunIntensity: 2.4,
      ambientColor: '#86b4d2',
      ambientIntensity: 0.6,
    },
    sfx: {
      description: 'Quiet EV traffic, urban birdsong, distant construction',
      ambientTrack: 'ambient_2025_present',
      accents: ['ev_whir', 'construction_drill'],
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
      skyColor: '#14304a',
      fogColor: '#1a3a55',
      fogDensity: 0.006,
      sunAngle: 0.8,
      sunColor: '#cfeaff',
      sunIntensity: 2.1,
      ambientColor: '#3a6f9f',
      ambientIntensity: 0.75,
    },
    sfx: {
      description: 'Hushed magnetic transit, ambient data hum, drone buzz',
      ambientTrack: 'ambient_2055_future',
      accents: ['drone_buzz', 'maglev_whoosh'],
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
