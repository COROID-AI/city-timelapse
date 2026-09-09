/**
 * Point-of-interest fly-to presets for the navigation controller.
 *
 * Each preset is a deterministic goal pose derived from the shared
 * `BlockLayout` bounds: a camera position and a world point to look at.
 * The ids (`'corner'`, `'midblock'`, `'rooftop'`) are the stable contract
 * consumed by the compose-scene-app HUD chips and the 1/2/3 number keys.
 *
 * All positions live inside the block bounds so fly-to arrivals satisfy the
 * "camera clamped to BlockLayout bounds" invariant without a final jump.
 */
import type { BlockLayout } from '../world/layout/types';

/** Stable POI identifiers consumed by the HUD chips and number keys. */
export type PoiId = 'corner' | 'midblock' | 'rooftop';

/** A goal camera pose for one eased fly-to. */
export interface PoiTarget {
  id: PoiId;
  /** Short label rendered on the HUD chip. */
  label: string;
  /** Goal camera position (world units). */
  position: { x: number; y: number; z: number };
  /** World point the camera should be aimed at on arrival. */
  lookAt: { x: number; y: number; z: number };
}

/** Ordered registry of POI ids (order matches the HUD chip row). */
export const POI_IDS = ['corner', 'midblock', 'rooftop'] as const;

function mid(a: number, b: number): number {
  return (a + b) / 2;
}

/**
 * Compute the three deterministic POI poses for a layout.
 *
 * The geometry is anchored purely on `layout.blockBounds` so the same seed
 * always yields the same presets, and no POI can ever ask the camera to leave
 * the block island horizontally.
 */
export function getPoiTargets(layout: BlockLayout): Record<PoiId, PoiTarget> {
  const b = layout.blockBounds;
  const midX = mid(b.minX, b.maxX);
  const midZ = mid(b.minZ, b.maxZ);
  const width = b.maxX - b.minX;
  const height = b.maxZ - b.minZ;
  const rooftopY = Math.max(28, width + height + 4);

  return {
    corner: {
      id: 'corner',
      label: 'Street corner',
      // Inside the block island just north/east of the intersection; looks
      // down the south sidewalk to keep the street backbone in frame.
      position: { x: b.minX + 2.2, y: 2.6, z: b.minZ + 2.2 },
      lookAt: { x: b.minX + width * 0.55, y: 1.0, z: b.minZ + 0.9 },
    },
    midblock: {
      id: 'midblock',
      label: 'Mid-block',
      position: { x: midX + 3.6, y: 3.4, z: midZ - 1.2 },
      lookAt: { x: midX, y: 1.0, z: midZ + 0.6 },
    },
    rooftop: {
      id: 'rooftop',
      label: 'Rooftop',
      // Drone-style overview: well above the tallest building envelope,
      // aiming straight down at the block centre.
      position: { x: midX - 1.5, y: rooftopY, z: midZ + 1.5 },
      lookAt: { x: midX, y: 0.0, z: midZ },
    },
  };
}

/** Flattened POI list in canonical order (HUD chips render straight from it). */
export function listPoiTargets(layout: BlockLayout): PoiTarget[] {
  return POI_IDS.map((id) => getPoiTargets(layout)[id]);
}