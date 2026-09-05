/**
 * src/eras.ts — Shared era data model.
 *
 * Single authoritative source for the time periods this city timelapse can
 * represent. Everything period-specific is *data*: later tasks consume the
 * declarative specs below and never hardcode era differences into imperative
 * scene code.
 *
 * Eras are identified by their year string so the top timeline slider can map
 * directly to labels. The shared anchor contract (see `ERA_ANCHOR_SLOTS`)
 * guarantees that every era's `EraSceneState` exposes the same named slot keys —
 * only the per-era *dimensions* vary, which is exactly what the vertex-morph
 * engine interpolates (lossless interop: same topology, no index remapping).
 */

/** One of the five supported time periods. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Declarative description of a time period. */
export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
}

/** Period-appropriate sound parameters consumed by the procedural SFX engine. */
export interface SfxEraData {
  /** Base mood of the ambient bed (drone root frequency in Hz). */
  ambientRootHz: number;
  /** Oscillator mix colour for the drone (lowpass cutoff in Hz). */
  ambientCutoffHz: number;
  /**
   * Traffic texture in 0..1: density (0 = quiet street, 1 = gridlock).
   * The procedural generator uses this to scale engine rumble counts.
   */
  trafficDensity: number;
  /** Traffic engine rumble base frequency in Hz. */
  trafficRootHz: number;
  /** List of one-shot sound event types that can fire in this era. */
  events: string[];
  /** Short music style descriptor (used only for annotation today). */
  musicStyle: string;
}

/**
 * Identical facade slot of every era's city block. All five eras expose the
 * same *named* slots (the parity-tested anchor contract); per-era dimensions
 * differ so the morph engine can vertex-interpolate between them.
 */
export interface EraAnchor {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

/** The shared anchor slots every era scene state must provide. */
export interface EraAnchorSet {
  doorway: EraAnchor;
  window: EraAnchor;
  shelf: EraAnchor;
}

/** Vehicle model family identifiers used by the procedural vehicle builders. */
export type VehicleModelId =
  | 'sedan-1945'
  | 'trolley-1945'
  | 'sedan-1965'
  | 'wagon-1965'
  | 'sedan-1985'
  | 'hatchback-1985'
  | 'van-1985'
  | 'suv-2005'
  | 'hatchback-2005'
  | 'ev-2025'
  | 'shuttle-2025';

/** Declarative blueprint of one period vehicle on the era street. */
export interface VehicleSpec {
  /** Stable instance id, unique within (and across) eras. */
  id: string;
  /** Which procedural model family to build. */
  model: VehicleModelId;
  /** Primary paint colour. */
  color: string;
  /** Secondary/two-tone body colour (roof, lower band, etc.). */
  accentColor: string;
  /** Trim/chrome colour. */
  trimColor: string;
  /** Street lane: 0 = outer (heading east), 1 = inner (heading west). */
  lane: 0 | 1;
  /** Cruise speed along the street in metres/second. */
  speed: number;
  /** Start position along the street as a 0..1 fraction. */
  offset: number;
}

/** Pedestrian model family identifiers used by the procedural outfit builders. */
export type PedestrianModelId =
  | 'worker-1945'
  | 'coat-1945'
  | 'dress-1945'
  | 'suit-1965'
  | 'dress-1965'
  | 'skirt-1965'
  | 'disco-1985'
  | 'leather-1985'
  | 'neon-1985'
  | 'hoodie-2005'
  | 'denim-2005'
  | 'cargo-2005'
  | 'athleisure-2025'
  | 'techwear-2025';

/** Declarative blueprint of one period pedestrian on the sidewalk loop. */
export interface PedestrianSpec {
  /** Stable instance id, unique within (and across) eras. */
  id: string;
  /** Which procedural outfit family to build. */
  model: PedestrianModelId;
  /** Primary garment colour. */
  color: string;
  /** Secondary garment/accent colour. */
  accentColor: string;
  /** Skin colour. */
  skinColor: string;
  /** Hair colour. */
  hairColor: string;
  /** Fabric descriptor; drives material roughness (wool, denim, leather…). */
  fabric: string;
  /** Start position along the sidewalk loop as a 0..1 fraction. */
  phase: number;
  /** Walking speed in metres/second. */
  speed: number;
}

/** Empty-but-typed per-era visual bundle; era tasks fill arrays with content. */
export interface EraSceneState {
  /** Which era this state describes. */
  id: EraId;
  buildings: unknown[];
  vehicles: VehicleSpec[];
  pedestrians: PedestrianSpec[];
  storefronts: unknown[];
  ads: unknown[];
  streetFurniture: unknown[];
  /** Period-appropriate sound parameters consumed by the SFX engine. */
  sfx: SfxEraData;
  /** Shared anchor contract: the same named slots for every era. */
  anchors: EraAnchorSet;
}

/** Declarative canvas-drawing spec consumed by the asset pipeline. */
export interface TextureSpec {
  kind: 'text' | 'gradient' | 'shape';
  text?: string;
  /** Dimension in pixels; defaults to 256. */
  size?: number;
}

/** All five eras in timeline order (oldest to newest). */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description:
      'Post-war brick and cast iron; sepia streetlight glow, trolley tracks and ration-era storefronts.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description:
      'Mid-century pastel facades, chrome and early neon; tailfins and suburban optimism.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description:
      'Concrete and glass towers, boxy traffic and bright neon under sodium lamps.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description:
      'Modern curtain walls, SUVs and digital billboards under white LED streetlight.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description:
      'Contemporary glass, EVs and scooters, networked LED screens and a clean twilight palette.',
  },
] as const;

/** Ordered list of all supported era ids (timeline order). */
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((era) => era.id);

/** Look up a spec by id; throws for unknown ids (catches typos at compile/test time). */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}

/**
 * Per-era anchor slots. The slot *keys* are identical across eras (the shared
 * contract), but dimensions evolve with the period — a 1945 doorway is narrower
 * than a 2025 one, etc. The morph engine lerps whole anchor boxes between the
 * adjacent-era sets.
 */
export const ERA_ANCHOR_SLOTS: Record<EraId, EraAnchorSet> = {
  '1945': {
    doorway: { x: 0, y: 0, z: 0, width: 0.9, height: 2.3, depth: 0.7 },
    window: { x: 0, y: 2.7, z: 0, width: 1.5, height: 1.1, depth: 0.4 },
    shelf: { x: 0, y: 1.15, z: 0, width: 0.9, height: 0.5, depth: 0.5 },
  },
  '1965': {
    doorway: { x: 0, y: 0, z: 0, width: 1.0, height: 2.3, depth: 0.7 },
    window: { x: 0, y: 2.75, z: 0, width: 1.6, height: 1.3, depth: 0.4 },
    shelf: { x: 0, y: 1.2, z: 0, width: 0.95, height: 0.55, depth: 0.5 },
  },
  '1985': {
    doorway: { x: 0, y: 0, z: 0, width: 1.1, height: 2.4, depth: 0.7 },
    window: { x: 0, y: 2.85, z: 0, width: 1.7, height: 1.5, depth: 0.4 },
    shelf: { x: 0, y: 1.25, z: 0, width: 1.0, height: 0.6, depth: 0.5 },
  },
  '2005': {
    doorway: { x: 0, y: 0, z: 0, width: 1.2, height: 2.5, depth: 0.7 },
    window: { x: 0, y: 2.95, z: 0, width: 1.8, height: 1.6, depth: 0.4 },
    shelf: { x: 0, y: 1.3, z: 0, width: 1.05, height: 0.65, depth: 0.5 },
  },
  '2025': {
    doorway: { x: 0, y: 0, z: 0, width: 1.3, height: 2.6, depth: 0.7 },
    window: { x: 0, y: 3.05, z: 0, width: 1.9, height: 1.7, depth: 0.4 },
    shelf: { x: 0, y: 1.35, z: 0, width: 1.1, height: 0.7, depth: 0.5 },
  },
};

/** Convenience accessor for the anchor set of one era. */
export function eraAnchorSlots(id: EraId): EraAnchorSet {
  return ERA_ANCHOR_SLOTS[id];
}

/** Distinct period-appropriate sound parameters for the five eras. */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': {
    ambientRootHz: 55,
    ambientCutoffHz: 900,
    trafficDensity: 0.15,
    trafficRootHz: 42,
    events: ['trolley_bell', 'steam_hiss', 'car_horn_old'],
    musicStyle: 'swing_radio',
  },
  '1965': {
    ambientRootHz: 65,
    ambientCutoffHz: 1400,
    trafficDensity: 0.35,
    trafficRootHz: 48,
    events: ['car_horn_old', 'engine_v8', 'jingle_vinyl'],
    musicStyle: 'motown_pop',
  },
  '1985': {
    ambientRootHz: 88,
    ambientCutoffHz: 2000,
    trafficDensity: 0.6,
    trafficRootHz: 55,
    events: ['car_horn', 'siren_far', 'synth_bass'],
    musicStyle: 'synthwave',
  },
  '2005': {
    ambientRootHz: 110,
    ambientCutoffHz: 2400,
    trafficDensity: 0.8,
    trafficRootHz: 62,
    events: ['car_horn', 'siren_close', 'bus_airbrake'],
    musicStyle: 'pop_anthem',
  },
  '2025': {
    ambientRootHz: 132,
    ambientCutoffHz: 3000,
    trafficDensity: 0.55,
    trafficRootHz: 70,
    events: ['ev_whine', 'pedestrian_ping', 'drone_hum'],
    musicStyle: 'neon_ambient',
  },
};

/** Per-era scene state stubs — identical anchor contracts, empty content. */
export const ERA_SCENE_STATES: Record<EraId, EraSceneState> = {
  '1945': {
    id: '1945',
    buildings: [],
    vehicles: [
      {
        id: 'v-1945-1',
        model: 'sedan-1945',
        color: '#17181c',
        accentColor: '#101216',
        trimColor: '#969aa3',
        lane: 0,
        speed: 5.4,
        offset: 0.06,
      },
      {
        id: 'v-1945-2',
        model: 'sedan-1945',
        color: '#26262b',
        accentColor: '#1a1b1f',
        trimColor: '#b8bcc4',
        lane: 1,
        speed: 4.8,
        offset: 0.48,
      },
      {
        id: 'v-1945-3',
        model: 'trolley-1945',
        color: '#7a3026',
        accentColor: '#dbc47e',
        trimColor: '#a6a295',
        lane: 0,
        speed: 4.1,
        offset: 0.74,
      },
    ],
    pedestrians: [
      {
        id: 'p-1945-1',
        model: 'worker-1945',
        color: '#5b6068',
        accentColor: '#3a3d42',
        skinColor: '#c08b66',
        hairColor: '#33261f',
        fabric: 'cotton_duck',
        phase: 0.08,
        speed: 0.62,
      },
      {
        id: 'p-1945-2',
        model: 'coat-1945',
        color: '#4a453e',
        accentColor: '#2d2a26',
        skinColor: '#d3a07c',
        hairColor: '#31221a',
        fabric: 'wool',
        phase: 0.33,
        speed: 0.55,
      },
      {
        id: 'p-1945-3',
        model: 'dress-1945',
        color: '#7b6a4e',
        accentColor: '#5c4b36',
        skinColor: '#e0b291',
        hairColor: '#452e26',
        fabric: 'cotton',
        phase: 0.57,
        speed: 0.58,
      },
      {
        id: 'p-1945-4',
        model: 'coat-1945',
        color: '#353c44',
        accentColor: '#23282d',
        skinColor: '#c08b66',
        hairColor: '#1d1612',
        fabric: 'wool',
        phase: 0.84,
        speed: 0.66,
      },
    ],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1945'],
    anchors: ERA_ANCHOR_SLOTS['1945'],
  },
  '1965': {
    id: '1965',
    buildings: [],
    vehicles: [
      {
        id: 'v-1965-1',
        model: 'sedan-1965',
        color: '#2e6f79',
        accentColor: '#e8e2d4',
        trimColor: '#ccc9bd',
        lane: 0,
        speed: 6.0,
        offset: 0.12,
      },
      {
        id: 'v-1965-2',
        model: 'sedan-1965',
        color: '#d9c195',
        accentColor: '#c2a876',
        trimColor: '#d8d5c9',
        lane: 1,
        speed: 5.4,
        offset: 0.41,
      },
      {
        id: 'v-1965-3',
        model: 'wagon-1965',
        color: '#a4552e',
        accentColor: '#d7b06a',
        trimColor: '#c9c6ba',
        lane: 0,
        speed: 5.7,
        offset: 0.63,
      },
      {
        id: 'v-1965-4',
        model: 'wagon-1965',
        color: '#4d6a9e',
        accentColor: '#e2ddc8',
        trimColor: '#d0cdc1',
        lane: 1,
        speed: 5.2,
        offset: 0.87,
      },
    ],
    pedestrians: [
      {
        id: 'p-1965-1',
        model: 'suit-1965',
        color: '#3d5568',
        accentColor: '#c9d0d6',
        skinColor: '#d3a07c',
        hairColor: '#1f2022',
        fabric: 'wool_blend',
        phase: 0.1,
        speed: 0.72,
      },
      {
        id: 'p-1965-2',
        model: 'dress-1965',
        color: '#c2576b',
        accentColor: '#f4f0e6',
        skinColor: '#e0b291',
        hairColor: '#3a2a1e',
        fabric: 'silk',
        phase: 0.36,
        speed: 0.66,
      },
      {
        id: 'p-1965-3',
        model: 'skirt-1965',
        color: '#7ea3a5',
        accentColor: '#e9e2cc',
        skinColor: '#c8956f',
        hairColor: '#241a12',
        fabric: 'cotton_blend',
        phase: 0.61,
        speed: 0.64,
      },
      {
        id: 'p-1965-4',
        model: 'suit-1965',
        color: '#6b5138',
        accentColor: '#d9cfbb',
        skinColor: '#c08b66',
        hairColor: '#171310',
        fabric: 'wool_blend',
        phase: 0.82,
        speed: 0.7,
      },
    ],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1965'],
    anchors: ERA_ANCHOR_SLOTS['1965'],
  },
  '1985': {
    id: '1985',
    buildings: [],
    vehicles: [
      {
        id: 'v-1985-1',
        model: 'sedan-1985',
        color: '#a72f2f',
        accentColor: '#1e1f22',
        trimColor: '#9ba0a8',
        lane: 0,
        speed: 6.6,
        offset: 0.05,
      },
      {
        id: 'v-1985-2',
        model: 'sedan-1985',
        color: '#a9adb3',
        accentColor: '#2c2e33',
        trimColor: '#78808a',
        lane: 1,
        speed: 6.1,
        offset: 0.33,
      },
      {
        id: 'v-1985-3',
        model: 'hatchback-1985',
        color: '#2f6f74',
        accentColor: '#232629',
        trimColor: '#a0a6ae',
        lane: 0,
        speed: 6.3,
        offset: 0.58,
      },
      {
        id: 'v-1985-4',
        model: 'van-1985',
        color: '#e4e0d4',
        accentColor: '#3b5f9e',
        trimColor: '#8b95a1',
        lane: 1,
        speed: 5.9,
        offset: 0.79,
      },
    ],
    pedestrians: [
      {
        id: 'p-1985-1',
        model: 'disco-1985',
        color: '#b23a8f',
        accentColor: '#282b63',
        skinColor: '#e0b291',
        hairColor: '#191b22',
        fabric: 'spandex',
        phase: 0.12,
        speed: 0.78,
      },
      {
        id: 'p-1985-2',
        model: 'leather-1985',
        color: '#1d1e22',
        accentColor: '#c0392b',
        skinColor: '#c08b66',
        hairColor: '#0f1013',
        fabric: 'leather',
        phase: 0.38,
        speed: 0.74,
      },
      {
        id: 'p-1985-3',
        model: 'neon-1985',
        color: '#1f8a5f',
        accentColor: '#ffd23f',
        skinColor: '#d3a07c',
        hairColor: '#211d18',
        fabric: 'nylon',
        phase: 0.6,
        speed: 0.8,
      },
      {
        id: 'p-1985-4',
        model: 'disco-1985',
        color: '#2fa8c9',
        accentColor: '#6a2f9e',
        skinColor: '#c8956f',
        hairColor: '#262019',
        fabric: 'spandex',
        phase: 0.86,
        speed: 0.76,
      },
    ],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1985'],
    anchors: ERA_ANCHOR_SLOTS['1985'],
  },
  '2005': {
    id: '2005',
    buildings: [],
    vehicles: [
      {
        id: 'v-2005-1',
        model: 'suv-2005',
        color: '#7d8a99',
        accentColor: '#565f6a',
        trimColor: '#3c4148',
        lane: 0,
        speed: 7.2,
        offset: 0.09,
      },
      {
        id: 'v-2005-2',
        model: 'suv-2005',
        color: '#232a33',
        accentColor: '#171b21',
        trimColor: '#8a929c',
        lane: 1,
        speed: 6.6,
        offset: 0.44,
      },
      {
        id: 'v-2005-3',
        model: 'hatchback-2005',
        color: '#a63c2a',
        accentColor: '#1c2026',
        trimColor: '#aeb4bc',
        lane: 0,
        speed: 6.9,
        offset: 0.71,
      },
    ],
    pedestrians: [
      {
        id: 'p-2005-1',
        model: 'hoodie-2005',
        color: '#4f5b66',
        accentColor: '#2a3138',
        skinColor: '#d3a07c',
        hairColor: '#171310',
        fabric: 'fleece',
        phase: 0.07,
        speed: 0.82,
      },
      {
        id: 'p-2005-2',
        model: 'denim-2005',
        color: '#3e5d7a',
        accentColor: '#c97b3b',
        skinColor: '#c08b66',
        hairColor: '#1d1612',
        fabric: 'denim',
        phase: 0.3,
        speed: 0.78,
      },
      {
        id: 'p-2005-3',
        model: 'cargo-2005',
        color: '#8b8762',
        accentColor: '#3a4436',
        skinColor: '#e0b291',
        hairColor: '#241a12',
        fabric: 'canvas',
        phase: 0.55,
        speed: 0.8,
      },
      {
        id: 'p-2005-4',
        model: 'hoodie-2005',
        color: '#6d2b36',
        accentColor: '#21151a',
        skinColor: '#c8956f',
        hairColor: '#0f1013',
        fabric: 'fleece',
        phase: 0.81,
        speed: 0.84,
      },
    ],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['2005'],
    anchors: ERA_ANCHOR_SLOTS['2005'],
  },
  '2025': {
    id: '2025',
    buildings: [],
    vehicles: [
      {
        id: 'v-2025-1',
        model: 'ev-2025',
        color: '#e8e9e6',
        accentColor: '#b8bcbe',
        trimColor: '#2c343d',
        lane: 0,
        speed: 7.6,
        offset: 0.14,
      },
      {
        id: 'v-2025-2',
        model: 'ev-2025',
        color: '#21344f',
        accentColor: '#0f1823',
        trimColor: '#5d6f84',
        lane: 1,
        speed: 7.0,
        offset: 0.52,
      },
      {
        id: 'v-2025-3',
        model: 'shuttle-2025',
        color: '#2d3d3a',
        accentColor: '#9fe8d6',
        trimColor: '#b9c9c4',
        lane: 0,
        speed: 6.4,
        offset: 0.76,
      },
    ],
    pedestrians: [
      {
        id: 'p-2025-1',
        model: 'athleisure-2025',
        color: '#20262e',
        accentColor: '#41d9c4',
        skinColor: '#e0b291',
        hairColor: '#171310',
        fabric: 'synthetic',
        phase: 0.1,
        speed: 0.92,
      },
      {
        id: 'p-2025-2',
        model: 'techwear-2025',
        color: '#1c2026',
        accentColor: '#7aa2f7',
        skinColor: '#c08b66',
        hairColor: '#0f1013',
        fabric: 'goretex',
        phase: 0.34,
        speed: 0.88,
      },
      {
        id: 'p-2025-3',
        model: 'athleisure-2025',
        color: '#8b8f96',
        accentColor: '#e0813f',
        skinColor: '#c8956f',
        hairColor: '#241a12',
        fabric: 'synthetic',
        phase: 0.58,
        speed: 0.9,
      },
      {
        id: 'p-2025-4',
        model: 'techwear-2025',
        color: '#24342b',
        accentColor: '#8ae08a',
        skinColor: '#d3a07c',
        hairColor: '#1d1612',
        fabric: 'goretex',
        phase: 0.83,
        speed: 0.94,
      },
    ],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['2025'],
    anchors: ERA_ANCHOR_SLOTS['2025'],
  },
};

/** Per-era lighting preset shared between src/eras.ts and src/env/Lighting.ts. */
export interface LightingEraPreset {
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  fogColor: string;
  fogDensity: number;
  exposure: number;
}

/** Per-era atmospheric/weather preset shared with src/env/Weather.ts. */
export interface WeatherEraPreset {
  hazeColor: string;
  hazeDensity: number;
  particleCount: number;
  windSpeed: number;
}

/** Distinct period-appropriate weather/atmosphere settings for the five eras. */
export const WEATHER_ERA_PRESETS: Record<EraId, WeatherEraPreset> = {
  '1945': { hazeColor: '#b8a276', hazeDensity: 0.02, particleCount: 200, windSpeed: 1.2 },
  '1965': { hazeColor: '#cfc29b', hazeDensity: 0.016, particleCount: 150, windSpeed: 1.0 },
  '1985': { hazeColor: '#8f8f96', hazeDensity: 0.03, particleCount: 400, windSpeed: 0.8 },
  '2005': { hazeColor: '#9faec0', hazeDensity: 0.02, particleCount: 250, windSpeed: 1.1 },
  '2025': { hazeColor: '#7fd4d9', hazeDensity: 0.012, particleCount: 350, windSpeed: 1.4 },
};

/** Distinct period-appropriate lighting settings for the five eras. */
export const LIGHTING_ERA_PRESETS: Record<EraId, LightingEraPreset> = {
  '1945': {
    sunColor: '#b8860b',
    sunIntensity: 0.85,
    ambientColor: '#51483c',
    ambientIntensity: 0.45,
    fogColor: '#9b8a6b',
    fogDensity: 0.018,
    exposure: 1.0,
  },
  '1965': {
    sunColor: '#d9b45a',
    sunIntensity: 1.0,
    ambientColor: '#c9bfae',
    ambientIntensity: 0.55,
    fogColor: '#c9b99c',
    fogDensity: 0.014,
    exposure: 1.1,
  },
  '1985': {
    sunColor: '#f2a93b',
    sunIntensity: 1.1,
    ambientColor: '#7f8fa6',
    ambientIntensity: 0.6,
    fogColor: '#6b6f7a',
    fogDensity: 0.012,
    exposure: 1.05,
  },
  '2005': {
    sunColor: '#ffe9b8',
    sunIntensity: 1.25,
    ambientColor: '#aebfd4',
    ambientIntensity: 0.65,
    fogColor: '#b7c3d4',
    fogDensity: 0.009,
    exposure: 1.15,
  },
  '2025': {
    sunColor: '#d8eaff',
    sunIntensity: 1.3,
    ambientColor: '#c7d7ea',
    ambientIntensity: 0.7,
    fogColor: '#cfdcea',
    fogDensity: 0.008,
    exposure: 1.2,
  },
};