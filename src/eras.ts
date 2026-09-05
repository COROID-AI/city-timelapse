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

/** Kinds of businesses occupying the ground-floor storefront units. */
export type StorefrontType =
  | 'grocery'
  | 'hardware'
  | 'pharmacy'
  | 'bakery'
  | 'diner'
  | 'laundromat'
  | 'boutique'
  | 'shoes'
  | 'video'
  | 'arcade'
  | 'pizza'
  | 'records'
  | 'coffee'
  | 'mobile'
  | 'bank'
  | 'convenience'
  | 'cafe'
  | 'coworking'
  | 'kiosk'
  | 'restaurant';

/** Physical awning family for a storefront unit's era. */
export type AwningStyle =
  | 'canvas-stripes'
  | 'scalloped'
  | 'metal-rib'
  | 'glass-canopy'
  | 'matte-canopy';

/** Entrance family for a storefront unit's era. */
export type EntranceStyle =
  | 'wood-recessed'
  | 'chrome-glass'
  | 'neon-frame'
  | 'glass-slider'
  | 'automatic-matte';

/** Declarative period-appropriate typography/signage spec for one sign. */
export interface SignageStyleSpec {
  /** CSS font stack used for the wordmark (e.g. period serif stacks). */
  fontFamily: string;
  /** CSS font weight ('bold', 700, 'normal', …). */
  fontWeight: string | number;
  /** Primary wordmark colour (hex). */
  ink: string;
  /** Secondary/accent colour (subline, outline, decorations). */
  accent: string;
  /** Background colour behind the lettering, or 'transparent' for decals. */
  background: string;
  /** Glow colour for neon-style signs; '' means no glow. */
  glow: string;
  /** Extra letter spacing in px (matte/corporate eras track wider). */
  tracking: number;
}

/** One ground-floor storefront unit in a given era. */
export interface StorefrontSpec {
  /** Stable instance id, unique within (and across) eras. */
  id: string;
  /** Business kind — drives the painted display motifs. */
  type: StorefrontType;
  /** Sign wordmark (as painted/printed on the sign band). */
  name: string;
  /** Small tagline drawn under the wordmark. */
  tagline: string;
  /** Era awning family (shared by all units of an era). */
  awning: AwningStyle;
  /** Era entrance family. */
  entrance: EntranceStyle;
  /** Unit facade/backdrop colour. */
  facadeColor: string;
  /** Trim/frame colour (sign frame, door frame, awning trim). */
  trimColor: string;
  /** Period typography declaration used by the CanvasTexture painters. */
  signage: SignageStyleSpec;
  /** Headline painted inside the display window. */
  windowHeadline: string;
  /** Sub-text painted inside the display window. */
  windowSub: string;
}

/** Advertising media family; each appears only in its correct decades. */
export type AdMedia = 'mural' | 'neon' | 'billboard' | 'screen';

/** One wall advertisement for an era (mural, neon, billboard or screen). */
export interface AdSpec {
  /** Stable instance id, unique within (and across) eras. */
  id: string;
  /** Media family — controls the painter and the 3D housing. */
  media: AdMedia;
  /** Headline drawn on the ad (largest text). */
  headline: string;
  /** Subline drawn under the headline. */
  subline: string;
  /** Ad colour palette consumed by the CanvasTexture painter. */
  palette: {
    background: string;
    ink: string;
    accent: string;
    /** Neon/screen glow colour; '' = no glow. */
    glow: string;
  };
  /** Period typography declaration. */
  signage: SignageStyleSpec;
}

/** Street furniture model family identifiers used by the procedural builders. */
export type StreetFurnitureModelId =
  | 'lamppost-gas-1945'
  | 'lamppost-sodium-1965'
  | 'lamppost-cobra-1985'
  | 'lamppost-led-2005'
  | 'lamppost-smart-2025'
  | 'traffic-light-1945'
  | 'traffic-light-1965'
  | 'traffic-light-1985'
  | 'traffic-light-2005'
  | 'traffic-light-2025'
  | 'bench-wood-1945'
  | 'bench-midcentury-1965'
  | 'bench-metal-1985'
  | 'bench-modern-2005'
  | 'bench-smart-2025'
  | 'hydrant-1945'
  | 'hydrant-1965'
  | 'hydrant-1985'
  | 'hydrant-2005'
  | 'hydrant-2025'
  | 'bin-cast-1945'
  | 'bin-wire-1965'
  | 'bin-metal-1985'
  | 'bin-plastic-2005'
  | 'bin-split-2025'
  | 'busstop-1945'
  | 'busstop-1965'
  | 'busstop-1985'
  | 'busstop-2005'
  | 'busstop-2025'
  | 'payphone-1945'
  | 'payphone-1965'
  | 'payphone-1985'
  | 'newsstand-1945'
  | 'newsstand-1965'
  | 'newsstand-1985'
  | 'newsstand-2005'
  | 'newsstand-2025'
  | 'tree-1945'
  | 'tree-1965'
  | 'tree-1985'
  | 'tree-2005'
  | 'tree-2025'
  | 'planter-1985'
  | 'planter-2005'
  | 'planter-2025';

/** Street furniture family. Each family has its own era-specific model ids. */
export type StreetFurnitureKind =
  | 'lamp'
  | 'traffic_light'
  | 'bench'
  | 'hydrant'
  | 'bin'
  | 'bus_stop'
  | 'payphone'
  | 'newsstand'
  | 'tree'
  | 'planter';

/**
 * One piece of era-aware street furniture. Positions are stable across eras so
 * the whole street scene can be declaratively re-styled per period (a 1945
 * cast-iron lamp morphs placement with a 2025 smart pole, etc.). Families that
 * do not exist in an era are simply absent from that era's array.
 */
export interface StreetFurnitureSpec {
  /** Stable instance id, unique within (and across) eras. */
  id: string;
  /** Furniture family. */
  kind: StreetFurnitureKind;
  /** Which procedural model family to build (implies the era). */
  model: StreetFurnitureModelId;
  /** World position at street level. */
  x: number;
  z: number;
  /** Primary colour. */
  color: string;
  /** Secondary/accent colour (trim, canopy, leaves, light head). */
  accentColor: string;
  /** Optional heading (radians, used by kiosks/booths/bus shelters). */
  rotation?: number;
}

/** Per-era street furniture + road furniture comprehensiveness. */
export interface StreetFurnitureEraSpec {
  /** Era this set describes. */
  era: EraId;
  /** Street-adjacent pieces (lamps, benches, hydrants, bins, bus stops, payphones, newsstands). */
  street: StreetFurnitureSpec[];
  /** Trees and planters (both are declared as furniture so the block green evolves with the timeline). */
  greenery: StreetFurnitureSpec[];
  /** True when crosswalks/road markings are painted on the asphalt for this era. */
  crosswalks: boolean;
  /** Crosswalk band colour drawn on the road plane. */
  crosswalkColor: string;
}

/** Ambient life family identifiers used by the procedural builders. */
export type AmbientKind =
  | 'pigeons'
  | 'steam'
  | 'chimney_smoke'
  | 'dust'
  | 'leaves'
  | 'chatter';

/**
 * One era-aware ambient life element. `count` drives the particle/bird
 * population size, `intensity` scales opacity/size, `color` and `accentColor`
 * are the two palette stops of the animated particle sprites. The element is
 * hidden (count 0) when the period had none.
 */
export interface AmbientEraSpec {
  id: string;
  /** Ambient family. */
  kind: AmbientKind;
  /** Particle/bird count (0 = not present in this era). */
  count: number;
  /** Opacity/size intensity 0..1. */
  intensity: number;
  /** Primary colour. */
  color: string;
  /** Secondary palette colour (accent stop). */
  accentColor: string;
  /** Height band around which the element lives (ground/street level = 0). */
  altitude?: number;
}

/** Empty-but-typed per-era visual bundle; era tasks fill arrays with content. */
export interface EraSceneState {
  /** Which era this state describes. */
  id: EraId;
  buildings: BuildingPlotSpec[];
  vehicles: VehicleSpec[];
  pedestrians: PedestrianSpec[];
  storefronts: StorefrontSpec[];
  ads: AdSpec[];
  streetFurniture: StreetFurnitureEraSpec[];
  /** Period-appropriate sound parameters consumed by the SFX engine. */
  sfx: SfxEraData;
  /** Period-appropriate ambient life elements (birds, steam, smoke, dust, leaves, chatter). */
  ambient: AmbientEraSpec[];
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

/** Per-era scene state stubs — identical anchor contracts, declarative content. */

// --- Declarative storefront & advertising specs (consumed by content builders) ---

const SIGN_1945: SignageStyleSpec = {
  fontFamily: '"Georgia", "Times New Roman", serif',
  fontWeight: 'bold',
  ink: '#f5e6c8',
  accent: '#c9a227',
  background: '#4a2c1a',
  glow: '',
  tracking: 0,
};
const SIGN_1965: SignageStyleSpec = {
  fontFamily: '"Trebuchet MS", "Century Gothic", sans-serif',
  fontWeight: 700,
  ink: '#9c2f3d',
  accent: '#1f6f8b',
  background: '#e8e2d4',
  glow: '',
  tracking: 1,
};
const SIGN_1985: SignageStyleSpec = {
  fontFamily: '"Arial Black", Arial, sans-serif',
  fontWeight: 900,
  ink: '#ff2fd6',
  accent: '#39ffd0',
  background: '#10101c',
  glow: '#ff2fd6',
  tracking: 2,
};
const SIGN_2005: SignageStyleSpec = {
  fontFamily: '"Arial", "Helvetica Neue", sans-serif',
  fontWeight: 'bold',
  ink: '#155bd4',
  accent: '#c0392b',
  background: '#f2f5f8',
  glow: '',
  tracking: 0,
};
const SIGN_2025: SignageStyleSpec = {
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontWeight: 500,
  ink: '#1c2026',
  accent: '#5d6f84',
  background: '#e6e4dc',
  glow: '',
  tracking: 2,
};

const ERA_SIGN: Record<EraId, SignageStyleSpec> = {
  '1945': SIGN_1945,
  '1965': SIGN_1965,
  '1985': SIGN_1985,
  '2005': SIGN_2005,
  '2025': SIGN_2025,
};

const ERA_AWNING: Record<EraId, AwningStyle> = {
  '1945': 'canvas-stripes',
  '1965': 'scalloped',
  '1985': 'metal-rib',
  '2005': 'glass-canopy',
  '2025': 'matte-canopy',
};

const ERA_ENTRANCE: Record<EraId, EntranceStyle> = {
  '1945': 'wood-recessed',
  '1965': 'chrome-glass',
  '1985': 'neon-frame',
  '2005': 'glass-slider',
  '2025': 'automatic-matte',
};

function storefrontUnit(
  id: string,
  era: EraId,
  type: StorefrontSpec['type'],
  name: string,
  tagline: string,
  facadeColor: string,
  trimColor: string,
  windowHeadline: string,
  windowSub: string,
): StorefrontSpec {
  if (!id.startsWith(`s-${era}-`)) {
    throw new Error(`StorefrontSpec id "${id}" does not match era ${era}`);
  }
  return {
    id,
    type,
    name,
    tagline,
    awning: ERA_AWNING[era],
    entrance: ERA_ENTRANCE[era],
    facadeColor,
    trimColor,
    signage: ERA_SIGN[era],
    windowHeadline,
    windowSub,
  };
}

/** Per-era storefront units in facade-slot order (period-correct signage). */
export const STOREFRONT_SPECS: Record<EraId, StorefrontSpec[]> = {
  '1945': [
    storefrontUnit('s-1945-1', '1945', 'grocery', 'A & P GROCERY', 'FRESH VEGETABLES & MEATS', '#8a3b2e', '#4a2c1a', 'RATION BOOKS HONORED', 'IN STORE TODAY'),
    storefrontUnit('s-1945-2', '1945', 'hardware', 'BROADWAY HARDWARE', 'POTS · PAILS · TOOLS', '#6e4a2f', '#3d2a18', 'WAR BONDS ON SALE', 'PLEDGE SHEETS HERE'),
    storefrontUnit('s-1945-3', '1945', 'pharmacy', 'CITY PHARMACY', 'DRUGS & SUNDRIES', '#4a7a5a', '#2c4a38', 'VICTORY GARDEN SEEDS', 'NOVEMBER SPECIALS'),
    storefrontUnit('s-1945-4', '1945', 'bakery', 'HOMESTEAD BAKERY', 'BREAD DELIVERED DAILY', '#8a5a2e', '#5a3a1e', 'WHEAT LOAF — 14¢', 'VICTORY SHORTENING'),
    storefrontUnit('s-1945-5', '1945', 'grocery', 'ACME PRODUCE', 'GROCERY & MEAT MARKET', '#7a3a3e', '#4a241e', 'HOMEMADE SAUERKRAUT', 'BUY ONE, SAVE TODAY'),
    storefrontUnit('s-1945-6', '1945', 'bakery', 'LIBERTY DINER', 'COFFEE 10¢ · PIE 25¢', '#5a4a3e', '#33302a', 'TURKEY SPECIAL', 'ALL DAY'),
  ],
  '1965': [
    storefrontUnit('s-1965-1', '1965', 'diner', 'STARLITE DINER', 'OPEN ALL NIGHT', '#f2c9a6', '#9c2f3d', 'BURGERS 25¢', 'ONLY THE BEST'),
    storefrontUnit('s-1965-2', '1965', 'laundromat', 'BUBBLE LAUNDROMAT', 'SELF-SERVICE · 24 HRS', '#7ea3a5', '#1f6f8b', 'WASH & DRY 25¢', 'DETERGENT FREE'),
    storefrontUnit('s-1965-3', '1965', 'pharmacy', 'CORNER DRUGS', 'FOUNTAIN & SUNDRIES', '#c2576b', '#9c2f3d', 'MALT & MILKSHAKE', 'SODA FOUNTAIN'),
    storefrontUnit('s-1965-4', '1965', 'diner', 'ROUTE 66 CAFE', 'HOME COOKING', '#e8d8b0', '#a46a2c', 'MEATLOAF SPECIAL', 'AMERICAN COOKING'),
    storefrontUnit('s-1965-5', '1965', 'shoes', 'FAIRFIELD SHOES', 'WALK IN COMFORT', '#9cc9d9', '#1f6f8b', 'NEW MOD LOAFERS', 'STEP INTO STYLE'),
    storefrontUnit('s-1965-6', '1965', 'laundromat', 'WASH-O-MAT', 'COIN OPERATED', '#c9d0d6', '#3d5568', 'STEAM PRESSING', 'SAME DAY SERVICE'),
  ],
  '1985': [
    storefrontUnit('s-1985-1', '1985', 'video', 'STAR VIDEO', 'RENTALS · SALES', '#2a2a5c', '#ff2fd6', 'NEW RELEASES THIS WEEK', 'MEMBER RENTALS 99¢'),
    storefrontUnit('s-1985-2', '1985', 'arcade', 'GALAXY ARCADE', '25¢ PLAY', '#1c1c34', '#39ffd0', 'HIGH SCORE 1,230,500', 'INSERT COIN'),
    storefrontUnit('s-1985-3', '1985', 'video', 'BLOCKBUSTER VIDEO', 'TAKE ONE HOME', '#10101c', '#ffd23f', 'BUY 2 GET 1 FREE', 'NEW RELEASES'),
    storefrontUnit('s-1985-4', '1985', 'arcade', 'PAC-MAN ARCADE', 'PLAY · EAT · REPEAT', '#3b1c4a', '#ff5c8a', 'TOURNAMENT NIGHT', '9 PM FRIDAY'),
    storefrontUnit('s-1985-5', '1985', 'pizza', 'PIZZA PALACE', 'SLICE 95¢', '#8a2e3c', '#ffd23f', 'FREE DELIVERY', 'HOT & READY'),
    storefrontUnit('s-1985-6', '1985', 'records', 'ROCK & ROLL RECORDS', 'NEW & USED VINYL', '#2a3b5c', '#2fd6ff', 'CONCERT TEES', 'NOW IN STOCK'),
  ],
  '2005': [
    storefrontUnit('s-2005-1', '2005', 'mobile', 'MOBILE ZONE', 'NO CONTRACT', '#dfe7ee', '#155bd4', 'NEW PHONES', 'ANY CARRIER'),
    storefrontUnit('s-2005-2', '2005', 'bank', 'FIRST NATIONAL BANK', 'OPEN SATURDAYS', '#f2f5f8', '#0e4f9a', 'LOW RATE LOANS', 'APPLY ONLINE'),
    storefrontUnit('s-2005-3', '2005', 'coffee', 'STARBUCKS COFFEE', 'FIND YOUR FLAVOR', '#e8e0d0', '#0b4a32', 'FALL DRINKS', 'NOW BREWING'),
    storefrontUnit('s-2005-4', '2005', 'convenience', '7-ELEVEN', 'OH THANK HEAVEN', '#c0392b', '#f2f5f8', 'BIG GULP 99¢', 'ALWAYS OPEN'),
    storefrontUnit('s-2005-5', '2005', 'mobile', 'VERIZON WIRELESS', 'CAN YOU HEAR ME NOW', '#0e4f9a', '#c0392b', '4G NETWORK', 'MOST RELIABLE'),
    storefrontUnit('s-2005-6', '2005', 'convenience', 'WALGREENS', 'AT THE CORNER OF HAPPY', '#155bd4', '#f2f5f8', 'PHOTO CENTER', 'OPEN 24 HOURS'),
  ],
  '2025': [
    storefrontUnit('s-2025-1', '2025', 'cafe', 'DRIP & FOLD', 'SPECIALTY COFFEE', '#e6e4dc', '#1c2026', 'OAT FLAT WHITE', 'PICKUP OR DINE'),
    storefrontUnit('s-2025-2', '2025', 'coworking', 'MAKERSPACE 46', 'DESKS · STUDIO · PODS', '#d8dde2', '#5d6f84', 'DAY PASS $25', 'BOOK A DESK'),
    storefrontUnit('s-2025-3', '2025', 'restaurant', 'URBAN THYME', 'SEASONAL MENU', '#c9d3c2', '#2e4a3a', 'FARM TO TABLE', 'RESERVATIONS'),
    storefrontUnit('s-2025-4', '2025', 'kiosk', 'CITY KIOSK 01', 'BILLING · TICKETS · MAPS', '#e0d8d0', '#4a3f3a', 'CITY SERVICES', 'SMART CITY'),
    storefrontUnit('s-2025-5', '2025', 'cafe', 'NOMAD ROASTERS', 'SMALL BATCH ROAST', '#d9d2c4', '#3a342c', 'COLD BREW TAP', 'REUSE CUP'),
    storefrontUnit('s-2025-6', '2025', 'coworking', 'FOUNDRY LOUNGE', '24/7 MEMBER ACCESS', '#d2d8dc', '#3c4a5a', 'HOT DESK READY', 'MEETING ROOMS'),
  ],
};

/** Per-era wall advertisements in media timeline order. */
export const AD_SPECS: Record<EraId, AdSpec[]> = {
  '1945': [
    {
      id: 'a-1945-1',
      media: 'mural',
      headline: 'BACK THE ATTACK',
      subline: 'BUY WAR BONDS TODAY',
      palette: { background: '#6e3527', ink: '#f5e6c8', accent: '#d5b25a', glow: '' },
      signage: SIGN_1945,
    },
    {
      id: 'a-1945-2',
      media: 'mural',
      headline: 'UNITED WE STAND',
      subline: 'VICTORY GARDENS WIN THE WAR',
      palette: { background: '#6e3527', ink: '#f5e6c8', accent: '#d5b25a', glow: '' },
      signage: SIGN_1945,
    },
    {
      id: 'a-1945-3',
      media: 'mural',
      headline: 'GROW FOOD AT HOME',
      subline: 'RATION VEGETABLES · 1945',
      palette: { background: '#6e3527', ink: '#f5e6c8', accent: '#d5b25a', glow: '' },
      signage: SIGN_1945,
    },
    {
      id: 'a-1945-4',
      media: 'mural',
      headline: 'SAVE SCRAP METAL',
      subline: 'EVERY TON HELPS THE FRONT',
      palette: { background: '#6e3527', ink: '#f5e6c8', accent: '#d5b25a', glow: '' },
      signage: SIGN_1945,
    },
    {
      id: 'a-1945-5',
      media: 'mural',
      headline: 'THE COFFEE 5¢',
      subline: 'WHEN THE RATION CARD SPEAKS',
      palette: { background: '#6e3527', ink: '#f5e6c8', accent: '#d5b25a', glow: '' },
      signage: SIGN_1945,
    },
  ],
  '1965': [
    {
      id: 'a-1965-1',
      media: 'neon',
      headline: 'MOTEL',
      subline: 'VACANCY',
      palette: { background: '#10151f', ink: '#ffd23f', accent: '#39e6c0', glow: '#ffd23f' },
      signage: SIGN_1965,
    },
    {
      id: 'a-1965-2',
      media: 'neon',
      headline: 'TAXI STAND',
      subline: '24-HOUR',
      palette: { background: '#10151f', ink: '#ffd23f', accent: '#39e6c0', glow: '#ffd23f' },
      signage: SIGN_1965,
    },
    {
      id: 'a-1965-3',
      media: 'neon',
      headline: 'FLAME BROILED',
      subline: 'BURGER KING OF THE ROAD',
      palette: { background: '#10151f', ink: '#ffd23f', accent: '#39e6c0', glow: '#ffd23f' },
      signage: SIGN_1965,
    },
  ],
  '1985': [
    {
      id: 'a-1985-1',
      media: 'neon',
      headline: 'L.E.D. DANCE',
      subline: 'OPEN TIL 4 AM',
      palette: { background: '#0b0b12', ink: '#ff2fd6', accent: '#39ffd0', glow: '#ff2fd6' },
      signage: SIGN_1985,
    },
    {
      id: 'a-1985-2',
      media: 'neon',
      headline: 'VIDEO RENTALS',
      subline: 'TAPES · GAMES · MOVIES',
      palette: { background: '#0b0b12', ink: '#ff2fd6', accent: '#39ffd0', glow: '#ff2fd6' },
      signage: SIGN_1985,
    },
    {
      id: 'a-1985-3',
      media: 'billboard',
      headline: 'SPARK COLA',
      subline: 'THE THIRST QUENCHER',
      palette: { background: '#f4f2ea', ink: '#101018', accent: '#ff5c1a', glow: '' },
      signage: SIGN_1985,
    },
    {
      id: 'a-1985-4',
      media: 'billboard',
      headline: 'MUDD BURGERS',
      subline: 'BETTER TASTING, BOLDER',
      palette: { background: '#f4f2ea', ink: '#101018', accent: '#ff5c1a', glow: '' },
      signage: SIGN_1985,
    },
  ],
  '2005': [
    {
      id: 'a-2005-1',
      media: 'billboard',
      headline: 'TURBO-CO',
      subline: '4G TOWERS NOW',
      palette: { background: '#f4f6f8', ink: '#0e2a6b', accent: '#d2232a', glow: '' },
      signage: SIGN_2005,
    },
    {
      id: 'a-2005-2',
      media: 'billboard',
      headline: 'DRIVE THE FUTURE',
      subline: 'THE NEW CRACKER SUV',
      palette: { background: '#f4f6f8', ink: '#0e2a6b', accent: '#d2232a', glow: '' },
      signage: SIGN_2005,
    },
    {
      id: 'a-2005-3',
      media: 'screen',
      headline: 'TELE-STOR 24/7',
      subline: 'BUY 1 GET 1 FREE',
      palette: { background: '#062033', ink: '#9fe8ff', accent: '#ffe066', glow: '#7fd4ff' },
      signage: SIGN_2005,
    },
  ],
  '2025': [
    {
      id: 'a-2025-1',
      media: 'screen',
      headline: 'NEXUS-AI',
      subline: 'YOUR CITY HELPER',
      palette: { background: '#041420', ink: '#cfeaff', accent: '#5effd0', glow: '#3fa8ff' },
      signage: SIGN_2025,
    },
    {
      id: 'a-2025-2',
      media: 'screen',
      headline: 'SMART GRID',
      subline: 'CHARGE & SAVE 20%',
      palette: { background: '#041420', ink: '#cfeaff', accent: '#5effd0', glow: '#3fa8ff' },
      signage: SIGN_2025,
    },
    {
      id: 'a-2025-3',
      media: 'screen',
      headline: 'ECO RIDER',
      subline: 'RIDE THE TIDAL WAVE',
      palette: { background: '#041420', ink: '#cfeaff', accent: '#5effd0', glow: '#3fa8ff' },
      signage: SIGN_2025,
    },
  ],
};

// ---------------------------------------------------------------------------
// Street furniture + ambient life — declarative per-era sets
// ---------------------------------------------------------------------------
//
// Positions are stable across eras so the street scene re-styles per period
// instead of re-laying out: lamp slots, bench slots, hydrant slots, bin slots,
// bus-stop slots, tree slots and newsstand slots exist in several adjacent
// eras; families that disappear (payphones after 1985, steam/smoke after
// 1985) are simply absent from that era's arrays. The streetfurniture/ and
// ambient/ modules only consume these specs and never hardcode era logic.

export const STREET_FURNITURE_SPECS: Record<EraId, StreetFurnitureEraSpec> = {
  '1945': {
    era: '1945',
    street: [
      { id: 'f-1945-lamp-1', kind: 'lamp', model: 'lamppost-gas-1945', x: -3.6, z: 1.9, color: '#1d3a24', accentColor: '#ffd08a' },
      { id: 'f-1945-lamp-2', kind: 'lamp', model: 'lamppost-gas-1945', x: 0.2, z: 2.0, color: '#1d3a24', accentColor: '#ffd08a' },
      { id: 'f-1945-lamp-3', kind: 'lamp', model: 'lamppost-gas-1945', x: 4.0, z: 1.9, color: '#1d3a24', accentColor: '#ffd08a' },
      { id: 'f-1945-traffic-1', kind: 'traffic_light', model: 'traffic-light-1945', x: -4.6, z: 3.4, color: '#22262b', accentColor: '#e83030' },
      { id: 'f-1945-bench-1', kind: 'bench', model: 'bench-wood-1945', x: -2.4, z: 2.6, color: '#5c4426', accentColor: '#2a2e33' },
      { id: 'f-1945-hydrant-1', kind: 'hydrant', model: 'hydrant-1945', x: -1.2, z: 2.15, color: '#b23a2a', accentColor: '#7f2c20' },
      { id: 'f-1945-bin-1', kind: 'bin', model: 'bin-cast-1945', x: 2.1, z: 2.7, color: '#2f3a2c', accentColor: '#46543f' },
      { id: 'f-1945-busstop-1', kind: 'bus_stop', model: 'busstop-1945', x: 5.0, z: 2.75, color: '#3a3f45', accentColor: '#d8b24a' },
      { id: 'f-1945-payphone-1', kind: 'payphone', model: 'payphone-1945', x: 0.6, z: 2.35, color: '#2e3b40', accentColor: '#6b7278' },
      { id: 'f-1945-payphone-2', kind: 'payphone', model: 'payphone-1945', x: -3.0, z: 2.4, color: '#2e3b40', accentColor: '#6b7278' },
      { id: 'f-1945-newsstand-1', kind: 'newsstand', model: 'newsstand-1945', x: 4.2, z: 2.6, color: '#4e3a26', accentColor: '#c8a14e', rotation: -0.6 },
    ],
    greenery: [
      { id: 'f-1945-tree-1', kind: 'tree', model: 'tree-1945', x: -5.6, z: 1.2, color: '#4a6b3a', accentColor: '#2c4328' },
      { id: 'f-1945-tree-2', kind: 'tree', model: 'tree-1945', x: 5.8, z: 1.4, color: '#547445', accentColor: '#2c4328' },
    ],
    crosswalks: true,
    crosswalkColor: '#d8d2c4',
  },
  '1965': {
    era: '1965',
    street: [
      { id: 'f-1965-lamp-1', kind: 'lamp', model: 'lamppost-sodium-1965', x: -3.6, z: 1.9, color: '#3c4a52', accentColor: '#ffd9a0' },
      { id: 'f-1965-lamp-2', kind: 'lamp', model: 'lamppost-sodium-1965', x: 0.2, z: 2.0, color: '#3c4a52', accentColor: '#ffd9a0' },
      { id: 'f-1965-lamp-3', kind: 'lamp', model: 'lamppost-sodium-1965', x: 4.0, z: 1.9, color: '#3c4a52', accentColor: '#ffd9a0' },
      { id: 'f-1965-traffic-1', kind: 'traffic_light', model: 'traffic-light-1965', x: -4.6, z: 3.4, color: '#1f2426', accentColor: '#c73a2a' },
      { id: 'f-1965-bench-1', kind: 'bench', model: 'bench-midcentury-1965', x: -2.4, z: 2.6, color: '#d7cdb4', accentColor: '#3d6a72' },
      { id: 'f-1965-hydrant-1', kind: 'hydrant', model: 'hydrant-1965', x: -1.2, z: 2.15, color: '#b23a2a', accentColor: '#7f2c20' },
      { id: 'f-1965-bin-1', kind: 'bin', model: 'bin-wire-1965', x: 2.1, z: 2.7, color: '#4a535a', accentColor: '#7a848b' },
      { id: 'f-1965-busstop-1', kind: 'bus_stop', model: 'busstop-1965', x: 5.0, z: 2.75, color: '#3f4a52', accentColor: '#e8b23a' },
      { id: 'f-1965-payphone-1', kind: 'payphone', model: 'payphone-1965', x: 0.6, z: 2.35, color: '#22272b', accentColor: '#8a9299' },
      { id: 'f-1965-payphone-2', kind: 'payphone', model: 'payphone-1965', x: -3.0, z: 2.4, color: '#22272b', accentColor: '#8a9299' },
      { id: 'f-1965-newsstand-1', kind: 'newsstand', model: 'newsstand-1965', x: 4.2, z: 2.6, color: '#5a6670', accentColor: '#d8e0e4', rotation: -0.6 },
    ],
    greenery: [
      { id: 'f-1965-tree-1', kind: 'tree', model: 'tree-1965', x: -5.6, z: 1.2, color: '#5d7b3f', accentColor: '#a8332e' },
      { id: 'f-1965-tree-2', kind: 'tree', model: 'tree-1965', x: 5.8, z: 1.4, color: '#5d7b3f', accentColor: '#a8332e' },
    ],
    crosswalks: true,
    crosswalkColor: '#dcd8c8',
  },
  '1985': {
    era: '1985',
    street: [
      { id: 'f-1985-lamp-1', kind: 'lamp', model: 'lamppost-cobra-1985', x: -3.6, z: 1.9, color: '#2c333a', accentColor: '#ffb347' },
      { id: 'f-1985-lamp-2', kind: 'lamp', model: 'lamppost-cobra-1985', x: 0.2, z: 2.0, color: '#2c333a', accentColor: '#ffb347' },
      { id: 'f-1985-lamp-3', kind: 'lamp', model: 'lamppost-cobra-1985', x: 4.0, z: 1.9, color: '#2c333a', accentColor: '#ffb347' },
      { id: 'f-1985-traffic-1', kind: 'traffic_light', model: 'traffic-light-1985', x: -4.6, z: 3.4, color: '#181c20', accentColor: '#c73a2a' },
      { id: 'f-1985-bench-1', kind: 'bench', model: 'bench-metal-1985', x: -2.4, z: 2.6, color: '#39424a', accentColor: '#c0392b' },
      { id: 'f-1985-hydrant-1', kind: 'hydrant', model: 'hydrant-1985', x: -1.2, z: 2.15, color: '#d33b2b', accentColor: '#9c2418' },
      { id: 'f-1985-bin-1', kind: 'bin', model: 'bin-metal-1985', x: 2.1, z: 2.7, color: '#3a4249', accentColor: '#e8b23a' },
      { id: 'f-1985-busstop-1', kind: 'bus_stop', model: 'busstop-1985', x: 5.0, z: 2.75, color: '#2b3338', accentColor: '#e8b23a' },
      { id: 'f-1985-payphone-1', kind: 'payphone', model: 'payphone-1985', x: 0.6, z: 2.35, color: '#23292e', accentColor: '#4f9e52' },
      { id: 'f-1985-payphone-2', kind: 'payphone', model: 'payphone-1985', x: -3.0, z: 2.4, color: '#23292e', accentColor: '#4f9e52' },
      { id: 'f-1985-newsstand-1', kind: 'newsstand', model: 'newsstand-1985', x: 4.2, z: 2.6, color: '#6a3d2f', accentColor: '#e8c23a', rotation: -0.6 },
    ],
    greenery: [
      { id: 'f-1985-tree-1', kind: 'tree', model: 'tree-1985', x: -5.6, z: 1.2, color: '#4a6b3a', accentColor: '#528a4a' },
      { id: 'f-1985-planter-1', kind: 'planter', model: 'planter-1985', x: 5.8, z: 2.0, color: '#5c5f64', accentColor: '#4a7a3d' },
    ],
    crosswalks: true,
    crosswalkColor: '#d8d6cc',
  },
  '2005': {
    era: '2005',
    street: [
      { id: 'f-2005-lamp-1', kind: 'lamp', model: 'lamppost-led-2005', x: -3.6, z: 1.9, color: '#4a5158', accentColor: '#eef4ff' },
      { id: 'f-2005-lamp-2', kind: 'lamp', model: 'lamppost-led-2005', x: 0.2, z: 2.0, color: '#4a5158', accentColor: '#eef4ff' },
      { id: 'f-2005-lamp-3', kind: 'lamp', model: 'lamppost-led-2005', x: 4.0, z: 1.9, color: '#4a5158', accentColor: '#eef4ff' },
      { id: 'f-2005-traffic-1', kind: 'traffic_light', model: 'traffic-light-2005', x: -4.6, z: 3.4, color: '#2e3338', accentColor: '#3fa24f' },
      { id: 'f-2005-bench-1', kind: 'bench', model: 'bench-modern-2005', x: -2.4, z: 2.6, color: '#5d6b5f', accentColor: '#39413b' },
      { id: 'f-2005-hydrant-1', kind: 'hydrant', model: 'hydrant-2005', x: -1.2, z: 2.15, color: '#e23f2e', accentColor: '#a6281b' },
      { id: 'f-2005-bin-1', kind: 'bin', model: 'bin-plastic-2005', x: 2.1, z: 2.7, color: '#355c3c', accentColor: '#8a949c' },
      { id: 'f-2005-busstop-1', kind: 'bus_stop', model: 'busstop-2005', x: 5.0, z: 2.75, color: '#4a6a7a', accentColor: '#cfe6f2' },
      { id: 'f-2005-newsstand-1', kind: 'newsstand', model: 'newsstand-2005', x: 4.2, z: 2.6, color: '#6c757c', accentColor: '#2f6fbf', rotation: -0.6 },
    ],
    greenery: [
      { id: 'f-2005-tree-1', kind: 'tree', model: 'tree-2005', x: -5.6, z: 1.2, color: '#3f6b3a', accentColor: '#2f4f2c' },
      { id: 'f-2005-planter-1', kind: 'planter', model: 'planter-2005', x: 5.8, z: 2.0, color: '#7a8085', accentColor: '#3a6b4a' },
    ],
    crosswalks: true,
    crosswalkColor: '#c8ccd2',
  },
  '2025': {
    era: '2025',
    street: [
      { id: 'f-2025-lamp-1', kind: 'lamp', model: 'lamppost-smart-2025', x: -3.6, z: 1.9, color: '#22262e', accentColor: '#7fd4e8' },
      { id: 'f-2025-lamp-2', kind: 'lamp', model: 'lamppost-smart-2025', x: 0.2, z: 2.0, color: '#22262e', accentColor: '#7fd4e8' },
      { id: 'f-2025-lamp-3', kind: 'lamp', model: 'lamppost-smart-2025', x: 4.0, z: 1.9, color: '#22262e', accentColor: '#7fd4e8' },
      { id: 'f-2025-traffic-1', kind: 'traffic_light', model: 'traffic-light-2025', x: -4.6, z: 3.4, color: '#181c22', accentColor: '#3fa24f' },
      { id: 'f-2025-bench-1', kind: 'bench', model: 'bench-smart-2025', x: -2.4, z: 2.6, color: '#3a4048', accentColor: '#52c2a4' },
      { id: 'f-2025-hydrant-1', kind: 'hydrant', model: 'hydrant-2025', x: -1.2, z: 2.15, color: '#e23f2e', accentColor: '#c8d2d8' },
      { id: 'f-2025-bin-1', kind: 'bin', model: 'bin-split-2025', x: 2.1, z: 2.7, color: '#2f6f4a', accentColor: '#2f4a90' },
      { id: 'f-2025-busstop-1', kind: 'bus_stop', model: 'busstop-2025', x: 5.0, z: 2.75, color: '#333a42', accentColor: '#8fd4e8' },
      { id: 'f-2025-newsstand-1', kind: 'newsstand', model: 'newsstand-2025', x: 4.2, z: 2.6, color: '#d8dee4', accentColor: '#52c2a4', rotation: -0.6 },
    ],
    greenery: [
      { id: 'f-2025-tree-1', kind: 'tree', model: 'tree-2025', x: -5.6, z: 1.2, color: '#3f7d44', accentColor: '#2f5c34' },
      { id: 'f-2025-planter-1', kind: 'planter', model: 'planter-2025', x: 5.8, z: 2.0, color: '#8a9096', accentColor: '#3a7d4a' },
    ],
    crosswalks: true,
    crosswalkColor: '#c2c8cc',
  },
};

export const AMBIENT_SPECS: Record<EraId, AmbientEraSpec[]> = {
  '1945': [
    { id: 'a-1945-pigeons', kind: 'pigeons', count: 7, intensity: 0.9, color: '#6b6f75', accentColor: '#3d4145', altitude: 1.4 },
    { id: 'a-1945-steam', kind: 'steam', count: 26, intensity: 0.55, color: '#e4e0d2', accentColor: '#bdb6a4', altitude: 0.3 },
    { id: 'a-1945-smoke', kind: 'chimney_smoke', count: 18, intensity: 0.5, color: '#6b6254', accentColor: '#9a8f7c', altitude: 3.2 },
    { id: 'a-1945-dust', kind: 'dust', count: 14, intensity: 0.3, color: '#8f8470', accentColor: '#6e6454', altitude: 0.1 },
  ],
  '1965': [
    { id: 'a-1965-pigeons', kind: 'pigeons', count: 8, intensity: 0.9, color: '#6f7378', accentColor: '#404549', altitude: 1.4 },
    { id: 'a-1965-steam', kind: 'steam', count: 20, intensity: 0.45, color: '#ece9de', accentColor: '#cac5b6', altitude: 0.3 },
    { id: 'a-1965-smoke', kind: 'chimney_smoke', count: 16, intensity: 0.4, color: '#7a7266', accentColor: '#a39a8a', altitude: 3.4 },
    { id: 'a-1965-leaves', kind: 'leaves', count: 16, intensity: 0.35, color: '#b09a55', accentColor: '#7d6b3a', altitude: 0.2 },
  ],
  '1985': [
    { id: 'a-1985-pigeons', kind: 'pigeons', count: 9, intensity: 0.95, color: '#5f6468', accentColor: '#33373a', altitude: 1.4 },
    { id: 'a-1985-steam', kind: 'steam', count: 22, intensity: 0.5, color: '#d8d4c8', accentColor: '#b0aa9c', altitude: 0.3 },
    { id: 'a-1985-smoke', kind: 'chimney_smoke', count: 14, intensity: 0.38, color: '#6a7078', accentColor: '#9aa0a8', altitude: 3.6 },
    { id: 'a-1985-dust', kind: 'dust', count: 20, intensity: 0.4, color: '#a89c88', accentColor: '#7d7362', altitude: 0.1 },
  ],
  '2005': [
    { id: 'a-2005-pigeons', kind: 'pigeons', count: 4, intensity: 0.5, color: '#6f7479', accentColor: '#414649', altitude: 1.4 },
    { id: 'a-2005-leaves', kind: 'leaves', count: 18, intensity: 0.4, color: '#9a8a4a', accentColor: '#6e6234', altitude: 0.2 },
  ],
  '2025': [
    { id: 'a-2025-pigeons', kind: 'pigeons', count: 5, intensity: 0.55, color: '#7a7f84', accentColor: '#494e52', altitude: 1.4 },
    { id: 'a-2025-leaves', kind: 'leaves', count: 22, intensity: 0.45, color: '#8fa05a', accentColor: '#5f7136', altitude: 0.2 },
  ],
};

/** Per-era scene state stubs — identical anchor contracts, declarative content. */
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
    storefronts: STOREFRONT_SPECS['1945'],
    ads: AD_SPECS['1945'],
    streetFurniture: [STREET_FURNITURE_SPECS['1945']],
    ambient: AMBIENT_SPECS['1945'],
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
    storefronts: STOREFRONT_SPECS['1965'],
    ads: AD_SPECS['1965'],
    streetFurniture: [STREET_FURNITURE_SPECS['1965']],
    ambient: AMBIENT_SPECS['1965'],
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
    storefronts: STOREFRONT_SPECS['1985'],
    ads: AD_SPECS['1985'],
    streetFurniture: [STREET_FURNITURE_SPECS['1985']],
    ambient: AMBIENT_SPECS['1985'],
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
    storefronts: STOREFRONT_SPECS['2005'],
    ads: AD_SPECS['2005'],
    streetFurniture: [STREET_FURNITURE_SPECS['2005']],
    ambient: AMBIENT_SPECS['2005'],
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
    storefronts: STOREFRONT_SPECS['2025'],
    ads: AD_SPECS['2025'],
    streetFurniture: [STREET_FURNITURE_SPECS['2025']],
    ambient: AMBIENT_SPECS['2025'],
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