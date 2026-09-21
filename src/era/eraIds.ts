/**
 * Canonical era identifiers for the city timelapse.
 *
 * The five periods of the brief — 1945, 1965, 1985, 2005 and 2025 — are
 * modelled as stable string ids. An id doubles as the registry map key, the
 * value of the timeline slider and the key of every per-era content table, so
 * ids must never be renumbered or renamed after this task.
 *
 * README.md mentions 2055 as well. It is deliberately not shipped yet; adding
 * it later means appending one entry to {@link ERA_IDS}, one year mapping and
 * one record in the era table, with no branching code change anywhere.
 */

/** Ordered era ids, oldest first. Append-only. */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const

/** Stable identifier of one era, usable as a map key and a URL parameter. */
export type EraId = (typeof ERA_IDS)[number]

/** Year represented by each era, in the same order as {@link ERA_IDS}. */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const

/** Calendar year one era id stands for. */
export type EraYear = (typeof ERA_YEARS)[number]

/** Era id to year, for lookups that start from a year value. */
export const ERA_YEAR_BY_ID: Readonly<Record<EraId, EraYear>> = {
  '1945': 1945,
  '1965': 1965,
  '1985': 1985,
  '2005': 2005,
  '2025': 2025,
}

/** Era the scene shows before the user touches the timeline slider. */
export const DEFAULT_ERA_ID: EraId = '1945'

/** Newest era in the registry; the timeline's right-hand stop. */
export const LATEST_ERA_ID: EraId = '2025'

/** Number of eras the shipped registry contains. */
export const ERA_COUNT = ERA_IDS.length

const ERA_ID_LOOKUP: ReadonlySet<string> = new Set<string>(ERA_IDS)

/** Short, safe rendering of a rejected value for error messages. */
function describeValue(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value)
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value)
    case 'undefined':
      return 'undefined'
    case 'object':
      return value === null ? 'null' : 'an object'
    default:
      return typeof value
  }
}

/** Clamps a position on the timeline to a valid era index. */
function clampEraIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0
  }
  return Math.min(ERA_IDS.length - 1, Math.max(0, Math.trunc(index)))
}

/** Thrown when an unknown era id reaches a module that only accepts known eras. */
export class UnknownEraIdError extends Error {
  /** The rejected value, handy for assertions and diagnostics. */
  readonly received: unknown

  constructor(received: unknown) {
    super(`Unknown era id ${describeValue(received)}. Known era ids: ${ERA_IDS.join(', ')}.`)
    this.name = 'UnknownEraIdError'
    this.received = received
  }
}

/** Narrows an untrusted value (URL parameter, stored setting) to an era id. */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'string' && ERA_ID_LOOKUP.has(value)
}

/** Returns the id unchanged, or throws {@link UnknownEraIdError} for unknown input. */
export function requireEraId(value: unknown): EraId {
  if (!isEraId(value)) {
    throw new UnknownEraIdError(value)
  }
  return value
}

/** Resolves untrusted input, falling back to `fallback` when the value is unknown. */
export function resolveEraId(value: unknown, fallback: EraId = DEFAULT_ERA_ID): EraId {
  return isEraId(value) ? value : fallback
}

/** Position of an era id on the timeline (0-based), or -1 when unknown. */
export function eraIdIndex(value: unknown): number {
  return isEraId(value) ? ERA_IDS.indexOf(value) : -1
}

/** Era id at a timeline position, clamped to the ends. Non-finite positions clamp to the first era. */
export function eraIdAt(index: number): EraId {
  return ERA_IDS[clampEraIndex(index)] ?? DEFAULT_ERA_ID
}

/** Era id `offset` steps away, clamped so the timeline never wraps around. */
export function offsetEraId(value: unknown, offset: number): EraId {
  const from = eraIdIndex(value)
  if (from < 0) {
    throw new UnknownEraIdError(value)
  }
  return eraIdAt(from + offset)
}
