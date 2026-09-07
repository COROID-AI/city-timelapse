/**
 * Storefronts for the 2025 smart-city EV era.
 *
 * Specialty coffee roastery, plant/vegan cafe, food-hall counter,
 * micro-office/co-working lobby, EV showroom window, self-checkout mini-mart,
 * and a dark-store delivery hub.
 */

/** Kind of a 2025 storefront. */
export type StorefrontKind =
  | 'coffee-roastery'
  | 'vegan-cafe'
  | 'food-hall'
  | 'co-working'
  | 'ev-showroom'
  | 'mini-mart'
  | 'dark-store';

/** A 2025-era storefront. */
export interface Storefront {
  /** Id of the storefront. */
  id: string;
  /** Storefront archetype. */
  kind: StorefrontKind;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
  /** Whether a delivery-app decal is on the door. */
  deliveryDecal: boolean;
  /** Whether an in-window screen is present. */
  windowScreen: boolean;
}

/** The 2025 storefront set. */
export const storefronts: readonly Storefront[] = Object.freeze([
  {
    id: 'roastery',
    kind: 'coffee-roastery',
    name: 'Ember Roastery',
    description: 'Specialty coffee roastery with sidewalk patio.',
    deliveryDecal: true,
    windowScreen: true,
  },
  {
    id: 'vegan-cafe',
    kind: 'vegan-cafe',
    name: 'Sprout Kitchen',
    description: 'Plant and vegan cafe with planters out front.',
    deliveryDecal: true,
    windowScreen: false,
  },
  {
    id: 'food-hall',
    kind: 'food-hall',
    name: 'The Counter Hall',
    description: 'Food-hall counter with rotating vendors.',
    deliveryDecal: true,
    windowScreen: true,
  },
  {
    id: 'coworking',
    kind: 'co-working',
    name: 'Loop Workspace',
    description: 'Micro-office and co-working lobby.',
    deliveryDecal: false,
    windowScreen: true,
  },
  {
    id: 'ev-showroom',
    kind: 'ev-showroom',
    name: 'Volt Motors',
    description: 'EV showroom window with a flagship crossover.',
    deliveryDecal: false,
    windowScreen: true,
  },
  {
    id: 'mini-mart',
    kind: 'mini-mart',
    name: 'QuickStop Go',
    description: 'Self-checkout mini-mart, 24/7.',
    deliveryDecal: true,
    windowScreen: true,
  },
  {
    id: 'dark-store',
    kind: 'dark-store',
    name: 'Dash Hub',
    description: 'Dark-store delivery hub for instant grocery.',
    deliveryDecal: true,
    windowScreen: false,
  },
]);