import { Vector3 } from 'three';

/**
 * The six eras the city block can transform between.
 * Kept here as the single source of truth so the timeline UI and any future
 * era-aware module stay in sync.
 */
export const ERAS = [1945, 1965, 1985, 2005, 2025, 2055] as const;
export type Era = (typeof ERAS)[number];

/** Human-readable labels shown in the HUD for each era. */
export const ERA_LABELS: Record<Era, string> = {
  1945: '1945 · Postwar rebuild',
  1965: '1965 · Mid-century boom',
  1985: '1985 · Neon dawn',
  2005: '2005 · Digital metropolis',
  2025: '2025 · Present day',
  2055: '2055 · Future vision',
};

/** The city block fits roughly within this footprint (world units). */
export const BLOCK_SIZE = 50;
export const BLOCK_HALF = BLOCK_SIZE / 2;

/**
 * Navigation framing bounds.
 *
 * The orbit target is clamped inside the block's bounding box and the camera
 * distance/polar angle is constrained so the rig always stays framed on the
 * city block — a lightweight "collision-aware" framing approach.
 */
export const NAV_BOUNDS = {
  minTarget: new Vector3(-BLOCK_HALF, 0, -BLOCK_HALF),
  maxTarget: new Vector3(BLOCK_HALF, BLOCK_SIZE * 0.6, BLOCK_HALF),
  minDistance: 8,
  maxDistance: 140,
  // Keep the camera above the ground plane (never dip underneath the block).
  maxPolarAngle: Math.PI * 0.495,
} as const;
