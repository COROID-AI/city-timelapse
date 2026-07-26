import type { EraKey } from '../eras/eraConfig.js';
import type { SignStyle } from './slotContract.js';

/**
 * Era storefront catalog.
 *
 * The era config (`DEFAULT_ERA_CONFIG[era].storefronts`) holds *archetype
 * identifiers* (string slugs like `'handpainted_sign'`). This catalog maps each
 * era to concrete shop names, sign copy, sign style, frame/awning colors, and
 * interior-glow color so `StorefrontModule` can render era-correct storefronts
 * purely from config + canvas textures — no heavy external assets.
 *
 * Each era has a small palette of shops; slots are filled round-robin within the
 * era so every storefront is era-appropriate while the eight default slots show
 * variety.
 */

/** Frame and awning colors for the physical shopfront structure. */
export interface StorefrontFrameStyle {
  /** Painted trim / mullion color (hex). */
  frame: string;
  /** Door color (hex). */
  door: string;
  /** Awning color (hex) or `null` when the era omits awnings. */
  awning: string | null;
  /** Glass tint (hex), applied at low opacity. */
  glass: string;
  /** Interior-light color for the warm "someone is inside" glow (hex). */
  interiorGlow: string;
  /** Interior-light intensity multiplier. */
  interiorIntensity: number;
}

/** One concrete storefront definition combining shop identity + sign + frame. */
export interface StorefrontStyleDef {
  /** Shop name rendered on the sign. */
  name: string;
  /** Sign rendering style. */
  signStyle: SignStyle;
  /** Frame / awning / interior style. */
  frame: StorefrontFrameStyle;
}

/**
 * Per-era arrays of concrete storefront definitions. The index into the array
 * is used round-robin across the available slots so every opening gets an
 * era-appropriate shop.
 */
export const ERA_STOREFRONTS: Record<EraKey, StorefrontStyleDef[]> = {
  '1945': [
    {
      name: 'BAKERY',
      signStyle: 'painted',
      frame: {
        frame: '#6b5d4a',
        door: '#7a5c3a',
        awning: '#a8482f',
        glass: '#9fb0bf',
        interiorGlow: '#f5d68a',
        interiorIntensity: 1.0,
      },
    },
    {
      name: 'DINER',
      signStyle: 'painted',
      frame: {
        frame: '#4a443c',
        door: '#5a4632',
        awning: '#3d6b8a',
        glass: '#9fb0bf',
        interiorGlow: '#f0c878',
        interiorIntensity: 1.1,
      },
    },
    {
      name: 'HABERDASHERY',
      signStyle: 'painted',
      frame: {
        frame: '#5d4e3a',
        door: '#6b5d3a',
        awning: '#5a4a2f',
        glass: '#9fb0bf',
        interiorGlow: '#e8c070',
        interiorIntensity: 0.9,
      },
    },
  ],
  '1965': [
    {
      name: 'APPLIANCES',
      signStyle: 'neon',
      frame: {
        frame: '#5d6b6e',
        door: '#6e7884',
        awning: '#c9c2b6',
        glass: '#9aa7b0',
        interiorGlow: '#ffe0a0',
        interiorIntensity: 1.3,
      },
    },
    {
      name: 'DINER',
      signStyle: 'neon',
      frame: {
        frame: '#4a5d6e',
        door: '#5a6d7e',
        awning: '#e04848',
        glass: '#9aa7b0',
        interiorGlow: '#ffd070',
        interiorIntensity: 1.5,
      },
    },
    {
      name: 'MOTEL',
      signStyle: 'neon',
      frame: {
        frame: '#6e6052',
        door: '#7a6e5a',
        awning: '#3a8ac9',
        glass: '#9aa7b0',
        interiorGlow: '#ffd8a0',
        interiorIntensity: 1.3,
      },
    },
  ],
  '1985': [
    {
      name: 'ARCADE',
      signStyle: 'neon',
      frame: {
        frame: '#3c3f44',
        door: '#2a2d32',
        awning: null,
        glass: '#4a5560',
        interiorGlow: '#ff48a0',
        interiorIntensity: 2.0,
      },
    },
    {
      name: 'VIDEO',
      signStyle: 'backlit',
      frame: {
        frame: '#3c3f44',
        door: '#2a2d32',
        awning: null,
        glass: '#4a5560',
        interiorGlow: '#ff7048',
        interiorIntensity: 1.8,
      },
    },
    {
      name: 'ELECTRONICS',
      signStyle: 'neon',
      frame: {
        frame: '#4a443c',
        door: '#3c3f44',
        awning: null,
        glass: '#4a5560',
        interiorGlow: '#48d0ff',
        interiorIntensity: 1.9,
      },
    },
  ],
  '2005': [
    {
      name: 'COFFEE',
      signStyle: 'led',
      frame: {
        frame: '#2c3e50',
        door: '#3a4a5a',
        awning: '#3a6f3a',
        glass: '#6d92ad',
        interiorGlow: '#fff0d0',
        interiorIntensity: 1.4,
      },
    },
    {
      name: 'MOBILE',
      signStyle: 'led',
      frame: {
        frame: '#2c3e50',
        door: '#3a4a5a',
        awning: '#4a6f8a',
        glass: '#6d92ad',
        interiorGlow: '#d0f0ff',
        interiorIntensity: 1.6,
      },
    },
    {
      name: 'PHARMACY',
      signStyle: 'backlit',
      frame: {
        frame: '#2c3e50',
        door: '#3a4a5a',
        awning: '#8a3a3a',
        glass: '#6d92ad',
        interiorGlow: '#fff0d8',
        interiorIntensity: 1.4,
      },
    },
  ],
  '2025': [
    {
      name: 'CAFÉ',
      signStyle: 'led',
      frame: {
        frame: '#3a4a52',
        door: '#4a5a62',
        awning: '#5a8f7a',
        glass: '#88b0a0',
        interiorGlow: '#fff8e8',
        interiorIntensity: 1.3,
      },
    },
    {
      name: 'PICKUP',
      signStyle: 'led',
      frame: {
        frame: '#3a4a52',
        door: '#4a5a62',
        awning: '#cfe8dc',
        glass: '#88b0a0',
        interiorGlow: '#e8f8ff',
        interiorIntensity: 1.5,
      },
    },
    {
      name: 'FITNESS',
      signStyle: 'led',
      frame: {
        frame: '#3a4a52',
        door: '#4a5a62',
        awning: '#3a4a52',
        glass: '#88b0a0',
        interiorGlow: '#d8f8e8',
        interiorIntensity: 1.4,
      },
    },
  ],
  '2055': [
    {
      name: 'DRONE HUB',
      signStyle: 'holographic',
      frame: {
        frame: '#0f2027',
        door: '#1e3a5f',
        awning: null,
        glass: '#2d6a9f',
        interiorGlow: '#9fffe0',
        interiorIntensity: 2.2,
      },
    },
    {
      name: 'NEXUS',
      signStyle: 'holographic',
      frame: {
        frame: '#0f2027',
        door: '#1e3a5f',
        awning: null,
        glass: '#2d6a9f',
        interiorGlow: '#80e0ff',
        interiorIntensity: 2.4,
      },
    },
    {
      name: 'SYNTH',
      signStyle: 'holographic',
      frame: {
        frame: '#0f2027',
        door: '#1e3a5f',
        awning: null,
        glass: '#2d6a9f',
        interiorGlow: '#c080ff',
        interiorIntensity: 2.3,
      },
    },
  ],
};

/**
 * Pick the era-appropriate storefront definition for a given slot index. Slots
 * are filled round-robin across the era's definition array so every opening on
 * the block gets an era-appropriate shop while showing variety.
 */
export function pickStorefrontForSlot(
  era: EraKey,
  slotIndex: number,
): StorefrontStyleDef {
  const defs = ERA_STOREFRONTS[era];
  return defs[slotIndex % defs.length];
}
