/**
 * Deterministic seeded random number generation for the city module.
 *
 * Implements mulberry32, a small fast 32-bit PRNG that produces the exact same
 * sequence for the same seed on every run and platform, so the generated city
 * is fully reproducible.
 */

export type Rng = () => number;

/** Create a deterministic PRNG from a 32-bit seed (mulberry32). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Pick a random element from a non-empty array. */
export function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)];
}
