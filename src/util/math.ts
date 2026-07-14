/** Deterministic PRNG so the city layout is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded integer in [min, max] inclusive. */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Seeded float in [min, max). */
export function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Pick a deterministic element from an array. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Lerp a number. */
export function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;

/** Convert a [0,1] progress into eased alpha (smoothstep). */
export function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
