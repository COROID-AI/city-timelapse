/**
 * Shared era types & registry.
 *
 * This is the single source of truth for the five eras shown on the timeline
 * slider. Every subsystem (store, slider, scene, audio) reads era metadata
 * from here so the timeline stays consistent.
 */

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

export interface EraSpec {
  id: EraId;
  /** Four-digit display year. */
  year: number;
  /** Short label shown on the slider. */
  label: string;
  /** One-line description of the period. */
  description: string;
}

/** Ordered list of era ids, earliest to latest. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** Ordered registry of era specs, aligned with ERA_IDS. */
export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick city, sepia tones, vintage cars, gas lamps.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastel, classic chrome cars, early neon.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete & glass, boxy cars, bright neon, sodium lamps.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Modern glass, SUVs, digital billboards, LED lighting.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'Contemporary, EVs & scooters, LED screens, clean air.',
  },
];

/** Index of an era id within the ordered timeline. */
export function eraIndex(id: EraId): number {
  return ERA_IDS.indexOf(id);
}

/** Lookup helper: returns the EraSpec for an id. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((e) => e.id === id);
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`);
  }
  return spec;
}