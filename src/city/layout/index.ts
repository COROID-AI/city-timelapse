/**
 * Public contract of the canonical city block layout.
 *
 * ```ts
 * import { generateBlock, serializeLayout, layoutHash, anchorByName } from 'src/city/layout'
 *
 * const block = generateBlock('city-block')
 * anchorByName(block, 'street:north:light:3') // => street light base anchor
 * layoutHash(block)                            // => stable digest of the block
 * ```
 *
 * The module is engine-agnostic data plus its own block meshes:
 *
 * - data (`types`, `parcels`, `roads`, `splines`, `anchors`, `generate`) depends
 *   only on the scaffold's seeded PRNG and shared quality constants;
 * - `buildMeshes` is the single three.js aware file, used by the layout's own
 *   harness page (`harness.html`) and by the scene pipeline.
 *
 * Era content layers consume this module and never regenerate it: the layout is
 * frozen, deterministic, and the same for all five periods.
 */

export * from './types'
export * from './generate'
export * from './parcels'
export * from './roads'
export * from './splines'
export * from './anchors'
export * from './buildMeshes'

import type { Anchor, BlockLayout, LayoutOptions } from './types'
import { DEFAULT_LAYOUT_SEED } from './types'
import { generateBlock } from './generate'
import type { Seed } from '../../lib/rng'

/* ------------------------------------------------------------------------- *
 * Integration entry
 * ------------------------------------------------------------------------- */

/**
 * The canonical block, under the name the scene layer integrates against:
 * coordinate system, parcel grid, road and sidewalk surfaces, curb and
 * crosswalk geometry, vehicle and pedestrian splines, and the anchor catalogue.
 */
export type CityLayout = BlockLayout

/** Seed of the canonical block every era content layer is authored against. */
export const CANONICAL_LAYOUT_SEED: Seed = DEFAULT_LAYOUT_SEED

/**
 * Builds a block for the integration layer.
 *
 * Same contract as {@link generateBlock}: deterministic for a seed, engine
 * agnostic data plus named mesh groups, no era-specific content.
 */
export function createCityLayout(
  seed: Seed = CANONICAL_LAYOUT_SEED,
  options: LayoutOptions = {},
): CityLayout {
  return generateBlock(seed, options)
}

/* ------------------------------------------------------------------------- *
 * Canonical serialisation and hashing
 * ------------------------------------------------------------------------- */

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Layout numbers must be finite, received ${String(value)}`)
  }
  // Normalise negative zero so the same layout never serialises two ways.
  return String(Object.is(value, -0) ? 0 : value)
}

function canonicalValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }
  switch (typeof value) {
    case 'number':
      return canonicalNumber(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'string':
      return JSON.stringify(value)
    case 'object':
      break
    default:
      throw new TypeError(`Layout values must be JSON data, received ${typeof value}`)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalValue(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`).join(',')}}`
}

/**
 * Canonical JSON of a layout: object keys sorted, numbers normalised, so the
 * output only depends on the values. Two runs with the same seed (and the same
 * options) produce the exact same string.
 */
export function serializeLayout(layout: BlockLayout): string {
  return canonicalValue(layout)
}

const FNV_PRIME = 0x01000193
const FNV_OFFSET = 0x811c9dc5
const SECOND_LANE_OFFSET = 0x1b873593

function fnv1a32(input: string, basis: number): number {
  let hash = basis >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash >>> 0
}

/**
 * Short digest of {@link serializeLayout}: two-lane FNV-1a as 16 hex characters.
 *
 * The layout ships its own digest so the browser harness can prove determinism
 * without importing test helpers, and so content layers can key caches off it.
 */
export function layoutHash(layout: BlockLayout): string {
  const serialised = serializeLayout(layout)
  const low = fnv1a32(serialised, FNV_OFFSET)
  const high = fnv1a32(serialised, (SECOND_LANE_OFFSET ^ serialised.length) >>> 0)
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

/* ------------------------------------------------------------------------- *
 * Lookup helpers
 * ------------------------------------------------------------------------- */

/** The anchor catalogue entry with this name. Throws when it is missing. */
export function anchorByName(layout: BlockLayout, name: string): Anchor {
  const anchor = layout.anchors.find((candidate) => candidate.name === name)
  if (anchor === undefined) {
    throw new RangeError(`Unknown anchor ${name}`)
  }
  return anchor
}

/** Every anchor of one kind, in catalogue order. */
export function anchorsOfKind(layout: BlockLayout, kind: Anchor['kind']): Anchor[] {
  return layout.anchors.filter((anchor) => anchor.kind === kind)
}
