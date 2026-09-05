/**
 * Shared era types and registry for the City Time Period Timelapse.
 *
 * Exactly the five plan eras: 1945, 1965, 1985, 2005, 2025.
 * (The README mentions 2055 as part of the wider product vision, but the
 * timeline and state store intentionally stop at 2025 for this milestone.)
 */

export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const

export type EraId = (typeof ERA_IDS)[number]

export interface EraSpec {
  id: EraId
  year: number
  label: string
  description: string
}

export const ERA_REGISTRY: readonly EraSpec[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945',
    description: 'Post-war brick city: gas lamps, vintage cars and sepia tones.',
  },
  {
    id: '1965',
    year: 1965,
    label: '1965',
    description: 'Mid-century pastels, chrome cars and the first neon glow.',
  },
  {
    id: '1985',
    year: 1985,
    label: '1985',
    description: 'Concrete and glass, boxy cars, bright neon and sodium lamps.',
  },
  {
    id: '2005',
    year: 2005,
    label: '2005',
    description: 'Modern glass towers, SUVs, digital billboards and LEDs.',
  },
  {
    id: '2025',
    year: 2025,
    label: '2025',
    description: 'Contemporary city: electric vehicles, scooters and LED screens.',
  },
] as const satisfies readonly EraSpec[]

const ERA_INDEX: ReadonlyMap<EraId, number> = new Map(
  ERA_IDS.map((id, index) => [id, index]),
)

const ERA_BY_ID: ReadonlyMap<EraId, EraSpec> = new Map(
  ERA_REGISTRY.map((spec) => [spec.id, spec]),
)

/** Type guard for runtime validation of unknown era values. */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'string' && ERA_IDS.some((id) => id === value)
}

/** Look up the spec for an era id. Throws for unknown ids. */
export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_BY_ID.get(id)
  if (!spec) {
    throw new Error(`Unknown era id: ${String(id)}`)
  }
  return spec
}

/** 0-based position of an era within the ordered registry. Throws for unknown ids. */
export function eraIndex(id: EraId): number {
  const index = ERA_INDEX.get(id)
  if (index === undefined) {
    throw new Error(`Unknown era id: ${String(id)}`)
  }
  return index
}