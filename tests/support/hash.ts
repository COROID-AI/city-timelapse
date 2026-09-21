/**
 * Stable serialisation hashing for determinism tests.
 *
 * Generator tests need to compare whole structures — a list of building
 * transforms, a city layout snapshot — without caring about key insertion
 * order. `stableStringify` canonicalises a value (sorted object keys, explicit
 * markers for special numbers, maps, sets, typed arrays and cycles) and
 * `hashValue` reduces it to a short hex digest that is safe to assert on.
 */

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

/** Two-lane FNV-1a digest as 16 lowercase hex characters. */
export function hashString(value: string): string {
  const low = fnv1a32(value, FNV_OFFSET)
  const high = fnv1a32(value, (SECOND_LANE_OFFSET ^ value.length) >>> 0)
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

function stringifyNumber(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN'
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 'Infinity'
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return '-Infinity'
  }
  if (Object.is(value, -0)) {
    return '-0'
  }
  return String(value)
}

function stringifyInto(value: unknown, seen: Set<unknown>): string {
  if (value === null) {
    return 'null'
  }

  switch (typeof value) {
    case 'undefined':
      return 'undefined'
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      return stringifyNumber(value)
    case 'bigint':
      return `${value.toString()}n`
    case 'string':
      return JSON.stringify(value)
    case 'function':
      return `[function ${value.name === '' ? 'anonymous' : value.name}]`
    case 'symbol':
      return `[symbol ${value.description ?? ''}]`
    default:
      break
  }

  if (seen.has(value)) {
    return '[circular]'
  }
  seen.add(value)

  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stringifyInto(item, seen)).join(',')}]`
    }
    if (value instanceof Date) {
      return `Date(${Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString()})`
    }
    if (value instanceof Map) {
      const entries = [...value.entries()]
        .map(([key, item]) => `${stringifyInto(key, seen)}=>${stringifyInto(item, seen)}`)
        .sort()
      return `Map{${entries.join(',')}}`
    }
    if (value instanceof Set) {
      const entries = [...value.values()].map((item) => stringifyInto(item, seen)).sort()
      return `Set{${entries.join(',')}}`
    }
    if (ArrayBuffer.isView(value)) {
      const items = Array.from(value as unknown as ArrayLike<number | bigint>).map((item) => String(item))
      return `${value.constructor.name}[${items.join(',')}]`
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item !== 'undefined' && typeof item !== 'function')
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    const body = entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stringifyInto(item, seen)}`)
      .join(',')
    return `{${body}}`
  } finally {
    seen.delete(value)
  }
}

/** Canonical, key-order independent string form of any value. */
export function stableStringify(value: unknown): string {
  return stringifyInto(value, new Set<unknown>())
}

/** Short digest of a canonicalised value, suitable for `expect(...).toBe(...)`. */
export function hashValue(value: unknown): string {
  return hashString(stableStringify(value))
}

/** Digest of a list of values, useful when asserting whole generator runs. */
export function hashMany(values: readonly unknown[]): string {
  return hashValue(values)
}
