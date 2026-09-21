/**
 * React host of the pedestrian layer.
 *
 * Thin by construction: it builds one {@link CrowdSceneObject} for the era (or
 * the resolved frame of a staged change), mounts its group, re-poses it whenever
 * the caller's simulation clock changes, and disposes every buffer on unmount.
 * The layer never reads a wall clock, so a harness page and the composed
 * application animate identically from the same `clock` prop.
 */

import { useEffect, useMemo, type ReactElement } from 'react'
import { DEFAULT_ERA_ID, type EraId } from '../../era'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'
import type { BlockLayout } from '../layout'
import { applyEraTransition, applyEra } from './crowd'
import { createCrowdSceneObject, type CrowdSceneObject } from './bodies'
import type { PedestrianContext, PedestrianTransitionInput } from './types'

/** Props of the {@link PedestriansLayer} component. */
export interface PedestriansLayerProps {
  /** Frozen block whose sidewalk splines and crosswalks carry the crowd. */
  readonly layout: BlockLayout
  /** Era to show when no transition is in flight. */
  readonly eraId?: EraId
  /** Staged era change; wins over {@link eraId} while present. */
  readonly transition?: PedestrianTransitionInput
  readonly seed?: Seed
  readonly quality?: QualityTierName
  readonly night?: boolean
  readonly reducedMotion?: boolean
  /** Simulation clock reading, in seconds. */
  readonly clock?: number
  /** Called with the live scene object, or `null` once it is disposed. */
  readonly onSceneReady?: (scene: CrowdSceneObject | null) => void
}

/** React host that mounts one era's crowd inside a react-three-fiber scene. */
export function PedestriansLayer(props: PedestriansLayerProps): ReactElement {
  const {
    layout,
    eraId = DEFAULT_ERA_ID,
    transition,
    seed,
    quality,
    night,
    reducedMotion,
    clock = 0,
    onSceneReady,
  } = props

  const context = useMemo<PedestrianContext>(
    () => ({
      layout,
      ...(quality === undefined ? {} : { qualityTier: quality }),
      ...(seed === undefined ? {} : { seed }),
      ...(night === undefined ? {} : { night }),
      ...(reducedMotion === undefined ? {} : { reducedMotion }),
    }),
    [layout, quality, seed, night, reducedMotion],
  )

  const plan = useMemo(
    () =>
      transition === undefined
        ? applyEra(eraId, context)
        : applyEraTransition(transition, context).plan,
    [eraId, transition, context],
  )

  const scene = useMemo(() => createCrowdSceneObject(plan, { layout }), [plan, layout])

  useEffect(() => {
    onSceneReady?.(scene)
    return () => {
      onSceneReady?.(null)
      scene.dispose()
    }
  }, [scene, onSceneReady])

  useEffect(() => {
    scene.update(clock)
  }, [scene, clock])

  return <primitive object={scene.root} name="era-pedestrians" />
}
