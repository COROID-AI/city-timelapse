/**
 * City block layout generator for the City Time Period Timelapse.
 *
 * Defines the building lots that line both sides of the street. The block is
 * centred at the world origin: the road runs along the Z axis (length 60 m),
 * flanked by sidewalks (3.5 m) and then building lots on the outer edges.
 *
 * Lots are computed deterministically from the street layout constants so the
 * same geometry is produced every time — the procedural building builder then
 * fills each lot with an era-appropriate building.
 */

import * as THREE from 'three';
import type { BuildingLot } from './assetBuilder/buildings.js';
import { STREET_LAYOUT } from './assetBuilder/streets.js';

// ---------------------------------------------------------------------------
// Layout constants (derived from STREET_LAYOUT)
// ---------------------------------------------------------------------------

/** Half the road width. */
const HALF_ROAD = STREET_LAYOUT.roadWidth / 2; // 4
/** Full sidewalk width. */
const SIDEWALK = STREET_LAYOUT.sidewalkWidth; // 3.5
/** Distance from centre to the inner edge of the building lots. */
const LOT_INNER_X = HALF_ROAD + SIDEWALK; // 7.5
/** Total depth available for buildings on each side (along X). */
const LOT_DEPTH = 12;
/** Half the road length. */
const HALF_LENGTH = STREET_LAYOUT.roadLength / 2; // 30
/** Number of lots along each side of the street. */
const LOTS_PER_SIDE = 5;
/** Gap between adjacent lots (for visual separation). */
const LOT_GAP = 1.5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic building-lot layout for the city block.
 *
 * The layout places `LOTS_PER_SIDE` lots on the east side and `LOTS_PER_SIDE`
 * lots on the west side of the street. Each lot's centre X is at
 * `±(LOT_INNER_X + LOT_DEPTH / 2)` and the Z positions are evenly spaced
 * along the road length with small gaps.
 *
 * @returns An array of {@link BuildingLot} entries (10 total).
 */
export function computeBlockLayout(): BuildingLot[] {
  const lots: BuildingLot[] = [];

  // Usable length per lot (accounting for gaps)
  const usableLength = STREET_LAYOUT.roadLength - LOT_GAP * (LOTS_PER_SIDE + 1);
  const lotWidth = usableLength / LOTS_PER_SIDE;
  const lotCentreX = LOT_INNER_X + LOT_DEPTH / 2; // 13.5

  let index = 0;

  // East side lots (positive X)
  for (let i = 0; i < LOTS_PER_SIDE; i++) {
    const z = -HALF_LENGTH + LOT_GAP + lotWidth / 2 + i * (lotWidth + LOT_GAP);
    lots.push({
      index: index++,
      width: lotWidth,
      depth: LOT_DEPTH,
      x: lotCentreX,
      z,
    });
  }

  // West side lots (negative X)
  for (let i = 0; i < LOTS_PER_SIDE; i++) {
    const z = -HALF_LENGTH + LOT_GAP + lotWidth / 2 + i * (lotWidth + LOT_GAP);
    lots.push({
      index: index++,
      width: lotWidth,
      depth: LOT_DEPTH,
      x: -lotCentreX,
      z,
    });
  }

  return lots;
}

/**
 * The collision boxes for all building lots (used by the camera controller's
 * walk-mode collision system).
 *
 * @param lots  The building lots.
 * @returns AABB collision boxes compatible with the {@link CollisionBox} interface.
 */
export function lotCollisionBoxes(
  lots: readonly BuildingLot[],
): { min: THREE.Vector3; max: THREE.Vector3 }[] {
  return lots.map((lot) => ({
    min: new THREE.Vector3(lot.x - lot.width / 2, 0, lot.z - lot.depth / 2),
    max: new THREE.Vector3(lot.x + lot.width / 2, 40, lot.z + lot.depth / 2),
  }));
}
