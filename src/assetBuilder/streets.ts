/**
 * Street infrastructure builder.
 *
 * Produces pure, scene-agnostic data describing the road grid for a given era:
 * roads, sidewalks, lane markings, crosswalks, parking-spot markers and lamp
 * posts. Every element is plain data — no THREE.Scene mutation, no renderer
 * side effects — so the output can be cached, diffed across eras and consumed
 * by `cityBlock.ts` / `scene.ts` to instantiate real meshes.
 *
 * Z-fighting prevention contract:
 *   - Road planes sit at renderOrder 0.
 *   - Every marking/decal carries an explicit `renderOrder` > 0 together with
 *     `polygonOffset` {factor, units} so it is drawn after — and pushed off —
 *     the road plane in depth-buffer space.
 *   - Lamp posts are vertical geometry (not coplanar with the road) so they
 *     only need a renderOrder bump, not polygon offset.
 */

import type { Era, LaneLayout, ParkingSpec, ParkingSpot } from '../eras/types.js';

// ---------------------------------------------------------------------------
// Output data types (plain data — no THREE dependency)
// ---------------------------------------------------------------------------

/**
 * Polygon-offset hint attached to any decal that sits flush on the road plane.
 * Mirrors the WebGL `polygonOffset` material state so the scene assembler can
 * apply it verbatim.
 */
export interface PolygonOffset {
  /** `material.polygonOffsetFactor`. Negative pushes the decal toward the camera. */
  factor: number;
  /** `material.polygonOffsetUnits`. Negative pushes the decal toward the camera. */
  units: number;
}

/**
 * Shared depth/render metadata that every visual element carries. Flat road
 * decals populate `polygonOffset`; raised geometry (lamp posts) leaves it
 * undefined.
 */
export interface RenderHint {
  /** Higher values draw later (on top). The road plane itself is order 0. */
  renderOrder: number;
  /** Depth bias for coplanar decals; omitted for non-coplanar geometry. */
  polygonOffset?: PolygonOffset;
}

/** Axis-aligned rectangle on the ground plane, in metres. */
export interface Rect {
  /** Center X (east-west across the street axis). */
  x: number;
  /** Center Z (north-south along the street axis). */
  z: number;
  /** Extent along X (half-width). */
  halfWidth: number;
  /** Extent along Z (half-depth). */
  halfDepth: number;
}

/** A road carriageway plane. */
export interface RoadPlane extends RenderHint {
  /** Footprint on the ground plane. */
  rect: Rect;
  /** CSS-style hex color for the asphalt. */
  color: string;
}

/** A sidewalk slab raised by the curb height. */
export interface SidewalkSlab extends RenderHint {
  /** Footprint on the ground plane. */
  rect: Rect;
  /** Curb rise above the road surface, in metres. */
  height: number;
  /** CSS-style hex color for the pavement. */
  color: string;
}

/**
 * A painted lane marking (line, dash, double-line, crosswalk stripe) flush on
 * the road surface. Always coplanar with a road plane and therefore always
 * carries a polygon offset.
 */
export interface LaneMarking extends RenderHint {
  /** Footprint on the ground plane. */
  rect: Rect;
  /** CSS-style hex color for the paint. */
  color: string;
  /** Paint style, for texture/mesh selection downstream. */
  style: 'solid' | 'dashed' | 'double' | 'crosswalk';
}

/** A crosswalk: a group of perpendicular stripes spanning the road. */
export interface Crosswalk extends RenderHint {
  /** Center of the crosswalk on the ground plane. */
  x: number;
  z: number;
  /** Overall width across the road, in metres. */
  width: number;
  /** Overall depth along the road axis, in metres. */
  depth: number;
  /** CSS-style hex color for the stripes. */
  color: string;
  /** Individual stripe rectangles making up the crosswalk. */
  stripes: LaneMarking[];
}

/** A parking-spot boundary marker painted on the road. */
export interface ParkingMarker extends RenderHint {
  /** Footprint of the stall on the ground plane. */
  rect: Rect;
  /** CSS-style hex color for the paint. */
  color: string;
  /** Spot descriptor shared with the vehicle factory. */
  spot: ParkingSpot;
}

/** A lamp post (vertical geometry). */
export interface LampPost extends RenderHint {
  /** Base position on the ground plane. */
  x: number;
  z: number;
  /** Post height, in metres. */
  height: number;
  /** CSS-style hex color for the post metal. */
  color: string;
  /** Arm reach toward the road centerline, in metres. */
  armLength: number;
  /** Whether the lamp is electrically lit for this era. */
  illuminated: boolean;
  /** CSS-style hex color for the emitted light, when illuminated. */
  lightColor: string;
}

/** Aggregate street-infrastructure layout for one era. */
export interface StreetInfra {
  /** The era this layout was generated for. */
  era: Era;
  /** Road carriageway planes (renderOrder 0, no polygon offset). */
  roads: RoadPlane[];
  /** Raised sidewalk slabs lining the roads. */
  sidewalks: SidewalkSlab[];
  /** Painted lane lines and dashes. */
  laneMarkings: LaneMarking[];
  /** Crosswalks spanning the roads at intersections. */
  crosswalks: Crosswalk[];
  /** Painted parking-spot boundary markers. */
  parkingMarkers: ParkingMarker[];
  /** Lamp posts along the sidewalks. */
  lampPosts: LampPost[];
}

// ---------------------------------------------------------------------------
// Render policy (localized until the centralized helper lands)
// ---------------------------------------------------------------------------

/**
 * Render-order + polygon-offset policy for street decals.
 *
 * The downstream "Centralize renderPolicy helper" task will own the canonical
 * version; until then this localized constant keeps the street builder
 * self-contained and z-fighting-free.
 */
const STREET_RENDER_POLICY = {
  road: { renderOrder: 0 },
  decal: {
    renderOrder: 1,
    polygonOffset: { factor: -1, units: -1 },
  },
  crosswalk: {
    renderOrder: 2,
    polygonOffset: { factor: -2, units: -2 },
  },
  parking: {
    renderOrder: 2,
    polygonOffset: { factor: -2, units: -2 },
  },
  lamp: { renderOrder: 3 },
} as const satisfies Record<string, RenderHint>;

// ---------------------------------------------------------------------------
// Era-driven layout parameters
// ---------------------------------------------------------------------------

/**
 * Per-era street configuration. Drives lane widths, marking color, parking
 * density and lamp-post style so each timeline year reads distinctly.
 */
interface EraStreetConfig {
  /** CSS-style hex asphalt color. */
  roadColor: string;
  /** CSS-style hex sidewalk color. */
  sidewalkColor: string;
  /** CSS-style hex marking paint color. */
  markingColor: string;
  /** CSS-style hex crosswalk paint color. */
  crosswalkColor: string;
  /** CSS-style hex lamp-post metal color. */
  lampColor: string;
  /** CSS-style hex lamp emission color when illuminated. */
  lampLightColor: string;
  /** Lamp-post height, in metres. */
  lampHeight: number;
  /** Whether lamps are electrically lit. */
  lampIlluminated: boolean;
}

/** Deterministic per-era visual configuration. */
const ERA_STREET_CONFIG: Record<Era, EraStreetConfig> = {
  1945: {
    roadColor: '#3a3a38',
    sidewalkColor: '#8a8278',
    markingColor: '#c9c2ad',
    crosswalkColor: '#c9c2ad',
    lampColor: '#1f1f1f',
    lampLightColor: '#ffd9a0',
    lampHeight: 3.6,
    lampIlluminated: false,
  },
  1965: {
    roadColor: '#333332',
    sidewalkColor: '#8c8479',
    markingColor: '#d8d2bd',
    crosswalkColor: '#e2dcc6',
    lampColor: '#262626',
    lampLightColor: '#ffe6b0',
    lampHeight: 4.2,
    lampIlluminated: true,
  },
  1985: {
    roadColor: '#2e2e2c',
    sidewalkColor: '#90887d',
    markingColor: '#e8e2cd',
    crosswalkColor: '#f0ead4',
    lampColor: '#2a2a2a',
    lampLightColor: '#fff0c0',
    lampHeight: 5.0,
    lampIlluminated: true,
  },
  2005: {
    roadColor: '#2a2a29',
    sidewalkColor: '#949086',
    markingColor: '#f0ead0',
    crosswalkColor: '#f4eed8',
    lampColor: '#353535',
    lampLightColor: '#fff8e0',
    lampHeight: 5.5,
    lampIlluminated: true,
  },
  2025: {
    roadColor: '#262625',
    sidewalkColor: '#9a9690',
    markingColor: '#f5f0d8',
    crosswalkColor: '#f8f3dc',
    lampColor: '#3a3a3a',
    lampLightColor: '#fffce8',
    lampHeight: 6.0,
    lampIlluminated: true,
  },
};

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Length of the city block along the primary (north-south) road axis, in metres. */
const BLOCK_LENGTH = 80;
/** Width of the primary road carriageway (one direction), in metres. */
const CARRIAGEWAY_HALF_WIDTH = 6;
/** Sidewalk slab depth along the road axis, in metres. */
const SIDEWALK_DEPTH = 3.5;
/** Curb rise above the road surface, in metres. */
const CURB_HEIGHT = 0.15;
/** Spacing between lamp posts along the sidewalk, in metres. */
const LAMP_SPACING = 18;
/** Thickness of a painted lane line, in metres. */
const LINE_THICKNESS = 0.15;
/** Length of a single dash for dashed markings, in metres. */
const DASH_LENGTH = 2.4;
/** Gap between dashes, in metres. */
const DASH_GAP = 2.4;
/** Number of crosswalk stripes spanning the road. */
const CROSSWALK_STRIPE_COUNT = 7;

// ---------------------------------------------------------------------------
// Default lane layout / parking (used when the era bundle has not supplied them)
// ---------------------------------------------------------------------------

/**
 * Fallback cross-section used when no `laneLayout` is provided. Mirrors the
 * shape declared in `EraContent` so the output is consistent regardless of
 * whether the full era bundle is wired up yet.
 */
const DEFAULT_LANE_LAYOUT: LaneLayout = {
  lanes: [
    { type: 'motor', width: 3.5, direction: 'forward', marking: 'dashed' },
    { type: 'motor', width: 3.5, direction: 'backward', marking: 'solid' },
  ],
  totalWidth: 12,
  curbHeight: CURB_HEIGHT,
};

/** Fallback parking spec. */
const DEFAULT_PARKING: ParkingSpec = {
  defaultAngle: 'parallel',
  occupancy: 0.5,
  dimensions: {
    parallel: { length: 6, width: 2.2 },
    perpendicular: { length: 5, width: 2.5 },
    diagonal: { length: 5.5, width: 2.4 },
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Generates parallel parking spots along one side of the road.
 * @returns Array of parking spot descriptors.
 */
function generateParkingSpots(
  side: ParkingSpot['side'],
  occupancy: number,
): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  const { length, width } = DEFAULT_PARKING.dimensions.parallel;
  const gap = 0.6;
  const stride = length + gap;
  const usable = BLOCK_LENGTH - CROSSWALK_STRIPE_COUNT; // keep clear of intersections
  let pos = -usable / 2 + length / 2;
  let index = 0;
  while (pos + length / 2 <= usable / 2) {
    spots.push({
      position: pos,
      length,
      width,
      angle: 'parallel',
      side,
      // Deterministic pseudo-random occupancy so the same era always yields the
      // same layout. Odd indices on the right are filled first, then evens.
      occupied: ((index * 7 + (side === 'right' ? 3 : 0)) % 10) / 10 < occupancy,
    });
    pos += stride;
    index += 1;
  }
  return spots;
}

/** Builds the dashed center-line markings for the primary road. */
function buildDashedCenterLine(config: EraStreetConfig): LaneMarking[] {
  const markings: LaneMarking[] = [];
  const hint = STREET_RENDER_POLICY.decal;
  const usable = BLOCK_LENGTH - 8;
  let z = -usable / 2;
  while (z + DASH_LENGTH / 2 <= usable / 2) {
    markings.push({
      rect: {
        x: 0,
        z: z + DASH_LENGTH / 2,
        halfWidth: LINE_THICKNESS / 2,
        halfDepth: DASH_LENGTH / 2,
      },
      color: config.markingColor,
      style: 'dashed',
      ...hint,
    });
    z += DASH_LENGTH + DASH_GAP;
  }
  return markings;
}

/** Builds the solid edge lines along both edges of the carriageway. */
function buildEdgeLines(config: EraStreetConfig): LaneMarking[] {
  const hint = STREET_RENDER_POLICY.decal;
  const halfDepth = BLOCK_LENGTH / 2 - 4;
  const edgeX = CARRIAGEWAY_HALF_WIDTH - LINE_THICKNESS;
  return [-edgeX, edgeX].map((x) => ({
    rect: { x, z: 0, halfWidth: LINE_THICKNESS / 2, halfDepth },
    color: config.markingColor,
    style: 'solid' as const,
    ...hint,
  }));
}

/**
 * Builds a crosswalk centered at (x, z) spanning `width` across the road.
 * Returns the aggregate crosswalk plus its individual stripes.
 */
function buildCrosswalk(
  config: EraStreetConfig,
  x: number,
  z: number,
  width: number,
  depth: number,
): Crosswalk {
  const hint = STREET_RENDER_POLICY.crosswalk;
  const stripeDepth = depth / (CROSSWALK_STRIPE_COUNT * 2 - 1);
  const stripes: LaneMarking[] = [];
  for (let i = 0; i < CROSSWALK_STRIPE_COUNT; i += 1) {
    const stripeZ = z - depth / 2 + stripeDepth * (i * 2 + 1) / 1;
    stripes.push({
      rect: { x, z: stripeZ, halfWidth: width / 2, halfDepth: stripeDepth / 1.6 },
      color: config.crosswalkColor,
      style: 'crosswalk',
      ...hint,
    });
  }
  return { x, z, width, depth, color: config.crosswalkColor, stripes, ...hint };
}

/** Builds parking-spot boundary markers for one side of the road. */
function buildParkingMarkers(
  config: EraStreetConfig,
  spots: ParkingSpot[],
  side: ParkingSpot['side'],
): ParkingMarker[] {
  const hint = STREET_RENDER_POLICY.parking;
  const edgeX = CARRIAGEWAY_HALF_WIDTH - spots[0].width / 2;
  const xSign = side === 'right' ? 1 : -1;
  return spots.map((spot) => ({
    rect: {
      x: xSign * edgeX,
      z: spot.position,
      halfWidth: spot.width / 2,
      halfDepth: spot.length / 2,
    },
    color: config.markingColor,
    spot,
    ...hint,
  }));
}

/** Builds lamp posts evenly spaced along both sidewalks. */
function buildLampPosts(config: EraStreetConfig): LampPost[] {
  const hint = STREET_RENDER_POLICY.lamp;
  const posts: LampPost[] = [];
  const sidewalkEdgeX = CARRIAGEWAY_HALF_WIDTH + SIDEWALK_DEPTH / 2;
  for (const side of [-1, 1] as const) {
    let z = -BLOCK_LENGTH / 2 + LAMP_SPACING / 2;
    while (z <= BLOCK_LENGTH / 2 - LAMP_SPACING / 2) {
      posts.push({
        x: side * sidewalkEdgeX,
        z,
        height: config.lampHeight,
        color: config.lampColor,
        armLength: 1.4,
        illuminated: config.lampIlluminated,
        lightColor: config.lampLightColor,
        ...hint,
      });
      z += LAMP_SPACING;
    }
  }
  return posts;
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build the full street-infrastructure layout for a given era.
 *
 * Output is pure data: roads, sidewalks, lane markings, crosswalks, parking
 * markers and lamp posts, each carrying explicit `renderOrder` (+ polygon
 * offset for coplanar decals) so the renderer can lay them down without
 * z-fighting against the road plane.
 *
 * @param era  The timeline year to generate infrastructure for.
 * @returns    A {@link StreetInfra} bundle (no scene mutation).
 */
export function buildStreetInfra(era: Era): StreetInfra {
  const config = ERA_STREET_CONFIG[era];

  // Primary north-south road: two-lane carriageway.
  const road: RoadPlane = {
    rect: {
      x: 0,
      z: 0,
      halfWidth: CARRIAGEWAY_HALF_WIDTH,
      halfDepth: BLOCK_LENGTH / 2,
    },
    color: config.roadColor,
    ...STREET_RENDER_POLICY.road,
  };

  // Sidewalks on both sides, raised by the curb height.
  const sidewalks: SidewalkSlab[] = ([-1, 1] as const).map((side) => ({
    rect: {
      x: side * (CARRIAGEWAY_HALF_WIDTH + SIDEWALK_DEPTH / 2),
      z: 0,
      halfWidth: SIDEWALK_DEPTH / 2,
      halfDepth: BLOCK_LENGTH / 2,
    },
    height: CURB_HEIGHT,
    color: config.sidewalkColor,
    ...STREET_RENDER_POLICY.road, // flush ground slabs — order 0, no offset
  }));

  // Lane markings: dashed center + solid edges.
  const laneMarkings: LaneMarking[] = [
    ...buildDashedCenterLine(config),
    ...buildEdgeLines(config),
  ];

  // Crosswalks at both ends of the block.
  const crosswalkDepth = 4;
  const crosswalks: Crosswalk[] = [
    buildCrosswalk(
      config,
      0,
      -BLOCK_LENGTH / 2 + crosswalkDepth,
      CARRIAGEWAY_HALF_WIDTH * 2,
      crosswalkDepth,
    ),
    buildCrosswalk(
      config,
      0,
      BLOCK_LENGTH / 2 - crosswalkDepth,
      CARRIAGEWAY_HALF_WIDTH * 2,
      crosswalkDepth,
    ),
  ];

  // Parking spots + markers on both sides.
  const leftSpots = generateParkingSpots('left', DEFAULT_PARKING.occupancy);
  const rightSpots = generateParkingSpots('right', DEFAULT_PARKING.occupancy);
  const parkingMarkers: ParkingMarker[] = [
    ...(leftSpots.length ? buildParkingMarkers(config, leftSpots, 'left') : []),
    ...(rightSpots.length ? buildParkingMarkers(config, rightSpots, 'right') : []),
  ];

  // Lamp posts.
  const lampPosts = buildLampPosts(config);

  return {
    era,
    roads: [road],
    sidewalks,
    laneMarkings,
    crosswalks,
    parkingMarkers,
    lampPosts,
  };
}

// Re-export the lane-layout/parking defaults so downstream modules can opt into
// the same baseline without duplicating the constants.
export { DEFAULT_LANE_LAYOUT, DEFAULT_PARKING };
