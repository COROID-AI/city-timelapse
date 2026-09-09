/**
 * Per-era signage data: curated, period-appropriate sign definitions for
 * 1945 → 2025, consumed by `SignageSystem` and aggregated into the app's
 * `eraEnvironment` by compose-scene-app.
 *
 * Every business and slogan is invented and period-plausible — no
 * anachronistic brand names. Signage technology itself evolves across the
 * eras (hand-painted wood → googie neon → CRT/arcade neon → backlit
 * chain/LED → media facades), matching the shared `SignItemSpec` shape from
 * `src/era/types.ts` while adding per-item placement/visual detail for this
 * system.
 */

import type { EraId } from '../../../era/years';
import type { SignItemSpec, SignageEraSpec } from '../../../era/types';
import type { SignTextureKind } from './signTextures';

export const SIGNAGE_ERAS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** Rich per-item signage spec consumed by the sign factory. */
export interface SignageItemSpec extends SignItemSpec {
  /** Painter recipe for the procedural texture. */
  readonly textureKind: SignTextureKind;
  /** Panel base color. */
  readonly baseColor: string;
  /** Placement band: above storefront, blade, board, rooftop, media facade, window. */
  readonly band: 'storefront' | 'blade' | 'billboard' | 'rooftop' | 'media-facade' | 'window';
  /** Googie starburst motif (1965 neon). */
  readonly burst?: boolean;
}

/** Full era signage description consumed by the factory + tests. */
export interface SignageEraSpecData extends SignageEraSpec {
  /** Era-authentic sign set (with placement detail). */
  readonly signs: readonly SignageItemSpec[];
  /** Wall-tag graffiti copy (1985). */
  readonly graffiti?: readonly string[];
}

export const ERA_SIGNAGE_1945: SignageEraSpecData = {
  primaryTech: 'painted_wood_metal',
  typographyStyle: 'Hand-Painted Enamel & Art Deco Serif',
  colorPalette: ['#b91c1c', '#1e3a8a', '#d97706', '#fef3c7', '#1c1917'],
  glowIntensity: 0.35,
  flickerRate: 1.2,
  density: 0.45,
  signs: [
    {
      text: "BEECHER'S GROCERIES\nEST. 1929",
      category: 'storefront',
      primaryColor: '#d97706',
      accentColor: '#1c1917',
      baseColor: '#8a5a2b',
      tech: 'painted_wood_metal',
      textureKind: 'painted',
      band: 'storefront',
    },
    {
      text: 'RADIO & PHONO SHOP',
      category: 'storefront',
      primaryColor: '#1e3a8a',
      accentColor: '#fef3c7',
      baseColor: '#3d2f1b',
      tech: 'painted_wood_metal',
      textureKind: 'painted',
      band: 'storefront',
    },
    {
      text: "VICTORY CAFÉ",
      category: 'blade',
      primaryColor: '#b91c1c',
      accentColor: '#fef3c7',
      baseColor: '#3a2a12',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'blade',
    },
    {
      text: 'BUY WAR BONDS\nVICTORY STRIKES',
      category: 'billboard',
      primaryColor: '#1e3a8a',
      accentColor: '#b91c1c',
      baseColor: '#ece7d7',
      tech: 'painted_wood_metal',
      textureKind: 'poster',
      band: 'billboard',
    },
    {
      text: 'FOOD FOR FREEDOM\nGROW VICTORY',
      category: 'billboard',
      primaryColor: '#14532d',
      accentColor: '#b45309',
      baseColor: '#ece7d7',
      tech: 'painted_wood_metal',
      textureKind: 'poster',
      band: 'billboard',
    },
    {
      text: 'LOCAL DINER\nMEALS TODAY',
      category: 'storefront',
      primaryColor: '#78350f',
      accentColor: '#1c1917',
      baseColor: '#e8d9b0',
      tech: 'painted_wood_metal',
      textureKind: 'painted',
      band: 'window',
    },
    {
      text: 'AVENUE\nBAKERY',
      category: 'storefront',
      primaryColor: '#8a4b12',
      accentColor: '#b91c1c',
      baseColor: '#d9b36a',
      tech: 'painted_wood_metal',
      textureKind: 'awning',
      band: 'storefront',
    },
  ],
};

export const ERA_SIGNAGE_1965: SignageEraSpecData = {
  primaryTech: 'neon_incandescent_bulbs',
  typographyStyle: 'Geometric Script & Glowing Googie Neon',
  colorPalette: ['#06b6d4', '#ec4899', '#eab308', '#ef4444', '#3b82f6'],
  glowIntensity: 1.25,
  flickerRate: 3.6,
  density: 0.72,
  signs: [
    {
      text: 'STARLIGHT\nMOTEL',
      category: 'rooftop',
      primaryColor: '#ec4899',
      accentColor: '#fef08a',
      baseColor: '#120a14',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      burst: true,
      band: 'rooftop',
    },
    {
      text: 'GOOGIE\nBURGER DRIVE-IN',
      category: 'rooftop',
      primaryColor: '#ef4444',
      accentColor: '#fef08a',
      baseColor: '#150b0b',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      burst: true,
      band: 'rooftop',
    },
    {
      text: 'ROADRUNNER MOTEL\nVACANCY',
      category: 'blade',
      primaryColor: '#06b6d4',
      accentColor: '#eab308',
      baseColor: '#08131a',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'blade',
    },
    {
      text: 'HI-FI STEREO CENTER',
      category: 'storefront',
      primaryColor: '#eab308',
      accentColor: '#3b82f6',
      baseColor: '#1c130a',
      tech: 'backlit_acrylic_lightboxes',
      textureKind: 'backlit',
      band: 'storefront',
    },
    {
      text: 'DRIVE-IN THEATRE\nSHOWING TONIGHT',
      category: 'billboard',
      primaryColor: '#3b82f6',
      accentColor: '#ef4444',
      baseColor: '#0a1018',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'billboard',
    },
    {
      text: 'COOL COLA COASTERS',
      category: 'billboard',
      primaryColor: '#ef4444',
      accentColor: '#ffffff',
      baseColor: '#f6efe0',
      tech: 'painted_wood_metal',
      textureKind: 'poster',
      band: 'billboard',
    },
    {
      text: "MID-CENT'S DANCE HALL",
      category: 'blade',
      primaryColor: '#06b6d4',
      accentColor: '#f43f5e',
      baseColor: '#0b1420',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'blade',
    },
  ],
};

export const ERA_SIGNAGE_1985: SignageEraSpecData = {
  primaryTech: 'neon_incandescent_bulbs',
  typographyStyle: 'Bold Chrome & Neon Video Marquee',
  colorPalette: ['#ec4899', '#06b6d4', '#a855f7', '#f43f5e', '#eab308'],
  glowIntensity: 1.7,
  flickerRate: 5.2,
  density: 0.88,
  graffiti: ['ZONE OUT', 'TURBO', 'MOTORHEAD', 'DIGIT 9'],
  signs: [
    {
      text: 'VIDEO ARCADE',
      category: 'storefront',
      primaryColor: '#ec4899',
      accentColor: '#06b6d4',
      baseColor: '#0c0412',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'storefront',
    },
    {
      text: 'CRT VIDEO\nSCORE CENTER',
      category: 'billboard',
      primaryColor: '#39e25f',
      accentColor: '#3f7fee',
      baseColor: '#0c1017',
      tech: 'digital_led_billboards',
      textureKind: 'crt',
      band: 'billboard',
    },
    {
      text: 'PIZZA PIZZA\nSLICE HOUSE',
      category: 'storefront',
      primaryColor: '#ef4444',
      accentColor: '#fde047',
      baseColor: '#1c1208',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'storefront',
    },
    {
      text: 'RECORD SHOP\nNEW & USED',
      category: 'storefront',
      primaryColor: '#a855f7',
      accentColor: '#06b6d4',
      baseColor: '#0e0a18',
      tech: 'backlit_acrylic_lightboxes',
      textureKind: 'backlit',
      band: 'storefront',
    },
    {
      text: 'PLAZA CLUB',
      category: 'rooftop',
      primaryColor: '#a855f7',
      accentColor: '#f43f5e',
      baseColor: '#0f0714',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'rooftop',
    },
    {
      text: 'MAX COLA\nFRESH TASTE',
      category: 'billboard',
      primaryColor: '#f43f5e',
      accentColor: '#ffffff',
      baseColor: '#f7e8dc',
      tech: 'painted_wood_metal',
      textureKind: 'poster',
      band: 'billboard',
    },
    {
      text: 'CINEMA 1-2-3\nNOW SHOWING',
      category: 'rooftop',
      primaryColor: '#eab308',
      accentColor: '#ec4899',
      baseColor: '#14100a',
      tech: 'neon_incandescent_bulbs',
      textureKind: 'neon',
      band: 'rooftop',
    },
  ],
};

export const ERA_SIGNAGE_2005: SignageEraSpecData = {
  primaryTech: 'digital_led_billboards',
  typographyStyle: 'Clean Sans & Glossy Backlit Chain Logos',
  colorPalette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ffffff'],
  glowIntensity: 2.0,
  flickerRate: 0,
  density: 0.92,
  signs: [
    {
      text: 'BURGER HELM\nCHAIN EATERY',
      category: 'storefront',
      primaryColor: '#ef4444',
      accentColor: '#fde047',
      baseColor: '#231812',
      tech: 'backlit_acrylic_lightboxes',
      textureKind: 'backlit',
      band: 'storefront',
    },
    {
      text: 'WIRELESS WORLD\nMOBILE & DATA',
      category: 'storefront',
      primaryColor: '#3b82f6',
      accentColor: '#ffffff',
      baseColor: '#10233d',
      tech: 'backlit_acrylic_lightboxes',
      textureKind: 'backlit',
      band: 'storefront',
    },
    {
      text: 'GLOBAL GULP\nE-Z DRIVE THRU',
      category: 'billboard',
      primaryColor: '#10b981',
      accentColor: '#0f172a',
      baseColor: '#e7f6ee',
      tech: 'digital_led_billboards',
      textureKind: 'led',
      band: 'billboard',
    },
    {
      text: 'BIGLED\nNIGHT HIGHWAY',
      category: 'billboard',
      primaryColor: '#f59e0b',
      accentColor: '#111827',
      baseColor: '#1c1a14',
      tech: 'digital_led_billboards',
      textureKind: 'led',
      band: 'billboard',
    },
    {
      text: 'METRO EXCHANGE',
      category: 'rooftop',
      primaryColor: '#ffffff',
      accentColor: '#0284c7',
      baseColor: '#0c1626',
      tech: 'digital_led_billboards',
      textureKind: 'led',
      band: 'rooftop',
    },
    {
      text: 'SIGN-YOUR-SELF\nFAST FOTO',
      category: 'storefront',
      primaryColor: '#a855f7',
      accentColor: '#ffffff',
      baseColor: '#1b1030',
      tech: 'backlit_acrylic_lightboxes',
      textureKind: 'backlit',
      band: 'storefront',
    },
  ],
};

export const ERA_SIGNAGE_2025: SignageEraSpecData = {
  primaryTech: 'holographic_oled_screens',
  typographyStyle: 'Ultra-Minimal Variable Sans & Media Facade Motion',
  colorPalette: ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#ffffff'],
  glowIntensity: 2.45,
  flickerRate: 0,
  density: 0.96,
  signs: [
    {
      text: 'AURORA COFFEE',
      category: 'storefront',
      primaryColor: '#34d399',
      accentColor: '#ffffff',
      baseColor: '#07281d',
      tech: 'holographic_oled_screens',
      textureKind: 'media',
      band: 'media-facade',
    },
    {
      text: 'NL MOBILE\nE-SCOOTER HUB',
      category: 'storefront',
      primaryColor: '#38bdf8',
      accentColor: '#ffffff',
      baseColor: '#0a2033',
      tech: 'holographic_oled_screens',
      textureKind: 'media',
      band: 'storefront',
    },
    {
      text: 'ATLAS HEALTH+',
      category: 'storefront',
      primaryColor: '#a78bfa',
      accentColor: '#f472b6',
      baseColor: '#12091f',
      tech: 'digital_led_billboards',
      textureKind: 'led',
      band: 'storefront',
    },
    {
      text: 'NEXUS MEDIA\nFACADE ONE',
      category: 'rooftop',
      primaryColor: '#38bdf8',
      accentColor: '#f472b6',
      baseColor: '#0a0e14',
      tech: 'holographic_oled_screens',
      textureKind: 'media',
      band: 'media-facade',
    },
    {
      text: 'SCOOTR 24/7\nE-SCOOTER',
      category: 'billboard',
      primaryColor: '#34d399',
      accentColor: '#0f172a',
      baseColor: '#06211a',
      tech: 'holographic_oled_screens',
      textureKind: 'media',
      band: 'billboard',
    },
    {
      text: 'SOLARIS TOWER',
      category: 'rooftop',
      primaryColor: '#38bdf8',
      accentColor: '#f472b6',
      baseColor: '#0a1a28',
      tech: 'holographic_oled_screens',
      textureKind: 'media',
      band: 'rooftop',
    },
  ],
};

/** Complete record of per-era signage data, keyed by EraId. */
export const signageEraData: Readonly<Record<EraId, SignageEraSpecData>> = {
  '1945': ERA_SIGNAGE_1945,
  '1965': ERA_SIGNAGE_1965,
  '1985': ERA_SIGNAGE_1985,
  '2005': ERA_SIGNAGE_2005,
  '2025': ERA_SIGNAGE_2025,
};