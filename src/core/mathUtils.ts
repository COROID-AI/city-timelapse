import * as THREE from 'three';

// Shared, allocation-light helpers for per-era weighted interpolation.
// Reusable temp objects avoid per-frame allocations (leak / GC requirement).

const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Blend an array of hex colors by weights; writes into `out` and returns it. */
export function blendColors(
  colors: number[],
  weights: Float32Array,
  offset: number,
  out: THREE.Color,
): THREE.Color {
  out.setRGB(0, 0, 0);
  const n = Math.min(colors.length, weights.length - offset);
  for (let i = 0; i < n; i++) {
    const w = weights[offset + i];
    if (w === 0) continue;
    _c.setHex(colors[i]);
    out.r += _c.r * w;
    out.g += _c.g * w;
    out.b += _c.b * w;
  }
  return out;
}

/** Blend a single hex value (one per era) by weights. */
export function blendSingle(
  perEra: number[],
  weights: Float32Array,
  offset: number,
  out: THREE.Color,
): THREE.Color {
  return blendColors(perEra, weights, offset, out);
}

/** Blend a scalar across eras. */
export function blendScalar(
  perEra: number[],
  weights: Float32Array,
  offset: number,
): number {
  let v = 0;
  const n = Math.min(perEra.length, weights.length - offset);
  for (let i = 0; i < n; i++) v += perEra[i] * weights[offset + i];
  return v;
}

/** Set a THREE.Color from a weighted blend of per-era hex values. */
export function setBlended(
  target: THREE.Color,
  perEra: number[],
  weights: Float32Array,
  offset: number,
): void {
  blendColors(perEra, weights, offset, target);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function hash(i: number): number {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Deterministic pseudo-random in [min,max) from an integer seed. */
export function hashRange(i: number, min: number, max: number): number {
  return min + hash(i) * (max - min);
}

export { _c, _c2 };
