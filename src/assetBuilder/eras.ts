/**
 * Era data model for the procedural asset layer.
 *
 * Every builder in this folder is a pure function of an {@link Era} argument:
 * given the same era (and other inputs) they always produce an equivalent
 * asset and never mutate shared module state. The era union is kept
 * structurally identical to `PeriodYear` in `../timeline.ts` so the two
 * modules compose without a hard import dependency.
 */

/** The five chronological eras the city block can represent. */
export type Era = 1945 | 1965 | 1985 | 2005 | 2025;

/** Ordered list of every supported era. */
export const ERAS: readonly Era[] = [1945, 1965, 1985, 2005, 2025];

/** Runtime guard narrowing a plain number to an {@link Era}. */
export function isEra(value: number): value is Era {
  return (ERAS as readonly number[]).includes(value);
}

/**
 * Per-era visual palette consumed by the texture, vehicle and pedestrian
 * builders. Defined once here so the era "look" stays consistent across asset
 * types. Immutable so builders remain pure.
 */
export interface EraPalette {
  /** Primary signage / neon colour. */
  readonly primary: string;
  /** Secondary accent colour. */
  readonly accent: string;
  /** Signage backdrop colour. */
  readonly signBackground: string;
  /** Vehicular body colour. */
  readonly vehicleBody: string;
  /** Vehicle trim (chrome / trim) colour. */
  readonly vehicleTrim: string;
  /** Pedestrian upper garment colour. */
  readonly clothing: string;
  /** Pedestrian trousers colour. */
  readonly trousers: string;
  /** Pedestrian skin tone. */
  readonly skin: string;
}

const PALETTES: Readonly<Record<Era, EraPalette>> = {
  1945: {
    primary: '#3a2f1f',
    accent: '#8a1c1c',
    signBackground: '#cbb98a',
    vehicleBody: '#3b2f2a',
    vehicleTrim: '#1c1c1c',
    clothing: '#4a553f',
    trousers: '#5c4a2f',
    skin: '#d8a878',
  },
  1965: {
    primary: '#ff2d6b',
    accent: '#19e0ff',
    signBackground: '#0b0b14',
    vehicleBody: '#b5302f',
    vehicleTrim: '#d8d8d8',
    clothing: '#2f4a8a',
    trousers: '#2a2a32',
    skin: '#e0b48a',
  },
  1985: {
    primary: '#ffb000',
    accent: '#33ff66',
    signBackground: '#050505',
    vehicleBody: '#9a9a9a',
    vehicleTrim: '#2a2a2a',
    clothing: '#8a2f8a',
    trousers: '#1f1f2a',
    skin: '#e0b48a',
  },
  2005: {
    primary: '#2f9bff',
    accent: '#e8eef5',
    signBackground: '#10243a',
    vehicleBody: '#3a4a5a',
    vehicleTrim: '#b0b8c0',
    clothing: '#3a3a42',
    trousers: '#2a2a32',
    skin: '#e8c0a0',
  },
  2025: {
    primary: '#19f0d8',
    accent: '#ff4dd2',
    signBackground: '#0a0a18',
    vehicleBody: '#e9eef2',
    vehicleTrim: '#19f0d8',
    clothing: '#1a1a22',
    trousers: '#2a2a36',
    skin: '#e8c0a0',
  },
};

/** Returns the immutable palette for the given era. */
export function paletteFor(era: Era): EraPalette {
  return PALETTES[era];
}
