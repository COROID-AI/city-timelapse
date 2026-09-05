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

/** Empty-but-typed per-era visual bundle; later tasks fill arrays with content. */
export interface EraSceneState {
  /** Which era this state describes. */
  id: EraId;
  buildings: unknown[];
  vehicles: unknown[];
  pedestrians: unknown[];
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
    vehicles: [],
    pedestrians: [],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1945'],
    anchors: ERA_ANCHOR_SLOTS['1945'],
  },
  '1965': {
    id: '1965',
    buildings: [],
    vehicles: [],
    pedestrians: [],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1965'],
    anchors: ERA_ANCHOR_SLOTS['1965'],
  },
  '1985': {
    id: '1985',
    buildings: [],
    vehicles: [],
    pedestrians: [],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['1985'],
    anchors: ERA_ANCHOR_SLOTS['1985'],
  },
  '2005': {
    id: '2005',
    buildings: [],
    vehicles: [],
    pedestrians: [],
    storefronts: [],
    ads: [],
    streetFurniture: [],
    sfx: SFX_ERA_DATA['2005'],
    anchors: ERA_ANCHOR_SLOTS['2005'],
  },
  '2025': {
    id: '2025',
    buildings: [],
    vehicles: [],
    pedestrians: [],
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