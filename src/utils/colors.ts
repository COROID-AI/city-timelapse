import * as THREE from "three";
import { clamp } from "./math";

/** Parse a hex number into an sRGB THREE.Color. */
export function hexToColor(hex: number, target?: THREE.Color): THREE.Color {
  if (target) return target.setHex(hex, THREE.SRGBColorSpace);
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
}

/** Linear-space lerp of two sRGB hex colors, writing into `target`. */
export function lerpHex(
  a: number,
  b: number,
  t: number,
  target: THREE.Color,
  scratchA: THREE.Color,
  scratchB: THREE.Color
): THREE.Color {
  scratchA.setHex(a, THREE.SRGBColorSpace);
  scratchB.setHex(b, THREE.SRGBColorSpace);
  target.copy(scratchA).lerp(scratchB, t);
  return target;
}

/** Scale a color's brightness; writes into target. */
export function scaleColor(
  hex: number,
  scale: number,
  target: THREE.Color
): THREE.Color {
  target.setHex(hex, THREE.SRGBColorSpace);
  target.multiplyScalar(clamp(scale, 0, 4));
  return target;
}

/** Convert a hex number to an rgba() CSS string with given alpha. */
export function hexToCss(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const bl = hex & 0xff;
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}
