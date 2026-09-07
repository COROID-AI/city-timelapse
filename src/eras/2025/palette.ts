/**
 * Palette and lighting grade for the 2025 smart-city EV era.
 *
 * Crisp high-contrast modern grade: clean air, saturated green foliage,
 * evening LED facade accent glow with cool-white street lighting and bright
 * digital screens.
 */

/** High-contrast modern grading parameters. */
export interface Grade {
  /** Contrast multiplier for the scene grade. */
  contrast: number;
  /** Saturation multiplier. */
  saturation: number;
  /** Overall brightness. */
  brightness: number;
  /** Lighting temperature label. */
  temperature: string;
}

/** The 2025 era colour palette. */
export interface Palette {
  /** Short identifier for the era palette. */
  name: string;
  /** Sky colour (hex). */
  sky: string;
  /** Ground plane colour (hex). */
  ground: string;
  /** Asphalt street colour (hex). */
  asphalt: string;
  /** Permeable-paver sidewalk colour (hex). */
  sidewalk: string;
  /** Saturated green foliage colour (hex). */
  foliage: string;
  /** Glass facade colour (hex). */
  glassFacade: string;
  /** Evening LED facade accent colour (hex). */
  ledAccent: string;
  /** Cool-white street lighting colour (hex). */
  streetLight: string;
  /** Digital screen brightness colour (hex). */
  screen: string;
  /** Crisp high-contrast modern grade. */
  grade: Grade;
}

/** The 2025 smart-city EV era palette. */
export const palette: Palette = {
  name: '2025 smart-city EV era',
  sky: '#0e1a2e',
  ground: '#23262b',
  asphalt: '#1a1c20',
  sidewalk: '#9aa5ad',
  foliage: '#2f9e44',
  glassFacade: '#7fd4f2',
  ledAccent: '#39d2ff',
  streetLight: '#e8f4ff',
  screen: '#ffffff',
  grade: {
    contrast: 1.25,
    saturation: 1.15,
    brightness: 1.05,
    temperature: 'cool-white',
  },
};