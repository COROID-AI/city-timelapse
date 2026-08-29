/**
 * Shared time-era contract and registry.
 *
 * This module defines the TimeEra vocabulary every downstream task uses:
 * era-data (src/data/eras), environment, buildings, props, vehicles,
 * pedestrians, and UI all key their content off `EraId` / `EraSpec` and
 * register their per-era modules under `getEraSpec()`. It also defines the
 * `TimeEra` dataset contract that every era-data file
 * (src/data/eras/<year>.ts) conforms to: a single pure-data description of
 * the city block for one year, consumed by the environment, buildings,
 * props, vehicles, pedestrians, audio, and camera subsystems.
 */

/**
 * Identifier for every representable time period in the timelapse.
 * Ordered from earliest to latest; the registry preserves this order.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Static description of a single era. */
export interface EraSpec {
  readonly id: EraId;
  /** Four-digit calendar year, e.g. 1965. */
  readonly year: number;
  /** Human-readable short label, e.g. "The Fifties". */
  readonly label: string;
  /** One-line summary used by the timeline UI and documentation. */
  readonly description: string;
}

/**
 * Ordered registry of all eras. Downstream tasks iterate this array to
 * register per-era content and must not add new eras here without extending
 * `EraId` first.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War',
    description: 'Brick and sepia: gas lamps, trolleys, and victory gardens.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century',
    description: 'Pastel storefronts, chrome cars, and neon signs.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Eighties',
    description: 'Concrete and glass towers, boxy cars, and bright sodium light.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Millennium',
    description: 'Modern glass, SUVs, digital billboards, and LED signage.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Now',
    description: 'Contemporary glass, electric cars, and full-screen LED media.',
  },
];

/** Immutable list of every `EraId` value, in chronological order. */
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((era) => era.id);

/** Returns the spec for a given era id (throws for unknown ids). */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}

/**
 * --- TimeEra dataset contract ----------------------------------------------
 *
 * Each era-data file (src/data/eras/<year>.ts) exports one `TimeEra`
 * describing the city block for that year. The dataset is **data only**: it
 * carries palettes, identifiers, text, quantities, and one camera vantage
 * point. Subsystems build geometry and materials FROM this data — no 3D
 * geometry is ever stored in a dataset.
 *
 * Asset references are plain paths resolved relative to a fixed root:
 *  - `AssetRef.path` resolves under `src/assets/`
 *  - `EraAudio.cues[].path` resolves under `src/audio/`
 */

/** RGB colour with channels in 0..1 (three.js `Color` compatible). */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Three-component vector used for the camera vantage point data. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** An asset referenced by a dataset, resolved relative to its owning root. */
export interface AssetRef {
  /** Repository-relative path under `src/assets/`, e.g. "textures/1945/warm-brick.svg". */
  readonly path: string;
  /** Short description of how the owning subsystem consumes the asset. */
  readonly usage: string;
}

/** Lighting, sky, fog, and atmosphere parameters for one era. */
export interface EraEnvironment {
  readonly timeOfDay: string;
  readonly weather: string;
  /** Colour grade applied to the final render, e.g. "muted-sepia". */
  readonly grading: string;
  readonly skyColor: RgbColor;
  readonly horizonColor: RgbColor;
  readonly fogColor: RgbColor;
  /** Fog distance range in world units (start must be < end). */
  readonly fogStart: number;
  readonly fogEnd: number;
  /** Suspended smoke/particulate layer (coal-smoke haze, smog, dust...). */
  readonly haze: {
    readonly color: RgbColor;
    /** 0..1 density of the haze layer. */
    readonly density: number;
    /** Particle count for the drifting haze sprites. */
    readonly particleCount: number;
  };
  /** Street-level lamp light: colour of the flame plus the pool it casts. */
  readonly streetlights: {
    readonly color: RgbColor;
    readonly poolColor: RgbColor;
    readonly intensity: number;
  };
  /** Dimmed or bright sun/sky key light. */
  readonly sun: {
    readonly color: RgbColor;
    readonly intensity: number;
    readonly elevationDeg: number;
    readonly azimuthDeg: number;
  };
  readonly ambientIntensity: number;
}

/** Per-era building configuration (facades, windows, rubble lots). */
export interface EraBuildings {
  readonly style: string;
  readonly material: string;
  readonly facadeTexture: AssetRef;
  readonly facadePalette: readonly RgbColor[];
  /** Building height range in world units, min..max. */
  readonly heightRange: readonly [number, number];
  readonly windows: {
    readonly color: RgbColor;
    readonly emissiveIntensity: number;
    /** True when windows carry wartime blackout shutters. */
    readonly blackoutShutters: boolean;
    /** Fraction of windows lit at night (0..1). */
    readonly litFraction: number;
    readonly shutterTexture: AssetRef;
  };
  /** Bombsite / demolition lots with temporary shoring. */
  readonly rubbleLots: {
    readonly count: number;
    readonly texture: AssetRef;
    readonly temporaryShoring: boolean;
  };
  /** Rooftop props built by the buildings subsystem, e.g. water towers. */
  readonly rooftopProps: readonly string[];
}

/** Painted (or enamel) sign mounted on a storefront. */
export interface EraStorefrontSign {
  readonly material: string;
  readonly text: string;
  readonly texture: AssetRef;
  readonly background: RgbColor;
  readonly foreground: RgbColor;
}

/** One storefront on the block (butcher, greengrocer, cobbler, newsstand...). */
export interface EraStorefront {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly sign: EraStorefrontSign;
  readonly windowDisplay: string;
}

/** One advertisement (painted masonry wall ad or enamel shop sign). */
export interface EraAdvertisement {
  readonly id: string;
  readonly kind: 'painted-masonry' | 'enamel-sign';
  readonly text: string;
  readonly placement: string;
  readonly texture: AssetRef;
  readonly colors: {
    readonly background: RgbColor;
    readonly foreground: RgbColor;
  };
}

/** One street/block prop (sandbags, ration posters, barrels, gas lamps...). */
export interface EraProp {
  readonly id: string;
  readonly kind: string;
  readonly count: number;
  readonly texture?: AssetRef;
  readonly note?: string;
}

/** One vehicle type present in the era (civilian car, jeep, lorry...). */
export interface EraVehicleType {
  readonly id: string;
  readonly kind: 'civilian' | 'military';
  readonly modelName: string;
  readonly count: number;
  readonly bodyPalette: readonly RgbColor[];
  /** Travel speed range in world units per second, min..max. */
  readonly speedRange: readonly [number, number];
  readonly note?: string;
}

/** One pedestrian outfit archetype (coat, hat, uniform...). */
export interface EraPedestrianOutfit {
  readonly id: string;
  readonly name: string;
  readonly category: 'civilian' | 'uniformed';
  readonly palette: readonly RgbColor[];
  readonly note: string;
}

/** Pedestrian population and outfit set for the era. */
export interface EraPedestrians {
  readonly totalCount: number;
  readonly outfits: readonly EraPedestrianOutfit[];
}

/** One audio cue referenced by the era, resolved relative to `src/audio/`. */
export interface EraAudioCue {
  readonly path: string;
  readonly category: 'ambient' | 'traffic' | 'event' | 'radio';
  readonly purpose: string;
}

/** Era-specific audio parameters for the procedural SFX mixer. */
export interface EraAudio {
  readonly trafficProfile: string;
  /** Expected one-shot event cues per minute (tram bells, horns...). */
  readonly eventChancePerMinute: number;
  readonly musicStyle: string;
  readonly cues: readonly EraAudioCue[];
}

/** Camera vantage point the timeline slider flies to for this era. */
export interface CameraVantagePoint {
  readonly id: string;
  readonly label: string;
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view in degrees (0..180). */
  readonly fov: number;
}

/**
 * Full per-era dataset. One value per era, authored in src/data/eras/<year>.ts.
 * Top-level fields are fixed by this contract — era-specific extras belong in
 * the per-subsystem payload fields above.
 */
export interface TimeEra {
  readonly id: EraId;
  readonly year: number;
  readonly label: string;
  readonly description: string;
  readonly environment: EraEnvironment;
  readonly buildings: EraBuildings;
  readonly vehicles: readonly EraVehicleType[];
  readonly storefronts: readonly EraStorefront[];
  readonly advertisements: readonly EraAdvertisement[];
  readonly props: readonly EraProp[];
  readonly pedestrians: EraPedestrians;
  readonly audio: EraAudio;
  readonly camera: CameraVantagePoint;
}

/** Runtime guard: true when a value has the required `TimeEra` shape. */
export function isTimeEra(value: unknown): value is TimeEra {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.year === 'number' &&
    typeof v.environment === 'object' &&
    typeof v.buildings === 'object' &&
    Array.isArray(v.vehicles) &&
    Array.isArray(v.storefronts) &&
    Array.isArray(v.advertisements) &&
    Array.isArray(v.props) &&
    typeof v.pedestrians === 'object' &&
    typeof v.audio === 'object' &&
    typeof v.camera === 'object'
  );
}