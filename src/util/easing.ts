/** Easing utilities used by the timeline transition controller. */

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Linear (used for reduced-motion instant-ish snaps). */
export const linear = (t: number): number => t;
