import * as THREE from 'three';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// framerate-independent exponential smoothing factor
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dt: number,
): THREE.Vector3 {
  current.x = damp(current.x, target.x, lambda, dt);
  current.y = damp(current.y, target.y, lambda, dt);
  current.z = damp(current.z, target.z, lambda, dt);
  return current;
}

// ease-in-out cubic
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// hash-based pseudo-random for deterministic procedural generation
export function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

export function hash2(x: number, y: number): number {
  return hash(x * 127.1 + y * 311.7);
}

// Linear interpolate hex colors via THREE.Color (destructive to out)
export function lerpColor(out: THREE.Color, a: string, b: string, t: number): THREE.Color {
  tmpColorA.set(a);
  tmpColorB.set(b);
  return out.lerpColors(tmpColorA, tmpColorB, t);
}

const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();

// pick from array deterministically
export function pick<T>(arr: T[], n: number): T {
  return arr[Math.abs(Math.floor(n)) % arr.length];
}

export function randRange(lo: number, hi: number, seed: number): number {
  return lo + hash(seed) * (hi - lo);
}
