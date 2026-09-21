/**
 * Deterministic pseudo-random number generation.
 *
 * Every procedural system of the city timelapse (layout, buildings,
 * storefronts, vehicles, pedestrians, props and VFX) draws its randomness from
 * this module, so a given seed always rebuilds the exact same city.
 *
 * The generator is pure: it never reads `Math.random`, `Date`, environment or
 * network state, which means two runs with the same seed produce a
 * byte-identical number sequence on any machine and in any order of use.
 * The core is sfc32 seeded through a splitmix32 expander — small, fast and
 * good enough for visual distribution while staying fully reproducible.
 */

/** Number of distinct values a single 32-bit draw can produce. */
const UINT32_SPAN = 0x1_0000_0000

/** Seed used when a caller does not supply one. */
export const DEFAULT_RNG_SEED = 0x9e3779b9

/** Seed material accepted by {@link createRng}: an integer or a stable string. */
export type Seed = number | string

/** Serializable generator state, useful for snapshot tests and replay. */
export type RngState = readonly [number, number, number, number]

/**
 * Deterministic random source. All methods are pure functions of the internal
 * state, so calling them in the same order always yields the same values.
 */
export interface Rng {
  /** Normalised numeric seed this generator was created from. */
  readonly seed: number
  /** Human-readable label, mostly for debugging and fork chains. */
  readonly label: string
  /** Current internal state. */
  readonly state: RngState
  /** Uniform float in `[0, 1)`. */
  next(): number
  /** Uniform unsigned 32-bit integer in `[0, 2 ** 32)`. */
  uint32(): number
  /** Uniform float in `[min, max)`. Returns `min` when the range is empty. */
  float(min?: number, max?: number): number
  /** Uniform integer in `[minInclusive, maxExclusive)`. */
  int(minInclusive: number, maxExclusive: number): number
  /** Bernoulli trial; `probability` is clamped to `[0, 1]`. */
  bool(probability?: number): boolean
  /** Deterministic element of a non-empty collection. */
  pick<T>(items: readonly T[]): T
  /** Deterministic Fisher-Yates copy of a collection. */
  shuffle<T>(items: readonly T[]): T[]
  /**
   * Child generator whose sequence is independent from this one but still
   * derived from the same parent seed, so sub-systems can be seeded separately
   * without sharing draws.
   */
  fork(label: string): Rng
}

/** FNV-1a hash of a string, used to turn labels into seeds. */
export function hashStringToSeed(value: string, basis = 0x811c9dc5): number {
  let hash = basis >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Coerces either seed flavour into an unsigned 32-bit integer. */
export function normalizeSeed(seed: Seed): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new TypeError(`Rng seed must be a finite number, received ${String(seed)}`)
    }
    return Math.trunc(seed) >>> 0
  }
  return hashStringToSeed(seed)
}

/** Derives a stable sub-seed from a parent seed plus a label. */
export function deriveSeed(seed: Seed, label: string): number {
  const base = normalizeSeed(seed) ^ hashStringToSeed(label)
  let mixed = base >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad) >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97) >>> 0
  return (mixed ^ (mixed >>> 15)) >>> 0
}

/** Expands a single seed word into the four sfc32 state words. */
function createRngState(seed: number): RngState {
  let state = seed >>> 0
  const nextWord = (): number => {
    state = (state + 0x9e3779b9) >>> 0
    let word = state
    word = Math.imul(word ^ (word >>> 16), 0x21f0aaad) >>> 0
    word = Math.imul(word ^ (word >>> 15), 0x735a2d97) >>> 0
    return (word ^ (word >>> 15)) >>> 0
  }
  return [nextWord(), nextWord(), nextWord(), nextWord()]
}

/** Creates a generator from an explicit snapshot state. */
export function createRngFromState(state: RngState, label = 'root', seed = 0): Rng {
  let a = state[0] >>> 0
  let b = state[1] >>> 0
  let c = state[2] >>> 0
  let d = state[3] >>> 0

  const uint32 = (): number => {
    let total = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    total = (total + d) | 0
    c = (c + total) | 0
    return total >>> 0
  }

  const unit = (): number => uint32() / UINT32_SPAN

  const rng: Rng = {
    seed,
    label,
    get state(): RngState {
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0]
    },
    next: unit,
    uint32,
    float(min = 0, max = 1): number {
      if (!(max > min)) {
        return min
      }
      return min + (max - min) * unit()
    },
    int(minInclusive: number, maxExclusive: number): number {
      const low = Math.ceil(minInclusive)
      const high = Math.floor(maxExclusive)
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        throw new RangeError(
          `Rng.int requires a finite range, received [${String(minInclusive)}, ${String(maxExclusive)})`,
        )
      }
      if (high <= low) {
        return low
      }
      return low + Math.floor(unit() * (high - low))
    },
    bool(probability = 0.5): boolean {
      if (probability <= 0) {
        return false
      }
      if (probability >= 1) {
        return true
      }
      return unit() < probability
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError('Rng.pick cannot draw from an empty collection')
      }
      return items[rng.int(0, items.length)] as T
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice()
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapWith = rng.int(0, index + 1)
        const current = copy[index] as T
        copy[index] = copy[swapWith] as T
        copy[swapWith] = current
      }
      return copy
    },
    fork(childLabel: string): Rng {
      const childSeed = deriveSeed(seed, childLabel)
      return createRngFromState(createRngState(childSeed), childLabel, childSeed)
    },
  }

  return rng
}

/**
 * Creates a deterministic generator.
 *
 * @param seed Integer or string seed. Strings are hashed with FNV-1a, so
 *   `createRng('city-block')` is stable across processes and machines.
 */
export function createRng(seed: Seed = DEFAULT_RNG_SEED, label = 'root'): Rng {
  const numericSeed = normalizeSeed(seed)
  return createRngFromState(createRngState(numericSeed), label, numericSeed)
}
