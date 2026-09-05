/**
 * src/content/storefronts/layout.ts — shared retail-block layout data.
 *
 * Declares the facade run along the +X side of the avenue (the same sidewalk
 * the pedestrians walk) and how each era's storefronts and ads position
 * themselves on it. Builders read slot rectangles from here so every era
 * occupies the same real estate, with only the unit styling changing.
 */

export interface FacadeSlot {
  /** Unit index along the facade run (0 = north end). */
  index: number;
  /** Left edge of the slot in metres along the facade. */
  left: number;
  /** Width of the slot in metres. */
  width: number;
  /** Centre X of the slot. */
  x: number;
}

/** Slots occupied by storefront units (plus the ad spans between them). */
export const FACADE_SLOTS: readonly FacadeSlot[] = [
  { index: 0, left: -13.6, width: 4.4, x: -11.4 },
  { index: 1, left: -8.8, width: 4.4, x: -6.6 },
  { index: 2, left: -4.0, width: 4.4, x: -1.8 },
  { index: 3, left: 0.8, width: 4.4, x: 3.0 },
  { index: 4, left: 5.6, width: 4.4, x: 7.8 },
  { index: 5, left: 10.4, width: 4.4, x: 12.6 },
];

/** Wall spans (no windows) between storefront runs, used for ads. */
export const AD_SPANS: readonly { x: number; width: number }[] = [
  { x: 8.6, width: 3.6 },
  { x: -15.9, width: 3.6 },
  { x: 17.0, width: 4.0 },
];

/** Ground floor height in metres (banner + window + plinth). */
export const GROUND_FLOOR_HEIGHT = 3.6;

/** Sign band height in metres above the display window. */
export const SIGN_BAND_HEIGHT = 0.85;

/** Display window height in metres. */
export const WINDOW_HEIGHT = 1.9;

/** Entrance door height in metres. */
export const DOOR_HEIGHT = 2.4;

/** Vertical centre of the sign band. */
export function signBandY(): number {
  return GROUND_FLOOR_HEIGHT - SIGN_BAND_HEIGHT / 2;
}

/** Vertical centre of the display window. */
export function windowCenterY(): number {
  return GROUND_FLOOR_HEIGHT - SIGN_BAND_HEIGHT - WINDOW_HEIGHT / 2;
}

/** Vertical centre of the entrance door zone. */
export function doorCenterY(): number {
  return DOOR_HEIGHT / 2;
}