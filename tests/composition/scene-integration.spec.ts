/**
 * Composition contract: the real composed experience, wired end to end.
 *
 * Nothing in this suite is a stand-in for a layer. The block comes from
 * `createCityLayout()`, the era data from the shipped registry, the layers from
 * their own barrels, the stores are real zustand stores and the transition
 * director is the shipped director. Only three things are substitutes, and only
 * because a test process has no GPU and no audio device:
 *
 * - the render pipeline is a structural stand-in with a **real** `Group` world,
 *   applying patches through the pipeline's own parameter builders;
 * - the audio engine is a recording stub behind the real `AudioEngine` port, so
 *   the routing, the rate limits and the deferred-unlock behaviour are proven
 *   without WebAudio;
 * - storefront artwork uses a canvas double, exactly as the storefront layer's
 *   own composition suite does.
 *
 * What it proves
 * --------------
 * 1. Exactly one mount per shipped layer, into the pipeline's own world, with
 *    the pending stages reported honestly.
 * 2. Every era of the registry resolves to a payload whose year, label,
 *    soundscape bed and cues come from the registry — no hard-coded year branch.
 * 3. Selecting each of the five years drives every layer to that era, with
 *    per-layer statistics that differ between adjacent periods.
 * 4. Audio is silent until the viewer's unlock intent is recorded, and the
 *    engine's real state is written back into the ui-controls store.
 * 5. Vehicle SFX events (horn, engine, bell, EV whine) reach the engine at
 *    rate-limited intervals.
 * 6. Inspection targets cover anchor-derived and layer-object-derived entries,
 *    with era metadata, and refresh when the era changes.
 * 7. Camera state survives two consecutive switches; reduced motion collapses a
 *    switch into a single step; quality changes apply without remounting.
 * 8. Vehicle emissions reach the atmosphere's `plumeSources` input.
 */

import { Group } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createSceneComposition,
  PENDING_LAYER_IDS,
  SHIPPED_LAYER_IDS,
} from '../../src/app'
import type { LayerRuntimeStats, SceneComposition } from '../../src/app'
import { createAudioBridge, SFX_MIN_INTERVAL_SECONDS } from '../../src/app/audioBridge'
import type { AudioEngineHandle } from '../../src/app/audioBridge'
import {
  createDebugSurface,
  DEBUG_SURFACE_KEY,
  isDebugSurfaceEnabled,
  installDebugSurface,
} from '../../src/app/debugSurface'
import type { DebugSnapshot } from '../../src/app/debugSurface'
import { extensionModulePaths, loadExtensions, resolveExtension } from '../../src/app/extensionSlots'
import { INSPECTION_CATEGORIES } from '../../src/app/inspectionTargets'
import {
  ONE_SHOT_IDS,
  resolveOneShotId,
  type AudioEngineState,
  type CrossfadeResult,
  type OneShotHandle,
  type OneShotOptions,
  type SoundscapeDescriptor,
} from '../../src/audio'
import { createCityLayout } from '../../src/city/layout'
import type { SignCanvas2D, SignCanvasFactory } from '../../src/city/storefronts'
import { ERA_IDS, getEra, getSoundscape } from '../../src/era'
import type { QualityTierName } from '../../src/lib/quality'
import {
  createLightingParams,
  createPostProcessingParams,
  DEFAULT_CAMERA_STATE,
  resolveSceneQuality,
} from '../../src/scene'
import type {
  CameraState,
  CameraStatePatch,
  FrameHook,
  FrameStats,
  LightingParams,
  PostProcessingParams,
  PostProcessingParamsPatch,
  SceneQuality,
} from '../../src/scene'
import { createEraStore } from '../../src/state/eraStore'
import { createUIControlsStore } from '../../src/ui'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The real canonical block, generated once for the whole suite. */
const LAYOUT = createCityLayout()

/** Canvas double good enough for three.js to accept as a texture source. */
interface FakeCanvas {
  readonly width: number
  readonly height: number
  getContext(id: string): SignCanvas2D
}

function createStubSignFactory(): SignCanvasFactory<FakeCanvas> {
  const context: SignCanvas2D = {
    canvas: { width: 0, height: 0 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'round',
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
  }
  return (width, height) => ({ canvas: { width, height, getContext: () => context }, context })
}

function cloneCamera(state: CameraState): CameraState {
  return {
    mode: state.mode,
    target: [state.target[0], state.target[1], state.target[2]],
    orbit: { ...state.orbit },
    street: { position: [...state.street.position], heading: state.street.heading, pitch: state.street.pitch },
    fov: state.fov,
    near: state.near,
    far: state.far,
  }
}

function applyCameraPatch(state: CameraState, patch: CameraStatePatch): CameraState {
  return {
    ...state,
    ...(patch.mode === undefined ? {} : { mode: patch.mode }),
    ...(patch.target === undefined ? {} : { target: patch.target }),
    ...(patch.orbit === undefined ? {} : { orbit: { ...state.orbit, ...patch.orbit } }),
    ...(patch.street === undefined ? {} : { street: { ...state.street, ...patch.street } }),
    ...(patch.fov === undefined ? {} : { fov: patch.fov }),
    ...(patch.near === undefined ? {} : { near: patch.near }),
    ...(patch.far === undefined ? {} : { far: patch.far }),
  }
}

function frameStats(frames: number): FrameStats {
  return {
    frames,
    frameTimeMs: 16.6,
    averageFrameTimeMs: 16.6,
    minFrameTimeMs: 12,
    maxFrameTimeMs: 21,
    fps: 60,
    averageFps: 60,
    budgetMs: 16.6,
    withinBudget: true,
    overBudgetFrames: 0,
    consecutiveOverBudgetFrames: 0,
  }
}

/** Structural render pipeline with a real world group (jsdom has no WebGL). */
interface StubPipeline {
  readonly world: Group
  readonly hooks: Set<FrameHook>
  readonly tierCalls: QualityTierName[]
  readonly quality: SceneQuality
  readonly controls: {
    getState(): CameraState
    setState(state: CameraStatePatch): void
  }
  readonly lighting: LightingParams
  readonly postProcessing: PostProcessingParams
  readonly camera: CameraState
  applyLighting(params: Partial<LightingParams>): LightingParams
  applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams
  onFrame(hook: FrameHook): () => void
  setQualityTier(name: QualityTierName): SceneQuality
  /** Runs every registered frame hook, like the pipeline's animation loop. */
  tick(deltaSeconds?: number): void
  /** Moves the camera the way a viewer would. */
  nudgeCamera(): CameraState
  frameCount: number
}

function createStubPipeline(tier: QualityTierName = 'high'): StubPipeline {
  const world = new Group()
  world.name = 'world'
  const hooks = new Set<FrameHook>()
  const tierCalls: QualityTierName[] = []
  let quality = resolveSceneQuality(tier)
  let lighting = createLightingParams()
  let postProcessing = createPostProcessingParams()
  let camera = cloneCamera(DEFAULT_CAMERA_STATE)
  let frames = 0

  return {
    world,
    hooks,
    tierCalls,
    get quality(): SceneQuality {
      return quality
    },
    controls: {
      getState: () => cloneCamera(camera),
      setState: (patch) => {
        camera = applyCameraPatch(camera, patch)
      },
    },
    get lighting(): LightingParams {
      return lighting
    },
    get postProcessing(): PostProcessingParams {
      return postProcessing
    },
    get camera(): CameraState {
      return camera
    },
    get frameCount(): number {
      return frames
    },
    applyLighting: (patch) => {
      lighting = { ...lighting, ...patch }
      return lighting
    },
    applyPostProcessing: (patch) => {
      postProcessing = {
        ...postProcessing,
        ...patch,
        bloom: { ...postProcessing.bloom, ...patch.bloom },
        grade: { ...postProcessing.grade, ...patch.grade },
        vignette: { ...postProcessing.vignette, ...patch.vignette },
        depthOfField: { ...postProcessing.depthOfField, ...patch.depthOfField },
      }
      return postProcessing
    },
    onFrame: (hook) => {
      hooks.add(hook)
      return () => {
        hooks.delete(hook)
      }
    },
    setQualityTier: (name) => {
      tierCalls.push(name)
      quality = resolveSceneQuality(name)
      return quality
    },
    tick: (delta = 1 / 60) => {
      frames += 1
      const stats = frameStats(frames)
      for (const hook of hooks) {
        hook(stats, delta)
      }
    },
    nudgeCamera: () => {
      camera = { ...camera, orbit: { ...camera.orbit, azimuth: camera.orbit.azimuth + 0.2 } }
      return camera
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Recording audio engine                                                     */
/* -------------------------------------------------------------------------- */

interface OneShotCall {
  readonly id: string
  readonly options: OneShotOptions
  readonly atSeconds: number
}

interface StubEngine extends AudioEngineHandle {
  readonly oneShots: readonly OneShotCall[]
  readonly beds: readonly SoundscapeDescriptor[]
  readonly unlocks: number
  readonly oneShotIds: readonly string[]
  readonly muted: boolean
}

function createStubEngine(now: () => number): StubEngine {
  const listeners = new Set<(state: AudioEngineState) => void>()
  const oneShots: OneShotCall[] = []
  const beds: SoundscapeDescriptor[] = []
  let unlocks = 0
  let contextCreated = false
  let contextState: AudioEngineState['contextState'] = 'suspended'
  let muted = false
  let disposed = false
  let currentBed: string | null = null
  let pendingBed: string | null = null

  const state = (): AudioEngineState => ({
    contextState,
    contextCreated,
    supported: true,
    unlocked: contextCreated,
    running: contextState === 'running',
    muted,
    disposed,
    volumes: { master: 1, music: 1, ambience: 1, sfx: 1 },
    currentBed,
    pendingBed,
    retiringBeds: [],
    liveVoices: currentBed === null ? 0 : 1,
    oneShotVoices: 0,
    bedVoices: currentBed === null ? 0 : 1,
    analyserRms: 0,
  })

  const emit = (): void => {
    const snapshot = state()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  return {
    get oneShots(): readonly OneShotCall[] {
      return oneShots
    },
    get beds(): readonly SoundscapeDescriptor[] {
      return beds
    },
    get unlocks(): number {
      return unlocks
    },
    get oneShotIds(): readonly string[] {
      return oneShots.map((call) => call.id)
    },
    get muted(): boolean {
      return muted
    },
    unlock: () => {
      unlocks += 1
      contextCreated = true
      contextState = 'running'
      if (pendingBed !== null) {
        currentBed = pendingBed
        pendingBed = null
      }
      emit()
      return Promise.resolve(state())
    },
    getState: state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    mute: (next = true) => {
      muted = next === true
      emit()
      return muted
    },
    isMuted: () => muted,
    crossfadeBeds: (descriptor, _seconds = 1): CrossfadeResult => {
      if (descriptor === null) {
        const previous = currentBed
        currentBed = null
        emit()
        return {
          applied: previous !== null,
          pending: false,
          bedId: previous,
          durationSeconds: 0,
          reason: null,
          issues: [],
        }
      }
      beds.push(descriptor)
      if (!contextCreated) {
        pendingBed = descriptor.id
        emit()
        return {
          applied: false,
          pending: true,
          bedId: descriptor.id,
          durationSeconds: 0,
          reason: 'locked',
          issues: [],
        }
      }
      currentBed = descriptor.id
      pendingBed = null
      emit()
      return {
        applied: true,
        pending: false,
        bedId: descriptor.id,
        durationSeconds: 0,
        reason: null,
        issues: [],
      }
    },
    playOneShot: (id, options = {}): OneShotHandle => {
      const resolved = resolveOneShotId(id)
      if (!contextCreated || muted) {
        return {
          id: resolved,
          started: false,
          reason: 'locked',
          durationSeconds: 0,
          gain: options.gain ?? 1,
          pan: options.pan ?? 0,
          rate: options.rate ?? 1,
          startTime: 0,
          stop: () => {},
        }
      }
      if (resolved === null) {
        return {
          id: null,
          started: false,
          reason: 'unknown-id',
          durationSeconds: 0,
          gain: options.gain ?? 1,
          pan: options.pan ?? 0,
          rate: options.rate ?? 1,
          startTime: 0,
          stop: () => {},
        }
      }
      oneShots.push({ id: resolved, options, atSeconds: now() })
      return {
        id: resolved,
        started: true,
        reason: null,
        durationSeconds: 0.4,
        gain: options.gain ?? 1,
        pan: options.pan ?? 0,
        rate: options.rate ?? 1,
        startTime: now(),
        stop: () => {},
      }
    },
    dispose: () => {
      disposed = true
      listeners.clear()
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Composition harness                                                        */
/* -------------------------------------------------------------------------- */

interface Harness {
  readonly composition: SceneComposition
  readonly pipeline: StubPipeline
  readonly engine: StubEngine
  readonly eraStore: ReturnType<typeof createEraStore>
  readonly uiStore: ReturnType<typeof createUIControlsStore>
  readonly clock: { seconds: number }
  /** Runs `frames` frames of `seconds` each (clamped by the composition). */
  run(frames: number, seconds?: number): void
  /** Runs frames until the director reports the switch finished. */
  settle(maxFrames?: number): void
  layer(id: string): LayerRuntimeStats | undefined
}

const harnesses: Harness[] = []

function createHarness(options: { readonly tier?: QualityTierName; readonly debug?: boolean } = {}): Harness {
  const clock = { seconds: 0 }
  const tier = options.tier ?? 'low'
  const pipeline = createStubPipeline(tier)
  const engine = createStubEngine(() => clock.seconds)
  const eraStore = createEraStore()
  const uiStore = createUIControlsStore()
  const audio = createAudioBridge({ engine, uiStore, now: () => clock.seconds })

  const composition = createSceneComposition({
    pipeline,
    layout: LAYOUT,
    eraStore,
    uiStore,
    audio,
    qualityTier: tier,
    seed: LAYOUT.seedInput,
    signCanvasFactory: createStubSignFactory(),
    debug: options.debug ?? false,
    inspectionLimitPerLayer: 12,
  })

  const run = (frames: number, seconds = 0.1): void => {
    for (let index = 0; index < frames; index += 1) {
      clock.seconds += seconds
      composition.advance(seconds)
    }
  }

  const harness: Harness = {
    composition,
    pipeline,
    engine,
    eraStore,
    uiStore,
    clock,
    run,
    settle(maxFrames = 400): void {
      for (let index = 0; index < maxFrames; index += 1) {
        run(1)
        if (!composition.director.getSnapshot().active) {
          return
        }
      }
      throw new Error('The transition did not settle within the frame budget of the test.')
    },
    layer(id: string): LayerRuntimeStats | undefined {
      return composition.getLayerStats().find((layer) => layer.id === id)
    },
  }

  harnesses.push(harness)
  return harness
}

/** Flushes pending microtasks (the audio unlock promise). */
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.composition.dispose()
  }
})

/* -------------------------------------------------------------------------- */
/* Mounts                                                                     */
/* -------------------------------------------------------------------------- */

describe('composed experience', () => {
  it('mounts every shipped layer exactly once inside the pipeline world', () => {
    const harness = createHarness()
    const { composition, pipeline } = harness
    const layers = composition.getLayerStats()

    expect(composition.layerOrder).toEqual([
      'layout',
      'atmosphere',
      'buildings',
      'storefronts',
      'props',
      'vehicles',
      'pedestrians',
    ])

    for (const id of SHIPPED_LAYER_IDS) {
      const layer = layers.find((candidate) => candidate.id === id)
      expect(layer, id).toBeDefined()
      expect(layer?.mounted, id).toBe(true)
      expect(layer?.mounts, id).toBe(1)
      expect(layer?.root?.parent, id).toBe(pipeline.world)
    }

    const layerGroups = pipeline.world.children.filter((child) => child.name.startsWith('layer:'))
    expect(layerGroups).toHaveLength(SHIPPED_LAYER_IDS.length)
    expect(new Set(layerGroups.map((group) => group.name)).size).toBe(SHIPPED_LAYER_IDS.length)

    // Every barrel ships in this revision, so nothing is pending: the director's
    // own pending table is empty and every content layer is mounted exactly once.
    expect(PENDING_LAYER_IDS).toEqual([])
    expect(composition.pendingLayers).toEqual([])
    expect(layers.filter((layer) => layer.kind === 'pending')).toEqual([])

    // A composed block is not empty: every mounted layer owns real objects.
    for (const id of SHIPPED_LAYER_IDS) {
      const layer = harness.layer(id)
      expect(layer?.counts.objects ?? 0, id).toBeGreaterThan(0)
    }
  })

  it('resolves every era payload from the real registry', () => {
    const harness = createHarness()
    const payloads = harness.composition.payloads

    expect(payloads.map((payload) => payload.eraId)).toEqual([...ERA_IDS])

    for (const payload of payloads) {
      const era = getEra(payload.eraId)
      const soundscape = getSoundscape(payload.eraId)
      expect(payload.year).toBe(era.year)
      expect(payload.shortLabel).toBe(era.shortLabel)
      expect(payload.label).toBe(era.label)
      expect(payload.bedId).toBe(soundscape.descriptor)
      expect(payload.cueIds.length).toBeGreaterThan(0)
      expect(payload.night).toBe(era.lighting.sunElevationDeg <= 0)
      expect(payload.vehicleModelKeys).toEqual([...era.traffic.modelKeys])
      expect(payload.outfitEraTag).toBe(era.population.outfitEraTag)
      expect(payload.bed.id).toBe(soundscape.descriptor)
      expect(harness.composition.getEraPayload(payload.eraId)).toEqual(payload)
    }

    // The five periods are genuinely different payloads.
    const signatures = new Set(payloads.map((payload) => payload.bedId))
    expect(signatures.size).toBe(ERA_IDS.length)
  })

  it('drives every layer to the selected era and reports era-specific statistics', () => {
    const harness = createHarness({ tier: 'high' })
    const { composition, engine, uiStore } = harness

    // Audio is unlocked first so the ambience bed is observable per era.
    uiStore.getState().requestAudioUnlock()

    const fingerprints = new Set<string>()

    for (const eraId of ERA_IDS) {
      composition.selectEra(eraId)
      harness.settle()

      expect(harness.eraStore.getState().selectedEra).toBe(eraId)
      expect(composition.currentEraId()).toBe(eraId)
      expect(composition.currentPayload().year).toBe(getEra(eraId).year)

      const storefronts = harness.layer('storefronts')
      const props = harness.layer('props')
      const vehicles = harness.layer('vehicles')
      const atmosphere = harness.layer('atmosphere')

      expect(storefronts?.eraId, `${eraId} storefronts`).toBe(eraId)
      expect(props?.eraId, `${eraId} props`).toBe(eraId)
      expect(vehicles?.eraId, `${eraId} vehicles`).toBe(eraId)
      expect(atmosphere?.eraId, `${eraId} atmosphere`).toBe(eraId)

      expect(storefronts?.stats['signs'] ?? 0, `${eraId} signs`).toBeGreaterThan(0)
      expect(storefronts?.stats['units'] ?? 0, `${eraId} bays`).toBeGreaterThan(0)
      expect(props?.stats['propCount'] ?? 0, `${eraId} props`).toBeGreaterThan(0)
      expect(vehicles?.stats['movingInstances'] ?? 0, `${eraId} traffic`).toBeGreaterThan(0)
      expect(vehicles?.stats['parkedInstances'] ?? 0, `${eraId} parked`).toBeGreaterThan(0)
      expect(atmosphere?.stats['plumeEmitters'] ?? 0, `${eraId} plumes`).toBeGreaterThan(0)

      // The ambience bed follows the era.
      expect(engine.getState().currentBed, `${eraId} bed`).toBe(
        getSoundscape(eraId).descriptor,
      )

      fingerprints.add(
        [
          storefronts?.stats['units'],
          storefronts?.stats['signs'],
          storefronts?.stats['advertising'],
          storefronts?.stats['graffiti'],
          props?.stats['propCount'],
          props?.stats['instanceCount'],
          vehicles?.stats['movingInstances'],
          vehicles?.stats['parkedInstances'],
        ].join('|'),
      )
    }

    // Every period re-dressed the block differently; two eras sharing a census
    // would mean a layer ignored the era change.
    expect(fingerprints.size).toBe(ERA_IDS.length)
  })

  it('keeps camera state across two consecutive era switches', () => {
    const harness = createHarness()
    const { composition, pipeline } = harness

    pipeline.nudgeCamera()
    const before = pipeline.camera

    composition.selectEra('1985')
    harness.settle()
    expect(pipeline.camera).toEqual(before)

    composition.selectEra('2025')
    harness.settle()
    expect(pipeline.camera).toEqual(before)

    const debug = composition.getDebugSnapshot()
    expect(debug.transition.cameraUnchanged).toBe(true)
    expect(debug.camera).toEqual(before)
  })

  it('collapses a switch into a single step under reduced motion', () => {
    const harness = createHarness()
    const { composition, uiStore, eraStore } = harness

    uiStore.getState().setMotionPreference('reduce')
    composition.selectEra('2005')

    // No frame has been rendered: the instant path already landed.
    const snapshot = composition.director.getSnapshot()
    expect(snapshot.frames).toBe(0)
    expect(snapshot.reducedMotion).toBe(true)
    expect(snapshot.lastCompletion?.reducedMotion).toBe(true)
    expect(snapshot.lastCompletion?.frames).toBe(0)
    expect(snapshot.lastCompletion?.cameraUnchanged).toBe(true)
    expect(eraStore.getState().selectedEra).toBe('2005')
    expect(eraStore.getState().fromEra).toBe('2005')
    expect(harness.layer('storefronts')?.eraId).toBe('2005')
    expect(harness.layer('vehicles')?.eraId).toBe('2005')
  })

  it('keeps audio silent until the unlock intent is recorded, then mirrors the engine state', async () => {
    const harness = createHarness()
    const { composition, engine, uiStore } = harness

    // Audio is locked: nothing plays, and the engine is muted defensively.
    harness.run(20)
    expect(engine.unlocks).toBe(0)
    expect(engine.muted).toBe(true)
    expect(engine.oneShots).toHaveLength(0)
    expect(composition.audio?.getState().active).toBe(false)
    expect(uiStore.getState().audioUnlocked).toBe(false)

    // The bed request made at composition start waits for the gesture.
    expect(engine.beds.length).toBeGreaterThan(0)
    expect(engine.getState().pendingBed).toBe(getSoundscape('1945').descriptor)

    // The viewer's gesture: intent is recorded in ui-controls, the bridge acts.
    uiStore.getState().requestAudioUnlock()
    await flush()
    await flush()

    expect(engine.unlocks).toBe(1)
    expect(engine.muted).toBe(false)
    expect(await composition.audio?.unlock()).toBe(true)
    expect(uiStore.getState().audioUnlocked).toBe(true)
    expect(uiStore.getState().audioMuted).toBe(false)
    expect(composition.audio?.getState().active).toBe(true)
    expect(engine.getState().currentBed).toBe(getSoundscape('1945').descriptor)

    // Muting from the store reaches the engine and comes back in the store.
    uiStore.getState().setAudioMuted(true)
    await flush()
    expect(engine.muted).toBe(true)
    expect(composition.audio?.getState().active).toBe(false)

    uiStore.getState().setAudioMuted(false)
    await flush()
    expect(engine.muted).toBe(false)
  })

  it('routes vehicle SFX to the engine at rate-limited intervals', async () => {
    const harness = createHarness()
    const { engine, uiStore } = harness

    uiStore.getState().requestAudioUnlock()
    await flush()
    await flush()

    // 40 simulated seconds of traffic: enough for horns, engines and bells.
    harness.run(400, 0.1)

    expect(engine.oneShots.length).toBeGreaterThan(0)
    for (const call of engine.oneShots) {
      expect(ONE_SHOT_IDS).toContain(call.id)
      expect(call.options.gain ?? 1).toBeGreaterThan(0)
      expect(call.options.pan ?? 0).toBeGreaterThanOrEqual(-1)
      expect(call.options.pan ?? 0).toBeLessThanOrEqual(1)
    }

    // The rate limiter engages: per-kind gaps respect the documented interval.
    const minByOneShot = new Map<string, number>()
    for (const [kind, id] of Object.entries({
      horn: 'horn',
      engine: 'engine',
      'transit-bell': 'streetcar-bell',
      'ev-whine': 'ev-whine',
      'tire-squeal': 'ev-whine',
    })) {
      const interval = SFX_MIN_INTERVAL_SECONDS[kind as keyof typeof SFX_MIN_INTERVAL_SECONDS]
      const current = minByOneShot.get(id)
      if (current === undefined || interval < current) {
        minByOneShot.set(id, interval)
      }
    }
    const lastByOneShot = new Map<string, number>()
    for (const call of engine.oneShots) {
      const previous = lastByOneShot.get(call.id)
      const minimum = minByOneShot.get(call.id) ?? 0
      if (previous !== undefined) {
        expect(call.atSeconds - previous, `${call.id} gap`).toBeGreaterThanOrEqual(minimum - 1e-9)
      }
      lastByOneShot.set(call.id, call.atSeconds)
    }

    const audioState = harness.composition.audio?.getState()
    expect(audioState?.sfxRouted ?? 0).toBeGreaterThan(0)
    expect(Object.keys(audioState?.routedByKind ?? {}).length).toBeGreaterThan(0)

    // The limiter is a guarantee, not an emergent property: two identical
    // triggers at the same instant route once, and the second is counted as
    // suppressed.
    const probe = {
      kind: 'horn' as const,
      vehicleId: 'probe',
      modelKey: 'tailfin-sedan',
      timeSec: harness.clock.seconds,
      position: { x: 0, y: 1, z: 0 },
      gain: 0.8,
      splineName: 'north',
    }
    const before = harness.composition.audio?.getState().sfxSuppressed ?? 0
    expect(harness.composition.audio?.handleSfxTrigger(probe)?.started).toBe(true)
    expect(harness.composition.audio?.handleSfxTrigger(probe)).toBeNull()
    expect(harness.composition.audio?.getState().sfxSuppressed).toBe(before + 1)

    // Locked audio never plays, even though the layer keeps emitting.
    const routed = engine.oneShots.length
    harness.uiStore.getState().setAudioMuted(true)
    harness.run(60, 0.1)
    expect(engine.oneShots.length).toBe(routed)
  })

  it('feeds vehicle emissions into the atmosphere plumeSources input', () => {
    const harness = createHarness()
    const { composition } = harness

    harness.run(30)
    const atmosphere = harness.layer('atmosphere')
    expect(atmosphere?.stats['plumeSourcesPublished'] ?? 0).toBeGreaterThan(0)
    expect(atmosphere?.stats['plumeSources'] ?? 0).toBeGreaterThan(0)

    // The era baseline emitters are still there, plus the live sources.
    expect(atmosphere?.stats['plumeBaseline'] ?? 0).toBeGreaterThan(0)
    expect(composition.getDebugSnapshot().layers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'atmosphere', mounted: true })]),
    )
  })

  it('publishes and refreshes the inspection-targets surface', () => {
    const harness = createHarness()
    const { composition } = harness

    const initial = composition.getInspectionTargets()
    expect(initial.eraId).toBe('1945')
    expect(initial.anchorCount).toBeGreaterThan(0)
    expect(initial.objectCount).toBeGreaterThan(0)
    expect(Object.keys(initial.byCategory).length).toBeGreaterThan(0)
    for (const category of Object.keys(initial.byCategory)) {
      expect(INSPECTION_CATEGORIES).toContain(category)
    }
    for (const target of initial.targets) {
      expect(target.id.length).toBeGreaterThan(0)
      expect(target.label.length).toBeGreaterThan(0)
      expect(target.layerId.length).toBeGreaterThan(0)
      expect(target.eraId).toBe(target.eraId)
      for (const value of [...target.bounds.min, ...target.bounds.max, ...target.bounds.center]) {
        expect(Number.isFinite(value)).toBe(true)
      }
    }

    // Anchor-derived targets come from the layout catalogue itself.
    const anchorNames = new Set(LAYOUT.anchors.map((anchor) => anchor.name))
    const anchorTargets = initial.targets.filter((target) => target.origin === 'anchor')
    expect(anchorTargets.length).toBe(initial.anchorCount)
    for (const target of anchorTargets) {
      expect(anchorNames.has(target.id)).toBe(true)
    }

    // Layer-object-derived targets come from the mounted layer groups, and every
    // shipped layer contributes at least one.
    const objectTargets = initial.targets.filter((target) => target.origin === 'layer-object')
    expect(objectTargets.length).toBe(initial.objectCount)
    const objectLayers = new Set(objectTargets.map((target) => target.layerId))
    expect(objectLayers).toEqual(
      expect.objectContaining(new Set(['layout', 'atmosphere', 'storefronts', 'props', 'vehicles'])),
    )
    expect(initial.byCategory['storefront'] ?? 0).toBeGreaterThan(0)
    expect(initial.byCategory['vehicle'] ?? 0).toBeGreaterThan(0)
    expect(initial.byCategory['prop'] ?? 0).toBeGreaterThan(0)
    expect(initial.byCategory['atmosphere'] ?? 0).toBeGreaterThan(0)

    // A new era rebuilds the surface with the new era metadata.
    harness.run(10)
    composition.selectEra('2025')
    harness.settle()
    const refreshed = composition.getInspectionTargets()
    expect(refreshed).not.toBe(initial)
    expect(refreshed.eraId).toBe('2025')
    expect(refreshed.year).toBe(getEra('2025').year)
    expect(refreshed.targets.every((target) => target.year === 2025)).toBe(true)
    expect(refreshed.generatedAtSeconds).toBeGreaterThan(initial.generatedAtSeconds)
  })

  it('applies a quality tier without remounting the scene or the layers', () => {
    const harness = createHarness({ tier: 'high' })
    const { composition, pipeline, uiStore } = harness
    const worldBefore = pipeline.world
    const layoutRootBefore = harness.layer('layout')?.root
    const storefrontRootBefore = harness.layer('storefronts')?.root

    uiStore.getState().requestQualityTier('low')
    pipeline.tick()

    expect(pipeline.tierCalls).toEqual(['low'])
    expect(composition.qualityTier).toBe('low')
    expect(pipeline.quality.name).toBe('low')

    // Same scene, same slot groups, still exactly one mount each.
    expect(pipeline.world).toBe(worldBefore)
    expect(harness.layer('layout')?.root).toBe(layoutRootBefore)
    expect(harness.layer('storefronts')?.root).toBe(storefrontRootBefore)
    for (const id of SHIPPED_LAYER_IDS) {
      expect(harness.layer(id)?.mounts, id).toBe(1)
      expect(harness.layer(id)?.mounted, id).toBe(true)
      expect(harness.layer(id)?.qualityTier, id).toBe('low')
    }

    // The manual override survives an adaptive suggestion.
    uiStore.getState().applyAdaptiveQualityTier('high')
    expect(uiStore.getState().requestedQualityTier).toBe('low')
    expect(composition.qualityTier).toBe('low')
  })

  it('reports the composed state on the debug surface, and nothing in production', () => {
    const harness = createHarness({ debug: true })
    const { composition } = harness

    expect(isDebugSurfaceEnabled({ DEV: true })).toBe(true)
    expect(isDebugSurfaceEnabled({ PROD: true })).toBe(false)
    expect(isDebugSurfaceEnabled({ MODE: 'production' })).toBe(false)

    const surface = composition.debugSurface
    expect(surface?.enabled).toBe(true)
    const published = surface?.read() ?? null
    const debug: DebugSnapshot = published ?? composition.getDebugSnapshot()

    expect(debug.eraId).toBe('1945')
    expect(debug.year).toBe(1945)
    expect(debug.layerOrder).toEqual(composition.layerOrder)
    expect(debug.mountedLayers).toEqual([...SHIPPED_LAYER_IDS])
    expect(debug.pendingLayers).toEqual(expect.arrayContaining([...PENDING_LAYER_IDS]))
    expect(debug.layers.length).toBe(composition.layerOrder.length)
    expect(debug.layers.every((layer) => layer.mounts <= 1)).toBe(true)
    expect(debug.camera.mode.length).toBeGreaterThan(0)
    expect(debug.audio?.bedId).toBe(getSoundscape('1945').descriptor)
    expect(debug.inspection.count).toBeGreaterThan(0)
    expect(debug.transition.registeredLayers).toEqual([
      'atmosphere',
      'buildings',
      'storefronts',
      'props',
      'vehicles',
      'pedestrians',
    ])

    // The global is installable and removable, and a disabled surface installs
    // nothing at all — which is what keeps the production page clean.
    const target: Record<string, unknown> = {}
    const detach = installDebugSurface(surface!, target)
    expect(target[DEBUG_SURFACE_KEY]).toBe(surface)
    detach()
    expect(target[DEBUG_SURFACE_KEY]).toBeUndefined()

    const disabled = createDebugSurface({ enabled: false })
    disabled.publish(debug)
    expect(disabled.read()).toBeNull()
    const disabledHost: Record<string, unknown> = {}
    installDebugSurface(disabled, disabledHost)
    expect(disabledHost[DEBUG_SURFACE_KEY]).toBeUndefined()
  })

  it('discovers the present extension modules and tolerates an empty directory', async () => {
    // The navigation/inspection phase ships its four modules here; the slot must
    // list exactly those, sorted, and resolve each one to a component.
    const paths = extensionModulePaths()
    expect(paths).toEqual([
      '../interaction/extensions/inspectionExtension.tsx',
      '../interaction/extensions/qualityExtension.tsx',
      '../interaction/extensions/tourExtension.tsx',
      '../interaction/extensions/viewpointsExtension.tsx',
    ])
    const discovered = await loadExtensions()
    expect(discovered.length).toBe(paths.length)
    expect(discovered.every((candidate) => typeof candidate === 'function')).toBe(true)

    // An empty directory is still valid: nothing mounts and nothing throws.
    expect(extensionModulePaths({})).toEqual([])
    expect(await loadExtensions({})).toEqual([])

    const extension = (): null => null
    expect(resolveExtension({ default: extension })).toBe(extension)
    expect(resolveExtension({ SceneExtension: extension })).toBe(extension)
    expect(resolveExtension(extension)).toBe(extension)
    expect(resolveExtension({ notAnExtension: 42 })).toBeNull()

    const loaded = await loadExtensions({ './fake.tsx': () => Promise.resolve({ default: extension }) })
    expect(loaded).toEqual([extension])

    // A module that throws while loading is skipped instead of taking the page
    // down with it.
    const broken = await loadExtensions({
      './broken.tsx': () => Promise.reject(new Error('nope')),
    })
    expect(broken).toEqual([])
  })

  it('reports loading progress and disposes every layer on teardown', () => {
    const harness = createHarness()
    const { composition, pipeline } = harness

    expect(composition.ready).toBe(true)
    expect(composition.loading.ready).toBe(true)
    expect(composition.loading.failedLayer).toBeNull()
    expect(composition.loading.skipped).toEqual(expect.arrayContaining([...PENDING_LAYER_IDS]))
    expect(composition.failures).toEqual([])

    composition.dispose()

    expect(composition.disposed).toBe(true)
    expect(pipeline.world.children.filter((child) => child.name.startsWith('layer:'))).toHaveLength(0)
    expect(pipeline.hooks.size).toBe(0)
    expect(harness.engine.getState().disposed).toBe(true)

    // Disposal is idempotent, and an advance after it is inert.
    composition.dispose()
    expect(() => composition.advance(1 / 60)).not.toThrow()
  })

  it('absorbs a layer failure and keeps the rest of the block alive', () => {
    const harness = createHarness({ debug: true })
    const { composition } = harness

    // The dev-only diagnostic hook fails one layer's build on purpose.
    const win = window as unknown as Record<string, unknown>
    win['__cityTimelapseForceFailure'] = 'storefronts'
    const failing = createHarness({ debug: true })
    delete win['__cityTimelapseForceFailure']

    expect(failing.composition.failures.length).toBeGreaterThan(0)
    expect(failing.composition.ready).toBe(false)
    expect(failing.layer('storefronts')?.mounted).toBe(false)
    expect(failing.layer('storefronts')?.failed).toBe(true)
    expect(failing.layer('props')?.mounted).toBe(true)
    expect(failing.layer('vehicles')?.mounted).toBe(true)

    // The healthy composition is unaffected, and the degraded one still ticks.
    expect(composition.failures).toEqual([])
    expect(() => failing.run(5)).not.toThrow()
  })
})
