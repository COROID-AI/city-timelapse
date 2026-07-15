/** Math helpers with zero per-frame allocation in hot paths. */

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function saturate(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, v));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = saturate(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = saturate(invLerp(edge0, edge1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Frame-rate independent smoothing toward a target. */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Cubic ease-in-out for a normalized [0,1] progress value. */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Deterministic seeded PRNG (mulberry32). */
export class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  /** Next float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  /** Pick a deterministic element. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Wrap a value into the half-open range [min, max). */
export function wrap(v: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return min;
  return ((((v - min) % span) + span) % span) + min;
}
