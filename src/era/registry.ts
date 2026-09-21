/**
 * Ordered era registry.
 *
 * The registry turns the raw era table into the contract every consumer reads:
 * definitions sorted oldest-first, stable id/year maps, strict lookup and the
 * neighbour helpers the timeline UI needs (`previous`, `next`, `neighbours`).
 *
 * Ordering and lookup live here rather than in each content layer so that
 * "moving one step left on the slider" has exactly one meaning across the
 * buildings, vehicles, storefronts and crowd.
 */

import { DEFAULT_ERA_ID, ERA_YEAR_BY_ID, UnknownEraIdError, isEraId } from './eraIds'
import type { EraId } from './eraIds'
import { ERA_RECORDS } from './eras'
import type { EraDefinition } from './types'

/** Read-only view over the era table with ordering, lookup and neighbour helpers. */
export interface EraRegistry {
  /** Every era definition, ordered by ascending year. */
  readonly definitions: readonly EraDefinition[]
  /** Era ids in the same order as `definitions`. */
  readonly ids: readonly EraId[]
  /** Era years in the same order as `definitions`. */
  readonly years: readonly number[]
  /** Number of eras in the registry. */
  readonly count: number
  /** Oldest era. */
  readonly first: EraDefinition
  /** Newest era. */
  readonly last: EraDefinition
  /** True when the value is a known era id. */
  isKnown(id: unknown): boolean
  /** Definition for an era id; throws {@link UnknownEraIdError} when unknown. */
  get(id: unknown): EraDefinition
  /** Definition for an era id, or `undefined` when unknown. */
  find(id: unknown): EraDefinition | undefined
  /** Definition for a calendar year, or `undefined` when no era covers it. */
  findByYear(year: number): EraDefinition | undefined
  /** Position of an era id in the ordering, or -1 when unknown. */
  indexOf(id: unknown): number
  /** The era one step older, or `undefined` at the start of the timeline. */
  previous(id: unknown): EraDefinition | undefined
  /** The era one step newer, or `undefined` at the end of the timeline. */
  next(id: unknown): EraDefinition | undefined
  /** Existing neighbours in timeline order: `[previous, next]` minus the ends. */
  neighbours(id: unknown): readonly EraDefinition[]
  /** Era `offset` steps away, clamped to the ends of the timeline. */
  atOffset(id: unknown, offset: number): EraDefinition
  /** True when the id names the oldest era. */
  isFirst(id: unknown): boolean
  /** True when the id names the newest era. */
  isLast(id: unknown): boolean
}

/** Clamps a position to a valid index of an ordered list. */
function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) {
    return 0
  }
  return Math.min(length - 1, Math.max(0, Math.trunc(index)))
}

/**
 * Builds a registry from any list of era definitions.
 *
 * Order comes from the `year` field, so the table may be written in any order.
 * Duplicate ids, duplicate years and a year that contradicts a known era id are
 * rejected, which turns a bad data edit into a loud failure instead of a subtly
 * wrong timeline.
 */
export function createEraRegistry(definitions: readonly EraDefinition[]): EraRegistry {
  if (definitions.length === 0) {
    throw new Error('An era registry needs at least one era definition.')
  }

  const ordered = [...definitions].sort((left, right) => left.year - right.year)
  const byId = new Map<EraId, EraDefinition>()
  const byYear = new Map<number, EraDefinition>()
  const knownIds = new Set<string>()

  for (const definition of ordered) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate era id '${definition.id}' in the era table.`)
    }
    if (byYear.has(definition.year)) {
      throw new Error(`Duplicate era year ${definition.year} in the era table.`)
    }
    if (isEraId(definition.id) && definition.year !== ERA_YEAR_BY_ID[definition.id]) {
      throw new Error(
        `Era '${definition.id}' declares year ${definition.year} but its id maps to ${ERA_YEAR_BY_ID[definition.id]}.`,
      )
    }
    byId.set(definition.id, definition)
    byYear.set(definition.year, definition)
    knownIds.add(definition.id)
  }

  const ids: readonly EraId[] = ordered.map((definition) => definition.id)
  const years: readonly number[] = ordered.map((definition) => definition.year)
  const first = ordered[0] ?? ERA_RECORDS[DEFAULT_ERA_ID]
  const last = ordered[ordered.length - 1] ?? first

  // Lookups validate against this registry's own ids, so a registry built from
  // an extended table serves its extra eras without touching the global list.
  const find = (id: unknown): EraDefinition | undefined =>
    typeof id === 'string' && knownIds.has(id) ? byId.get(id as EraId) : undefined
  const isKnown = (id: unknown): boolean => find(id) !== undefined
  const indexOf = (id: unknown): number => (find(id) === undefined ? -1 : ids.indexOf(id as EraId))
  const requireIndex = (id: unknown): number => {
    const index = indexOf(id)
    if (index < 0) {
      throw new UnknownEraIdError(id)
    }
    return index
  }
  const atOffset = (id: unknown, offset: number): EraDefinition => {
    const target = ordered[clampIndex(requireIndex(id) + offset, ordered.length)]
    if (target === undefined) {
      throw new UnknownEraIdError(id)
    }
    return target
  }

  const registry: EraRegistry = {
    definitions: Object.freeze(ordered),
    ids: Object.freeze([...ids]),
    years: Object.freeze([...years]),
    count: ordered.length,
    first,
    last,
    isKnown,
    get: (id) => {
      const definition = find(id)
      if (definition === undefined) {
        throw new UnknownEraIdError(id)
      }
      return definition
    },
    find,
    findByYear: (year) => byYear.get(year),
    indexOf,
    previous: (id) => ordered[requireIndex(id) - 1],
    next: (id) => ordered[requireIndex(id) + 1],
    neighbours: (id) => {
      const index = requireIndex(id)
      const result: EraDefinition[] = []
      const previous = ordered[index - 1]
      const next = ordered[index + 1]
      if (previous !== undefined) {
        result.push(previous)
      }
      if (next !== undefined) {
        result.push(next)
      }
      return result
    },
    atOffset,
    isFirst: (id) => requireIndex(id) === 0,
    isLast: (id) => requireIndex(id) === ordered.length - 1,
  }

  return Object.freeze(registry)
}

/** The shipped registry: five eras, oldest first. */
export const ERA_REGISTRY: EraRegistry = createEraRegistry(Object.values(ERA_RECORDS))

/** Shipped era definitions in timeline order. */
export const ERA_DEFINITIONS: readonly EraDefinition[] = ERA_REGISTRY.definitions

/** Shipped era ids in timeline order. */
export const ERA_ID_ORDER: readonly EraId[] = ERA_REGISTRY.ids

/** Shipped era years in timeline order. */
export const ERA_YEAR_ORDER: readonly number[] = ERA_REGISTRY.years

/** Definition for an era id; throws {@link UnknownEraIdError} when unknown. */
export function getEra(id: unknown): EraDefinition {
  return ERA_REGISTRY.get(id)
}

/** Definition for an era id, or `undefined` when unknown. */
export function findEra(id: unknown): EraDefinition | undefined {
  return ERA_REGISTRY.find(id)
}

/** Definition for a calendar year, or `undefined` when no era covers it. */
export function findEraByYear(year: number): EraDefinition | undefined {
  return ERA_REGISTRY.findByYear(year)
}

/** True when the value is a known era id. */
export function isKnownEraId(id: unknown): boolean {
  return ERA_REGISTRY.isKnown(id)
}

/** Position of an era id in the shipped ordering, or -1 when unknown. */
export function getEraIndex(id: unknown): number {
  return ERA_REGISTRY.indexOf(id)
}

/** The era one step older, or `undefined` at the start of the timeline. */
export function getPreviousEra(id: unknown): EraDefinition | undefined {
  return ERA_REGISTRY.previous(id)
}

/** The era one step newer, or `undefined` at the end of the timeline. */
export function getNextEra(id: unknown): EraDefinition | undefined {
  return ERA_REGISTRY.next(id)
}

/** Existing neighbours of an era in timeline order. */
export function getNeighbouringEras(id: unknown): readonly EraDefinition[] {
  return ERA_REGISTRY.neighbours(id)
}

/** Era `offset` steps away, clamped to the ends of the timeline. */
export function getEraAtOffset(id: unknown, offset: number): EraDefinition {
  return ERA_REGISTRY.atOffset(id, offset)
}

/** True when the id names the oldest shipped era. */
export function isFirstEra(id: unknown): boolean {
  return ERA_REGISTRY.isFirst(id)
}

/** True when the id names the newest shipped era. */
export function isLastEra(id: unknown): boolean {
  return ERA_REGISTRY.isLast(id)
}
