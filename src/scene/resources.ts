import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────────────
// Global Shared Resource Cache
// ──────────────────────────────────────────────────────────────────────
// This module provides a singleton cache for geometries and materials
// that are reused across eras and within era content generation.
// Geometries are immutable so they can be safely shared. Materials
// are cached by identity key to avoid duplicate shader programs.
//
// All cached resources are tracked so they can be disposed during
// era transitions. The cache is cleared on explicit request.
// ──────────────────────────────────────────────────────────────────────

type GeometryKey = string;
type MaterialKey = string;

interface CachedResource {
  dispose(): void;
}

class ResourceCache implements CachedResource {
  private _geometries = new Map<GeometryKey, THREE.BufferGeometry>();
  private _materials = new Map<MaterialKey, THREE.Material | THREE.Material[]>();
  private _textures = new Map<string, THREE.Texture>();

  getGeometry(key: GeometryKey): THREE.BufferGeometry {
    if (!this._geometries.has(key)) {
      throw new Error(`Geometry key "${key}" was never registered in the cache.`);
    }
    return this._geometries.get(key)!;
  }

  registerGeometry(key: GeometryKey, geo: THREE.BufferGeometry): void {
    if (!this._geometries.has(key)) {
      this._geometries.set(key, geo);
    }
  }

  hasGeometry(key: GeometryKey): boolean {
    return this._geometries.has(key);
  }

  getMaterial(key: MaterialKey): THREE.Material | THREE.Material[] | undefined {
    return this._materials.get(key);
  }

  registerMaterial(key: MaterialKey, mat: THREE.Material | THREE.Material[]): void {
    if (!this._materials.has(key)) {
      this._materials.set(key, mat);
    }
  }

  getTexture(key: string): THREE.Texture | undefined {
    return this._textures.get(key);
  }

  registerTexture(key: string, tex: THREE.Texture): void {
    if (!this._textures.has(key)) {
      this._textures.set(key, tex);
    }
  }

  /** Dispose all cached resources and clear the cache. */
  dispose(): void {
    for (const [, geo] of this._geometries) {
      geo.dispose();
    }
    this._geometries.clear();

    for (const [, mats] of this._materials) {
      const arr = Array.isArray(mats) ? mats : [mats];
      for (const m of arr) m.dispose();
    }
    this._materials.clear();

    for (const [, tex] of this._textures) {
      tex.dispose();
    }
    this._textures.clear();
  }

  get geometryCount(): number {
    return this._geometries.size;
  }

  get materialCount(): number {
    return this._materials.size;
  }
}

// Singleton instance — shared across all eras
let _cache: ResourceCache | null = null;

export function getResourceCache(): ResourceCache {
  if (!_cache) {
    _cache = new ResourceCache();
    // Register pre-baked shared geometries on first access
    const c = _cache;
    const keys = ['box_small', 'box_thin', 'cyl_small', 'sphere_small', 'torus_small'];
    const factories = [
      () => new THREE.BoxGeometry(1, 1, 1),
      () => new THREE.BoxGeometry(0.02, 1, 1),
      () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      () => new THREE.SphereGeometry(0.5, 12, 8),
      () => new THREE.TorusGeometry(0.5, 0.25, 12, 24),
    ];
    for (let i = 0; i < keys.length; i++) {
      c.registerGeometry(keys[i], factories[i]());
    }
  }
  return _cache;
}

/**
 * Reset the global resource cache. Call this when switching between
 * major scene configurations or when memory pressure requires it.
 */
export function resetResourceCache(): void {
  _cache?.dispose();
  _cache = null;
}

// ──────────────────────────────────────────────────────────────────────
// InstancedMesh helpers for common repeated patterns
// ──────────────────────────────────────────────────────────────────────

export interface InstanceTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

/**
 * Build an InstancedMesh from a shared geometry, material, count,
 * and an array of per-instance transforms.
 *
 * @param geoKey   Key into the shared geometry cache
 * @param material The material (shared across all instances)
 * @param count    Number of instances
 * @param transforms Array of {position, rotation, scale} objects
 * @param castShadow Whether instances cast shadows
 * @param receiveShadow Whether instances receive shadows
 */
export function createInstancedMesh(
  geoKey: string,
  material: THREE.Material,
  count: number,
  transforms: InstanceTransform[],
  castShadow = false,
  receiveShadow = true,
): THREE.InstancedMesh {
  const geo = getResourceCache().getGeometry(geoKey);
  const mesh = new THREE.InstancedMesh(geo, material, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < Math.min(count, transforms.length); i++) {
    const t = transforms[i];
    dummy.position.copy(t.position);
    dummy.rotation.copy(t.rotation);
    dummy.scale.copy(t.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = `instanced_${geoKey}_${count}`;

  return mesh;
}

/**
 * Build multiple InstancedMesh groups from grouped transforms.
 * Useful for batching by material type (e.g., all glass windows
 * in one InstancedMesh, all frame windows in another).
 *
 * Returns an array of InstancedMesh objects ready to add to a group.
 */
export function createBatchedInstancedMeshes(
  groups: Array<{
    geoKey: string;
    material: THREE.Material;
    transforms: InstanceTransform[];
    castShadow?: boolean;
    receiveShadow?: boolean;
  }>,
): THREE.InstancedMesh[] {
  return groups.map((g) =>
    createInstancedMesh(g.geoKey, g.material, g.transforms.length, g.transforms, g.castShadow, g.receiveShadow),
  );
}

// ──────────────────────────────────────────────────────────────────────
// FPS tracking utilities
// ──────────────────────────────────────────────────────────────────────

export interface FPSData {
  current: number;
  average: number;
  min: number;
  max: number;
  frameCount: number;
}

class FPSMonitor {
  private _frames = 0;
  private _lastTime = performance.now();
  private _currentFps = 0;
  private _fpsHistory: number[] = [];
  private _totalFrames = 0;
  private _minFps = Infinity;
  private _maxFps = 0;

  tick(): FPSData {
    this._frames++;
    this._totalFrames++;
    const now = performance.now();
    const delta = now - this._lastTime;

    if (delta >= 500) { // update every 500ms
      this._currentFps = Math.round((this._frames * 1000) / delta);
      this._fpsHistory.push(this._currentFps);
      if (this._fpsHistory.length > 120) {
        this._fpsHistory.shift(); // keep ~60 seconds of history at 2fps sampling
      }
      this._minFps = Math.min(this._minFps, this._currentFps);
      this._maxFps = Math.max(this._maxFps, this._currentFps);
      this._frames = 0;
      this._lastTime = now;
    }

    const avg =
      this._fpsHistory.length > 0
        ? Math.round(this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length)
        : this._currentFps;

    return {
      current: this._currentFps,
      average: avg,
      min: this._minFps === Infinity ? 0 : this._minFps,
      max: this._maxFps,
      frameCount: this._totalFrames,
    };
  }

  reset(): void {
    this._frames = 0;
    this._lastTime = performance.now();
    this._currentFps = 0;
    this._fpsHistory = [];
    this._totalFrames = 0;
    this._minFps = Infinity;
    this._maxFps = 0;
  }
}

export const fpsMonitor = new FPSMonitor();
