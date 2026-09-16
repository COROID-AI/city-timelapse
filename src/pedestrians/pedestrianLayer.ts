/**
 * pedestrianLayer.ts — era-driven procedural pedestrian layer.
 *
 * Owns procedural generation of biped pedestrians with per-era outfits
 * (1945 fedoras & overcoats, 1965 suits & dresses, 1985 windbreakers &
 * workout gear, 2005 cargo pants & flip phones, 2025 athleisure &
 * headphones), animated walk cycles, sidewalk routes derived from the shared
 * city-block layout and per-era crosswalk crossing patterns (1945 zebra,
 * 1985 signal, 2025 smart-signal).
 *
 * The layer reads src/core/blockLayout and src/eras/eraSystem READ-ONLY:
 * walk routes come from the shared SIDEWALK/CROSSWALK geometry and outfit
 * garment keys come from each era's frozen `outfits` definition. Every asset
 * is procedural primitives — no external downloads.
 *
 * Integration:
 *  - As a SceneLayer: `runtime.attachLayer(new PedestrianLayer(...))`
 *    registers the pedestrian root into the scene graph and drives `update`
 *    on every `runtime.step()`.
 *  - Direct API: `layer.attach(group)` mounts the root into any Object3D,
 *    `layer.applyEra(eraId, progress)` swaps outfits and walk patterns, and
 *    `layer.dispose()` clears all pedestrians and releases three.js assets.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
} from 'three';

import {
  CROSSWALK,
  ROAD,
  SIDEWALK,
  type Rect,
} from '../core/blockLayout';
import type { FrameState, SceneLayer } from '../core/sceneRuntime';
import { ERAS, getEraDefinition, isEraId, type EraId } from '../eras/eraSystem';

/** Scene layer id used when registering PedestrianLayer with a SceneRuntime. */
export const PEDESTRIAN_LAYER_ID = 'pedestrians';

/** Default number of pedestrians spawned unless overridden. */
export const DEFAULT_PEDESTRIAN_COUNT = 24;

/** Default generative seed for reproducible pedestrians. */
export const DEFAULT_PEDESTRIAN_SEED = 20250916;

/** Flat ground-plane color shared by every procedural outfit list. */
const SKIN_COLOR = '#c99a7d';

/** Comma-joined era ids used in every "unknown era" error message. */
const ERAS_IDS_JOINED = Object.keys(ERAS).join(', ');

/* ------------------------------------------------------------------ *
 * Crossing patterns — the per-era crosswalk behavior contract.
 * ------------------------------------------------------------------ */

/** Crossing technology id used by an era's crosswalk pattern. */
export type CrossingPatternId = 'zebra' | 'signal' | 'countdown' | 'smart-signal';

/** Flavor of crossing behavior the route generator encodes per era. */
export type CrossingBehavior = 'gap' | 'walk-phase' | 'timed' | 'sensor';

/** How pedestrians cross a street in a given era. */
export interface CrossingPattern {
  /** Technology id: 1945 zebra, 1985 signal, 2025 smart-signal. */
  readonly id: CrossingPatternId;
  /** Human-readable label, e.g. "Push-button signal". */
  readonly label: string;
  /** Seconds a pedestrian waits at the curb before stepping out. */
  readonly waitSeconds: number;
  /** Crossing pace in m/s while on the crosswalk strip. */
  readonly crossSpeed: number;
  /** True when pedestrians must yield to traffic gaps (1945 zebra). */
  readonly yieldsToTraffic: boolean;
  /** True for the 1985 push-button demand signal variant. */
  readonly pushButton: boolean;
  readonly behavior: CrossingBehavior;
}

/** Per-era crossing patterns, keyed by era id (deeply frozen). */
export const CROSSING_PATTERNS: Readonly<Record<EraId, CrossingPattern>> = Object.freeze({
  1945: Object.freeze({
    id: 'zebra',
    label: 'Zebra crossing',
    waitSeconds: 1.4,
    crossSpeed: 1.1,
    yieldsToTraffic: true,
    pushButton: false,
    behavior: 'gap',
  }),
  1965: Object.freeze({
    id: 'signal',
    label: "WALK/DON'T WALK signal",
    waitSeconds: 1.2,
    crossSpeed: 1.25,
    yieldsToTraffic: false,
    pushButton: false,
    behavior: 'walk-phase',
  }),
  1985: Object.freeze({
    id: 'signal',
    label: 'Push-button signal',
    waitSeconds: 2.6,
    crossSpeed: 1.3,
    yieldsToTraffic: false,
    pushButton: true,
    behavior: 'walk-phase',
  }),
  2005: Object.freeze({
    id: 'countdown',
    label: 'Countdown signal',
    waitSeconds: 1.6,
    crossSpeed: 1.45,
    yieldsToTraffic: false,
    pushButton: false,
    behavior: 'timed',
  }),
  2025: Object.freeze({
    id: 'smart-signal',
    label: 'Smart signal',
    waitSeconds: 0.5,
    crossSpeed: 1.7,
    yieldsToTraffic: false,
    pushButton: false,
    behavior: 'sensor',
  }),
});

/** Returns the frozen crossing pattern for an era; throws for unknown ids. */
export function getCrossingPattern(era: EraId): CrossingPattern {
  if (!isEraId(era)) {
    throw new Error(`getCrossingPattern: unknown era ${String(era)}; known eras: ${ERAS_IDS_JOINED}`);
  }
  return CROSSING_PATTERNS[era];
}

/* ------------------------------------------------------------------ *
 * Walk patterns — per-era stride, pace and crossing appetite.
 * ------------------------------------------------------------------ */

/** Aggregate pedestrian behavior for one era. */
export interface WalkPattern {
  readonly era: EraId;
  /** Human-readable label, e.g. "Austerity stroll". */
  readonly label: string;
  /** Sidewalk walking pace in m/s. */
  readonly speed: number;
  /** Walk-cycle cadence in Hz (steps per second for the limb swing). */
  readonly stepFrequency: number;
  /** Chance (0..1) that a generated route includes a crosswalk crossing. */
  readonly crossingChance: number;
  readonly crossing: CrossingPattern;
}

/** Per-era walk patterns, keyed by era id (deeply frozen). */
export const WALK_PATTERNS: Readonly<Record<EraId, WalkPattern>> = Object.freeze({
  1945: Object.freeze({
    era: 1945,
    label: 'Austerity stroll',
    speed: 1.12,
    stepFrequency: 1.9,
    crossingChance: 0.18,
    crossing: CROSSING_PATTERNS[1945],
  }),
  1965: Object.freeze({
    era: 1965,
    label: 'Mid-century stride',
    speed: 1.25,
    stepFrequency: 2.0,
    crossingChance: 0.3,
    crossing: CROSSING_PATTERNS[1965],
  }),
  1985: Object.freeze({
    era: 1985,
    label: 'Neon-night pace',
    speed: 1.32,
    stepFrequency: 2.1,
    crossingChance: 0.45,
    crossing: CROSSING_PATTERNS[1985],
  }),
  2005: Object.freeze({
    era: 2005,
    label: 'Digital hustle',
    speed: 1.38,
    stepFrequency: 2.25,
    crossingChance: 0.35,
    crossing: CROSSING_PATTERNS[2005],
  }),
  2025: Object.freeze({
    era: 2025,
    label: 'Connected rush',
    speed: 1.5,
    stepFrequency: 2.4,
    crossingChance: 0.55,
    crossing: CROSSING_PATTERNS[2025],
  }),
});

/** Returns the frozen walk pattern for an era; throws for unknown ids. */
export function getWalkPattern(era: EraId): WalkPattern {
  if (!isEraId(era)) {
    throw new Error(`getWalkPattern: unknown era ${String(era)}; known eras: ${ERAS_IDS_JOINED}`);
  }
  return WALK_PATTERNS[era];
}

/**
 * Deterministic fingerprint of everything that changes pedestrian behavior
 * between eras. Two eras share a fingerprint only if their whole walking
 * behavior is identical.
 */
export function walkPatternFingerprint(pattern: WalkPattern): string {
  return JSON.stringify([
    pattern.speed,
    pattern.stepFrequency,
    pattern.crossingChance,
    pattern.crossing.id,
    pattern.crossing.waitSeconds,
    pattern.crossing.crossSpeed,
    pattern.crossing.pushButton,
  ]);
}

/* ------------------------------------------------------------------ *
 * Outfit sets — concrete procedural garment per era.
 * ------------------------------------------------------------------ */

/** A full garment recipe for one era style (procedural, data only). */
export interface OutfitPreset {
  /** Style key from the era registry's `outfits.styles`. */
  readonly style: string;
  /** Human-readable label, e.g. "Overcoat & fedora". */
  readonly label: string;
  readonly headwear: string | null;
  readonly top: string;
  readonly bottom: string;
  readonly footwear: string;
  readonly accessory: string | null;
  readonly handheld: string | null;
}

/**
 * Five per-era outfit sets, keyed by era id. Garment labels are thematic
 * (1945 fedoras & overcoats, 1965 suits & dresses, 1985 windbreakers &
 * workout gear, 2005 cargo pants & flip phones, 2025 athleisure &
 * headphones) and every `style` appears in the era registry read-only.
 */
export const OUTFIT_PRESETS: Readonly<Record<EraId, readonly OutfitPreset[]>> = Object.freeze({
  1945: Object.freeze([
    Object.freeze({
      style: 'fedora-overcoat',
      label: 'Overcoat & fedora',
      headwear: 'fedora',
      top: 'overcoat',
      bottom: 'wool-trousers',
      footwear: 'lace-up-shoes',
      accessory: 'gloves',
      handheld: 'newspaper',
    }),
    Object.freeze({
      style: 'wool-suit',
      label: 'Wool suit',
      headwear: 'fedora',
      top: 'suit-jacket',
      bottom: 'suit-trousers',
      footwear: 'brogues',
      accessory: 'tie',
      handheld: 'briefcase',
    }),
    Object.freeze({
      style: 'printed-dress',
      label: 'Printed dress',
      headwear: 'cloche',
      top: 'printed-dress',
      bottom: 'stockings',
      footwear: 'low-heels',
      accessory: 'brooch',
      handheld: 'handbag',
    }),
    Object.freeze({
      style: 'work-trousers',
      label: 'Work clothes',
      headwear: 'newsboy-cap',
      top: 'work-shirt',
      bottom: 'work-trousers',
      footwear: 'work-boots',
      accessory: 'gloves',
      handheld: 'lunch-pail',
    }),
  ]),
  1965: Object.freeze([
    Object.freeze({
      style: 'tailored-suit',
      label: 'Tailored suit',
      headwear: null,
      top: 'suit-jacket',
      bottom: 'suit-trousers',
      footwear: 'oxfords',
      accessory: 'tie',
      handheld: 'briefcase',
    }),
    Object.freeze({
      style: 'pencil-dress',
      label: 'Pencil dress',
      headwear: 'pillbox-hat',
      top: 'pencil-dress',
      bottom: 'petticoat',
      footwear: 'low-heels',
      accessory: 'pearls',
      handheld: 'handbag',
    }),
    Object.freeze({
      style: 'sweater-set',
      label: 'Sweater set',
      headwear: null,
      top: 'sweater-set',
      bottom: 'capri-pants',
      footwear: 'flats',
      accessory: 'pearls',
      handheld: 'handbag',
    }),
    Object.freeze({
      style: 'trench-coat',
      label: 'Trench coat',
      headwear: 'fedora',
      top: 'trench-coat',
      bottom: 'suit-trousers',
      footwear: 'oxfords',
      accessory: 'gloves',
      handheld: 'umbrella',
    }),
  ]),
  1985: Object.freeze([
    Object.freeze({
      style: 'windbreaker',
      label: 'Windbreaker',
      headwear: null,
      top: 'windbreaker',
      bottom: 'jeans',
      footwear: 'sneakers',
      accessory: 'sunglasses',
      handheld: 'grocery-bag',
    }),
    Object.freeze({
      style: 'workout-gear',
      label: 'Workout gear',
      headwear: 'headband',
      top: 'sweatshirt',
      bottom: 'sweatpants',
      footwear: 'running-shoes',
      accessory: 'walkman',
      handheld: 'boombox',
    }),
    Object.freeze({
      style: 'neon-tee',
      label: 'Neon tee',
      headwear: null,
      top: 'neon-tee',
      bottom: 'jeans',
      footwear: 'sneakers',
      accessory: 'fanny-pack',
      handheld: 'boombox',
    }),
    Object.freeze({
      style: 'denim-jacket',
      label: 'Denim jacket',
      headwear: null,
      top: 'denim-jacket',
      bottom: 'jeans',
      footwear: 'high-tops',
      accessory: 'sunglasses',
      handheld: 'camera',
    }),
  ]),
  2005: Object.freeze([
    Object.freeze({
      style: 'cargo-pants',
      label: 'Cargo pants',
      headwear: null,
      top: 'graphic-tee',
      bottom: 'cargo-pants',
      footwear: 'sneakers',
      accessory: 'flip-phone',
      handheld: 'flip-phone',
    }),
    Object.freeze({
      style: 'low-rise-jeans',
      label: 'Low-rise jeans',
      headwear: null,
      top: 'graphic-tee',
      bottom: 'low-rise-jeans',
      footwear: 'flip-flops',
      accessory: 'mp3-player',
      handheld: 'backpack',
    }),
    Object.freeze({
      style: 'graphic-tee',
      label: 'Graphic tee',
      headwear: 'backwards-cap',
      top: 'graphic-tee',
      bottom: 'cargo-pants',
      footwear: 'sneakers',
      accessory: 'mp3-player',
      handheld: 'headphones',
    }),
    Object.freeze({
      style: 'track-jacket',
      label: 'Track jacket',
      headwear: null,
      top: 'track-jacket',
      bottom: 'track-pants',
      footwear: 'trainers',
      accessory: 'backpack',
      handheld: 'coffee-cup',
    }),
    Object.freeze({
      style: 'polo',
      label: 'Polo shirt',
      headwear: null,
      top: 'polo',
      bottom: 'khakis',
      footwear: 'loafers',
      accessory: 'flip-phone',
      handheld: 'coffee-cup',
    }),
  ]),
  2025: Object.freeze([
    Object.freeze({
      style: 'athleisure',
      label: 'Athleisure',
      headwear: null,
      top: 'tech-fleece-jacket',
      bottom: 'joggers',
      footwear: 'running-shoes',
      accessory: 'wireless-earbuds',
      handheld: 'smartphone',
    }),
    Object.freeze({
      style: 'hoodie',
      label: 'Hoodie',
      headwear: null,
      top: 'hoodie',
      bottom: 'joggers',
      footwear: 'sneakers',
      accessory: 'wireless-earbuds',
      handheld: 'smartphone',
    }),
    Object.freeze({
      style: 'baseball-cap',
      label: 'Baseball cap',
      headwear: 'baseball-cap',
      top: 'tee',
      bottom: 'shorts',
      footwear: 'sneakers',
      accessory: 'smart-watch',
      handheld: 'coffee-cup',
    }),
    Object.freeze({
      style: 'yoga-set',
      label: 'Yoga set',
      headwear: null,
      top: 'yoga-top',
      bottom: 'leggings',
      footwear: 'training-shoes',
      accessory: 'smart-watch',
      handheld: 'tote-bag',
    }),
    Object.freeze({
      style: 'puffer-jacket',
      label: 'Puffer jacket',
      headwear: null,
      top: 'puffer-jacket',
      bottom: 'jeans',
      footwear: 'boots',
      accessory: 'tote-bag',
      handheld: 'tote-bag',
    }),
  ]),
});

/** Per-part colors assigned to one pedestrian outfit. */
export interface OutfitColors {
  readonly headwear: string;
  readonly top: string;
  readonly bottom: string;
  readonly footwear: string;
  readonly accessory: string;
  readonly handheld: string;
}

/** A fully resolved pedestrian outfit for one era. */
export interface Outfit {
  readonly era: EraId;
  /** Style key matching the era registry, e.g. "fedora-overcoat". */
  readonly style: string;
  readonly preset: OutfitPreset;
  readonly colors: OutfitColors;
}

/**
 * Builds a deterministic outfit for `era` from the era registry's palette and
 * this module's garment presets. `random` supplies uniform [0, 1) values.
 */
export function buildOutfit(era: EraId, random: () => number): Outfit {
  if (!isEraId(era)) {
    throw new Error(`buildOutfit: unknown era ${String(era)}; known eras: ${ERAS_IDS_JOINED}`);
  }
  const presets = OUTFIT_PRESETS[era];
  const palette = getEraDefinition(era).outfits.palette;
  const preset = presets[Math.floor(random() * presets.length)];
  const pick = (): string => palette[Math.floor(random() * palette.length)];
  return {
    era,
    style: preset.style,
    preset,
    colors: {
      headwear: pick(),
      top: pick(),
      bottom: pick(),
      footwear: pick(),
      accessory: pick(),
      handheld: pick(),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Deterministic RNG.
 * ------------------------------------------------------------------ */

/** Small deterministic PRNG (mulberry32) returning uniform [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Walk routes — sidewalk ring + crosswalk crossings from blockLayout.
 * ------------------------------------------------------------------ */

/** 2D point on the ground plane (x = east, z = north). */
export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

/** One leg of a crosswalk crossing, derived from a shared CROSSWALK strip. */
export interface CrossingLeg {
  /** Strip key, e.g. "northWest", matching the CROSSWALK export names. */
  readonly id: string;
  readonly label: string;
  /** The shared frozen strip rect this leg traverses. */
  readonly strip: Rect;
  /** Axis the pedestrian travels along while crossing. */
  readonly axis: 'x' | 'z';
  /** +1 toward the world edge, -1 toward the block. */
  readonly direction: 1 | -1;
  /** Curb-side point where the crossing segment begins (on the strip). */
  readonly entry: Vec2;
  /** Far-edge point where the crossing route ends (on the strip). */
  readonly exit: Vec2;
}

/** One leg of a procedural walk route. */
export interface RouteSegment {
  readonly kind: 'sidewalk' | 'crossing';
  readonly from: Vec2;
  readonly to: Vec2;
  /** Present on crossing segments: which crosswalk leg is traversed. */
  readonly crossingLegId?: string;
}

/** A pedestrian's procedural path through the block. */
export interface WalkRoute {
  readonly id: string;
  readonly segments: readonly RouteSegment[];
}

/** Options controlling procedural route generation. */
export interface GenerateRouteOptions {
  /** When true, always produce a route ending with a crosswalk crossing. */
  readonly forceCrossing?: boolean;
  /** Crossing chance used when forceCrossing is unset (0..1). */
  readonly crossingRatio?: number;
}

const SIDEWALK_CENTER_Z = SIDEWALK.north.minZ + SIDEWALK.width / 2; // 51.5
const SIDEWALK_CENTER_X = SIDEWALK.east.minX + SIDEWALK.width / 2; // 61.5

const CROSSWALK_STRIP_ORDER: Readonly<Array<{ id: string; strip: Rect }>> = Object.freeze([
  { id: 'northWest', strip: CROSSWALK.northWest },
  { id: 'northEast', strip: CROSSWALK.northEast },
  { id: 'eastNorth', strip: CROSSWALK.eastNorth },
  { id: 'eastSouth', strip: CROSSWALK.eastSouth },
  { id: 'southEast', strip: CROSSWALK.southEast },
  { id: 'southWest', strip: CROSSWALK.southWest },
  { id: 'westSouth', strip: CROSSWALK.westSouth },
  { id: 'westNorth', strip: CROSSWALK.westNorth },
]);

/** The four sidewalk ring corners in clockwise order, from the shared layout. */
export function sidewalkCorners(): readonly Vec2[] {
  return Object.freeze([
    Object.freeze({ x: -SIDEWALK_CENTER_X, z: SIDEWALK_CENTER_Z }), // NW
    Object.freeze({ x: SIDEWALK_CENTER_X, z: SIDEWALK_CENTER_Z }), // NE
    Object.freeze({ x: SIDEWALK_CENTER_X, z: -SIDEWALK_CENTER_Z }), // SE
    Object.freeze({ x: -SIDEWALK_CENTER_X, z: -SIDEWALK_CENTER_Z }), // SW
  ]);
}

/**
 * Derives four closed sidewalk loop routes from the shared SIDEWALK ring.
 * Every segment stays inside the modeled sidewalk band; each route starts at
 * a different corner so pedestrians enter the loop at varied points.
 */
export function deriveSidewalkRoutes(): readonly WalkRoute[] {
  const corners = sidewalkCorners();
  const routes: WalkRoute[] = [];
  for (let start = 0; start < corners.length; start += 1) {
    const segments: RouteSegment[] = [];
    for (let step = 0; step < corners.length; step += 1) {
      segments.push({
        kind: 'sidewalk',
        from: corners[(start + step) % corners.length],
        to: corners[(start + step + 1) % corners.length],
      });
    }
    routes.push({ id: `sidewalk-ring-${start}`, segments });
  }
  return routes;
}

/**
 * Derives eight crosswalk crossing legs from the shared CROSSWALK strips.
 * Each leg starts on the sidewalk-side edge of its strip and ends just inside
 * the world boundary, so the crossing stays on the painted strip.
 */
export function deriveCrosswalkLegs(): readonly CrossingLeg[] {
  const legs: CrossingLeg[] = [];
  for (const { id, strip } of CROSSWALK_STRIP_ORDER) {
    const crossingAlongZ = strip.depth === ROAD.width;
    const axis = crossingAlongZ ? 'z' : 'x';
    const direction: 1 | -1 =
      axis === 'z'
        ? strip.minZ > SIDEWALK.north.minZ
          ? 1
          : -1
        : strip.minX > SIDEWALK.west.minX
          ? 1
          : -1;
    const cx = (strip.minX + strip.maxX) / 2;
    const cz = (strip.minZ + strip.maxZ) / 2;
    const entry: Vec2 =
      axis === 'z'
        ? { x: cx, z: direction > 0 ? strip.minZ : strip.maxZ }
        : { x: direction > 0 ? strip.minX : strip.maxX, z: cz };
    const exit: Vec2 =
      axis === 'z'
        ? { x: cx, z: direction > 0 ? strip.maxZ - 0.5 : strip.minZ + 0.5 }
        : { x: direction > 0 ? strip.maxX - 0.5 : strip.minX + 0.5, z: cz };
    legs.push({
      id,
      label: `Crosswalk ${id}`,
      strip,
      axis,
      direction,
      entry,
      exit,
    });
  }
  return legs;
}

const CORNER_BY_LEG: Readonly<Record<string, Vec2>> = Object.freeze({
  northWest: sidewalkCorners()[0],
  northEast: sidewalkCorners()[1],
  eastNorth: sidewalkCorners()[1],
  eastSouth: sidewalkCorners()[2],
  southEast: sidewalkCorners()[2],
  southWest: sidewalkCorners()[3],
  westSouth: sidewalkCorners()[3],
  westNorth: sidewalkCorners()[0],
});

const APPROACH_SIDE_BY_LEG: Readonly<Record<string, 'north' | 'east' | 'south' | 'west'>> =
  Object.freeze({
    northWest: 'west',
    northEast: 'east',
    eastNorth: 'north',
    eastSouth: 'south',
    southEast: 'east',
    southWest: 'west',
    westSouth: 'south',
    westNorth: 'north',
  });

function randomStartOnSide(
  side: 'north' | 'east' | 'south' | 'west',
  random: () => number,
): Vec2 {
  // Keep 1 m away from the ring corners so the approach is clearly on a band.
  const halfX = SIDEWALK.north.width / 2 - 1;
  const halfZ = SIDEWALK.west.depth / 2 - 1;
  switch (side) {
    case 'north':
      return { x: -halfX + random() * 2 * halfX, z: SIDEWALK_CENTER_Z };
    case 'south':
      return { x: -halfX + random() * 2 * halfX, z: -SIDEWALK_CENTER_Z };
    case 'east':
      return { x: SIDEWALK_CENTER_X, z: -halfZ + random() * 2 * halfZ };
    case 'west':
      return { x: -SIDEWALK_CENTER_X, z: -halfZ + random() * 2 * halfZ };
  }
}

/** A sidewalk walk to a ring corner followed by a crosswalk crossing. */
function buildCrossingRoute(random: () => number, era: EraId): WalkRoute {
  const legs = deriveCrosswalkLegs();
  const leg = legs[Math.floor(random() * legs.length)];
  const corner = CORNER_BY_LEG[leg.id];
  const start = randomStartOnSide(APPROACH_SIDE_BY_LEG[leg.id], random);
  return {
    id: `crossing-${leg.id}-${era}`,
    segments: [
      { kind: 'sidewalk', from: start, to: corner },
      { kind: 'crossing', from: leg.entry, to: leg.exit, crossingLegId: leg.id },
    ],
  };
}

/** A closed sidewalk loop around the block. */
function buildRingRoute(random: () => number, era: EraId): WalkRoute {
  const corners = sidewalkCorners();
  const startIdx = Math.floor(random() * corners.length);
  const clockwise = random() < 0.5;
  const segments: RouteSegment[] = [];
  for (let step = 0; step < corners.length; step += 1) {
    const from = corners[(startIdx + step) % corners.length];
    const to = corners[(startIdx + step + (clockwise ? 1 : -1) + corners.length) % corners.length];
    segments.push({ kind: 'sidewalk', from, to });
  }
  return { id: `sidewalk-ring-${era}-${startIdx}`, segments };
}

/**
 * Generates one procedural walk route for `era`: either a sidewalk ring loop
 * or a sidewalk approach terminating in a crosswalk crossing (the route ends
 * at the far edge of the street, where the pedestrian leaves the block).
 */
export function generateWalkRoute(
  random: () => number,
  era: EraId,
  options: GenerateRouteOptions = {},
): WalkRoute {
  if (!isEraId(era)) {
    throw new Error(`generateWalkRoute: unknown era ${String(era)}; known eras: ${ERAS_IDS_JOINED}`);
  }
  const pattern = getWalkPattern(era);
  const wantsCrossing =
    options.forceCrossing ?? random() < (options.crossingRatio ?? pattern.crossingChance);
  return wantsCrossing ? buildCrossingRoute(random, era) : buildRingRoute(random, era);
}

/* ------------------------------------------------------------------ *
 * Procedural pedestrian rig — primitives, no external assets.
 * ------------------------------------------------------------------ */

/** Shared geometry cache so every pedestrian reuses the same primitives. */
interface SharedGeometries {
  readonly torso: BufferGeometry;
  readonly leg: BufferGeometry;
  readonly arm: BufferGeometry;
  readonly head: BufferGeometry;
  readonly shoe: BufferGeometry;
  readonly hand: BufferGeometry;
  readonly fedoraBrim: BufferGeometry;
  readonly fedoraCrown: BufferGeometry;
  readonly cap: BufferGeometry;
  readonly pillbox: BufferGeometry;
  readonly headband: BufferGeometry;
  readonly earbud: BufferGeometry;
  readonly tie: BufferGeometry;
  readonly phone: BufferGeometry;
  readonly walkman: BufferGeometry;
  readonly pack: BufferGeometry;
  readonly glasses: BufferGeometry;
  readonly backpack: BufferGeometry;
  readonly watch: BufferGeometry;
  readonly prop: BufferGeometry;
  readonly boombox: BufferGeometry;
  readonly newspaper: BufferGeometry;
}

function createSharedGeometries(): SharedGeometries {
  return {
    torso: new BoxGeometry(0.44, 0.55, 0.26),
    leg: new BoxGeometry(0.14, 0.9, 0.16),
    arm: new BoxGeometry(0.11, 0.62, 0.12),
    head: new SphereGeometry(0.17, 12, 10),
    shoe: new BoxGeometry(0.15, 0.07, 0.28),
    hand: new SphereGeometry(0.06, 8, 6),
    fedoraBrim: new CylinderGeometry(0.26, 0.26, 0.03, 16),
    fedoraCrown: new CylinderGeometry(0.15, 0.16, 0.14, 12),
    cap: new BoxGeometry(0.26, 0.12, 0.26),
    pillbox: new CylinderGeometry(0.11, 0.12, 0.1, 14),
    headband: new BoxGeometry(0.24, 0.04, 0.02),
    earbud: new SphereGeometry(0.035, 8, 6),
    tie: new BoxGeometry(0.12, 0.24, 0.03),
    phone: new BoxGeometry(0.07, 0.11, 0.02),
    walkman: new BoxGeometry(0.12, 0.16, 0.04),
    pack: new BoxGeometry(0.22, 0.14, 0.08),
    glasses: new BoxGeometry(0.2, 0.05, 0.02),
    backpack: new BoxGeometry(0.3, 0.42, 0.14),
    watch: new BoxGeometry(0.05, 0.07, 0.02),
    prop: new BoxGeometry(0.16, 0.22, 0.08),
    boombox: new BoxGeometry(0.3, 0.16, 0.12),
    newspaper: new BoxGeometry(0.2, 0.26, 0.02),
  };
}

/** Animated limb pivots of one pedestrian, exposed for walk-cycle driving. */
interface Rig {
  readonly root: Group;
  readonly leftLeg: Group;
  readonly rightLeg: Group;
  readonly leftArm: Group;
  readonly rightArm: Group;
}

function addHeadwear(
  pivot: Group,
  outfit: Outfit,
  shared: SharedGeometries,
  materialFor: (hex: string) => MeshStandardMaterial,
): void {
  const headwear = outfit.preset.headwear;
  if (!headwear) return;
  const material = materialFor(outfit.colors.headwear);
  const name = `part:headwear:${headwear}`;
  switch (headwear) {
    case 'fedora': {
      const crown = new Mesh(shared.fedoraCrown, material);
      crown.position.y = 0.27;
      crown.name = name;
      pivot.add(crown);
      const brim = new Mesh(shared.fedoraBrim, material);
      brim.position.y = 0.2;
      brim.name = name;
      pivot.add(brim);
      break;
    }
    case 'cloche':
    case 'pillbox-hat': {
      const hat = new Mesh(shared.pillbox, material);
      hat.position.y = 0.2;
      hat.name = name;
      pivot.add(hat);
      break;
    }
    case 'headband': {
      const band = new Mesh(shared.headband, material);
      band.position.y = 0.16;
      band.name = name;
      pivot.add(band);
      break;
    }
    default: {
      // caps (newsboy, backwards, baseball) — a low dome over the head.
      const cap = new Mesh(shared.cap, material);
      cap.position.y = 0.18;
      cap.name = name;
      pivot.add(cap);
      break;
    }
  }
}

function addAccessory(
  body: Group,
  outfit: Outfit,
  shared: SharedGeometries,
  materialFor: (hex: string) => MeshStandardMaterial,
): void {
  const accessory = outfit.preset.accessory;
  if (!accessory) return;
  const material = materialFor(outfit.colors.accessory);
  const name = `part:accessory:${accessory}`;
  switch (accessory) {
    case 'wireless-earbuds': {
      const left = new Mesh(shared.earbud, material);
      left.position.set(-0.1, 0.68, 0.06);
      left.name = name;
      body.add(left);
      const right = new Mesh(shared.earbud, material);
      right.position.set(0.1, 0.68, 0.06);
      right.name = name;
      body.add(right);
      break;
    }
    case 'pearls': {
      const pearls = new Mesh(shared.earbud, material);
      pearls.position.set(0, 0.5, 0.16);
      pearls.scale.set(2, 1.5, 1);
      pearls.name = name;
      body.add(pearls);
      break;
    }
    case 'tie': {
      const tie = new Mesh(shared.tie, material);
      tie.position.set(0, 0.2, 0.15);
      tie.name = name;
      body.add(tie);
      break;
    }
    case 'flip-phone': {
      const phone = new Mesh(shared.phone, material);
      phone.position.set(0.27, 0.5, 0.1);
      phone.name = name;
      body.add(phone);
      break;
    }
    case 'walkman': {
      const player = new Mesh(shared.walkman, material);
      player.position.set(-0.2, 0.16, 0.04);
      player.name = name;
      body.add(player);
      break;
    }
    case 'fanny-pack': {
      const pack = new Mesh(shared.pack, material);
      pack.position.set(0, 0.1, 0.15);
      pack.name = name;
      body.add(pack);
      break;
    }
    case 'sunglasses': {
      const glasses = new Mesh(shared.glasses, material);
      glasses.position.set(0, 0.6, 0.17);
      glasses.name = name;
      body.add(glasses);
      break;
    }
    case 'backpack': {
      const backpack = new Mesh(shared.backpack, material);
      backpack.position.set(0, 0.34, -0.15);
      backpack.name = name;
      body.add(backpack);
      break;
    }
    case 'smart-watch': {
      const watch = new Mesh(shared.watch, material);
      watch.position.set(-0.27, 0.6, 0.08);
      watch.name = name;
      body.add(watch);
      break;
    }
    case 'mp3-player': {
      const player = new Mesh(shared.phone, material);
      player.position.set(0.24, 0.48, 0.08);
      player.name = name;
      body.add(player);
      break;
    }
    case 'tote-bag': {
      const bag = new Mesh(shared.backpack, material);
      bag.position.set(0.34, 0.36, 0.08);
      bag.scale.set(0.7, 0.9, 0.6);
      bag.name = name;
      body.add(bag);
      break;
    }
    case 'gloves': {
      const leftGlove = new Mesh(shared.hand, material);
      leftGlove.position.set(-0.2, 0.6, 0.05);
      leftGlove.name = name;
      body.add(leftGlove);
      const rightGlove = new Mesh(shared.hand, material);
      rightGlove.position.set(0.2, 0.6, 0.05);
      rightGlove.name = name;
      body.add(rightGlove);
      break;
    }
    case 'brooch': {
      const brooch = new Mesh(shared.earbud, material);
      brooch.position.set(0, 0.42, 0.16);
      brooch.scale.set(1.6, 1.6, 1);
      brooch.name = name;
      body.add(brooch);
      break;
    }
    default: {
      const dot = new Mesh(shared.earbud, material);
      dot.position.set(0.24, 0.6, 0.1);
      dot.name = name;
      body.add(dot);
      break;
    }
  }
}

function addHandheld(
  body: Group,
  outfit: Outfit,
  shared: SharedGeometries,
  materialFor: (hex: string) => MeshStandardMaterial,
): void {
  const handheld = outfit.preset.handheld;
  if (!handheld) return;
  const material = materialFor(outfit.colors.handheld);
  const name = `part:handheld:${handheld}`;
  const geometry =
    handheld === 'boombox'
      ? shared.boombox
      : handheld === 'newspaper' || handheld === 'headphones'
        ? shared.newspaper
        : shared.prop;
  const prop = new Mesh(geometry, material);
  prop.position.set(0.3, 0.72, 0.14);
  prop.name = name;
  body.add(prop);
}

/**
 * Builds one procedural biped from shared primitives. All geometry is
 * created once per layer and reused; only materials vary per outfit part.
 */
function buildPedestrianRig(
  outfit: Outfit,
  shared: SharedGeometries,
  materialFor: (hex: string) => MeshStandardMaterial,
): Rig {
  const root = new Group();
  const body = new Group();
  body.position.y = 0.95;
  root.add(body);

  const torso = new Mesh(shared.torso, materialFor(outfit.colors.top));
  torso.position.y = 0.25;
  torso.name = 'part:top';
  body.add(torso);

  const hips = new Mesh(shared.pack, materialFor(outfit.colors.bottom));
  hips.position.y = 0.02;
  hips.scale.set(1.4, 0.8, 1.3);
  hips.name = 'part:bottom';
  body.add(hips);

  const headPivot = new Group();
  headPivot.position.y = 0.66;
  const head = new Mesh(shared.head, materialFor(SKIN_COLOR));
  head.position.y = 0.13;
  head.name = 'part:head';
  headPivot.add(head);
  addHeadwear(headPivot, outfit, shared, materialFor);
  body.add(headPivot);

  const leftLegPivot = new Group();
  leftLegPivot.position.set(-0.12, 0.02, 0);
  const leftLeg = new Mesh(shared.leg, materialFor(outfit.colors.bottom));
  leftLeg.position.y = -0.45;
  leftLeg.name = 'part:leg';
  leftLegPivot.add(leftLeg);
  const leftShoe = new Mesh(shared.shoe, materialFor(outfit.colors.footwear));
  leftShoe.position.set(0, -0.88, 0.04);
  leftShoe.name = 'part:footwear';
  leftLegPivot.add(leftShoe);
  body.add(leftLegPivot);

  const rightLegPivot = new Group();
  rightLegPivot.position.set(0.12, 0.02, 0);
  const rightLeg = new Mesh(shared.leg, materialFor(outfit.colors.bottom));
  rightLeg.position.y = -0.45;
  rightLeg.name = 'part:leg';
  rightLegPivot.add(rightLeg);
  const rightShoe = new Mesh(shared.shoe, materialFor(outfit.colors.footwear));
  rightShoe.position.set(0, -0.88, 0.04);
  rightShoe.name = 'part:footwear';
  rightLegPivot.add(rightShoe);
  body.add(rightLegPivot);

  const leftArmPivot = new Group();
  leftArmPivot.position.set(-0.28, 0.48, 0);
  const leftArm = new Mesh(shared.arm, materialFor(outfit.colors.top));
  leftArm.position.y = -0.31;
  leftArm.name = 'part:arm';
  leftArmPivot.add(leftArm);
  const leftHand = new Mesh(shared.hand, materialFor(SKIN_COLOR));
  leftHand.position.y = -0.63;
  leftHand.name = 'part:hand';
  leftArmPivot.add(leftHand);
  body.add(leftArmPivot);

  const rightArmPivot = new Group();
  rightArmPivot.position.set(0.28, 0.48, 0);
  const rightArm = new Mesh(shared.arm, materialFor(outfit.colors.top));
  rightArm.position.y = -0.31;
  rightArm.name = 'part:arm';
  rightArmPivot.add(rightArm);
  const rightHand = new Mesh(shared.hand, materialFor(SKIN_COLOR));
  rightHand.position.y = -0.63;
  rightHand.name = 'part:hand';
  rightArmPivot.add(rightHand);
  body.add(rightArmPivot);

  addAccessory(body, outfit, shared, materialFor);
  addHandheld(body, outfit, shared, materialFor);

  return {
    root,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    leftArm: leftArmPivot,
    rightArm: rightArmPivot,
  };
}

/* ------------------------------------------------------------------ *
 * Pedestrian actor — per-pedestrian state, movement and walk cycle.
 * ------------------------------------------------------------------ */

type ActorState = 'walking' | 'waiting' | 'done';

/** One animated pedestrian moving along its procedural walk route. */
class PedestrianActor {
  readonly root = new Group();
  readonly outfit: Outfit;
  readonly index: number;
  route: WalkRoute;
  state: ActorState = 'walking';

  private segmentIndex = 0;
  private distanceAlong = 0;
  private waitRemaining = 0;
  private phase: number;
  private readonly leftLeg: Group;
  private readonly rightLeg: Group;
  private readonly leftArm: Group;
  private readonly rightArm: Group;
  private readonly random: () => number;

  constructor(outfit: Outfit, route: WalkRoute, rig: Rig, index: number, random: () => number) {
    this.outfit = outfit;
    this.route = route;
    this.index = index;
    this.random = random;
    this.phase = random() * Math.PI * 2;
    this.leftLeg = rig.leftLeg;
    this.rightLeg = rig.rightLeg;
    this.leftArm = rig.leftArm;
    this.rightArm = rig.rightArm;
    this.root.add(rig.root);
    this.snapToRouteStart();
  }

  private snapToRouteStart(): void {
    const first = this.route.segments[0];
    this.segmentIndex = 0;
    this.distanceAlong = 0;
    this.waitRemaining = 0;
    this.state = 'walking';
    this.root.position.set(first.from.x, 0, first.from.z);
    this.faceAlong(first);
  }

  private faceAlong(segment: RouteSegment): void {
    const dx = segment.to.x - segment.from.x;
    const dz = segment.to.z - segment.from.z;
    if (dx === 0 && dz === 0) return;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  /** Halts at the curb while the era's crossing pattern says to wait. */
  update(delta: number, pattern: WalkPattern): void {
    if (this.state === 'done') return;
    if (this.state === 'waiting') {
      this.waitRemaining -= delta;
      if (this.waitRemaining <= 0) this.state = 'walking';
      return;
    }
    const segment = this.route.segments[this.segmentIndex];
    if (!segment) {
      this.state = 'done';
      return;
    }
    const speed = segment.kind === 'crossing' ? pattern.crossing.crossSpeed : pattern.speed;
    this.advanceAlong(segment, speed * delta, pattern);
    this.phase += pattern.stepFrequency * Math.PI * 2 * delta;
    this.applyWalkCycle();
  }

  private advanceAlong(segment: RouteSegment, distance: number, pattern: WalkPattern): void {
    const dx = segment.to.x - segment.from.x;
    const dz = segment.to.z - segment.from.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0) {
      this.completeSegment(pattern);
      return;
    }
    this.distanceAlong += distance;
    if (this.distanceAlong < length) {
      const t = this.distanceAlong / length;
      this.root.position.x = segment.from.x + dx * t;
      this.root.position.z = segment.from.z + dz * t;
      return;
    }
    this.root.position.x = segment.to.x;
    this.root.position.z = segment.to.z;
    this.completeSegment(pattern);
  }

  private completeSegment(pattern: WalkPattern): void {
    this.segmentIndex += 1;
    this.distanceAlong = 0;
    const next = this.route.segments[this.segmentIndex];
    if (!next) {
      this.state = 'done';
      return;
    }
    if (next.kind === 'crossing') {
      this.state = 'waiting';
      this.waitRemaining = pattern.crossing.waitSeconds;
      return;
    }
    this.state = 'walking';
    this.root.position.x = next.from.x;
    this.root.position.z = next.from.z;
    this.faceAlong(next);
  }

  /** Counter-swinging limbs and a slight bob make up the walk cycle. */
  private applyWalkCycle(): void {
    const swing = 0.55 * Math.sin(this.phase);
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.8;
    this.rightArm.rotation.x = swing * 0.8;
    this.root.position.y = 0.03 * Math.abs(Math.sin(this.phase));
  }

  /** Swap to a new route; used when the previous route completes. */
  respawn(route: WalkRoute): void {
    this.route = route;
    this.phase = this.random() * Math.PI * 2;
    this.snapToRouteStart();
  }

  getPhase(): number {
    return this.phase;
  }

  getLeftLegSwing(): number {
    return this.leftLeg.rotation.x;
  }
}

/* ------------------------------------------------------------------ *
 * PedestrianLayer — attach / applyEra / dispose scene-layer contract.
 * ------------------------------------------------------------------ */

/** Options controlling the pedestrian layer. */
export interface PedestrianLayerOptions {
  /** Number of pedestrians to spawn (default 24). */
  readonly count?: number;
  /** Initial era (default 1945). */
  readonly era?: EraId;
  /** Deterministic generation seed (default DEFAULT_PEDESTRIAN_SEED). */
  readonly seed?: number;
  /** Global speed multiplier applied in update() (default 1). */
  readonly speedScale?: number;
  /** Fraction (0..1) of routes that include a crosswalk crossing. */
  readonly crossingRatio?: number;
}

/** Observable snapshot of the layer for tests and integration tooling. */
export interface PedestrianSnapshot {
  readonly era: EraId;
  readonly progress: number;
  readonly pattern: WalkPattern;
  readonly count: number;
  readonly positions: readonly Vec2[];
  readonly walkPhases: readonly number[];
  readonly limbSwing: readonly number[];
  readonly outfits: readonly Outfit[];
  readonly routes: readonly WalkRoute[];
}

/**
 * Procedural, era-driven pedestrian layer.
 *
 * Implements the SceneLayer contract (`id`, `createRoot`, `update`,
 * `dispose`) so it registers and animates inside a headless SceneRuntime,
 * while also exposing the direct plan API:
 *  - `attach(group)` — mount the pedestrian root into any scene graph group.
 *  - `applyEra(eraId, progress)` — swap outfit sets and walk patterns.
 *  - `dispose()` — clear all pedestrians and release three.js assets.
 */
export class PedestrianLayer implements SceneLayer {
  readonly id = PEDESTRIAN_LAYER_ID;

  private readonly root = new Group();
  private readonly actors: PedestrianActor[] = [];
  private readonly materialCache = new Map<string, MeshStandardMaterial>();
  private readonly shared: SharedGeometries;
  private readonly count: number;
  private readonly seed: number;
  private readonly speedScale: number;
  private readonly crossingRatio: number;

  private era: EraId;
  private walkPattern: WalkPattern;
  private progress = 0;
  private disposed = false;

  constructor(options: PedestrianLayerOptions = {}) {
    if (!isEraId(options.era ?? 1945)) {
      throw new Error(`PedestrianLayer: unknown era ${String(options.era)}; known eras: ${ERAS_IDS_JOINED}`);
    }
    const count = options.count ?? DEFAULT_PEDESTRIAN_COUNT;
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`PedestrianLayer: count must be a non-negative integer, got ${String(count)}`);
    }
    const seed = options.seed ?? DEFAULT_PEDESTRIAN_SEED;
    if (!Number.isFinite(seed)) {
      throw new Error(`PedestrianLayer: seed must be finite, got ${String(seed)}`);
    }
    const speedScale = options.speedScale ?? 1;
    if (!Number.isFinite(speedScale) || speedScale <= 0) {
      throw new Error(`PedestrianLayer: speedScale must be a positive finite number, got ${String(speedScale)}`);
    }

    this.era = options.era ?? 1945;
    this.walkPattern = getWalkPattern(this.era);
    this.count = count;
    this.seed = seed;
    this.speedScale = speedScale;
    const requestedCrossing = options.crossingRatio ?? this.walkPattern.crossingChance;
    if (!Number.isFinite(requestedCrossing) || requestedCrossing < 0 || requestedCrossing > 1) {
      throw new Error(`PedestrianLayer: crossingRatio must be within [0, 1], got ${String(requestedCrossing)}`);
    }
    this.crossingRatio = requestedCrossing;
    this.shared = createSharedGeometries();
    this.root.name = 'pedestrians-root';
    this.spawnPedestrians();
  }

  /** SceneLayer: return the layer's root object (attached by SceneRuntime). */
  createRoot(): Group {
    return this.root;
  }

  /** Mount the pedestrian root into an arbitrary scene-graph group. */
  attach(group: Object3D): void {
    this.assertActive();
    group.add(this.root);
  }

  /**
   * Swap the layer to `eraId` at transition `progress` (0..1). Adoption is
   * immediate: outfit sets and walk patterns become the target era's, and a
   * deterministic rebuild happens exactly once per era change so repeated
   * transition events never flicker the crowd.
   */
  applyEra(eraId: EraId, progress: number): void {
    this.assertActive();
    if (!isEraId(eraId)) {
      throw new Error(`applyEra: unknown era ${String(eraId)}; known eras: ${ERAS_IDS_JOINED}`);
    }
    if (!Number.isFinite(progress)) {
      throw new Error(`applyEra: progress must be finite, got ${String(progress)}`);
    }
    const clamped = Math.min(1, Math.max(0, progress));
    const eraChanged = eraId !== this.era;
    this.era = eraId;
    this.progress = clamped;
    this.walkPattern = getWalkPattern(eraId);
    if (eraChanged) {
      this.rebuildEra(eraId);
    }
  }

  /** SceneLayer: advance every pedestrian on each frame / step(). */
  update(state: FrameState): void {
    if (this.disposed) return;
    const delta = state.delta * this.speedScale;
    for (const actor of this.actors) {
      if (actor.state === 'done') {
        this.respawnActor(actor);
      }
      actor.update(delta, this.walkPattern);
    }
  }

  /** Clear all pedestrians and release every geometry/material owned here. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPedestrians();
    for (const geometry of Object.values(this.shared)) {
      geometry.dispose();
    }
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
  }

  get pedestrianCount(): number {
    return this.actors.length;
  }

  get activeEra(): EraId {
    return this.era;
  }

  get activeProgress(): number {
    return this.progress;
  }

  get activeWalkPattern(): WalkPattern {
    return this.walkPattern;
  }

  outfits(): readonly Outfit[] {
    return this.actors.map((actor) => actor.outfit);
  }

  routes(): readonly WalkRoute[] {
    return this.actors.map((actor) => actor.route);
  }

  /** Snapshot used by composition tests and integration tooling. */
  getSnapshot(): PedestrianSnapshot {
    return {
      era: this.era,
      progress: this.progress,
      pattern: this.walkPattern,
      count: this.actors.length,
      positions: this.actors.map((actor) => ({
        x: actor.root.position.x,
        z: actor.root.position.z,
      })),
      walkPhases: this.actors.map((actor) => actor.getPhase()),
      limbSwing: this.actors.map((actor) => actor.getLeftLegSwing()),
      outfits: this.actors.map((actor) => actor.outfit),
      routes: this.actors.map((actor) => actor.route),
    };
  }

  /** Deterministic per-actor random stream for the current era. */
  private actorRandom(index: number): () => number {
    return mulberry32((this.seed ^ (index * 104729) ^ (this.era * 7919)) >>> 0);
  }

  private wantsCrossing(actorIndex: number, random: () => number): boolean {
    // Every 4th pedestrian always crosses so tests and scenes always show
    // crosswalk traffic; the rest follow the era's crossing chance.
    return actorIndex % 4 === 1 || random() < this.crossingRatio;
  }

  private spawnPedestrians(): void {
    for (let index = 0; index < this.count; index += 1) {
      const random = this.actorRandom(index);
      const outfit = buildOutfit(this.era, random);
      const route = generateWalkRoute(random, this.era, {
        forceCrossing: this.wantsCrossing(index, random),
      });
      const rig = buildPedestrianRig(outfit, this.shared, (hex) => this.materialFor(hex));
      const actor = new PedestrianActor(outfit, route, rig, index, random);
      actor.root.name = `pedestrian:${index}`;
      this.root.add(actor.root);
      this.actors.push(actor);
    }
  }

  private rebuildEra(eraId: EraId): void {
    this.clearPedestrians();
    this.era = eraId;
    this.spawnPedestrians();
  }

  private clearPedestrians(): void {
    for (const actor of this.actors) {
      this.root.remove(actor.root);
    }
    this.actors.length = 0;
  }

  private respawnActor(actor: PedestrianActor): void {
    const random = this.actorRandom(actor.index);
    const route = generateWalkRoute(random, this.era, {
      forceCrossing: this.wantsCrossing(actor.index, random),
    });
    actor.respawn(route);
  }

  private materialFor(hex: string): MeshStandardMaterial {
    let material = this.materialCache.get(hex);
    if (!material) {
      material = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.85 });
      this.materialCache.set(hex, material);
    }
    return material;
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('PedestrianLayer has been disposed and can no longer be used');
    }
  }
}