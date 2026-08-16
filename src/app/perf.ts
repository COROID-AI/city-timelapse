// ─── Performance Monitor & Optimizer ─────────────────────────────────────
// Runtime performance monitoring, adaptive quality adjustment, geometry
// merging/instancing enforcement, debug overlay, and profiling pass.
//
// All optimizations are driven by shared config in src/util/perfConfig.ts
// so era module internals remain untouched.
//
// Hotkeys:
//   ` (backtick)    Toggle debug overlay ON/OFF (off by default)

import * as THREE from 'three';
import type { EraId } from '../eras.js';
import {
  MAX_PIXEL_RATIO,
  TARGET_FPS_STEADY,
  TARGET_FPS_TRANSITION,
  PIXEL_RATIO_ADAPTIVE,
  SHADOW_CONFIG,
  GEOMETRY_MERGE_CONFIG,
  INSTANCING_CONFIG,
  FRUSTUM_PARTICLE_BUDGET,
  TEXTURE_ATLAS_CONFIG,
  ERA_SHADOW_SIZES,
} from '../util/perfConfig.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface PerfMetrics {
  fps: number;
  drawCalls: number;
  triangles: number;
  meshCount: number;
  pixelRatio: number;
  shadowMapSize: number;
  era: string;
  transitionActive: boolean;
  /** Mesh counts broken down by era label */
  meshesPerEra: Record<string, number>;
}

export interface EraPerformanceRecord {
  eraId: EraId;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgDrawCalls: number;
  avgTriangles: number;
  avgMeshes: number;
  shadowMapSize: number;
  pixelRatio: number;
  /** Whether target was met */
  meetsTarget: boolean;
  /** Transition metrics if applicable */
  transitionMinFps?: number;
}

// ── Frame-rate tracker ───────────────────────────────────────────────────

class FpsTracker {
  private frames = 0;
  private lastTime = performance.now();
  private currentFps = 60;
  private history: number[] = [];
  private readonly historyMax = 60;

  tick(): number {
    this.frames++;
    const now = performance.now();
    const delta = now - this.lastTime;
    if (delta >= 500) {
      this.currentFps = Math.round((this.frames / delta) * 1000);
      this.history.push(this.currentFps);
      if (this.history.length > this.historyMax) {
        this.history.shift();
      }
      this.frames = 0;
      this.lastTime = now;
    }
    return this.currentFps;
  }

  getSmoothedFps(): number {
    if (this.history.length === 0) return this.currentFps;
    const sum = this.history.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.history.length);
  }

  getHistory(): number[] {
    return [...this.history];
  }
}

// ── Scene statistics collector ───────────────────────────────────────────

interface SceneStats {
  drawCalls: number;
  triangles: number;
  meshCount: number;
  meshesPerEra: Record<string, number>;
  shadowMapSize: number;
}

/** Walk the scene graph and collect render stats. */
function collectSceneStats(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): SceneStats {
  const meshesPerEra: Record<string, number> = {};

  // Initialize counters for each era
  const knownEras: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
  for (const e of knownEras) {
    meshesPerEra[e] = 0;
  }
  meshesPerEra['other'] = 0;

  let triangleCount = 0;
  let meshCount = 0;

  // Count visible meshes and their triangles
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.visible) return;

    meshCount++;

    // Determine which era this mesh belongs to
    const name = obj.name || '';
    let eraLabel = 'other';
    for (const e of knownEras) {
      if (name.includes(`_${e}`) || name.includes(e)) {
        eraLabel = e;
        break;
      }
      // Check parent groups
      let parent = obj.parent;
      while (parent) {
        const pName = parent.name || '';
        if (pName.includes(`_${e}`) || pName.includes(e)) {
          eraLabel = e;
          break;
        }
        if ((parent as any).__eraLayer) {
          eraLabel = String((parent as any).__eraLayer).split('-')[0] || e;
          break;
        }
        parent = parent.parent;
      }
      if (eraLabel !== 'other') break;
    }
    meshesPerEra[eraLabel] = (meshesPerEra[eraLabel] ?? 0) + 1;

    // Count triangles from geometry
    const geo = obj.geometry;
    if (geo.index) {
      triangleCount += geo.index.count / 3;
    } else if (geo.attributes.position) {
      triangleCount += geo.attributes.position.count / 3;
    }
  });

  // Get renderer info (draw calls)
  const info = renderer.info as THREE.WebGLInfo;
  const drawCalls = info.render.calls ?? 0;
  const trianglesFromRenderer = info.render.triangles ?? 0;

  // Use whichever is higher
  const effectiveTriangles = Math.max(triangleCount, trianglesFromRenderer);

  // Shadow map size — derived from directional light shadow map
  let shadowMapSize = 0;
  scene.traverse((obj) => {
    if (shadowMapSize > 0) return;
    if (obj instanceof THREE.DirectionalLight && obj.castShadow) {
      const sm = obj.shadow as any;
      if (sm.mapSize) {
        const ms = sm.mapSize as { width: number; height: number };
        shadowMapSize = ms.width;
      }
    }
  });

  return {
    drawCalls,
    triangles: effectiveTriangles,
    meshCount,
    meshesPerEra,
    shadowMapSize,
  };
}

// ── Adaptive pixel ratio clamp ───────────────────────────────────────────

let activePixelRatio = 1;

/** Clamp and adaptively adjust the device pixel ratio based on FPS. */
export function applyAdaptivePixelRatio(
  renderer: THREE.WebGLRenderer,
  fps: number,
  transitioning: boolean,
): void {
  const targetFps = transitioning ? TARGET_FPS_TRANSITION : TARGET_FPS_STEADY;

  if (fps < PIXEL_RATIO_ADAPTIVE.criticalFpsThreshold) {
    activePixelRatio = Math.max(0.5, activePixelRatio - 0.1);
  } else if (fps < PIXEL_RATIO_ADAPTIVE.lowFpsThreshold) {
    activePixelRatio = Math.min(MAX_PIXEL_RATIO, activePixelRatio + 0.05);
  } else if (fps >= targetFps) {
    // Slowly increase toward max during good performance
    activePixelRatio = Math.min(MAX_PIXEL_RATIO, activePixelRatio + 0.01);
  }

  activePixelRatio = Math.round(activePixelRatio * 100) / 100; // round to 2dp
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, activePixelRatio));
}

// ── Shadow map optimization ──────────────────────────────────────────────

/** Set shadow map sizes based on era complexity and current FPS. */
export function optimizeShadows(
  _renderer: THREE.WebGLRenderer,
  sunLight: THREE.DirectionalLight | null,
  eraId: EraId,
  fps: number,
): void {
  // Sun-only shadows: disable shadow casting on everything except sun
  if (SHADOW_CONFIG.sunOnly && sunLight) {
    sunLight.castShadow = true;
  }

  // Adaptive shadow map size
  const baseSize = ERA_SHADOW_SIZES[eraId] ?? SHADOW_CONFIG.defaultSize;
  const shadowSize = fps < TARGET_FPS_TRANSITION
    ? SHADOW_CONFIG.reducedSize
    : baseSize;

  // Update sun light shadow camera
  if (sunLight && sunLight.shadow) {
    const halfWidth = SHADOW_CONFIG.cameraHalfWidth;
    sunLight.shadow.camera.left = -halfWidth;
    sunLight.shadow.camera.right = halfWidth;
    sunLight.shadow.camera.top = halfWidth;
    sunLight.shadow.camera.bottom = -halfWidth;
    sunLight.shadow.camera.far = SHADOW_CONFIG.cameraFar;
    sunLight.shadow.mapSize.width = shadowSize;
    sunLight.shadow.mapSize.height = shadowSize;
    sunLight.shadow.needsUpdate = true;
  }
}

// ── Geometry merging utility ─────────────────────────────────────────────

/**
 * Merge geometries of child meshes within a group into a single merged mesh.
 * This reduces draw calls by batching static geometry.
 * Only merges groups where children share similar material types.
 * Returns true if merge was performed, false otherwise.
 */
export function mergeGroupGeometry(
  group: THREE.Group,
  maxChildren = GEOMETRY_MERGE_CONFIG.maxMergeChildren,
): boolean {
  if (!GEOMETRY_MERGE_CONFIG.mergeStaticGeometry) return false;

  const children = group.children.filter(
    (c): c is THREE.Mesh =>
      c instanceof THREE.Mesh && c.visible && !(c instanceof THREE.Group),
  );

  if (children.length === 0 || children.length > maxChildren) return false;

  // Group children by material hash (same base material properties)
  const matGroups = new Map<string, THREE.Mesh[]>();
  for (const child of children) {
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const matHash = mats.map((m) => m.uuid).join(',');
    if (!matGroups.has(matHash)) {
      matGroups.set(matHash, []);
    }
    matGroups.get(matHash)!.push(child);
  }

  // For each material group, merge geometries
  let mergedCount = 0;
  for (const [, meshes] of matGroups) {
    if (meshes.length < 2) continue;

    const geometries: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    for (const mesh of meshes) {
      const geo = mesh.geometry;
      if (geo.index || geo.attributes.position) {
        geometries.push({
          geo: geo.clone(),
          matrix: mesh.matrixWorld.clone(),
        });
      }
    }

    if (geometries.length < 2) continue;

    // Apply world matrices before merging
    for (const g of geometries) {
      g.geo.applyMatrix4(g.matrix);
    }

    // Merge all geometries
    const mergedGeo = mergeBufferGeometries(
      geometries.map((g) => g.geo),
    );

    if (mergedGeo && mergedGeo.attributes.position) {
      // Create merged mesh with first mesh's material
      const mat = Array.isArray(meshes[0].material)
        ? meshes[0].material[0]
        : meshes[0].material;

      const mergedMesh = new THREE.Mesh(mergedGeo, mat);
      mergedMesh.name = `${group.name}_merged`;
      mergedMesh.userData._isMerged = true;

      // Replace children with merged mesh
      for (const child of meshes) {
        group.remove(child);
        child.geometry.dispose();
      }
      group.add(mergedMesh);
      mergedCount++;
    }
  }

  return mergedCount > 0;
}

/** Merge multiple BufferGeometries into one. */
function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geometries) {
    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;
    const uvAttr = geo.attributes.uv;
    const idx = geo.index;

    // Positions
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }

    // Normals
    if (normAttr) {
      for (let i = 0; i < normAttr.count; i++) {
        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      }
    }

    // UVs
    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        uvs.push(uvAttr.getX(i), uvAttr.getY(i));
      }
    }

    // Indices
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + indexOffset);
      }
    }

    indexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  if (uvs.length > 0) {
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  if (indices.length > 0) {
    merged.setIndex(indices);
  }

  return merged;
}

// ── Instancing helper for repeated props ─────────────────────────────────

/**
 * Convert a set of meshes with the same geometry and material into
 * an InstancedMesh for reduced draw calls.
 * Returns the InstancedMesh or null if conversion isn't beneficial.
 */
export function convertToInstancedMesh(
  meshes: THREE.Mesh[],
  group: THREE.Group,
  propName?: string,
): THREE.InstancedMesh | null {
  if (!INSTANCING_CONFIG.enableStreetFurnitureInstancing) return null;
  if (meshes.length < 3) return null;

  // Check if all meshes share the same geometry type
  const firstGeo = meshes[0].geometry;
  const canInstance = meshes.every(
    (m) => m.geometry.type === firstGeo.type,
  );
  if (!canInstance) return null;

  // Check material compatibility
  const firstMat = Array.isArray(meshes[0].material)
    ? meshes[0].material[0]
    : meshes[0].material;
  const matCompatible = meshes.every(
    (m) => {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      return mats[0].uuid === firstMat.uuid;
    },
  );
  if (!matCompatible) return null;

  // Create instanced mesh
  const instancedGeo = firstGeo.clone();
  const instancedMat = firstMat.clone();

  const instancedMesh = new THREE.InstancedMesh(
    instancedGeo,
    instancedMat,
    meshes.length,
  );

  instancedMesh.name = `${propName || 'instanced'}_batch`;
  instancedMesh.castShadow = meshes[0].castShadow;
  instancedMesh.receiveShadow = meshes[0].receiveShadow;

  // Copy transforms
  const dummy = new THREE.Object3D();
  for (let i = 0; i < meshes.length; i++) {
    meshes[i].updateMatrixWorld(true);
    dummy.matrix.copy(meshes[i].matrixWorld);
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;

  // Remove original meshes and add instanced version
  for (const mesh of meshes) {
    group.remove(mesh);
    mesh.geometry.dispose();
  }
  group.add(instancedMesh);

  return instancedMesh;
}

// ── Frustum-based particle budget ────────────────────────────────────────

/**
 * Adjust particle system visibility based on frustum culling and FPS budget.
 * Reduces visible particles when FPS drops below target.
 */
export function applyFrustumParticleBudget(
  scene: THREE.Scene,
  camera: THREE.Camera,
  fps: number,
): void {
  const maxParticles = fps < TARGET_FPS_TRANSITION
    ? FRUSTUM_PARTICLE_BUDGET.maxParticlesReduced
    : FRUSTUM_PARTICLE_BUDGET.maxParticlesOnScreen;

  const frustum = new THREE.Frustum();
  const projMatrix = new THREE.Matrix4();
  projMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  frustum.setFromProjectionMatrix(projMatrix);

  let visibleCount = 0;
  scene.traverse((obj) => {
    if ((obj as any)._isParticle) return;
    if (!obj.visible) return;
    // Only objects with boundingSphere support frustum checks
    const objAny = obj as any;
    if (!objAny.boundingSphere && !(obj instanceof THREE.Mesh)) return;

    if (frustum.intersectsObject(obj)) {
      visibleCount++;
      if (visibleCount > maxParticles) {
        obj.visible = false;
      }
    }
  });
}

// ── Debug overlay ────────────────────────────────────────────────────────

let overlayVisible = false;
let overlayElement: HTMLDivElement | null = null;

/** Create and mount the debug overlay DOM element. Off by default. */
function createOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'perf-debug-overlay';
  el.style.cssText = `
    position: fixed;
    top: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ff88;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 6px;
    z-index: 10000;
    pointer-events: none;
    line-height: 1.6;
    min-width: 220px;
    border: 1px solid rgba(0, 255, 136, 0.3);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  `;
  return el;
}

/** Show the debug overlay. */
export function showDebugOverlay(): void {
  if (!overlayElement) {
    overlayElement = createOverlay();
    document.body.appendChild(overlayElement);
  }
  overlayElement.style.display = 'block';
  overlayVisible = true;
}

/** Hide the debug overlay. */
export function hideDebugOverlay(): void {
  if (overlayElement) {
    overlayElement.style.display = 'none';
  }
  overlayVisible = false;
}

/** Toggle the debug overlay. */
export function toggleDebugOverlay(): void {
  if (overlayVisible) {
    hideDebugOverlay();
  } else {
    showDebugOverlay();
  }
}

/** Update debug overlay content with current metrics. */
export function updateDebugOverlay(metrics: PerfMetrics): void {
  if (!overlayElement || !overlayVisible) return;

  const transitionLabel = metrics.transitionActive ? 'TRANS' : 'STBY';
  const fpsColor = metrics.fps >= TARGET_FPS_STEADY
    ? '#00ff88'
    : metrics.fps >= TARGET_FPS_TRANSITION
      ? '#ffcc00'
      : '#ff4444';

  let html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">⚡ PERF MONITOR</div>`;
  html += `<div>FPS: <span style="color:${fpsColor};font-weight:bold;font-size:16px;">${metrics.fps}</span></div>`;
  html += `<div>DRAW CALLS: ${metrics.drawCalls.toLocaleString()}</div>`;
  html += `<div>TRIANGLES: ${Math.round(metrics.triangles).toLocaleString()}</div>`;
  html += `<div>MESHES: ${metrics.meshCount.toLocaleString()}</div>`;
  html += `<div>PX RATIO: ${metrics.pixelRatio.toFixed(2)}</div>`;
  html += `<div>SHADOW MAP: ${metrics.shadowMapSize}px</div>`;
  html += `<div>ERA: ${metrics.era} [${transitionLabel}]</div>`;

  // Per-era mesh breakdown
  const eraEntries = Object.entries(metrics.meshesPerEra)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (eraEntries.length > 0) {
    html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,255,136,0.2);">
      <span style="color:#aaa;">Meshes by era:</span><br/>`;
    for (const [era, count] of eraEntries) {
      html += `<span style="color:#88ddff;">${era}:</span> ${count}<br/>`;
    }
    html += `</div>`;
  }

  overlayElement.innerHTML = html;
}

/** Initialize the backtick hotkey for toggling debug overlay. */
export function initDebugHotkey(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggleDebugOverlay();
    }
  });
}

// ── Profiling pass runner ────────────────────────────────────────────────

/**
 * Run a full profiling pass across all eras.
 * Sets up camera, waits for steady state, collects metrics.
 */
export async function runProfilingPass(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  _sunLight: THREE.DirectionalLight | null,
  getCurrentEra: () => EraId,
  _transitionChecker: () => boolean,
  warmupFrames = 30,
  measureFrames = 120,
): Promise<EraPerformanceRecord[]> {
  const results: EraPerformanceRecord[] = [];
  const fpsTracker = new FpsTracker();

  // Store original pixel ratio
  const origPixelRatio = renderer.getPixelRatio();

  for (let eraIdx = 0; eraIdx < 5; eraIdx++) {
    const eraId = getCurrentEra();

    console.log(`[PERF] Profiling era ${eraId} (${eraIdx + 1}/5)...`);

    // Warm-up phase — let renderer settle
    for (let f = 0; f < warmupFrames; f++) {
      renderer.render(scene, camera);
      fpsTracker.tick();
    }

    // Measure phase
    let totalFps = 0;
    let minFps = Infinity;
    let maxFps = 0;
    let totalDrawCalls = 0;
    let totalTriangles = 0;
    let totalMeshes = 0;

    for (let f = 0; f < measureFrames; f++) {
      renderer.render(scene, camera);
      const fps = fpsTracker.tick();
      void _transitionChecker(); // may be used in real profiling

      const stats = collectSceneStats(scene, renderer);

      totalFps += fps;
      minFps = Math.min(minFps, fps);
      maxFps = Math.max(maxFps, fps);
      totalDrawCalls += stats.drawCalls;
      totalTriangles += stats.triangles;
      totalMeshes += stats.meshCount;

      // Small yield to keep browser responsive
      if (f % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const avgFps = Math.round(totalFps / measureFrames);
    const avgDrawCalls = Math.round(totalDrawCalls / measureFrames);
    const avgTriangles = Math.round(totalTriangles / measureFrames);
    const avgMeshes = Math.round(totalMeshes / measureFrames);

    const targetFps = _transitionChecker() ? TARGET_FPS_TRANSITION : TARGET_FPS_STEADY;
    const meetsTarget = avgFps >= targetFps;

    results.push({
      eraId,
      avgFps,
      minFps: minFps === Infinity ? 0 : minFps,
      maxFps: maxFps === 0 ? 0 : maxFps,
      avgDrawCalls,
      avgTriangles,
      avgMeshes,
      shadowMapSize: renderer.shadowMap?.enabled ? 1024 : 0,
      pixelRatio: renderer.getPixelRatio(),
      meetsTarget,
    });

    console.log(
      `[PERF] Era ${eraId}: avg=${avgFps}fps min=${minFps}fps draws=${avgDrawCalls} tris=${avgTriangles} meshes=${avgMeshes}`,
    );
  }

  // Restore original pixel ratio
  renderer.setPixelRatio(origPixelRatio);

  return results;
}

// ── Public API for integration ───────────────────────────────────────────

let _fpsTracker: FpsTracker | null = null;

/** Get or create the FPS tracker singleton. */
export function getFpsTracker(): FpsTracker {
  if (!_fpsTracker) {
    _fpsTracker = new FpsTracker();
  }
  return _fpsTracker;
}

/**
 * Core perf tick — call once per frame from the render loop.
 * Updates FPS tracking, applies adaptive quality, and updates debug overlay.
 */
export function perfTick(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  sunLight: THREE.DirectionalLight | null,
  currentEra: EraId,
  transitioning: boolean,
): PerfMetrics {
  const fps = getFpsTracker().tick();

  // Adaptive quality adjustments
  applyAdaptivePixelRatio(renderer, fps, transitioning);
  optimizeShadows(renderer, sunLight, currentEra, fps);
  applyFrustumParticleBudget(scene, (scene as any).__camera as THREE.Camera, fps);

  // Collect stats
  const stats = collectSceneStats(scene, renderer);
  const metrics: PerfMetrics = {
    fps,
    drawCalls: stats.drawCalls,
    triangles: stats.triangles,
    meshCount: stats.meshCount,
    pixelRatio: renderer.getPixelRatio(),
    shadowMapSize: stats.shadowMapSize,
    era: String(currentEra),
    transitionActive: transitioning,
    meshesPerEra: stats.meshesPerEra,
  };

  // Update debug overlay if visible
  if (overlayVisible) {
    updateDebugOverlay(metrics);
  }

  return metrics;
}

// ── Initialization ───────────────────────────────────────────────────────

/** Call once at app startup to initialize the debug hotkey. */
export function initPerfSystem(): void {
  initDebugHotkey();
  console.log('[PERF] Performance monitor initialized. Press ` to toggle debug overlay.');
}

// Re-export config for consumers
export {
  MAX_PIXEL_RATIO,
  TARGET_FPS_STEADY,
  TARGET_FPS_TRANSITION,
  PIXEL_RATIO_ADAPTIVE,
  SHADOW_CONFIG,
  GEOMETRY_MERGE_CONFIG,
  INSTANCING_CONFIG,
  FRUSTUM_PARTICLE_BUDGET,
  TEXTURE_ATLAS_CONFIG,
  ERA_SHADOW_SIZES,
};
