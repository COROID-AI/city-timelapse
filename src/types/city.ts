/**
 * Core shared type definitions for the City Time Period Timelapse scaffold.
 *
 * These types form the stable data contract that every downstream era task
 * implements against. See README.md "Coordinate conventions" for the exact
 * meaning of the world-space `x`/`z` axes used throughout.
 */

/** A simple 2D world-space point on the ground plane (y = 0). */
export interface Vec2 {
  x: number;
  z: number;
}

/** A 3D world-space point. `y` is up. */
export interface Vec3 {
  x: number;
  z: number;
  y: number;
}

/** A rectangular footprint on the ground plane, in world units (meters). */
export interface Rect {
  /** Origin corner (minimum x, minimum z). */
  origin: Vec2;
  /** Footprint size in world units (meters). */
  width: number;
  depth: number;
}

/** Orientation of a lot or building relative to the block. */
export type RotationDeg = 0 | 90 | 180 | 270;

/**
 * The canonical set of era years supported by the application.
 * Constraint: exactly these five years, in ascending order.
 */
export const CANONICAL_ERAS: readonly number[] = Object.freeze([
  1945, 1965, 1985, 2005, 2025,
]) as readonly number[];

/** Type-safe alias for a canonical era year. */
export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025;

/** Validates that a value is one of the canonical era years. */
export function isEraYear(value: number): value is EraYear {
  return CANONICAL_ERAS.includes(value);
}