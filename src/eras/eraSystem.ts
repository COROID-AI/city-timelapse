/**
 * eraSystem.ts — City era timelapse domain contract (1945–2025).
 *
 * This module is the SINGLE SOURCE OF TRUTH for the five city eras. Every
 * content layer (buildings, vehicles, storefronts, advertisements, pedestrian
 * outfits, atmosphere, audio/SFX) reads era definitions from here READ-ONLY so
 * that a timeline selection transforms every aspect of the block in lockstep.
 *
 * The module exports:
 *  - `EraSystem` — a clock-driven transition state machine plus event bus.
 *  - `ERAS` / `ERA_DEFINITIONS` — the frozen five-era registry in slider order.
 *
 * Transition API contract:
 *  - `sys.subscribe('era-select', cb)`      — fired when `selectEra` starts.
 *  - `sys.subscribe('era-transition', cb)`  — fired with eased progress 0..1 as
 *    the integration drives the clock via `update(deltaSeconds)`.
 *  - `sys.subscribe('era-settled', cb)`     — fired once the tween completes.
 *  - `sys.selectEra(year)`                  — starts/retargets the tween;
 *    selecting the already-active era is a no-op.
 *  - `sys.update(deltaSeconds)`             — the integration owns timing
 *    (e.g. requestAnimationFrame) and advances the eased tween.
 *  - `sys.getState()`                       — `{ current, next, progress, phase }`.
 *
 * Era ids are exactly `1945 | 1965 | 1985 | 2005 | 2025`. The README's 2055
 * mention is intentionally not an era: only the five stops are valid.
 */

/** The five era years, in slider order. */
export type EraId = 1945 | 1965 | 1985 | 2005 | 2025;

/** Default tween duration used by `EraSystem` unless overridden (seconds). */
export const TRANSITION_DURATION_SECONDS = 2;

/* ------------------------------------------------------------------ *
 * Era data model — every field is data consumed by content layers.
 * ------------------------------------------------------------------ */

/** Thematic color palette for the whole block in an era. */
export interface EraPalette {
  /** Building facade color set (walls, towers, apartments). */
  readonly buildings: readonly string[];
  /** Trim / accent color set (awnings, frames, chrome, LED strips). */
  readonly accents: readonly string[];
  /** Signage color set used by storefronts and billboards. */
  readonly signs: readonly string[];
  /** Sky color at the era's default time of day. */
  readonly sky: string;
  /** Atmospheric haze tint. */
  readonly haze: string;
  /** Street / ground surface color. */
  readonly ground: string;
  /** Dominant artificial light color (street lamps, lit windows). */
  readonly light: string;
}

/** Atmosphere and lighting parameters for an era. */
export interface EraAtmosphere {
  readonly timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  readonly weather: 'clear' | 'overcast' | 'hazy';
  /** Fog density 0..1. */
  readonly fogDensity: number;
  readonly fogColor: string;
  /** Sun intensity 0..1 (night scenes are dim). */
  readonly sunIntensity: number;
  readonly sunColor: string;
  /** Ambient intensity 0..1. */
  readonly ambientIntensity: number;
  readonly ambientColor: string;
  /** Color saturation 0..1. */
  readonly saturation: number;
  /** Scene contrast 0..~1.5. */
  readonly contrast: number;
  /** Bloom / glow amount 0..1. */
  readonly bloom: number;
  /** Correlated color temperature of the era's artificial light (Kelvin). */
  readonly lightTemperatureK: number;
  /** Street-lighting technology label for the era. */
  readonly lightTechnology:
    | 'incandescent'
    | 'fluorescent'
    | 'sodium-vapor'
    | 'metal-halide'
    | 'led';
  /** Shadow softness 0..1. */
  readonly shadowSoftness: number;
  /** Sun elevation above horizon in degrees. */
  readonly sunElevationDeg: number;
}

/** Vehicle fleet parameters for an era. */
export interface EraVehicles {
  /** Vehicle type keys in traffic (in roughly descending frequency). */
  readonly types: readonly string[];
  /** Vehicle type keys that appear parked along the street. */
  readonly parkedTypes: readonly string[];
  /** Vehicle paint color set. */
  readonly colors: readonly string[];
  /** Traffic density 0..1. */
  readonly density: number;
  /** Headlight color for the era. */
  readonly headlightColor: string;
  /** Powertrain mix used by the audio layer. */
  readonly power: 'gasoline' | 'electric';
  /** Street infrastructure / feature keys (trolley tracks, bike lane...). */
  readonly features: readonly string[];
}

/** Pedestrian outfit set for an era. */
export interface EraOutfits {
  /** Garment style keys (fedora-overcoat, windbreaker, athleisure...). */
  readonly styles: readonly string[];
  /** Clothing color palette. */
  readonly palette: readonly string[];
  /** Accessory keys (hats, walkmans, flip phones, earbuds...). */
  readonly accessories: readonly string[];
  /** Hand-held prop keys (newspaper, boombox, coffee cup...). */
  readonly props: readonly string[];
}

/** Storefront theme for an era. */
export interface EraStorefronts {
  /** Signage technology painted on / attached to the facade. */
  readonly signage: 'painted' | 'neon' | 'crt' | 'backlit' | 'led';
  /** Facade material treatment. */
  readonly facade: 'brick' | 'tile-chrome' | 'glass-metal' | 'curtain-wall' | 'glass-tower';
  /** Window-display density 0..1. */
  readonly windowDensity: number;
  /** Awning color palette. */
  readonly awningColors: readonly string[];
  /** Typical shop type keys for the era. */
  readonly shopTypes: readonly string[];
}

/** Billboard / advertisement content for an era. */
export interface EraAdvertisements {
  /** Display technology used by the era's advertisements. */
  readonly technology:
    | 'painted-poster'
    | 'neon-sign'
    | 'crt-billboard'
    | 'backlit-sign'
    | 'giant-led';
  /** Whether ad content animates (CRT flicker, LED sequencing). */
  readonly animated: boolean;
  /** Slogan/copy strings to render on billboards and signs. */
  readonly copy: readonly string[];
  /** Art color palette for ad panels. */
  readonly colors: readonly string[];
}

/** SFX / audio mix parameters for an era. */
export interface EraSfx {
  /** Ambient soundscape key consumed by the audio layer. */
  readonly ambient: string;
  /** Traffic noise level 0..1. */
  readonly trafficLevel: number;
  /** Pedestrian crowd level 0..1. */
  readonly crowdLevel: number;
  /** Reverb amount 0..1 (harder at night under neon canyons). */
  readonly reverb: number;
  /** Tone / fidelity character of the era's soundscape. */
  readonly tone: 'lo-fi' | 'analog-warm' | 'analog-harsh' | 'clean-digital' | 'digital-bright';
  /** Electrical hum key (trolley wires, neon buzz, CRT whine, LED drivers). */
  readonly electrical: string;
  /** Background music style key. */
  readonly music: string;
  /** Master bed level 0..1. */
  readonly masterLevel: number;
}

/** One full era definition — all period detail as data, never prose. */
export interface EraDefinition {
  readonly id: EraId;
  /** Slider label, e.g. "1945". */
  readonly label: string;
  /** Short theme title, e.g. "Post-War Austerity". */
  readonly title: string;
  readonly palette: EraPalette;
  readonly atmosphere: EraAtmosphere;
  readonly vehicles: EraVehicles;
  readonly outfits: EraOutfits;
  readonly storefronts: EraStorefronts;
  readonly advertisements: EraAdvertisements;
  readonly sfx: EraSfx;
}

/* ------------------------------------------------------------------ *
 * The five era definitions.
 * ------------------------------------------------------------------ */

const era1945: EraDefinition = {
  id: 1945,
  label: '1945',
  title: 'Post-War Austerity',
  palette: {
    buildings: ['#8e6f57', '#7d6250', '#9c7c62', '#6b5546'],
    accents: ['#4f4438', '#8a7a68', '#b0a18a', '#5a4a3c'],
    signs: ['#c0562f', '#3f5b7c', '#6f7f4a', '#b08a3a'],
    sky: '#a9a39a',
    haze: '#c4bfb4',
    ground: '#5d564e',
    light: '#ffcf9a',
  },
  atmosphere: {
    timeOfDay: 'dusk',
    weather: 'overcast',
    fogDensity: 0.16,
    fogColor: '#b9b4a9',
    sunIntensity: 0.55,
    sunColor: '#ffd9a8',
    ambientIntensity: 0.75,
    ambientColor: '#cdc4b4',
    saturation: 0.5,
    contrast: 0.85,
    bloom: 0.15,
    lightTemperatureK: 2600,
    lightTechnology: 'incandescent',
    shadowSoftness: 0.65,
    sunElevationDeg: 14,
  },
  vehicles: {
    types: ['sedan-1940', 'pickup-truck', 'delivery-van'],
    parkedTypes: ['sedan-1940', 'pickup-truck'],
    colors: ['#3c382f', '#5b4f3d', '#71604a', '#2c2a26', '#8a7d6a'],
    density: 0.25,
    headlightColor: '#ffd9a1',
    power: 'gasoline',
    features: ['trolley-tracks', 'cobblestone'],
  },
  outfits: {
    styles: ['fedora-overcoat', 'wool-suit', 'printed-dress', 'work-trousers'],
    palette: ['#5b4a3e', '#8a8578', '#a49a8a', '#3e3a34', '#6f655a'],
    accessories: ['fedora', 'newsboy-cap', 'gloves', 'brooch'],
    props: ['newspaper', 'umbrella', 'handbag', 'briefcase'],
  },
  storefronts: {
    signage: 'painted',
    facade: 'brick',
    windowDensity: 0.45,
    awningColors: ['#6d4c33', '#4a5a6e', '#7a5a3a'],
    shopTypes: ['general-store', 'bakery', 'butcher', 'tailor', 'pharmacy'],
  },
  advertisements: {
    technology: 'painted-poster',
    animated: false,
    copy: ['BUY-WAR-BONDS', 'VICTORY-GARDEN', 'RATION-CONSCIOUS', 'SMILE-CAMPAIGN'],
    colors: ['#c0562f', '#3f5b7c', '#6f7f4a', '#b08a3a', '#e4dcc8'],
  },
  sfx: {
    ambient: 'street-lofi',
    trafficLevel: 0.3,
    crowdLevel: 0.3,
    reverb: 0.25,
    tone: 'lo-fi',
    electrical: 'trolley-wire-hum',
    music: 'wartime-swing',
    masterLevel: 0.82,
  },
};

const era1965: EraDefinition = {
  id: 1965,
  label: '1965',
  title: 'Mid-Century Modern',
  palette: {
    buildings: ['#f2d9c9', '#cfe0e3', '#e9dfc4', '#dccad8', '#e8e3da'],
    accents: ['#c9ced6', '#dfe3e8', '#b0b7c0', '#a9b7c2'],
    signs: ['#f04e5a', '#3ed0e8', '#f7c948', '#8fe07a'],
    sky: '#7fb8d8',
    haze: '#cfe6f0',
    ground: '#5b5f5a',
    light: '#eaf6ff',
  },
  atmosphere: {
    timeOfDay: 'day',
    weather: 'clear',
    fogDensity: 0.06,
    fogColor: '#d8ecf4',
    sunIntensity: 1.05,
    sunColor: '#fff2d8',
    ambientIntensity: 0.9,
    ambientColor: '#e6f2f8',
    saturation: 0.95,
    contrast: 0.95,
    bloom: 0.3,
    lightTemperatureK: 6000,
    lightTechnology: 'fluorescent',
    shadowSoftness: 0.35,
    sunElevationDeg: 48,
  },
  vehicles: {
    types: ['tailfin', 'beetle', 'station-wagon', 'convertible'],
    parkedTypes: ['tailfin', 'beetle'],
    colors: ['#f2c9b8', '#bfd9e4', '#e8dcc2', '#d8c9d9', '#e9e6df'],
    density: 0.45,
    headlightColor: '#fff4d9',
    power: 'gasoline',
    features: ['chrome-trim', 'gas-station-everywhere'],
  },
  outfits: {
    styles: ['tailored-suit', 'pencil-dress', 'sweater-set', 'trench-coat'],
    palette: ['#f6c9c0', '#cfe3ec', '#f2e3c4', '#d8c9e8', '#2a2a2e'],
    accessories: ['pillbox-hat', 'gloves', 'pearls', 'tie'],
    props: ['camera', 'handbag', 'newspaper', 'umbrella'],
  },
  storefronts: {
    signage: 'neon',
    facade: 'tile-chrome',
    windowDensity: 0.7,
    awningColors: ['#f2c9b8', '#cfe0e9', '#f7e3b2', '#e8c9d9'],
    shopTypes: ['diner', 'department-store', 'record-shop', 'barber', 'bakery'],
  },
  advertisements: {
    technology: 'neon-sign',
    animated: false,
    copy: ['NEON-DINER', 'MOTEL-VACANCY', 'COLA-TIME', 'GAS-OPEN-LATE'],
    colors: ['#f04e5a', '#3ed0e8', '#f7c948', '#8fe07a', '#f2f7fa'],
  },
  sfx: {
    ambient: 'boulevard-warm',
    trafficLevel: 0.45,
    crowdLevel: 0.5,
    reverb: 0.35,
    tone: 'analog-warm',
    electrical: 'neon-buzz',
    music: 'easy-listening',
    masterLevel: 0.85,
  },
};

const era1985: EraDefinition = {
  id: 1985,
  label: '1985',
  title: 'Neon-Soaked Night',
  palette: {
    buildings: ['#232b38', '#303b4d', '#1d232d', '#3c4754'],
    accents: ['#f43d7f', '#3dd2f0', '#f2c938', '#a64dff', '#53e8a8'],
    signs: ['#ff2d6f', '#00e5ff', '#ffd23f', '#ff6b35', '#a64dff'],
    sky: '#141b33',
    haze: '#2a2140',
    ground: '#2c2c34',
    light: '#ffab3d',
  },
  atmosphere: {
    timeOfDay: 'night',
    weather: 'clear',
    fogDensity: 0.18,
    fogColor: '#241b3a',
    sunIntensity: 0.15,
    sunColor: '#ffe9b8',
    ambientIntensity: 0.35,
    ambientColor: '#27325c',
    saturation: 1.0,
    contrast: 1.15,
    bloom: 0.85,
    lightTemperatureK: 2000,
    lightTechnology: 'sodium-vapor',
    shadowSoftness: 0.5,
    sunElevationDeg: 6,
  },
  vehicles: {
    types: ['boxy-sedan', 'taxi', 'cargo-van', 'hatchback'],
    parkedTypes: ['boxy-sedan', 'hatchback'],
    colors: ['#3a4348', '#d8c21f', '#8b2434', '#33424c', '#5c6064'],
    density: 0.65,
    headlightColor: '#fff6da',
    power: 'gasoline',
    features: ['neon-district', 'night-shifts'],
  },
  outfits: {
    styles: ['windbreaker', 'workout-gear', 'neon-tee', 'denim-jacket'],
    palette: ['#f43d7f', '#3dd2f0', '#f2c938', '#53e8a8', '#23252a'],
    accessories: ['walkman', 'headband', 'sunglasses', 'fanny-pack'],
    props: ['boombox', 'grocery-bag', 'camera', 'umbrella'],
  },
  storefronts: {
    signage: 'neon',
    facade: 'glass-metal',
    windowDensity: 0.8,
    awningColors: ['#f43d7f', '#3dd2f0', '#f2c938', '#23252a'],
    shopTypes: ['video-rental', 'arcade', 'pizza-parlor', 'electronics', 'dry-cleaner'],
  },
  advertisements: {
    technology: 'crt-billboard',
    animated: true,
    copy: ['TIME-TO-PLAY', 'SODA-BLAST', 'CITY-FEVER', 'MIDNIGHT-MOVIES'],
    colors: ['#ff2d6f', '#00e5ff', '#ffd23f', '#39ff88'],
  },
  sfx: {
    ambient: 'night-city-hum',
    trafficLevel: 0.6,
    crowdLevel: 0.55,
    reverb: 0.7,
    tone: 'analog-harsh',
    electrical: 'neon-and-crt-whine',
    music: 'synth-pop',
    masterLevel: 0.9,
  },
};

const era2005: EraDefinition = {
  id: 2005,
  label: '2005',
  title: 'Early Digital',
  palette: {
    buildings: ['#9fb4c4', '#7d93a8', '#b3c3d0', '#8ba0b2', '#c6cfd8'],
    accents: ['#2f9aa5', '#3aa6b0', '#e8f2f6', '#a8c3cf'],
    signs: ['#1f8fc4', '#2ba6d2', '#e0f6ff', '#ff9f1c'],
    sky: '#a3c8de',
    haze: '#c8e2ee',
    ground: '#6b6f74',
    light: '#e3f6ff',
  },
  atmosphere: {
    timeOfDay: 'day',
    weather: 'hazy',
    fogDensity: 0.12,
    fogColor: '#c8dce8',
    sunIntensity: 0.85,
    sunColor: '#ffe6c8',
    ambientIntensity: 0.85,
    ambientColor: '#dceef6',
    saturation: 0.75,
    contrast: 1.0,
    bloom: 0.35,
    lightTemperatureK: 4300,
    lightTechnology: 'metal-halide',
    shadowSoftness: 0.45,
    sunElevationDeg: 38,
  },
  vehicles: {
    types: ['suv', 'sedan', 'hatchback', 'minivan'],
    parkedTypes: ['suv', 'sedan'],
    colors: ['#5c636b', '#2f4d5c', '#a08a6b', '#6b7280', '#c9b9a2'],
    density: 0.7,
    headlightColor: '#ffffff',
    power: 'gasoline',
    features: ['parking-garages', 'highway-ramps'],
  },
  outfits: {
    styles: ['cargo-pants', 'low-rise-jeans', 'graphic-tee', 'track-jacket', 'polo'],
    palette: ['#7a8a99', '#4a5a68', '#c9b39a', '#8b5a6a', '#2c333a'],
    accessories: ['flip-phone', 'backpack', 'sunglasses', 'mp3-player'],
    props: ['flip-phone', 'backpack', 'coffee-cup', 'headphones'],
  },
  storefronts: {
    signage: 'backlit',
    facade: 'curtain-wall',
    windowDensity: 0.85,
    awningColors: ['#1f8fc4', '#2ba6d2', '#e0f6ff', '#ff9f1c'],
    shopTypes: ['coffee-shop', 'cell-phone-store', 'bank', 'fast-food', 'gym'],
  },
  advertisements: {
    technology: 'backlit-sign',
    animated: false,
    copy: ['DRINK-FRESH', 'BROADBAND-100', 'TALK-MINUTES', 'WEEKEND-SALE'],
    colors: ['#1f8fc4', '#2ba6d2', '#e0f6ff', '#ff9f1c'],
  },
  sfx: {
    ambient: 'avenue-digital',
    trafficLevel: 0.68,
    crowdLevel: 0.5,
    reverb: 0.45,
    tone: 'clean-digital',
    electrical: 'ventilation-hum',
    music: 'pop-rnb',
    masterLevel: 0.86,
  },
};

const era2025: EraDefinition = {
  id: 2025,
  label: '2025',
  title: 'LED Saturated',
  palette: {
    buildings: ['#a7c1d4', '#cfdde8', '#8fa8bd', '#c2cbd4', '#b7ccda'],
    accents: ['#00e5ff', '#ff2d6f', '#b6ff3d', '#ff9f1c', '#e8f7ff'],
    signs: ['#00e5ff', '#ff2d6f', '#7dffb0', '#ffd23f'],
    sky: '#4a9bd8',
    haze: '#9fd0ec',
    ground: '#3c4046',
    light: '#dceeff',
  },
  atmosphere: {
    timeOfDay: 'day',
    weather: 'clear',
    fogDensity: 0.08,
    fogColor: '#b8dff2',
    sunIntensity: 1.0,
    sunColor: '#fff3d6',
    ambientIntensity: 0.95,
    ambientColor: '#e8f6ff',
    saturation: 1.0,
    contrast: 1.05,
    bloom: 0.5,
    lightTemperatureK: 6500,
    lightTechnology: 'led',
    shadowSoftness: 0.3,
    sunElevationDeg: 46,
  },
  vehicles: {
    types: ['ev-sedan', 'ev-suv', 'e-scooter', 'electric-bus'],
    parkedTypes: ['ev-sedan', 'ev-suv'],
    colors: ['#cfe0ea', '#e8edf2', '#2a3b4a', '#9fd0e0', '#d9e3ea'],
    density: 0.75,
    headlightColor: '#ffffff',
    power: 'electric',
    features: ['bike-lane', 'ev-chargers', 'e-scooter-stations'],
  },
  outfits: {
    styles: ['athleisure', 'hoodie', 'baseball-cap', 'yoga-set', 'puffer-jacket'],
    palette: ['#3aa6c0', '#ffcf4d', '#2f9d8f', '#cfd6e0', '#1f2a33'],
    accessories: ['wireless-earbuds', 'smartphone', 'smart-watch', 'tote-bag'],
    props: ['smartphone', 'coffee-cup', 'tote-bag', 'delivery-bag'],
  },
  storefronts: {
    signage: 'led',
    facade: 'glass-tower',
    windowDensity: 0.9,
    awningColors: ['#00e5ff', '#ff2d6f', '#b6ff3d', '#ff9f1c'],
    shopTypes: ['coffee-lab', 'ghost-kitchen', 'bike-shop', 'tech-retail', 'scooter-rental'],
  },
  advertisements: {
    technology: 'giant-led',
    animated: true,
    copy: ['STREAM-EVERYTHING', 'EV-CHARGED', 'RIDE-NOW', 'FULLY-CHARGED'],
    colors: ['#00e5ff', '#ff2d6f', '#7dffb0', '#ffd23f', '#ffffff'],
  },
  sfx: {
    ambient: 'mega-city-digital',
    trafficLevel: 0.55,
    crowdLevel: 0.6,
    reverb: 0.5,
    tone: 'digital-bright',
    electrical: 'led-driver-hum',
    music: 'electronic',
    masterLevel: 0.88,
  },
};

/* ------------------------------------------------------------------ *
 * Registry — frozen, read-only, single source of truth.
 * ------------------------------------------------------------------ */

/** Recursively freezes a plain data value so layers cannot mutate the contract. */
function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') {
    return value as Readonly<T>;
  }
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value) as Readonly<T>;
  }
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value) as Readonly<T>;
}

/** The five era definitions in slider order, deeply frozen. */
export const ERA_DEFINITIONS: readonly EraDefinition[] = deepFreeze([
  era1945,
  era1965,
  era1985,
  era2005,
  era2025,
]);

/** The five era ids in slider order: `[1945, 1965, 1985, 2005, 2025]`. */
export const ERA_IDS: readonly EraId[] = deepFreeze(
  ERA_DEFINITIONS.map((era) => era.id),
);

/** Map of era id -> frozen definition. */
export const ERAS: Readonly<Record<EraId, EraDefinition>> = deepFreeze(
  Object.fromEntries(ERA_DEFINITIONS.map((era) => [era.id, era])) as Record<EraId, EraDefinition>,
);

/** True when `value` is one of the five era ids (rejects 2055 and friends). */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'number' && (ERA_IDS as readonly unknown[]).includes(value);
}

/** Returns the frozen definition for an era id; throws for unknown ids. */
export function getEraDefinition(id: EraId): EraDefinition {
  if (!isEraId(id)) {
    throw new Error(`getEraDefinition: unknown era ${String(id)}; known eras: ${ERA_IDS.join(', ')}`);
  }
  return ERAS[id];
}

/* ------------------------------------------------------------------ *
 * Transition state machine + event bus.
 * ------------------------------------------------------------------ */

/** Event names emitted by `EraSystem`. */
export const ERA_EVENT_NAMES = ['era-select', 'era-transition', 'era-settled'] as const;
export type EraEventName = (typeof ERA_EVENT_NAMES)[number];

/** Payload for `era-select`: `from` is the era the block is leaving. */
export interface EraSelectEvent {
  readonly from: EraId;
  readonly to: EraId;
}

/** Payload for `era-transition`: eased blend progress 0..1 toward `to`. */
export interface EraTransitionEvent {
  readonly from: EraId;
  readonly to: EraId;
  readonly progress: number;
}

/** Payload for `era-settled`: the block is fully `to`. */
export interface EraSettledEvent {
  readonly to: EraId;
}

/** Event name -> payload map. */
export interface EraEventMap {
  'era-select': EraSelectEvent;
  'era-transition': EraTransitionEvent;
  'era-settled': EraSettledEvent;
}

/** Listener signature for one era event. */
export type EraListener<E extends EraEventName> = (event: EraEventMap[E]) => void;

/** Snapshot of the transition state machine. */
export interface EraSystemState {
  /** The era the block currently represents (blend source while tweening). */
  readonly current: EraId;
  /** The destination era during a tween; `null` when settled. */
  readonly next: EraId | null;
  /** Eased blend progress 0..1 from `current` toward `next`; 0 when idle. */
  readonly progress: number;
  readonly phase: 'idle' | 'transitioning';
}

/**
 * Ease-in-out cubic curve, clamped to [0, 1]. `0 -> 0`, `0.5 -> 0.5`, `1 -> 1`.
 */
export function easeInOutCubic(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Clock-driven era transition state machine + event bus.
 *
 * The integration owns timing: call `update(deltaSeconds)` every frame and the
 * tween advances eased progress 0 -> 1, emitting `era-transition` events, then
 * `era-settled`. Selecting the already-active era (or the in-flight target) is
 * a no-op. Selecting a different era mid-tween retargets and restarts a fresh
 * eased tween from the current era.
 */
export class EraSystem {
  private readonly listeners: { [K in EraEventName]: Set<EraListener<K>> } = {
    'era-select': new Set(),
    'era-transition': new Set(),
    'era-settled': new Set(),
  };
  private readonly durationSeconds: number;
  private current: EraId;
  private next: EraId | null = null;
  private progress = 0;
  private elapsed = 0;
  private phase: 'idle' | 'transitioning' = 'idle';
  private disposed = false;

  constructor(initialEra: EraId = 1945, transitionDurationSeconds = TRANSITION_DURATION_SECONDS) {
    if (!isEraId(initialEra)) {
      throw new Error(`EraSystem: unknown initial era ${String(initialEra)}; known eras: ${ERA_IDS.join(', ')}`);
    }
    if (!Number.isFinite(transitionDurationSeconds) || transitionDurationSeconds <= 0) {
      throw new Error(
        `EraSystem: transitionDurationSeconds must be a positive finite number, got ${String(transitionDurationSeconds)}`,
      );
    }
    this.current = initialEra;
    this.durationSeconds = transitionDurationSeconds;
  }

  /** Snapshot of current/next/progress/phase. */
  getState(): EraSystemState {
    return {
      current: this.current,
      next: this.next,
      progress: this.progress,
      phase: this.phase,
    };
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   *
   * @example
   * const off = system.subscribe('era-transition', ({ from, to, progress }) => {
   *   blend(from, to, progress);
   * });
   * off(); // stop listening
   */
  subscribe<E extends EraEventName>(event: E, listener: EraListener<E>): () => void {
    this.assertNotDisposed();
    const listeners = this.listeners[event] as Set<EraListener<E>>;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /**
   * Start a transition toward `year`, or retarget an in-flight transition.
   * Emits `era-select` followed immediately by `era-transition` at progress 0.
   * A no-op (no events, no state change) when `year` is already active.
   */
  selectEra(year: EraId): void {
    this.assertNotDisposed();
    if (!isEraId(year)) {
      throw new Error(`selectEra: unknown era ${String(year)}; known eras: ${ERA_IDS.join(', ')}`);
    }
    if (year === this.current) return; // already fully on this era
    if (this.phase === 'transitioning' && year === this.next) return; // already heading there
    const from = this.current;
    this.next = year;
    this.elapsed = 0;
    this.progress = 0;
    this.phase = 'transitioning';
    this.emit('era-select', { from, to: year });
    this.emit('era-transition', { from, to: year, progress: 0 });
  }

  /**
   * Advance the tween clock by `deltaSeconds`. The integration (e.g. a
   * requestAnimationFrame loop) controls timing by when and how often it calls
   * this. No-op when settled or after `dispose()`.
   */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    const to = this.next;
    if (this.phase !== 'transitioning' || to === null) return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

    this.elapsed += deltaSeconds;
    const raw = Math.min(1, this.elapsed / this.durationSeconds);
    const eased = easeInOutCubic(raw);

    if (eased >= 1) {
      const from = this.current;
      this.emit('era-transition', { from, to, progress: 1 });
      this.current = to;
      this.next = null;
      this.elapsed = 0;
      this.progress = 0;
      this.phase = 'idle';
      this.emit('era-settled', { to });
      return;
    }

    if (eased > this.progress) {
      this.progress = eased;
      this.emit('era-transition', { from: this.current, to, progress: eased });
    }
  }

  /**
   * Clears the event bus. After disposal the system is inert: further
   * `subscribe`/`selectEra` calls throw and `update` becomes a no-op.
   */
  dispose(): void {
    this.disposed = true;
    for (const event of ERA_EVENT_NAMES) {
      (this.listeners[event] as Set<unknown>).clear();
    }
  }

  private emit<E extends EraEventName>(event: E, payload: EraEventMap[E]): void {
    const listeners = this.listeners[event] as Set<EraListener<E>>;
    // Snapshot so listeners can unsubscribe/emit during dispatch safely.
    for (const listener of Array.from(listeners)) {
      listener(payload);
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('EraSystem has been disposed and can no longer be used');
    }
  }
}