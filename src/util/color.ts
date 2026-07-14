import * as THREE from 'three';

const _a = new THREE.Color();
const _b = new THREE.Color();
const _out = new THREE.Color();

/** Convert a hex string (#rrggbb) into a Linear-sRGB Color suitable for lighting. */
export function hexToLinear(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex).convertSRGBToLinear();
}

/**
 * Lerp between two hex colors and return a new hex string (#rrggbb).
 * Interpolation happens in Linear working space for perceptually correct blends.
 */
export function lerpHex(from: string, to: string, t: number): string {
  _a.setStyle(from).convertSRGBToLinear();
  _b.setStyle(to).convertSRGBToLinear();
  _out.copy(_a).lerp(_b, t);
  return '#' + _out.getHexString();
}

/** Lerp between two hex colors into a reusable THREE.Color (Linear space). */
export function lerpColorInto(
  from: string,
  to: string,
  t: number,
  target: THREE.Color
): THREE.Color {
  _a.setStyle(from).convertSRGBToLinear();
  _b.setStyle(to).convertSRGBToLinear();
  target.copy(_a).lerp(_b, t);
  return target;
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing for 0..1. */
export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
