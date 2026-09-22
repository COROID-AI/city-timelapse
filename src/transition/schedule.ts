/**
 * The transition schedule: which stage re-dresses the block, when, and with what
 * easing.
 *
 * The table below is the whole "character" of a period change. It is data, not
 * code: the director reads it, the harness prints it, and a designer can retune
 * an era pair by editing numbers here (or by passing an override table to
 * {@link createTransitionSchedule}) without touching the director.
 *
 * The shipped rhythm is the documented theatrical order — atmosphere first, then
 * buildings, then storefronts and signage, then street furniture, then the crowd
 * and the traffic, and the soundscape last:
 *
 * | stage       | delay | duration | easing        | why                                  |
 * | ----------- | ----- | -------- | ------------- | ------------------------------------ |
 * | atmosphere  | 0.0 s | 1.8 s    | easeInOutCubic| sky, sun and haze move first          |
 * | buildings   | 0.9 s | 2.6 s    | easeInOutCubic| the massing is the slowest, biggest  |
 * | storefronts | 1.9 s | 1.8 s    | smoothstep    | signage follows the massing          |
 * | props       | 2.3 s | 1.4 s    | easeOutCubic  | furniture swaps quickly              |
 * | vehicles    | 2.8 s | 1.5 s    | smoothstep    | traffic re-flows                      |
 * | pedestrians | 3.0 s | 1.6 s    | smoothstep    | the crowd walks in behind the traffic|
 * | soundscape  | 3.4 s | 1.4 s    | easeInOutSine | the ambience lands after the visuals |
 *
 * Every function here is pure: `resolveSchedule` validates the table and
 * `resolveLayerFrames` turns one clock reading into the per-stage progress the
 * director hands to the layers, including the resumption offsets a retarget
 * leaves behind.
 */

import type { EraId } from '../era'
import { clamp01, ease } from './easing'
import {
  STAGE_LABELS,
  TRANSITION_STAGE_ORDER,
  type EasingName,
  type LayerFrame,
  type LayerScheduleEntry,
  type ResolvedSchedule,
  type ResolvedScheduleEntry,
  type TransitionScheduleTable,
  type TransitionStageId,
} from './types'

/* -------------------------------------------------------------------------- */
/* The shipped table                                                          */
/* -------------------------------------------------------------------------- */

/** One row of the shipped table, written the way the table above reads. */
function row(
  id: TransitionStageId,
  delaySeconds: number,
  durationSeconds: number,
  easing: EasingName,
): LayerScheduleEntry {
  return Object.freeze({ id, label: STAGE_LABELS[id], delaySeconds, durationSeconds, easing })
}

/**
 * The shipped five-era rhythm.
 *
 * Frozen so no consumer can retune the shared table by accident; call
 * {@link createTransitionSchedule} for a tuned copy.
 */
export const DEFAULT_TRANSITION_SCHEDULE: TransitionScheduleTable = Object.freeze([
  row('atmosphere', 0, 1.8, 'easeInOutCubic'),
  row('buildings', 0.9, 2.6, 'easeInOutCubic'),
  row('storefronts', 1.9, 1.8, 'smoothstep'),
  row('props', 2.3, 1.4, 'easeOutCubic'),
  row('vehicles', 2.8, 1.5, 'smoothstep'),
  row('pedestrians', 3.0, 1.6, 'smoothstep'),
  row('soundscape', 3.4, 1.4, 'easeInOutSine'),
])

/** A partial edit of one table row, minus the stage id itself. */
export type LayerScheduleOverride = Partial<Omit<LayerScheduleEntry, 'id'>>

/** Per-stage edits accepted by {@link createTransitionSchedule}. */
export type TransitionScheduleOverrides = Partial<
  Readonly<Record<TransitionStageId, LayerScheduleOverride>>
>

/**
 * Builds a tuned copy of a table.
 *
 * Rows are keyed by stage id, so an override can never reorder the story: the
 * documented theatrical order is the table's own order and stays intact.
 */
export function createTransitionSchedule(
  overrides: TransitionScheduleOverrides = {},
  base: TransitionScheduleTable = DEFAULT_TRANSITION_SCHEDULE,
): TransitionScheduleTable {
  return base.map((entry) => {
    const override = overrides[entry.id]
    if (override === undefined) {
      return entry
    }
    return Object.freeze({
      id: entry.id,
      label: override.label ?? entry.label,
      delaySeconds: override.delaySeconds ?? entry.delaySeconds,
      durationSeconds: override.durationSeconds ?? entry.durationSeconds,
      easing: override.easing ?? entry.easing,
    })
  })
}

/* -------------------------------------------------------------------------- */
/* Validation and resolution                                                  */
/* -------------------------------------------------------------------------- */

/** Thrown when a schedule table cannot be played as written. */
export class TransitionScheduleError extends Error {
  /** Every problem found, in table order, so all of them can be fixed at once. */
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Invalid transition schedule: ${issues.join('; ')}`)
    this.name = 'TransitionScheduleError'
    this.issues = issues
  }
}

/** Reports every problem with a table; an empty array means "playable". */
export function validateSchedule(table: TransitionScheduleTable): readonly string[] {
  const issues: string[] = []
  const seen = new Set<TransitionStageId>()
  for (const entry of table) {
    if (seen.has(entry.id)) {
      issues.push(`stage '${entry.id}' is scheduled twice`)
    }
    seen.add(entry.id)
    if (!Number.isFinite(entry.delaySeconds) || entry.delaySeconds < 0) {
      issues.push(`stage '${entry.id}' has an invalid delay (${String(entry.delaySeconds)})`)
    }
    if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0) {
      issues.push(`stage '${entry.id}' has an invalid duration (${String(entry.durationSeconds)})`)
    }
  }
  return issues
}

/**
 * Adds absolute windows to a table and reports its total run time.
 *
 * The returned object keeps the table's own order, which is what makes the
 * director's stage order auditable against the documented one.
 */
export function resolveSchedule(table: TransitionScheduleTable = DEFAULT_TRANSITION_SCHEDULE): ResolvedSchedule {
  const issues = validateSchedule(table)
  if (issues.length > 0) {
    throw new TransitionScheduleError(issues)
  }

  const entries: ResolvedScheduleEntry[] = table.map((entry) =>
    Object.freeze({
      ...entry,
      startSeconds: entry.delaySeconds,
      endSeconds: entry.delaySeconds + entry.durationSeconds,
    }),
  )

  const byId = new Map<TransitionStageId, ResolvedScheduleEntry>()
  for (const entry of entries) {
    byId.set(entry.id, entry)
  }

  const durationSeconds = entries.reduce((longest, entry) => Math.max(longest, entry.endSeconds), 0)

  return {
    entries: Object.freeze(entries),
    durationSeconds,
    entryFor(id: TransitionStageId): ResolvedScheduleEntry {
      const entry = byId.get(id)
      if (entry === undefined) {
        throw new RangeError(`Stage '${id}' is not scheduled by this transition table.`)
      }
      return entry
    },
    has(id: TransitionStageId): boolean {
      return byId.has(id)
    },
  }
}

/** Stage ids of a table, in play order — the director's auditable order. */
export function scheduleStageOrder(table: TransitionScheduleTable): readonly TransitionStageId[] {
  return table.map((entry) => entry.id)
}

/** True when a table plays the documented theatrical order as a prefix-complete set. */
export function scheduleFollowsDocumentedOrder(table: TransitionScheduleTable): boolean {
  const order = scheduleStageOrder(table)
  let cursor = 0
  for (const id of TRANSITION_STAGE_ORDER) {
    const index = order.indexOf(id)
    if (index === -1) {
      continue
    }
    if (index < cursor) {
      return false
    }
    cursor = index
  }
  return true
}

/* -------------------------------------------------------------------------- */
/* Frames                                                                     */
/* -------------------------------------------------------------------------- */

/** What {@link resolveLayerFrames} needs to place the stages at one instant. */
export interface LayerFrameOptions {
  /** Seconds since the current switch began. */
  readonly elapsedSeconds: number
  /**
   * Per-stage progress already reached before a retarget. Each stage continues
   * from `offset + (1 - offset) * eased` instead of restarting from zero.
   */
  readonly offsets?: ReadonlyMap<TransitionStageId, number> | null
  /** Stages with a registered adapter; omitted means "all stages". */
  readonly registered?: readonly TransitionStageId[] | null
}

/**
 * Builds the frame of one stage at one instant.
 *
 * Pure and total: a stage before its delay is at exactly 0, a stage past its end
 * is at exactly 1 (whatever the easing), and a retarget offset is folded in so
 * the returned progress never decreases for that stage.
 */
export function resolveLayerFrame(
  schedule: ResolvedSchedule,
  id: TransitionStageId,
  options: LayerFrameOptions,
): LayerFrame {
  const entry = schedule.entryFor(id)
  const elapsed = Math.max(0, Number.isFinite(options.elapsedSeconds) ? options.elapsedSeconds : 0)
  const offset = clamp01(options.offsets?.get(id) ?? 0)
  const rawT =
    entry.durationSeconds <= 0
      ? elapsed >= entry.endSeconds
        ? 1
        : 0
      : clamp01((elapsed - entry.startSeconds) / entry.durationSeconds)
  const easedT = ease(entry.easing, rawT)
  const progress = clamp01(offset + (1 - offset) * easedT)
  const registered =
    options.registered == null ? true : options.registered.includes(id)

  return {
    id: entry.id,
    label: entry.label,
    delaySeconds: entry.delaySeconds,
    durationSeconds: entry.durationSeconds,
    startSeconds: entry.startSeconds,
    endSeconds: entry.endSeconds,
    rawT,
    easedT,
    progress,
    started: elapsed >= entry.startSeconds,
    registered,
    complete: progress >= 1,
  }
}

/** Frames of every stage of the table, in documented order. */
export function resolveLayerFrames(
  schedule: ResolvedSchedule,
  options: LayerFrameOptions,
): readonly LayerFrame[] {
  return schedule.entries.map((entry) => resolveLayerFrame(schedule, entry.id, options))
}

/** Convenience: the frames of the stages that actually have a layer adapter. */
export function registeredFrames(frames: readonly LayerFrame[]): readonly LayerFrame[] {
  return frames.filter((frame) => frame.registered)
}

/** Convenience: true when every registered stage of `frames` has landed. */
export function framesComplete(frames: readonly LayerFrame[]): boolean {
  return registeredFrames(frames).every((frame) => frame.complete)
}

/** Era pair a stage's request carries, for logging and assertions. */
export interface StageRequestEras {
  readonly from: EraId
  readonly to: EraId
  readonly t: number
}

/** Builds the `{ from, to, t }` triple a stage's frame translates into. */
export function stageRequest(frame: LayerFrame, from: EraId, to: EraId): StageRequestEras {
  return { from, to, t: frame.progress }
}
