import { EraYear } from '../../types/city';

/**
 * Era 2005 colour palette.
 *
 * The 2005 presentation is a "digital-age condo boom": a neutral digital-era
 * colour grade with a slightly cool white balance, cleaner air than 1985, and
 * an evening cool-white LED glow accented by phone-screen illumination.
 */

/** An RGB colour in [0, 1] for Three.js materials/lights. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface EraPalette {
  readonly year: EraYear;
  readonly label: string;
  /** Neutral digital-era photographic grade. */
  readonly grade: 'neutral-digital';
  /** Slightly cool white balance. */
  readonly whiteBalance: 'slightly-cool';
  /** Cleaner air than 1985 (less haze, crisper contrast). */
  readonly airQuality: 'clearer-than-1985';
  /** Dominant accent: cool-white LED. */
  readonly accent: Rgb;
  /** Building cladding colours, one per cladding material. */
  readonly buildingCladding: readonly Rgb[];
  /** Silver-gray vehicle body colours. */
  readonly vehicleBody: readonly Rgb[];
  /** Storefront sign colours. */
  readonly storefrontSign: readonly Rgb[];
  /** Evening cool-white LED street glow. */
  readonly nightGlow: Rgb;
  /** Phone-screen illumination accent (cool blue-white). */
  readonly phoneScreenAccent: Rgb;
}

export const palette2005: EraPalette = {
  year: 2005,
  label: '2005 — Digital-Age Condo Boom',
  grade: 'neutral-digital',
  whiteBalance: 'slightly-cool',
  airQuality: 'clearer-than-1985',
  accent: { r: 0.92, g: 0.96, b: 1.0 },
  buildingCladding: [
    { r: 0.62, g: 0.68, b: 0.72 }, // glass
    { r: 0.78, g: 0.8, b: 0.82 }, // stone
    { r: 0.7, g: 0.72, b: 0.75 }, // aluminum
    { r: 0.84, g: 0.8, b: 0.74 }, // stucco
    { r: 0.55, g: 0.36, b: 0.28 }, // brick
    { r: 0.3, g: 0.32, b: 0.36 }, // construction hoarding
  ],
  vehicleBody: [
    { r: 0.72, g: 0.74, b: 0.76 }, // silver sedan
    { r: 0.66, g: 0.68, b: 0.7 }, // gunmetal SUV
    { r: 0.78, g: 0.79, b: 0.81 }, // light silver hatchback
    { r: 0.6, g: 0.62, b: 0.64 }, // delivery van
    { r: 0.55, g: 0.58, b: 0.62 }, // city bus
  ],
  storefrontSign: [
    { r: 0.2, g: 0.4, b: 0.6 }, // coffee chain deep blue
    { r: 0.0, g: 0.32, b: 0.62 }, // mobile phone store
    { r: 0.75, g: 0.2, b: 0.2 }, // discount variety red
    { r: 0.15, g: 0.45, b: 0.3 }, // dry cleaner green
    { r: 0.55, g: 0.12, b: 0.12 }, // gym
  ],
  nightGlow: { r: 0.92, g: 0.96, b: 1.0 },
  phoneScreenAccent: { r: 0.55, g: 0.75, b: 1.0 },
};