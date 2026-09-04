// Small deterministic RNG so the city is stable across reloads.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rnd: () => number, min: number, max: number): number {
  return min + rnd() * (max - min);
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
}

export function int(rnd: () => number, min: number, max: number): number {
  return Math.floor(range(rnd, min, max + 1));
}