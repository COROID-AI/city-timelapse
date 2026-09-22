/**
 * Unit suite for the staged era transition director.
 *
 * Everything here runs against the shipped table and the shipped director with
 * an injected clock and stub layer adapters, so the assertions are exact rather
 * than timing-dependent. The composition suite next to it repeats the end-to-end
 * claims with the real era registry, the real era store, the real ui-controls
 * store and the real layer `applyEra` / `applyEraTransition` functions.
 *
 * Covered claims:
 * - the schedule table covers every documented stage, in the documented order,
 *   with monotonically increasing start offsets and its own tuning data;
 * - every easing curve is monotone over 0..1, exact at both ends and total;
 * - per-stage progress is clamped, monotone and exactly 1 at the end;
 * - a switch writes start/progress/completion through the era store;
 * - a mid-transition retarget continues from the dramatic era and lands on the
 *   newest selection;
 * - reduced motion applies the target in one step, with zero staged frames, while
 *   still crossfading the ambience;
 * - the camera port is captured and restored, never moved.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, getSoundscape } from '../../src/era'
import { createEraStore } from '../../src/state/eraStore'
import {
  DEFAULT_TRANSITION_SCHEDULE,
  EASING_FUNCTIONS,
  EASING_NAMES,
  SOUNDSCAPE_STAGE_ID,
  STAGE_LABELS,
  TRANSITION_STAGE_ORDER,
  TransitionScheduleError,
  clamp01,
  createFixedMotionPort,
  createManualClock,
  createRecordingAudioPort,
  createRecordingCameraPort,
  createStubLayerAdapter,
  createTransitionDirector,
  createTransitionSchedule,
  crossfadeValue,
  crossfadeWeights,
  ease,
  isMonotonic,
  meanProgress,
  resolveDominantEra,
  resolveLayerFrames,
  resolveSchedule,
  resumeProgress,
  scheduleFollowsDocumentedOrder,
  scheduleStageOrder,
  selectEraCues,
  validateSchedule,
  type ManualClock,
  type StubLayerAdapter,
  type TransitionDirector,
  type TransitionDirectorSnapshot,
  type TransitionStageId,
} from '../../src/transition'

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface DirectorHarness {
  readonly store: ReturnType<typeof createEraStore>
  readonly clock: ManualClock
  readonly layers: readonly StubLayerAdapter[]
  readonly layerFor: (id: TransitionStageId) => StubLayerAdapter
  readonly audio: ReturnType<typeof createRecordingAudioPort>
  readonly camera: ReturnType<typeof createRecordingCameraPort>
  readonly director: TransitionDirector
  /** Advances the clock in `step` increments and ticks, like a render loop. */
  run(untilSeconds: number, step?: number): TransitionDirectorSnapshot
  snapshot(): TransitionDirectorSnapshot
}

function layerHarness(options: {
  readonly stages?: readonly TransitionStageId[]
  readonly reducedMotion?: boolean
  readonly trampleCamera?: boolean
} = {}): DirectorHarness {
  const store = createEraStore('1945')
  const clock = createManualClock(0)
  const camera = createRecordingCameraPort()
  const stages = options.stages ?? TRANSITION_STAGE_ORDER
  const stubs = new Map<TransitionStageId, StubLayerAdapter>()
  const layers = stages.map((id) => {
    const stub = createStubLayerAdapter({
      id,
      onApply: () => {
        if (options.trampleCamera === true) {
          camera.nudge()
        }
      },
    })
    stubs.set(id, stub)
    return stub
  })
  const audio = createRecordingAudioPort()
  const director = createTransitionDirector({
    store,
    layers,
    audio,
    camera,
    motion: createFixedMotionPort(options.reducedMotion ?? false),
    clock,
  })

  return {
    store,
    clock,
    layers,
    layerFor(id: TransitionStageId): StubLayerAdapter {
      const stub = stubs.get(id)
      if (stub === undefined) {
        throw new Error(`No stub for stage '${id}'.`)
      }
      return stub
    },
    audio,
    camera,
    director,
    run(untilSeconds: number, step = 0.1): TransitionDirectorSnapshot {
      let guard = 0
      while (clock.seconds < untilSeconds - 1e-9 && guard < 10_000) {
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
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

describe('transition schedule table', () => {
  it('covers every documented stage in the theatrical order', () => {
    const resolved = resolveSchedule(DEFAULT_TRANSITION_SCHEDULE)

    expect(scheduleStageOrder(DEFAULT_TRANSITION_SCHEDULE)).toEqual(TRANSITION_STAGE_ORDER)
    expect(resolved.entries.map((entry) => entry.id)).toEqual([...TRANSITION_STAGE_ORDER])
    expect(scheduleFollowsDocumentedOrder(DEFAULT_TRANSITION_SCHEDULE)).toBe(true)
    for (const entry of resolved.entries) {
      expect(entry.label).toBe(STAGE_LABELS[entry.id])
      expect(entry.durationSeconds).toBeGreaterThan(0)
      expect(EASING_NAMES).toContain(entry.easing)
    }
    // The soundscape closes the change: nothing else may outlast it.
    const soundscape = resolved.entryFor(SOUNDSCAPE_STAGE_ID)
    expect(soundscape.endSeconds).toBe(resolved.durationSeconds)
  })

  it('gives every stage a monotonically increasing start offset', () => {
    const resolved = resolveSchedule(DEFAULT_TRANSITION_SCHEDULE)
    const starts = resolved.entries.map((entry) => entry.startSeconds)

    expect(isMonotonic(starts)).toBe(true)
    for (const entry of resolved.entries) {
      expect(entry.startSeconds).toBe(entry.delaySeconds)
      expect(entry.endSeconds).toBeGreaterThan(entry.startSeconds)
    }
    // Atmosphere opens the change and the block re-dresses bottom-up after it.
    expect(resolved.entryFor('atmosphere').startSeconds).toBe(0)
    expect(resolved.entryFor('buildings').startSeconds).toBeGreaterThan(0)
    expect(resolved.entryFor('storefronts').startSeconds).toBeGreaterThan(
      resolved.entryFor('buildings').startSeconds,
    )
    expect(resolved.entryFor('props').startSeconds).toBeGreaterThan(
      resolved.entryFor('storefronts').startSeconds,
    )
    // Vehicles and pedestrians share their band, vehicles first.
    expect(resolved.entryFor('vehicles').startSeconds).toBeLessThanOrEqual(
      resolved.entryFor('pedestrians').startSeconds,
    )
    expect(resolved.entryFor(SOUNDSCAPE_STAGE_ID).startSeconds).toBeGreaterThan(
      resolved.entryFor('pedestrians').startSeconds,
    )
  })

  it('is tunable per stage without ever reordering the story', () => {
    const tuned = createTransitionSchedule({
      buildings: { delaySeconds: 0.2, durationSeconds: 1.1, easing: 'linear' },
      soundscape: { delaySeconds: 1.4 },
    })
    const resolved = resolveSchedule(tuned)

    expect(scheduleStageOrder(tuned)).toEqual(TRANSITION_STAGE_ORDER)
    expect(resolved.entryFor('buildings')).toMatchObject({
      delaySeconds: 0.2,
      durationSeconds: 1.1,
      easing: 'linear',
      startSeconds: 0.2,
      endSeconds: 1.3,
    })
    expect(resolved.entryFor(SOUNDSCAPE_STAGE_ID).startSeconds).toBe(1.4)
    // Untouched rows keep the shipped numbers.
    expect(resolved.entryFor('props')).toMatchObject(resolveSchedule().entryFor('props'))
    expect(resolved.durationSeconds).toBe(Math.max(...resolved.entries.map((e) => e.endSeconds)))
  })

  it('rejects a table it cannot play', () => {
    const [first] = DEFAULT_TRANSITION_SCHEDULE
    expect(first).toBeDefined()
    const duplicated = first === undefined ? [] : [...DEFAULT_TRANSITION_SCHEDULE, first]
    const negative = first === undefined ? [] : [{ ...first, delaySeconds: -1 }]

    expect(validateSchedule(duplicated).length).toBeGreaterThan(0)
    expect(validateSchedule(DEFAULT_TRANSITION_SCHEDULE)).toEqual([])
    expect(() => resolveSchedule(duplicated)).toThrow(TransitionScheduleError)
    expect(() => resolveSchedule(negative)).toThrow(TransitionScheduleError)
    expect(resolveSchedule(DEFAULT_TRANSITION_SCHEDULE).has('buildings')).toBe(true)
  })

  it('schedules every registered layer and reports the ones without a barrel', () => {
    const full = layerHarness()
    expect(full.director.layers.map((layer) => layer.id)).toEqual([...TRANSITION_STAGE_ORDER])
    expect(full.snapshot().registeredLayers).toEqual([...TRANSITION_STAGE_ORDER])
    expect(full.snapshot().pendingStages).toEqual([])
    expect(full.snapshot().stageOrder).toEqual([...TRANSITION_STAGE_ORDER])

    const partial = layerHarness({ stages: ['atmosphere', 'storefronts'] })
    expect(partial.snapshot().registeredLayers).toEqual(['atmosphere', 'storefronts'])
    expect(partial.snapshot().pendingStages).toEqual([
      'buildings',
      'props',
      'vehicles',
      'pedestrians',
    ])
  })

  it('refuses an adapter that the table does not schedule', () => {
    const store = createEraStore('1945')
    expect(() =>
      createTransitionDirector({
        store,
        clock: createManualClock(0),
        schedule: DEFAULT_TRANSITION_SCHEDULE.filter((entry) => entry.id !== 'props'),
        layers: [createStubLayerAdapter({ id: 'props' })],
      }),
    ).toThrow(/not scheduled/)
  })
})

/* -------------------------------------------------------------------------- */
/* Easing, interpolation and clamping                                         */
/* -------------------------------------------------------------------------- */

describe('easing and interpolation helpers', () => {
  it('maps every named curve monotonically onto 0..1 with exact endpoints', () => {
    for (const name of EASING_NAMES) {
      const curve = EASING_FUNCTIONS[name]
      expect(ease(name, 0)).toBe(0)
      expect(ease(name, 1)).toBe(1)
      expect(typeof curve).toBe('function')

      const samples = Array.from({ length: 101 }, (_, index) => ease(name, index / 100))
      expect(isMonotonic(samples), `${name} is monotone`).toBe(true)
      for (const sample of samples) {
        expect(sample).toBeGreaterThanOrEqual(0)
        expect(sample).toBeLessThanOrEqual(1)
      }
    }
  })

  it('clamps its input instead of propagating nonsense', () => {
    expect(ease('smoothstep', -4)).toBe(0)
    expect(ease('smoothstep', 12)).toBe(1)
    expect(ease('smoothstep', Number.NaN)).toBe(0)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1)
    expect(clamp01(-0.2)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
  })

  it('crossfades two sources with weights that sum to one', () => {
    expect(crossfadeWeights(0)).toEqual({ departing: 1, arriving: 0 })
    expect(crossfadeWeights(1)).toEqual({ departing: 0, arriving: 1 })
    for (let index = 0; index <= 100; index += 1) {
      const { arriving, departing } = crossfadeWeights(index / 100, 'easeInOutCubic')
      expect(arriving + departing).toBeCloseTo(1, 12)
    }
    expect(crossfadeValue(10, 30, 0)).toBe(10)
    expect(crossfadeValue(10, 30, 1)).toBe(30)
    expect(crossfadeValue(10, 30, 0.5)).toBe(20)
  })

  it('resumes a stage from the progress it had already reached', () => {
    expect(resumeProgress(0.6, 0)).toBe(0.6)
    expect(resumeProgress(0.6, 1)).toBe(1)
    expect(resumeProgress(0, 0.25)).toBe(0.25)
    const resumed = Array.from({ length: 51 }, (_, index) => resumeProgress(0.42, index / 50))
    expect(isMonotonic(resumed)).toBe(true)
    expect(Math.max(...resumed)).toBe(1)
  })

  it('names the visually dominant era and averages stage progress', () => {
    expect(resolveDominantEra('1945', '2025', 0)).toBe('1945')
    expect(resolveDominantEra('1945', '2025', 0.49)).toBe('1945')
    expect(resolveDominantEra('1945', '2025', 0.5)).toBe('2025')
    expect(resolveDominantEra('1945', '2025', 1)).toBe('2025')
    expect(resolveDominantEra('1985', '1985', 0)).toBe('1985')
    expect(meanProgress([])).toBe(1)
    expect(meanProgress([0.5, 1])).toBe(0.75)
    expect(meanProgress([2, -1])).toBe(0.5)
  })
})

/* -------------------------------------------------------------------------- */
/* Frames                                                                     */
/* -------------------------------------------------------------------------- */

describe('layer frames', () => {
  it('clamps per-stage progress and reaches exactly 1 at the end', () => {
    const resolved = resolveSchedule()
    const offsets = new Map<TransitionStageId, number>([['buildings', 0.35]])
    const rawHistory = new Map<TransitionStageId, number[]>()

    for (let elapsed = 0; elapsed <= resolved.durationSeconds; elapsed += 0.05) {
      const frames = resolveLayerFrames(resolved, { elapsedSeconds: elapsed, offsets })
      for (const frame of frames) {
        expect(frame.progress).toBeGreaterThanOrEqual(0)
        expect(frame.progress).toBeLessThanOrEqual(1)
        if (frame.id === 'buildings') {
          expect(frame.progress).toBeGreaterThanOrEqual(0.35)
        }
        const series = rawHistory.get(frame.id) ?? []
        series.push(frame.rawT)
        rawHistory.set(frame.id, series)
      }
    }

    // Each stage's own window advances monotonically through the clock.
    for (const [id, series] of rawHistory) {
      expect(isMonotonic(series), `${id} advances monotonically`).toBe(true)
    }

    const atEnd = resolveLayerFrames(resolved, {
      elapsedSeconds: resolved.durationSeconds,
      offsets,
    })
    for (const frame of atEnd) {
      expect(frame.progress, `${frame.id} lands exactly`).toBe(1)
      expect(frame.easedT).toBe(1)
      expect(frame.rawT).toBe(1)
      expect(frame.complete).toBe(true)
    }
    // Past the end nothing moves any more either.
    const pastEnd = resolveLayerFrames(resolved, { elapsedSeconds: 99, offsets })
    expect(pastEnd.map((frame) => frame.progress)).toEqual(atEnd.map((frame) => frame.progress))
  })

  it('holds a stage at exactly 0 until its delay elapses', () => {
    const resolved = resolveSchedule()
    const before = resolveLayerFrames(resolved, { elapsedSeconds: resolved.entryFor('props').startSeconds - 0.01 })
    const props = before.find((frame) => frame.id === 'props')
    expect(props?.progress).toBe(0)
    expect(props?.started).toBe(false)

    const atDelay = resolveLayerFrames(resolved, { elapsedSeconds: resolved.entryFor('props').startSeconds })
    expect(atDelay.find((frame) => frame.id === 'props')?.started).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Director: staged switch                                                    */
/* -------------------------------------------------------------------------- */

describe('director over an injected clock', () => {
  it('reports start, progress and completion through the era store', () => {
    const harness = layerHarness()
    const progressSeen: number[] = []
    harness.store.subscribe(
      (state) => state.progress,
      (progress) => progressSeen.push(progress),
    )

    harness.director.selectEra('2025')
    let snapshot = harness.snapshot()
    expect(snapshot.active).toBe(true)
    expect(snapshot.fromEra).toBe('1945')
    expect(snapshot.toEra).toBe('2025')
    expect(snapshot.storeProgress).toBe(0)
    expect(harness.store.getState()).toMatchObject({ selectedEra: '2025', fromEra: '1945', toEra: '2025' })

    const daily: number[] = []
    for (let index = 0; index < 60 && harness.director.active; index += 1) {
      harness.clock.advance(0.1)
      harness.director.tick()
      daily.push(harness.snapshot().progress)
    }

    expect(isMonotonic(daily)).toBe(true)
    expect(daily.at(-1)).toBe(1)
    expect(progressSeen.at(-1)).toBe(0)
    expect(progressSeen).toContain(1)
    expect(harness.store.getState()).toMatchObject({
      selectedEra: '2025',
      fromEra: '2025',
      toEra: '2025',
      progress: 0,
    })

    snapshot = harness.snapshot()
    expect(snapshot.active).toBe(false)
    expect(snapshot.lastCompletion).toMatchObject({
      fromEra: '1945',
      toEra: '2025',
      progress: 1,
      reducedMotion: false,
      retargetCount: 0,
      cameraUnchanged: true,
    })
    expect(snapshot.lastCompletion?.frames).toBeGreaterThan(1)
    expect(snapshot.lastEvent).toBe('complete')
  })

  it('applies every stage, in schedule order, up to exactly 1', () => {
    const harness = layerHarness()
    harness.director.selectEra('1985')
    harness.run(5.5)

    for (const stub of harness.layers) {
      expect(stub.applications.length, `${stub.id} was applied`).toBeGreaterThan(0)
      const last = stub.applications.at(-1)
      expect(last?.t, `${stub.id} lands on t=1`).toBe(1)
      expect(last?.to).toBe('1985')
      // Every frame of one stage is monotone in t as well.
      expect(isMonotonic(stub.applications.map((application) => application.t))).toBe(true)
      expect(stub.eraId).toBe('1985')
    }

    // All stages see the same first frame; the order of that frame is the table's.
    const firstApplications = harness.layers.map(
      (stub) => stub.applications[0]?.id ?? 'missing',
    )
    expect(firstApplications).toEqual([...TRANSITION_STAGE_ORDER])
  })

  it('does not move on without clock movement', () => {
    const harness = layerHarness()
    harness.director.selectEra('1965')
    const before = harness.snapshot().progress
    const frameCount = harness.snapshot().frames

    harness.director.tick()
    harness.director.tick()

    expect(harness.snapshot().progress).toBe(before)
    expect(harness.snapshot().frames).toBe(frameCount)
  })

  it('crossfades the ambience once, when the soundscape stage begins', () => {
    const harness = layerHarness()
    harness.director.selectEra('2005')

    harness.run(1.5)
    expect(harness.audio.crossfades).toHaveLength(0)

    harness.run(5.5)
    expect(harness.audio.crossfades).toHaveLength(1)
    const [crossfade] = harness.audio.crossfades
    expect(crossfade?.eraId).toBe('2005')
    expect(crossfade?.soundscape.descriptor).toBe(getSoundscape('2005').descriptor)
    expect(harness.audio.bedIds).toEqual([getSoundscape('2005').descriptor])

    const expectedCues = getSoundscape('2005').cues.filter((cue) => !cue.loop).slice(0, 3)
    expect(harness.audio.cues.map((cue) => cue.cue.id)).toEqual(expectedCues.map((cue) => cue.id))
    expect(harness.snapshot().audio).toMatchObject({
      crossfades: 1,
      lastCrossfadeEraId: '2005',
      cueIds: expectedCues.map((cue) => cue.id),
    })
  })

  it('keeps the camera exactly where the viewer left it', () => {
    const harness = layerHarness({ trampleCamera: true })
    const before = harness.camera.state

    harness.director.selectEra('2025')
    harness.run(5.5)

    expect(harness.camera.mutations).toBeGreaterThan(0)
    expect(harness.snapshot().camera.restorations).toBeGreaterThan(0)
    expect(harness.snapshot().camera.unchanged).toBe(true)
    expect(harness.snapshot().lastCompletion?.cameraUnchanged).toBe(true)
    expect(harness.camera.state).toEqual(before)
  })
})

/* -------------------------------------------------------------------------- */
/* Director: retarget                                                         */
/* -------------------------------------------------------------------------- */

describe('director retarget', () => {
  it('retargets from the visually dominant era and lands on the newest selection', () => {
    const harness = layerHarness()
    harness.director.selectEra('2025')

    // Early in the switch the outgoing era still dominates.
    harness.run(1.4)
    const beforeRetarget = harness.snapshot()
    expect(beforeRetarget.progress).toBeLessThan(0.5)
    const atmosphereBefore = harness.layerFor('atmosphere').progress

    harness.director.selectEra('1985')
    const retargeted = harness.snapshot()
    expect(retargeted.toEra).toBe('1985')
    expect(retargeted.fromEra).toBe('1945')
    expect(retargeted.retargetCount).toBe(1)
    expect(retargeted.progress).toBeCloseTo(beforeRetarget.progress, 12)
    expect(harness.store.getState()).toMatchObject({ selectedEra: '1985', fromEra: '1945', toEra: '1985' })

    const traced: number[] = [retargeted.progress]
    while (harness.director.active) {
      harness.clock.advance(0.1)
      harness.director.tick()
      traced.push(harness.snapshot().progress)
    }

    expect(isMonotonic(traced)).toBe(true)
    expect(Math.max(...traced)).toBe(1)
    expect(traced.at(-1)).toBe(1)
    for (const stub of harness.layers) {
      const last = stub.applications.at(-1)
      expect(last?.to, `${stub.id} ends on the newest selection`).toBe('1985')
      expect(last?.t).toBe(1)
      expect(stub.eraId).toBe('1985')
      expect(
        isMonotonic(stub.applications.map((application) => application.t)),
        `${stub.id} never restarts`,
      ).toBe(true)
    }
    // A stage that had already begun keeps its progress: no flicker restart.
    expect(harness.layerFor('atmosphere').applications.length).toBeGreaterThan(0)
    expect(atmosphereBefore).toBeGreaterThan(0)
    expect(harness.audio.crossfades.at(-1)?.eraId).toBe('1985')
    expect(harness.audio.crossfades.length).toBeLessThanOrEqual(2)
  })

  it('retargets from the incoming era once it dominates', () => {
    const harness = layerHarness()
    harness.director.selectEra('2025')
    harness.run(4.0)
    const snapshot = harness.snapshot()
    expect(snapshot.progress).toBeGreaterThan(0.5)

    harness.director.selectEra('1965')
    expect(harness.snapshot().fromEra).toBe('2025')
    expect(harness.snapshot().toEra).toBe('1965')
    expect(harness.store.getState()).toMatchObject({ fromEra: '2025', toEra: '1965' })

    harness.run(12)
    expect(harness.snapshot().active).toBe(false)
    expect(harness.snapshot().lastCompletion).toMatchObject({ fromEra: '2025', toEra: '1965' })
    expect(harness.layerFor('vehicles').eraId).toBe('1965')
  })

  it('ignores a re-selection of the destination instead of restarting', () => {
    const harness = layerHarness()
    harness.director.selectEra('2025')
    harness.run(1.0)
    const progress = harness.snapshot().progress
    const applications = harness.layerFor('buildings').applications.length

    harness.store.getState().selectEra('2025')
    expect(harness.snapshot().retargetCount).toBe(0)
    expect(harness.snapshot().progress).toBe(progress)
    expect(harness.layerFor('buildings').applications).toHaveLength(applications)

    harness.run(6)
    expect(harness.layerFor('buildings').eraId).toBe('2025')
  })

  it('can be completed early without overshooting', () => {
    const harness = layerHarness()
    harness.director.selectEra('2025')
    harness.run(1.0)
    harness.director.complete()

    expect(harness.director.active).toBe(false)
    expect(harness.snapshot().progress).toBe(1)
    expect(harness.store.getState()).toMatchObject({ fromEra: '2025', toEra: '2025', progress: 0 })
    for (const stub of harness.layers) {
      expect(stub.applications.at(-1)?.t).toBe(1)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Director: reduced motion                                                   */
/* -------------------------------------------------------------------------- */

describe('director under reduced motion', () => {
  it('applies the target in a single step with zero staged frames', () => {
    const harness = layerHarness({ reducedMotion: true })
    const completions: string[] = []
    harness.director.subscribe((snapshot) => {
      if (snapshot.lastEvent === 'complete' && snapshot.lastCompletion !== null) {
        completions.push(`${snapshot.lastCompletion.fromEra}->${snapshot.lastCompletion.toEra}`)
      }
    })

    harness.director.selectEra('2025')

    const snapshot = harness.snapshot()
    expect(snapshot.active).toBe(false)
    expect(snapshot.progress).toBe(1)
    expect(snapshot.reducedMotion).toBe(true)
    expect(snapshot.frames).toBe(0)
    expect(snapshot.layerFrames.every((frame) => frame.progress === 0)).toBe(true)
    expect(completions).toEqual(['1945->2025'])

    for (const stub of harness.layers) {
      expect(stub.applications).toHaveLength(1)
      expect(stub.applications[0]).toMatchObject({ kind: 'era', to: '2025', reducedMotion: true })
      expect(stub.eraId).toBe('2025')
    }
    // Audio still moves with the visuals.
    expect(harness.audio.crossfades).toHaveLength(1)
    expect(harness.audio.crossfades[0]?.eraId).toBe('2025')
    expect(harness.audio.cues.length).toBeGreaterThan(0)
    expect(harness.store.getState()).toMatchObject({
      selectedEra: '2025',
      fromEra: '2025',
      toEra: '2025',
      progress: 0,
    })
  })

  it('collapses a running transition when the preference is switched on', () => {
    const harness = layerHarness()
    // Only the director under test may react to the selection below.
    harness.director.dispose()
    const motion = createFixedMotionPort(false)
    const director = createTransitionDirector({
      store: harness.store,
      layers: harness.layers,
      clock: harness.clock,
      motion,
    })
    director.selectEra('1985')
    harness.clock.advance(0.5)
    director.tick()
    expect(director.active).toBe(true)

    motion.set(true)
    harness.clock.advance(0.1)
    director.tick()

    expect(director.active).toBe(false)
    expect(director.getSnapshot().reducedMotion).toBe(true)
    expect(director.getSnapshot().lastCompletion?.toEra).toBe('1985')
    for (const stub of harness.layers) {
      expect(stub.eraId).toBe('1985')
    }
  })

  it('selects era cue SFX deterministically from the registry', () => {
    const soundscape = getSoundscape('1945')
    const requests = selectEraCues('1945', soundscape, 2)
    const nonLooping = soundscape.cues.filter((cue) => !cue.loop)

    expect(requests.map((request) => request.cue.id)).toEqual(
      nonLooping.slice(0, 2).map((cue) => cue.id),
    )
    expect(requests[0]?.delaySeconds).toBe(0)
    expect(requests[1]?.delaySeconds).toBeGreaterThan(0)
    expect(selectEraCues('1945', soundscape, 0)).toEqual([])
  })

  it('writes the correct from/to pair for every era the registry ships', () => {
    for (const eraId of ERA_IDS.filter((id) => id !== '1945')) {
      const harness = layerHarness()
      harness.director.selectEra(eraId)

      expect(harness.snapshot()).toMatchObject({ fromEra: '1945', toEra: eraId, active: true })
      expect(harness.store.getState()).toMatchObject({ fromEra: '1945', toEra: eraId })

      harness.run(6)
      expect(harness.snapshot().lastCompletion).toMatchObject({ fromEra: '1945', toEra: eraId })
      expect(harness.store.getState()).toMatchObject({
        selectedEra: eraId,
        fromEra: eraId,
        toEra: eraId,
        progress: 0,
      })
      expect(harness.audio.bedIds).toEqual([getSoundscape(eraId).descriptor])
      harness.director.dispose()
    }
  })
})
