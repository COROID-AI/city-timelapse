/**
 * `VfxLayer` — the era atmosphere and effects layer.
 *
 * The layer has two halves that share one core:
 *
 * - {@link createVfxController} is the rule-based controller. It resolves an era
 *   into a snapshot (through `./tables`), writes that snapshot into the render
 *   pipeline's public parameter surface, builds the sky dome, haze wall, weather
 *   pools and plume emitters, and advances them from a **caller-supplied clock**.
 *   It needs no React and no renderer, which is what makes it testable.
 * - {@link VfxLayer} is the React component the composed application (and the
 *   layer's own harness page) mounts. It creates the controller against the
 *   enclosing pipeline — passed explicitly or taken from the `<SceneCanvas>`
 *   context — and keeps it in sync with the `era`, `transition`, `clock`,
 *   `plumeSources` and `qualityTier` props. It renders no DOM of its own.
 *
 * The whole layer touches exactly one place in the scene graph: a single root
 * group it adds to the pipeline's public `world` group, and removes again on
 * dispose. Lights, the renderer and the post-processing chain stay the
 * pipeline's business.
 */

import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { Group } from 'three'
import { ERA_REGISTRY } from '../era'
import type { EraId, EraRegistry } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { Seed } from '../lib/rng'
import { ScenePipelineContext, clamp } from '../scene'
import { HAZE_GROUP_NAME, createHazeLayer, HAZE_RADIUS_FRACTION } from './fog'
import { PARTICLE_GROUP_NAME, createParticleSystemSet } from './particles'
import { PLUME_GROUP_NAME, createPlumeSystem } from './plumes'
import { SKY_GROUP_NAME, skyRadiusFor, createSkyDome } from './sky'
import {
  applyEra as applyEraToTarget,
  applyEraTransition as applyTransitionToTarget,
} from './tables'
import type {
  PlumeSources,
  VfxClock,
  VfxContext,
  VfxController,
  VfxLayerOptions,
  VfxSnapshot,
  VfxStats,
  VfxTarget,
  VfxTransitionRequest,
} from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Group name of the layer's scene-graph root. */
export const VFX_ROOT_NAME = 'vfx-root'

/** Largest clock step the simulation accepts, seconds. */
export const MAX_STEP_SECONDS = 0.25

/** Draw distance assumed when the target reports no quality settings. */
export const FALLBACK_DRAW_DISTANCE = 240

/** Groups the layer always creates, in creation order. */
export const VFX_GROUP_NAMES = [
  SKY_GROUP_NAME,
  HAZE_GROUP_NAME,
  PARTICLE_GROUP_NAME,
  PLUME_GROUP_NAME,
] as const

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Direct child count of every named group inside `root`. */
function countGroups(root: Group): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {}
  root.traverse((child) => {
    if (child instanceof Group) {
      counts[child.name === '' ? 'unnamed' : child.name] = child.children.length
    }
  })
  return counts
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Creates the atmosphere controller for a pipeline.
 *
 * The controller is *the* stateful object of the layer: it owns the applied
 * snapshot, the sky/haze/particle/plume structures and the simulation clock
 * bookkeeping. Everything it writes into the pipeline goes through
 * {@link VfxTarget}, so a test can drive it with a recording stub.
 */
export function createVfxController(options: VfxLayerOptions): VfxController {
  const target = options.target
  const registry: EraRegistry = options.registry ?? ERA_REGISTRY
  const reducedMotion = options.reducedMotion === true
  const drawDistance = target.quality?.density.drawDistance ?? FALLBACK_DRAW_DISTANCE
  const skyRadius = skyRadiusFor(drawDistance)

  let context: VfxContext = {
    target,
    registry,
    qualityTier: options.qualityTier,
    seed: options.seed,
    reducedMotion,
  }
  let clock = options.clock ?? { seconds: 0 }
  let lastSeconds = Number.isFinite(clock.seconds) ? clock.seconds : 0
  let frames = 0

  const root = new Group()
  root.name = VFX_ROOT_NAME
  const sky = createSkyDome({ radius: skyRadius })
  const haze = createHazeLayer({ radius: skyRadius * HAZE_RADIUS_FRACTION })
  root.add(sky.object, haze.object)

  // The first applied era defines the initial pools; later era changes reuse
  // them whenever their shape is unchanged (see ParticleSystemSet.setPlan).
  let snapshot: VfxSnapshot = applyEraToTarget(options.era ?? registry.first.id, context)
  const particles = createParticleSystemSet({ plan: snapshot.particles })
  const plumes = createPlumeSystem({ plan: snapshot.plumes, reducedMotion })
  root.add(particles.object, plumes.object)
  if (options.plumeSources !== undefined) {
    plumes.setSources(options.plumeSources)
  }
  sky.apply(snapshot.sky)
  haze.apply(snapshot.fog, particles.weather)
  target.world?.add(root)

  const syncStructures = (next: VfxSnapshot): void => {
    sky.apply(next.sky)
    haze.apply(next.fog, particles.weather)
    particles.setPlan(next.particles)
    plumes.setPlan(next.plumes)
  }

  const adopt = (next: VfxSnapshot): VfxSnapshot => {
    snapshot = next
    syncStructures(next)
    return next
  }

  const publish = (): void => {
    if (options.onStats !== undefined) {
      options.onStats(controller.getStats())
    }
  }

  const advanceTo = (seconds: number): void => {
    const safeSeconds = Number.isFinite(seconds) ? seconds : lastSeconds
    const delta = clamp(safeSeconds - lastSeconds, 0, MAX_STEP_SECONDS)
    lastSeconds = safeSeconds
    if (delta > 0) {
      frames += 1
    }
    sky.setTime(safeSeconds)
    haze.setTime(safeSeconds)
    const weather = particles.step(delta, safeSeconds)
    // The haze wall is the visible half of the wet-surface response.
    haze.apply(snapshot.fog, weather)
    plumes.step(delta, safeSeconds, weather)
    publish()
  }

  const unsubscribe = target.onFrame?.(() => {
    advanceTo(clock.seconds)
  })

  const controller: VfxController = {
    target,
    root,
    sky,
    haze,
    particles,
    plumes,
    get snapshot(): VfxSnapshot {
      return snapshot
    },
    applyEra(eraId: EraId): VfxSnapshot {
      return adopt(applyEraToTarget(eraId, context))
    },
    applyTransition(request: VfxTransitionRequest): VfxSnapshot {
      return adopt(applyTransitionToTarget(request, context))
    },
    setPlumeSources(sources: PlumeSources): void {
      plumes.setSources(sources)
    },
    setClock(next): void {
      clock = next
    },
    setQualityTier(name: QualityTierName): VfxSnapshot {
      context = { ...context, qualityTier: name }
      // Re-resolve the era that is on screen so the new tier's particle budget
      // and effect chain take effect immediately.
      return adopt(applyEraToTarget(snapshot.eraId, context))
    },
    advanceTo,
    getStats(): VfxStats {
      return {
        eraId: snapshot.eraId,
        qualityTier: snapshot.qualityTier,
        clockSeconds: lastSeconds,
        frames,
        particles: particles.stats(),
        plumes: plumes.stats(),
        weather: particles.weather,
        groups: countGroups(root),
      }
    },
    dispose(): void {
      unsubscribe?.()
      particles.dispose()
      plumes.dispose()
      sky.dispose()
      haze.dispose()
      root.removeFromParent()
    },
  }

  return controller
}

/* -------------------------------------------------------------------------- */
/* React component                                                             */
/* -------------------------------------------------------------------------- */

/** Props of the {@link VfxLayer} component. */
export interface VfxLayerProps {
  /** Era to apply; changing it switches the atmosphere. */
  readonly era: EraId
  /**
   * Staged era change. A new object identity applies one step, so a director
   * animating a transition renders a fresh request per frame; `t >= 1` (or
   * `instant: true`) lands exactly on the destination era.
   */
  readonly transition?: VfxTransitionRequest | null
  /** Caller-supplied clock; the layer reads `seconds` when told to advance. */
  readonly clock: VfxClock
  /** Caller-supplied emission events; empty or absent keeps the era baseline. */
  readonly plumeSources?: PlumeSources
  readonly qualityTier?: QualityTierName
  readonly seed?: Seed
  readonly registry?: EraRegistry
  readonly reducedMotion?: boolean
  /** Pipeline to drive; defaults to the enclosing `<SceneCanvas>` pipeline. */
  readonly pipeline?: VfxTarget | null
  /** Called once the controller is live, for imperative callers and harnesses. */
  readonly onReady?: (controller: VfxController) => void
  /** Called after every simulated frame with the layer's statistics. */
  readonly onStats?: (stats: VfxStats) => void
}

/**
 * Mounts the era atmosphere into a render pipeline.
 *
 * Renders nothing: it attaches its structures under the pipeline's `world` group
 * and applies the era's lighting/post-processing values through the pipeline's
 * own setters. Without a pipeline (no `<SceneCanvas>` above it and no `pipeline`
 * prop) it renders nothing and does nothing, so a page can mount it defensively.
 */
export function VfxLayer(props: VfxLayerProps): ReactElement | null {
  const contextPipeline = useContext(ScenePipelineContext)
  const target = props.pipeline ?? contextPipeline
  const { era, transition, clock, plumeSources, qualityTier, seed, registry, reducedMotion } = props

  const controllerRef = useRef<VfxController | null>(null)
  const readyRef = useRef(props.onReady)
  const statsRef = useRef(props.onStats)
  readyRef.current = props.onReady
  statsRef.current = props.onStats

  // Creation-time values are captured once: later prop changes are applied
  // imperatively through the controller so the pools are never needlessly rebuilt.
  const initial = useRef({
    era,
    clock,
    plumeSources,
    qualityTier,
    seed,
    registry,
    reducedMotion,
  })

  useLayoutEffect(() => {
    if (target === null) {
      return undefined
    }
    const controller = createVfxController({
      target,
      era: initial.current.era,
      clock: initial.current.clock,
      plumeSources: initial.current.plumeSources,
      qualityTier: initial.current.qualityTier,
      seed: initial.current.seed,
      registry: initial.current.registry,
      reducedMotion: initial.current.reducedMotion,
      onStats: (stats) => {
        statsRef.current?.(stats)
      },
    })
    controllerRef.current = controller
    readyRef.current?.(controller)
    return () => {
      controllerRef.current = null
      controller.dispose()
    }
  }, [target])

  // The initial era is applied at creation; only later changes land here.
  const eraSettled = useRef(false)
  useEffect(() => {
    if (!eraSettled.current) {
      eraSettled.current = true
      return
    }
    controllerRef.current?.applyEra(era)
  }, [era])

  useEffect(() => {
    if (transition !== null && transition !== undefined) {
      controllerRef.current?.applyTransition(transition)
    }
  }, [transition])

  useEffect(() => {
    controllerRef.current?.setClock(clock)
  }, [clock])

  useEffect(() => {
    if (plumeSources !== undefined) {
      controllerRef.current?.setPlumeSources(plumeSources)
    }
  }, [plumeSources])

  useEffect(() => {
    if (qualityTier !== undefined) {
      controllerRef.current?.setQualityTier(qualityTier)
    }
  }, [qualityTier])

  return null
}

/** Re-exported clock type so consumers can import it beside the component. */
export type { VfxClock } from './types'
