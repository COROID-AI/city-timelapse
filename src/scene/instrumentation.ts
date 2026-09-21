/**
 * Frame-time instrumentation.
 *
 * The measurement path is the one piece of code that must never cost more than
 * the thing it measures, so it is written as a fixed-size ring buffer over a
 * `Float32Array`, a hand-rolled running sum and a single statistics object that
 * is mutated in place. Recording a frame allocates nothing; consumers that want
 * a snapshot can read `sample()` (the same object, every frame) or copy the
 * window with `history(target)`.
 *
 * The numbers reported are the ones the frame-budget policy in
 * `src/lib/quality.ts` is written against: instantaneous frame time, rolling
 * average, average fps, and how many frames missed the tier's budget.
 */

import { FRAME_BUDGET_MS } from '../lib/quality'
import { clamp } from './controls'
import type { FrameHook, FrameInstrumentation, FrameStats } from './types'

/** Samples in the default rolling window (~2 s at 60 fps). */
export const DEFAULT_FRAME_WINDOW = 120

/**
 * Longest frame that still counts as a frame.
 *
 * A background tab, a GC pause or a breakpoint can produce multi-second deltas
 * that would swamp the average; clamping keeps the rolling statistics useful
 * while still counting the frame as over budget.
 */
export const DEFAULT_MAX_FRAME_TIME_MS = 250

/** Options for {@link createFrameInstrumentation}. */
export interface FrameInstrumentationOptions {
  /** Rolling window size in frames; clamped to at least 2. */
  readonly windowSize?: number
  /** Budget in milliseconds per frame; defaults to the shared 60 fps budget. */
  readonly budgetMs?: number
  /** Upper clamp applied to a single frame's duration. */
  readonly maxFrameTimeMs?: number
  /** Hook called after every recorded frame. */
  readonly onFrame?: FrameHook
}

/** Mutable shape behind the read-only {@link FrameStats} view. */
interface WritableFrameStats {
  frames: number
  frameTimeMs: number
  averageFrameTimeMs: number
  minFrameTimeMs: number
  maxFrameTimeMs: number
  fps: number
  averageFps: number
  budgetMs: number
  withinBudget: boolean
  overBudgetFrames: number
  consecutiveOverBudgetFrames: number
}

/**
 * Creates the instrumentation.
 *
 * `record(deltaSeconds)` is the only method the render loop calls; it returns
 * the live statistics object so the loop can forward it to hooks without a
 * second lookup.
 */
export function createFrameInstrumentation(
  options: FrameInstrumentationOptions = {},
): FrameInstrumentation {
  const windowSize = Math.max(2, Math.round(options.windowSize ?? DEFAULT_FRAME_WINDOW))
  const maxFrameTimeMs = Math.max(1, options.maxFrameTimeMs ?? DEFAULT_MAX_FRAME_TIME_MS)
  const samples = new Float32Array(windowSize)
  const hooks = new Set<FrameHook>()

  let writeIndex = 0
  let sampleCount = 0
  let windowSum = 0
  let oldestIndex = 0

  const stats: WritableFrameStats = {
    frames: 0,
    frameTimeMs: 0,
    averageFrameTimeMs: 0,
    minFrameTimeMs: 0,
    maxFrameTimeMs: 0,
    fps: 0,
    averageFps: 0,
    budgetMs: options.budgetMs ?? FRAME_BUDGET_MS,
    withinBudget: true,
    overBudgetFrames: 0,
    consecutiveOverBudgetFrames: 0,
  }

  if (options.onFrame !== undefined) {
    hooks.add(options.onFrame)
  }

  /** Recomputes min/max from the window; only runs when an extreme is evicted. */
  const recomputeExtremes = (): void => {
    let min = Number.POSITIVE_INFINITY
    let max = 0
    for (let index = 0; index < sampleCount; index += 1) {
      const value = windowValue(index)
      if (value < min) {
        min = value
      }
      if (value > max) {
        max = value
      }
    }
    stats.minFrameTimeMs = sampleCount === 0 ? 0 : min
    stats.maxFrameTimeMs = sampleCount === 0 ? 0 : max
  }

  /** Logical index 0 = oldest retained sample. */
  const windowValue = (logicalIndex: number): number => {
    const physical = (oldestIndex + logicalIndex) % windowSize
    return samples[physical] ?? 0
  }

  const record = (deltaSeconds: number): FrameStats => {
    const raw = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds * 1000) : 0
    const frameTimeMs = Math.min(raw, maxFrameTimeMs)

    if (sampleCount < windowSize) {
      samples[writeIndex] = frameTimeMs
      writeIndex = (writeIndex + 1) % windowSize
      sampleCount += 1
      windowSum += frameTimeMs
      stats.minFrameTimeMs = sampleCount === 1 ? frameTimeMs : Math.min(stats.minFrameTimeMs, frameTimeMs)
      stats.maxFrameTimeMs = Math.max(stats.maxFrameTimeMs, frameTimeMs)
    } else {
      const evicted = samples[oldestIndex] ?? 0
      samples[oldestIndex] = frameTimeMs
      oldestIndex = (oldestIndex + 1) % windowSize
      windowSum += frameTimeMs - evicted
      if (evicted <= stats.minFrameTimeMs || evicted >= stats.maxFrameTimeMs) {
        recomputeExtremes()
      }
      if (frameTimeMs > stats.maxFrameTimeMs) {
        stats.maxFrameTimeMs = frameTimeMs
      }
      if (frameTimeMs < stats.minFrameTimeMs) {
        stats.minFrameTimeMs = frameTimeMs
      }
    }

    const averageFrameTimeMs = sampleCount === 0 ? 0 : windowSum / sampleCount
    stats.frames += 1
    stats.frameTimeMs = frameTimeMs
    stats.averageFrameTimeMs = averageFrameTimeMs
    stats.fps = frameTimeMs > 0 ? clamp(1000 / frameTimeMs, 0, 1000) : 0
    stats.averageFps = averageFrameTimeMs > 0 ? clamp(1000 / averageFrameTimeMs, 0, 1000) : 0
    stats.withinBudget = frameTimeMs <= stats.budgetMs
    if (stats.withinBudget) {
      stats.consecutiveOverBudgetFrames = 0
    } else {
      stats.overBudgetFrames += 1
      stats.consecutiveOverBudgetFrames += 1
    }

    for (const hook of hooks) {
      hook(stats, deltaSeconds)
    }
    return stats
  }

  return {
    stats,
    windowSize,
    sample: () => stats,
    record,
    setBudget(budgetMs: number): void {
      stats.budgetMs = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : FRAME_BUDGET_MS
      stats.withinBudget = stats.frameTimeMs <= stats.budgetMs
    },
    onFrame(hook: FrameHook): () => void {
      hooks.add(hook)
      return () => {
        hooks.delete(hook)
      }
    },
    history(target?: Float32Array): Float32Array {
      const output = target ?? new Float32Array(sampleCount)
      const length = Math.min(output.length, sampleCount)
      for (let index = 0; index < length; index += 1) {
        output[index] = windowValue(index)
      }
      return output
    },
    reset(): void {
      samples.fill(0)
      writeIndex = 0
      oldestIndex = 0
      sampleCount = 0
      windowSum = 0
      stats.frames = 0
      stats.frameTimeMs = 0
      stats.averageFrameTimeMs = 0
      stats.minFrameTimeMs = 0
      stats.maxFrameTimeMs = 0
      stats.fps = 0
      stats.averageFps = 0
      stats.withinBudget = true
      stats.overBudgetFrames = 0
      stats.consecutiveOverBudgetFrames = 0
    },
  }
}
