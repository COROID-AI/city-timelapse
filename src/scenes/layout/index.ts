/**
 * City block layout foundation.
 *
 * Single-owner, era-invariant geometry anchors for the city block. Every
 * scene subsystem (buildings, vehicles, storefronts, pedestrians) and the
 * camera rig consume this module read-only so they all share one consistent
 * block geometry. Era-specific differences belong in `src/scenes/eras/`.
 *
 * @packageDocumentation
 */

export * from './types.js';
export * from './layout.js';
export * from './helpers.js';