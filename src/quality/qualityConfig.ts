/**
 * qualityConfig.ts — renderer quality configuration for the city timelapse.
 *
 * Owned by the final polish/QA phase. This module is pure data plus lightweight
 * scene introspection: it never imports the browser entry, WebGLRenderer or any
 * era layer, so the browser integration (src/main.ts) and the headless QA suite
 * (src/quality/qa.test.ts) share one source of truth for renderer quality.
 *
 * Exports:
 *  - `QualityConfig` — the picker surface: pixel-ratio cap (which bounds the
 *    antialiasing resolve resolution), antialias on/off, geometry/material
 *    reuse flags and the instancing flag.
 *  - `DEFAULT_QUALITY_CONFIG` / `resolveQualityConfig()` — frozen high-end
 *    defaults and a validated override merge used by integration.
 *  - `effectivePixelRatio()` — clamps a device pixel ratio to the cap.
 *  - `createPerformanceReport()` — the performance/memory report hook. The
 *    integration attaches a report sink (see `QualityReportHook`) and seeds it
 *    every frame / after each era walk; the report derives draw-call proxies
 *    (unique vs shared geometry/material counts) and an estimated GPU memory
 *    footprint directly from the headless scene graph, so the same hook works
 *    in the browser and in Node.
 */

import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';

/* ------------------------------------------------------------------ *
 * Quality configuration.
 * ------------------------------------------------------------------ */

/** Renderer quality knobs exposed by the picker / integration. */
export interface QualityConfig {
  /**
   * Maximum device pixel ratio applied to the renderer backing store (>= 1).
   * Capping the pixel ratio bounds the antialias (MSAA) resolve resolution on
   * high-DPI displays; the effective value is `min(devicePixelRatio, cap)`.
   */
  readonly pixelRatioCap: number;
  /** Enables MSAA on the WebGL renderer (`antialias: true`). */
  readonly antialias: boolean;
  /** Share cached geometries across era-scene instances. */
  readonly geometryReuse: boolean;
  /** Share cached materials across era-scene instances. */
  readonly materialReuse: boolean;
  /** Prefer instanced rendering for repeated props (trees, benches,...). */
  readonly instancing: boolean;
}

/** High-end defaults: cap supersampling at 2x, keep antialias + reuse on. */
export const DEFAULT_QUALITY_CONFIG: Readonly<QualityConfig> = Object.freeze({
  pixelRatioCap: 2,
  antialias: true,
  geometryReuse: true,
  materialReuse: true,
  instancing: true,
});

/**
 * Merge `overrides` onto the high-end defaults and validate the result.
 * Returns a freshly frozen config so callers can rely on immutability.
 */
export function resolveQualityConfig(overrides: Partial<QualityConfig> = {}): Readonly<QualityConfig> {
  const entries = Object.entries(overrides) as Array<[keyof QualityConfig, unknown]>;
  for (const [key, value] of entries) {
    if (key === 'pixelRatioCap') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(
          `resolveQualityConfig: pixelRatioCap must be a positive finite number, got ${String(value)}`,
        );
      }
    } else if (typeof value !== 'boolean') {
      throw new Error(`resolveQualityConfig: ${key} must be a boolean, got ${String(value)}`);
    }
  }
  return Object.freeze({ ...DEFAULT_QUALITY_CONFIG, ...overrides });
}

/**
 * Effective device pixel ratio the renderer should apply: the device ratio
 * clamped to `config.pixelRatioCap` (with a sanity floor of 1).
 */
export function effectivePixelRatio(
  devicePixelRatio: number,
  config: Pick<QualityConfig, 'pixelRatioCap'> = DEFAULT_QUALITY_CONFIG,
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, config.pixelRatioCap);
}

/* ------------------------------------------------------------------ *
 * Performance / memory report hook.
 * ------------------------------------------------------------------ */

/** Hook key used to identify the performance report in integration wiring. */
export const QUALITY_REPORT_HOOK = 'quality-report';

/** A report sink: receives the latest performance/memory snapshot. */
export type QualityReportHook = (report: PerformanceReport) => void;

/** Inputs for a report snapshot (viewer + frame epoch). */
export interface PerformanceReportOptions {
  /** Viewport width in CSS pixels. */
  readonly width?: number;
  /** Viewport height in CSS pixels. */
  readonly height?: number;
  /** Current device pixel ratio (default 1). */
  readonly devicePixelRatio?: number;
  /** Number of frames rendered since the walk/epoch started (default 0). */
  readonly frameCount?: number;
}

/** Lightweight performance/memory snapshot consumed by integration. */
export interface PerformanceReport {
  /** `QUALITY_REPORT_HOOK` — identifies the report shape to sinks. */
  readonly hook: typeof QUALITY_REPORT_HOOK;
  readonly frameCount: number;
  /** The capped pixel ratio; bounds the antialias resolve resolution. */
  readonly effectivePixelRatio: number;
  /** Backing-store pixels ≈ width * height * effectivePixelRatio². */
  readonly canvasPixels: number;
  /** Total meshes in the scene graph (≈ renderable count / draw calls). */
  readonly meshCount: number;
  /** Meshes using three.js InstancedMesh (shared instance matrices). */
  readonly instancedMeshCount: number;
  /** Unique geometries/materials actually referenced by the scene. */
  readonly geometryCount: number;
  readonly materialCount: number;
  /** Mesh references to a geometry/material shared by >= 2 meshes. */
  readonly sharedGeometryCount: number;
  readonly sharedMaterialCount: number;
  /** Fraction of meshes reusing a shared geometry/material (0..1). */
  readonly geometryReuseRatio: number;
  readonly materialReuseRatio: number;
  /** The resolved geometry/material reuse flags from the active config. */
  readonly geometryReuseEnabled: boolean;
  readonly materialReuseEnabled: boolean;
  /** The resolved instancing flag from the active quality config. */
  readonly instancingEnabled: boolean;
  /** Estimated GPU/CPU memory from geometry attribute + material overhead. */
  readonly estimatedMemoryBytes: number;
  /** Human-readable memory label (e.g. "1.8 MB"). */
  readonly memoryLabel: string;
}

/** Constant material overhead included in the memory estimate (textures N/A). */
const MATERIAL_OVERHEAD_BYTES = 1024;
/** Per-instance matrix (16 floats) size used by InstancedMesh. */
const INSTANCE_MATRIX_BYTES = 64;

/**
 * Build a performance/memory report for a composed scene.
 *
 * This is the seeding hook integration attaches: it is deliberately pure and
 * synchronous so it can be called from a frame loop, after an era settle, or
 * from the headless QA walk with identical results.
 *
 * @param scene   the composed scene graph (e.g. `composition.runtime.scene`)
 * @param options viewport + frame-epoch inputs
 * @param config  quality overrides; unresolved fields use high-end defaults
 */
export function createPerformanceReport(
  scene: Object3D,
  options: PerformanceReportOptions = {},
  config: Partial<QualityConfig> = {},
): PerformanceReport {
  const resolved = resolveQualityConfig(config);
  const effectivePixelRatioValue = effectivePixelRatio(options.devicePixelRatio ?? 1, resolved);
  const width = options.width && options.width > 0 ? options.width : 0;
  const height = options.height && options.height > 0 ? options.height : 0;

  const geometryRefs = new Map<string, number>();
  const materialRefs = new Map<string, number>();
  let meshCount = 0;
  let instancedMeshCount = 0;

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount += 1;
    const mesh = object as Mesh & { isInstancedMesh?: boolean };
    if (mesh.isInstancedMesh === true) instancedMeshCount += 1;
    geometryRefs.set(mesh.geometry.uuid, (geometryRefs.get(mesh.geometry.uuid) ?? 0) + 1);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      materialRefs.set(material.uuid, (materialRefs.get(material.uuid) ?? 0) + 1);
    }
  });

  let sharedGeometryCount = 0;
  for (const refs of geometryRefs.values()) if (refs > 1) sharedGeometryCount += refs;
  let sharedMaterialCount = 0;
  for (const refs of materialRefs.values()) if (refs > 1) sharedMaterialCount += refs;

  const estimatedMemoryBytes = estimateSceneMemoryBytes(scene);

  return Object.freeze({
    hook: QUALITY_REPORT_HOOK,
    frameCount: options.frameCount ?? 0,
    effectivePixelRatio: effectivePixelRatioValue,
    canvasPixels: Math.round(width * height * effectivePixelRatioValue * effectivePixelRatioValue),
    meshCount,
    instancedMeshCount,
    geometryCount: geometryRefs.size,
    materialCount: materialRefs.size,
    sharedGeometryCount,
    sharedMaterialCount,
    geometryReuseRatio: meshCount === 0 ? 0 : sharedGeometryCount / meshCount,
    materialReuseRatio: meshCount === 0 ? 0 : sharedMaterialCount / meshCount,
    geometryReuseEnabled: resolved.geometryReuse,
    materialReuseEnabled: resolved.materialReuse,
    instancingEnabled: resolved.instancing,
    estimatedMemoryBytes,
    memoryLabel: formatBytes(estimatedMemoryBytes),
  });
}

/** NaN-safe byte estimator over unique geometry/materials in a scene. */
function estimateSceneMemoryBytes(scene: Object3D): number {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  let instancedMeshCount = 0;
  let instanceCount = 0;

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const mesh = object as Mesh & { isInstancedMesh?: boolean; count?: number };
    if (mesh.isInstancedMesh) {
      instancedMeshCount += 1;
      instanceCount += mesh.count ?? 0;
    }
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of mats) materials.add(mat);
  });

  let bytes = 0;
  for (const geometry of geometries) {
    for (const name of Object.keys(geometry.attributes)) {
      const attribute = geometry.attributes[name];
      bytes += attribute.count * attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
    }
    const index = geometry.index;
    if (index !== null) bytes += index.count * index.array.BYTES_PER_ELEMENT;
  }
  bytes += materials.size * MATERIAL_OVERHEAD_BYTES;
  bytes += instancedMeshCount * INSTANCE_MATRIX_BYTES;
  bytes += instanceCount * INSTANCE_MATRIX_BYTES;
  return bytes;
}

/** Format bytes as a compact human label. */
export function formatBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe >= 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
  if (safe >= 1024) return `${Math.round(safe / 1024)} KB`;
  return `${Math.round(safe)} B`;
}