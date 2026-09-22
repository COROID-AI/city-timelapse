/**
 * Composition proof of the staged era transition director.
 *
 * Nothing here is a stand-in for the transition contract: the director runs over
 * the *real* era registry, the *real* era store, the *real* ui-controls store,
 * the *real* block layout, the *real* `applyEra` / `applyEraTransition` functions
 * of every shipped scene layer (wired by the shipped
 * `createSceneLayerAdapters`), the *real* navigation controls and the *real*
 * audio port over a stub engine.
 *
 * It proves the acceptance claims end to end:
 *
 * - a 1945 → 2025 switch drives every shipped layer to the target, in the
 *   schedule's order, and the composed result equals a direct `applyEra`;
 * - the switch reports start, progress and completion through the era store;
 * - a mid-transition retarget to a third era continues from the dominant era and
 *   lands exactly on the newest selection, monotonically and without overshoot;
 * - one ambience crossfade plus era cue SFX are requested per switch, and the bed
 *   the director hands the engine is a descriptor the audio module validates;
 * - reduced motion applies the target in a single step while still crossfading;
 * - the camera is captured and restored: layers that move it lose, the viewer's
 *   own navigation survives, and the framing is identical across a switch.
 */

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ERA_IDS, getSoundscape, type EraId } from '../../src/era'
import { createEraStore, subscribeToTransitionProgress } from '../../src/state/eraStore'
import { createUIControlsStore, resolveReducedMotion } from '../../src/ui/uiStore'
import type { UIControlsStore } from '../../src/ui/uiStore'
import { DEFAULT_LAYOUT_SEED, generateBlock } from '../../src/city/layout'
import * as storefronts from '../../src/city/storefronts'
import * as props from '../../src/city/props'
import * as vehicles from '../../src/city/vehicles'
import * as vfx from '../../src/vfx'
import type { VfxTarget } from '../../src/vfx'
import {
  createLightingParams,
  createPostProcessingParams,
  createNavigationControls,
} from '../../src/scene'
import type {
  LightingParams,
  NavigationControls,
  PostProcessingParams,
  PostProcessingParamsPatch,
} from '../../src/scene'
import {
  ONE_SHOT_IDS,
  resolveOneShotId,
  validateSoundscapeDescriptor,
} from '../../src/audio'
import type { AudioEngine, CrossfadeResult, OneShotHandle, OneShotOptions, SoundscapeDescriptor } from '../../src/audio'
import {
  PENDING_LAYER_STAGES,
  SOUNDSCAPE_STAGE_ID,
  TRANSITION_STAGE_ORDER,
  createAudioEnginePort,
  createManualClock,
  createNavigationCameraPort,
  createSceneLayerAdapters,
  createTransitionDirector,
  createUIControlsMotionPort,
  isMonotonic,
  resolveCueOneShotId,
  selectEraCues,
  soundscapeToBedDescriptor,
  useTransitionDirector,
  type ManualClock,
  type SceneLayerAdapters,
  type TransitionDirector,
  type TransitionDirectorSnapshot,
  type TransitionLayerAdapter,
  type TransitionStageId,
} from '../../src/transition'
import { hashValue } from '../support/hash'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const LAYOUT = generateBlock(DEFAULT_LAYOUT_SEED)
const QUALITY = 'high' as const

/** Bounds the director is allowed to protect while it applies frames. */
const CAMERA_TRAMPLE = 0.05

/**
 * Structural stand-in for the render pipeline's atmosphere surface.
 *
 * jsdom has no WebGL, so the pipeline's canvas host cannot run; the atmosphere
 * only ever talks to `applyLighting` / `applyPostProcessing`, and this target
 * applies those through the pipeline's *own* parameter builders, so the values
 * the layer writes are the values the real pipeline would hold.
 */
interface RecordingVfxTarget extends VfxTarget {
  lighting: LightingParams
  postProcessing: PostProcessingParams
  writes: number
}

function createVfxTarget(): RecordingVfxTarget {
  const target: RecordingVfxTarget = {
    lighting: createLightingParams(),
    postProcessing: createPostProcessingParams(),
    writes: 0,
    applyLighting(params: Partial<LightingParams>): LightingParams {
      target.writes += 1
      target.lighting = createLightingParams(params, target.lighting)
      return target.lighting
    },
    applyPostProcessing(params: PostProcessingParamsPatch): PostProcessingParams {
      target.writes += 1
      target.postProcessing = createPostProcessingParams(params, target.postProcessing)
      return target.postProcessing
    },
  }
  return target
}

/** Stub audio engine: the director's port is real, the WebAudio graph is not. */
interface StubEngine extends Pick<AudioEngine, 'crossfadeBeds' | 'playOneShot'> {
  readonly bedRequests: Array<{ id: string | null; seconds: number; issues: number }>
  readonly shotRequests: Array<{ id: string; options: OneShotOptions }>
}

function createStubEngine(): StubEngine {
  const bedRequests: StubEngine['bedRequests'] = []
  const shotRequests: StubEngine['shotRequests'] = []
  return {
    bedRequests,
    shotRequests,
    crossfadeBeds(descriptor: SoundscapeDescriptor | null, seconds = 1.5): CrossfadeResult {
      // The engine validates every descriptor it is handed; record that verdict.
      const validation = validateSoundscapeDescriptor(descriptor)
      bedRequests.push({
        id: descriptor?.id ?? null,
        seconds,
        issues: validation.issues.length,
      })
      return {
        applied: descriptor !== null,
        pending: false,
        bedId: descriptor?.id ?? null,
        durationSeconds: seconds,
        reason: validation.valid ? null : 'invalid-descriptor',
        issues: validation.issues,
      }
    },
    playOneShot(id: string, options: OneShotOptions = {}): OneShotHandle {
      shotRequests.push({ id, options })
      return {
        id: resolveOneShotId(id),
        started: true,
        reason: null,
        durationSeconds: 0.5,
        gain: options.gain ?? 1,
        pan: options.pan ?? 0,
        rate: options.rate ?? 1,
        startTime: 0,
        stop: () => {},
      }
    },
  }
}

/** One request a stage received, recorded by {@link recordingAdapter}. */
interface RecordedRequest {
  readonly id: TransitionStageId
  readonly kind: 'era' | 'transition'
  readonly from: EraId
  readonly to: EraId
  readonly t: number
}

function recordingAdapter(
  adapter: TransitionLayerAdapter,
  log: RecordedRequest[],
): TransitionLayerAdapter {
  return {
    id: adapter.id,
    label: adapter.label,
    applyEra(request) {
      const application = adapter.applyEra(request)
      log.push({ id: adapter.id, kind: 'era', from: request.eraId, to: request.eraId, t: 1 })
      return application
    },
    applyEraTransition(request) {
      const application = adapter.applyEraTransition(request)
      log.push({
        id: adapter.id,
        kind: 'transition',
        from: request.from,
        to: request.to,
        t: request.t,
      })
      return application
    },
  }
}

/** Makes a layer misbehave: every application nudges the viewer's camera. */
function tramplingAdapter(
  adapter: TransitionLayerAdapter,
  controls: NavigationControls,
): TransitionLayerAdapter {
  return {
    id: adapter.id,
    label: adapter.label,
    applyEra(request) {
      const application = adapter.applyEra(request)
      controls.orbitBy(CAMERA_TRAMPLE, 0)
      return application
    },
    applyEraTransition(request) {
      const application = adapter.applyEraTransition(request)
      controls.orbitBy(CAMERA_TRAMPLE, 0)
      return application
    },
  }
}

interface ComposedHarness {
  readonly wiring: SceneLayerAdapters
  readonly store: ReturnType<typeof createEraStore>
  readonly uiStore: UIControlsStore
  readonly clock: ManualClock
  readonly controls: NavigationControls
  readonly target: RecordingVfxTarget
  readonly engine: StubEngine
  readonly requests: RecordedRequest[]
  readonly director: TransitionDirector
  run(untilSeconds: number, step?: number): TransitionDirectorSnapshot
  snapshot(): TransitionDirectorSnapshot
}

async function compose(options: {
  readonly reducedMotion?: boolean
  readonly trampleCamera?: boolean
} = {}): Promise<ComposedHarness> {
  const target = createVfxTarget()
  const wiring = await createSceneLayerAdapters({
    layout: LAYOUT,
    atmosphere: target,
    qualityTier: QUALITY,
  })
  const store = createEraStore('1945')
  const uiStore = createUIControlsStore({
    motionPreference: options.reducedMotion === true ? 'reduce' : 'no-preference',
  })
  const clock = createManualClock(0)
  const controls = createNavigationControls()
  const engine = createStubEngine()
  const requests: RecordedRequest[] = []
  const wrapped = wiring.adapters.map((adapter) =>
    options.trampleCamera === true
      ? tramplingAdapter(recordingAdapter(adapter, requests), controls)
      : recordingAdapter(adapter, requests),
  )
  const director = createTransitionDirector({
    store,
    layers: wrapped,
    audio: createAudioEnginePort(engine),
    camera: createNavigationCameraPort(controls),
    motion: createUIControlsMotionPort(uiStore),
    clock,
  })

  return {
    wiring,
    store,
    uiStore,
    clock,
    controls,
    target,
    engine,
    requests,
    director,
    run(untilSeconds: number, step = 0.05): TransitionDirectorSnapshot {
      let guard = 0
      while (clock.seconds < untilSeconds - 1e-9 && guard < 20_000) {
        clock.advance(step)
        director.tick()
        guard += 1
      }
      return director.getSnapshot()
    },
    snapshot(): TransitionDirectorSnapshot {
      return director.getSnapshot()
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                */
/* -------------------------------------------------------------------------- */

describe('director composed with the real registry, stores and scene layers', () => {
  it('wires every shipped layer barrel and names the stages still pending one', async () => {
    const harness = await compose()

    expect(harness.wiring.wired).toEqual([
      'atmosphere',
      'buildings',
      'storefronts',
      'props',
      'vehicles',
      'pedestrians',
    ])
    expect(harness.wiring.pending).toEqual(PENDING_LAYER_STAGES)
    // Every documentation row for a pending stage is scheduled with a real window.
    for (const id of harness.wiring.pending) {
      const entry = harness.director.resolvedSchedule.entryFor(id)
      expect(entry.durationSeconds).toBeGreaterThan(0)
      expect(entry.startSeconds).toBeGreaterThanOrEqual(0)
    }
    expect(harness.snapshot().stageOrder).toEqual(TRANSITION_STAGE_ORDER)
    expect(harness.snapshot().pendingStages).toEqual(PENDING_LAYER_STAGES)
    harness.wiring.dispose()
  })

  it('drives every real layer to the target, in schedule order, and equals a direct switch', async () => {
    const harness = await compose()
    const progressSeen: number[] = []
    subscribeToTransitionProgress(harness.store, (progress) => progressSeen.push(progress))

    harness.director.selectEra('2025')
    const started = harness.snapshot()
    expect(started).toMatchObject({ active: true, fromEra: '1945', toEra: '2025', frames: 1 })
    expect(harness.store.getState()).toMatchObject({ selectedEra: '2025', fromEra: '1945', toEra: '2025' })

    // Staggered start: at one second the atmosphere is moving and props are not.
    harness.run(1.0)
    const staggered = harness.snapshot().layerFrames
    expect(staggered.find((frame) => frame.id === 'atmosphere')?.progress).toBeGreaterThan(0)
    expect(staggered.find((frame) => frame.id === 'props')?.progress).toBe(0)
    expect(staggered.find((frame) => frame.id === SOUNDSCAPE_STAGE_ID)?.started).toBe(false)

    const traced: number[] = []
    while (harness.director.active) {
      harness.clock.advance(0.05)
      harness.director.tick()
      traced.push(harness.snapshot().progress)
    }
    expect(isMonotonic(traced)).toBe(true)
    expect(traced.at(-1)).toBe(1)
    expect(progressSeen[progressSeen.length - 1]).toBe(0)
    expect(progressSeen).toContain(1)
    expect(harness.store.getState()).toMatchObject({
      selectedEra: '2025',
      fromEra: '2025',
      toEra: '2025',
      progress: 0,
    })
    expect(harness.snapshot().lastCompletion).toMatchObject({
      fromEra: '1945',
      toEra: '2025',
      progress: 1,
      reducedMotion: false,
      cameraUnchanged: true,
    })

    // Layer order of the very first frame is the documented theatrical order.
    const firstFrame = harness.requests.slice(0, harness.wiring.wired.length)
    expect(firstFrame.map((request) => request.id)).toEqual(harness.wiring.wired)
    expect(firstFrame.every((request) => request.kind === 'transition' && request.t === 0)).toBe(true)

    // Every stage's own progress only ever grows and lands on exactly 1.
    for (const id of harness.wiring.wired) {
      const series = harness.requests.filter((request) => request.id === id).map((request) => request.t)
      expect(isMonotonic(series), `${id} is monotone`).toBe(true)
      const last = harness.requests.filter((request) => request.id === id).at(-1)
      expect(last).toMatchObject({ to: '2025', t: 1 })
    }

    // The composed result equals a direct era switch, layer by layer.
    const composed = {
      atmosphere: hashValue(harness.wiring.readings.atmosphere),
      storefronts: hashValue(harness.wiring.readings.storefronts),
      props: hashValue(harness.wiring.readings.props),
      vehicles: hashValue(harness.wiring.readings.vehicles),
    }
    const directTarget = harness.target
    const direct = {
      atmosphere: hashValue(
        vfx.applyEra('2025', { target: directTarget, qualityTier: QUALITY }),
      ),
      storefronts: hashValue(storefronts.applyEra('2025', { layout: LAYOUT, qualityTier: QUALITY })),
      props: hashValue(
        props.applyEra('2025', {
          runtime: harness.wiring.propsRuntime,
        }),
      ),
      vehicles: hashValue(
        vehicles.applyEra('2025', { layout: LAYOUT, quality: QUALITY }),
      ),
    }
    expect(composed).toEqual(direct)
    expect(vehicles.eraPlan('2025').eraId).toBe('2025')

    harness.wiring.dispose()
  })

  it('equals a direct era switch for every era the registry ships', async () => {
    const harness = await compose()

    for (const eraId of ERA_IDS) {
      if (eraId === '1945') {
        continue
      }
      harness.director.selectEra(eraId)
      let guard = 0
      while (harness.director.active && guard < 500) {
        harness.clock.advance(0.2)
        harness.director.tick()
        guard += 1
      }

      const snapshot = harness.snapshot()
      expect(snapshot.active, `${eraId} settles`).toBe(false)
      expect(snapshot.lastCompletion).toMatchObject({ toEra: eraId, progress: 1 })
      expect(harness.store.getState()).toMatchObject({ fromEra: eraId, toEra: eraId, progress: 0 })

      // Each shipped layer's own result equals a direct era application.
      expect(hashValue(harness.wiring.readings.atmosphere), `${eraId} atmosphere`).toBe(
        hashValue(vfx.applyEra(eraId, { target: harness.target, qualityTier: QUALITY })),
      )
      expect(hashValue(harness.wiring.readings.storefronts), `${eraId} storefronts`).toBe(
        hashValue(storefronts.applyEra(eraId, { layout: LAYOUT, qualityTier: QUALITY })),
      )
      expect(hashValue(harness.wiring.readings.props), `${eraId} props`).toBe(
        hashValue(props.applyEra(eraId, { runtime: harness.wiring.propsRuntime })),
      )
      expect(hashValue(harness.wiring.readings.vehicles), `${eraId} vehicles`).toBe(
        hashValue(vehicles.applyEra(eraId, { layout: LAYOUT, quality: QUALITY })),
      )
      expect(harness.wiring.propsRuntime.eraId).toBe(eraId)
      expect(harness.engine.bedRequests.at(-1)?.id).toBe(getSoundscape(eraId).descriptor)
      expect(harness.engine.bedRequests.at(-1)?.issues).toBe(0)
    }

    harness.wiring.dispose()
  })

  it('retargets mid-transition from the dominant era and lands on the newest selection', async () => {
    const points = [
      { elapsed: 0.5, dominant: '1945', label: 'early, still leaving 1945' },
      { elapsed: 1.5, dominant: '1945', label: 'mid-flight, still leaving 1945' },
      { elapsed: 4.0, dominant: '2025', label: 'late, already arriving at 2025' },
    ] as const

    for (const point of points) {
      const harness = await compose()
      harness.director.selectEra('2025')
      harness.run(point.elapsed)
      const before = harness.snapshot()
      expect(before.active, point.label).toBe(true)
      expect(before.progress > 0.5, point.label).toBe(point.dominant === '2025')

      harness.director.selectEra('1985')
      const retargeted = harness.snapshot()
      expect(retargeted.toEra, point.label).toBe('1985')
      expect(retargeted.fromEra, point.label).toBe(point.dominant)
      expect(retargeted.retargetCount).toBe(1)
      expect(retargeted.progress, point.label).toBeCloseTo(before.progress, 12)
      expect(harness.store.getState(), point.label).toMatchObject({
        selectedEra: '1985',
        fromEra: point.dominant,
        toEra: '1985',
      })

      const traced: number[] = [retargeted.progress]
      let guard = 0
      while (harness.director.active && guard < 500) {
        harness.clock.advance(0.2)
        harness.director.tick()
        traced.push(harness.snapshot().progress)
        guard += 1
      }

      expect(isMonotonic(traced), `${point.label}: monotone`).toBe(true)
      expect(Math.max(...traced), point.label).toBe(1)
      expect(traced.at(-1), point.label).toBe(1)
      for (const id of harness.wiring.wired) {
        const series = harness.requests.filter((request) => request.id === id)
        expect(
          isMonotonic(series.map((request) => request.t)),
          `${point.label}: ${id} never restarts`,
        ).toBe(true)
        expect(series.at(-1), `${point.label}: ${id} lands on 1985`).toMatchObject({
          to: '1985',
          t: 1,
        })
      }
      expect(harness.snapshot().lastCompletion).toMatchObject({ fromEra: point.dominant, toEra: '1985' })

      // The composed block is exactly the newest selection.
      expect(hashValue(harness.wiring.readings.storefronts)).toBe(
        hashValue(storefronts.applyEra('1985', { layout: LAYOUT, qualityTier: QUALITY })),
      )
      expect(harness.wiring.propsRuntime.eraId).toBe('1985')
      expect(harness.wiring.readings.vehicles?.eraId).toBe('1985')
      expect(harness.wiring.readings.atmosphere?.eraId).toBe('1985')
      expect(harness.engine.bedRequests.at(-1)?.id).toBe(getSoundscape('1985').descriptor)
      harness.wiring.dispose()
    }
  })

  it('requests one ambience crossfade plus era cue SFX per switch', async () => {
    const harness = await compose()
    harness.director.selectEra('2025')
    harness.run(6)

    expect(harness.engine.bedRequests).toHaveLength(1)
    const bed = harness.engine.bedRequests[0]
    expect(bed?.id).toBe(getSoundscape('2025').descriptor)
    expect(bed?.issues).toBe(0)
    expect(bed?.seconds).toBeGreaterThan(0)
    expect(harness.snapshot().audio).toMatchObject({
      crossfades: 1,
      lastCrossfadeEraId: '2025',
    })

    const expectedCues = selectEraCues('2025', getSoundscape('2025'), 3)
    const expectedPatches = expectedCues
      .map((request) => resolveCueOneShotId(request.cue))
      .filter((id): id is NonNullable<typeof id> => id !== null)
    expect(harness.engine.shotRequests.map((shot) => shot.id)).toEqual(expectedPatches)
    for (const shot of harness.engine.shotRequests) {
      // Every fired cue resolves to a synthesised patch the library really ships.
      expect(ONE_SHOT_IDS).toContain(shot.id)
      expect(resolveOneShotId(shot.id)).toBe(shot.id)
    }
    // The director reports the era's own cue vocabulary, not the patch names.
    expect(harness.snapshot().audio.cueIds).toEqual(expectedCues.map((request) => request.cue.id))
    harness.wiring.dispose()
  })

  it('translates every era soundscape into a descriptor the audio module accepts', () => {
    for (const eraId of ERA_IDS) {
      const descriptor = soundscapeToBedDescriptor(getSoundscape(eraId))
      const validation = validateSoundscapeDescriptor(descriptor)

      expect(validation.valid, `${eraId}: ${JSON.stringify(validation.issues)}`).toBe(true)
      expect(descriptor.id).toBe(getSoundscape(eraId).descriptor)
      expect(descriptor.layers.length).toBeGreaterThan(0)
      expect(descriptor.layers.length).toBeLessThanOrEqual(24)
    }
  })

  it('applies the target in a single step under reduced motion, and still crossfades', async () => {
    const harness = await compose({ reducedMotion: true })
    expect(resolveReducedMotion(harness.uiStore.getState().motionPreference, false)).toBe(true)

    harness.director.selectEra('2025')

    const snapshot = harness.snapshot()
    expect(snapshot).toMatchObject({ active: false, progress: 1, reducedMotion: true, frames: 0 })
    expect(snapshot.lastCompletion).toMatchObject({
      fromEra: '1945',
      toEra: '2025',
      reducedMotion: true,
      frames: 0,
    })
    expect(snapshot.layerFrames.every((frame) => frame.progress === 0)).toBe(true)

    // One instant application per layer, no staged frames at all.
    expect(harness.requests.map((request) => request.kind)).toEqual(
      harness.wiring.wired.map(() => 'era'),
    )
    expect(harness.requests.map((request) => request.id)).toEqual(harness.wiring.wired)
    for (const id of harness.wiring.wired) {
      expect(harness.requests.filter((request) => request.id === id)).toHaveLength(1)
    }
    expect(harness.wiring.propsRuntime.eraId).toBe('2025')
    expect(harness.wiring.readings.vehicles?.eraId).toBe('2025')
    expect(hashValue(harness.wiring.readings.storefronts)).toBe(
      hashValue(storefronts.applyEra('2025', { layout: LAYOUT, qualityTier: QUALITY, reducedMotion: true })),
    )
    // Audio still moves with the visuals, immediately.
    expect(harness.engine.bedRequests.map((request) => request.id)).toEqual([
      getSoundscape('2025').descriptor,
    ])
    expect(harness.engine.shotRequests.length).toBeGreaterThan(0)
    expect(harness.store.getState()).toMatchObject({ fromEra: '2025', toEra: '2025', progress: 0 })
    harness.wiring.dispose()
  })

  it('keeps the camera exactly where the viewer left it while layers trample it', async () => {
    const harness = await compose({ trampleCamera: true })
    const before = harness.controls.getState()

    harness.director.selectEra('2025')
    harness.run(6)

    expect(harness.snapshot().camera.restorations).toBeGreaterThan(0)
    expect(harness.snapshot().camera.unchanged).toBe(true)
    expect(harness.controls.getState()).toEqual(before)
    harness.wiring.dispose()
  })

  it('leaves the viewer free to navigate while the block re-dresses', async () => {
    const harness = await compose({ trampleCamera: true })
    harness.director.selectEra('2025')
    harness.run(0.5)

    const azimuthBefore = harness.controls.getState().orbit.azimuth
    harness.controls.orbitBy(0.4, 0)
    harness.clock.advance(0.05)
    harness.director.tick()

    const azimuthAfter = harness.controls.getState().orbit.azimuth
    expect(azimuthAfter).not.toBe(azimuthBefore)
    const expected = harness.controls.getState()

    harness.run(6)
    // The transition ends with the viewer's own framing, not the pre-navigation one.
    expect(harness.controls.getState()).toEqual(expected)
    harness.wiring.dispose()
  })

  it('mounts over the real stores through the React binding', async () => {
    const store = createEraStore('1945')
    const uiStore = createUIControlsStore({ motionPreference: 'no-preference' })
    const clock = createManualClock(0)
    const layers = [
      'atmosphere',
      'storefronts',
      'props',
      'vehicles',
    ].map<TransitionLayerAdapter>((id) => ({
      id: id as TransitionStageId,
      label: id,
      applyEra: (request) => ({ eraId: request.eraId }),
      applyEraTransition: (request) => ({ eraId: request.t >= 1 ? request.to : null }),
    }))
    const ticks: Array<() => void> = []

    const { result } = renderHook(() =>
      useTransitionDirector({
        store,
        uiStore,
        layers,
        clock,
        tickSource: {
          start(tick) {
            ticks.push(tick)
            return () => {
              ticks.length = 0
            }
          },
        },
      }),
    )

    expect(ticks).toHaveLength(1)
    act(() => {
      result.current.selectEra('2025')
    })
    expect(result.current.snapshot.active).toBe(true)
    expect(store.getState().toEra).toBe('2025')

    act(() => {
      clock.advance(6)
      for (const tick of ticks) {
        tick()
      }
    })

    expect(result.current.snapshot.active).toBe(false)
    expect(result.current.snapshot.lastCompletion?.toEra).toBe('2025')
    expect(result.current.snapshot.camera.tracked).toBe(false)
    expect(store.getState()).toMatchObject({ fromEra: '2025', toEra: '2025', progress: 0 })
  })
})
