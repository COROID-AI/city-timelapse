import { BLOCK_HALF } from '../constants.js';

/**
 * Shared lot/slot contract for ground-floor storefronts.
 *
 * BuildingGenerator reserves one `StorefrontSlot` per ground-floor opening and
 * passes the array to `StorefrontModule`. The module reads position, size, and
 * facing from each slot and **never redefines lot geometry** — it only fills the
 * reserved opening with era-appropriate shops and signage.
 *
 * Until BuildingGenerator lands, `DEFAULT_STOREFRONT_SLOTS` provides a reference
 * lot layout around the block perimeter so the module is fully functional and
 * aligned with the future BuildingGenerator contract.
 */

/** Sign rendering style — determines canvas texture + emissive/bloom treatment. */
export type SignStyle = 'painted' | 'neon' | 'backlit' | 'led' | 'holographic';

/** A reserved ground-floor storefront opening produced by BuildingGenerator. */
export interface StorefrontSlot {
  /** Stable identifier, e.g. `"N-0"` for the first slot on the north edge. */
  id: string;
  /** World-space center of the storefront opening `[x, y, z]`. */
  position: [number, number, number];
  /** Width of the opening along the facade (world units). */
  width: number;
  /** Height of the opening from ground to lintel (world units). */
  height: number;
  /** Y-axis rotation (radians) orienting the storefront to face outward. */
  rotationY: number;
}

// ---------------------------------------------------------------------------
// Default ground-floor dimensions
// ---------------------------------------------------------------------------

const GROUND_FLOOR_HEIGHT = 5;
const SLOT_WIDTH = 7;
const SLOT_Y = GROUND_FLOOR_HEIGHT / 2;
const EDGE_INSET = 1; // how far storefronts sit in from the block edge
const HALF = BLOCK_HALF - EDGE_INSET;

/** Helper to keep the default slot table compact. */
function slot(
  id: string,
  x: number,
  z: number,
  rotationY: number,
): StorefrontSlot {
  return {
    id,
    position: [x, SLOT_Y, z],
    width: SLOT_WIDTH,
    height: GROUND_FLOOR_HEIGHT,
    rotationY,
  };
}

/**
 * Reference lot layout: two storefront openings per block edge × four edges =
 * eight storefronts, each facing outward toward the street. BuildingGenerator
 * will later supply real reserved slots via the same `StorefrontSlot` contract.
 */
export const DEFAULT_STOREFRONT_SLOTS: StorefrontSlot[] = [
  // North edge (z = -HALF), facing +Z (toward the interior/viewer)
  slot('N-0', -12, -HALF, 0),
  slot('N-1', 12, -HALF, 0),
  // South edge (z = +HALF), facing -Z
  slot('S-0', -12, HALF, Math.PI),
  slot('S-1', 12, HALF, Math.PI),
  // East edge (x = +HALF), facing -X
  slot('E-0', HALF, -12, -Math.PI / 2),
  slot('E-1', HALF, 12, -Math.PI / 2),
  // West edge (x = -HALF), facing +X
  slot('W-0', -HALF, -12, Math.PI / 2),
  slot('W-1', -HALF, 12, Math.PI / 2),
];
