// ============================================================
//  Math + color utilities
// ============================================================
import * as THREE from 'three';

// Mulberry32 seeded PRNG — deterministic procedural generation
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, min, max) { return min + rng() * (max - min); }
export function randInt(rng, min, max) { return Math.floor(rand(rng, min, max + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function chance(rng, p) { return rng() < p; }

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { return t * t * (3 - 2 * t); }
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// Color helpers ------------------------------------------------
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

export function hexToColor(hex) { return new THREE.Color(hex); }

// Smoothly lerp a THREE.Color toward a hex target
export function dampColor(color, targetHex, lambda, dt) {
  _c2.set(targetHex);
  color.r = damp(color.r, _c2.r, lambda, dt);
  color.g = damp(color.g, _c2.g, lambda, dt);
  color.b = damp(color.b, _c2.b, lambda, dt);
  return color;
}

// Lerp between two hex colors by t (0..1), returns THREE.Color
export function mixHex(hexA, hexB, t) {
  _c1.set(hexA); _c2.set(hexB);
  return _c1.clone().lerp(_c2, t);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        for (const k in m) {
          if (m[k] && m[k].isTexture) m[k].dispose();
        }
        m.dispose();
      });
    }
  });
}

// Simple key frame store for per-building window patterns
export function range(n) { return Array.from({ length: n }, (_, i) => i); }
