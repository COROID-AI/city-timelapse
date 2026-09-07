import { LotAnchor, createLotAnchor } from './lotAnchors';
import { BuildingShell } from '../types/buildingShell';
import { Rect, RotationDeg, Vec2 } from '../types/city';
import { EraYear } from '../types/city';

/**
 * City block layout.
 *
 * A single city block on a ground plane, with surrounding streets and
 * sidewalks, an intersection, and a data-driven lot/parcel map (10 lots plus
 * a cross street). Every era inherits this geometry; downstream era modules
 * only vary the *content* placed on each lot.
 *
 * Coordinate conventions:
 *  - World units are meters. y = 0 is the ground plane, y is up.
 *  - The block is centered on the world origin. x runs east (+), z runs south (+).
 *  - Lot anchors are the stable placement contract (see lotAnchors.ts).
 */

export interface StreetSegment {
  id: string;
  /** Footprint of the drivable street surface. */
  rect: Rect;
  /** Direction of travel, used by the placeholder vehicle loop. */
  direction: 'east' | 'west' | 'north' | 'south';
}

export interface SidewalkSegment {
  id: string;
  rect: Rect;
}

export interface Intersection {
  id: string;
  rect: Rect;
  center: Vec2;
}

export interface CityBlockLayout {
  /** Overall footprint of the ground plane. */
  ground: Rect;
  /** Drivable street segments forming the perimeter ring. */
  streets: readonly StreetSegment[];
  /** Sidewalk strips between streets and lots. */
  sidewalks: readonly SidewalkSegment[];
  /** The single intersection (south-east corner). */
  intersection: Intersection;
  /** The 10 lot anchors. */
  lots: readonly LotAnchor[];
  /** The cross street running east-west across the block. */
  crossStreet: StreetSegment;
  /** World-space bounds used to clamp the camera. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** World units. */
const BLOCK_SIZE = 60; // block footprint (lots area) per side
const STREET_WIDTH = 16;
const SIDEWALK_WIDTH = 4;
const LOT_COUNT = 10;

/**
 * Build the data-driven city block layout.
 *
 * The block is centered at the origin. Lots are laid out in a 5x2 grid
 * (5 across x, 2 deep z) with a 4-unit cross street running east-west
 * between the two rows, leaving a 10-lot parcel map. A curb-to-curb street
 * ring plus sidewalks wraps the block.
 */
export function createCityBlockLayout(): CityBlockLayout {
  // Lot grid geometry.
  const cols = 5;
  const rows = 2;
  const crossStreetWidth = 4;
  const lotWidth = BLOCK_SIZE / cols; // 12
  const lotDepth = (BLOCK_SIZE - crossStreetWidth) / rows; // 28

  // Block origin (min x, min z) of the lots area, centered on world origin.
  const blockMinX = -BLOCK_SIZE / 2;
  const blockMinZ = -BLOCK_SIZE / 2;

  const lots: LotAnchor[] = [];
  let lotIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = blockMinX + c * lotWidth;
      // Row 0 sits north of the cross street; row 1 sits south of it.
      const oz = blockMinZ + r * (lotDepth + crossStreetWidth);
      const rotation: RotationDeg = r === 0 ? 0 : 180;
      lots.push(
        createLotAnchor({ x: ox, z: oz }, lotWidth, lotDepth, rotation),
      );
      lotIndex++;
    }
  }
  if (lots.length !== LOT_COUNT) {
    throw new Error(`Expected ${LOT_COUNT} lots, got ${lots.length}`);
  }

  // Cross street runs east-west between the two rows.
  const crossStreet: StreetSegment = {
    id: 'cross-street',
    rect: {
      origin: { x: blockMinX, z: blockMinZ + lotDepth },
      width: BLOCK_SIZE,
      depth: crossStreetWidth,
    },
    direction: 'east',
  };

  // Perimeter streets (curb to curb) around the whole block.
  const streets: StreetSegment[] = [
    {
      id: 'street-north',
      rect: {
        origin: { x: blockMinX - STREET_WIDTH, z: blockMinZ - STREET_WIDTH },
        width: BLOCK_SIZE + STREET_WIDTH * 2,
        depth: STREET_WIDTH,
      },
      direction: 'east',
    },
    {
      id: 'street-south',
      rect: {
        origin: { x: blockMinX - STREET_WIDTH, z: blockMinZ + BLOCK_SIZE },
        width: BLOCK_SIZE + STREET_WIDTH * 2,
        depth: STREET_WIDTH,
      },
      direction: 'west',
    },
    {
      id: 'street-west',
      rect: {
        origin: { x: blockMinX - STREET_WIDTH, z: blockMinZ },
        width: STREET_WIDTH,
        depth: BLOCK_SIZE,
      },
      direction: 'north',
    },
    {
      id: 'street-east',
      rect: {
        origin: { x: blockMinX + BLOCK_SIZE, z: blockMinZ },
        width: STREET_WIDTH,
        depth: BLOCK_SIZE,
      },
      direction: 'south',
    },
  ];

  // Sidewalks: a strip between each street and the lots.
  const sidewalks: SidewalkSegment[] = [
    {
      id: 'sidewalk-north',
      rect: {
        origin: { x: blockMinX, z: blockMinZ - SIDEWALK_WIDTH },
        width: BLOCK_SIZE,
        depth: SIDEWALK_WIDTH,
      },
    },
    {
      id: 'sidewalk-south',
      rect: {
        origin: { x: blockMinX, z: blockMinZ + BLOCK_SIZE },
        width: BLOCK_SIZE,
        depth: SIDEWALK_WIDTH,
      },
    },
    {
      id: 'sidewalk-west',
      rect: {
        origin: { x: blockMinX - SIDEWALK_WIDTH, z: blockMinZ },
        width: SIDEWALK_WIDTH,
        depth: BLOCK_SIZE,
      },
    },
    {
      id: 'sidewalk-east',
      rect: {
        origin: { x: blockMinX + BLOCK_SIZE, z: blockMinZ },
        width: SIDEWALK_WIDTH,
        depth: BLOCK_SIZE,
      },
    },
  ];

  // Intersection at the south-east corner where the south and east streets meet.
  const intersection: Intersection = {
    id: 'intersection-se',
    rect: {
      origin: {
        x: blockMinX + BLOCK_SIZE,
        z: blockMinZ + BLOCK_SIZE,
      },
      width: STREET_WIDTH,
      depth: STREET_WIDTH,
    },
    center: {
      x: blockMinX + BLOCK_SIZE + STREET_WIDTH / 2,
      z: blockMinZ + BLOCK_SIZE + STREET_WIDTH / 2,
    },
  };

  const bounds = {
    minX: blockMinX - STREET_WIDTH - SIDEWALK_WIDTH,
    maxX: blockMinX + BLOCK_SIZE + STREET_WIDTH + SIDEWALK_WIDTH,
    minZ: blockMinZ - STREET_WIDTH - SIDEWALK_WIDTH,
    maxZ: blockMinZ + BLOCK_SIZE + STREET_WIDTH + SIDEWALK_WIDTH,
  };

  return {
    ground: {
      origin: { x: blockMinX - STREET_WIDTH - SIDEWALK_WIDTH, z: blockMinZ - STREET_WIDTH - SIDEWALK_WIDTH },
      width: BLOCK_SIZE + (STREET_WIDTH + SIDEWALK_WIDTH) * 2,
      depth: BLOCK_SIZE + (STREET_WIDTH + SIDEWALK_WIDTH) * 2,
    },
    streets,
    sidewalks,
    intersection,
    lots,
    crossStreet,
    bounds,
  };
}

/**
 * Build the default placeholder building shells for all lots.
 * Each shell occupies most of its lot, leaving a small setback, and is the
 * simple grey box the placeholder pipeline renders.
 */
export function createDefaultBuildingShells(
  layout: CityBlockLayout,
  era: EraYear,
): BuildingShell[] {
  const setback = 2;
  return layout.lots.map((lot, i) => {
    const w = lot.width - setback * 2;
    const d = lot.depth - setback * 2;
    const origin: Vec2 = {
      x: lot.origin.x + setback,
      z: lot.origin.z + setback,
    };
    return {
      id: `shell-${i}`,
      rect: { origin, width: w, depth: d },
      height: 8 + (i % 4) * 3,
      rotation: lot.rotation,
      era,
    };
  });
}