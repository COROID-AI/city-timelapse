/**
 * Shared utilities for the procedural asset builders.
 *
 * Every builder in `src/assetBuilder/` produces era-specific Three.js objects
 * (Groups, Meshes, Materials, Textures). To keep memory bounded and frame
 * rates stable during era transitions, all generated assets are **cached** and
 * keyed by `"${eraId}:${category}"`. This module provides that cache plus a
 * handful of pure helpers (colour math, seeded RNG, disposal) that every
 * builder reuses so they never duplicate boilerplate.
 */

import * as THREE from 'three';
import type { EraId, EraSpec } from '../eras/types.js';

// ---------------------------------------------------------------------------
// Cache key & central asset cache
// ---------------------------------------------------------------------------

/**
 * Build a deterministic cache key from an era id and an asset category.
 *
 * The key is used by every builder so that the same `(era, category)` pair
 * always resolves to the same cached object without re-running the expensive
 * procedural generation.
 */
export function cacheKey(eraId: EraId, category: string): string {
  return `${eraId}:${category}`;
}

/**
 * A type-safe, string-keyed cache for generated Three.js assets.
 *
 * Stores arbitrary `THREE.Object3D`-derived assets (Groups, Meshes) or
 * materials/textures. Callers check {@link AssetCache.has} before generating
 * and use {@link AssetCache.set} after generation to populate the cache.
 */
export class AssetCache<T> {
  private readonly store = new Map<string, T>();

  /** Return the cached asset for a key, or `undefined` if not present. */
  get(key: string): T | undefined {
    return this.store.get(key);
  }

  /** Store an asset under a key and return it (for chaining). */
  set(key: string, value: T): T {
    this.store.set(key, value);
    return value;
  }

  /** Whether a cached asset exists for the given key. */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Remove and return a cached asset (does **not** dispose it). */
  delete(key: string): T | undefined {
    const value = this.store.get(key);
    this.store.delete(key);
    return value;
  }

  /** Iterate over all cached entries. */
  entries(): IterableIterator<[string, T]> {
    return this.store.entries();
  }

  /** The number of cached assets. */
  get size(): number {
    return this.store.size;
  }
}

/**
 * The single shared cache instance for all procedural asset builders.
 * Keys are produced by {@link cacheKey}; values are `THREE.Group` instances.
 */
export const assetCache = new AssetCache<THREE.Group>();

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex colour string (`"#rrggbb"`) into a `THREE.Color`.
 * Falls back to medium grey on invalid input so builders never crash.
 */
export function hexToColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color(0x888888);
  }
}

/**
 * Linearly interpolate between two hex colours.
 * @param a  Start colour (hex).
 * @param b  End colour (hex).
 * @param t  Interpolation factor (0 → a, 1 → b).
 */
export function lerpHex(a: string, b: string, t: number): THREE.Color {
  const ca = hexToColor(a);
  const cb = hexToColor(b);
  return ca.lerp(cb, t);
}

/**
 * Darken or lighten a hex colour by a signed amount.
 * @param hex    Source colour.
 * @param amount `-1` (full black) … `0` (unchanged) … `+1` (full white).
 */
export function shadeHex(hex: string, amount: number): THREE.Color {
  const c = hexToColor(hex);
  if (amount < 0) {
    c.multiplyScalar(1 + amount); // darken
  } else {
    c.lerp(new THREE.Color(0xffffff), amount); // lighten
  }
  return c;
}

/**
 * Pick a deterministic element from a readonly array using a seeded RNG.
 * This lets builders select palettes reproducibly.
 */
export function pickFrom<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length) % arr.length;
  return arr[idx]!;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator
// ---------------------------------------------------------------------------

/**
 * Mulberry32 — a tiny, fast, deterministic PRNG.
 *
 * Using a seeded RNG means the same era always generates the same city block
 * layout, which is essential for stable cross-era transitions (buildings
 * don't jump around when the slider moves).
 *
 * @param seed  Any 32-bit integer.
 * @returns A function returning floats in `[0, 1)`.
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a stable numeric seed from an {@link EraSpec} and a category label.
 * The seed is combined from the era year and a hash of the category string
 * so that different categories produce different layouts within the same era.
 */
export function eraSeed(era: EraSpec, category: string): number {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return (era.year * 1000 + hash) >>> 0;
}

// ---------------------------------------------------------------------------
// Three.js disposal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively dispose all geometries and materials in a `THREE.Object3D` tree.
 *
 * Textures attached to disposed materials are also disposed. This must be
 * called before removing an era's assets from the scene to prevent GPU
 * memory leaks across many era transitions.
 */
export function disposeObject3D(obj: THREE.Object3D): void {
 obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const m of material) {
        disposeMaterial(m);
      }
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

/** Dispose a single material and any textures it references. */
function disposeMaterial(mat: THREE.Material): void {
  // Dispose any textures on common material types.
  const m = mat as THREE.MeshStandardMaterial;
  const textureProps: (keyof THREE.MeshStandardMaterial)[] = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
  for (const prop of textureProps) {
    const tex = m[prop] as THREE.Texture | undefined;
    if (tex) {
      tex.dispose();
    }
  }
  mat.dispose();
}

// ---------------------------------------------------------------------------
// Geometry / material factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a standard cached `MeshStandardMaterial` from a hex colour.
 *
 * @param hex       Base colour.
 * @param options   Optional overrides for roughness, metalness, emissive, etc.
 */
export function stdMaterial(
  hex: string,
  options: {
    roughness?: number;
    metalness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hexToColor(hex),
    roughness: options.roughness ?? 0.8,
    metalness: options.metalness ?? 0.1,
    emissive: options.emissive ? hexToColor(options.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

/**
 * Create a simple box mesh with the given dimensions and material.
 * The geometry is created fresh each time (cheap for small counts) but the
 * caller may share a geometry across meshes if needed.
 */
export function boxMesh(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Create a cylinder mesh (used for lamp posts, wheels, etc.).
 * @param rt     Top radius.
 * @param rb     Bottom radius.
 * @param h      Height.
 * @param seg    Radial segments.
 * @param mat    Material.
 */
export function cylMesh(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  mat: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
