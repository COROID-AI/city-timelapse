/**
 * The transition director: one era selection becomes a staged, in-place
 * transformation of the block.
 *
 * What it owns
 * ------------
 * - **The clock.** One injectable {@link TransitionClock} drives every stage, so
 *   tests and the harness advance time deterministically while the application
 *   hands it the frame delta of the render pipeline.
 * - **The schedule.** {@link DEFAULT_TRANSITION_SCHEDULE} staggers the stages from
 *   atmosphere to soundscape; each frame's progress is read from that table.
 * - **From/to bookkeeping.** Selection is read from the era store and the blend
 *   state is written back to it (`setTransition` → `setProgress` →
 *   `completeTransition`), which is exactly what the timeline UI reads.
 * - **Retargeting.** A new selection mid-flight sets the new `from` to the
 *   visually dominant era and continues each stage from the progress it had
 *   reached, so nothing restarts and nothing overshoots.
 * - **Camera continuity.** The camera port is capture/restore only. The director
 *   snapshots the viewer's camera when a switch starts and undoes any change a
 *   layer makes while the frame is being applied, so the viewer keeps their
 *   position and framing while the block re-dresses.
 * - **Audio.** One ambience crossfade to the target era's soundscape plus the
 *   era's cue SFX, issued when the soundscape stage begins.
 * - **Reduced motion.** When the preference is on (and re-read at every switch)
 *   the target era is applied in a single step: zero staged frames, the same
 *   crossfade, and the completion signal immediately.
 *
 * ```ts
 * const director = createTransitionDirector({ store, layers, audio, camera, motion })
 * director.selectEra('2025')                          // or the overlay's own path
 * pipeline.onFrame(() => director.tick())             // once per rendered frame
 * director.getSnapshot().progress                     // 0..1 for the UI
 * ```
 */

import { getSoundscape, type EraId, type EraSoundscape, type EraSoundscapeCue } from '../era'
import type { CameraState } from '../scene'
import { subscribeToEraSelection, type EraStore } from '../state/eraStore'
import { clamp01, meanProgress, resolveDominantEra } from './easing'
import {
  DEFAULT_TRANSITION_SCHEDULE,
  registeredFrames,
  resolveLayerFrames,
  resolveSchedule,
  scheduleStageOrder,
  stageRequest,
} from './schedule'
import {
  SOUNDSCAPE_STAGE_ID,
  TRANSITION_STAGE_ORDER,
  type LayerApplicationRecord,
  type LayerEraRequest,
  type LayerFrame,
  type LayerTransitionRequest,
  type ResolvedSchedule,
  type TransitionClock,
  type TransitionCompletionSignal,
  type TransitionCueRequest,
  type TransitionDirector,
  type TransitionDirectorEvent,
  type TransitionDirectorOptions,
  type TransitionDirectorSnapshot,
  type TransitionLayerAdapter,
  type TransitionScheduleTable,
  type TransitionStageId,
} from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Ambience crossfade length handed to the audio port, in seconds. */
export const DEFAULT_CROSSFADE_SECONDS = 2.5

/** How many of the target era's cue SFX one switch fires. */
export const DEFAULT_CUE_LIMIT = 3

/** Stagger between two cue SFX of the same switch, in seconds. */
export const CUE_STAGGER_SECONDS = 0.18

/* -------------------------------------------------------------------------- */
/* Clocks                                                                     */
/* -------------------------------------------------------------------------- */

/** Monotonic clock backed by the host's `performance.now()`. */
export function createSystemClock(): TransitionClock {
  return {
    now(): number {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now() / 1000
      }
      return Date.now() / 1000
    },
  }
}

/** A clock a host (or a test) moves by hand. */
export interface ManualClock extends TransitionClock {
  /** Moves the clock forward by `seconds`; returns the new reading. */
  advance(seconds: number): number
  /** Sets the reading; non-finite input is ignored. */
  set(seconds: number): number
  /** Current reading. */
  readonly seconds: number
}

/**
 * Creates a manual clock.
 *
 * The unit suite advances it to assert exact progress values, and the harness
 * exposes it so the browser proof can step a switch deterministically as well as
 * play it live.
 */
export function createManualClock(initialSeconds = 0): ManualClock {
  let seconds = Number.isFinite(initialSeconds) ? initialSeconds : 0
  return {
    now(): number {
      return seconds
    },
    advance(delta: number): number {
      seconds += Number.isFinite(delta) ? delta : 0
      return seconds
    },
    set(value: number): number {
      if (Number.isFinite(value)) {
        seconds = value
      }
      return seconds
    },
    get seconds(): number {
      return seconds
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Cue selection                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Picks the era cue SFX one switch fires.
 *
 * The era registry describes its sonic identity as cues; the looping ones are
 * part of the bed and arrive with the crossfade, so only the non-looping cues are
 * fired as one-shots. The first `limit` of them are taken in table order, so the
 * selection is deterministic, and each is staggered a fraction of a second after
 * the crossfade so the result reads as a period cue rather than a chord.
 */
export function selectEraCues(
  eraId: EraId,
  soundscape: EraSoundscape,
  limit: number = DEFAULT_CUE_LIMIT,
): readonly TransitionCueRequest[] {
  const count = Math.max(0, Math.floor(limit))
  const cues: EraSoundscapeCue[] = []
  for (const cue of soundscape.cues) {
    if (cues.length >= count) {
      break
    }
    if (!cue.loop) {
      cues.push(cue)
    }
  }
  return cues.map((cue, index) => ({
    eraId,
    cue,
    gain: clamp01(cue.gain),
    delaySeconds: index * CUE_STAGGER_SECONDS,
  }))
}

/* -------------------------------------------------------------------------- */
/* Camera equality                                                            */
/* -------------------------------------------------------------------------- */

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

/** Exact structural equality of two camera states. */
function cameraStatesEqual(left: CameraState | null, right: CameraState | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return (
    left.mode === right.mode &&
    sameNumbers(left.target, right.target) &&
    left.orbit.azimuth === right.orbit.azimuth &&
    left.orbit.polar === right.orbit.polar &&
    left.orbit.radius === right.orbit.radius &&
    sameNumbers(left.street.position, right.street.position) &&
    left.street.heading === right.street.heading &&
    left.street.pitch === right.street.pitch &&
    left.fov === right.fov &&
    left.near === right.near &&
    left.far === right.far
  )
}

/* -------------------------------------------------------------------------- */
/* Director                                                                   */
/* -------------------------------------------------------------------------- */

/** One running switch; replaced on every retarget. */
interface ActiveSwitch {
  from: EraId
  to: EraId
  elapsed: number
  lastClockSeconds: number
  startSeconds: number
  offsets: Map<TransitionStageId, number>
  progress: number
  frames: number
  retargets: number
  crossfaded: boolean
  reducedMotion: boolean
}

/**
 * Creates the director.
 *
 * The returned object is inert until its clock is ticked; `autoStart` (on by
 * default) subscribes to the era store immediately, so selecting an era is all a
 * host has to do.
 */
export function createTransitionDirector(options: TransitionDirectorOptions): TransitionDirector {
  const store: EraStore = options.store
  const schedule: TransitionScheduleTable = options.schedule ?? DEFAULT_TRANSITION_SCHEDULE
  const resolved: ResolvedSchedule = resolveSchedule(schedule)
  const clock: TransitionClock = options.clock ?? createSystemClock()
  const audio = options.audio ?? null
  const camera = options.camera ?? null
  const motion = options.motion ?? null
  const stageOrder = scheduleStageOrder(schedule)

  const adapters = new Map<TransitionStageId, TransitionLayerAdapter>()
  for (const adapter of options.layers ?? []) {
    if (!resolved.has(adapter.id)) {
      throw new RangeError(
        `Layer '${adapter.id}' is not scheduled by the transition table; add a row for it in the schedule.`,
      )
    }
    adapters.set(adapter.id, adapter)
  }
  const registeredIds: readonly TransitionStageId[] = stageOrder.filter((id) => adapters.has(id))
  // The soundscape stage is driven through the audio port, not a layer adapter,
  // so it is never "pending": only content stages wait for a barrel.
  const pendingIds: readonly TransitionStageId[] = TRANSITION_STAGE_ORDER.filter(
    (id) => id !== SOUNDSCAPE_STAGE_ID && !adapters.has(id),
  )

  const layers: readonly TransitionLayerAdapter[] = stageOrder
    .map((id) => adapters.get(id))
    .filter((adapter): adapter is TransitionLayerAdapter => adapter !== undefined)

  let active: ActiveSwitch | null = null
  let lastCompletion: TransitionCompletionSignal | null = null
  let cameraAtStart: CameraState | null = null
  let cameraRestorations = 0
  let crossfades = 0
  let lastCrossfadeEraId: EraId | null = null
  let cueIds: readonly string[] = []
  const layerStates = new Map<TransitionStageId, LayerApplicationRecord>()
  const listeners = new Set<(snapshot: TransitionDirectorSnapshot) => void>()
  let unsubscribe: (() => void) | null = null
  /** True while the director itself is writing the store, so it ignores the echo. */
  let writing = false

  function buildSnapshot(event: TransitionDirectorEvent): TransitionDirectorSnapshot {
    const state = store.getState()
    const frames = resolveLayerFrames(resolved, {
      elapsedSeconds: active?.elapsed ?? 0,
      offsets: active?.offsets ?? null,
      registered: registeredIds,
    })
    const currentCamera = camera === null ? null : camera.capture()
    return {
      active: active !== null,
      fromEra: active?.from ?? state.fromEra,
      toEra: active?.to ?? state.toEra,
      selectedEra: state.selectedEra,
      progress: active?.progress ?? lastCompletion?.progress ?? 0,
      storeProgress: state.progress,
      transitioning: state.fromEra !== state.toEra,
      elapsedSeconds: active?.elapsed ?? 0,
      durationSeconds: resolved.durationSeconds,
      reducedMotion: active?.reducedMotion ?? lastCompletion?.reducedMotion ?? false,
      frames: active?.frames ?? lastCompletion?.frames ?? 0,
      retargetCount: active?.retargets ?? lastCompletion?.retargetCount ?? 0,
      stageOrder,
      registeredLayers: registeredIds,
      pendingStages: pendingIds,
      layerFrames: frames,
      layerStates: [...layerStates.values()],
      camera: {
        tracked: camera !== null,
        atStart: cameraAtStart,
        current: currentCamera,
        restorations: cameraRestorations,
        unchanged: cameraAtStart === null || cameraStatesEqual(cameraAtStart, currentCamera),
      },
      audio: { crossfades, lastCrossfadeEraId, cueIds },
      lastCompletion,
      lastEvent: event,
    }
  }

  let snapshot: TransitionDirectorSnapshot = buildSnapshot('idle')

  function emit(event: TransitionDirectorEvent): void {
    snapshot = buildSnapshot(event)
    for (const listener of [...listeners]) {
      listener(snapshot)
    }
    if (event === 'start') {
      options.onStart?.(snapshot)
    } else if (event === 'progress') {
      options.onProgress?.(snapshot)
    } else if (event === 'retarget') {
      options.onRetarget?.(snapshot)
    } else if (event === 'complete' && lastCompletion !== null) {
      options.onComplete?.(lastCompletion)
    }
  }

  /** Runs one guarded window: layers apply, then the camera is put back. */
  function guardCamera<T>(apply: () => T): T {
    if (camera === null) {
      return apply()
    }
    const before = camera.capture()
    const result = apply()
    const after = camera.capture()
    if (!cameraStatesEqual(before, after)) {
      camera.restore(before)
      cameraRestorations += 1
    }
    return result
  }

  function issueCrossfade(current: ActiveSwitch): void {
    if (audio === null) {
      return
    }
    const soundscape = getSoundscape(current.to)
    audio.crossfadeToSoundscape({
      eraId: current.to,
      soundscape,
      seconds: options.crossfadeSeconds ?? DEFAULT_CROSSFADE_SECONDS,
    })
    crossfades += 1
    lastCrossfadeEraId = current.to
    const cues = selectEraCues(current.to, soundscape, options.cueLimit ?? DEFAULT_CUE_LIMIT)
    cueIds = cues.map((request) => request.cue.id)
    for (const request of cues) {
      audio.playCue(request)
    }
  }

  function maybeCrossfade(frames: readonly LayerFrame[], current: ActiveSwitch): void {
    if (current.crossfaded) {
      return
    }
    const stage = frames.find((frame) => frame.id === SOUNDSCAPE_STAGE_ID)
    if (stage === undefined || stage.progress <= 0) {
      return
    }
    current.crossfaded = true
    issueCrossfade(current)
  }

  /** Applies one staged frame: every registered layer plus the soundscape stage. */
  function applyFrame(): void {
    const current = active
    if (current === null) {
      return
    }
    const frames = resolveLayerFrames(resolved, {
      elapsedSeconds: current.elapsed,
      offsets: current.offsets,
      registered: registeredIds,
    })

    guardCamera(() => {
      for (const frame of frames) {
        const adapter = adapters.get(frame.id)
        if (adapter === undefined) {
          continue
        }
        const request: LayerTransitionRequest = {
          ...stageRequest(frame, current.from, current.to),
          reducedMotion: false,
        }
        const application = adapter.applyEraTransition(request)
        layerStates.set(frame.id, {
          id: frame.id,
          kind: 'transition',
          from: request.from,
          to: request.to,
          t: request.t,
          eraId: application.eraId,
        })
      }
    })

    current.frames += 1
    maybeCrossfade(frames, current)
    current.progress = meanProgress(frames.filter((frame) => frame.registered).map((frame) => frame.progress))
    store.getState().setProgress(current.progress)
    emit('progress')
  }

  /** The reduced-motion path: one step, no interpolation, signal at once. */
  function applyInstant(): void {
    const current = active
    if (current === null) {
      return
    }
    const request: LayerEraRequest = { eraId: current.to, reducedMotion: true }
    guardCamera(() => {
      for (const frame of framesInOrder()) {
        const adapter = adapters.get(frame)
        if (adapter === undefined) {
          continue
        }
        const application = adapter.applyEra(request)
        layerStates.set(frame, {
          id: frame,
          kind: 'era',
          from: current.from,
          to: current.to,
          t: 1,
          eraId: application.eraId,
        })
      }
    })
    current.progress = 1
    store.getState().setProgress(1)
    if (!current.crossfaded) {
      current.crossfaded = true
      issueCrossfade(current)
    }
    finish()
  }

  function framesInOrder(): readonly TransitionStageId[] {
    return stageOrder
  }

  function finish(): void {
    const current = active
    if (current === null) {
      return
    }
    const unchanged =
      cameraAtStart === null || camera === null || cameraStatesEqual(cameraAtStart, camera.capture())
    store.getState().setProgress(1)
    store.getState().completeTransition()
    lastCompletion = {
      fromEra: current.from,
      toEra: current.to,
      progress: 1,
      durationSeconds: current.reducedMotion ? 0 : current.elapsed,
      frames: current.frames,
      reducedMotion: current.reducedMotion,
      retargetCount: current.retargets,
      completedAtSeconds: clock.now(),
      cameraUnchanged: unchanged,
    }
    active = null
    emit('complete')
  }

  function begin(from: EraId, to: EraId, resumedProgress = 0): void {
    if (from === to || active !== null) {
      return
    }
    const now = clock.now()
    const reduced = motion?.isReducedMotion() ?? false
    active = {
      from,
      to,
      elapsed: 0,
      lastClockSeconds: now,
      startSeconds: now,
      offsets: new Map(),
      progress: reduced ? 0 : clamp01(resumedProgress),
      frames: 0,
      retargets: 0,
      crossfaded: false,
      reducedMotion: reduced,
    }
    cameraAtStart = camera === null ? null : camera.capture()
    cameraRestorations = 0
    writing = true
    try {
      store.getState().setTransition(from, to, clamp01(resumedProgress))
    } finally {
      writing = false
    }
    emit('start')
    if (reduced) {
      applyInstant()
      return
    }
    applyFrame()
    if (resolved.durationSeconds <= 0) {
      finish()
    }
  }

  /**
   * Mid-flight retarget: the new `from` is the visually dominant era and every
   * stage continues from the progress it had already reached.
   */
  function retarget(nextTo: EraId): void {
    const current = active
    if (current === null) {
      return
    }
    if (nextTo === current.to) {
      return
    }
    const frames = resolveLayerFrames(resolved, {
      elapsedSeconds: current.elapsed,
      offsets: current.offsets,
      registered: registeredIds,
    })
    const offsets = new Map<TransitionStageId, number>()
    for (const frame of frames) {
      offsets.set(frame.id, frame.progress)
    }
    const dominant = resolveDominantEra(current.from, current.to, current.progress)
    const resumed = meanProgress(registeredFrames(frames).map((frame) => frame.progress))
    const now = clock.now()
    current.from = dominant
    current.to = nextTo
    current.offsets = offsets
    current.elapsed = 0
    current.startSeconds = now
    current.lastClockSeconds = now
    current.crossfaded = false
    current.retargets += 1
    current.reducedMotion = motion?.isReducedMotion() ?? false
    cameraAtStart = camera === null ? null : camera.capture()
    cameraRestorations = 0
    writing = true
    try {
      store.getState().setTransition(dominant, nextTo, resumed)
    } finally {
      writing = false
    }
    emit('retarget')
    if (current.reducedMotion) {
      applyInstant()
      return
    }
    // Realise the new pair immediately at the resumed progress, so no visual
    // frame is wasted showing the superseded destination.
    applyFrame()
  }

  function handleSelection(eraId: EraId, previousEraId: EraId): void {
    if (writing) {
      return
    }
    if (active === null) {
      begin(previousEraId, eraId)
    } else {
      retarget(eraId)
    }
  }

  function tick(): TransitionDirectorSnapshot {
    const current = active
    if (current === null) {
      return snapshot
    }
    if (!current.reducedMotion && (motion?.isReducedMotion() ?? false)) {
      // The preference changed while the block was mid-morph: honour it now.
      current.reducedMotion = true
      applyInstant()
      return snapshot
    }
    const now = clock.now()
    const finite = Number.isFinite(now)
    const delta = finite ? Math.max(0, now - current.lastClockSeconds) : 0
    if (finite) {
      current.lastClockSeconds = now
    }
    if (delta <= 0) {
      return snapshot
    }
    current.elapsed += delta
    if (current.elapsed >= resolved.durationSeconds) {
      current.elapsed = resolved.durationSeconds
      applyFrame()
      finish()
      return snapshot
    }
    applyFrame()
    return snapshot
  }

  function start(): void {
    if (unsubscribe !== null) {
      return
    }
    unsubscribe = subscribeToEraSelection(store, handleSelection)
    const state = store.getState()
    if (state.fromEra !== state.toEra) {
      begin(state.fromEra, state.toEra, state.progress)
    }
  }

  function stop(): void {
    if (unsubscribe === null) {
      return
    }
    unsubscribe()
    unsubscribe = null
  }

  function complete(): void {
    const current = active
    if (current === null) {
      return
    }
    if (current.reducedMotion) {
      applyInstant()
      return
    }
    current.elapsed = resolved.durationSeconds
    applyFrame()
    finish()
  }

  const director: TransitionDirector = {
    schedule,
    resolvedSchedule: resolved,
    layers,
    getSnapshot(): TransitionDirectorSnapshot {
      return snapshot
    },
    subscribe(listener: (next: TransitionDirectorSnapshot) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    tick,
    start,
    stop,
    selectEra(eraId: EraId): void {
      store.getState().selectEra(eraId)
    },
    complete,
    get active(): boolean {
      return active !== null
    },
    dispose(): void {
      stop()
      listeners.clear()
    },
  }

  if (options.autoStart !== false) {
    start()
  }

  return director
}
