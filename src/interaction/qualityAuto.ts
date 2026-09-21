/**
 * Adaptive quality: measured frame time in, one tier step out.
 *
 * The controller is a pure reducer. It reads the same numbers the render
 * pipeline's own policy is written against — {@link QUALITY_TIERS} budgets, the
 * shared {@link FRAME_BUDGET_TOLERANCE}, the pipeline's
 * {@link MIN_ADAPTIVE_SAMPLES}, {@link OVER_BUDGET_STREAK} and
 * {@link UPGRADE_HEADROOM} — and it changes **at most one tier per adjustment**.
 *
 * Hysteresis is why it is a reducer rather than two `if`s:
 *
 * - a downgrade needs the rolling average *above* the budget plus
 *   {@link OVER_BUDGET_STREAK} consecutive over-budget frames;
 * - an upgrade needs the average *below* {@link UPGRADE_HEADROOM} of the budget
 *   for {@link SUSTAINED_HEADROOM_FRAMES} consecutive frames — a much longer
 *   window, so a single lucky frame cannot climb back;
 * - {@link ADAPTIVE_COOLDOWN_FRAMES} separate two changes, so the tier does not
 *   oscillate when the block sits right on the budget line.
 *
 * Evidence is counted in **time as well as frames**, because frame counts assume
 * the host is rendering at something near the target rate. A device slow enough
 * to produce a handful of frames per second would otherwise need a minute of
 * visibly broken frames before it reacted — ninety frames is a minute and a half
 * at 1 fps, which is exactly the shape of the software-rasterised browser the
 * acceptance suite runs in. The same evidence measured in seconds reacts in a
 * bounded wall-clock time: once {@link MIN_ADAPTIVE_SECONDS} of measurements
 * (or {@link MIN_ADAPTIVE_SAMPLES} frames, whichever comes first) have been
 * recorded, a downgrade needs {@link OVER_BUDGET_SECONDS} of sustained
 * over-budget frames, and two changes are separated by
 * {@link ADAPTIVE_COOLDOWN_SECONDS}. Each frame may claim at most
 * {@link MAX_EVIDENCE_STEP_SECONDS} of that evidence, so a single long stall
 * still counts as evidence without triggering on its own. A sample that carries
 * no timing — every unit test, and any host without a clock — leaves the
 * controller on exactly the frame-count policy above, so the frame-rate
 * behaviour at 60 fps is unchanged (30 frames is half a second there, well
 * before 1.5 s of accumulated evidence).
 *
 * And it yields to the viewer: while the ui-controls store reports a manual tier
 * override the reducer suspends, keeps counting frames, and resumes only once
 * the override is cleared. Nothing here touches a store or a renderer — that is
 * the controller's job — so the whole policy is assertable without a GPU.
 */

import {
  FRAME_BUDGET_TOLERANCE,
  QUALITY_TIERS,
  downgradeQualityTier,
  upgradeQualityTier,
} from '../lib/quality'
import type { QualityTierName } from '../lib/quality'
import { MIN_ADAPTIVE_SAMPLES, OVER_BUDGET_STREAK, UPGRADE_HEADROOM } from '../scene'

/** Consecutive comfortable frames that justify climbing one tier. */
export const SUSTAINED_HEADROOM_FRAMES = 90

/** Frames that must pass after a change before another is allowed. */
export const ADAPTIVE_COOLDOWN_FRAMES = 60

/** Seconds that must pass after a change before another is allowed. */
export const ADAPTIVE_COOLDOWN_SECONDS = 1

/** Seconds of measurements that satisfy the warm-up window. */
export const MIN_ADAPTIVE_SECONDS = 1.5

/**
 * Seconds of sustained over-budget frames that justify a downgrade.
 *
 * The budget is a per-frame promise, so a second and a half of frames that miss
 * it is unambiguous evidence on any host, however few frames that second holds.
 */
export const OVER_BUDGET_SECONDS = 1.5

/**
 * Longest single frame that may count as elapsed evidence.
 *
 * A stall, a garbage collection pause or a background tab can produce
 * multi-second steps; capping the step keeps one of them from claiming a whole
 * evidence window while still counting the frame as over budget.
 */
export const MAX_EVIDENCE_STEP_SECONDS = 0.25

/** Why the controller left the tier where it was. */
export type AdaptiveQualityReason =
  | 'warmup'
  | 'holding'
  | 'cooldown'
  | 'capped'
  | 'suspended'
  | 'over-budget'
  | 'headroom'

/** One frame's evidence for the controller. */
export interface AdaptiveQualitySample {
  /** Rolling average frame time in milliseconds. */
  readonly frameTimeMs: number
  /** True while the viewer's manual tier override is set in ui-controls. */
  readonly manualOverride: boolean
  /**
   * Seconds the measured frame lasted, when the host has a clock.
   *
   * Omitted or zero leaves the controller on its frame-count policy alone.
   */
  readonly deltaSeconds?: number
}

/** A tier change worth telling the viewer about. */
export interface AdaptiveQualityNotice {
  readonly id: string
  readonly from: QualityTierName
  readonly to: QualityTierName
  readonly reason: 'over-budget' | 'headroom'
  readonly frameTimeMs: number
  readonly budgetMs: number
  readonly message: string
}

/** Rolling state of the adaptive controller. */
export interface AdaptiveQualityState {
  readonly tier: QualityTierName
  /** Frames measured since the controller started. */
  readonly samples: number
  /** Seconds of measurements recorded since the controller started. */
  readonly measuredSeconds: number
  readonly overBudgetStreak: number
  /** Seconds of sustained over-budget frames. */
  readonly overBudgetSeconds: number
  readonly headroomStreak: number
  /** Frames since the last tier change. */
  readonly framesSinceChange: number
  /** Seconds since the last tier change. */
  readonly secondsSinceChange: number
  /** True while the viewer's manual override suspends the controller. */
  readonly suspended: boolean
  /** How many automatic changes have been applied. */
  readonly changes: number
  readonly lastReason: AdaptiveQualityReason
}

/** Outcome of one frame. */
export interface AdaptiveQualityStep {
  readonly state: AdaptiveQualityState
  /** Notice to show, when the tier changed. */
  readonly notice: AdaptiveQualityNotice | null
  readonly tierChanged: boolean
  readonly previousTier: QualityTierName
}

/** Frame budget of one tier, from the shared table. */
export function frameBudgetFor(tier: QualityTierName): number {
  return QUALITY_TIERS[tier].frameBudgetMs
}

/** Human label of a tier, taken from the tier record so nothing is re-worded. */
export function tierLabel(tier: QualityTierName): string {
  return QUALITY_TIERS[tier].label
}

/** Fresh controller state for one tier. */
export function createAdaptiveQualityState(tier: QualityTierName): AdaptiveQualityState {
  return {
    tier,
    samples: 0,
    measuredSeconds: 0,
    overBudgetStreak: 0,
    overBudgetSeconds: 0,
    headroomStreak: 0,
    framesSinceChange: ADAPTIVE_COOLDOWN_FRAMES,
    secondsSinceChange: ADAPTIVE_COOLDOWN_SECONDS,
    suspended: false,
    changes: 0,
    lastReason: 'warmup',
  }
}

function noticeFor(
  from: QualityTierName,
  to: QualityTierName,
  reason: 'over-budget' | 'headroom',
  frameTimeMs: number,
  budgetMs: number,
  id: string,
  /** Which evidence window fired, so the notice never mis-states the run. */
  evidence: string,
): AdaptiveQualityNotice {
  const measured = `Measured ${frameTimeMs.toFixed(1)} ms per frame against a ${budgetMs.toFixed(1)} ms budget`
  const message =
    reason === 'over-budget'
      ? `Quality lowered to ${tierLabel(to)} to hold the frame rate. ${measured} for ${evidence}. Pick a tier by hand to take over.`
      : `Quality raised to ${tierLabel(to)} — there is headroom again. ${measured} for ${evidence}.`
  return { id, from, to, reason, frameTimeMs, budgetMs, message }
}

/** Clamps one frame's step into the evidence window. */
function evidenceSeconds(deltaSeconds: number | undefined): number {
  if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds)) {
    return 0
  }
  return Math.min(Math.max(0, deltaSeconds), MAX_EVIDENCE_STEP_SECONDS)
}

/**
 * Advances the controller by one measured frame.
 *
 * Pure: the same state and sample always produce the same step, which is what
 * lets the unit suite walk a whole budget regression and a whole recovery
 * without a renderer.
 */
export function stepAdaptiveQuality(
  state: AdaptiveQualityState,
  sample: AdaptiveQualitySample,
  options: { readonly noticeId?: string } = {},
): AdaptiveQualityStep {
  const samples = state.samples + 1
  const framesSinceChange = state.framesSinceChange + 1
  const frameTimeMs = Number.isFinite(sample.frameTimeMs) ? Math.max(0, sample.frameTimeMs) : 0
  const stepSeconds = evidenceSeconds(sample.deltaSeconds)
  const measuredSeconds = state.measuredSeconds + stepSeconds
  const secondsSinceChange = state.secondsSinceChange + stepSeconds

  const unchanged = (patch: Partial<AdaptiveQualityState>, reason: AdaptiveQualityReason): AdaptiveQualityStep => ({
    state: {
      ...state,
      samples,
      measuredSeconds,
      framesSinceChange,
      secondsSinceChange,
      ...patch,
      lastReason: reason,
    },
    notice: null,
    tierChanged: false,
    previousTier: state.tier,
  })

  if (sample.manualOverride) {
    // The viewer owns the tier: keep measuring, change nothing, and clear the
    // streaks so a resumed controller starts from a clean slate.
    return unchanged(
      { suspended: true, overBudgetStreak: 0, overBudgetSeconds: 0, headroomStreak: 0 },
      'suspended',
    )
  }

  const budget = frameBudgetFor(state.tier)
  const overBudget = frameTimeMs > budget * (1 + FRAME_BUDGET_TOLERANCE)
  const headroom = frameTimeMs < budget * UPGRADE_HEADROOM
  const overBudgetStreak = overBudget ? state.overBudgetStreak + 1 : 0
  const overBudgetSeconds = overBudget ? state.overBudgetSeconds + stepSeconds : 0
  const headroomStreak = headroom ? state.headroomStreak + 1 : 0
  const streaks = { suspended: false, overBudgetStreak, overBudgetSeconds, headroomStreak }

  // Warm-up: enough frames, or enough measured time, to tell a trend from a
  // single bad frame at mount.
  if (samples < MIN_ADAPTIVE_SAMPLES && measuredSeconds < MIN_ADAPTIVE_SECONDS) {
    return unchanged(streaks, 'warmup')
  }
  // Cooldown: satisfied by either currency, so the tier cannot oscillate at the
  // target rate and a slow host is not made to wait a minute between steps.
  const cooledDown =
    framesSinceChange >= ADAPTIVE_COOLDOWN_FRAMES || secondsSinceChange >= ADAPTIVE_COOLDOWN_SECONDS
  if (!cooledDown) {
    return unchanged(streaks, 'cooldown')
  }

  if (overBudgetStreak >= OVER_BUDGET_STREAK || overBudgetSeconds >= OVER_BUDGET_SECONDS) {
    const next = downgradeQualityTier(state.tier, 1)
    if (next === state.tier) {
      return unchanged(streaks, 'capped')
    }
    return {
      state: {
        ...state,
        tier: next,
        samples,
        measuredSeconds,
        framesSinceChange: 0,
        secondsSinceChange: 0,
        suspended: false,
        overBudgetStreak: 0,
        overBudgetSeconds: 0,
        headroomStreak: 0,
        changes: state.changes + 1,
        lastReason: 'over-budget',
      },
      notice: noticeFor(
        state.tier,
        next,
        'over-budget',
        frameTimeMs,
        budget,
        options.noticeId ?? `adaptive:${state.changes + 1}`,
        overBudgetStreak >= OVER_BUDGET_STREAK
          ? `${OVER_BUDGET_STREAK} frames`
          : `${overBudgetSeconds.toFixed(1)} s of frames`,
      ),
      tierChanged: true,
      previousTier: state.tier,
    }
  }

  if (headroomStreak >= SUSTAINED_HEADROOM_FRAMES) {
    const next = upgradeQualityTier(state.tier, 1)
    if (next === state.tier) {
      return unchanged(streaks, 'capped')
    }
    return {
      state: {
        ...state,
        tier: next,
        samples,
        measuredSeconds,
        framesSinceChange: 0,
        secondsSinceChange: 0,
        suspended: false,
        overBudgetStreak: 0,
        overBudgetSeconds: 0,
        headroomStreak: 0,
        changes: state.changes + 1,
        lastReason: 'headroom',
      },
      notice: noticeFor(
        state.tier,
        next,
        'headroom',
        frameTimeMs,
        budget,
        options.noticeId ?? `adaptive:${state.changes + 1}`,
        `${SUSTAINED_HEADROOM_FRAMES} frames`,
      ),
      tierChanged: true,
      previousTier: state.tier,
    }
  }

  return unchanged(streaks, 'holding')
}
