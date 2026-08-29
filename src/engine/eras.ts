/**
 * Shared time-era contract and registry.
 *
 * This module defines the TimeEra vocabulary every downstream task uses:
 * era-data (src/data/eras), environment, buildings, props, vehicles,
 * pedestrians, and UI all key their content off `EraId` / `EraSpec` and
 * register their per-era modules under `getEraSpec()`.
 */

/**
 * Identifier for every representable time period in the timelapse.
 * Ordered from earliest to latest; the registry preserves this order.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Static description of a single era. */
export interface EraSpec {
  readonly id: EraId;
  /** Four-digit calendar year, e.g. 1965. */
  readonly year: number;
  /** Human-readable short label, e.g. "The Fifties". */
  readonly label: string;
  /** One-line summary used by the timeline UI and documentation. */
  readonly description: string;
}

/**
 * Ordered registry of all eras. Downstream tasks iterate this array to
 * register per-era content and must not add new eras here without extending
 * `EraId` first.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: 'Post-War',
    description: 'Brick and sepia: gas lamps, trolleys, and victory gardens.',
  },
  {
    id: '1965',
    year: 1965,
    label: 'Mid-Century',
    description: 'Pastel storefronts, chrome cars, and neon signs.',
  },
  {
    id: '1985',
    year: 1985,
    label: 'Eighties',
    description: 'Concrete and glass towers, boxy cars, and bright sodium light.',
  },
  {
    id: '2005',
    year: 2005,
    label: 'Millennium',
    description: 'Modern glass, SUVs, digital billboards, and LED signage.',
  },
  {
    id: '2025',
    year: 2025,
    label: 'Now',
    description: 'Contemporary glass, electric cars, and full-screen LED media.',
  },
];

/** Immutable list of every `EraId` value, in chronological order. */
export const ERA_IDS: readonly EraId[] = ERA_REGISTRY.map((era) => era.id);

/** Returns the spec for a given era id (throws for unknown ids). */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((era) => era.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}