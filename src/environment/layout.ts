/**
 * Environment layout constants.
 *
 * The ground, roads, sidewalks, and streetlight positions are all derived
 * from the shared block-extent configuration in `src/config/paths.ts` so the
 * camera, buildings, and environment agree on the footprint. Nothing here is
 * hardcoded independently of that config.
 */
import { BLOCK_HALF_EXTENT_X, BLOCK_HALF_EXTENT_Z } from '../config/paths';

/** Width of the sidewalk band around the block, in world units. */
export const SIDEWALK_WIDTH = 2;

/** Width of the road ring around the block+sidewalk, in world units. */
export const ROAD_WIDTH = 6;

/** Outer edge of the sidewalk band along X (block edge + sidewalk). */
export const SIDEWALK_OUTER_X = BLOCK_HALF_EXTENT_X + SIDEWALK_WIDTH;

/** Outer edge of the sidewalk band along Z (block edge + sidewalk). */
export const SIDEWALK_OUTER_Z = BLOCK_HALF_EXTENT_Z + SIDEWALK_WIDTH;

/** Outer edge of the road ring along X. */
export const ROAD_OUTER_X = SIDEWALK_OUTER_X + ROAD_WIDTH;

/** Outer edge of the road ring along Z. */
export const ROAD_OUTER_Z = SIDEWALK_OUTER_Z + ROAD_WIDTH;

/** Half-extent of the surrounding ground apron (asphalt/concrete). */
export const GROUND_HALF_EXTENT = Math.max(ROAD_OUTER_X, ROAD_OUTER_Z) + 6;

/** Default number of streetlight posts erected around the block. */
export const DEFAULT_LAMP_COUNT = 8;

/** World-space Y of the road surface. */
export const ROAD_Y = 0.005;

/** World-space Y of the sidewalk surface (raised curb above the road). */
export const SIDEWALK_Y = 0.06;

/** World-space Y of the ground apron (just under the road surface). */
export const GROUND_Y = -0.03;

/**
 * Computes streetlight post positions around the block perimeter, derived
 * from the shared block extents. Posts sit on the sidewalk near the road.
 */
export function getLampPositions(count: number = DEFAULT_LAMP_COUNT): ReadonlyArray<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = [];
  const perSide = Math.max(1, Math.floor(count / 4));
  const zLine = SIDEWALK_OUTER_Z - 0.5;
  const xLine = SIDEWALK_OUTER_X - 0.5;

  for (let i = 0; i < perSide; i += 1) {
    // Spread posts along each block edge, keeping a small margin from corners.
    const t = perSide === 1 ? 0 : (i / (perSide - 1)) * 2 - 1;
    const x = t * (BLOCK_HALF_EXTENT_X - 2);
    const z = t * (BLOCK_HALF_EXTENT_Z - 2);
    positions.push({ x, z: zLine }, { x, z: -zLine });
    positions.push({ x: xLine, z }, { x: -xLine, z });
  }
  return positions;
}