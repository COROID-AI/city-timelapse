/**
 * Loading state of the composed experience.
 *
 * Composing the block is a sequence of real steps — block layout, atmosphere,
 * each era content layer, the soundscape, the inspection surface — and each of
 * them can be observed. This module models that sequence as plain data with pure
 * transitions, so
 *
 * - the composition can report exactly which step is running,
 * - the overlay can show honest progress instead of an indefinite spinner, and
 * - a failure can name the step that failed while leaving the rest of the page
 *   (the timeline, the controls) fully operable.
 *
 * The panel is deliberately non-blocking: it is a status region, not a modal.
 *
 * ```tsx
 * const [loading, setLoading] = useState(() => createLoadingState())
 * setLoading(markStepDone(loading, 'layout'))
 * ```
 */

import type { CSSProperties, ReactElement } from 'react'

/** Heading shown while the composition is being built. */
export const LOADING_TITLE = 'Building the block'

/** Body copy of the loading panel. */
export const LOADING_MESSAGE =
  'Generating the block, the period layers and the atmosphere in code — nothing is downloaded, so this only takes a moment.'

/** Copy shown once every step has landed. */
export const READY_MESSAGE = 'The block is ready. Pick a year along the top to travel the timeline.'

/** One step of the composition, as the panel reports it. */
export interface MountStep {
  readonly id: string
  readonly label: string
  readonly done: boolean
}

/** Everything the loading panel renders. */
export interface LoadingState {
  /** True once every shipped step has completed. */
  readonly ready: boolean
  /** Step id that failed, if any; the rest of the page stays usable. */
  readonly failedLayer: string | null
  /** Steps that are not part of this revision (a layer barrel still to land). */
  readonly skipped: readonly string[]
  readonly completed: number
  readonly total: number
  readonly steps: readonly MountStep[]
  readonly message: string
}

/** Human label of every composition step, keyed by layer slot id. */
export const MOUNT_STEP_LABELS: Readonly<Record<string, string>> = Object.freeze({
  layout: 'Block layout',
  atmosphere: 'Atmosphere and sky',
  buildings: 'Buildings',
  storefronts: 'Storefronts and signage',
  props: 'Street furniture',
  vehicles: 'Vehicles',
  pedestrians: 'Pedestrians',
  soundscape: 'Soundscape',
  inspection: 'Inspection targets',
})

/** Steps reported for the shipped composition, in mount order. */
export const DEFAULT_MOUNT_STEP_IDS: readonly string[] = [
  'layout',
  'atmosphere',
  'buildings',
  'storefronts',
  'props',
  'vehicles',
  'pedestrians',
  'soundscape',
  'inspection',
]

/** Label of one step id, falling back to the raw id. */
export function mountStepLabel(id: string): string {
  return MOUNT_STEP_LABELS[id] ?? id
}

/** Builds the initial (nothing done yet) loading state. */
export function createLoadingState(stepIds: readonly string[] = DEFAULT_MOUNT_STEP_IDS): LoadingState {
  const steps = stepIds.map((id) => ({ id, label: mountStepLabel(id), done: false }))
  return {
    ready: false,
    failedLayer: null,
    skipped: [],
    completed: 0,
    total: steps.length,
    steps,
    message: LOADING_MESSAGE,
  }
}

function replaceStep(state: LoadingState, id: string, done: boolean): LoadingState {
  const steps = state.steps.map((step) => (step.id === id ? { ...step, done } : step))
  const completed = steps.filter((step) => step.done).length
  return {
    ...state,
    steps,
    completed,
    ready: completed === state.total,
    message: completed === state.total ? READY_MESSAGE : state.message,
  }
}

/**
 * Removes one step from the panel because it is not part of this revision.
 *
 * The step stops counting towards the total and is listed as skipped, so the
 * panel never claims a layer was built when its barrel has not shipped.
 */
export function markStepSkipped(state: LoadingState, id: string): LoadingState {
  if (!state.steps.some((step) => step.id === id)) {
    return state
  }
  const steps = state.steps.filter((step) => step.id !== id)
  const completed = steps.filter((step) => step.done).length
  return {
    ...state,
    steps,
    skipped: [...state.skipped, id],
    completed,
    total: steps.length,
    ready: steps.length > 0 && completed === steps.length,
    message: state.message,
  }
}

/** Marks one step complete. Unknown ids are ignored. */
export function markStepDone(state: LoadingState, id: string): LoadingState {
  if (!state.steps.some((step) => step.id === id)) {
    return state
  }
  return replaceStep(state, id, true)
}

/** Marks one step failed, which keeps the panel non-blocking and names it. */
export function markStepFailed(state: LoadingState, id: string): LoadingState {
  return { ...state, failedLayer: id, ready: false }
}

/** Marks every step complete (used when a host skips reporting progress). */
export function markReady(state: LoadingState): LoadingState {
  return {
    ...state,
    steps: state.steps.map((step) => ({ ...step, done: true })),
    completed: state.total,
    ready: true,
    message: READY_MESSAGE,
  }
}

/** Fraction of steps completed, 0..1. */
export function progressFraction(state: LoadingState): number {
  return state.total === 0 ? 1 : state.completed / state.total
}

/** Ids of the steps that are not finished yet. */
export function pendingSteps(state: LoadingState): readonly string[] {
  return state.steps.filter((step) => !step.done).map((step) => step.id)
}

const PANEL_STYLE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: '1rem',
  transform: 'translateX(-50%)',
  maxWidth: 'min(28rem, calc(100% - 2rem))',
  padding: '0.75rem 1rem',
  borderRadius: '0.75rem',
  background: 'rgba(8, 12, 22, 0.82)',
  border: '1px solid rgba(150, 180, 255, 0.28)',
  color: '#dfe7ff',
  font: '500 0.8rem/1.35 system-ui, sans-serif',
  pointerEvents: 'none',
  zIndex: 4,
}

const TRACK_STYLE: CSSProperties = {
  height: '0.35rem',
  marginTop: '0.5rem',
  borderRadius: '999px',
  background: 'rgba(150, 180, 255, 0.2)',
  overflow: 'hidden',
}

/** Progress panel the composed page shows while the block is being built. */
export function CompositionProgress({
  state,
  className,
}: {
  readonly state: LoadingState
  readonly className?: string
}): ReactElement {
  const fraction = Math.round(progressFraction(state) * 100)
  return (
    <div
      className={className}
      style={PANEL_STYLE}
      data-testid="composition-progress"
      data-ready={state.ready ? 'true' : 'false'}
      data-step={state.steps.find((step) => !step.done)?.id ?? 'ready'}
      data-completed={String(state.completed)}
      data-total={String(state.total)}
      role="status"
      aria-live="polite"
    >
      <strong>{LOADING_TITLE}</strong>
      <div>{state.message}</div>
      <div style={TRACK_STYLE} aria-hidden="true">
        <div
          style={{
            width: `${fraction}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #6f9bff, #b7d0ff)',
            transition: 'width 200ms linear',
          }}
        />
      </div>
      <div data-testid="composition-progress-detail">
        {`${state.completed}/${state.total} steps complete${
          state.skipped.length === 0 ? '' : ` · pending: ${state.skipped.join(', ')}`
        }${state.failedLayer === null ? '' : ` · failed: ${state.failedLayer}`}`}
      </div>
    </div>
  )
}
