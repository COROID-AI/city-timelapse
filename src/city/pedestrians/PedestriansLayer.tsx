/**
 * react-three-fiber binding of the era crowd.
 *
 * The component is deliberately thin: `crowd.ts` owns placement, walk cycles,
 * era blending and the instanced payload, and this file uploads that payload to
 * a pool of `InstancedMesh` objects — one per shared geometry, with per-instance
 * colour carrying the era palette. Nothing here knows about years, garments or
 * gaits, so the layer can be mounted by the composed scene, by the transition
 * director and by its own harness page without any of them owning its internals.
 *
 * ```tsx
 * const handle = usePedestrianLayer({ eraId: '1985' })
 * <Canvas><PedestriansLayer handle={handle} clock={clock} /></Canvas>
 * ```
 *
 * The clock is caller-supplied: pass `{ now: () => seconds }` to drive the crowd
 * from a simulated clock (as the harness page does) or omit it to advance by
 * frame delta times `timeScale`.
 */

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type ReactElement } from 'react'
import * as THREE from 'three'
import {
  CANONICAL_LAYOUT_SEED,
  type CityLayout,
} from '../layout'
import { DEFAULT_QUALITY_TIER } from '../../lib/quality'
import {
  advanceCrowd,
  applyEra,
  collectInstances,
  createInstancePool,
  createPedestrianLayer,
  crowdTimeSeconds,
  pedestrianPlacement,
  seekCrowd,
} from './crowd'
import {
  createCostumeMaterial,
  createCostumeMesh,
  disposeCostumeMesh,
  type CostumeMesh,
} from './outfits'
import type {
  CrowdInstanceEntry,
  InstancePool,
} from './crowd'
import type { EraId } from '../../era'
import type {
  EraBlend,
  PedestrianLayerHandle,
  PedestrianLayerOptions,
} from './types'

/** A caller-supplied clock: monotonic simulated seconds. */
export interface PedestrianClock {
  now(): number
}

/** What the layer reports to its host after each frame. */
export interface CrowdFrameStats {
  readonly eraId: EraId
  readonly blend: EraBlend | null
  readonly timeSeconds: number
  readonly pedestrians: number
  readonly instances: number
  /** Instanced meshes drawn this frame. */
  readonly drawCalls: number
  /** Triangles submitted this frame. */
  readonly triangles: number
  readonly lodCounts: readonly [number, number, number]
  /** Visible pedestrians whose root projects inside the camera frustum. */
  readonly onScreen: number
}

/** Props of {@link PedestriansLayer}. */
export interface PedestriansLayerProps {
  /** Handle created by `createPedestrianLayer` or {@link usePedestrianLayer}. */
  readonly handle: PedestrianLayerHandle
  /** Simulated clock to follow; when omitted the frame delta drives the crowd. */
  readonly clock?: PedestrianClock
  /** Speed multiplier of the frame-delta clock. */
  readonly timeScale?: number
  /** When false the crowd holds its state and only re-renders. */
  readonly animate?: boolean
  /**
   * Reduced-motion viewers get one clean era switch: a staged blend is applied
   * instantly instead of cross-dressing the crowd frame by frame.
   */
  readonly reducedMotion?: boolean
  /** Per-frame report, used by the harness page and by instrumentation. */
  readonly onFrame?: (stats: CrowdFrameStats) => void
}

/** Longest frame delta the layer accepts, in seconds, to survive tab switches. */
export const MAX_FRAME_DELTA_SECONDS = 0.25

/**
 * Mounts the crowd as pooled instanced meshes.
 *
 * Every frame the crowd is stepped (or seeked to the supplied clock), the render
 * payload is collected and each pooled mesh gets its instance count and buffer
 * flags — no per-frame allocation, no per-pedestrian geometry.
 */
export function PedestriansLayer({
  handle,
  clock,
  timeScale = 1,
  animate = true,
  reducedMotion = false,
  onFrame,
}: PedestriansLayerProps): ReactElement {
  const group = useMemo(() => {
    const root = new THREE.Group()
    root.name = 'era-pedestrians'
    return root
  }, [])
  const pool = useMemo<InstancePool>(() => createInstancePool(), [])
  const material = useMemo(() => createCostumeMaterial(), [])
  const costumes = useMemo(() => new Map<string, CostumeMesh>(), [])
  const projection = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    return () => {
      for (const costume of costumes.values()) {
        group.remove(costume.mesh)
        disposeCostumeMesh(costume)
      }
      costumes.clear()
      material.dispose()
    }
  }, [costumes, group, material])

  useFrame((state, delta) => {
    const crowd = handle.crowd
    if (reducedMotion && crowd.blend !== null) {
      applyEra(crowd.blend.to, handle)
    }

    if (animate) {
      if (clock === undefined) {
        advanceCrowd(crowd, Math.min(Math.max(delta, 0), MAX_FRAME_DELTA_SECONDS) * timeScale)
      } else {
        seekCrowd(crowd, clock.now())
      }
    }

    const collected = collectInstances(crowd, {
      tier: handle.tier,
      cameraPosition: {
        x: state.camera.position.x,
        y: state.camera.position.y,
        z: state.camera.position.z,
      },
      pool,
    })

    for (const entry of collected.entries) {
      registerCostume(costumes, group, entry, material)
    }
    for (const costume of costumes.values()) {
      const entry = pool.entries.get(costume.geometryKey)
      const count = entry === undefined ? 0 : entry.count
      const mesh = costume.mesh
      if (mesh.count !== count) {
        mesh.count = count
      }
      mesh.visible = count > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor !== null) {
        mesh.instanceColor.needsUpdate = true
      }
    }

    onFrame?.({
      eraId: crowd.eraId,
      blend: crowd.blend,
      timeSeconds: crowdTimeSeconds(crowd),
      pedestrians: collected.pedestrians,
      instances: collected.instances,
      drawCalls: collected.drawCalls,
      triangles: collected.triangles,
      lodCounts: collected.lodCounts,
      onScreen: countOnScreen(handle, state.camera, projection),
    })
  })

  return <primitive object={group} />
}

/**
 * Counts visible pedestrians the camera can actually see.
 *
 * Reported with the frame so a host (and the browser harness) can tell the
 * difference between "the crowd exists" and "the crowd is in shot", which is
 * what makes a per-era screenshot evidence of the era rather than of the sky.
 */
function countOnScreen(
  handle: PedestrianLayerHandle,
  camera: THREE.Camera,
  scratch: THREE.Vector3,
): number {
  let onScreen = 0
  for (const pedestrian of handle.crowd.pedestrians) {
    if (!pedestrian.visible) {
      continue
    }
    const placement = pedestrianPlacement(handle.crowd, pedestrian)
    scratch.set(placement.position.x, placement.position.y + 0.9, placement.position.z)
    scratch.project(camera)
    if (scratch.x >= -1 && scratch.x <= 1 && scratch.y >= -1 && scratch.y <= 1 && scratch.z <= 1) {
      onScreen += 1
    }
  }
  return onScreen
}

/** Adds a pooled mesh the first time a geometry appears in the payload. */
function registerCostume(
  costumes: Map<string, CostumeMesh>,
  group: THREE.Group,
  entry: CrowdInstanceEntry,
  material: THREE.Material,
): CostumeMesh {
  const existing = costumes.get(entry.geometryKey)
  if (existing !== undefined) {
    return existing
  }
  const costume = createCostumeMesh(
    entry.geometryKey,
    entry.shape,
    entry.capacity,
    material,
    entry.matrices,
    entry.colours,
  )
  costumes.set(entry.geometryKey, costume)
  group.add(costume.mesh)
  return costume
}

/**
 * Creates and owns a crowd handle for the lifetime of a component.
 *
 * The arena is rebuilt only when the block, the seed or the tier change; era
 * changes go through `applyEra`, so the same people keep walking when the
 * timeline moves.
 */
export function usePedestrianLayer(options: PedestrianLayerOptions = {}): PedestrianLayerHandle {
  const layout: CityLayout | undefined = options.layout
  const seed = String(options.seed ?? CANONICAL_LAYOUT_SEED)
  const tier = options.tier ?? DEFAULT_QUALITY_TIER
  const eraId = options.eraId

  const handle = useMemo(
    () => createPedestrianLayer({ layout, seed, tier }),
    [layout, seed, tier],
  )

  useEffect(() => {
    if (eraId !== undefined && handle.crowd.eraId !== eraId) {
      applyEra(eraId, handle)
    }
  }, [eraId, handle])

  return handle
}
