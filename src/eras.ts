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

/** Facade material language of a building plot. */
export type BuildingFacadeKind =
  | 'brick'
  | 'glass'
  | 'precast'
  | 'concrete'
  | 'curtain'
  | 'timber';

/** Rooftop treatment declared for a plot (built on the envelope top). */
export type BuildingRoofKind =
  | 'parapet'
  | 'water_tank'
  | 'ac_units'
  | 'satellite_field'
  | 'screen_mast'
  | 'solar_array'
  | 'green_roof';

/** Kind of era-specific construction detail attachable to a shared anchor. */
export type BuildingDetailKind =
  | 'billboard'
  | 'scaffold'
  | 'water_tank'
  | 'satellite_dish'
  | 'ac_unit'
  | 'neon_sign'
  | 'screen'
  | 'solar_panel'
  | 'green_wall'
  | 'canopy';

/**
 * One declarative construction detail. Details are *attachable anchor meshes*:
 * each one registers against one of the shared anchor groups (doorway, window,
 * shelf) and is rebuilt per era, so the same anchor hosts fully different
 * period-correct construction detail (billboards, scaffolds, water tanks,
 * satellite dishes, solar panels, …).
 */
export interface BuildingDetailSpec {
  kind: BuildingDetailKind;
  /** Shared anchor group the detail attaches to (defaults per kind). */
  anchor?: keyof EraAnchorSet;
  /** Text shown by text-bearing details (billboards/screens/neon signs). */
  label?: string;
  /** Optional accent color override. */
  color?: string;
  /** Optional repeat count for repeated details (dishes, panels, units). */
  count?: number;
}

/** Window pattern laid across a plot facade. */
export interface BuildingWindowPattern {
  /** Window columns along the facade width. */
  columns: number;
  /** Window rows per story. */
  rows: number;
  /** Horizontal gap between window units (world units). */
  gapX: number;
  /** Vertical gap between window rows (world units). */
  gapY: number;
}

/**
 * One building plot of the shared block. `id` and street position (`x`, `z`)
 * are stable across every era so plot N in 1945 maps 1:1 to plot N in 2025;
 * the *dimensions* (width/depth/stories) evolve per era, which is exactly what
 * the vertex-morph engine interpolates losslessly (same topology, no index
 * remapping).
 */
export interface BuildingPlotSpec {
  id: string;
  /** Plot center along the street (world units, stable across eras). */
  x: number;
  /** Plot center depth from the street (world units, stable across eras). */
  z: number;
  /** Facade width (world units). */
  width: number;
  /** Facade depth (world units). */
  depth: number;
  /** Number of stories above ground. */
  stories: number;
  /** Story height (world units). */
  storyHeight: number;
  /** Parapet/roof-band height (world units). */
  parapetHeight: number;
  /** Facade material language. */
  facade: BuildingFacadeKind;
  /** Rooftop treatment. */
  roof: BuildingRoofKind;
  /** Optional per-plot facade color override. */
  facadeColor?: string;
  /** Period accent color (trim, signage, window frame). */
  accentColor: string;
  /** Window pattern for the facade. */
  windows: BuildingWindowPattern;
  /** Era-specific construction details attached to shared anchors. */
  details: BuildingDetailSpec[];
}

/**
 * The whole block's declarative building spec for one era. This is the single
 * source the building constructor consumes; it never hardcodes era differences
 * into imperative scene code.
 */
export interface BuildingEraSpec {
  blockName: string;
  /** Shared trim/parapet color. */
  trimColor: string;
  /** Shared signage/neon accent color. */
  accentColor: string;
  /** Default billboard/screen copy for the era. */
  billboard: string;
  /** Emissive window glow color. */
  windowGlowColor: string;
  /** Emissive window glow intensity. */
  windowGlowIntensity: number;
  /** The five plots that make up the block (same ids/positions every era). */
  plots: BuildingPlotSpec[];
}

/**
 * Per-era declarative visual bundle. `buildings` carries the declarative plot
 * specs from BUILDING_ERA_SPECS; `vehicles` and `pedestrians` carry the
 * era-specific street population specs consumed by the traffic modules.
 */
export interface EraSceneState {
  /** Which era this state describes. */
  id: EraId;
  buildings: BuildingPlotSpec[];
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

// ---------------------------------------------------------------------------
// Building content — declarative per-era building sets
// ---------------------------------------------------------------------------
//
// Every era defines the SAME five block plots (stable ids/street positions);
// only the per-era dimensions, materials, window patterns and construction
// details evolve. The building module consumes these specs and never hardcodes
// era differences into imperative scene code.

/**
 * The declarative building set for every era. Plots are ordered from left to
 * right along the street; ids and x/z positions stay constant so the morph
 * engine can vertex-morph plot N between eras losslessly.
 */
export const BUILDING_ERA_SPECS: Record<EraId, BuildingEraSpec> = {
  // 1945 — post-war brick low-rise row with billboard-holding facades.
  '1945': {
    blockName: 'post-war brick row',
    trimColor: '#c8b997',
    accentColor: '#8c6a3f',
    billboard: 'WAR BONDS',
    windowGlowColor: '#ffca7a',
    windowGlowIntensity: 0.55,
    plots: [
      {
        id: 'plot-a',
        x: -3.15,
        z: -2.1,
        width: 3.0,
        depth: 2.3,
        stories: 3,
        storyHeight: 2.7,
        parapetHeight: 0.7,
        facade: 'brick',
        roof: 'water_tank',
        accentColor: '#8c6a3f',
        windows: { columns: 2, rows: 2, gapX: 0.45, gapY: 0.3 },
        details: [
          { kind: 'billboard', anchor: 'window', label: 'WAR BONDS', color: '#7a1f1f' },
          { kind: 'water_tank', anchor: 'window' },
        ],
      },
      {
        id: 'plot-b',
        x: 0,
        z: -2.25,
        width: 3.6,
        depth: 2.7,
        stories: 3,
        storyHeight: 2.7,
        parapetHeight: 0.8,
        facade: 'brick',
        roof: 'parapet',
        accentColor: '#9a7b4f',
        windows: { columns: 3, rows: 2, gapX: 0.4, gapY: 0.3 },
        details: [
          { kind: 'scaffold', anchor: 'shelf' },
          { kind: 'billboard', anchor: 'window', label: 'Coca-Cola 5¢', color: '#8a2f2f' },
          { kind: 'canopy', anchor: 'doorway' },
        ],
      },
      {
        id: 'plot-c',
        x: 3.15,
        z: -2.1,
        width: 3.0,
        depth: 2.3,
        stories: 3,
        storyHeight: 2.7,
        parapetHeight: 0.7,
        facade: 'brick',
        roof: 'water_tank',
        accentColor: '#7d6748',
        windows: { columns: 2, rows: 2, gapX: 0.45, gapY: 0.3 },
        details: [
          { kind: 'billboard', anchor: 'window', label: 'Ration Fair', color: '#5c4a30' },
          { kind: 'water_tank', anchor: 'window' },
        ],
      },
      {
        id: 'plot-d',
        x: -3.15,
        z: -6.65,
        width: 3.4,
        depth: 2.5,
        stories: 2,
        storyHeight: 2.6,
        parapetHeight: 0.6,
        facade: 'brick',
        roof: 'parapet',
        accentColor: '#8a6644',
        windows: { columns: 2, rows: 2, gapX: 0.55, gapY: 0.3 },
        details: [{ kind: 'scaffold', anchor: 'shelf' }],
      },
      {
        id: 'plot-e',
        x: 3.15,
        z: -6.65,
        width: 3.2,
        depth: 2.5,
        stories: 2,
        storyHeight: 2.6,
        parapetHeight: 0.6,
        facade: 'brick',
        roof: 'parapet',
        accentColor: '#96724a',
        windows: { columns: 2, rows: 2, gapX: 0.55, gapY: 0.3 },
        details: [
          { kind: 'billboard', anchor: 'window', label: 'Victory Laundry', color: '#6b5231' },
          { kind: 'canopy', anchor: 'doorway' },
        ],
      },
    ],
  },

  // 1965 — modernist glass and precast slabs with slim corporate towers.
  '1965': {
    blockName: 'modernist glass & precast',
    trimColor: '#dfe6ea',
    accentColor: '#3f6b8f',
    billboard: 'SPACE AGE LIVING',
    windowGlowColor: '#bfe3ff',
    windowGlowIntensity: 0.6,
    plots: [
      {
        id: 'plot-a',
        x: -3.15,
        z: -2.1,
        width: 3.2,
        depth: 2.3,
        stories: 6,
        storyHeight: 2.75,
        parapetHeight: 0.55,
        facade: 'precast',
        roof: 'parapet',
        accentColor: '#3f6b8f',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.28 },
        details: [{ kind: 'neon_sign', anchor: 'window', label: 'ORBIT MOTORS', color: '#ff2d78' }],
      },
      {
        id: 'plot-b',
        x: 0,
        z: -2.25,
        width: 3.8,
        depth: 2.7,
        stories: 8,
        storyHeight: 2.75,
        parapetHeight: 0.5,
        facade: 'glass',
        roof: 'ac_units',
        accentColor: '#5c8fb8',
        windows: { columns: 5, rows: 2, gapX: 0.16, gapY: 0.26 },
        details: [
          { kind: 'neon_sign', anchor: 'window', label: 'ATLANTIS AIR', color: '#2dffb8' },
          { kind: 'ac_unit', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-c',
        x: 3.15,
        z: -2.1,
        width: 3.2,
        depth: 2.3,
        stories: 6,
        storyHeight: 2.75,
        parapetHeight: 0.55,
        facade: 'precast',
        roof: 'parapet',
        accentColor: '#4b7a9e',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.28 },
        details: [{ kind: 'neon_sign', anchor: 'window', label: 'VESPA', color: '#ffd42d' }],
      },
      {
        id: 'plot-d',
        x: -3.15,
        z: -6.65,
        width: 3.6,
        depth: 2.5,
        stories: 4,
        storyHeight: 2.7,
        parapetHeight: 0.5,
        facade: 'precast',
        roof: 'ac_units',
        accentColor: '#5f8faa',
        windows: { columns: 3, rows: 2, gapX: 0.22, gapY: 0.28 },
        details: [
          { kind: 'scaffold', anchor: 'shelf' },
          { kind: 'ac_unit', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-e',
        x: 3.15,
        z: -6.65,
        width: 3.6,
        depth: 2.5,
        stories: 4,
        storyHeight: 2.7,
        parapetHeight: 0.5,
        facade: 'glass',
        roof: 'ac_units',
        accentColor: '#4e7f9e',
        windows: { columns: 3, rows: 2, gapX: 0.22, gapY: 0.28 },
        details: [{ kind: 'neon_sign', anchor: 'window', label: 'LAUNDROMAT', color: '#ff8a2d' }],
      },
    ],
  },

  // 1985 — neon-trimmed towers with brutalist concrete corners and rooftop AC.
  '1985': {
    blockName: 'neon towers & brutal slabs',
    trimColor: '#5d6570',
    accentColor: '#8f96a8',
    billboard: 'NEW WAVE 98FM',
    windowGlowColor: '#ffb8ff',
    windowGlowIntensity: 0.85,
    plots: [
      {
        id: 'plot-a',
        x: -3.15,
        z: -2.1,
        width: 3.4,
        depth: 2.4,
        stories: 11,
        storyHeight: 2.8,
        parapetHeight: 0.9,
        facade: 'concrete',
        roof: 'ac_units',
        accentColor: '#ff2d78',
        windows: { columns: 3, rows: 2, gapX: 0.3, gapY: 0.26 },
        details: [
          { kind: 'neon_sign', anchor: 'window', label: 'RADIO 98', color: '#ff2d78' },
          { kind: 'ac_unit', anchor: 'shelf', count: 3 },
        ],
      },
      {
        id: 'plot-b',
        x: 0,
        z: -2.25,
        width: 4.0,
        depth: 2.8,
        stories: 14,
        storyHeight: 2.8,
        parapetHeight: 1.0,
        facade: 'glass',
        roof: 'ac_units',
        accentColor: '#2dffb8',
        windows: { columns: 4, rows: 2, gapX: 0.24, gapY: 0.24 },
        details: [
          { kind: 'neon_sign', anchor: 'window', label: 'VIDEO CITY', color: '#2dffb8' },
          { kind: 'ac_unit', anchor: 'shelf', count: 4 },
          { kind: 'billboard', anchor: 'window', label: 'Pay Phones', color: '#14161c' },
        ],
      },
      {
        id: 'plot-c',
        x: 3.15,
        z: -2.1,
        width: 3.4,
        depth: 2.4,
        stories: 11,
        storyHeight: 2.8,
        parapetHeight: 0.9,
        facade: 'concrete',
        roof: 'ac_units',
        accentColor: '#ffd42d',
        windows: { columns: 3, rows: 2, gapX: 0.3, gapY: 0.26 },
        details: [
          { kind: 'neon_sign', anchor: 'window', label: 'CINEMA', color: '#ffd42d' },
          { kind: 'scaffold', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-d',
        x: -3.15,
        z: -6.65,
        width: 3.8,
        depth: 2.6,
        stories: 6,
        storyHeight: 2.75,
        parapetHeight: 0.7,
        facade: 'concrete',
        roof: 'ac_units',
        accentColor: '#b8c0d0',
        windows: { columns: 3, rows: 2, gapX: 0.28, gapY: 0.26 },
        details: [
          { kind: 'ac_unit', anchor: 'shelf', count: 3 },
          { kind: 'satellite_dish', anchor: 'window' },
        ],
      },
      {
        id: 'plot-e',
        x: 3.15,
        z: -6.65,
        width: 3.8,
        depth: 2.6,
        stories: 6,
        storyHeight: 2.75,
        parapetHeight: 0.7,
        facade: 'precast',
        roof: 'satellite_field',
        accentColor: '#7a8496',
        windows: { columns: 3, rows: 2, gapX: 0.28, gapY: 0.26 },
        details: [
          { kind: 'neon_sign', anchor: 'window', label: 'NITE CLUB', color: '#b84dff' },
          { kind: 'satellite_dish', anchor: 'window' },
        ],
      },
    ],
  },

  // 2005 — glass towers with screen facades and grayscale digital signage.
  '2005': {
    blockName: 'glass towers & screen facades',
    trimColor: '#b9c4cf',
    accentColor: '#7e93ab',
    billboard: 'Go Digital!',
    windowGlowColor: '#cfe6ff',
    windowGlowIntensity: 0.75,
    plots: [
      {
        id: 'plot-a',
        x: -3.15,
        z: -2.1,
        width: 3.8,
        depth: 2.4,
        stories: 16,
        storyHeight: 2.8,
        parapetHeight: 0.6,
        facade: 'curtain',
        roof: 'screen_mast',
        accentColor: '#8ea6c4',
        windows: { columns: 5, rows: 2, gapX: 0.12, gapY: 0.24 },
        details: [{ kind: 'screen', anchor: 'window', label: 'GIGABYTE', color: '#25e0fa' }],
      },
      {
        id: 'plot-b',
        x: 0,
        z: -2.25,
        width: 4.4,
        depth: 2.9,
        stories: 20,
        storyHeight: 2.8,
        parapetHeight: 0.65,
        facade: 'curtain',
        roof: 'ac_units',
        accentColor: '#9fb4cc',
        windows: { columns: 6, rows: 2, gapX: 0.1, gapY: 0.22 },
        details: [
          { kind: 'screen', anchor: 'window', label: 'NOKIA', color: '#1fa4ff' },
          { kind: 'ac_unit', anchor: 'shelf', count: 5 },
        ],
      },
      {
        id: 'plot-c',
        x: 3.15,
        z: -2.1,
        width: 3.8,
        depth: 2.4,
        stories: 16,
        storyHeight: 2.8,
        parapetHeight: 0.6,
        facade: 'curtain',
        roof: 'screen_mast',
        accentColor: '#8ea6c4',
        windows: { columns: 5, rows: 2, gapX: 0.12, gapY: 0.24 },
        details: [{ kind: 'screen', anchor: 'window', label: 'BLAZE', color: '#ff6b2d' }],
      },
      {
        id: 'plot-d',
        x: -3.15,
        z: -6.65,
        width: 4.0,
        depth: 2.7,
        stories: 9,
        storyHeight: 2.75,
        parapetHeight: 0.55,
        facade: 'curtain',
        roof: 'parapet',
        accentColor: '#9db3cc',
        windows: { columns: 5, rows: 2, gapX: 0.14, gapY: 0.24 },
        details: [{ kind: 'screen', anchor: 'window', label: 'YAHOO!', color: '#8a52ff' }],
      },
      {
        id: 'plot-e',
        x: 3.15,
        z: -6.65,
        width: 4.0,
        depth: 2.7,
        stories: 9,
        storyHeight: 2.75,
        parapetHeight: 0.55,
        facade: 'curtain',
        roof: 'parapet',
        accentColor: '#93a8c2',
        windows: { columns: 5, rows: 2, gapX: 0.14, gapY: 0.24 },
        details: [{ kind: 'screen', anchor: 'window', label: 'eBay', color: '#25e0fa' }],
      },
    ],
  },

  // 2025 — mixed-use timber-and-glass with green walls and rooftop solar arrays.
  '2025': {
    blockName: 'timber & glass mixed-use',
    trimColor: '#7fa58f',
    accentColor: '#3f9d78',
    billboard: 'NEXUS AI',
    windowGlowColor: '#c8ffe4',
    windowGlowIntensity: 0.7,
    plots: [
      {
        id: 'plot-a',
        x: -3.15,
        z: -2.1,
        width: 3.9,
        depth: 2.5,
        stories: 10,
        storyHeight: 2.9,
        parapetHeight: 0.5,
        facade: 'timber',
        roof: 'green_roof',
        accentColor: '#3f9d78',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.24 },
        details: [
          { kind: 'screen', anchor: 'window', label: 'NEXUS AI', color: '#2de892' },
          { kind: 'green_wall', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-b',
        x: 0,
        z: -2.25,
        width: 4.4,
        depth: 3.0,
        stories: 12,
        storyHeight: 2.9,
        parapetHeight: 0.55,
        facade: 'glass',
        roof: 'solar_array',
        accentColor: '#4db88f',
        windows: { columns: 5, rows: 2, gapX: 0.15, gapY: 0.22 },
        details: [
          { kind: 'screen', anchor: 'window', label: 'TESSERACT', color: '#25d0ff' },
          { kind: 'green_wall', anchor: 'shelf' },
          { kind: 'solar_panel', anchor: 'window', count: 3 },
        ],
      },
      {
        id: 'plot-c',
        x: 3.15,
        z: -2.1,
        width: 3.9,
        depth: 2.5,
        stories: 10,
        storyHeight: 2.9,
        parapetHeight: 0.5,
        facade: 'timber',
        roof: 'green_roof',
        accentColor: '#3f9d78',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.24 },
        details: [
          { kind: 'screen', anchor: 'window', label: 'GreenCharge', color: '#7de84a' },
          { kind: 'green_wall', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-d',
        x: -3.15,
        z: -6.65,
        width: 4.2,
        depth: 2.8,
        stories: 6,
        storyHeight: 2.85,
        parapetHeight: 0.5,
        facade: 'timber',
        roof: 'solar_array',
        accentColor: '#4ba77f',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.24 },
        details: [
          { kind: 'solar_panel', anchor: 'window', count: 4 },
          { kind: 'green_wall', anchor: 'shelf' },
        ],
      },
      {
        id: 'plot-e',
        x: 3.15,
        z: -6.65,
        width: 4.2,
        depth: 2.8,
        stories: 6,
        storyHeight: 2.85,
        parapetHeight: 0.5,
        facade: 'glass',
        roof: 'solar_array',
        accentColor: '#43a27c',
        windows: { columns: 4, rows: 2, gapX: 0.18, gapY: 0.24 },
        details: [
          { kind: 'solar_panel', anchor: 'window', count: 4 },
          { kind: 'screen', anchor: 'window', label: 'LOOP CAFÉ', color: '#2de892' },
        ],
      },
    ],
  },
};

/** Convenience accessor for one era's declarative building set. */
export function getBuildingEraSpec(id: EraId): BuildingEraSpec {
  return BUILDING_ERA_SPECS[id];
}

/** Per-era scene states — identical anchor contracts and declarative content. */
export const ERA_SCENE_STATES: Record<EraId, EraSceneState> = {
  '1945': {
    id: '1945',
    buildings: BUILDING_ERA_SPECS['1945'].plots,
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
    buildings: BUILDING_ERA_SPECS['1965'].plots,
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
    buildings: BUILDING_ERA_SPECS['1985'].plots,
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
    buildings: BUILDING_ERA_SPECS['2005'].plots,
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
    buildings: BUILDING_ERA_SPECS['2025'].plots,
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