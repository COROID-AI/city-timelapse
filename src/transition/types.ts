/**
 * Contract of the staged era transition director.
 *
 * The director turns one era selection into an in-place transformation of the
 * block. It owns the transition clock, the per-stage schedule, the from/to era
 * bookkeeping it writes back to {@link EraStore}, the mid-transition retarget,
 * camera continuity, the audio crossfade/cue hand-off and the completion signal
 * the overlay reads. Everything it needs from the rest of the application is
 * expressed here as a small port, so the director itself imports no layer, no
 * pipeline and no engine:
 *
 * | port                    | who implements it                                     |
 * | ----------------------- | ----------------------------------------------------- |
 * | `EraStore`              | `src/state/eraStore.ts` — the single era selection     |
 * | `TransitionLayerAdapter`| one per scene layer, built from its barrel in          |
 * |                         | `adapters.ts` (`applyEra` / `applyEraTransition`)      |
 * | `TransitionAudioPort`   | `src/audio` via `createAudioEnginePort`                 |
 * | `TransitionCameraPort`  | the pipeline's navigation controls                      |
 * | `TransitionMotionPort`  | `src/ui/uiStore.ts` reduced-motion preference           |
 * | `TransitionClock`       | `performance.now`, or a manual clock in tests/harness   |
 *
 * The four acceptance-critical rules the types encode:
 *
 * 1. **Staged order.** {@link TRANSITION_STAGE_ORDER} is the documented
 *    theatrical order — atmosphere, buildings, storefronts/signage, props,
 *    vehicles/pedestrians, then the soundscape — and every stage's delay,
 *    duration and easing come from a schedule table, never from code.
 * 2. **Interruptible.** The director keeps its own from/to pair while a
 *    transition runs, so a new selection can retarget from the visually
 *    dominant era without restarting.
 * 3. **Camera continuity.** `TransitionCameraPort` is capture/restore only: the
 *    director may never move the viewer.
 * 4. **Reduced motion.** {@link TransitionMotionPort} is read at every switch, so
 *    the preference can change while the viewer is on the page.
 */

import type { EraId, EraSoundscape, EraSoundscapeCue } from '../era'
import type { CameraState } from '../scene'
import type { EraStore } from '../state/eraStore'

/* -------------------------------------------------------------------------- */
/* Stages                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The seven stages a period change plays through, in the documented order.
 *
 * `vehicles` and `pedestrians` share one band of the story (the crowd and the
 * traffic arrive together) and `soundscape` closes the change: the ambience
 * crossfades once the block has already re-dressed.
 */
export const TRANSITION_STAGES = [
  'atmosphere',
  'buildings',
  'storefronts',
  'props',
  'vehicles',
  'pedestrians',
  'soundscape',
] as const

/** Identifier of one staged part of a period change. */
export type TransitionStageId = (typeof TRANSITION_STAGES)[number]

/** The documented theatrical order, as frozen runtime data. */
export const TRANSITION_STAGE_ORDER: readonly TransitionStageId[] = Object.freeze([
  ...TRANSITION_STAGES,
])

/** The stage that carries the audio crossfade rather than a scene layer. */
export const SOUNDSCAPE_STAGE_ID: TransitionStageId = 'soundscape'

/** Display names, used by the harness, the debug report and test messages. */
export const STAGE_LABELS: Readonly<Record<TransitionStageId, string>> = Object.freeze({
  atmosphere: 'Atmosphere and sky',
  buildings: 'Buildings',
  storefronts: 'Storefronts and signage',
  props: 'Street furniture',
  vehicles: 'Vehicles',
  pedestrians: 'Pedestrians',
  soundscape: 'Soundscape',
})

/* -------------------------------------------------------------------------- */
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

/** Easing curves the schedule table may name. */
export const EASING_NAMES = [
  'linear',
  'smoothstep',
  'easeInOutSine',
  'easeOutCubic',
  'easeInOutCubic',
] as const

/** Identifier of an easing curve available to the schedule. */
export type EasingName = (typeof EASING_NAMES)[number]

/**
 * One row of the transition table.
 *
 * `delaySeconds` is measured from the moment the switch starts, so the rows'
 * delays stagger the stages; `durationSeconds` is the length of the stage's own
 * blend. Changing the character of a period change is editing these numbers.
 */
export interface LayerScheduleEntry {
  /** Stage this row schedules. */
  readonly id: TransitionStageId
  /** Human-readable name, defaulted from {@link STAGE_LABELS}. */
  readonly label: string
  /** Seconds to wait after the switch starts before the stage begins. */
  readonly delaySeconds: number
  /** Length of the stage's blend in seconds; 0 means an instant stage. */
  readonly durationSeconds: number
  /** Curve applied to the stage's own 0..1 progress. */
  readonly easing: EasingName
}

/** A complete transition table, in play order. */
export type TransitionScheduleTable = readonly LayerScheduleEntry[]

/** One stage's window inside a resolved schedule. */
export interface ResolvedScheduleEntry extends LayerScheduleEntry {
  /** Absolute start of the stage, equal to `delaySeconds`. */
  readonly startSeconds: number
  /** Absolute end of the stage. */
  readonly endSeconds: number
}

/** A schedule table with absolute windows and the total run time. */
export interface ResolvedSchedule {
  /** Entries in documented order, with absolute windows. */
  readonly entries: readonly ResolvedScheduleEntry[]
  /** Last stage end: the shortest run that still plays every stage. */
  readonly durationSeconds: number
  /** Look-up by stage id. */
  entryFor(id: TransitionStageId): ResolvedScheduleEntry
  /** True when the table schedules this stage. */
  has(id: TransitionStageId): boolean
}

/**
 * One stage's state at a moment in time.
 *
 * `progress` is always the value handed to the layer, i.e. already clamped into
 * 0..1 and already biased by any retarget resumption, so a layer can trust it and
 * a test can assert on it directly.
 */
export interface LayerFrame {
  readonly id: TransitionStageId
  readonly label: string
  readonly delaySeconds: number
  readonly durationSeconds: number
  readonly startSeconds: number
  readonly endSeconds: number
  /** The stage's own linear progress through its window, 0..1. */
  readonly rawT: number
  /** `rawT` through the stage's easing curve, 0..1. */
  readonly easedT: number
  /** Eased progress plus the resumption offset a retarget added, 0..1. */
  readonly progress: number
  /** True when the stage has begun (its delay has elapsed). */
  readonly started: boolean
  /** True when a layer adapter is registered for this stage. */
  readonly registered: boolean
  /** True at exactly 1. */
  readonly complete: boolean
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                     */
/* -------------------------------------------------------------------------- */

/** Instant request handed to a layer adapter: `applyEra` with context. */
export interface LayerEraRequest {
  /** Era the layer must show. */
  readonly eraId: EraId
  /** True when the viewer asked for an instant, un-animated change. */
  readonly reducedMotion: boolean
}

/** Staged request handed to a layer adapter: `applyEraTransition`. */
export interface LayerTransitionRequest {
  /** Era the blend starts from (the dominant era after a retarget). */
  readonly from: EraId
  /** Era the blend moves towards. */
  readonly to: EraId
  /** Blend weight in 0..1; exactly 1 lands on `to`. */
  readonly t: number
  /** Always false for staged frames; reserved for the layer contract. */
  readonly reducedMotion: boolean
}

/**
 * What a layer reported after it was driven.
 *
 * `eraId` is the era the layer itself says it holds: an exact era id once the
 * layer settled, `null` while two eras are visually blended. `result` stays
 * opaque to the director and is only read back by tests and the harness.
 */
export interface LayerApplication {
  readonly eraId: EraId | null
  readonly result?: unknown
}

/**
 * One scene layer, as the director drives it.
 *
 * Layer components are black boxes: the director only ever calls these two
 * functions and never reaches into a layer's internals.
 */
export interface TransitionLayerAdapter {
  /** Stage this adapter belongs to; must be scheduled by the table. */
  readonly id: TransitionStageId
  /** Display name for reports. */
  readonly label: string
  /** Applies one era in a single step (the reduced-motion path). */
  applyEra(request: LayerEraRequest): LayerApplication
  /** Applies one frame of a staged blend. */
  applyEraTransition(request: LayerTransitionRequest): LayerApplication
}

/** The last request a stage received, published for the harness and QA. */
export interface LayerApplicationRecord {
  readonly id: TransitionStageId
  readonly kind: 'era' | 'transition'
  readonly from: EraId
  readonly to: EraId
  readonly t: number
  /** Era the layer reported after the call. */
  readonly eraId: EraId | null
}

/* -------------------------------------------------------------------------- */
/* Ports                                                                      */
/* -------------------------------------------------------------------------- */

/** Injectable timing source. One clock drives all scheduling. */
export interface TransitionClock {
  /** Monotonic reading in seconds. */
  now(): number
}

/** Camera capture/restore. There is deliberately no "move" call. */
export interface TransitionCameraPort {
  /** Reads the viewer's current camera state. */
  capture(): CameraState
  /** Writes a previously captured state back, unchanged. */
  restore(state: CameraState): void
}

/** One ambience crossfade request, issued once per switch. */
export interface TransitionCrossfadeRequest {
  /** Era being moved to. */
  readonly eraId: EraId
  /** That era's soundscape record, straight from the era registry. */
  readonly soundscape: EraSoundscape
  /** Crossfade length in seconds. */
  readonly seconds: number
}

/** One era cue SFX request. */
export interface TransitionCueRequest {
  /** Era the cue belongs to. */
  readonly eraId: EraId
  /** The cue itself, straight from the era registry. */
  readonly cue: EraSoundscapeCue
  /** Earliest start, in seconds after the crossfade was requested. */
  readonly delaySeconds: number
  /** Linear gain the cue should be played at. */
  readonly gain: number
}

/**
 * Audio hand-off of a switch.
 *
 * Two calls only: one crossfade to the target era's soundscape and the era's cue
 * SFX. Implementations translate this into whatever engine they own; the
 * director never talks to a WebAudio node.
 */
export interface TransitionAudioPort {
  /** Moves the ambience bed to the target era. Called once per switch. */
  crossfadeToSoundscape(request: TransitionCrossfadeRequest): void
  /** Fires one era cue SFX. */
  playCue(request: TransitionCueRequest): void
}

/** Reduced-motion preference read at switch time. */
export interface TransitionMotionPort {
  /** True when era changes must be applied in a single step. */
  isReducedMotion(): boolean
}

/* -------------------------------------------------------------------------- */
/* Director state                                                             */
/* -------------------------------------------------------------------------- */

/** Why the director notified its listeners. */
export type TransitionDirectorEvent = 'start' | 'progress' | 'retarget' | 'complete' | 'idle'

/** Camera continuity report. */
export interface TransitionCameraSnapshot {
  /** True when a camera port is attached. */
  readonly tracked: boolean
  /** State captured when the current switch began. */
  readonly atStart: CameraState | null
  /** State as the camera port reports it now. */
  readonly current: CameraState | null
  /** How many times the director had to undo a layer's camera change. */
  readonly restorations: number
  /** True while the camera still matches the state captured at switch start. */
  readonly unchanged: boolean
}

/** Audio report of the current/last switch. */
export interface TransitionAudioSnapshot {
  /** Crossfades requested by this director instance. */
  readonly crossfades: number
  /** Era of the most recent crossfade, or null. */
  readonly lastCrossfadeEraId: EraId | null
  /** Cue ids fired by the most recent crossfade, in order. */
  readonly cueIds: readonly string[]
}

/** The completion signal the UI clears its indicator on. */
export interface TransitionCompletionSignal {
  /** Era the finished transition started from (the effective one). */
  readonly fromEra: EraId
  /** Era the block now shows. */
  readonly toEra: EraId
  /** Always 1; present so the signal is self-describing. */
  readonly progress: number
  /** Run time of the finished transition, in seconds. */
  readonly durationSeconds: number
  /** Staged frames applied; 0 for a reduced-motion instant switch. */
  readonly frames: number
  /** True when reduced motion collapsed the switch into one step. */
  readonly reducedMotion: boolean
  /** How many times the switch was retargeted before it finished. */
  readonly retargetCount: number
  /** Clock reading at completion, in seconds. */
  readonly completedAtSeconds: number
  /** True when the camera is exactly where the viewer left it. */
  readonly cameraUnchanged: boolean
}

/** Everything the overlay, the harness and QA read from the director. */
export interface TransitionDirectorSnapshot {
  /** True while a staged transition is running. */
  readonly active: boolean
  /** Era the running transition morphs away from. */
  readonly fromEra: EraId
  /** Era the running transition morphs towards. */
  readonly toEra: EraId
  /** Era the era store holds as selected. */
  readonly selectedEra: EraId
  /** The director's own progress, 0..1; exactly 1 after a completed switch. */
  readonly progress: number
  /** The era store's blend weight, 0..1 (0 again once settled). */
  readonly storeProgress: number
  /** True while the stored pair spans two eras. */
  readonly transitioning: boolean
  /** Seconds since the current switch began. */
  readonly elapsedSeconds: number
  /** Total run time of the schedule in use. */
  readonly durationSeconds: number
  /** True when the current/last switch was an instant one. */
  readonly reducedMotion: boolean
  /** Staged frames applied by the current/last switch; 0 for reduced motion. */
  readonly frames: number
  /** Retargets the current/last switch absorbed. */
  readonly retargetCount: number
  /** The documented stage order the director schedules. */
  readonly stageOrder: readonly TransitionStageId[]
  /** Stages with a registered adapter. */
  readonly registeredLayers: readonly TransitionStageId[]
  /**
   * Scheduled content stages with no layer adapter yet (a barrel that is not
   * shipped in this revision). The soundscape stage is never listed: it is
   * driven through the audio port rather than a layer.
   */
  readonly pendingStages: readonly TransitionStageId[]
  /** Per-stage state at the current instant, in documented order. */
  readonly layerFrames: readonly LayerFrame[]
  /** Last request each registered stage received. */
  readonly layerStates: readonly LayerApplicationRecord[]
  /** Camera continuity report. */
  readonly camera: TransitionCameraSnapshot
  /** Audio report. */
  readonly audio: TransitionAudioSnapshot
  /** Completion signal of the last finished switch. */
  readonly lastCompletion: TransitionCompletionSignal | null
  /** What the last notification was about. */
  readonly lastEvent: TransitionDirectorEvent
}

/** Callbacks a host may attach instead of subscribing. */
export interface TransitionDirectorHooks {
  readonly onStart?: (snapshot: TransitionDirectorSnapshot) => void
  readonly onProgress?: (snapshot: TransitionDirectorSnapshot) => void
  readonly onRetarget?: (snapshot: TransitionDirectorSnapshot) => void
  readonly onComplete?: (signal: TransitionCompletionSignal) => void
}

/** Options of {@link import('./director').createTransitionDirector}. */
export interface TransitionDirectorOptions extends TransitionDirectorHooks {
  /** The era store: the only source of user intent. */
  readonly store: EraStore
  /** Layer adapters, one per shipped scene layer. */
  readonly layers?: readonly TransitionLayerAdapter[]
  /** Audio hand-off; omitted means "no sound in this host". */
  readonly audio?: TransitionAudioPort | null
  /** Camera capture/restore port; omitted means "nothing to protect". */
  readonly camera?: TransitionCameraPort | null
  /** Reduced-motion preference; omitted means "always animate". */
  readonly motion?: TransitionMotionPort | null
  /** Tunable table; defaults to {@link DEFAULT_TRANSITION_SCHEDULE}. */
  readonly schedule?: TransitionScheduleTable
  /** Injectable clock; defaults to the host's monotonic clock. */
  readonly clock?: TransitionClock
  /** Crossfade length handed to the audio port. */
  readonly crossfadeSeconds?: number
  /** How many of the target era's cue SFX one switch fires. */
  readonly cueLimit?: number
  /** Subscribe to the era store immediately; defaults to true. */
  readonly autoStart?: boolean
}

/** The director's public surface. */
export interface TransitionDirector {
  /** Table in use, in documented order. */
  readonly schedule: TransitionScheduleTable
  /** Resolved windows of that table. */
  readonly resolvedSchedule: ResolvedSchedule
  /** Registered adapters, in documented order. */
  readonly layers: readonly TransitionLayerAdapter[]
  /** Current snapshot; the same object until something changes. */
  getSnapshot(): TransitionDirectorSnapshot
  /** Subscribes to start/progress/retarget/complete notifications. */
  subscribe(listener: (snapshot: TransitionDirectorSnapshot) => void): () => void
  /** Advances the transition to the clock's current reading. */
  tick(): TransitionDirectorSnapshot
  /** Starts listening to the era store (idempotent). */
  start(): void
  /** Stops listening to the era store, keeping the director reusable. */
  stop(): void
  /** Selects an era through the era store, i.e. the UI's own path. */
  selectEra(eraId: EraId): void
  /** Collapses the running transition onto its target at once. */
  complete(): void
  /** True while a staged transition is running. */
  readonly active: boolean
  /** Releases listeners and the store subscription. */
  dispose(): void
}
