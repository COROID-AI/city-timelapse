/**
 * Debug surface: the machine-readable view of the composed experience.
 *
 * Automated verification (the browser suite, manual QA, the frame inspector)
 * needs one stable place to read "what is on screen right now" without digging
 * through React internals or three.js objects. This module publishes exactly
 * that: era id and year, the layer mount list with per-layer object/draw counts,
 * the audio bed the engine is playing, the camera state, the transition's own
 * progress and the inspection-target summary.
 *
 * It is **development only**. {@link installDebugSurface} attaches the handle to
 * `window` when Vite reports a dev build and does nothing in a production
 * bundle, so shipped pages carry neither the global nor the snapshot it holds.
 *
 * The same module also owns the dev-only fault injection the fallback checks
 * use: setting `window.__cityTimelapseForceFailure = 'storefronts'` before load
 * makes the composition fail that layer's era build, which is how the browser
 * suite proves the layer-failure path without breaking real code.
 */

import type { CameraState, FrameStats } from '../scene'
import type { EraId } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { AudioBridgeState } from './audioBridge'

/** Query flag a dev build reads to hold the composition in its loading state. */
export const HOLD_LOADING_FLAG = 'hold'

/** Value of {@link HOLD_LOADING_FLAG} that keeps the composition deferred. */
export const HOLD_LOADING_VALUE = 'loading'

/** Shape version, so a stale snapshot is recognisable. */
export const DEBUG_SURFACE_VERSION = 1

/**
 * True when the running bundle is a development build.
 *
 * `import.meta.env.DEV` is replaced at build time, so in a production bundle
 * this is the literal `false`: the platform collapses the branch that creates
 * the surface, and with it the handle, the snapshot type and the global name.
 * That is what makes "absent in production" a property of the bundle rather than
 * a promise about a runtime check.
 */
export const DEBUG_BUILD: boolean = import.meta.env.DEV === true

/**
 * Global name the debug handle is published under.
 *
 * Empty in a production bundle, where the name is never emitted at all — so
 * "the debug surface is absent in production" is checkable by grepping the
 * bundle for it instead of trusting a runtime branch.
 */
export const DEBUG_SURFACE_KEY: string = DEBUG_BUILD ? '__cityTimelapse' : ''

/** Global a dev build reads to fail one layer on purpose (empty in production). */
export const FORCED_FAILURE_KEY: string = DEBUG_BUILD ? '__cityTimelapseForceFailure' : ''

/** How one layer appears on the debug surface. */
export interface LayerDebugRecord {
  /** Layer slot id (`layout`, `atmosphere`, `storefronts`, `props`, …). */
  readonly id: string
  readonly label: string
  /** False for a scheduled stage whose barrel is not shipped in this revision. */
  readonly mounted: boolean
  readonly kind: 'layout' | 'atmosphere' | 'layer' | 'pending'
  readonly eraId: EraId | null
  /** How many times this layer was mounted; always 1 for a mounted layer. */
  readonly mounts: number
  readonly qualityTier: QualityTierName
  /** Object3D count under the layer's root group. */
  readonly objects: number
  readonly meshes: number
  readonly instancedMeshes: number
  /** Instances across every instanced mesh (vehicles, props, crowds). */
  readonly instances: number
  readonly lights: number
  readonly triangles: number
  /** Layer-specific counters (sign meshes, parked vehicles, plume emitters, …). */
  readonly stats: Readonly<Record<string, number>>
}

/** Transition report of the debug surface. */
export interface DebugTransitionRecord {
  readonly active: boolean
  readonly fromEra: EraId
  readonly toEra: EraId
  readonly progress: number
  readonly frames: number
  readonly reducedMotion: boolean
  readonly retargetCount: number
  readonly registeredLayers: readonly string[]
  readonly pendingStages: readonly string[]
  readonly cameraUnchanged: boolean
  readonly cameraRestorations: number
  readonly crossfades: number
  readonly cueIds: readonly string[]
  readonly lastCompletionFrames: number | null
}

/** Inspection summary of the debug surface. */
export interface DebugInspectionRecord {
  readonly eraId: EraId
  readonly year: number
  readonly count: number
  readonly anchorCount: number
  readonly objectCount: number
  readonly categories: readonly string[]
  readonly layers: readonly string[]
}

/** Loading state of the composition. */
export interface DebugLoadingRecord {
  readonly ready: boolean
  readonly completed: number
  readonly total: number
  readonly steps: readonly { readonly id: string; readonly label: string; readonly done: boolean }[]
  readonly failedLayer: string | null
}

/** The full snapshot published to the debug surface. */
export interface DebugSnapshot {
  readonly version: number
  readonly builtAtSeconds: number
  readonly clockSeconds: number
  readonly frame: number
  readonly fps: number
  readonly frameTimeMs: number
  readonly eraId: EraId
  readonly year: number
  readonly eraLabel: string
  readonly fromEra: EraId
  readonly toEra: EraId
  readonly progress: number
  readonly transitioning: boolean
  readonly qualityTier: QualityTierName
  readonly layerOrder: readonly string[]
  readonly mountedLayers: readonly string[]
  readonly pendingLayers: readonly string[]
  readonly layers: readonly LayerDebugRecord[]
  readonly audio: AudioBridgeState | null
  readonly camera: CameraState
  readonly inspection: DebugInspectionRecord
  readonly transition: DebugTransitionRecord
  readonly loading: DebugLoadingRecord
}

/** The handle published on `window`. */
export interface DebugSurfaceHandle {
  readonly version: number
  /** True when the surface is attached (dev builds only). */
  readonly enabled: boolean
  /** Latest snapshot, or null before the first publish. */
  readonly latest: DebugSnapshot | null
  publish(snapshot: DebugSnapshot): void
  read(): DebugSnapshot | null
  clear(): void
  /** Subscribes to every publish; returns the unsubscribe function. */
  subscribe(listener: (snapshot: DebugSnapshot) => void): () => void
}

/** Environment slice the gate reads, so tests can override it. */
export interface DebugEnvironment {
  readonly DEV?: boolean
  readonly PROD?: boolean
  readonly MODE?: string
}

/** Vite environment, narrowed to the fields the gate needs. */
function currentEnvironment(): DebugEnvironment {
  return import.meta.env as unknown as DebugEnvironment
}

/**
 * True when the debug surface may be attached.
 *
 * Development only: a production bundle reports `PROD === true`, and the global
 * is never created there.
 */
export function isDebugSurfaceEnabled(environment: DebugEnvironment = currentEnvironment()): boolean {
  if (environment.PROD === true) {
    return false
  }
  if (environment.DEV === true) {
    return true
  }
  return environment.MODE === 'development'
}

/** Creates the surface; when disabled it stays inert but safe to call. */
export function createDebugSurface(
  options: { readonly enabled?: boolean; readonly environment?: DebugEnvironment } = {},
): DebugSurfaceHandle {
  const enabled = options.enabled ?? isDebugSurfaceEnabled(options.environment)
  const listeners = new Set<(snapshot: DebugSnapshot) => void>()
  let latest: DebugSnapshot | null = null

  return {
    version: DEBUG_SURFACE_VERSION,
    enabled,
    get latest(): DebugSnapshot | null {
      return latest
    },
    publish(snapshot: DebugSnapshot): void {
      if (!enabled) {
        return
      }
      latest = snapshot
      for (const listener of listeners) {
        listener(snapshot)
      }
    },
    read(): DebugSnapshot | null {
      return latest
    },
    clear(): void {
      latest = null
    },
    subscribe(listener: (snapshot: DebugSnapshot) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * Attaches the handle to a global object (defaults to `window`).
 *
 * Returns the detach function; a disabled surface installs nothing at all, which
 * is what keeps the production page free of the global.
 */
export function installDebugSurface(
  surface: DebugSurfaceHandle,
  target?: Record<string, unknown>,
): () => void {
  if (!surface.enabled) {
    return () => {}
  }
  const host =
    target ?? (typeof window === 'undefined' ? undefined : (window as unknown as Record<string, unknown>))
  if (host === undefined) {
    return () => {}
  }
  host[DEBUG_SURFACE_KEY] = surface
  return () => {
    if (host[DEBUG_SURFACE_KEY] === surface) {
      delete host[DEBUG_SURFACE_KEY]
    }
  }
}

/**
 * Layer the composition must fail on purpose, or null.
 *
 * Development only, and only when the page (a browser check) has set the global
 * documented in {@link FORCED_FAILURE_KEY}; production ignores it entirely.
 */
export function forcedFailureLayer(
  environment: DebugEnvironment = currentEnvironment(),
): string | null {
  if (!isDebugSurfaceEnabled(environment) || typeof window === 'undefined') {
    return null
  }
  const value = (window as unknown as Record<string, unknown>)[FORCED_FAILURE_KEY]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Reads one query-string diagnostic flag, in development only.
 *
 * The browser checks use it to observe states a healthy page passes through too
 * quickly to catch — `?hold=loading` keeps the composition in its loading state.
 * Production builds return null for every flag, so no shipped URL can change the
 * experience.
 */
export function devUrlFlag(
  name: string,
  environment: DebugEnvironment = currentEnvironment(),
): string | null {
  if (!isDebugSurfaceEnabled(environment) || typeof window === 'undefined') {
    return null
  }
  try {
    return new URLSearchParams(window.location.search).get(name)
  } catch {
    return null
  }
}

/** Counts read off one live three.js subtree. */
export interface SceneObjectCounts {
  readonly objects: number
  readonly meshes: number
  readonly instancedMeshes: number
  readonly instances: number
  readonly lights: number
  readonly triangles: number
}

/**
 * Counts objects, meshes, instances, lights and triangles under a root.
 *
 * The composition calls this when it publishes a snapshot, so "per-layer object
 * and draw counts" are measured from the real scene graph rather than tracked in
 * a parallel table. Instanced meshes count their instances (and their triangles
 * as `instanceCount × triangleCount`), which is what makes a vehicle or props
 * layer line up with what the renderer issues.
 */
export function countSceneObjects(root: {
  traverse(callback: (object: unknown) => void): void
}): SceneObjectCounts {
  let objects = 0
  let meshes = 0
  let instancedMeshes = 0
  let instances = 0
  let lights = 0
  let triangles = 0

  root.traverse((value) => {
    objects += 1
    const object = value as {
      readonly isMesh?: boolean
      readonly isInstancedMesh?: boolean
      readonly isLight?: boolean
      readonly count?: number
      geometry?: {
        readonly index?: { readonly count: number } | null
        readonly attributes?: { readonly position?: { readonly count: number } }
      }
    }
    if (object.isLight === true) {
      lights += 1
    }
    if (object.isMesh !== true) {
      return
    }
    meshes += 1
    const positionCount = object.geometry?.attributes?.position?.count ?? 0
    const vertexCount = object.geometry?.index?.count ?? positionCount
    const geometryTriangles = Math.floor(vertexCount / 3)
    if (object.isInstancedMesh === true) {
      instancedMeshes += 1
      const instanceCount = object.count ?? 0
      instances += instanceCount
      triangles += geometryTriangles * instanceCount
      return
    }
    triangles += geometryTriangles
  })

  return { objects, meshes, instancedMeshes, instances, lights, triangles }
}

/** Draw-call style summary of the latest frame, for the surface's fps fields. */
export function frameSummary(stats: FrameStats | null): {
  readonly frame: number
  readonly fps: number
  readonly frameTimeMs: number
} {
  if (stats === null) {
    return { frame: 0, fps: 0, frameTimeMs: 0 }
  }
  return {
    frame: stats.frames,
    fps: Number.isFinite(stats.fps) ? stats.fps : 0,
    frameTimeMs: Number.isFinite(stats.averageFrameTimeMs) ? stats.averageFrameTimeMs : 0,
  }
}
