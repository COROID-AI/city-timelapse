/**
 * React host of the vehicle layer.
 *
 * The component is deliberately thin: it owns a {@link VehicleLayer} (or takes
 * one the harness already created), applies era changes through the barrel's
 * `applyEra` / `applyEraTransition`, keeps one instanced three.js scene for the
 * current plan, and writes the clock's poses into the instance matrices each
 * time the caller's simulation clock changes. All motion stays a pure function
 * of that clock, so a harness page can drive the layer without a renderer at
 * all and this component can mount the very same data.
 */

import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { DEFAULT_ERA_ID, type EraId } from '../../era'
import type { Seed } from '../../lib/rng'
import { createVehicleSceneObject, type VehicleSceneObject } from './models'
import { applyEra, applyEraTransition, createVehicleLayer, planSignature } from './traffic'
import type { EraTransitionInput, LayoutReference, SfxTriggerListener, VehicleLayer } from './types'

export interface VehiclesLayerProps {
  /** Real block layout: its vehicle splines and parking anchors drive the layer. */
  readonly layout: LayoutReference
  /** Era to render when no transition is in flight. */
  readonly eraId?: EraId
  /** Staged era change; while present it wins over {@link eraId}. */
  readonly transition?: EraTransitionInput
  /** Simulation clock reading, in seconds; the layer never reads a wall clock. */
  readonly clock?: number
  readonly seed?: Seed
  readonly quality?: string | null
  /** Reduced motion: era switches apply instantly instead of blending. */
  readonly reducedMotion?: boolean
  /** Audio owner's sink for horn, engine, bell, whine and squeal triggers. */
  readonly onSfxTrigger?: SfxTriggerListener
  /** Existing layer to drive; one is created when this is omitted. */
  readonly layer?: VehicleLayer
  /** Mounted scene, for hosts and QA that count instances: `null` when disposed. */
  readonly onSceneReady?: (scene: VehicleSceneObject | null) => void
}

export function VehiclesLayer(props: VehiclesLayerProps): ReactElement {
  const {
    layout,
    eraId = DEFAULT_ERA_ID,
    transition,
    clock = 0,
    seed,
    quality,
    reducedMotion,
    onSfxTrigger,
    layer: providedLayer,
    onSceneReady,
  } = props

  const createdRef = useRef<VehicleLayer | null>(null)
  if (providedLayer === undefined && createdRef.current === null) {
    createdRef.current = createVehicleLayer({
      layout,
      eraId,
      seed,
      quality,
      reducedMotion,
      onSfxTrigger,
      clockSec: clock,
    })
  }
  const layer = providedLayer ?? createdRef.current
  if (layer === null) {
    throw new Error('VehiclesLayer could not create a vehicle layer')
  }

  // Era changes flow through the barrel's documented entry points, so the layer
  // never grows a second, private way of switching periods.
  const transitionFrom = transition?.from
  const transitionTo = transition?.to
  const transitionProgress = transition?.t
  useEffect(() => {
    const context = { layout, seed, quality: quality ?? undefined, reducedMotion, target: layer }
    if (transitionFrom !== undefined && transitionTo !== undefined && transitionProgress !== undefined) {
      applyEraTransition({ from: transitionFrom, to: transitionTo, t: transitionProgress }, context)
      return
    }
    applyEra(eraId, context)
  }, [layer, layout, seed, quality, reducedMotion, eraId, transitionFrom, transitionTo, transitionProgress])

  const signature = planSignature(layer.plan)
  const scene = useMemo<VehicleSceneObject>(
    () =>
      createVehicleSceneObject({
        plan: layer.plan,
        fleet: layer.fleet,
        parked: layer.parked,
        markings: layer.markings,
      }),
    // The signature captures every plan field the meshes depend on; the fleet
    // counts change with every plan the layer applies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer, signature, layer.movingCount, layer.parkedCount],
  )

  useEffect(() => () => scene.dispose(), [scene])

  useEffect(() => {
    onSceneReady?.(scene)
    return () => onSceneReady?.(null)
  }, [scene, onSceneReady])

  useEffect(() => {
    scene.update(layer.poseAt(clock))
    layer.setClock(clock)
  }, [scene, layer, clock])

  return <primitive object={scene.root} name="era-vehicles" />
}

/** Export for harness pages that mount the scene object themselves. */
export type { VehicleSceneObject }
