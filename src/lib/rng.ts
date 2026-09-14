/**
 * Shared seeded randomness source (mulberry32 PRNG).
 *
 * This is the single determinism source for all procedural era content:
 * identical seeds always produce identical sequences, so any era scene can
 * be regenerated deterministically. Era-content modules must not scatter
 * Math.random calls — import `createSeededRng` instead.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max], both ends inclusive. */
  int(min: number, max: number): number;
  /** Uniformly selected element from `items`. */
  pick<T>(items: readonly T[]): T;
  /** `true` with the given probability (default 0.5). */
  chance(probability?: number): boolean;
}

/**
 * Exact 32-bit multiply of two uint32 values. JS numbers are float64, so a
 * naive `a * b` loses low bits for large operands; splitting each operand
 * into 16-bit halves keeps every partial product exact (the canonical
 * Math.imul polyfill used by the mulberry32 JavaScript port).
 */
function imul(a: number, b: number): number {
  const aHi = a >> 16;
  const aLo = a & 0xffff;
  const bHi = b >> 16;
  const bLo = b & 0xffff;
  return (aLo * bLo + ((aHi * bLo + aLo * bHi) << 16)) & 0xffffffff;
}

/**
 * mulberry32 generator: a tiny, fast, seedable PRNG returning floats in
 * [0, 1). See https://github.com/bityrash/mulberry32.
 */
function mulberry32(seed: number): () => number {
  let state = seed & 0xffffffff;
  return () => {
    state = (state + 0x6d2b79f5) & 0xffffffff;
    let t = state;
    t = imul(t ^ (t >>> 15), t | 1);
    t ^= t + imul(t ^ (t >>> 7), t | 61);
    // JS bitwise ops yield signed int32; `>>> 0` converts the final XOR back
    // to its unsigned uint32 form so the result is always in [0, 1).
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a deterministic random number generator seeded with `seed`.
 * Identical seeds yield identical sequences.
 */
export function createSeededRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('rng.pick() requires a non-empty array');
      }
      return items[Math.floor(next() * items.length)]!;
    },
    chance(probability = 0.5) {
      return next() < probability;
    },
  };
}