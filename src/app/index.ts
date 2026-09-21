/**
 * The composed city-block experience.
 *
 * This module is the one place where every consumed contract meets: the frozen
 * block layout, the six era content layers, the atmosphere, the audio engine,
 * the era store, the ui-controls store and the staged transition director. It
 * owns the composition files only and reaches into every other module through
 * its barrel.
 *
 * What it builds
 * --------------
 * One mount per layer, inside the render pipeline's `world` group, in the
 * documented order:
 *
 * | slot          | contract               | how it is driven                     |
 * | ------------- | ---------------------- | ------------------------------------ |
 * | `layout`      | `src/city/layout`      | `buildLayoutObject`                   |
 * | `atmosphere`  | `src/vfx`              | `createVfxController`                 |
 * | `buildings`   | `src/city/buildings`   | pending — barrel not shipped in this  |
 * |               |                        | revision, reported from the transition |
 * |               |                        | barrel's `PENDING_LAYER_STAGES`        |
 * | `storefronts` | `src/city/storefronts` | `applyEra` / `applyEraTransition`     |
 * | `props`       | `src/city/props`       | `PropsRuntime.applyEra`               |
 * | `vehicles`    | `src/city/vehicles`    | `applyEra` + `VehicleSceneObject`     |
 * | `pedestrians` | `src/city/pedestrians` | pending — as above                    |
 *
 * The pending slots are read from the director's own table, so the day those
 * barrels land the composition mounts them without a year branch, a hard-coded
 * list or a composition edit.
 *
 * How one era change flows
 * ------------------------
 * 1. The viewer picks a year (timeline UI → era store).
 * 2. The director stages the change — atmosphere, buildings, storefronts, props,
 *    vehicles/pedestrians, then the soundscape — calling each layer adapter with
 *    that stage's own eased progress, while its camera port keeps the viewer's
 *    framing exactly where it was.
 * 3. The composition's frame hook advances the simulation clock, poses the
 *    vehicles, feeds their emissions into the atmosphere's `plumeSources` input,
 *    routes their SFX events to the audio bridge and ticks the director.
 * 4. On every era change the inspection-targets surface is rebuilt from the
 *    layout anchors plus the layer roots now in the scene graph, and the debug
 *    snapshot is republished.
 *
 * A layer that throws while building is recorded in `failures`, its slot is
 * reported as failed and the rest of the block keeps running: the viewer gets a
 * banner, never a blank canvas.
 */

import type { Object3D } from 'three'
import { Group } from 'three'
import {
  buildLayoutObject,
  createCityLayout,
  disposeLayoutObject,
} from '../city/layout'
import type { BlockLayout, BuiltLayout } from '../city/layout'
import {
  applyEra as applyPropsEra,
  applyEraTransition as applyPropsTransition,
  createPropsRuntime,
} from '../city/props'
import type {
  PropCategory,
  PropsApplyContext,
  PropsLayerPlan,
  PropsRuntime,
  PropsTransitionPlan,
} from '../city/props'
import {
  applyEra as applyStorefrontEra,
  applyEraTransition as applyStorefrontEraTransition,
  applyProgressiveSwap,
  createStorefrontGroup,
  disposeStorefrontGroup,
  summariseStorefrontGroup,
} from '../city/storefronts'
import type {
  AnySignCanvasFactory,
  StorefrontContext,
  StorefrontPlan,
  StorefrontTransitionPlan,
} from '../city/storefronts'
import {
  applyEra as applyVehicleEra,
  applyEraTransition as applyVehicleEraTransition,
  createVehicleLayer,
  createVehicleSceneObject,
  planSignature,
} from '../city/vehicles'
import type {
  EraApplicationContext,
  EraVehiclePlan,
  SfxTrigger,
  VehicleLayer,
  VehicleSceneObject,
} from '../city/vehicles'
import type { EraId, EraRegistry } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { Seed } from '../lib/rng'
import type {
  CameraState,
  CameraStatePatch,
  FrameHook,
  FrameStats,
  LightingParams,
  PostProcessingParamsPatch,
  PostProcessingParams,
  SceneQuality,
} from '../scene'
import {
  createEraStore,
  selectProgress,
  subscribeToEraSelection,
  useEraStore,
} from '../state/eraStore'
import type { EraStore } from '../state/eraStore'
import {
  PENDING_LAYER_STAGES,
  bindLayerAdapter,
  createTransitionDirector,
  createUIControlsMotionPort,
} from '../transition'
import type {
  TransitionDirector,
  TransitionDirectorSnapshot,
  TransitionLayerAdapter,
  TransitionStageId,
} from '../transition'
import { selectRequestedQualityTier, subscribeToQualityIntent, useUIControlsStore } from '../ui'
import type { UIControlsStore } from '../ui'
import { createVfxController } from '../vfx'
import type { PlumeSourceEvent, VfxController } from '../vfx'
import { createAudioBridge } from './audioBridge'
import type { AudioBridge, AudioEngineHandle } from './audioBridge'
import {
  countSceneObjects,
  createDebugSurface,
  DEBUG_BUILD,
  DEBUG_SURFACE_VERSION,
  forcedFailureLayer,
  frameSummary,
  installDebugSurface,
} from './debugSurface'
import type {
  DebugEnvironment,
  DebugSnapshot,
  DebugSurfaceHandle,
  LayerDebugRecord,
  SceneObjectCounts,
} from './debugSurface'
import {
  boundsFromAabb,
  boundsOfPoint,
  buildInspectionTargets,
  emptyInspectionTargets,
  summariseInspectionTargets,
} from './inspectionTargets'
import type {
  InspectionCategory,
  InspectionLayerInput,
  InspectionObjectInput,
  InspectionTargets,
} from './inspectionTargets'
import {
  createLoadingState,
  markReady,
  markStepDone,
  markStepFailed,
  markStepSkipped,
} from './loading'
import type { LoadingState } from './loading'
import { resolveEraPayload, resolveEraPayloads } from './eraPayload'
import type { EraPayload } from './eraPayload'

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Layer slots of the composed scene, in mount order.
 *
 * The order is the story the block tells — the ground, the air, the buildings,
 * then what fills the street — and the same order drives the inspection surface
 * and the debug report.
 */
export const COMPOSITION_LAYER_ORDER = [
  'layout',
  'atmosphere',
  'buildings',
  'storefronts',
  'props',
  'vehicles',
  'pedestrians',
] as const

/** Identifier of one mounted layer slot. */
export type LayerSlotId = (typeof COMPOSITION_LAYER_ORDER)[number]

/** Display name of every slot, used by the overlay, the debug surface and tests. */
export const LAYER_LABELS: Readonly<Record<LayerSlotId, string>> = Object.freeze({
  layout: 'Block layout',
  atmosphere: 'Atmosphere and sky',
  buildings: 'Buildings',
  storefronts: 'Storefronts and signage',
  props: 'Street furniture',
  vehicles: 'Vehicles',
  pedestrians: 'Pedestrians',
})

/** Slots whose layer barrel is shipped in this revision. */
export const SHIPPED_LAYER_IDS: readonly LayerSlotId[] = Object.freeze([
  'layout',
  'atmosphere',
  'storefronts',
  'props',
  'vehicles',
])

/**
 * Transition stage ids that are also content-layer slots.
 *
 * Every stage except `soundscape`, which the director drives through the audio
 * port rather than a scene layer.
 */
export type ContentLayerSlotId = Exclude<TransitionStageId, 'soundscape'>

/** True when a transition stage id is also a composition layer slot. */
export function isLayerSlotId(value: TransitionStageId): value is ContentLayerSlotId {
  return value !== 'soundscape'
}

/**
 * Content-layer stages the director reports as pending.
 *
 * Read from the transition barrel instead of hard-coded, so the composition and
 * the director can never disagree about which bars are still to land.
 */
export const PENDING_LAYER_IDS: readonly LayerSlotId[] = Object.freeze(
  PENDING_LAYER_STAGES.filter(isLayerSlotId),
)

/** Largest simulation step a single frame may add, in seconds. */
export const MAX_SIM_STEP_SECONDS = 0.1

/** How many frames between two automatic debug publishes. */
export const DEBUG_PUBLISH_INTERVAL_FRAMES = 30

/** Largest number of vehicle plume sources fed to the atmosphere at once. */
export const MAX_PLUME_SOURCES = 24

/* -------------------------------------------------------------------------- */
/* Pipeline surface the composition needs                                     */
/* -------------------------------------------------------------------------- */

/**
 * The part of the render pipeline the composition drives.
 *
 * `RenderPipeline` satisfies it structurally, so the application passes the real
 * pipeline while the composition suite passes a stub over a real `Group` world —
 * jsdom cannot create a WebGL context, and nothing here needs one.
 */
export interface CompositionPipeline {
  /** Root group every layer mounts into. */
  readonly world: Group
  /** Resolved quality of the running pipeline, when available. */
  readonly quality?: SceneQuality
  /** Navigation controls, used as the director's capture/restore camera port. */
  readonly controls: {
    getState(): CameraState
    setState(state: CameraStatePatch): void
  }
  applyLighting(params: Partial<LightingParams>): LightingParams
  applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams
  /** Subscribes to the pipeline's frame hook; returns the unsubscribe function. */
  onFrame(hook: FrameHook): () => void
  /** Applies a new quality tier to the live renderer. */
  setQualityTier?(name: QualityTierName): unknown
}

/* -------------------------------------------------------------------------- */
/* Options and public surface                                                 */
/* -------------------------------------------------------------------------- */

/** A layer failure the composition absorbed instead of crashing on. */
export interface CompositionFailure {
  /** Layer that failed, or `transition` for a director-level failure. */
  readonly layerId: LayerSlotId | 'transition'
  readonly message: string
  readonly error: unknown
}

/** Live record of one layer slot, measured from the scene graph. */
export interface LayerRuntimeStats {
  readonly id: LayerSlotId
  readonly label: string
  readonly kind: 'layout' | 'atmosphere' | 'layer' | 'pending'
  readonly mounted: boolean
  /** True when the layer's build threw; the rest of the block keeps running. */
  readonly failed: boolean
  /** How many times the slot was mounted; 1 for every mounted layer. */
  readonly mounts: number
  readonly eraId: EraId | null
  readonly qualityTier: QualityTierName
  readonly root: Group | null
  /** Object/mesh/instance/light/triangle counts measured on the layer's root. */
  readonly counts: SceneObjectCounts
  /** Layer-specific counters (sign meshes, parked vehicles, plume emitters, …). */
  readonly stats: Readonly<Record<string, number>>
}

/** Options of {@link createSceneComposition}. */
export interface SceneCompositionOptions {
  /** Live render pipeline (or a structural stand-in in tests). */
  readonly pipeline: CompositionPipeline
  /** Frozen block every layer is authored against; generated when omitted. */
  readonly layout?: BlockLayout
  /** Block seed used when the layout is generated here. */
  readonly seed?: Seed
  /** Era store; defaults to the application-wide store. */
  readonly eraStore?: EraStore
  /** ui-controls store; defaults to the application-wide store. */
  readonly uiStore?: UIControlsStore
  /** Era registry used by payload resolution; defaults to the shipped table. */
  readonly registry?: EraRegistry
  /** Initial quality tier; defaults to the store's requested tier. */
  readonly qualityTier?: QualityTierName
  /** Audio bridge to use; `null` means "this host is silent". */
  readonly audio?: AudioBridge | null
  /** Audio engine a bridge is built around; ignored when `audio` is given. */
  readonly audioEngine?: AudioEngineHandle | null
  /** Overrides the era's own night state for every layer. */
  readonly night?: boolean
  /** Artwork factory for storefront signs; injected by tests and captures. */
  readonly signCanvasFactory?: AnySignCanvasFactory
  /** Forces the debug surface on or off; defaults to the dev-build gate. */
  readonly debug?: boolean
  /** Environment the debug gate reads; injectable for tests. */
  readonly debugEnvironment?: DebugEnvironment
  /** Cap of object-derived inspection targets per layer. */
  readonly inspectionLimitPerLayer?: number
  /** Called when a layer fails, so a host can surface a non-blocking message. */
  readonly onFailure?: (failure: CompositionFailure) => void
}

/** The composed experience, as the application and the tests drive it. */
export interface SceneComposition {
  readonly pipeline: CompositionPipeline
  readonly layout: BlockLayout
  readonly eraStore: EraStore
  readonly uiStore: UIControlsStore
  readonly audio: AudioBridge | null
  readonly director: TransitionDirector
  readonly layerOrder: readonly LayerSlotId[]
  readonly mountedLayers: readonly LayerSlotId[]
  readonly pendingLayers: readonly LayerSlotId[]
  readonly failures: readonly CompositionFailure[]
  readonly loading: LoadingState
  readonly ready: boolean
  readonly disposed: boolean
  readonly qualityTier: QualityTierName
  readonly simSeconds: number
  readonly debugSurface: DebugSurfaceHandle | null
  /** Resolved payload of every era of the registry, in timeline order. */
  readonly payloads: readonly EraPayload[]
  getEraPayload(eraId: EraId): EraPayload
  currentEraId(): EraId
  currentPayload(): EraPayload
  /** Selects an era through the store, i.e. exactly the timeline's own path. */
  selectEra(eraId: EraId): void
  setQualityTier(tier: QualityTierName): void
  /** Live per-layer records, measured from the scene graph. */
  getLayerStats(): readonly LayerRuntimeStats[]
  getInspectionTargets(): InspectionTargets
  refreshInspectionTargets(): InspectionTargets
  getDebugSnapshot(): DebugSnapshot
  publishDebug(): DebugSnapshot
  /** Advances the simulation and the director; the frame hook calls this. */
  advance(deltaSeconds: number): void
  /** Notifies on era changes, tier changes and failures. */
  subscribe(listener: (composition: SceneComposition) => void): () => void
  dispose(): void
}

/** Counts reported for a slot that has no root (pending or failed). */
const EMPTY_COUNTS: SceneObjectCounts = Object.freeze({
  objects: 0,
  meshes: 0,
  instancedMeshes: 0,
  instances: 0,
  lights: 0,
  triangles: 0,
})

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function tuple(position: {
  readonly x: number
  readonly y: number
  readonly z: number
}): readonly [number, number, number] {
  return [position.x, position.y, position.z]
}

/** Target category of one storefront child, read from its own `userData`. */
export function storefrontCategory(kind: unknown): InspectionCategory {
  switch (kind) {
    case 'sign':
    case 'sign-frame':
      return 'signage'
    case 'advertising':
    case 'advertising-frame':
      return 'advertising'
    case 'graffiti':
      return 'graffiti'
    default:
      return 'storefront'
  }
}

/** Target category of one prop, from the props layer's own taxonomy. */
export function propInspectionCategory(category: PropCategory): InspectionCategory {
  return category === 'clutter' ? 'prop' : 'street-furniture'
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Builds the composed experience over one render pipeline.
 *
 * Everything is wired once, synchronously, so a caller can immediately ask for
 * `currentEraId()`, `getInspectionTargets()` or a debug snapshot.
 */
export function createSceneComposition(options: SceneCompositionOptions): SceneComposition {
  const pipeline = options.pipeline
  const world = pipeline.world
  const eraStore = options.eraStore ?? useEraStore
  const uiStore = options.uiStore ?? useUIControlsStore
  const layout = options.layout ?? createCityLayout(options.seed)
  const night = options.night

  let qualityTier: QualityTierName =
    options.qualityTier ?? selectRequestedQualityTier(uiStore.getState())
  let simSeconds = 0
  let frameCount = 0
  let lastStats: FrameStats | null = null
  let disposed = false
  let ready = false
  let loading: LoadingState = createLoadingState()

  const listeners = new Set<(composition: SceneComposition) => void>()
  const failures: CompositionFailure[] = []
  const hosts = new Map<LayerSlotId, Group>()
  const mountCounts = new Map<LayerSlotId, number>()
  const layerEras = new Map<LayerSlotId, EraId | null>()
  const debugDirty = { value: true }
  let activeLayerId: LayerSlotId | null = null

  const notify = (): void => {
    for (const listener of listeners) {
      listener(composition)
    }
  }

  const motionPort = createUIControlsMotionPort(uiStore)
  const reducedMotion = (): boolean => motionPort.isReducedMotion()

  /* ---------------------------------------------------------------------- */
  /* Mounting                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Creates (or returns) the group a layer mounts into.
   *
   * The map is the mount ledger: a second mount of the same slot returns the
   * same group and increments `mounts`, which the debug surface reports — so
   * "exactly one mount per layer" is something the running application proves
   * rather than something the code merely intends.
   */
  function layerHost(id: LayerSlotId): Group {
    const existing = hosts.get(id)
    if (existing !== undefined) {
      mountCounts.set(id, (mountCounts.get(id) ?? 1) + 1)
      return existing
    }
    const group = new Group()
    group.name = `layer:${id}`
    group.userData = { layerId: id, label: LAYER_LABELS[id] }
    world.add(group)
    hosts.set(id, group)
    mountCounts.set(id, 1)
    return group
  }

  const isForcedFailure = (id: LayerSlotId): boolean =>
    forcedFailureLayer(options.debugEnvironment) === id

  /**
   * Runs one layer operation, absorbing a failure and naming the layer.
   *
   * Returns null when the layer failed, which every caller treats as "this layer
   * is missing from the block right now" — a degraded banner instead of a crash.
   */
  function attempt<T>(layerId: LayerSlotId, run: () => T): T | null {
    try {
      if (isForcedFailure(layerId)) {
        throw new Error(`Layer ${layerId} was forced to fail by the diagnostic flag.`)
      }
      return run()
    } catch (error) {
      const failure: CompositionFailure = { layerId, message: messageOf(error), error }
      failures.push(failure)
      loading = markStepFailed(loading, layerId)
      options.onFailure?.(failure)
      return null
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Audio bridge                                                           */
  /* ---------------------------------------------------------------------- */

  const audioBridge: AudioBridge | null =
    options.audio !== undefined
      ? options.audio
      : options.audioEngine === null
        ? null
        : createAudioBridge({
            uiStore,
            ...(options.audioEngine === undefined ? {} : { engine: options.audioEngine }),
          })

  /* ---------------------------------------------------------------------- */
  /* Layout                                                                 */
  /* ---------------------------------------------------------------------- */

  const layoutBuilt: BuiltLayout | null = attempt('layout', () => {
    const built = buildLayoutObject(layout)
    layerHost('layout').add(built.root)
    layerEras.set('layout', null)
    return built
  })

  /* ---------------------------------------------------------------------- */
  /* Storefronts                                                            */
  /* ---------------------------------------------------------------------- */

  const storefrontHost: Group | null = attempt('storefronts', () => layerHost('storefronts'))

  let storefrontSingle: Group | null = null
  let storefrontFrom: Group | null = null
  let storefrontTo: Group | null = null
  let storefrontPairKey: string | null = null

  function storefrontContextFor(tier: QualityTierName): StorefrontContext {
    return {
      layout,
      qualityTier: tier,
      reducedMotion: reducedMotion(),
      ...(options.seed === undefined ? {} : { seed: options.seed }),
      ...(night === undefined ? {} : { night }),
    }
  }

  const storefrontGroupOptions = (): { readonly canvasFactory?: AnySignCanvasFactory } =>
    options.signCanvasFactory === undefined ? {} : { canvasFactory: options.signCanvasFactory }

  function clearStorefrontGroups(): void {
    for (const group of [storefrontSingle, storefrontFrom, storefrontTo]) {
      if (group === null) {
        continue
      }
      group.removeFromParent()
      disposeStorefrontGroup(group)
    }
    storefrontSingle = null
    storefrontFrom = null
    storefrontTo = null
    storefrontPairKey = null
  }

  /** Shows one settled era's storefronts, replacing whatever was mounted. */
  function showStorefrontPlan(plan: StorefrontPlan): void {
    clearStorefrontGroups()
    const group = createStorefrontGroup(plan, storefrontGroupOptions())
    storefrontHost?.add(group)
    storefrontSingle = group
    layerEras.set('storefronts', plan.eraId)
  }

  /**
   * Applies one staged storefront frame.
   *
   * The first frame of a pair builds both eras' groups; every later frame only
   * advances the progressive swap, and `t = 1` settles on the incoming era —
   * identical to a direct `applyEra`, which is the layer's own contract.
   */
  function applyStorefrontFrame(plan: StorefrontTransitionPlan): void {
    if (storefrontHost === null) {
      return
    }
    if (plan.instant || plan.from === plan.to) {
      showStorefrontPlan(plan.plan)
      return
    }
    const key = `${plan.from}|${plan.to}`
    if (key !== storefrontPairKey || storefrontFrom === null || storefrontTo === null) {
      clearStorefrontGroups()
      storefrontFrom = createStorefrontGroup(plan.fromPlan, storefrontGroupOptions())
      storefrontTo = createStorefrontGroup(plan.toPlan, storefrontGroupOptions())
      storefrontHost.add(storefrontFrom)
      storefrontHost.add(storefrontTo)
      storefrontPairKey = key
    }
    applyProgressiveSwap(storefrontFrom, storefrontTo, plan.mix)
    layerEras.set('storefronts', null)
    if (plan.t >= 1) {
      storefrontFrom.removeFromParent()
      disposeStorefrontGroup(storefrontFrom)
      storefrontFrom = null
      storefrontSingle = storefrontTo
      storefrontTo = null
      storefrontPairKey = null
      layerEras.set('storefronts', plan.toPlan.eraId)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Props                                                                  */
  /* ---------------------------------------------------------------------- */

  let propsRuntime: PropsRuntime | null = null

  function propsRuntimeOptions(): {
    readonly seed?: Seed
    readonly qualityTier: QualityTierName
    readonly night?: boolean
  } {
    const result: { seed?: Seed; qualityTier: QualityTierName; night?: boolean } = { qualityTier }
    if (options.seed !== undefined) {
      result.seed = options.seed
    }
    if (night !== undefined) {
      result.night = night
    }
    return result
  }

  const propsHost: Group | null = attempt('props', () => {
    const runtime = createPropsRuntime(layout, propsRuntimeOptions())
    const host = layerHost('props')
    host.add(runtime.root)
    propsRuntime = runtime
    return host
  })

  function currentPropsRuntime(): PropsRuntime {
    if (propsRuntime === null) {
      throw new Error('The props layer is not mounted in this composition.')
    }
    return propsRuntime
  }

  /** Rebuilds the props runtime at the current tier and re-applies the era. */
  function rebuildProps(eraId: EraId): void {
    if (propsHost === null) {
      return
    }
    const previous = propsRuntime
    const runtime = createPropsRuntime(layout, propsRuntimeOptions())
    propsHost.add(runtime.root)
    propsRuntime = runtime
    runtime.applyEra(eraId, night === undefined ? { qualityTier } : { night, qualityTier })
    if (previous !== null) {
      previous.root.removeFromParent()
      previous.dispose()
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Vehicles                                                               */
  /* ---------------------------------------------------------------------- */

  let vehicleLayer: VehicleLayer | null = null
  let vehicleScene: VehicleSceneObject | null = null
  let vehicleSignature = ''
  let vehicleSfxEvents = 0

  const vehicleHost: Group | null = attempt('vehicles', () => {
    const host = layerHost('vehicles')
    const layer = createVehicleLayer({
      layout,
      eraId: eraStore.getState().selectedEra,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
      quality: qualityTier,
      reducedMotion: reducedMotion(),
      clockSec: 0,
      onSfxTrigger: (trigger: SfxTrigger) => {
        vehicleSfxEvents += 1
        audioBridge?.handleSfxTrigger(trigger)
      },
    })
    vehicleLayer = layer
    const scene = createVehicleSceneObject({
      plan: layer.plan,
      fleet: layer.fleet,
      parked: layer.parked,
      markings: layer.markings,
    })
    host.add(scene.root)
    vehicleScene = scene
    vehicleSignature = planSignature(layer.plan)
    layerEras.set('vehicles', layer.plan.eraId)
    return host
  })

  function currentVehicleLayer(): VehicleLayer {
    if (vehicleLayer === null) {
      throw new Error('The vehicle layer is not mounted in this composition.')
    }
    return vehicleLayer
  }

  /** Rebuilds the instanced fleet whenever the applied plan changes. */
  function refreshVehicleScene(): void {
    const layer = vehicleLayer
    if (layer === null || vehicleHost === null) {
      return
    }
    const signature = planSignature(layer.plan)
    if (signature === vehicleSignature && vehicleScene !== null) {
      return
    }
    const scene = createVehicleSceneObject({
      plan: layer.plan,
      fleet: layer.fleet,
      parked: layer.parked,
      markings: layer.markings,
    })
    vehicleHost.add(scene.root)
    if (vehicleScene !== null) {
      vehicleScene.root.removeFromParent()
      vehicleScene.dispose()
    }
    vehicleScene = scene
    vehicleSignature = signature
  }

  function vehicleContext(stageReduced: boolean): EraApplicationContext {
    return {
      layout,
      quality: qualityTier,
      reducedMotion: stageReduced,
      target: currentVehicleLayer(),
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    }
  }

  function applyVehiclesSettled(eraId: EraId): void {
    attempt('vehicles', () => {
      applyVehicleEra(eraId, vehicleContext(reducedMotion()))
      refreshVehicleScene()
      layerEras.set('vehicles', eraId)
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Pending slots                                                          */
  /* ---------------------------------------------------------------------- */

  for (const id of PENDING_LAYER_IDS) {
    loading = markStepSkipped(loading, id)
  }

  /* ---------------------------------------------------------------------- */
  /* Atmosphere                                                             */
  /* ---------------------------------------------------------------------- */

  let vfx: VfxController | null = null
  let plumeSourceCount = 0

  /**
   * Current atmosphere controller.
   *
   * A function call rather than a direct read: the controller is assigned inside
   * a guarded build closure, and reading it through a call keeps TypeScript's
   * control-flow analysis from pinning the variable to its initial `null`.
   */
  const currentVfx = (): VfxController | null => vfx

  attempt('atmosphere', () => {
    const controller = createVfxController({
      target: pipeline,
      ...(options.registry === undefined ? {} : { registry: options.registry }),
      era: eraStore.getState().selectedEra,
      qualityTier,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
      reducedMotion: reducedMotion(),
      plumeSources: [],
    })
    // The controller attaches its own root to the pipeline's world; move it
    // under this slot's group so the scene graph keeps one group per layer.
    layerHost('atmosphere').add(controller.root)
    vfx = controller
    return controller
  })

  /* ---------------------------------------------------------------------- */
  /* Frame loop                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Advances the simulation by one frame.
   *
   * Order matters: the clock moves, the vehicles are posed at the new reading,
   * their emissions reach the atmosphere, then the director applies the staged
   * era frames — and the atmosphere's own frame hook, registered later, advances
   * with the clock this function has just updated.
   */
  function advance(deltaSeconds: number): void {
    if (disposed) {
      return
    }
    const delta = Math.min(
      Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0),
      MAX_SIM_STEP_SECONDS,
    )
    simSeconds += delta
    frameCount += 1

    const layer = vehicleLayer
    if (layer !== null) {
      // `setClock` poses the fleet *and* emits that step's SFX to the bridge.
      layer.setClock(simSeconds)
      vehicleScene?.update(layer.poseAt(simSeconds))
    }
    publishPlumes()
    vfx?.setClock({ seconds: simSeconds })
    try {
      director.tick()
    } catch (error) {
      // A director frame must never take the render loop down with it: the
      // failure is recorded, reported, and the next frame carries on.
      const failure: CompositionFailure = {
        layerId: activeLayerId ?? 'transition',
        message: messageOf(error),
        error,
      }
      failures.push(failure)
      options.onFailure?.(failure)
      console.warn(`[scene] transition frame failed: ${failure.message}`)
    }

    if (
      debugDirty.value ||
      (debugSurface?.enabled === true && frameCount % DEBUG_PUBLISH_INTERVAL_FRAMES === 0)
    ) {
      publishDebug()
    }
  }

  /** Feeds live vehicle emissions into the atmosphere's `plumeSources` input. */
  function publishPlumes(): void {
    const controller = vfx
    const layer = vehicleLayer
    if (controller === null || layer === null) {
      return
    }
    const sources: PlumeSourceEvent[] = []
    for (const pose of layer.poseAt(simSeconds)) {
      if (sources.length >= MAX_PLUME_SOURCES) {
        break
      }
      const power = pose.model.power
      if (power === 'human') {
        continue
      }
      sources.push({
        id: `vehicle:${pose.id}`,
        kind: power === 'electric' ? 'evGlow' : 'exhaust',
        position: tuple(pose.position),
        intensity: clamp01(0.25 + pose.speedMps / 16),
      })
    }
    plumeSourceCount = sources.length
    controller.setPlumeSources(sources)
  }

  /* ---------------------------------------------------------------------- */
  /* Director adapters                                                      */
  /* ---------------------------------------------------------------------- */

  const adapters: TransitionLayerAdapter[] = []

  const atmosphere = currentVfx()

  if (atmosphere !== null) {
    const controller = atmosphere
    adapters.push(
      bindLayerAdapter<{ readonly reducedMotion: boolean }, unknown, unknown>({
        id: 'atmosphere',
        contextFor: () => ({ reducedMotion: reducedMotion() }),
        applyEra: (eraId) => {
          activeLayerId = 'atmosphere'
          return attempt('atmosphere', () => {
            const snapshot = controller.applyEra(eraId)
            layerEras.set('atmosphere', snapshot.eraId)
            return snapshot
          }) ?? controller.snapshot
        },
        applyEraTransition: (request) => {
          activeLayerId = 'atmosphere'
          return (
            attempt('atmosphere', () => {
              const snapshot = controller.applyTransition({
                from: request.from,
                to: request.to,
                t: request.t,
              })
              layerEras.set('atmosphere', snapshot.eraId)
              return snapshot
            }) ?? controller.snapshot
          )
        },
        readEra: () => controller.snapshot.eraId,
        readTransitionEra: () => controller.snapshot.eraId,
      }),
    )
  }

  if (storefrontHost !== null) {
    adapters.push(
      bindLayerAdapter<
        StorefrontContext,
        StorefrontPlan | null,
        StorefrontTransitionPlan | null
      >({
        id: 'storefronts',
        contextFor: ({ reducedMotion: stageReduced }) => {
          return {
            layout,
            qualityTier,
            reducedMotion: stageReduced,
            ...(options.seed === undefined ? {} : { seed: options.seed }),
            ...(night === undefined ? {} : { night }),
          }
        },
        applyEra: (eraId, context) => {
          activeLayerId = 'storefronts'
          return attempt('storefronts', () => {
            const plan = applyStorefrontEra(eraId, context)
            showStorefrontPlan(plan)
            return plan
          })
        },
        applyEraTransition: (request, context) => {
          activeLayerId = 'storefronts'
          return attempt('storefronts', () => {
            const plan = applyStorefrontEraTransition(request, context)
            applyStorefrontFrame(plan)
            return plan
          })
        },
        readEra: (plan) => plan?.eraId ?? null,
        readTransitionEra: (plan) => plan?.resolvedEra ?? null,
      }),
    )
  }

  if (propsHost !== null) {
    adapters.push(
      bindLayerAdapter<PropsApplyContext, PropsLayerPlan | null, PropsTransitionPlan | null>({
        id: 'props',
        contextFor: ({ reducedMotion: stageReduced }) => {
          return {
            runtime: currentPropsRuntime(),
            reducedMotion: stageReduced,
            ...(night === undefined ? {} : { night }),
          }
        },
        applyEra: (eraId, context) => {
          activeLayerId = 'props'
          return attempt('props', () => {
            const plan = applyPropsEra(eraId, context)
            layerEras.set('props', plan.eraId)
            return plan
          })
        },
        applyEraTransition: (request, context) => {
          activeLayerId = 'props'
          return attempt('props', () => {
            const frame = applyPropsTransition(request, context)
            layerEras.set('props', frame.t >= 1 ? frame.toPlan.eraId : null)
            return frame
          })
        },
        readEra: (plan) => plan?.eraId ?? null,
        readTransitionEra: () => propsRuntime?.eraId ?? null,
      }),
    )
  }

  if (vehicleHost !== null) {
    adapters.push(
      bindLayerAdapter<EraApplicationContext, EraVehiclePlan | null, EraVehiclePlan | null>({
        id: 'vehicles',
        contextFor: ({ reducedMotion: stageReduced }) => vehicleContext(stageReduced),
        applyEra: (eraId, context) => {
          activeLayerId = 'vehicles'
          return attempt('vehicles', () => {
            const plan = applyVehicleEra(eraId, context)
            refreshVehicleScene()
            layerEras.set('vehicles', plan.eraId)
            return plan
          })
        },
        applyEraTransition: (request, context) => {
          activeLayerId = 'vehicles'
          return attempt('vehicles', () => {
            const plan = applyVehicleEraTransition(request, context)
            refreshVehicleScene()
            layerEras.set('vehicles', request.t >= 1 ? plan.eraId : null)
            return plan
          })
        },
        readEra: (plan) => plan?.eraId ?? null,
        readTransitionEra: (plan) => plan?.eraId ?? null,
      }),
    )
  }

  const director: TransitionDirector = createTransitionDirector({
    store: eraStore,
    layers: adapters,
    audio: audioBridge?.port ?? null,
    camera: {
      capture: () => pipeline.controls.getState(),
      restore: (state: CameraState) => {
        pipeline.controls.setState(state)
      },
    },
    motion: motionPort,
    autoStart: true,
  })

  /* ---------------------------------------------------------------------- */
  /* Era payloads                                                           */
  /* ---------------------------------------------------------------------- */

  const payloadCache = new Map<EraId, EraPayload>()

  function getEraPayload(eraId: EraId): EraPayload {
    const cached = payloadCache.get(eraId)
    if (cached !== undefined && cached.qualityTier === qualityTier) {
      return cached
    }
    const payload = resolveEraPayload(eraId, {
      qualityTier,
      ...(options.registry === undefined ? {} : { registry: options.registry }),
    })
    payloadCache.set(eraId, payload)
    return payload
  }

  /** Era the block most closely resembles right now. */
  function dominantEraId(): EraId {
    const state = eraStore.getState()
    if (state.fromEra === state.toEra) {
      return state.selectedEra
    }
    return state.progress >= 0.5 ? state.toEra : state.fromEra
  }

  /* ---------------------------------------------------------------------- */
  /* Inspection targets                                                     */
  /* ---------------------------------------------------------------------- */

  function layoutInspectionObjects(): readonly InspectionObjectInput[] {
    if (layoutBuilt === null) {
      return []
    }
    return Object.entries(layoutBuilt.groups).map(([name, group]: [string, Group]) => ({
      id: `layout:${name}`,
      category: 'surface' as InspectionCategory,
      label: `Block ${name}`,
      object: group,
      source: group.name,
    }))
  }

  function atmosphereInspectionObjects(): readonly InspectionObjectInput[] {
    if (vfx === null) {
      return []
    }
    return vfx.root.children.map((child: Object3D) => ({
      id: `atmosphere:${child.name === '' ? 'group' : child.name}`,
      category: 'atmosphere' as InspectionCategory,
      label: child.name === '' ? 'Atmosphere' : child.name,
      object: child,
      source: child.name,
    }))
  }

  function storefrontInspectionObjects(): readonly InspectionObjectInput[] {
    const group = storefrontSingle ?? storefrontTo ?? storefrontFrom
    if (group === null) {
      return []
    }
    return group.children.map((child: Object3D) => ({
      id: `storefronts:${child.name === '' ? String(child.id) : child.name}`,
      category: storefrontCategory(child.userData['kind']),
      label: child.name,
      object: child,
      source: child.name,
    }))
  }

  function propsInspectionObjects(): readonly InspectionObjectInput[] {
    const built = propsRuntime?.built ?? null
    if (built === null) {
      return []
    }
    // Placement data, not bounding-box measurement: a props batch is one
    // instanced mesh covering dozens of props, so measuring it would describe
    // the whole street in one box and cost a full instance sweep to compute.
    return built.props.map((prop) => ({
      id: `props:${prop.key}`,
      category: propInspectionCategory(prop.category),
      label: prop.label,
      source: prop.anchorName,
      bounds: boundsFromAabb(prop.aabb),
    }))
  }

  /** Vehicle targets use the layer's own pose data, not per-instance bounding boxes. */
  function vehicleInspectionObjects(): readonly InspectionObjectInput[] {
    const layer = vehicleLayer
    if (layer === null) {
      return []
    }
    const parked: InspectionObjectInput[] = layer.parked.map((vehicle) => ({
      id: `vehicle:${vehicle.id}`,
      category: 'vehicle',
      label: `${vehicle.modelKey} (parked)`,
      source: vehicle.anchorName,
      bounds: boundsOfPoint(tuple(vehicle.position), {
        width: vehicle.widthM,
        height: vehicle.heightM,
      }),
    }))
    const moving: InspectionObjectInput[] = layer.poseAt(simSeconds).map((pose) => ({
      id: `vehicle:${pose.id}`,
      category: 'vehicle',
      label: pose.modelKey,
      source: pose.splineName,
      bounds: boundsOfPoint(tuple(pose.position), {
        width: pose.widthM,
        height: pose.heightM,
      }),
    }))
    return [...parked, ...moving]
  }

  function inspectionSources(): readonly InspectionLayerInput[] {
    return [
      { layerId: 'layout', objects: layoutInspectionObjects() },
      { layerId: 'atmosphere', objects: atmosphereInspectionObjects() },
      { layerId: 'storefronts', objects: storefrontInspectionObjects() },
      { layerId: 'props', objects: propsInspectionObjects() },
      { layerId: 'vehicles', objects: vehicleInspectionObjects() },
    ]
  }

  let inspectionTargets: InspectionTargets = emptyInspectionTargets(eraStore.getState().selectedEra)
  let inspectionDirty = true

  function refreshInspectionTargets(): InspectionTargets {
    inspectionTargets = buildInspectionTargets({
      layout,
      eraId: dominantEraId(),
      ...(options.inspectionLimitPerLayer === undefined
        ? {}
        : { limitPerLayer: options.inspectionLimitPerLayer }),
      layers: inspectionSources(),
      generatedAtSeconds: simSeconds,
    })
    inspectionDirty = false
    return inspectionTargets
  }

  /** Published surface, rebuilt lazily after any era change. */
  function getInspectionTargets(): InspectionTargets {
    return inspectionDirty ? refreshInspectionTargets() : inspectionTargets
  }

  /* ---------------------------------------------------------------------- */
  /* Layer statistics                                                       */
  /* ---------------------------------------------------------------------- */

  function layerStatsFor(id: LayerSlotId): Readonly<Record<string, number>> {
    switch (id) {
      case 'layout':
        return layoutBuilt === null
          ? {}
          : {
              meshCount: layoutBuilt.summary.meshCount,
              triangleCount: layoutBuilt.summary.triangleCount,
              groupCount: Object.keys(layoutBuilt.groups).length,
            }
      case 'atmosphere': {
        const controller = currentVfx()
        if (controller === null) {
          return {}
        }
        const stats = controller.getStats()
        return {
          frames: stats.frames,
          particleAlive: stats.particles.reduce((total, particle) => total + particle.alive, 0),
          plumeEmitters: stats.plumes.baselineSources + stats.plumes.sourceEmitters,
          plumeBaseline: stats.plumes.baselineSources,
          plumeSources: stats.plumes.sourceEmitters,
          plumeSourcesPublished: plumeSourceCount,
          ambientBirds: stats.plumes.ambientBirds,
        }
      }
      case 'storefronts': {
        const group = storefrontSingle ?? storefrontTo ?? storefrontFrom
        if (group === null) {
          return {}
        }
        const summary = summariseStorefrontGroup(group)
        return {
          units: summary.unitGroups,
          meshes: summary.meshes,
          signs: summary.signMeshes,
          awnings: summary.awningMeshes,
          advertising: summary.advertisingMeshes,
          graffiti: summary.graffitiMeshes,
          litMeshes: summary.litMeshes,
          textures: summary.textureCount,
        }
      }
      case 'props': {
        const stats = propsRuntime?.stats ?? null
        if (stats === null) {
          return {}
        }
        return {
          propCount: stats.propCount,
          instanceCount: stats.instanceCount,
          drawCalls: stats.drawCalls,
          recipesUsed: stats.recipesUsed,
          pointLights: stats.lamp.pointLights,
          anchorsCovered: stats.coverage.placed,
        }
      }
      case 'vehicles': {
        if (vehicleScene === null) {
          return {}
        }
        return {
          movingInstances: vehicleScene.counts.movingInstances,
          parkedInstances: vehicleScene.counts.parkedInstances,
          movingVariants: vehicleScene.counts.movingVariants,
          parkedVariants: vehicleScene.counts.parkedVariants,
          meshes: vehicleScene.counts.meshes,
          markingMeshes: vehicleScene.counts.markingMeshes,
          sfxEvents: vehicleSfxEvents,
        }
      }
      case 'buildings':
      case 'pedestrians':
        return {}
    }
  }

  function mountKindOf(id: LayerSlotId): LayerRuntimeStats['kind'] {
    if (id === 'layout') {
      return 'layout'
    }
    if (id === 'atmosphere') {
      return 'atmosphere'
    }
    return PENDING_LAYER_IDS.includes(id) ? 'pending' : 'layer'
  }

  function getLayerStats(): readonly LayerRuntimeStats[] {
    return COMPOSITION_LAYER_ORDER.map((id) => {
      const root = hosts.get(id) ?? null
      const failed = failures.some((failure) => failure.layerId === id)
      return {
        id,
        label: LAYER_LABELS[id],
        kind: mountKindOf(id),
        mounted: root !== null && !failed,
        failed,
        mounts: mountCounts.get(id) ?? 0,
        eraId: layerEras.get(id) ?? null,
        qualityTier,
        root,
        counts: root === null ? EMPTY_COUNTS : countSceneObjects(root),
        stats: layerStatsFor(id),
      }
    })
  }

  /* ---------------------------------------------------------------------- */
  /* Debug surface                                                          */
  /* ---------------------------------------------------------------------- */

  const debugSurface: DebugSurfaceHandle | null =
    options.debug === false
      ? null
      : options.debug === true
        ? createDebugSurface({
            enabled: true,
            ...(options.debugEnvironment === undefined
              ? {}
              : { environment: options.debugEnvironment }),
          })
        : DEBUG_BUILD
          ? createDebugSurface({
              ...(options.debugEnvironment === undefined
                ? {}
                : { environment: options.debugEnvironment }),
            })
          : null
  const uninstallDebug = debugSurface === null ? () => {} : installDebugSurface(debugSurface)

  /**
   * Cached per-layer records for the idle periodic publishes.
   *
   * Measuring every layer (a full scene-graph traversal per layer, plus the
   * storefront census) is far too expensive to repeat while the block is simply
   * being watched: the records are refreshed whenever something actually
   * changes — an era change, a tier change, a mount, a completion — and reused
   * in between. Everything that must be live per frame (era, progress, camera,
   * audio, frame counters, inspection summary) is read fresh either way.
   */
  let cachedLayerRecords: readonly LayerDebugRecord[] = []

  function refreshLayerRecords(): readonly LayerDebugRecord[] {
    cachedLayerRecords = getLayerStats().map((layer): LayerDebugRecord => ({
      id: layer.id,
      label: layer.label,
      mounted: layer.mounted,
      kind: layer.kind,
      eraId: layer.eraId,
      mounts: layer.mounts,
      qualityTier: layer.qualityTier,
      objects: layer.counts.objects,
      meshes: layer.counts.meshes,
      instancedMeshes: layer.counts.instancedMeshes,
      instances: layer.counts.instances,
      lights: layer.counts.lights,
      triangles: layer.counts.triangles,
      stats: layer.stats,
    }))
    return cachedLayerRecords
  }

  function transitionRecord(snapshot: TransitionDirectorSnapshot): DebugSnapshot['transition'] {
    return {
      active: snapshot.active,
      fromEra: snapshot.fromEra,
      toEra: snapshot.toEra,
      progress: snapshot.progress,
      frames: snapshot.frames,
      reducedMotion: snapshot.reducedMotion,
      retargetCount: snapshot.retargetCount,
      registeredLayers: snapshot.registeredLayers,
      pendingStages: snapshot.pendingStages,
      cameraUnchanged: snapshot.camera.unchanged,
      cameraRestorations: snapshot.camera.restorations,
      crossfades: snapshot.audio.crossfades,
      cueIds: snapshot.audio.cueIds,
      lastCompletionFrames: snapshot.lastCompletion?.frames ?? null,
    }
  }

  function getDebugSnapshot(): DebugSnapshot {
    const eraState = eraStore.getState()
    const payload = getEraPayload(eraState.selectedEra)
    const layers = debugDirty.value ? refreshLayerRecords() : cachedLayerRecords
    const inspection = getInspectionTargets()
    const summary = summariseInspectionTargets(inspection)
    const frame = frameSummary(lastStats)
    return {
      version: DEBUG_SURFACE_VERSION,
      builtAtSeconds: simSeconds,
      clockSeconds: simSeconds,
      frame: frame.frame || frameCount,
      fps: frame.fps,
      frameTimeMs: frame.frameTimeMs,
      eraId: eraState.selectedEra,
      year: payload.year,
      eraLabel: payload.label,
      fromEra: eraState.fromEra,
      toEra: eraState.toEra,
      progress: selectProgress(eraState),
      transitioning: eraState.fromEra !== eraState.toEra,
      qualityTier,
      layerOrder: COMPOSITION_LAYER_ORDER,
      mountedLayers: layers.filter((layer) => layer.mounted).map((layer) => layer.id),
      pendingLayers: layers.filter((layer) => !layer.mounted).map((layer) => layer.id),
      layers,
      audio: audioBridge?.getState() ?? null,
      camera: pipeline.controls.getState(),
      inspection: {
        eraId: summary.eraId,
        year: summary.year,
        count: summary.count,
        anchorCount: summary.anchorCount,
        objectCount: summary.objectCount,
        categories: summary.categories,
        layers: summary.layers,
      },
      transition: transitionRecord(director.getSnapshot()),
      loading: {
        ready,
        completed: loading.completed,
        total: loading.total,
        steps: loading.steps,
        failedLayer: loading.failedLayer,
      },
    }
  }

  function publishDebug(): DebugSnapshot {
    // The snapshot is built while the dirty flag is still set, so a publish
    // after a change always measures the scene instead of reusing the cache.
    const snapshot = getDebugSnapshot()
    debugDirty.value = false
    debugSurface?.publish(snapshot)
    return snapshot
  }

  /* ---------------------------------------------------------------------- */
  /* Intent plumbing                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Applies a quality tier without remounting anything.
   *
   * The pipeline reconfigures its renderer and effect chain, the atmosphere
   * re-resolves its particle budget, and the three content layers whose density
   * depends on the tier rebuild their contents inside the same slot groups — so
   * the scene, the camera and the inspection surface all survive the change.
   */
  function setQualityTier(tier: QualityTierName): void {
    if (disposed || tier === qualityTier) {
      return
    }
    qualityTier = tier
    pipeline.setQualityTier?.(tier)
    vfx?.setQualityTier(tier)
    const eraId = dominantEraId()
    attempt('props', () => {
      rebuildProps(eraId)
    })
    if (storefrontHost !== null) {
      attempt('storefronts', () => {
        showStorefrontPlan(applyStorefrontEra(eraId, storefrontContextFor(tier)))
      })
    }
    applyVehiclesSettled(eraId)
    inspectionDirty = true
    publishDebug()
    notify()
  }

  const unsubscribeEraSelection = subscribeToEraSelection(eraStore, () => {
    inspectionDirty = true
    debugDirty.value = true
    publishDebug()
    notify()
  })

  const unsubscribeQuality = subscribeToQualityIntent(uiStore, (intent) => {
    setQualityTier(intent.requestedTier)
  })

  // The era store only announces the *selection*; the surface still has to be
  // rebuilt once the staged blend completes and the dominant era has changed.
  const unsubscribeDirector = director.subscribe((snapshot) => {
    if (snapshot.active) {
      return
    }
    inspectionDirty = true
    debugDirty.value = true
    publishDebug()
    notify()
  })

  const removeFrameHook: () => void = pipeline.onFrame((stats, delta) => {
    lastStats = stats
    advance(delta)
  })

  /* ---------------------------------------------------------------------- */
  /* Initial era                                                            */
  /* ---------------------------------------------------------------------- */

  const initialEra = eraStore.getState().selectedEra
  for (const adapter of adapters) {
    adapter.applyEra({ eraId: initialEra, reducedMotion: true })
  }
  director.start()
  audioBridge?.crossfadeToEra(initialEra)

  for (const id of COMPOSITION_LAYER_ORDER) {
    if (PENDING_LAYER_IDS.includes(id) || failures.some((failure) => failure.layerId === id)) {
      continue
    }
    loading = markStepDone(loading, id)
  }
  loading = markStepDone(loading, 'soundscape')
  loading = markStepDone(loading, 'inspection')
  ready = failures.length === 0
  if (ready) {
    loading = markReady(loading)
  }

  refreshInspectionTargets()

  /* ---------------------------------------------------------------------- */
  /* Public handle                                                          */
  /* ---------------------------------------------------------------------- */

  const composition: SceneComposition = {
    pipeline,
    layout,
    eraStore,
    uiStore,
    audio: audioBridge,
    director,
    layerOrder: COMPOSITION_LAYER_ORDER,
    get mountedLayers(): readonly LayerSlotId[] {
      return getLayerStats()
        .filter((layer) => layer.mounted)
        .map((layer) => layer.id)
    },
    get pendingLayers(): readonly LayerSlotId[] {
      return getLayerStats()
        .filter((layer) => !layer.mounted)
        .map((layer) => layer.id)
    },
    get failures(): readonly CompositionFailure[] {
      return [...failures]
    },
    get loading(): LoadingState {
      return loading
    },
    get ready(): boolean {
      return ready
    },
    get disposed(): boolean {
      return disposed
    },
    get qualityTier(): QualityTierName {
      return qualityTier
    },
    get simSeconds(): number {
      return simSeconds
    },
    debugSurface,
    get payloads(): readonly EraPayload[] {
      return resolveEraPayloads({
        qualityTier,
        ...(options.registry === undefined ? {} : { registry: options.registry }),
      })
    },
    getEraPayload,
    currentEraId(): EraId {
      return eraStore.getState().selectedEra
    },
    currentPayload(): EraPayload {
      return getEraPayload(eraStore.getState().selectedEra)
    },
    selectEra(eraId: EraId): void {
      eraStore.getState().selectEra(eraId)
    },
    setQualityTier,
    getLayerStats,
    getInspectionTargets(): InspectionTargets {
      return inspectionDirty ? refreshInspectionTargets() : inspectionTargets
    },
    refreshInspectionTargets,
    getDebugSnapshot,
    publishDebug,
    advance,
    subscribe(listener: (composition: SceneComposition) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose(): void {
      if (disposed) {
        return
      }
      disposed = true
      removeFrameHook()
      unsubscribeEraSelection()
      unsubscribeQuality()
      unsubscribeDirector()
      director.dispose()
      clearStorefrontGroups()
      if (vehicleScene !== null) {
        vehicleScene.root.removeFromParent()
        vehicleScene.dispose()
        vehicleScene = null
      }
      if (propsRuntime !== null) {
        propsRuntime.root.removeFromParent()
        propsRuntime.dispose()
        propsRuntime = null
      }
      vfx?.dispose()
      vfx = null
      if (layoutBuilt !== null) {
        disposeLayoutObject(layoutBuilt)
      }
      audioBridge?.dispose()
      for (const [id, host] of hosts) {
        host.removeFromParent()
        host.clear()
        layerEras.delete(id)
      }
      hosts.clear()
      uninstallDebug()
      debugSurface?.clear()
      listeners.clear()
      payloadCache.clear()
    },
  }

  // A fully described snapshot is published synchronously, so a host that never
  // renders a frame (a test, a capture) still sees the composed state.
  publishDebug()

  return composition
}

/** Re-exported so a host can create an isolated era store beside a composition. */
export { createEraStore }
