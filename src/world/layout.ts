/**
 * City Block Layout Contract
 *
 * Defines the era-agnostic spatial contract for the 3D city block.
 * All five eras (1945-2025) share this exact physical geography:
 * street grid, building lots, sidewalk/curb bands, vehicle lanes with traffic
 * flow paths, pedestrian walkways, and furniture anchor points.
 *
 * Pure TypeScript module with no Three.js or DOM dependencies.
 * All coordinates are in meters (Y-up, X = East-West, Z = North-South).
 */

import { createSeededRng, type Rng } from '../lib/rng';
import { distance2 } from '../lib/math';

// ============================================================================
// Coordinate & Geometry Types
// ============================================================================

export interface Point2D {
  x: number;
  z: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector2D {
  x: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Rect2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Box3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';
export type BlockQuadrant = 'NE' | 'NW' | 'SE' | 'SW';

// ============================================================================
// Furniture Anchors
// ============================================================================

export type FurnitureAnchorKind =
  | 'lamp_post'
  | 'traffic_light'
  | 'fire_hydrant'
  | 'bench'
  | 'tree'
  | 'trash_bin'
  | 'booth'
  | 'mailbox';

export interface FurnitureAnchor {
  id: string;
  kind: FurnitureAnchorKind;
  position: Point3D;
  /** Facing yaw in radians. 0 = facing +Z (South), PI/2 = facing +X (East), etc. */
  facing: number;
  /** Normalized 3D facing vector. */
  facingVector: Vector3D;
  quadrant?: BlockQuadrant;
  streetName?: string;
  tags: string[];
}

// ============================================================================
// Building Lots
// ============================================================================

export interface BuildingLotFrontage {
  streetName: string;
  direction: CardinalDirection;
  normal: Vector2D;
  angle: number;
  curbDistance: number;
  entryPoint: Point3D;
}

export interface StorefrontZone {
  facadeWidth: number;
  entryPoint: Point3D;
  signageAnchor: Point3D;
  canopyAnchor: Point3D;
}

export interface BuildingLot {
  id: string;
  name: string;
  quadrant: BlockQuadrant;
  bounds: Rect2D;
  center: Point3D;
  size: {
    width: number;
    depth: number;
    height: number;
  };
  footprint: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
    area: number;
  };
  heightLimits: {
    min: number;
    max: number;
    recommended: number;
  };
  frontage: BuildingLotFrontage;
  secondaryFrontage?: BuildingLotFrontage;
  zoning: 'commercial' | 'mixed_use' | 'residential' | 'civic';
  storefrontZone: StorefrontZone;
}

// ============================================================================
// Vehicle Lanes & Traffic Paths
// ============================================================================

export type LaneDirection = 'northbound' | 'southbound' | 'eastbound' | 'westbound';
export type TurnType = 'straight' | 'right_turn' | 'left_turn';

export interface Waypoint extends Point3D {
  speedLimit?: number;
}

export interface TrafficPath {
  id: string;
  turnType: TurnType;
  fromStreet: string;
  toStreet: string;
  waypoints: Waypoint[];
  length: number;
}

export interface VehicleLane {
  id: string;
  streetName: string;
  direction: LaneDirection;
  laneIndex: number;
  laneWidth: number;
  centerOffset: number;
  bounds: Rect2D;
  flowPath: TrafficPath;
  turnPaths: TrafficPath[];
}

// ============================================================================
// Sidewalks, Curbs & Pedestrian Network
// ============================================================================

export interface CurbBand {
  id: string;
  bounds: Rect2D;
  height: number;
  width: number;
}

export interface SidewalkBand {
  id: string;
  streetName: string;
  side: 'north' | 'south' | 'east' | 'west';
  bounds: Rect2D;
  width: number;
  elevation: number;
  curbBand: CurbBand;
}

export interface Crosswalk {
  id: string;
  name: string;
  streetName: string;
  quadrants: [BlockQuadrant, BlockQuadrant];
  bounds: Rect2D;
  center: Point3D;
  width: number;
  startPoint: Point3D;
  endPoint: Point3D;
  waypoints: Waypoint[];
}

export interface PedestrianWalkwaySegment {
  id: string;
  kind: 'sidewalk' | 'corner' | 'crosswalk' | 'plaza';
  fromNodeId: string;
  toNodeId: string;
  waypoints: Waypoint[];
  length: number;
  width: number;
}

export interface PedestrianWalkwayNode {
  id: string;
  position: Point3D;
  kind: 'sidewalk_node' | 'corner_node' | 'crosswalk_node' | 'storefront_node';
  connectedNodeIds: string[];
}

export interface PedestrianNetwork {
  nodes: PedestrianWalkwayNode[];
  segments: PedestrianWalkwaySegment[];
  crosswalks: Crosswalk[];
}

// ============================================================================
// Street Grid & Intersection
// ============================================================================

export interface StreetGrid {
  name: string;
  axis: 'x' | 'z';
  direction: 'east_west' | 'north_south';
  bounds: Rect2D;
  asphaltBounds: Rect2D;
  roadWidth: number;
  totalLength: number;
  laneCount: number;
  lanes: VehicleLane[];
  sidewalks: SidewalkBand[];
}

export interface CornerPlaza {
  quadrant: BlockQuadrant;
  bounds: Rect2D;
  center: Point3D;
}

export interface Intersection {
  id: string;
  center: Point3D;
  bounds: Rect2D;
  asphaltBounds: Rect2D;
  crosswalks: Crosswalk[];
  trafficLightAnchors: FurnitureAnchor[];
  cornerPlazas: CornerPlaza[];
}

// ============================================================================
// Top-Level BlockLayout Contract
// ============================================================================

export interface BlockLayoutDimensions {
  totalWidth: number;
  totalDepth: number;
  bounds: Rect2D;
  roadWidth: number;
  sidewalkWidth: number;
  curbWidth: number;
  curbHeight: number;
  lotSetback: number;
}

export interface BlockLayoutConfig {
  seed?: number;
  totalWidth?: number;
  totalDepth?: number;
  roadWidth?: number;
  sidewalkWidth?: number;
  curbWidth?: number;
  curbHeight?: number;
  lotSetback?: number;
}

export interface BlockLayout {
  seed: number;
  dimensions: BlockLayoutDimensions;
  streets: StreetGrid[];
  intersection: Intersection;
  asphaltAreas: Rect2D[];
  sidewalkBands: SidewalkBand[];
  lots: BuildingLot[];
  lanes: VehicleLane[];
  pedestrianNetwork: PedestrianNetwork;
  furnitureAnchors: FurnitureAnchor[];

  // Convenience query helpers
  getLotById(id: string): BuildingLot | undefined;
  getLotsByQuadrant(quadrant: BlockQuadrant): BuildingLot[];
  getAnchorsByKind(kind: FurnitureAnchorKind): FurnitureAnchor[];
  getLanesByDirection(direction: LaneDirection): VehicleLane[];
  findClosestAnchor(point: Point3D, kind?: FurnitureAnchorKind): FurnitureAnchor | undefined;
}

// ============================================================================
// Geometry Helpers
// ============================================================================

export function directionToVector2D(direction: CardinalDirection): Vector2D {
  switch (direction) {
    case 'north':
      return { x: 0, z: -1 };
    case 'south':
      return { x: 0, z: 1 };
    case 'east':
      return { x: 1, z: 0 };
    case 'west':
      return { x: -1, z: 0 };
  }
}

export function directionToAngle(direction: CardinalDirection): number {
  switch (direction) {
    case 'north':
      return Math.PI;
    case 'south':
      return 0;
    case 'east':
      return Math.PI / 2;
    case 'west':
      return (3 * Math.PI) / 2;
  }
}

export function angleToFacingVector(yaw: number): Vector3D {
  return {
    x: Math.sin(yaw),
    y: 0,
    z: Math.cos(yaw),
  };
}

export function isPointInRect(point: Point2D | Point3D, rect: Rect2D): boolean {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.z >= rect.minZ &&
    point.z <= rect.maxZ
  );
}

export function rectsOverlap(a: Rect2D, b: Rect2D): boolean {
  return !(
    a.maxX <= b.minX ||
    a.minX >= b.maxX ||
    a.maxZ <= b.minZ ||
    a.minZ >= b.maxZ
  );
}

export function computePathLength(waypoints: readonly Point3D[]): number {
  let length = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    const p0 = waypoints[i - 1]!;
    const p1 = waypoints[i]!;
    length += Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  }
  return length;
}

/**
 * Generate intermediate linear waypoints between start and end.
 */
function sampleLinearPath(start: Point3D, end: Point3D, step = 5): Waypoint[] {
  const dist = distance2(start.x, start.z, end.x, end.z);
  const count = Math.max(2, Math.ceil(dist / step));
  const points: Waypoint[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t,
    });
  }
  return points;
}

/**
 * Generate quadratic Bezier curve waypoints for smooth intersection turns.
 */
function sampleBezierPath(
  start: Point3D,
  control: Point3D,
  end: Point3D,
  steps = 8,
): Waypoint[] {
  const points: Waypoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const invT = 1 - t;
    const x = invT * invT * start.x + 2 * invT * t * control.x + t * t * end.x;
    const y = invT * invT * start.y + 2 * invT * t * control.y + t * t * end.y;
    const z = invT * invT * start.z + 2 * invT * t * control.z + t * t * end.z;
    points.push({ x, y, z });
  }
  return points;
}

// ============================================================================
// Layout Builder
// ============================================================================

const DEFAULT_CONFIG: Required<BlockLayoutConfig> = {
  seed: 42,
  totalWidth: 170,
  totalDepth: 170,
  roadWidth: 14,
  sidewalkWidth: 4,
  curbWidth: 0.25,
  curbHeight: 0.15,
  lotSetback: 1.0,
};

/**
 * Construct the deterministic, era-agnostic BlockLayout.
 *
 * Calling this with identical configuration or seed returns structurally identical
 * geometry coordinates. No Three.js or DOM objects are created.
 */
export function createBlockLayout(
  seedOrConfig?: number | Partial<BlockLayoutConfig>,
): BlockLayout {
  const config: Required<BlockLayoutConfig> = {
    ...DEFAULT_CONFIG,
    ...(typeof seedOrConfig === 'number'
      ? { seed: seedOrConfig }
      : seedOrConfig ?? {}),
  };

  const seed = config.seed;
  const rng: Rng = createSeededRng(seed);

  const halfWidth = config.totalWidth / 2;
  const halfDepth = config.totalDepth / 2;
  const halfRoad = config.roadWidth / 2; // 7m
  const sidewalkInner = halfRoad; // 7m
  const sidewalkOuter = halfRoad + config.sidewalkWidth; // 11m
  const lotStart = sidewalkOuter + config.lotSetback; // 12m
  const lotMaxExtent = halfWidth - 3; // 82m

  const dimensions: BlockLayoutDimensions = {
    totalWidth: config.totalWidth,
    totalDepth: config.totalDepth,
    bounds: {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -halfDepth,
      maxZ: halfDepth,
    },
    roadWidth: config.roadWidth,
    sidewalkWidth: config.sidewalkWidth,
    curbWidth: config.curbWidth,
    curbHeight: config.curbHeight,
    lotSetback: config.lotSetback,
  };

  // --------------------------------------------------------------------------
  // Asphalt Areas
  // --------------------------------------------------------------------------
  const asphaltAreas: Rect2D[] = [
    // East-West road (Market Street)
    {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -halfRoad,
      maxZ: halfRoad,
    },
    // North-South road (Main Avenue)
    {
      minX: -halfRoad,
      maxX: halfRoad,
      minZ: -halfDepth,
      maxZ: halfDepth,
    },
  ];

  // --------------------------------------------------------------------------
  // Sidewalk Bands & Curbs
  // --------------------------------------------------------------------------
  const sidewalkBands: SidewalkBand[] = [
    // Market Street North sidewalk
    {
      id: 'sidewalk-market-north',
      streetName: 'Market Street',
      side: 'north',
      bounds: {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: sidewalkInner,
        maxZ: sidewalkOuter,
      },
      width: config.sidewalkWidth,
      elevation: config.curbHeight,
      curbBand: {
        id: 'curb-market-north',
        bounds: {
          minX: -halfWidth,
          maxX: halfWidth,
          minZ: sidewalkInner,
          maxZ: sidewalkInner + config.curbWidth,
        },
        height: config.curbHeight,
        width: config.curbWidth,
      },
    },
    // Market Street South sidewalk
    {
      id: 'sidewalk-market-south',
      streetName: 'Market Street',
      side: 'south',
      bounds: {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: -sidewalkOuter,
        maxZ: -sidewalkInner,
      },
      width: config.sidewalkWidth,
      elevation: config.curbHeight,
      curbBand: {
        id: 'curb-market-south',
        bounds: {
          minX: -halfWidth,
          maxX: halfWidth,
          minZ: -sidewalkInner - config.curbWidth,
          maxZ: -sidewalkInner,
        },
        height: config.curbHeight,
        width: config.curbWidth,
      },
    },
    // Main Avenue East sidewalk
    {
      id: 'sidewalk-main-east',
      streetName: 'Main Avenue',
      side: 'east',
      bounds: {
        minX: sidewalkInner,
        maxX: sidewalkOuter,
        minZ: -halfDepth,
        maxZ: halfDepth,
      },
      width: config.sidewalkWidth,
      elevation: config.curbHeight,
      curbBand: {
        id: 'curb-main-east',
        bounds: {
          minX: sidewalkInner,
          maxX: sidewalkInner + config.curbWidth,
          minZ: -halfDepth,
          maxZ: halfDepth,
        },
        height: config.curbHeight,
        width: config.curbWidth,
      },
    },
    // Main Avenue West sidewalk
    {
      id: 'sidewalk-main-west',
      streetName: 'Main Avenue',
      side: 'west',
      bounds: {
        minX: -sidewalkOuter,
        maxX: -sidewalkInner,
        minZ: -halfDepth,
        maxZ: halfDepth,
      },
      width: config.sidewalkWidth,
      elevation: config.curbHeight,
      curbBand: {
        id: 'curb-main-west',
        bounds: {
          minX: -sidewalkInner - config.curbWidth,
          maxX: -sidewalkInner,
          minZ: -halfDepth,
          maxZ: halfDepth,
        },
        height: config.curbHeight,
        width: config.curbWidth,
      },
    },
  ];

  // --------------------------------------------------------------------------
  // Vehicle Lanes & Traffic Flow Paths
  // --------------------------------------------------------------------------
  const laneCenterOffset = 3.5; // distance from centerline to travel lane center

  // 1. Market Street Eastbound (travels +X from -halfWidth to +halfWidth at Z = -3.5)
  const laneEwEbStraightPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -halfWidth, y: 0, z: -laneCenterOffset },
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      5,
    ),
    ...sampleLinearPath(
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      3.5,
    ).slice(1),
    ...sampleLinearPath(
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      { x: halfWidth, y: 0, z: -laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneEwEbRightTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -halfWidth, y: 0, z: -laneCenterOffset },
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      5,
    ),
    ...sampleBezierPath(
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      { x: -laneCenterOffset, y: 0, z: -laneCenterOffset },
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      6,
    ).slice(1),
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      { x: -laneCenterOffset, y: 0, z: -halfDepth },
      5,
    ).slice(1),
  ];

  const laneEwEbLeftTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -halfWidth, y: 0, z: -laneCenterOffset },
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      5,
    ),
    ...sampleBezierPath(
      { x: -halfRoad, y: 0, z: -laneCenterOffset },
      { x: laneCenterOffset, y: 0, z: -laneCenterOffset },
      { x: laneCenterOffset, y: 0, z: halfRoad },
      8,
    ).slice(1),
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: halfRoad },
      { x: laneCenterOffset, y: 0, z: halfDepth },
      5,
    ).slice(1),
  ];

  const laneEwEb: VehicleLane = {
    id: 'lane-market-eastbound',
    streetName: 'Market Street',
    direction: 'eastbound',
    laneIndex: 0,
    laneWidth: 7,
    centerOffset: -laneCenterOffset,
    bounds: {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -halfRoad,
      maxZ: 0,
    },
    flowPath: {
      id: 'path-market-eb-straight',
      turnType: 'straight',
      fromStreet: 'Market Street (West)',
      toStreet: 'Market Street (East)',
      waypoints: laneEwEbStraightPoints,
      length: computePathLength(laneEwEbStraightPoints),
    },
    turnPaths: [
      {
        id: 'path-market-eb-right',
        turnType: 'right_turn',
        fromStreet: 'Market Street (West)',
        toStreet: 'Main Avenue (South)',
        waypoints: laneEwEbRightTurnPoints,
        length: computePathLength(laneEwEbRightTurnPoints),
      },
      {
        id: 'path-market-eb-left',
        turnType: 'left_turn',
        fromStreet: 'Market Street (West)',
        toStreet: 'Main Avenue (North)',
        waypoints: laneEwEbLeftTurnPoints,
        length: computePathLength(laneEwEbLeftTurnPoints),
      },
    ],
  };

  // 2. Market Street Westbound (travels -X from +halfWidth to -halfWidth at Z = +3.5)
  const laneEwWbStraightPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: halfWidth, y: 0, z: laneCenterOffset },
      { x: halfRoad, y: 0, z: laneCenterOffset },
      5,
    ),
    ...sampleLinearPath(
      { x: halfRoad, y: 0, z: laneCenterOffset },
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      3.5,
    ).slice(1),
    ...sampleLinearPath(
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      { x: -halfWidth, y: 0, z: laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneEwWbRightTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: halfWidth, y: 0, z: laneCenterOffset },
      { x: halfRoad, y: 0, z: laneCenterOffset },
      5,
    ),
    ...sampleBezierPath(
      { x: halfRoad, y: 0, z: laneCenterOffset },
      { x: laneCenterOffset, y: 0, z: laneCenterOffset },
      { x: laneCenterOffset, y: 0, z: halfRoad },
      6,
    ).slice(1),
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: halfRoad },
      { x: laneCenterOffset, y: 0, z: halfDepth },
      5,
    ).slice(1),
  ];

  const laneEwWbLeftTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: halfWidth, y: 0, z: laneCenterOffset },
      { x: halfRoad, y: 0, z: laneCenterOffset },
      5,
    ),
    ...sampleBezierPath(
      { x: halfRoad, y: 0, z: laneCenterOffset },
      { x: -laneCenterOffset, y: 0, z: laneCenterOffset },
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      8,
    ).slice(1),
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      { x: -laneCenterOffset, y: 0, z: -halfDepth },
      5,
    ).slice(1),
  ];

  const laneEwWb: VehicleLane = {
    id: 'lane-market-westbound',
    streetName: 'Market Street',
    direction: 'westbound',
    laneIndex: 0,
    laneWidth: 7,
    centerOffset: laneCenterOffset,
    bounds: {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: 0,
      maxZ: halfRoad,
    },
    flowPath: {
      id: 'path-market-wb-straight',
      turnType: 'straight',
      fromStreet: 'Market Street (East)',
      toStreet: 'Market Street (West)',
      waypoints: laneEwWbStraightPoints,
      length: computePathLength(laneEwWbStraightPoints),
    },
    turnPaths: [
      {
        id: 'path-market-wb-right',
        turnType: 'right_turn',
        fromStreet: 'Market Street (East)',
        toStreet: 'Main Avenue (North)',
        waypoints: laneEwWbRightTurnPoints,
        length: computePathLength(laneEwWbRightTurnPoints),
      },
      {
        id: 'path-market-wb-left',
        turnType: 'left_turn',
        fromStreet: 'Market Street (East)',
        toStreet: 'Main Avenue (South)',
        waypoints: laneEwWbLeftTurnPoints,
        length: computePathLength(laneEwWbLeftTurnPoints),
      },
    ],
  };

  // 3. Main Avenue Northbound (travels +Z from -halfDepth to +halfDepth at X = +3.5)
  const laneNsNbStraightPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: -halfDepth },
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      5,
    ),
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      { x: laneCenterOffset, y: 0, z: halfRoad },
      3.5,
    ).slice(1),
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: halfRoad },
      { x: laneCenterOffset, y: 0, z: halfDepth },
      5,
    ).slice(1),
  ];

  const laneNsNbRightTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: -halfDepth },
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      5,
    ),
    ...sampleBezierPath(
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      { x: laneCenterOffset, y: 0, z: -laneCenterOffset },
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      6,
    ).slice(1),
    ...sampleLinearPath(
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      { x: halfWidth, y: 0, z: -laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneNsNbLeftTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: laneCenterOffset, y: 0, z: -halfDepth },
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      5,
    ),
    ...sampleBezierPath(
      { x: laneCenterOffset, y: 0, z: -halfRoad },
      { x: laneCenterOffset, y: 0, z: laneCenterOffset },
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      8,
    ).slice(1),
    ...sampleLinearPath(
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      { x: -halfWidth, y: 0, z: laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneNsNb: VehicleLane = {
    id: 'lane-main-northbound',
    streetName: 'Main Avenue',
    direction: 'northbound',
    laneIndex: 0,
    laneWidth: 7,
    centerOffset: laneCenterOffset,
    bounds: {
      minX: 0,
      maxX: halfRoad,
      minZ: -halfDepth,
      maxZ: halfDepth,
    },
    flowPath: {
      id: 'path-main-nb-straight',
      turnType: 'straight',
      fromStreet: 'Main Avenue (South)',
      toStreet: 'Main Avenue (North)',
      waypoints: laneNsNbStraightPoints,
      length: computePathLength(laneNsNbStraightPoints),
    },
    turnPaths: [
      {
        id: 'path-main-nb-right',
        turnType: 'right_turn',
        fromStreet: 'Main Avenue (South)',
        toStreet: 'Market Street (East)',
        waypoints: laneNsNbRightTurnPoints,
        length: computePathLength(laneNsNbRightTurnPoints),
      },
      {
        id: 'path-main-nb-left',
        turnType: 'left_turn',
        fromStreet: 'Main Avenue (South)',
        toStreet: 'Market Street (West)',
        waypoints: laneNsNbLeftTurnPoints,
        length: computePathLength(laneNsNbLeftTurnPoints),
      },
    ],
  };

  // 4. Main Avenue Southbound (travels -Z from +halfDepth to -halfDepth at X = -3.5)
  const laneNsSbStraightPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: halfDepth },
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      5,
    ),
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      3.5,
    ).slice(1),
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: -halfRoad },
      { x: -laneCenterOffset, y: 0, z: -halfDepth },
      5,
    ).slice(1),
  ];

  const laneNsSbRightTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: halfDepth },
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      5,
    ),
    ...sampleBezierPath(
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      { x: -laneCenterOffset, y: 0, z: laneCenterOffset },
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      6,
    ).slice(1),
    ...sampleLinearPath(
      { x: -halfRoad, y: 0, z: laneCenterOffset },
      { x: -halfWidth, y: 0, z: laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneNsSbLeftTurnPoints: Waypoint[] = [
    ...sampleLinearPath(
      { x: -laneCenterOffset, y: 0, z: halfDepth },
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      5,
    ),
    ...sampleBezierPath(
      { x: -laneCenterOffset, y: 0, z: halfRoad },
      { x: -laneCenterOffset, y: 0, z: -laneCenterOffset },
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      8,
    ).slice(1),
    ...sampleLinearPath(
      { x: halfRoad, y: 0, z: -laneCenterOffset },
      { x: halfWidth, y: 0, z: -laneCenterOffset },
      5,
    ).slice(1),
  ];

  const laneNsSb: VehicleLane = {
    id: 'lane-main-southbound',
    streetName: 'Main Avenue',
    direction: 'southbound',
    laneIndex: 0,
    laneWidth: 7,
    centerOffset: -laneCenterOffset,
    bounds: {
      minX: -halfRoad,
      maxX: 0,
      minZ: -halfDepth,
      maxZ: halfDepth,
    },
    flowPath: {
      id: 'path-main-sb-straight',
      turnType: 'straight',
      fromStreet: 'Main Avenue (North)',
      toStreet: 'Main Avenue (South)',
      waypoints: laneNsSbStraightPoints,
      length: computePathLength(laneNsSbStraightPoints),
    },
    turnPaths: [
      {
        id: 'path-main-sb-right',
        turnType: 'right_turn',
        fromStreet: 'Main Avenue (North)',
        toStreet: 'Market Street (West)',
        waypoints: laneNsSbRightTurnPoints,
        length: computePathLength(laneNsSbRightTurnPoints),
      },
      {
        id: 'path-main-sb-left',
        turnType: 'left_turn',
        fromStreet: 'Main Avenue (North)',
        toStreet: 'Market Street (East)',
        waypoints: laneNsSbLeftTurnPoints,
        length: computePathLength(laneNsSbLeftTurnPoints),
      },
    ],
  };

  const allLanes = [laneEwEb, laneEwWb, laneNsNb, laneNsSb];

  // --------------------------------------------------------------------------
  // Street Grids
  // --------------------------------------------------------------------------
  const streets: StreetGrid[] = [
    {
      name: 'Market Street',
      axis: 'x',
      direction: 'east_west',
      bounds: {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: -sidewalkOuter,
        maxZ: sidewalkOuter,
      },
      asphaltBounds: {
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: -halfRoad,
        maxZ: halfRoad,
      },
      roadWidth: config.roadWidth,
      totalLength: config.totalWidth,
      laneCount: 2,
      lanes: [laneEwEb, laneEwWb],
      sidewalks: [sidewalkBands[0]!, sidewalkBands[1]!],
    },
    {
      name: 'Main Avenue',
      axis: 'z',
      direction: 'north_south',
      bounds: {
        minX: -sidewalkOuter,
        maxX: sidewalkOuter,
        minZ: -halfDepth,
        maxZ: halfDepth,
      },
      asphaltBounds: {
        minX: -halfRoad,
        maxX: halfRoad,
        minZ: -halfDepth,
        maxZ: halfDepth,
      },
      roadWidth: config.roadWidth,
      totalLength: config.totalDepth,
      laneCount: 2,
      lanes: [laneNsNb, laneNsSb],
      sidewalks: [sidewalkBands[2]!, sidewalkBands[3]!],
    },
  ];

  // --------------------------------------------------------------------------
  // Crosswalks & Pedestrian Walkway Network
  // --------------------------------------------------------------------------
  const sidewalkCenterOffset = (sidewalkInner + sidewalkOuter) / 2; // 9m
  const crosswalkWidth = 3.0;
  const crosswalkDist = 8.5;

  const crosswalkNorth: Crosswalk = {
    id: 'crosswalk-north',
    name: 'North Crosswalk (Main Ave)',
    streetName: 'Main Avenue',
    quadrants: ['NW', 'NE'],
    bounds: {
      minX: -halfRoad,
      maxX: halfRoad,
      minZ: crosswalkDist - crosswalkWidth / 2,
      maxZ: crosswalkDist + crosswalkWidth / 2,
    },
    center: { x: 0, y: 0, z: crosswalkDist },
    width: crosswalkWidth,
    startPoint: { x: -sidewalkCenterOffset, y: config.curbHeight, z: crosswalkDist },
    endPoint: { x: sidewalkCenterOffset, y: config.curbHeight, z: crosswalkDist },
    waypoints: [
      { x: -sidewalkCenterOffset, y: config.curbHeight, z: crosswalkDist },
      { x: -halfRoad, y: 0, z: crosswalkDist },
      { x: 0, y: 0, z: crosswalkDist },
      { x: halfRoad, y: 0, z: crosswalkDist },
      { x: sidewalkCenterOffset, y: config.curbHeight, z: crosswalkDist },
    ],
  };

  const crosswalkSouth: Crosswalk = {
    id: 'crosswalk-south',
    name: 'South Crosswalk (Main Ave)',
    streetName: 'Main Avenue',
    quadrants: ['SW', 'SE'],
    bounds: {
      minX: -halfRoad,
      maxX: halfRoad,
      minZ: -crosswalkDist - crosswalkWidth / 2,
      maxZ: -crosswalkDist + crosswalkWidth / 2,
    },
    center: { x: 0, y: 0, z: -crosswalkDist },
    width: crosswalkWidth,
    startPoint: { x: -sidewalkCenterOffset, y: config.curbHeight, z: -crosswalkDist },
    endPoint: { x: sidewalkCenterOffset, y: config.curbHeight, z: -crosswalkDist },
    waypoints: [
      { x: -sidewalkCenterOffset, y: config.curbHeight, z: -crosswalkDist },
      { x: -halfRoad, y: 0, z: -crosswalkDist },
      { x: 0, y: 0, z: -crosswalkDist },
      { x: halfRoad, y: 0, z: -crosswalkDist },
      { x: sidewalkCenterOffset, y: config.curbHeight, z: -crosswalkDist },
    ],
  };

  const crosswalkEast: Crosswalk = {
    id: 'crosswalk-east',
    name: 'East Crosswalk (Market St)',
    streetName: 'Market Street',
    quadrants: ['SE', 'NE'],
    bounds: {
      minX: crosswalkDist - crosswalkWidth / 2,
      maxX: crosswalkDist + crosswalkWidth / 2,
      minZ: -halfRoad,
      maxZ: halfRoad,
    },
    center: { x: crosswalkDist, y: 0, z: 0 },
    width: crosswalkWidth,
    startPoint: { x: crosswalkDist, y: config.curbHeight, z: -sidewalkCenterOffset },
    endPoint: { x: crosswalkDist, y: config.curbHeight, z: sidewalkCenterOffset },
    waypoints: [
      { x: crosswalkDist, y: config.curbHeight, z: -sidewalkCenterOffset },
      { x: crosswalkDist, y: 0, z: -halfRoad },
      { x: crosswalkDist, y: 0, z: 0 },
      { x: crosswalkDist, y: 0, z: halfRoad },
      { x: crosswalkDist, y: config.curbHeight, z: sidewalkCenterOffset },
    ],
  };

  const crosswalkWest: Crosswalk = {
    id: 'crosswalk-west',
    name: 'West Crosswalk (Market St)',
    streetName: 'Market Street',
    quadrants: ['SW', 'NW'],
    bounds: {
      minX: -crosswalkDist - crosswalkWidth / 2,
      maxX: -crosswalkDist + crosswalkWidth / 2,
      minZ: -halfRoad,
      maxZ: halfRoad,
    },
    center: { x: -crosswalkDist, y: 0, z: 0 },
    width: crosswalkWidth,
    startPoint: { x: -crosswalkDist, y: config.curbHeight, z: -sidewalkCenterOffset },
    endPoint: { x: -crosswalkDist, y: config.curbHeight, z: sidewalkCenterOffset },
    waypoints: [
      { x: -crosswalkDist, y: config.curbHeight, z: -sidewalkCenterOffset },
      { x: -crosswalkDist, y: 0, z: -halfRoad },
      { x: -crosswalkDist, y: 0, z: 0 },
      { x: -crosswalkDist, y: 0, z: halfRoad },
      { x: -crosswalkDist, y: config.curbHeight, z: sidewalkCenterOffset },
    ],
  };

  const crosswalks = [crosswalkNorth, crosswalkSouth, crosswalkEast, crosswalkWest];

  // Pedestrian Walkway Graph Nodes
  const pedestrianNodes: PedestrianWalkwayNode[] = [
    // Corner nodes at intersection
    {
      id: 'node-corner-ne',
      position: { x: sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
      kind: 'corner_node',
      connectedNodeIds: ['node-corner-nw', 'node-corner-se', 'node-sidewalk-ne-east', 'node-sidewalk-ne-north'],
    },
    {
      id: 'node-corner-nw',
      position: { x: -sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
      kind: 'corner_node',
      connectedNodeIds: ['node-corner-ne', 'node-corner-sw', 'node-sidewalk-nw-west', 'node-sidewalk-nw-north'],
    },
    {
      id: 'node-corner-se',
      position: { x: sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
      kind: 'corner_node',
      connectedNodeIds: ['node-corner-ne', 'node-corner-sw', 'node-sidewalk-se-east', 'node-sidewalk-se-south'],
    },
    {
      id: 'node-corner-sw',
      position: { x: -sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
      kind: 'corner_node',
      connectedNodeIds: ['node-corner-nw', 'node-corner-se', 'node-sidewalk-sw-west', 'node-sidewalk-sw-south'],
    },
    // Longitudinal sidewalk endpoints
    {
      id: 'node-sidewalk-ne-east',
      position: { x: halfWidth - 5, y: config.curbHeight, z: sidewalkCenterOffset },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-ne'],
    },
    {
      id: 'node-sidewalk-ne-north',
      position: { x: sidewalkCenterOffset, y: config.curbHeight, z: halfDepth - 5 },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-ne'],
    },
    {
      id: 'node-sidewalk-nw-west',
      position: { x: -halfWidth + 5, y: config.curbHeight, z: sidewalkCenterOffset },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-nw'],
    },
    {
      id: 'node-sidewalk-nw-north',
      position: { x: -sidewalkCenterOffset, y: config.curbHeight, z: halfDepth - 5 },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-nw'],
    },
    {
      id: 'node-sidewalk-se-east',
      position: { x: halfWidth - 5, y: config.curbHeight, z: -sidewalkCenterOffset },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-se'],
    },
    {
      id: 'node-sidewalk-se-south',
      position: { x: sidewalkCenterOffset, y: config.curbHeight, z: -halfDepth + 5 },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-se'],
    },
    {
      id: 'node-sidewalk-sw-west',
      position: { x: -halfWidth + 5, y: config.curbHeight, z: -sidewalkCenterOffset },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-sw'],
    },
    {
      id: 'node-sidewalk-sw-south',
      position: { x: -sidewalkCenterOffset, y: config.curbHeight, z: -halfDepth + 5 },
      kind: 'sidewalk_node',
      connectedNodeIds: ['node-corner-sw'],
    },
  ];

  // Pedestrian Walkway Segments
  const pedestrianSegments: PedestrianWalkwaySegment[] = [
    // Crosswalk segments
    {
      id: 'seg-crosswalk-north',
      kind: 'crosswalk',
      fromNodeId: 'node-corner-nw',
      toNodeId: 'node-corner-ne',
      waypoints: crosswalkNorth.waypoints,
      length: computePathLength(crosswalkNorth.waypoints),
      width: crosswalkWidth,
    },
    {
      id: 'seg-crosswalk-south',
      kind: 'crosswalk',
      fromNodeId: 'node-corner-sw',
      toNodeId: 'node-corner-se',
      waypoints: crosswalkSouth.waypoints,
      length: computePathLength(crosswalkSouth.waypoints),
      width: crosswalkWidth,
    },
    {
      id: 'seg-crosswalk-east',
      kind: 'crosswalk',
      fromNodeId: 'node-corner-se',
      toNodeId: 'node-corner-ne',
      waypoints: crosswalkEast.waypoints,
      length: computePathLength(crosswalkEast.waypoints),
      width: crosswalkWidth,
    },
    {
      id: 'seg-crosswalk-west',
      kind: 'crosswalk',
      fromNodeId: 'node-corner-sw',
      toNodeId: 'node-corner-nw',
      waypoints: crosswalkWest.waypoints,
      length: computePathLength(crosswalkWest.waypoints),
      width: crosswalkWidth,
    },
    // Sidewalk longitudinal branches
    {
      id: 'seg-sidewalk-ne-east',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-ne',
      toNodeId: 'node-sidewalk-ne-east',
      waypoints: sampleLinearPath(
        { x: sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
        { x: halfWidth - 5, y: config.curbHeight, z: sidewalkCenterOffset },
        5,
      ),
      length: (halfWidth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-ne-north',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-ne',
      toNodeId: 'node-sidewalk-ne-north',
      waypoints: sampleLinearPath(
        { x: sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
        { x: sidewalkCenterOffset, y: config.curbHeight, z: halfDepth - 5 },
        5,
      ),
      length: (halfDepth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-nw-west',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-nw',
      toNodeId: 'node-sidewalk-nw-west',
      waypoints: sampleLinearPath(
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
        { x: -halfWidth + 5, y: config.curbHeight, z: sidewalkCenterOffset },
        5,
      ),
      length: (halfWidth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-nw-north',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-nw',
      toNodeId: 'node-sidewalk-nw-north',
      waypoints: sampleLinearPath(
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: halfDepth - 5 },
        5,
      ),
      length: (halfDepth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-se-east',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-se',
      toNodeId: 'node-sidewalk-se-east',
      waypoints: sampleLinearPath(
        { x: sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
        { x: halfWidth - 5, y: config.curbHeight, z: -sidewalkCenterOffset },
        5,
      ),
      length: (halfWidth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-se-south',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-se',
      toNodeId: 'node-sidewalk-se-south',
      waypoints: sampleLinearPath(
        { x: sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
        { x: sidewalkCenterOffset, y: config.curbHeight, z: -halfDepth + 5 },
        5,
      ),
      length: (halfDepth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-sw-west',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-sw',
      toNodeId: 'node-sidewalk-sw-west',
      waypoints: sampleLinearPath(
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
        { x: -halfWidth + 5, y: config.curbHeight, z: -sidewalkCenterOffset },
        5,
      ),
      length: (halfWidth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
    {
      id: 'seg-sidewalk-sw-south',
      kind: 'sidewalk',
      fromNodeId: 'node-corner-sw',
      toNodeId: 'node-sidewalk-sw-south',
      waypoints: sampleLinearPath(
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
        { x: -sidewalkCenterOffset, y: config.curbHeight, z: -halfDepth + 5 },
        5,
      ),
      length: (halfDepth - 5) - sidewalkCenterOffset,
      width: config.sidewalkWidth,
    },
  ];

  const pedestrianNetwork: PedestrianNetwork = {
    nodes: pedestrianNodes,
    segments: pedestrianSegments,
    crosswalks,
  };

  // --------------------------------------------------------------------------
  // Corner Plazas & Intersection
  // --------------------------------------------------------------------------
  const cornerPlazas: CornerPlaza[] = [
    {
      quadrant: 'NE',
      bounds: {
        minX: sidewalkInner,
        maxX: sidewalkOuter,
        minZ: sidewalkInner,
        maxZ: sidewalkOuter,
      },
      center: { x: sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
    },
    {
      quadrant: 'NW',
      bounds: {
        minX: -sidewalkOuter,
        maxX: -sidewalkInner,
        minZ: sidewalkInner,
        maxZ: sidewalkOuter,
      },
      center: { x: -sidewalkCenterOffset, y: config.curbHeight, z: sidewalkCenterOffset },
    },
    {
      quadrant: 'SE',
      bounds: {
        minX: sidewalkInner,
        maxX: sidewalkOuter,
        minZ: -sidewalkOuter,
        maxZ: -sidewalkInner,
      },
      center: { x: sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
    },
    {
      quadrant: 'SW',
      bounds: {
        minX: -sidewalkOuter,
        maxX: -sidewalkInner,
        minZ: -sidewalkOuter,
        maxZ: -sidewalkInner,
      },
      center: { x: -sidewalkCenterOffset, y: config.curbHeight, z: -sidewalkCenterOffset },
    },
  ];

  // --------------------------------------------------------------------------
  // Furniture Anchors
  // --------------------------------------------------------------------------
  const anchors: FurnitureAnchor[] = [];

  // 1. Traffic Lights (at 4 intersection corners)
  const trafficLightPositions: Array<{ pos: Point3D; facing: number; quad: BlockQuadrant; id: string }> = [
    {
      id: 'anchor-traffic-light-ne',
      pos: { x: 7.6, y: config.curbHeight, z: 7.6 },
      facing: Math.PI, // Facing South / West incoming
      quad: 'NE',
    },
    {
      id: 'anchor-traffic-light-nw',
      pos: { x: -7.6, y: config.curbHeight, z: 7.6 },
      facing: (3 * Math.PI) / 2, // Facing South / East incoming
      quad: 'NW',
    },
    {
      id: 'anchor-traffic-light-se',
      pos: { x: 7.6, y: config.curbHeight, z: -7.6 },
      facing: Math.PI / 2, // Facing North / West incoming
      quad: 'SE',
    },
    {
      id: 'anchor-traffic-light-sw',
      pos: { x: -7.6, y: config.curbHeight, z: -7.6 },
      facing: 0, // Facing North / East incoming
      quad: 'SW',
    },
  ];

  for (const tl of trafficLightPositions) {
    anchors.push({
      id: tl.id,
      kind: 'traffic_light',
      position: tl.pos,
      facing: tl.facing,
      facingVector: angleToFacingVector(tl.facing),
      quadrant: tl.quad,
      tags: ['intersection', 'traffic_control', 'signal'],
    });
  }

  // 2. Lamp Posts (spaced along all 4 sidewalk frontages)
  const lampSpacings = [18, 36, 54, 72];
  let lampCounter = 1;

  for (const d of lampSpacings) {
    // North sidewalk (Market St): facing South (0 rad)
    anchors.push({
      id: `anchor-lamp-market-n-pos-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: d, y: config.curbHeight, z: 7.8 },
      facing: 0,
      facingVector: angleToFacingVector(0),
      quadrant: 'NE',
      streetName: 'Market Street',
      tags: ['lighting', 'street_lamp', 'north_sidewalk'],
    });
    anchors.push({
      id: `anchor-lamp-market-n-neg-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: -d, y: config.curbHeight, z: 7.8 },
      facing: 0,
      facingVector: angleToFacingVector(0),
      quadrant: 'NW',
      streetName: 'Market Street',
      tags: ['lighting', 'street_lamp', 'north_sidewalk'],
    });

    // South sidewalk (Market St): facing North (PI rad)
    anchors.push({
      id: `anchor-lamp-market-s-pos-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: d, y: config.curbHeight, z: -7.8 },
      facing: Math.PI,
      facingVector: angleToFacingVector(Math.PI),
      quadrant: 'SE',
      streetName: 'Market Street',
      tags: ['lighting', 'street_lamp', 'south_sidewalk'],
    });
    anchors.push({
      id: `anchor-lamp-market-s-neg-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: -d, y: config.curbHeight, z: -7.8 },
      facing: Math.PI,
      facingVector: angleToFacingVector(Math.PI),
      quadrant: 'SW',
      streetName: 'Market Street',
      tags: ['lighting', 'street_lamp', 'south_sidewalk'],
    });

    // East sidewalk (Main Ave): facing West ((3*PI)/2 rad)
    anchors.push({
      id: `anchor-lamp-main-e-pos-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: 7.8, y: config.curbHeight, z: d },
      facing: (3 * Math.PI) / 2,
      facingVector: angleToFacingVector((3 * Math.PI) / 2),
      quadrant: 'NE',
      streetName: 'Main Avenue',
      tags: ['lighting', 'street_lamp', 'east_sidewalk'],
    });
    anchors.push({
      id: `anchor-lamp-main-e-neg-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: 7.8, y: config.curbHeight, z: -d },
      facing: (3 * Math.PI) / 2,
      facingVector: angleToFacingVector((3 * Math.PI) / 2),
      quadrant: 'SE',
      streetName: 'Main Avenue',
      tags: ['lighting', 'street_lamp', 'east_sidewalk'],
    });

    // West sidewalk (Main Ave): facing East (PI/2 rad)
    anchors.push({
      id: `anchor-lamp-main-w-pos-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: -7.8, y: config.curbHeight, z: d },
      facing: Math.PI / 2,
      facingVector: angleToFacingVector(Math.PI / 2),
      quadrant: 'NW',
      streetName: 'Main Avenue',
      tags: ['lighting', 'street_lamp', 'west_sidewalk'],
    });
    anchors.push({
      id: `anchor-lamp-main-w-neg-${lampCounter}`,
      kind: 'lamp_post',
      position: { x: -7.8, y: config.curbHeight, z: -d },
      facing: Math.PI / 2,
      facingVector: angleToFacingVector(Math.PI / 2),
      quadrant: 'SW',
      streetName: 'Main Avenue',
      tags: ['lighting', 'street_lamp', 'west_sidewalk'],
    });

    lampCounter += 1;
  }

  // 3. Fire Hydrants
  const hydrantSpecs = [
    { id: 'hydrant-ne-1', x: 8.2, z: 13.0, facing: (3 * Math.PI) / 2, quad: 'NE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'hydrant-nw-1', x: -8.2, z: 13.0, facing: Math.PI / 2, quad: 'NW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'hydrant-se-1', x: 8.2, z: -13.0, facing: (3 * Math.PI) / 2, quad: 'SE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'hydrant-sw-1', x: -8.2, z: -13.0, facing: Math.PI / 2, quad: 'SW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'hydrant-ne-2', x: 42.0, z: 7.8, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'hydrant-nw-2', x: -42.0, z: 7.8, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'hydrant-se-2', x: 42.0, z: -7.8, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'hydrant-sw-2', x: -42.0, z: -7.8, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
  ];

  for (const h of hydrantSpecs) {
    anchors.push({
      id: `anchor-${h.id}`,
      kind: 'fire_hydrant',
      position: { x: h.x, y: config.curbHeight, z: h.z },
      facing: h.facing,
      facingVector: angleToFacingVector(h.facing),
      quadrant: h.quad,
      streetName: h.street,
      tags: ['utility', 'fire_safety', 'curbside'],
    });
  }

  // 4. Benches (facing street from sidewalk buffer)
  const benchSpecs = [
    { id: 'bench-ne-1', x: 26.0, z: 9.5, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-ne-2', x: 62.0, z: 9.5, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-nw-1', x: -26.0, z: 9.5, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-nw-2', x: -62.0, z: 9.5, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-se-1', x: 26.0, z: -9.5, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-se-2', x: 62.0, z: -9.5, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-sw-1', x: -26.0, z: -9.5, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-sw-2', x: -62.0, z: -9.5, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bench-ne-3', x: 9.5, z: 26.0, facing: (3 * Math.PI) / 2, quad: 'NE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-ne-4', x: 9.5, z: 62.0, facing: (3 * Math.PI) / 2, quad: 'NE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-nw-3', x: -9.5, z: 26.0, facing: Math.PI / 2, quad: 'NW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-nw-4', x: -9.5, z: 62.0, facing: Math.PI / 2, quad: 'NW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-se-3', x: 9.5, z: -26.0, facing: (3 * Math.PI) / 2, quad: 'SE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-se-4', x: 9.5, z: -62.0, facing: (3 * Math.PI) / 2, quad: 'SE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-sw-3', x: -9.5, z: -26.0, facing: Math.PI / 2, quad: 'SW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bench-sw-4', x: -9.5, z: -62.0, facing: Math.PI / 2, quad: 'SW' as BlockQuadrant, street: 'Main Avenue' },
  ];

  for (const b of benchSpecs) {
    anchors.push({
      id: `anchor-${b.id}`,
      kind: 'bench',
      position: { x: b.x, y: config.curbHeight, z: b.z },
      facing: b.facing,
      facingVector: angleToFacingVector(b.facing),
      quadrant: b.quad,
      streetName: b.street,
      tags: ['seating', 'furniture', 'street_life'],
    });
  }

  // 5. Trees (planters along sidewalk)
  const treeDistances = [22, 44, 66];
  let treeCounter = 1;

  for (const d of treeDistances) {
    anchors.push({
      id: `anchor-tree-market-ne-${treeCounter}`,
      kind: 'tree',
      position: { x: d, y: config.curbHeight, z: 8.5 },
      facing: 0,
      facingVector: angleToFacingVector(0),
      quadrant: 'NE',
      streetName: 'Market Street',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-market-nw-${treeCounter}`,
      kind: 'tree',
      position: { x: -d, y: config.curbHeight, z: 8.5 },
      facing: 0,
      facingVector: angleToFacingVector(0),
      quadrant: 'NW',
      streetName: 'Market Street',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-market-se-${treeCounter}`,
      kind: 'tree',
      position: { x: d, y: config.curbHeight, z: -8.5 },
      facing: Math.PI,
      facingVector: angleToFacingVector(Math.PI),
      quadrant: 'SE',
      streetName: 'Market Street',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-market-sw-${treeCounter}`,
      kind: 'tree',
      position: { x: -d, y: config.curbHeight, z: -8.5 },
      facing: Math.PI,
      facingVector: angleToFacingVector(Math.PI),
      quadrant: 'SW',
      streetName: 'Market Street',
      tags: ['greenery', 'foliage', 'street_tree'],
    });

    anchors.push({
      id: `anchor-tree-main-ne-${treeCounter}`,
      kind: 'tree',
      position: { x: 8.5, y: config.curbHeight, z: d },
      facing: (3 * Math.PI) / 2,
      facingVector: angleToFacingVector((3 * Math.PI) / 2),
      quadrant: 'NE',
      streetName: 'Main Avenue',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-main-nw-${treeCounter}`,
      kind: 'tree',
      position: { x: -8.5, y: config.curbHeight, z: d },
      facing: Math.PI / 2,
      facingVector: angleToFacingVector(Math.PI / 2),
      quadrant: 'NW',
      streetName: 'Main Avenue',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-main-se-${treeCounter}`,
      kind: 'tree',
      position: { x: 8.5, y: config.curbHeight, z: -d },
      facing: (3 * Math.PI) / 2,
      facingVector: angleToFacingVector((3 * Math.PI) / 2),
      quadrant: 'SE',
      streetName: 'Main Avenue',
      tags: ['greenery', 'foliage', 'street_tree'],
    });
    anchors.push({
      id: `anchor-tree-main-sw-${treeCounter}`,
      kind: 'tree',
      position: { x: -8.5, y: config.curbHeight, z: -d },
      facing: Math.PI / 2,
      facingVector: angleToFacingVector(Math.PI / 2),
      quadrant: 'SW',
      streetName: 'Main Avenue',
      tags: ['greenery', 'foliage', 'street_tree'],
    });

    treeCounter += 1;
  }

  // 6. Trash Bins
  const trashBinSpecs = [
    { id: 'bin-ne-1', x: 8.0, z: 11.5, facing: (3 * Math.PI) / 2, quad: 'NE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bin-nw-1', x: -8.0, z: 11.5, facing: Math.PI / 2, quad: 'NW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bin-se-1', x: 8.0, z: -11.5, facing: (3 * Math.PI) / 2, quad: 'SE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bin-sw-1', x: -8.0, z: -11.5, facing: Math.PI / 2, quad: 'SW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'bin-ne-2', x: 11.5, z: 8.0, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-nw-2', x: -11.5, z: 8.0, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-se-2', x: 11.5, z: -8.0, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-sw-2', x: -11.5, z: -8.0, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-ne-3', x: 50.0, z: 8.0, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-nw-3', x: -50.0, z: 8.0, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-se-3', x: 50.0, z: -8.0, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'bin-sw-3', x: -50.0, z: -8.0, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
  ];

  for (const b of trashBinSpecs) {
    anchors.push({
      id: `anchor-${b.id}`,
      kind: 'trash_bin',
      position: { x: b.x, y: config.curbHeight, z: b.z },
      facing: b.facing,
      facingVector: angleToFacingVector(b.facing),
      quadrant: b.quad,
      streetName: b.street,
      tags: ['sanitation', 'waste_bin', 'street_furniture'],
    });
  }

  // 7. Booths (phone booth / newsstand / kiosk at corner sidewalk plazas)
  const boothSpecs = [
    { id: 'booth-ne', x: 9.8, z: 10.2, facing: 0, quad: 'NE' as BlockQuadrant, street: 'Market Street' },
    { id: 'booth-nw', x: -9.8, z: 10.2, facing: 0, quad: 'NW' as BlockQuadrant, street: 'Market Street' },
    { id: 'booth-se', x: 9.8, z: -10.2, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'booth-sw', x: -9.8, z: -10.2, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
  ];

  for (const booth of boothSpecs) {
    anchors.push({
      id: `anchor-${booth.id}`,
      kind: 'booth',
      position: { x: booth.x, y: config.curbHeight, z: booth.z },
      facing: booth.facing,
      facingVector: angleToFacingVector(booth.facing),
      quadrant: booth.quad,
      streetName: booth.street,
      tags: ['kiosk', 'newsstand', 'phone_booth', 'corner_plaza'],
    });
  }

  // 8. Mailboxes
  const mailboxSpecs = [
    { id: 'mailbox-ne', x: 8.2, z: 14.5, facing: (3 * Math.PI) / 2, quad: 'NE' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'mailbox-nw', x: -8.2, z: 14.5, facing: Math.PI / 2, quad: 'NW' as BlockQuadrant, street: 'Main Avenue' },
    { id: 'mailbox-se', x: 14.5, z: -8.2, facing: Math.PI, quad: 'SE' as BlockQuadrant, street: 'Market Street' },
    { id: 'mailbox-sw', x: -14.5, z: -8.2, facing: Math.PI, quad: 'SW' as BlockQuadrant, street: 'Market Street' },
  ];

  for (const m of mailboxSpecs) {
    anchors.push({
      id: `anchor-${m.id}`,
      kind: 'mailbox',
      position: { x: m.x, y: config.curbHeight, z: m.z },
      facing: m.facing,
      facingVector: angleToFacingVector(m.facing),
      quadrant: m.quad,
      streetName: m.street,
      tags: ['postal', 'collection_box', 'street_furniture'],
    });
  }

  // Intersection object
  const intersection: Intersection = {
    id: 'intersection-central',
    center: { x: 0, y: 0, z: 0 },
    bounds: {
      minX: -sidewalkOuter,
      maxX: sidewalkOuter,
      minZ: -sidewalkOuter,
      maxZ: sidewalkOuter,
    },
    asphaltBounds: {
      minX: -halfRoad,
      maxX: halfRoad,
      minZ: -halfRoad,
      maxZ: halfRoad,
    },
    crosswalks,
    trafficLightAnchors: anchors.filter((a) => a.kind === 'traffic_light'),
    cornerPlazas,
  };

  // --------------------------------------------------------------------------
  // Building Lots (16 lots total across 4 quadrants)
  // --------------------------------------------------------------------------
  // Each quadrant has 4 cleanly separated parcels with 4m alleyways between them:
  // - Lot 1: Corner parcel facing Main Ave and Market St
  // - Lot 2: Avenue parcel facing Main Ave
  // - Lot 3: Street parcel facing Market St
  // - Lot 4: Deep block parcel
  const lots: BuildingLot[] = [];

  const midCoord1 = 45; // boundary of inner lots (12m to 45m = 33m wide)
  const midCoord2 = 49; // start of outer lots (49m to 82m = 33m wide, 4m alley)

  // Quadrant NE (X >= 12, Z >= 12)
  lots.push(
    createBuildingLot({
      id: 'lot-ne-01',
      name: '101 North Main Street',
      quadrant: 'NE',
      minX: lotStart,
      maxX: midCoord1,
      minZ: lotStart,
      maxZ: midCoord1,
      frontageStreet: 'Main Avenue',
      frontageDir: 'west',
      secondaryStreet: 'Market Street',
      secondaryDir: 'south',
      zoning: 'commercial',
      heightLimits: { min: 25, max: 75, recommended: 52 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-ne-02',
      name: '125 North Main Street',
      quadrant: 'NE',
      minX: lotStart,
      maxX: midCoord1,
      minZ: midCoord2,
      maxZ: lotMaxExtent,
      frontageStreet: 'Main Avenue',
      frontageDir: 'west',
      zoning: 'mixed_use',
      heightLimits: { min: 18, max: 48, recommended: 32 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-ne-03',
      name: '210 East Market Street',
      quadrant: 'NE',
      minX: midCoord2,
      maxX: lotMaxExtent,
      minZ: lotStart,
      maxZ: midCoord1,
      frontageStreet: 'Market Street',
      frontageDir: 'south',
      zoning: 'commercial',
      heightLimits: { min: 20, max: 55, recommended: 38 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-ne-04',
      name: '225 East Market Arcade',
      quadrant: 'NE',
      minX: midCoord2,
      maxX: lotMaxExtent,
      minZ: midCoord2,
      maxZ: lotMaxExtent,
      frontageStreet: 'Market Street',
      frontageDir: 'south',
      zoning: 'residential',
      heightLimits: { min: 12, max: 36, recommended: 22 },
      elevation: 0,
      rng,
    }),
  );

  // Quadrant NW (X <= -12, Z >= 12)
  lots.push(
    createBuildingLot({
      id: 'lot-nw-01',
      name: '102 North Main Street',
      quadrant: 'NW',
      minX: -midCoord1,
      maxX: -lotStart,
      minZ: lotStart,
      maxZ: midCoord1,
      frontageStreet: 'Main Avenue',
      frontageDir: 'east',
      secondaryStreet: 'Market Street',
      secondaryDir: 'south',
      zoning: 'commercial',
      heightLimits: { min: 25, max: 70, recommended: 48 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-nw-02',
      name: '126 North Main Street',
      quadrant: 'NW',
      minX: -midCoord1,
      maxX: -lotStart,
      minZ: midCoord2,
      maxZ: lotMaxExtent,
      frontageStreet: 'Main Avenue',
      frontageDir: 'east',
      zoning: 'mixed_use',
      heightLimits: { min: 16, max: 45, recommended: 28 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-nw-03',
      name: '209 West Market Street',
      quadrant: 'NW',
      minX: -lotMaxExtent,
      maxX: -midCoord2,
      minZ: lotStart,
      maxZ: midCoord1,
      frontageStreet: 'Market Street',
      frontageDir: 'south',
      zoning: 'commercial',
      heightLimits: { min: 20, max: 50, recommended: 34 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-nw-04',
      name: '228 West Market Plaza',
      quadrant: 'NW',
      minX: -lotMaxExtent,
      maxX: -midCoord2,
      minZ: midCoord2,
      maxZ: lotMaxExtent,
      frontageStreet: 'Market Street',
      frontageDir: 'south',
      zoning: 'residential',
      heightLimits: { min: 12, max: 32, recommended: 20 },
      elevation: 0,
      rng,
    }),
  );

  // Quadrant SE (X >= 12, Z <= -12)
  lots.push(
    createBuildingLot({
      id: 'lot-se-01',
      name: '101 South Main Street',
      quadrant: 'SE',
      minX: lotStart,
      maxX: midCoord1,
      minZ: -midCoord1,
      maxZ: -lotStart,
      frontageStreet: 'Main Avenue',
      frontageDir: 'west',
      secondaryStreet: 'Market Street',
      secondaryDir: 'north',
      zoning: 'commercial',
      heightLimits: { min: 28, max: 80, recommended: 58 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-se-02',
      name: '127 South Main Street',
      quadrant: 'SE',
      minX: lotStart,
      maxX: midCoord1,
      minZ: -lotMaxExtent,
      maxZ: -midCoord2,
      frontageStreet: 'Main Avenue',
      frontageDir: 'west',
      zoning: 'civic',
      heightLimits: { min: 15, max: 42, recommended: 26 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-se-03',
      name: '211 East Market Street',
      quadrant: 'SE',
      minX: midCoord2,
      maxX: lotMaxExtent,
      minZ: -midCoord1,
      maxZ: -lotStart,
      frontageStreet: 'Market Street',
      frontageDir: 'north',
      zoning: 'commercial',
      heightLimits: { min: 22, max: 60, recommended: 40 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-se-04',
      name: '235 East Market Court',
      quadrant: 'SE',
      minX: midCoord2,
      maxX: lotMaxExtent,
      minZ: -lotMaxExtent,
      maxZ: -midCoord2,
      frontageStreet: 'Market Street',
      frontageDir: 'north',
      zoning: 'residential',
      heightLimits: { min: 14, max: 38, recommended: 24 },
      elevation: 0,
      rng,
    }),
  );

  // Quadrant SW (X <= -12, Z <= -12)
  lots.push(
    createBuildingLot({
      id: 'lot-sw-01',
      name: '102 South Main Street',
      quadrant: 'SW',
      minX: -midCoord1,
      maxX: -lotStart,
      minZ: -midCoord1,
      maxZ: -lotStart,
      frontageStreet: 'Main Avenue',
      frontageDir: 'east',
      secondaryStreet: 'Market Street',
      secondaryDir: 'north',
      zoning: 'commercial',
      heightLimits: { min: 26, max: 72, recommended: 50 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-sw-02',
      name: '128 South Main Street',
      quadrant: 'SW',
      minX: -midCoord1,
      maxX: -lotStart,
      minZ: -lotMaxExtent,
      maxZ: -midCoord2,
      frontageStreet: 'Main Avenue',
      frontageDir: 'east',
      zoning: 'mixed_use',
      heightLimits: { min: 16, max: 44, recommended: 30 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-sw-03',
      name: '212 West Market Street',
      quadrant: 'SW',
      minX: -lotMaxExtent,
      maxX: -midCoord2,
      minZ: -midCoord1,
      maxZ: -lotStart,
      frontageStreet: 'Market Street',
      frontageDir: 'north',
      zoning: 'commercial',
      heightLimits: { min: 20, max: 52, recommended: 36 },
      elevation: 0,
      rng,
    }),
    createBuildingLot({
      id: 'lot-sw-04',
      name: '240 West Market Court',
      quadrant: 'SW',
      minX: -lotMaxExtent,
      maxX: -midCoord2,
      minZ: -lotMaxExtent,
      maxZ: -midCoord2,
      frontageStreet: 'Market Street',
      frontageDir: 'north',
      zoning: 'residential',
      heightLimits: { min: 10, max: 30, recommended: 18 },
      elevation: 0,
      rng,
    }),
  );

  // --------------------------------------------------------------------------
  // Assembly of BlockLayout Object
  // --------------------------------------------------------------------------
  const layout: BlockLayout = {
    seed,
    dimensions,
    streets,
    intersection,
    asphaltAreas,
    sidewalkBands,
    lots,
    lanes: allLanes,
    pedestrianNetwork,
    furnitureAnchors: anchors,

    getLotById(id: string): BuildingLot | undefined {
      return lots.find((lot) => lot.id === id);
    },

    getLotsByQuadrant(quadrant: BlockQuadrant): BuildingLot[] {
      return lots.filter((lot) => lot.quadrant === quadrant);
    },

    getAnchorsByKind(kind: FurnitureAnchorKind): FurnitureAnchor[] {
      return anchors.filter((anchor) => anchor.kind === kind);
    },

    getLanesByDirection(direction: LaneDirection): VehicleLane[] {
      return allLanes.filter((lane) => lane.direction === direction);
    },

    findClosestAnchor(point: Point3D, kind?: FurnitureAnchorKind): FurnitureAnchor | undefined {
      let closest: FurnitureAnchor | undefined;
      let minDistance = Infinity;

      for (const anchor of anchors) {
        if (kind && anchor.kind !== kind) continue;
        const d = distance2(point.x, point.z, anchor.position.x, anchor.position.z);
        if (d < minDistance) {
          minDistance = d;
          closest = anchor;
        }
      }
      return closest;
    },
  };

  return layout;
}

// ============================================================================
// Internal Lot Builder Helper
// ============================================================================

interface LotBuilderParams {
  id: string;
  name: string;
  quadrant: BlockQuadrant;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  frontageStreet: string;
  frontageDir: CardinalDirection;
  secondaryStreet?: string;
  secondaryDir?: CardinalDirection;
  zoning: 'commercial' | 'mixed_use' | 'residential' | 'civic';
  heightLimits: { min: number; max: number; recommended: number };
  elevation: number;
  rng: Rng;
}

function createBuildingLot(params: LotBuilderParams): BuildingLot {
  const width = params.maxX - params.minX;
  const depth = params.maxZ - params.minZ;
  const centerX = (params.minX + params.maxX) / 2;
  const centerZ = (params.minZ + params.maxZ) / 2;
  const area = width * depth;

  const normal = directionToVector2D(params.frontageDir);
  const angle = directionToAngle(params.frontageDir);

  // Frontage entry point and storefront zone
  let entryX = centerX;
  let entryZ = centerZ;
  let facadeWidth = width;

  switch (params.frontageDir) {
    case 'west':
      entryX = params.minX;
      entryZ = centerZ;
      facadeWidth = depth;
      break;
    case 'east':
      entryX = params.maxX;
      entryZ = centerZ;
      facadeWidth = depth;
      break;
    case 'south':
      entryX = centerX;
      entryZ = params.minZ;
      facadeWidth = width;
      break;
    case 'north':
      entryX = centerX;
      entryZ = params.maxZ;
      facadeWidth = width;
      break;
  }

  const primaryFrontage: BuildingLotFrontage = {
    streetName: params.frontageStreet,
    direction: params.frontageDir,
    normal,
    angle,
    curbDistance: 1.0,
    entryPoint: { x: entryX, y: params.elevation, z: entryZ },
  };

  let secondaryFrontage: BuildingLotFrontage | undefined;
  if (params.secondaryStreet && params.secondaryDir) {
    let secEntryX = centerX;
    let secEntryZ = centerZ;
    switch (params.secondaryDir) {
      case 'west':
        secEntryX = params.minX;
        break;
      case 'east':
        secEntryX = params.maxX;
        break;
      case 'south':
        secEntryZ = params.minZ;
        break;
      case 'north':
        secEntryZ = params.maxZ;
        break;
    }
    secondaryFrontage = {
      streetName: params.secondaryStreet,
      direction: params.secondaryDir,
      normal: directionToVector2D(params.secondaryDir),
      angle: directionToAngle(params.secondaryDir),
      curbDistance: 1.0,
      entryPoint: { x: secEntryX, y: params.elevation, z: secEntryZ },
    };
  }

  const storefrontZone: StorefrontZone = {
    facadeWidth,
    entryPoint: { x: entryX, y: params.elevation, z: entryZ },
    signageAnchor: { x: entryX, y: params.elevation + 4.2, z: entryZ },
    canopyAnchor: { x: entryX, y: params.elevation + 3.2, z: entryZ },
  };

  return {
    id: params.id,
    name: params.name,
    quadrant: params.quadrant,
    bounds: {
      minX: params.minX,
      maxX: params.maxX,
      minZ: params.minZ,
      maxZ: params.maxZ,
    },
    center: {
      x: centerX,
      y: params.elevation,
      z: centerZ,
    },
    size: {
      width,
      depth,
      height: params.heightLimits.recommended,
    },
    footprint: {
      minX: params.minX,
      maxX: params.maxX,
      minZ: params.minZ,
      maxZ: params.maxZ,
      width,
      depth,
      area,
    },
    heightLimits: params.heightLimits,
    frontage: primaryFrontage,
    secondaryFrontage,
    zoning: params.zoning,
    storefrontZone,
  };
}

// ============================================================================
// Query Utilities (Exported for downstream consumers)
// ============================================================================

/**
 * Check if a 2D or 3D point lies inside any asphalt road area.
 */
export function isPointInAsphalt(layout: BlockLayout, point: Point2D | Point3D): boolean {
  return layout.asphaltAreas.some((rect) => isPointInRect(point, rect));
}

/**
 * Check if a 2D or 3D point lies inside any sidewalk band.
 */
export function isPointInSidewalk(layout: BlockLayout, point: Point2D | Point3D): boolean {
  return layout.sidewalkBands.some((band) => isPointInRect(point, band.bounds));
}

/**
 * Check if a 2D or 3D point lies inside any building lot.
 * Returns the matching lot if found, or undefined.
 */
export function findLotAtPoint(layout: BlockLayout, point: Point2D | Point3D): BuildingLot | undefined {
  return layout.lots.find((lot) => isPointInRect(point, lot.bounds));
}

/**
 * Sample a position along a TrafficPath at normalized parameter t in [0, 1].
 */
export function sampleTrafficPath(path: TrafficPath, t: number): Point3D {
  if (path.waypoints.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  if (path.waypoints.length === 1 || t <= 0) {
    const wp = path.waypoints[0]!;
    return { x: wp.x, y: wp.y, z: wp.z };
  }
  if (t >= 1) {
    const wp = path.waypoints[path.waypoints.length - 1]!;
    return { x: wp.x, y: wp.y, z: wp.z };
  }

  const targetDist = t * path.length;
  let accumulated = 0;

  for (let i = 1; i < path.waypoints.length; i += 1) {
    const p0 = path.waypoints[i - 1]!;
    const p1 = path.waypoints[i]!;
    const segDist = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);

    if (accumulated + segDist >= targetDist) {
      const segT = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      return {
        x: p0.x + (p1.x - p0.x) * segT,
        y: p0.y + (p1.y - p0.y) * segT,
        z: p0.z + (p1.z - p0.z) * segT,
      };
    }
    accumulated += segDist;
  }

  const last = path.waypoints[path.waypoints.length - 1]!;
  return { x: last.x, y: last.y, z: last.z };
}
