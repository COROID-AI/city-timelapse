/**
 * src/eras/types.ts
 *
 * Typed, declarative era data layer for the City Timelapse experience.
 *
 * This module is the single source of truth for everything that changes across
 * the five decades (1945 → 2025). Every value is plain serializable data
 * (strings, numbers, arrays, plain objects) so the registry can be serialized,
 * diffed, and consumed by procedural asset builders, the SFX mixer, the HUD,
 * and transition systems without any runtime coupling.
 *
 * Downstream consumers (city block layout, traffic system, pedestrians, HUD,
 * audio mixer, scene bootstrap) import from this file exclusively.
 */

// ---------------------------------------------------------------------------
// Core era identity
// ---------------------------------------------------------------------------

/**
 * The five selectable years on the timeline slider.
 * Ordered chronologically; the string value is also the display label.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/**
 * Readonly ordered tuple of every EraId. Using `as const` + a tuple type (not
 * a plain array) lets downstream code iterate with full element-type inference
 * while still being exhaustive.
 */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Numeric year extracted from EraId — convenience for arithmetic / sorting. */
export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025;

// ---------------------------------------------------------------------------
// Shared primitive types
// ---------------------------------------------------------------------------

/** Hex color string, e.g. "#aabbcc". Kept as a string for serializability. */
export type HexColor = string;

/** Normalised RGB triplet (0–1) for three.js material consumers. */
export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** A named palette swatch with both a hex (display/serialisation) and rgb (GL) form. */
export interface ColorSwatch {
  readonly name: string;
  readonly hex: HexColor;
  readonly rgb: RGB;
}

/**
 * Probability weight used for stochastic asset selection. Consumers normalise
 * the sum of weights within a list to derive actual probabilities.
 */
export type Weight = number;

/** A weighted option: the value plus a relative weight for randomised picking. */
export interface WeightedOption<T> {
  readonly value: T;
  readonly weight: Weight;
}

/**
 * Min/max numeric range (inclusive). Used for heights, counts, speeds, etc.
 * `min <= max` is an invariant the registry guarantees.
 */
export interface Range {
  readonly min: number;
  readonly max: number;
}

// ---------------------------------------------------------------------------
// Building era data
// ---------------------------------------------------------------------------

/** Architectural vocabulary for a single building archetype in an era. */
export interface BuildingArchetype {
  /** Stable identifier so asset builders can cache by key. */
  readonly id: string;
  /** Human label, e.g. "Art Deco mid-rise". */
  readonly label: string;
  /** Stories range (inclusive). Drives mesh height. */
  readonly stories: Range;
  /** Footprint width range in world units. */
  readonly width: Range;
  /** Footprint depth range in world units. */
  readonly depth: Range;
  /** Primary facade material colour. */
  readonly facadeColor: ColorSwatch;
  /** Secondary trim / cornice colour. */
  readonly trimColor: ColorSwatch;
  /** Roof style key consumed by the procedural builder. */
  readonly roofStyle:
    | 'flat'
    | 'flat-parapet'
    | 'gable'
    | 'mansard'
    | 'shed'
    | 'setback'
    | 'curved-glass';
  /** Window pattern key for the facade texture generator. */
  readonly windowPattern:
    | 'double-hung-grid'
    | 'casement-grid'
    | 'ribbon'
    | 'curtain-wall'
    | 'punched-opening'
    | 'floor-to-ceiling'
    | 'bay';
  /** Window glass tint colour. */
  readonly windowColor: ColorSwatch;
  /** Relative probability of this archetype appearing on the block. */
  readonly weight: Weight;
  /** Decorative detail flags the builder can act on. */
  readonly details: readonly string[];
}

export interface BuildingEraData {
  /** Overall skyline descriptor for HUD / transitions. */
  readonly skylineProfile: 'low-rise' | 'mid-rise' | 'mixed' | 'high-rise' | 'ultra-high-rise';
  /** Average block story height in world units per floor. */
  readonly floorHeight: number;
  /** Setback / step-back tendency for upper floors (0 = none, 1 = aggressive). */
  readonly setbackFactor: number;
  /** Street wall continuity (0 = gap-toothed, 1 = continuous frontage). */
  readonly streetWallContinuity: number;
  /** Material palette swatches available across archetypes. */
  readonly materialPalette: readonly ColorSwatch[];
  /** Archetypes the layout generator can place. */
  readonly archetypes: readonly BuildingArchetype[];
  /** Common sidewalk material. */
  readonly sidewalkColor: ColorSwatch;
  /** Street surface colour. */
  readonly roadColor: ColorSwatch;
}

// ---------------------------------------------------------------------------
// Vehicle era data
// ---------------------------------------------------------------------------

export interface VehicleArchetype {
  readonly id: string;
  readonly label: string;
  /** Body shape key for the procedural mesh builder. */
  readonly bodyStyle:
    | 'sedan-rounded'
    | 'sedan-boxy'
    | 'roadster'
    | 'wagon'
    | 'muscle'
    | 'hatchback'
    | 'suv'
    | 'minivan'
    | 'pickup'
    | 'delivery-van'
    | 'semi-truck'
    | 'bus'
    | 'tram'
    | 'electric-crossover'
    | 'self-driving-pod';
  readonly length: Range;
  readonly width: Range;
  readonly height: Range;
  readonly bodyColor: ColorSwatch;
  /** Wheel count (cars=4, semi=10, etc.). */
  readonly wheels: number;
  /** Top speed in world units / second. */
  readonly topSpeed: Range;
  /** Relative spawn weight on the road network. */
  readonly weight: Weight;
  readonly details: readonly string[];
}

export interface VehicleEraData {
  /** How busy the streets are (0 = empty, 1 = gridlock). */
  readonly trafficDensity: number;
  /** Max concurrent vehicles on the block. */
  readonly maxConcurrent: number;
  /** Lane discipline / directionality. */
  readonly laneDirection: 'right' | 'left';
  /** Archetypes the traffic system can spawn. */
  readonly archetypes: readonly VehicleArchetype[];
  /** Dominant body-colour palette. */
  readonly colorPalette: readonly ColorSwatch[];
  /** Headlight colour. */
  readonly headlightColor: ColorSwatch;
  /** Whether electric / silent vehicles are present. */
  readonly electricRatio: number;
}

// ---------------------------------------------------------------------------
// Storefront era data
// ---------------------------------------------------------------------------

export interface StorefrontArchetype {
  readonly id: string;
  readonly label: string;
  /** Business category for signage generation. */
  readonly businessType:
    | 'diner'
    | 'barbershop'
    | 'grocer'
    | 'drugstore'
    | 'tailor'
    | 'bank'
    | 'hardware'
    | 'bakery'
    | 'cafe'
    | 'electronics'
    | 'convenience'
    | 'fast-food'
    | 'boutique'
    | 'phone-repair'
    | 'co-working'
    | 'pharmacy'
    | 'gallery'
    | 'bookstore';
  readonly awningColor: ColorSwatch;
  readonly signStyle:
    | 'painted-gold-leaf'
    | 'neon'
    | 'backlit-plastic'
    | 'led'
    | 'digital-screen';
  readonly signColor: ColorSwatch;
  readonly windowDisplayColor: ColorSwatch;
  readonly weight: Weight;
  readonly details: readonly string[];
}

export interface StorefrontEraData {
  readonly groundFloorActivity: number;
  readonly archetypes: readonly StorefrontArchetype[];
  /** How many storefronts per block face. */
  readonly storefrontsPerFace: Range;
  /** Average awning height above sidewalk. */
  readonly awningHeight: number;
  /** Illumination level at night (0 = dark, 1 = blazing). */
  readonly nighttimeIllumination: number;
}

// ---------------------------------------------------------------------------
// Advertisement era data
// ---------------------------------------------------------------------------

export interface AdvertisementArchetype {
  readonly id: string;
  readonly label: string;
  readonly medium:
    | 'painted-wall'
    | 'printed-poster'
    | 'neon-sign'
    | 'backlit-billboard'
    | 'led-billboard'
    | 'holographic'
    | 'projection';
  /** Placement surface the layout system targets. */
  readonly placement: 'rooftop' | 'wall-side' | 'wall-facade' | 'freestanding' | 'vehicle';
  readonly primaryColor: ColorSwatch;
  readonly secondaryColor: ColorSwatch;
  /** Billboard face width in world units. */
  readonly size: Range;
  /** Animation intensity (0 = static, 1 = full motion video). */
  readonly animationIntensity: number;
  readonly weight: Weight;
  /** Slogan / brand word list for procedural text generation. */
  readonly slogans: readonly string[];
}

export interface AdvertisementEraData {
  readonly saturation: number;
  readonly archetypes: readonly AdvertisementArchetype[];
  /** Max billboards visible on the block at once. */
  readonly maxBillboards: number;
  /** Whether ads glow at night. */
  readonly nocturnalGlow: boolean;
}

// ---------------------------------------------------------------------------
// Pedestrian outfit era data
// ---------------------------------------------------------------------------

export interface OutfitArchetype {
  readonly id: string;
  readonly label: string;
  /** Silhouette key for the pedestrian mesh builder. */
  readonly silhouette:
    | 'zoot'
    | 'suit'
    | 'swing-dress'
    | 'housewife'
    | 'greaser'
    | 'mod'
    | 'minidress'
    | 'peacock'
    | 'power-suit'
    | 'tracksuit'
    | 'acid-wash'
    | 'preppy'
    | 'bootcut-jeans'
    | 'streetwear'
    | 'hipster'
    | 'athleisure'
    | 'techwear'
    | 'smart-casual';
  readonly topColor: ColorSwatch;
  readonly bottomColor: ColorSwatch;
  /** Headwear key. */
  readonly headwear: 'none' | 'fedora' | 'cap' | 'beanie' | 'headband' | 'helmet' | 'sunhat' | 'hood' | 'visor';
  readonly headwearColor: ColorSwatch;
  readonly weight: Weight;
  readonly details: readonly string[];
}

export interface PedestrianOutfitEraData {
  /** Sidewalk crowd level (0 = deserted, 1 = packed). */
  readonly crowdDensity: number;
  readonly maxConcurrent: number;
  readonly archetypes: readonly OutfitArchetype[];
  /** Average walk speed in world units / second. */
  readonly walkSpeed: Range;
  /** Skin-tone palette for procedural avatars. */
  readonly skinTones: readonly ColorSwatch[];
}

// ---------------------------------------------------------------------------
// SFX era data
// ---------------------------------------------------------------------------

/**
 * Era-specific sound parameters consumed by the procedural audio buffer
 * generator (src/audio/sfx.ts). All values are synthesis parameters — no
 * external audio files — so the whole registry stays serialisable.
 */
export interface SfxEraData {
  /** Ambient bed: low drone / room tone. */
  readonly ambient: {
    /** Base frequency of the drone in Hz. */
    readonly baseFrequency: number;
    /** Second oscillator frequency for beating / richness. */
    readonly harmonicFrequency: number;
    /** Waveform of the tonal bed. */
    readonly waveform: 'sine' | 'triangle' | 'sawtooth' | 'square';
    /** Low-pass cutoff for the noise bed in Hz. */
    readonly noiseCutoff: number;
    /** Overall ambient gain (0–1). */
    readonly gain: number;
  };
  /** Traffic engine profile. */
  readonly traffic: {
    /** Engine fundamental base frequency in Hz. */
    readonly engineFrequency: Range;
    /** Waveform used for engine simulation. */
    readonly waveform: 'sawtooth' | 'square' | 'pulse';
    /** Rumble noise cutoff in Hz. */
    readonly rumbleCutoff: number;
    /** Overall traffic gain (0–1). */
    readonly gain: number;
  };
  /** One-shot event sounds scheduled sporadically. */
  readonly events: readonly {
    readonly id: string;
    readonly type: 'horn' | 'bell' | 'siren' | 'whistle' | 'chime' | 'beep' | 'announcement' | 'notification';
    readonly frequency: number;
    readonly duration: number;
    readonly gain: number;
    /** Average occurrences per minute. */
    readonly ratePerMinute: number;
  }[];
  /** Musical bed style descriptor. */
  readonly music: {
    readonly style: 'big-band' | 'motown' | 'synthpop' | 'crunk' | 'hyperpop';
    readonly tempoBpm: number;
    /** Root note frequency in Hz. */
    readonly rootFrequency: number;
    readonly scale: readonly number[];
    readonly gain: number;
  };
}
// ---------------------------------------------------------------------------
// Top-level era configuration
// ---------------------------------------------------------------------------

/**
 * The complete, declarative description of a single decade.
 *
 * `EraSpec` composes every category-specific data block. It is intentionally a
 * plain, JSON-serialisable object so that:
 *  - the HUD can render labels from it,
 *  - procedural asset builders can read mesh/material parameters from it,
 *  - the SFX mixer can derive audio buffers from it, and
 *  - the transition system can lerp / swap between two specs.
 *
 * Nothing in this structure references three.js, the DOM, or AudioContext —
 * those live in the consumer modules.
 */
export interface EraSpec {
  /** Chronological id; matches the timeline slider value. */
  readonly id: EraId;
  /** Numeric year (e.g. 1945). */
  readonly year: EraYear;
  /** Short display label, e.g. "Post-War Boom". */
  readonly label: string;
  /** One-sentence description for the HUD / tooltip. */
  readonly description: string;
  /** Time-of-day sky colour (hex) for the default lighting setup. */
  readonly skyColor: HexColor;
  /** Ground / horizon haze colour (hex). */
  readonly horizonColor: HexColor;
  /** Sun light intensity (0–1 normalised). */
  readonly sunIntensity: number;
  /** Sun elevation in degrees (0 = horizon, 90 = noon). */
  readonly sunElevation: number;
  /** Fog density (0 = none, 1 = heavy). */
  readonly fogDensity: number;
  /** Category data blocks. */
  readonly buildings: BuildingEraData;
  readonly vehicles: VehicleEraData;
  readonly storefronts: StorefrontEraData;
  readonly advertisements: AdvertisementEraData;
  readonly pedestrians: PedestrianOutfitEraData;
  readonly sfx: SfxEraData;
}

// ---------------------------------------------------------------------------
// Internal colour helpers (kept here so the registry is self-contained)
// ---------------------------------------------------------------------------

/** Create a ColorSwatch from a hex string. */
function sw(name: string, hex: HexColor): ColorSwatch {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { name, hex, rgb: { r, g, b } };
}

/** Convenience range literal. */
function range(min: number, max: number): Range {
  return { min, max };
}

// ---------------------------------------------------------------------------
// 1945 — Post-War
// ---------------------------------------------------------------------------

const ERA_1945: EraSpec = {
  id: '1945',
  year: 1945,
  label: 'Post-War',
  description:
    'The war has just ended. A low, brick-and-stone skyline clings to traditional craftsmanship while optimism slowly returns to the streets.',
  skyColor: '#c9d6e0',
  horizonColor: '#b0bcc8',
  sunIntensity: 0.75,
  sunElevation: 42,
  fogDensity: 0.18,
  buildings: {
    skylineProfile: 'low-rise',
    floorHeight: 3.6,
    setbackFactor: 0.05,
    streetWallContinuity: 0.85,
    materialPalette: [
      sw('brown-brick', '#6b4f3a'),
      sw('red-brick', '#8a4b3a'),
      sw('limestone', '#c4baa8'),
      sw('cream-stucco', '#d8cdb4'),
    ],
    sidewalkColor: sw('grey-concrete', '#9a9a92'),
    roadColor: sw('asphalt-old', '#3a3a38'),
    archetypes: [
      {
        id: 'art-deco-midrise',
        label: 'Art Deco mid-rise',
        stories: range(6, 12),
        width: range(14, 22),
        depth: range(16, 26),
        facadeColor: sw('limestone', '#c4baa8'),
        trimColor: sw('bronze', '#7a6438'),
        roofStyle: 'flat-parapet',
        windowPattern: 'casement-grid',
        windowColor: sw('amber-glass', '#3a4250'),
        weight: 4,
        details: ['vertical-piers', 'stepped-parapet', 'geometric-frieze'],
      },
      {
        id: 'brownstone-walkup',
        label: 'Brownstone walk-up',
        stories: range(4, 6),
        width: range(10, 16),
        depth: range(14, 20),
        facadeColor: sw('brown-brick', '#6b4f3a'),
        trimColor: sw('cream-stucco', '#d8cdb4'),
        roofStyle: 'flat-parapet',
        windowPattern: 'double-hung-grid',
        windowColor: sw('amber-glass', '#3a4250'),
        weight: 6,
        details: ['stoop-entry', 'bay-windows', 'cornice'],
      },
      {
        id: 'warehouse-loft',
        label: 'Industrial warehouse',
        stories: range(3, 5),
        width: range(20, 32),
        depth: range(20, 30),
        facadeColor: sw('red-brick', '#8a4b3a'),
        trimColor: sw('dark-mortar', '#4a4038'),
        roofStyle: 'flat',
        windowPattern: 'punched-opening',
        windowColor: sw('amber-glass', '#3a4250'),
        weight: 3,
        details: ['loading-dock', 'segmental-arches'],
      },
    ],
  },
  vehicles: {
    trafficDensity: 0.25,
    maxConcurrent: 6,
    laneDirection: 'right',
    colorPalette: [
      sw('gloss-black', '#1a1a1a'),
      sw('navy', '#1f2a44'),
      sw('maroon', '#5a2230'),
      sw('cream', '#d8cdb4'),
    ],
    headlightColor: sw('warm-white', '#fff0c8'),
    electricRatio: 0,
    archetypes: [
      {
        id: 'roadster-40s',
        label: 'Roadster',
        bodyStyle: 'roadster',
        length: range(4.6, 5.0),
        width: range(1.7, 1.8),
        height: range(1.4, 1.6),
        bodyColor: sw('gloss-black', '#1a1a1a'),
        wheels: 4,
        topSpeed: range(6, 9),
        weight: 3,
        details: ['running-boards', 'folded-top', 'chrome-grille'],
      },
      {
        id: 'sedan-rounded-40s',
        label: 'Rounded sedan',
        bodyStyle: 'sedan-rounded',
        length: range(4.8, 5.2),
        width: range(1.8, 1.9),
        height: range(1.6, 1.7),
        bodyColor: sw('navy', '#1f2a44'),
        wheels: 4,
        topSpeed: range(5, 8),
        weight: 6,
        details: ['fender-skirts', 'chrome-bumpers', 'split-windshield'],
      },
      {
        id: 'delivery-van-40s',
        label: 'Delivery van',
        bodyStyle: 'delivery-van',
        length: range(5.0, 5.6),
        width: range(1.8, 2.0),
        height: range(2.0, 2.3),
        bodyColor: sw('cream', '#d8cdb4'),
        wheels: 4,
        topSpeed: range(4, 6),
        weight: 2,
        details: ['canvas-curtain', 'round-headlights'],
      },
    ],
  },
  storefronts: {
    groundFloorActivity: 0.7,
    storefrontsPerFace: range(4, 6),
    awningHeight: 3.0,
    nighttimeIllumination: 0.25,
    archetypes: [
      {
        id: 'diner-1945',
        label: 'Diner',
        businessType: 'diner',
        awningColor: sw('red-white', '#a83232'),
        signStyle: 'painted-gold-leaf',
        signColor: sw('gold-leaf', '#c8a838'),
        windowDisplayColor: sw('warm-amber', '#e8c878'),
        weight: 5,
        details: ['stainless-trim', 'counter-stools', 'pie-case'],
      },
      {
        id: 'barbershop-1945',
        label: 'Barbershop',
        businessType: 'barbershop',
        awningColor: sw('barber-blue', '#2a4a8a'),
        signStyle: 'painted-gold-leaf',
        signColor: sw('gold-leaf', '#c8a838'),
        windowDisplayColor: sw('cool-white', '#d8dce0'),
        weight: 3,
        details: ['pole-stripe', 'leather-chairs'],
      },
      {
        id: 'grocer-1945',
        label: 'Grocer',
        businessType: 'grocer',
        awningColor: sw('green-striped', '#3a6a3a'),
        signStyle: 'painted-gold-leaf',
        signColor: sw('gold-leaf', '#c8a838'),
        windowDisplayColor: sw('produce', '#8aaa4a'),
        weight: 4,
        details: ['wooden-crates', 'hanging-scales'],
      },
    ],
  },
  advertisements: {
    saturation: 0.2,
    maxBillboards: 2,
    nocturnalGlow: false,
    archetypes: [
      {
        id: 'painted-wall-1945',
        label: 'Painted wall sign',
        medium: 'painted-wall',
        placement: 'wall-side',
        primaryColor: sw('faded-red', '#8a3a2a'),
        secondaryColor: sw('cream', '#d8cdb4'),
        size: range(4, 8),
        animationIntensity: 0,
        weight: 8,
        slogans: ['Drink Cola', 'Victory Bonds', 'See America', 'Smoke Lucky'],
      },
      {
        id: 'printed-poster-1945',
        label: 'Printed poster',
        medium: 'printed-poster',
        placement: 'wall-facade',
        primaryColor: sw('poster-blue', '#2a4a8a'),
        secondaryColor: sw('poster-cream', '#d8cdb4'),
        size: range(1.5, 3),
        animationIntensity: 0,
        weight: 4,
        slogans: ['Now Showing', 'Grand Opening', 'Fresh Daily'],
      },
    ],
  },
  pedestrians: {
    crowdDensity: 0.35,
    maxConcurrent: 14,
    walkSpeed: range(1.1, 1.4),
    skinTones: [
      sw('tone-1', '#f0d2b0'),
      sw('tone-2', '#e0b888'),
      sw('tone-3', '#c89868'),
      sw('tone-4', '#a87048'),
    ],
    archetypes: [
      {
        id: 'zoot-1945',
        label: 'Zoot suit',
        silhouette: 'zoot',
        topColor: sw('pinstripe', '#2a2a3a'),
        bottomColor: sw('pinstripe', '#2a2a3a'),
        headwear: 'fedora',
        headwearColor: sw('fedora-grey', '#3a3a3a'),
        weight: 2,
        details: ['watch-chain', 'wide-lapels'],
      },
      {
        id: 'suit-1945',
        label: 'Business suit',
        silhouette: 'suit',
        topColor: sw('charcoal', '#3a3a3a'),
        bottomColor: sw('charcoal', '#3a3a3a'),
        headwear: 'fedora',
        headwearColor: sw('fedora-brown', '#4a3828'),
        weight: 5,
        details: ['narrow-tie', 'briefcase'],
      },
      {
        id: 'swing-dress-1945',
        label: 'Swing dress',
        silhouette: 'swing-dress',
        topColor: sw('floral-red', '#a83232'),
        bottomColor: sw('floral-red', '#a83232'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 4,
        details: ['cardigan', 'gloves', 'seamed-stockings'],
      },
      {
        id: 'housewife-1945',
        label: 'Housewife dress',
        silhouette: 'housewife',
        topColor: sw('powder-blue', '#8aaac8'),
        bottomColor: sw('powder-blue', '#8aaac8'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 3,
        details: ['apron', 'sensible-shoes'],
      },
    ],
  },
  sfx: {
    ambient: {
      baseFrequency: 55,
      harmonicFrequency: 82.5,
      waveform: 'sine',
      noiseCutoff: 320,
      gain: 0.35,
    },
    traffic: {
      engineFrequency: range(45, 60),
      waveform: 'sawtooth',
      rumbleCutoff: 240,
      gain: 0.3,
    },
    events: [
      {
        id: 'tram-bell',
        type: 'bell',
        frequency: 880,
        duration: 0.6,
        gain: 0.4,
        ratePerMinute: 3,
      },
      {
        id: 'factory-whistle',
        type: 'whistle',
        frequency: 1200,
        duration: 1.5,
        gain: 0.3,
        ratePerMinute: 1,
      },
      {
        id: 'car-horn-40s',
        type: 'horn',
        frequency: 380,
        duration: 0.4,
        gain: 0.35,
        ratePerMinute: 4,
      },
    ],
    music: {
      style: 'big-band',
      tempoBpm: 120,
      rootFrequency: 146.83,
      scale: [0, 2, 3, 5, 7, 8, 10],
      gain: 0.12,
    },
  },
};
// ---------------------------------------------------------------------------
// 1965 — Space-Age Boom
// ---------------------------------------------------------------------------

const ERA_1965: EraSpec = {
  id: '1965',
  year: 1965,
  label: 'Space-Age Boom',
  description:
    'Optimism and chrome rule the streets. Slab mid-rises and curtain-wall offices rise above a sea of pastel automobiles and neon signage.',
  skyColor: '#a8c4dc',
  horizonColor: '#9ab0c4',
  sunIntensity: 0.82,
  sunElevation: 48,
  fogDensity: 0.12,
  buildings: {
    skylineProfile: 'mid-rise',
    floorHeight: 3.4,
    setbackFactor: 0.15,
    streetWallContinuity: 0.78,
    materialPalette: [
      sw('curtain-glass', '#5a7a8a'),
      sw('white-concrete', '#c8c8c0'),
      sw('pastel-turquoise', '#5ab0a0'),
      sw('warm-brick', '#9a5a3a'),
    ],
    sidewalkColor: sw('poured-concrete', '#a8a8a0'),
    roadColor: sw('asphalt-mid', '#383834'),
    archetypes: [
      {
        id: 'curtain-wall-office',
        label: 'Curtain-wall office',
        stories: range(10, 24),
        width: range(18, 30),
        depth: range(18, 28),
        facadeColor: sw('curtain-glass', '#5a7a8a'),
        trimColor: sw('anodised-aluminium', '#8a8a88'),
        roofStyle: 'flat',
        windowPattern: 'curtain-wall',
        windowColor: sw('blue-glass', '#4a6a8a'),
        weight: 5,
        details: ['mullion-grid', 'recessed-lobby', 'rooftop-mech'],
      },
      {
        id: 'mid-century-slab',
        label: 'Mid-century slab',
        stories: range(8, 14),
        width: range(16, 24),
        depth: range(14, 20),
        facadeColor: sw('white-concrete', '#c8c8c0'),
        trimColor: sw('pastel-turquoise', '#5ab0a0'),
        roofStyle: 'flat',
        windowPattern: 'ribbon',
        windowColor: sw('blue-glass', '#4a6a8a'),
        weight: 4,
        details: ['pilotis', 'brise-soleil', 'entry-canopy'],
      },
      {
        id: 'googie-retail',
        label: 'Googie retail block',
        stories: range(2, 4),
        width: range(20, 34),
        depth: range(18, 26),
        facadeColor: sw('pastel-turquoise', '#5ab0a0'),
        trimColor: sw('chrome', '#b0b0b4'),
        roofStyle: 'curved-glass',
        windowPattern: 'floor-to-ceiling',
        windowColor: sw('clear-glass', '#6a8a9a'),
        weight: 3,
        details: ['boomerang-canopy', 'starburst-pylon', 'terrazzo-floor'],
      },
    ],
  },
  vehicles: {
    trafficDensity: 0.45,
    maxConcurrent: 10,
    laneDirection: 'right',
    colorPalette: [
      sw('pastel-blue', '#7aaac8'),
      sw('pastel-pink', '#d88aa0'),
      sw('seafoam', '#5ab0a0'),
      sw('chrome-white', '#d8d8d0'),
    ],
    headlightColor: sw('warm-white', '#fff0c8'),
    electricRatio: 0,
    archetypes: [
      {
        id: 'muscle-1965',
        label: 'Muscle car',
        bodyStyle: 'muscle',
        length: range(5.0, 5.4),
        width: range(1.9, 2.0),
        height: range(1.3, 1.4),
        bodyColor: sw('pastel-blue', '#7aaac8'),
        wheels: 4,
        topSpeed: range(8, 12),
        weight: 4,
        details: ['hidden-headlights', 'racing-stripes', 'dual-exhaust'],
      },
      {
        id: 'sedan-boxy-1965',
        label: 'Boxy family sedan',
        bodyStyle: 'sedan-boxy',
        length: range(5.0, 5.3),
        width: range(1.9, 2.0),
        height: range(1.4, 1.5),
        bodyColor: sw('seafoam', '#5ab0a0'),
        wheels: 4,
        topSpeed: range(7, 10),
        weight: 6,
        details: ['tail-fins', 'chrome-grille', 'wraparound-windshield'],
      },
      {
        id: 'wagon-1965',
        label: 'Station wagon',
        bodyStyle: 'wagon',
        length: range(5.1, 5.5),
        width: range(1.9, 2.0),
        height: range(1.5, 1.6),
        bodyColor: sw('pastel-pink', '#d88aa0'),
        wheels: 4,
        topSpeed: range(6, 9),
        weight: 3,
        details: ['wood-panelling', 'roof-rack'],
      },
      {
        id: 'bus-1965',
        label: 'City bus',
        bodyStyle: 'bus',
        length: range(9.0, 10.0),
        width: range(2.4, 2.5),
        height: range(2.8, 3.0),
        bodyColor: sw('chrome-white', '#d8d8d0'),
        wheels: 6,
        topSpeed: range(4, 6),
        weight: 2,
        details: ['rounded-front', 'folding-door', 'roof-ad'],
      },
    ],
  },
  storefronts: {
    groundFloorActivity: 0.8,
    storefrontsPerFace: range(5, 7),
    awningHeight: 3.1,
    nighttimeIllumination: 0.5,
    archetypes: [
      {
        id: 'diner-1965',
        label: 'Chrome diner',
        businessType: 'diner',
        awningColor: sw('chrome-blue', '#2a4a8a'),
        signStyle: 'neon',
        signColor: sw('neon-pink', '#ff4a8a'),
        windowDisplayColor: sw('warm-amber', '#e8c878'),
        weight: 5,
        details: ['boomerang-counter', 'jukebox', 'vinyl-stools'],
      },
      {
        id: 'drugstore-1965',
        label: 'Drugstore / soda fountain',
        businessType: 'drugstore',
        awningColor: sw('pastel-green', '#5ab0a0'),
        signStyle: 'neon',
        signColor: sw('neon-green', '#4aff8a'),
        windowDisplayColor: sw('cool-white', '#d8dce0'),
        weight: 3,
        details: ['soda-fountain', 'magazine-rack'],
      },
      {
        id: 'hardware-1965',
        label: 'Hardware store',
        businessType: 'hardware',
        awningColor: sw('industrial-orange', '#c87a3a'),
        signStyle: 'backlit-plastic',
        signColor: sw('sign-orange', '#e88a3a'),
        windowDisplayColor: sw('metal-grey', '#8a8a88'),
        weight: 2,
        details: ['pegboard-wall', 'tool-display'],
      },
    ],
  },
  advertisements: {
    saturation: 0.45,
    maxBillboards: 4,
    nocturnalGlow: true,
    archetypes: [
      {
        id: 'neon-sign-1965',
        label: 'Neon rooftop sign',
        medium: 'neon-sign',
        placement: 'rooftop',
        primaryColor: sw('neon-pink', '#ff4a8a'),
        secondaryColor: sw('neon-blue', '#4a8aff'),
        size: range(3, 6),
        animationIntensity: 0.2,
        weight: 7,
        slogans: ['Motel', 'Diner', 'Ice Cold', 'Drive-In', 'Super'],
      },
      {
        id: 'backlit-billboard-1965',
        label: 'Backlit billboard',
        medium: 'backlit-billboard',
        placement: 'freestanding',
        primaryColor: sw('poster-red', '#c83a3a'),
        secondaryColor: sw('poster-cream', '#d8cdb4'),
        size: range(6, 10),
        animationIntensity: 0,
        weight: 5,
        slogans: ['New!', 'Limited Time', 'Family Size', 'Taste the'],
      },
    ],
  },
  pedestrians: {
    crowdDensity: 0.5,
    maxConcurrent: 20,
    walkSpeed: range(1.2, 1.5),
    skinTones: [
      sw('tone-1', '#f0d2b0'),
      sw('tone-2', '#e0b888'),
      sw('tone-3', '#c89868'),
      sw('tone-4', '#a87048'),
      sw('tone-5', '#7a5028'),
    ],
    archetypes: [
      {
        id: 'mod-1965',
        label: 'Mod look',
        silhouette: 'mod',
        topColor: sw('graphic-white', '#e8e8e0'),
        bottomColor: sw('mod-black', '#1a1a1a'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 4,
        details: ['geometric-print', 'go-go-boots', 'bob-haircut'],
      },
      {
        id: 'greaser-1965',
        label: 'Greaser',
        silhouette: 'greaser',
        topColor: sw('white-tee', '#e0e0d8'),
        bottomColor: sw('blue-jean', '#3a4a6a'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 3,
        details: ['leather-jacket', 'pompadour', 'cigarette-pack'],
      },
      {
        id: 'minidress-1965',
        label: 'Mini dress',
        silhouette: 'minidress',
        topColor: sw('vivid-yellow', '#e8c83a'),
        bottomColor: sw('vivid-yellow', '#e8c83a'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 3,
        details: ['shift-cut', 'knee-boots', 'graphic-earrings'],
      },
      {
        id: 'suit-1965',
        label: 'Slim business suit',
        silhouette: 'suit',
        topColor: sw('midnight-blue', '#1f2a44'),
        bottomColor: sw('midnight-blue', '#1f2a44'),
        headwear: 'fedora',
        headwearColor: sw('fedora-black', '#2a2a2a'),
        weight: 3,
        details: ['skinny-tie', 'briefcase', 'pocket-square'],
      },
    ],
  },
  sfx: {
    ambient: {
      baseFrequency: 65,
      harmonicFrequency: 97.5,
      waveform: 'triangle',
      noiseCutoff: 400,
      gain: 0.32,
    },
    traffic: {
      engineFrequency: range(50, 70),
      waveform: 'sawtooth',
      rumbleCutoff: 300,
      gain: 0.38,
    },
    events: [
      {
        id: 'car-horn-1965',
        type: 'horn',
        frequency: 440,
        duration: 0.35,
        gain: 0.35,
        ratePerMinute: 6,
      },
      {
        id: 'siren-1965',
        type: 'siren',
        frequency: 700,
        duration: 2.0,
        gain: 0.3,
        ratePerMinute: 1,
      },
      {
        id: 'shop-bell-1965',
        type: 'bell',
        frequency: 1046,
        duration: 0.3,
        gain: 0.25,
        ratePerMinute: 8,
      },
    ],
    music: {
      style: 'motown',
      tempoBpm: 128,
      rootFrequency: 164.81,
      scale: [0, 2, 3, 5, 7, 9, 10],
      gain: 0.14,
    },
  },
};
// ---------------------------------------------------------------------------
// 1985 — Neon Decade
// ---------------------------------------------------------------------------

const ERA_1985: EraSpec = {
  id: '1985',
  year: 1985,
  label: 'Neon Decade',
  description:
    'Glass towers and postmodern geometry tower over a riot of neon, fax machines, and boxy cars with angular bodies.',
  skyColor: '#9ab8d0',
  horizonColor: '#8a9ab4',
  sunIntensity: 0.7,
  sunElevation: 38,
  fogDensity: 0.2,
  buildings: {
    skylineProfile: 'mixed',
    floorHeight: 3.5,
    setbackFactor: 0.3,
    streetWallContinuity: 0.68,
    materialPalette: [
      sw('smoky-glass', '#3a4a5a'),
      sw('pink-granite', '#b88a8a'),
      sw('mirror-glass', '#6a8a9a'),
      sw('postmodern-stucco', '#d8b8a0'),
    ],
    sidewalkColor: sw('red-brick-paver', '#8a5a4a'),
    roadColor: sw('asphalt-dark', '#2e2e2c'),
    archetypes: [
      {
        id: 'glass-tower-1985',
        label: 'Glass skyscraper',
        stories: range(20, 50),
        width: range(22, 34),
        depth: range(22, 32),
        facadeColor: sw('mirror-glass', '#6a8a9a'),
        trimColor: sw('dark-aluminium', '#4a4a48'),
        roofStyle: 'setback',
        windowPattern: 'curtain-wall',
        windowColor: sw('bronze-glass', '#4a4238'),
        weight: 5,
        details: ['crown-lights', 'recessed-plaza', 'sky-lobby'],
      },
      {
        id: 'postmodern-block',
        label: 'Postmodern block',
        stories: range(8, 16),
        width: range(18, 28),
        depth: range(16, 24),
        facadeColor: sw('postmodern-stucco', '#d8b8a0'),
        trimColor: sw('pink-granite', '#b88a8a'),
        roofStyle: 'mansard',
        windowPattern: 'punched-opening',
        windowColor: sw('blue-glass', '#4a6a8a'),
        weight: 4,
        details: ['keystone-motif', 'engaged-columns', 'patterned-band'],
      },
      {
        id: 'strip-mall-1985',
        label: 'Strip-mall retail',
        stories: range(1, 2),
        width: range(24, 40),
        depth: range(16, 22),
        facadeColor: sw('stucco-cream', '#d0c4b0'),
        trimColor: sw('neon-trim', '#ff4a8a'),
        roofStyle: 'flat-parapet',
        windowPattern: 'floor-to-ceiling',
        windowColor: sw('tinted-glass', '#5a6a7a'),
        weight: 3,
        details: ['parking-lot-front', 'pylon-sign', 'awning-row'],
      },
    ],
  },
  vehicles: {
    trafficDensity: 0.6,
    maxConcurrent: 14,
    laneDirection: 'right',
    colorPalette: [
      sw('box-grey', '#6a6a68'),
      sw('box-red', '#8a3a3a'),
      sw('two-tone-blue', '#3a5a8a'),
      sw('champagne', '#c8b888'),
    ],
    headlightColor: sw('sealed-beam', '#fff4d0'),
    electricRatio: 0,
    archetypes: [
      {
        id: 'sedan-boxy-1985',
        label: 'Boxy sedan',
        bodyStyle: 'sedan-boxy',
        length: range(4.6, 4.9),
        width: range(1.7, 1.8),
        height: range(1.4, 1.5),
        bodyColor: sw('box-grey', '#6a6a68'),
        wheels: 4,
        topSpeed: range(8, 11),
        weight: 6,
        details: ['sealed-beam-headlights', 'chrome-bumper', 'wire-hubcaps'],
      },
      {
        id: 'hatchback-1985',
        label: 'Hatchback',
        bodyStyle: 'hatchback',
        length: range(3.9, 4.2),
        width: range(1.6, 1.7),
        height: range(1.4, 1.5),
        bodyColor: sw('box-red', '#8a3a3a'),
        wheels: 4,
        topSpeed: range(7, 10),
        weight: 4,
        details: ['pop-up-headlights', 'rear-spoiler'],
      },
      {
        id: 'minivan-1985',
        label: 'Minivan',
        bodyStyle: 'minivan',
        length: range(4.5, 4.8),
        width: range(1.8, 1.9),
        height: range(1.7, 1.8),
        bodyColor: sw('two-tone-blue', '#3a5a8a'),
        wheels: 4,
        topSpeed: range(6, 9),
        weight: 3,
        details: ['sliding-door', 'woodgrain-trim'],
      },
      {
        id: 'semi-truck-1985',
        label: 'Semi truck',
        bodyStyle: 'semi-truck',
        length: range(12, 16),
        width: range(2.4, 2.5),
        height: range(3.2, 3.8),
        bodyColor: sw('champagne', '#c8b888'),
        wheels: 10,
        topSpeed: range(5, 7),
        weight: 2,
        details: ['sleeper-cab', 'air-horn', 'mud-flaps'],
      },
    ],
  },
  storefronts: {
    groundFloorActivity: 0.85,
    storefrontsPerFace: range(5, 8),
    awningHeight: 3.2,
    nighttimeIllumination: 0.7,
    archetypes: [
      {
        id: 'arcade-1985',
        label: 'Video arcade',
        businessType: 'electronics',
        awningColor: sw('neon-purple', '#8a4aff'),
        signStyle: 'neon',
        signColor: sw('neon-cyan', '#4affff'),
        windowDisplayColor: sw('crt-glow', '#3a8aff'),
        weight: 4,
        details: ['cabinet-row', 'token-counter', 'carpet-pattern'],
      },
      {
        id: 'fast-food-1985',
        label: 'Fast-food chain',
        businessType: 'fast-food',
        awningColor: sw('fast-red', '#c83a3a'),
        signStyle: 'backlit-plastic',
        signColor: sw('sign-yellow', '#e8c83a'),
        windowDisplayColor: sw('warm-amber', '#e8c878'),
        weight: 5,
        details: ['drive-thru', 'plastic-seating', 'play-area'],
      },
      {
        id: 'electronics-1985',
        label: 'Electronics store',
        businessType: 'electronics',
        awningColor: sw('tech-grey', '#6a6a68'),
        signStyle: 'backlit-plastic',
        signColor: sw('sign-orange', '#e88a3a'),
        windowDisplayColor: sw('crt-glow', '#3a8aff'),
        weight: 3,
        details: ['tv-wall', 'boombox-display', 'vhs-rack'],
      },
    ],
  },
  advertisements: {
    saturation: 0.6,
    maxBillboards: 6,
    nocturnalGlow: true,
    archetypes: [
      {
        id: 'neon-sign-1985',
        label: 'Neon wall sign',
        medium: 'neon-sign',
        placement: 'wall-facade',
        primaryColor: sw('neon-pink', '#ff4a8a'),
        secondaryColor: sw('neon-cyan', '#4affff'),
        size: range(2, 5),
        animationIntensity: 0.3,
        weight: 8,
        slogans: ['Open 24h', 'Arcade', 'Video', 'Cassette', 'Hot'],
      },
      {
        id: 'backlit-billboard-1985',
        label: 'Backlit billboard',
        medium: 'backlit-billboard',
        placement: 'rooftop',
        primaryColor: sw('poster-blue', '#2a4a8a'),
        secondaryColor: sw('poster-white', '#e8e8e0'),
        size: range(6, 12),
        animationIntensity: 0.1,
        weight: 6,
        slogans: ['Just Do It', 'Choice', 'Now', 'Premium', 'Lite'],
      },
    ],
  },
  pedestrians: {
    crowdDensity: 0.6,
    maxConcurrent: 26,
    walkSpeed: range(1.3, 1.6),
    skinTones: [
      sw('tone-1', '#f0d2b0'),
      sw('tone-2', '#e0b888'),
      sw('tone-3', '#c89868'),
      sw('tone-4', '#a87048'),
      sw('tone-5', '#7a5028'),
    ],
    archetypes: [
      {
        id: 'power-suit-1985',
        label: 'Power suit',
        silhouette: 'power-suit',
        topColor: sw('power-red', '#8a2a2a'),
        bottomColor: sw('power-navy', '#1f2a44'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 4,
        details: ['shoulder-pads', 'silk-blouse', 'gold-buttons'],
      },
      {
        id: 'tracksuit-1985',
        label: 'Tracksuit',
        silhouette: 'tracksuit',
        topColor: sw('neon-pink', '#ff4a8a'),
        bottomColor: sw('neon-cyan', '#4affff'),
        headwear: 'headband',
        headwearColor: sw('neon-yellow', '#e8c83a'),
        weight: 3,
        details: ['side-stripes', 'high-tops', 'gym-bag'],
      },
      {
        id: 'acid-wash-1985',
        label: 'Acid-wash jeans',
        silhouette: 'acid-wash',
        topColor: sw('graphic-tee', '#e8e8e0'),
        bottomColor: sw('acid-wash', '#8a9ab4'),
        headwear: 'cap',
        headwearColor: sw('cap-red', '#8a2a2a'),
        weight: 4,
        details: ['bandana', 'high-tops', 'cassette-walkman'],
      },
      {
        id: 'preppy-1985',
        label: 'Preppy',
        silhouette: 'preppy',
        topColor: sw('oxford-blue', '#5a7a9a'),
        bottomColor: sw('khaki', '#b8a888'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 3,
        details: ['polo-collar-up', 'boat-shoes', 'sweater-tied'],
      },
    ],
  },
  sfx: {
    ambient: {
      baseFrequency: 70,
      harmonicFrequency: 105,
      waveform: 'triangle',
      noiseCutoff: 500,
      gain: 0.3,
    },
    traffic: {
      engineFrequency: range(55, 80),
      waveform: 'square',
      rumbleCutoff: 350,
      gain: 0.4,
    },
    events: [
      {
        id: 'car-horn-1985',
        type: 'horn',
        frequency: 500,
        duration: 0.3,
        gain: 0.35,
        ratePerMinute: 8,
      },
      {
        id: 'siren-1985',
        type: 'siren',
        frequency: 800,
        duration: 2.5,
        gain: 0.3,
        ratePerMinute: 2,
      },
      {
        id: 'beep-pager-1985',
        type: 'beep',
        frequency: 1600,
        duration: 0.15,
        gain: 0.2,
        ratePerMinute: 5,
      },
      {
        id: 'arcade-chime-1985',
        type: 'chime',
        frequency: 1318,
        duration: 0.4,
        gain: 0.22,
        ratePerMinute: 10,
      },
    ],
    music: {
      style: 'synthpop',
      tempoBpm: 118,
      rootFrequency: 130.81,
      scale: [0, 2, 4, 5, 7, 9, 11],
      gain: 0.16,
    },
  },
};
// ---------------------------------------------------------------------------
// 2005 — Millennial Sprawl
// ---------------------------------------------------------------------------

const ERA_2005: EraSpec = {
  id: '2005',
  year: 2005,
  label: 'Millennial Sprawl',
  description:
    'Bland glass condos and big-box retail line wide arterials. SUVs dominate the road while flip phones and flat screens glow in every window.',
  skyColor: '#b0c8d8',
  horizonColor: '#a0b4c4',
  sunIntensity: 0.78,
  sunElevation: 44,
  fogDensity: 0.1,
  buildings: {
    skylineProfile: 'high-rise',
    floorHeight: 3.2,
    setbackFactor: 0.4,
    streetWallContinuity: 0.55,
    materialPalette: [
      sw('blue-glass-condo', '#4a6a8a'),
      sw('beige-stone', '#c8b896'),
      sw('silver-panel', '#a8a8a4'),
      sw('red-brick-modern', '#8a4a3a'),
    ],
    sidewalkColor: sw('scored-concrete', '#a0a098'),
    roadColor: sw('asphalt-fresh', '#343432'),
    archetypes: [
      {
        id: 'condo-tower-2005',
        label: 'Glass condo tower',
        stories: range(18, 45),
        width: range(20, 30),
        depth: range(20, 30),
        facadeColor: sw('blue-glass-condo', '#4a6a8a'),
        trimColor: sw('silver-panel', '#a8a8a4'),
        roofStyle: 'flat',
        windowPattern: 'curtain-wall',
        windowColor: sw('blue-glass', '#4a6a8a'),
        weight: 5,
        details: ['balcony-glass', 'ground-retail', 'rooftop-pool'],
      },
      {
        id: 'mid-rise-stone-2005',
        label: 'Stone mid-rise',
        stories: range(6, 12),
        width: range(18, 26),
        depth: range(16, 22),
        facadeColor: sw('beige-stone', '#c8b896'),
        trimColor: sw('red-brick-modern', '#8a4a3a'),
        roofStyle: 'flat-parapet',
        windowPattern: 'punched-opening',
        windowColor: sw('blue-glass', '#4a6a8a'),
        weight: 4,
        details: ['storefront-glazing', 'canopy-entry', 'planter-strip'],
      },
      {
        id: 'big-box-2005',
        label: 'Big-box retail',
        stories: range(1, 2),
        width: range(30, 50),
        depth: range(30, 45),
        facadeColor: sw('beige-stone', '#c8b896'),
        trimColor: sw('big-box-blue', '#2a4a8a'),
        roofStyle: 'flat',
        windowPattern: 'punched-opening',
        windowColor: sw('tinted-glass', '#5a6a7a'),
        weight: 3,
        details: ['parking-lot-front', 'pylon-sign', 'garden-center'],
      },
    ],
  },
  vehicles: {
    trafficDensity: 0.7,
    maxConcurrent: 18,
    laneDirection: 'right',
    colorPalette: [
      sw('silver', '#b0b0ac'),
      sw('white', '#e0e0d8'),
      sw('black', '#1a1a1a'),
      sw('red', '#8a2a2a'),
    ],
    headlightColor: sw('halogen', '#fff8e0'),
    electricRatio: 0.02,
    archetypes: [
      {
        id: 'suv-2005',
        label: 'SUV',
        bodyStyle: 'suv',
        length: range(4.8, 5.2),
        width: range(1.9, 2.1),
        height: range(1.7, 1.9),
        bodyColor: sw('silver', '#b0b0ac'),
        wheels: 4,
        topSpeed: range(8, 12),
        weight: 6,
        details: ['roof-rack', 'running-boards', 'tinted-rear'],
      },
      {
        id: 'sedan-rounded-2005',
        label: 'Aero sedan',
        bodyStyle: 'sedan-rounded',
        length: range(4.7, 5.0),
        width: range(1.8, 1.9),
        height: range(1.4, 1.5),
        bodyColor: sw('white', '#e0e0d8'),
        wheels: 4,
        topSpeed: range(9, 13),
        weight: 5,
        details: ['projector-headlights', 'alloy-wheels', 'fog-lights'],
      },
      {
        id: 'minivan-2005',
        label: 'Minivan',
        bodyStyle: 'minivan',
        length: range(4.8, 5.1),
        width: range(1.9, 2.0),
        height: range(1.7, 1.8),
        bodyColor: sw('red', '#8a2a2a'),
        wheels: 4,
        topSpeed: range(7, 10),
        weight: 3,
        details: ['sliding-doors-both', 'dvd-screen', 'roof-rack'],
      },
      {
        id: 'pickup-2005',
        label: 'Pickup truck',
        bodyStyle: 'pickup',
        length: range(5.2, 5.8),
        width: range(1.9, 2.1),
        height: range(1.7, 1.9),
        bodyColor: sw('black', '#1a1a1a'),
        wheels: 4,
        topSpeed: range(7, 11),
        weight: 3,
        details: ['crew-cab', 'bed-liner', 'chrome-grille'],
      },
    ],
  },
  storefronts: {
    groundFloorActivity: 0.6,
    storefrontsPerFace: range(3, 5),
    awningHeight: 3.3,
    nighttimeIllumination: 0.8,
    archetypes: [
      {
        id: 'convenience-2005',
        label: 'Convenience store',
        businessType: 'convenience',
        awningColor: sw('cstore-green', '#3a8a3a'),
        signStyle: 'backlit-plastic',
        signColor: sw('sign-red', '#c83a3a'),
        windowDisplayColor: sw('fluorescent', '#e8e8c0'),
        weight: 5,
        details: ['slurpee-machine', 'lotto-sign', 'atm-corner'],
      },
      {
        id: 'fast-food-2005',
        label: 'Fast-food drive-thru',
        businessType: 'fast-food',
        awningColor: sw('fast-yellow', '#e8c83a'),
        signStyle: 'backlit-plastic',
        signColor: sw('sign-red', '#c83a3a'),
        windowDisplayColor: sw('warm-amber', '#e8c878'),
        weight: 4,
        details: ['drive-thru-window', 'play-tube', 'value-menu-board'],
      },
      {
        id: 'phone-shop-2005',
        label: 'Phone store',
        businessType: 'phone-repair',
        awningColor: sw('tech-blue', '#2a6aaa'),
        signStyle: 'led',
        signColor: sw('led-white', '#e8f0ff'),
        windowDisplayColor: sw('screen-blue', '#3a8aff'),
        weight: 3,
        details: ['kiosk-island', 'accessory-wall', 'flip-phone-display'],
      },
    ],
  },
  advertisements: {
    saturation: 0.5,
    maxBillboards: 5,
    nocturnalGlow: true,
    archetypes: [
      {
        id: 'led-billboard-2005',
        label: 'LED billboard',
        medium: 'led-billboard',
        placement: 'freestanding',
        primaryColor: sw('led-cyan', '#4affff'),
        secondaryColor: sw('led-magenta', '#ff4aff'),
        size: range(8, 14),
        animationIntensity: 0.6,
        weight: 7,
        slogans: ['Unlimited', 'Data Plan', 'Click Here', 'New Model', '0% APR'],
      },
      {
        id: 'backlit-billboard-2005',
        label: 'Backlit billboard',
        medium: 'backlit-billboard',
        placement: 'rooftop',
        primaryColor: sw('poster-blue', '#2a4a8a'),
        secondaryColor: sw('poster-white', '#e8e8e0'),
        size: range(6, 12),
        animationIntensity: 0,
        weight: 5,
        slogans: ['Think', 'Connected', 'Lifestyle', 'Pure', 'Drive'],
      },
    ],
  },
  pedestrians: {
    crowdDensity: 0.55,
    maxConcurrent: 22,
    walkSpeed: range(1.3, 1.6),
    skinTones: [
      sw('tone-1', '#f0d2b0'),
      sw('tone-2', '#e0b888'),
      sw('tone-3', '#c89868'),
      sw('tone-4', '#a87048'),
      sw('tone-5', '#7a5028'),
      sw('tone-6', '#5a3a18'),
    ],
    archetypes: [
      {
        id: 'bootcut-2005',
        label: 'Bootcut jeans',
        silhouette: 'bootcut-jeans',
        topColor: sw('graphic-tee', '#e8e8e0'),
        bottomColor: sw('denim-blue', '#3a4a6a'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 4,
        details: ['low-rise', 'flip-phone', 'hoodie-tied'],
      },
      {
        id: 'streetwear-2005',
        label: 'Streetwear',
        silhouette: 'streetwear',
        topColor: sw('hoody-grey', '#6a6a68'),
        bottomColor: sw('cargo-khaki', '#8a7a58'),
        headwear: 'cap',
        headwearColor: sw('cap-black', '#1a1a1a'),
        weight: 3,
        details: ['baggy-fit', 'sneakers', 'mp3-player'],
      },
      {
        id: 'preppy-2005',
        label: 'Preppy casual',
        silhouette: 'preppy',
        topColor: sw('polo-navy', '#1f2a44'),
        bottomColor: sw('khaki', '#b8a888'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 3,
        details: ['flip-flops', 'sunglasses', 'lanyard'],
      },
      {
        id: 'hipster-2005',
        label: 'Early hipster',
        silhouette: 'hipster',
        topColor: sw('flannel-red', '#8a3a3a'),
        bottomColor: sw('slim-jean', '#3a4a5a'),
        headwear: 'beanie',
        headwearColor: sw('beanie-grey', '#3a3a3a'),
        weight: 2,
        details: ['fixed-gear-bike', 'vinyl-bag', 'thick-glasses'],
      },
    ],
  },
  sfx: {
    ambient: {
      baseFrequency: 75,
      harmonicFrequency: 112.5,
      waveform: 'sine',
      noiseCutoff: 600,
      gain: 0.28,
    },
    traffic: {
      engineFrequency: range(60, 90),
      waveform: 'sawtooth',
      rumbleCutoff: 400,
      gain: 0.42,
    },
    events: [
      {
        id: 'car-horn-2005',
        type: 'horn',
        frequency: 550,
        duration: 0.3,
        gain: 0.35,
        ratePerMinute: 9,
      },
      {
        id: 'siren-2005',
        type: 'siren',
        frequency: 900,
        duration: 2.5,
        gain: 0.3,
        ratePerMinute: 3,
      },
      {
        id: 'phone-beep-2005',
        type: 'beep',
        frequency: 2000,
        duration: 0.1,
        gain: 0.18,
        ratePerMinute: 7,
      },
      {
        id: 'notification-2005',
        type: 'notification',
        frequency: 1760,
        duration: 0.2,
        gain: 0.15,
        ratePerMinute: 6,
      },
    ],
    music: {
      style: 'crunk',
      tempoBpm: 140,
      rootFrequency: 146.83,
      scale: [0, 2, 3, 5, 7, 8, 10],
      gain: 0.18,
    },
  },
};
// ---------------------------------------------------------------------------
// 2025 — Hyper-Connected
// ---------------------------------------------------------------------------

const ERA_2025: EraSpec = {
  id: '2025',
  year: 2025,
  label: 'Hyper-Connected',
  description:
    'Sleek supertalls pierce a data-saturated sky. Electric crossovers and autonomous pods glide silently past holographic ads and athleisure-clad crowds.',
  skyColor: '#c0d0e0',
  horizonColor: '#b0c0d4',
  sunIntensity: 0.85,
  sunElevation: 50,
  fogDensity: 0.08,
  buildings: {
    skylineProfile: 'ultra-high-rise',
    floorHeight: 3.0,
    setbackFactor: 0.5,
    streetWallContinuity: 0.45,
    materialPalette: [
      sw('low-iron-glass', '#bcd0d8'),
      sw('white-aluminum', '#d0d0cc'),
      sw('charmetal', '#3a3a3c'),
      sw('green-wall', '#4a7a3a'),
    ],
    sidewalkColor: sw('polished-concrete', '#b0b0a8'),
    roadColor: sw('smart-asphalt', '#2a2a2a'),
    archetypes: [
      {
        id: 'supertall-2025',
        label: 'Supertall residential',
        stories: range(40, 90),
        width: range(22, 30),
        depth: range(22, 30),
        facadeColor: sw('low-iron-glass', '#bcd0d8'),
        trimColor: sw('white-aluminum', '#d0d0cc'),
        roofStyle: 'setback',
        windowPattern: 'curtain-wall',
        windowColor: sw('smart-glass', '#6a8a9a'),
        weight: 5,
        details: ['twist-form', 'sky-garden', 'amenity-floor', 'drone-port'],
      },
      {
        id: 'eco-midrise-2025',
        label: 'Eco mid-rise',
        stories: range(8, 18),
        width: range(18, 26),
        depth: range(18, 24),
        facadeColor: sw('white-aluminum', '#d0d0cc'),
        trimColor: sw('green-wall', '#4a7a3a'),
        roofStyle: 'flat',
        windowPattern: 'floor-to-ceiling',
        windowColor: sw('smart-glass', '#6a8a9a'),
        weight: 4,
        details: ['vertical-garden', 'solar-canopy', 'rainwater-tanks'],
      },
      {
        id: 'data-center-2025',
        label: 'Data / logistics block',
        stories: range(3, 6),
        width: range(28, 44),
        depth: range(28, 40),
        facadeColor: sw('charmetal', '#3a3a3c'),
        trimColor: sw('cooling-blue', '#4a8aaa'),
        roofStyle: 'flat',
        windowPattern: 'punched-opening',
        windowColor: sw('led-blue', '#3a8aff'),
        weight: 2,
        details: ['cooling-towers', 'no-windows', 'loading-dock-row'],
      },
    ],
  },
  vehicles: {
    trafficDensity: 0.5,
    maxConcurrent: 14,
    laneDirection: 'right',
    colorPalette: [
      sw('pearl-white', '#e4e4dc'),
      sw('matte-black', '#222226'),
      sw('metallic-blue', '#3a5a8a'),
      sw('cyber-grey', '#6a6a6c'),
    ],
    headlightColor: sw('led-matrix', '#e8f0ff'),
    electricRatio: 0.65,
    archetypes: [
      {
        id: 'ev-crossover-2025',
        label: 'Electric crossover',
        bodyStyle: 'electric-crossover',
        length: range(4.7, 5.0),
        width: range(1.9, 2.0),
        height: range(1.6, 1.7),
        bodyColor: sw('pearl-white', '#e4e4dc'),
        wheels: 4,
        topSpeed: range(10, 14),
        weight: 6,
        details: ['sealed-grille', 'frunk', 'matrix-led', 'camera-mirrors'],
      },
      {
        id: 'self-driving-pod-2025',
        label: 'Autonomous pod',
        bodyStyle: 'self-driving-pod',
        length: range(4.0, 4.4),
        width: range(1.8, 1.9),
        height: range(1.7, 1.8),
        bodyColor: sw('matte-black', '#222226'),
        wheels: 4,
        topSpeed: range(8, 11),
        weight: 4,
        details: ['lidar-turret', 'wraparound-screen', 'no-steering-wheel'],
      },
      {
        id: 'delivery-van-ev-2025',
        label: 'Electric delivery van',
        bodyStyle: 'delivery-van',
        length: range(5.5, 6.2),
        width: range(2.0, 2.1),
        height: range(2.2, 2.5),
        bodyColor: sw('cyber-grey', '#6a6a6c'),
        wheels: 4,
        topSpeed: range(6, 9),
        weight: 3,
        details: ['side-roll-door', 'cargo-camera', 'quiet-motor'],
      },
      {
        id: 'ev-sedan-2025',
        label: 'Electric sedan',
        bodyStyle: 'sedan-rounded',
        length: range(4.8, 5.0),
        width: range(1.9, 2.0),
        height: range(1.4, 1.5),
        bodyColor: sw('metallic-blue', '#3a5a8a'),
        wheels: 4,
        topSpeed: range(11, 15),
        weight: 4,
        details: ['flush-door-handles', 'glass-roof', 'ota-antenna'],
      },
    ],
  },
  storefronts: {
    groundFloorActivity: 0.7,
    storefrontsPerFace: range(4, 6),
    awningHeight: 3.4,
    nighttimeIllumination: 0.9,
    archetypes: [
      {
        id: 'coworking-2025',
        label: 'Co-working lobby',
        businessType: 'co-working',
        awningColor: sw('startup-teal', '#2a8a8a'),
        signStyle: 'led',
        signColor: sw('led-white', '#e8f0ff'),
        windowDisplayColor: sw('screen-blue', '#3a8aff'),
        weight: 4,
        details: ['standing-desks', 'coffee-bar', 'phone-booths'],
      },
      {
        id: 'pharmacy-2025',
        label: 'Modern pharmacy',
        businessType: 'pharmacy',
        awningColor: sw('cross-red', '#c83a3a'),
        signStyle: 'led',
        signColor: sw('led-white', '#e8f0ff'),
        windowDisplayColor: sw('clean-white', '#e8e8e0'),
        weight: 3,
        details: ['kiosk-check-in', 'vaccine-clinic', 'drive-thru'],
      },
      {
        id: 'cafe-2025',
        label: 'Specialty cafe',
        businessType: 'cafe',
        awningColor: sw('espresso-brown', '#4a3a2a'),
        signStyle: 'led',
        signColor: sw('warm-led', '#e8c878'),
        windowDisplayColor: sw('warm-amber', '#e8c878'),
        weight: 4,
        details: ['pour-over-bar', 'laptop-counter', 'oat-milk-sign'],
      },
    ],
  },
  advertisements: {
    saturation: 0.7,
    maxBillboards: 7,
    nocturnalGlow: true,
    archetypes: [
      {
        id: 'led-billboard-2025',
        label: 'Ultra-HD LED billboard',
        medium: 'led-billboard',
        placement: 'rooftop',
        primaryColor: sw('led-cyan', '#4affff'),
        secondaryColor: sw('led-magenta', '#ff4aff'),
        size: range(10, 18),
        animationIntensity: 0.85,
        weight: 8,
        slogans: ['Stream Now', 'AI-Powered', 'Subscribe', 'Go Electric', 'Unlimited'],
      },
      {
        id: 'holographic-2025',
        label: 'Holographic projection',
        medium: 'holographic',
        placement: 'freestanding',
        primaryColor: sw('holo-cyan', '#8affff'),
        secondaryColor: sw('holo-violet', '#aa8aff'),
        size: range(3, 6),
        animationIntensity: 1,
        weight: 4,
        slogans: ['Experience', 'Future', 'Launch', 'AR Ready', 'Be First'],
      },
      {
        id: 'projection-2025',
        label: 'Building projection',
        medium: 'projection',
        placement: 'wall-facade',
        primaryColor: sw('proj-white', '#e8e8e0'),
        secondaryColor: sw('proj-blue', '#4a8aff'),
        size: range(12, 24),
        animationIntensity: 0.7,
        weight: 3,
        slogans: ['Premiere', 'Tonight Only', 'Download', 'Scan Me'],
      },
    ],
  },
  pedestrians: {
    crowdDensity: 0.65,
    maxConcurrent: 30,
    walkSpeed: range(1.3, 1.7),
    skinTones: [
      sw('tone-1', '#f0d2b0'),
      sw('tone-2', '#e0b888'),
      sw('tone-3', '#c89868'),
      sw('tone-4', '#a87048'),
      sw('tone-5', '#7a5028'),
      sw('tone-6', '#5a3a18'),
    ],
    archetypes: [
      {
        id: 'athleisure-2025',
        label: 'Athleisure',
        silhouette: 'athleisure',
        topColor: sw('legging-black', '#2a2a2a'),
        bottomColor: sw('legging-black', '#2a2a2a'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 5,
        details: ['hydro-flask', 'airpods', 'smart-watch', 'yoga-bag'],
      },
      {
        id: 'techwear-2025',
        label: 'Techwear',
        silhouette: 'techwear',
        topColor: sw('tech-charcoal', '#3a3a3c'),
        bottomColor: sw('tech-charcoal', '#3a3a3c'),
        headwear: 'hood',
        headwearColor: sw('tech-charcoal', '#3a3a3c'),
        weight: 3,
        details: ['cargo-pockets', 'reflective-trim', 'crossbody-bag'],
      },
      {
        id: 'smart-casual-2025',
        label: 'Smart casual',
        silhouette: 'smart-casual',
        topColor: sw('knit-navy', '#1f2a44'),
        bottomColor: sw('chinos', '#9a8868'),
        headwear: 'none',
        headwearColor: sw('none', '#000000'),
        weight: 4,
        details: ['white-sneakers', 'tote-bag', 'e-reader'],
      },
      {
        id: 'streetwear-2025',
        label: 'High streetwear',
        silhouette: 'streetwear',
        topColor: sw('oversized-tee', '#e8e8e0'),
        bottomColor: sw('cargo-black', '#2a2a2a'),
        headwear: 'cap',
        headwearColor: sw('cap-white', '#e8e8e0'),
        weight: 3,
        details: ['chunky-sneakers', 'crossbody', 'phone-in-hand'],
      },
    ],
  },
  sfx: {
    ambient: {
      baseFrequency: 80,
      harmonicFrequency: 120,
      waveform: 'sine',
      noiseCutoff: 800,
      gain: 0.24,
    },
    traffic: {
      engineFrequency: range(70, 110),
      waveform: 'pulse',
      rumbleCutoff: 500,
      gain: 0.28,
    },
    events: [
      {
        id: 'ev-hum-2025',
        type: 'beep',
        frequency: 1200,
        duration: 0.2,
        gain: 0.2,
        ratePerMinute: 8,
      },
      {
        id: 'siren-2025',
        type: 'siren',
        frequency: 1000,
        duration: 2.5,
        gain: 0.28,
        ratePerMinute: 3,
      },
      {
        id: 'notification-2025',
        type: 'notification',
        frequency: 2400,
        duration: 0.15,
        gain: 0.16,
        ratePerMinute: 12,
      },
      {
        id: 'drone-buzz-2025',
        type: 'chime',
        frequency: 600,
        duration: 0.8,
        gain: 0.18,
        ratePerMinute: 4,
      },
    ],
    music: {
      style: 'hyperpop',
      tempoBpm: 160,
      rootFrequency: 174.61,
      scale: [0, 1, 3, 5, 7, 8, 10],
      gain: 0.16,
    },
  },
};
// ---------------------------------------------------------------------------
// Registry & typed lookups
// ---------------------------------------------------------------------------

/**
 * Ordered, exhaustive registry of all five decades. The order matches the
 * chronological timeline (1945 → 2025) so the HUD slider and transition
 * system can index directly. `as const` would narrow the element type too
 * far for the mutable lookups, so we rely on the explicit `EraSpec[]`
 * annotation plus the `ERA_IDS` tuple for exhaustive iteration.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  ERA_1945,
  ERA_1965,
  ERA_1985,
  ERA_2005,
  ERA_2025,
];

/**
 * Pre-computed O(1) lookup map keyed by EraId. Built once at module load.
 * Using `Record<EraId, EraSpec>` guarantees compile-time exhaustiveness: if a
 * new EraId is added without a matching entry, TypeScript will error.
 */
const ERA_MAP: Readonly<Record<EraId, EraSpec>> = Object.freeze({
  '1945': ERA_1945,
  '1965': ERA_1965,
  '1985': ERA_1985,
  '2005': ERA_2005,
  '2025': ERA_2025,
});

/**
 * Retrieve a single era spec by id.
 *
 * @param id - One of the five EraId values.
 * @returns The matching {@link EraSpec}.
 * @throws {Error} if `id` is not a known era (should be impossible with the
 *   EraId union, but guards against runtime string coercion).
 */
export function getEra(id: EraId): EraSpec {
  const spec = ERA_MAP[id];
  if (!spec) {
    throw new Error(`Unknown era id: "${id}". Expected one of: ${ERA_IDS.join(', ')}`);
  }
  return spec;
}

/**
 * Retrieve all era specs in chronological order. Returns a shallow copy so
 * callers cannot mutate the internal registry.
 *
 * @returns A new array containing all five {@link EraSpec} entries.
 */
export function getAllEras(): EraSpec[] {
  return [...ERA_REGISTRY];
}

/**
 * Convenience: get the era spec immediately adjacent to `id` in the given
 * direction. Returns `null` at the timeline boundaries so callers (e.g. the
 * HUD prev/next buttons) can disable the control.
 *
 * @param id - Current era id.
 * @param direction - +1 for next (newer), -1 for previous (older).
 * @returns The adjacent {@link EraSpec} or `null` if none exists.
 */
export function getAdjacentEra(id: EraId, direction: 1 | -1): EraSpec | null {
  const index = ERA_IDS.indexOf(id);
  if (index === -1) {
    return null;
  }
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ERA_IDS.length) {
    return null;
  }
  return getEra(ERA_IDS[nextIndex]);
}

/**
 * Index of an era within the chronological timeline (0-based). Useful for the
 * HUD slider position and for interpolation between eras.
 *
 * @param id - Era id to look up.
 * @returns Zero-based chronological index (0 = 1945 … 4 = 2025).
 */
export function getEraIndex(id: EraId): number {
  const index = ERA_IDS.indexOf(id);
  if (index === -1) {
    throw new Error(`Unknown era id: "${id}". Expected one of: ${ERA_IDS.join(', ')}`);
  }
  return index;
}

/**
 * Total number of eras. Equivalent to `ERA_IDS.length` but exposed as a
 * stable named constant for clarity in consumer code.
 */
export const ERA_COUNT = ERA_IDS.length;

export {
  ERA_1945,
  ERA_1965,
  ERA_1985,
  ERA_2005,
  ERA_2025,
};
