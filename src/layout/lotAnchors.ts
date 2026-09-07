import { Rect, RotationDeg, Vec2 } from '../types/city';

/**
 * Lot anchor transforms.
 *
 * A lot anchor is the stable, era-independent placement contract that every
 * downstream era module uses to position its building on a lot. The anchor
 * defines:
 *  - `origin`: the world-space corner of the lot footprint (min x, min z).
 *  - `width` / `depth`: the lot footprint size in world units (meters).
 *  - `rotation`: the intended building orientation relative to the block.
 *  - `center`: the world-space center of the lot footprint (computed).
 *  - `transform(localX, localY, localZ)`: maps a point in lot-local space
 *    (origin at 0,0) into world space, applying the lot rotation.
 */

export interface LotAnchor {
  /** World-space corner (min x, min z) of the lot footprint. */
  origin: Vec2;
  /** Footprint size in world units (meters). */
  width: number;
  depth: number;
  /** Building orientation relative to the block, in degrees. */
  rotation: RotationDeg;
  /** World-space center of the lot footprint. */
  readonly center: Vec2;
  /**
   * Map a lot-local point (x along width, z along depth, y up) into world
   * space, applying the lot rotation about its origin.
   */
  transform(localX: number, localY: number, localZ: number): { x: number; y: number; z: number };
}

function rotateDeg(x: number, z: number, deg: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - z * s, z: x * s + z * c };
}

/** Build a LotAnchor from its footprint and rotation. */
export function createLotAnchor(
  origin: Vec2,
  width: number,
  depth: number,
  rotation: RotationDeg = 0,
): LotAnchor {
  const center: Vec2 = {
    x: origin.x + width / 2,
    z: origin.z + depth / 2,
  };
  return {
    origin,
    width,
    depth,
    rotation,
    get center() {
      return center;
    },
    transform(localX: number, localY: number, localZ: number) {
      const r = rotateDeg(localX, localZ, rotation);
      return { x: origin.x + r.x, y: localY, z: origin.z + r.z };
    },
  };
}

/** Convenience: the world-space footprint Rect of a lot anchor. */
export function lotAnchorRect(anchor: LotAnchor): Rect {
  return { origin: anchor.origin, width: anchor.width, depth: anchor.depth };
}