/**
 * The overlay: everything the viewer sees in front of the 3D canvas.
 *
 * It composes the four surfaces the plan asks for and nothing else:
 *
 * 1. {@link TimelineSlider} — pinned to the top of the viewport, above the canvas.
 * 2. {@link Hud} — the always-visible year/era readout.
 * 3. The control strip — audio unlock + mute, quality tier and reduced motion,
 *    all reading and writing the ui-controls store.
 * 4. {@link ControlsLegend} — the help legend, bottom-right.
 *
 * Plus the three honest lifecycle states: loading (before the first frame),
 * error (the scene failed to start) and first use (explaining the timeline
 * once). They are mutually exclusive — `error` wins over `loading`, `loading`
 * wins over first use — so the centre of the screen can never stack two panels.
 *
 * The overlay talks to exactly two stores, the era store (read-only here) and
 * the ui-controls store. It never imports the audio engine or the render
 * pipeline: it records intent, and the integrator reacts to that intent.
 */

import { useMemo, type ReactElement, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { ERA_REGISTRY } from '../era'
import type { EraRegistry } from '../era'
import { QUALITY_TIER_NAMES } from '../lib/quality'
import type { EraStore } from '../state/eraStore'
import { ControlsLegend } from './ControlsLegend'
import { Hud } from './Hud'
import { TimelineSlider } from './TimelineSlider'
import {
  MOTION_PREFERENCES,
  MOTION_PREFERENCE_LABELS,
  QUALITY_TIER_HINTS,
  QUALITY_TIER_LABELS,
  selectAudioMuted,
  selectAudioUnlocked,
  selectMotionManualOverride,
  selectMotionPreference,
  selectOverlayDismissed,
  selectOverlayVisible,
  selectQualityManualOverride,
  selectRequestedQualityTier,
  useResolvedReducedMotion,
  useUIControlsStore,
} from './uiStore'
import type { UIControlsStore } from './uiStore'
import './styles.css'

/** Lifecycle of the scene behind the overlay. */
export type SceneStatus = 'loading' | 'ready' | 'error'

/** `'1945, 1965, 1985, 2005 or 2025'` — derived from the registry, never hard-coded. */
export function formatYearList(years: readonly number[]): string {
  const [first, ...rest] = years
  if (first === undefined) {
    return ''
  }
  if (rest.length === 0) {
    return String(first)
  }
  return `${[first, ...rest.slice(0, -1)].join(', ')} or ${rest[rest.length - 1]}`
}

/** Human sentence for the current sound intent, shown next to the buttons. */
function describeAudioIntent(unlocked: boolean, muted: boolean): string {
  if (!unlocked) {
    return 'Sound is off until you enable it.'
  }
  return muted ? 'Sound is muted.' : 'Sound is on.'
}

export interface OverlayProps {
  /** Era store the timeline reads and writes; defaults to the app store. */
  readonly eraStore?: EraStore
  /** Era registry supplying labels and years; defaults to the shipped table. */
  readonly registry?: EraRegistry
  /** UI controls store owning viewer intent; defaults to the app store. */
  readonly uiStore?: UIControlsStore
  /** Scene lifecycle reported by the integrator. Defaults to `'ready'`. */
  readonly status?: SceneStatus
  /** Message shown when `status` is `'error'`; a default explanation is used otherwise. */
  readonly errorMessage?: string | null
  /** Renders a "Try again" button in the error state when provided. */
  readonly onRetry?: () => void
  /** Extra overlay content (e.g. transition effects) mounted above the panels. */
  readonly children?: ReactNode
  /** Extra class for embedding layouts. */
  readonly className?: string
}

/** Audio, quality and motion controls bound to the ui-controls store. */
export function OverlayControls({ uiStore }: { readonly uiStore: UIControlsStore }): ReactElement {
  const audioUnlocked = useStore(uiStore, selectAudioUnlocked)
  const audioMuted = useStore(uiStore, selectAudioMuted)
  const qualityTier = useStore(uiStore, selectRequestedQualityTier)
  const qualityManualOverride = useStore(uiStore, selectQualityManualOverride)
  const motionPreference = useStore(uiStore, selectMotionPreference)
  const motionManualOverride = useStore(uiStore, selectMotionManualOverride)

  /** Store actions are stable for the store's lifetime, so edges never change. */
  const actions = uiStore.getState()

  return (
    <div
      className="controls"
      data-testid="overlay-controls"
      role="group"
      aria-label="Experience controls"
    >
      <div className="controls__cluster" data-testid="audio-controls">
        <button
          type="button"
          className="ui-button"
          data-testid="audio-unlock"
          aria-pressed={audioUnlocked}
          onClick={() => {
            actions.requestAudioUnlock()
          }}
        >
          Enable sound
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost"
          data-testid="audio-mute"
          aria-pressed={audioMuted}
          onClick={() => {
            actions.toggleAudioMute()
          }}
        >
          Mute
        </button>
        <span className="controls__status" data-testid="audio-status" role="status">
          {describeAudioIntent(audioUnlocked, audioMuted)}
        </span>
      </div>

      <fieldset className="controls__cluster" data-testid="quality-controls">
        <legend className="controls__legend">Quality</legend>
        <div className="controls__row">
          {QUALITY_TIER_NAMES.map((tier) => (
            <button
              key={tier}
              type="button"
              className="ui-button ui-button--chip"
              data-testid={`quality-${tier}`}
              aria-pressed={qualityTier === tier}
              title={QUALITY_TIER_HINTS[tier]}
              onClick={() => {
                actions.requestQualityTier(tier)
              }}
            >
              {QUALITY_TIER_LABELS[tier]}
            </button>
          ))}
        </div>
        <span className="controls__status" data-testid="quality-status">
          {qualityManualOverride ? 'Manual choice' : 'Automatic'}
        </span>
      </fieldset>

      <fieldset className="controls__cluster" data-testid="motion-controls">
        <legend className="controls__legend">Motion</legend>
        <div className="controls__row">
          {MOTION_PREFERENCES.map((preference) => (
            <button
              key={preference}
              type="button"
              className="ui-button ui-button--chip"
              data-testid={`motion-${preference}`}
              aria-pressed={motionPreference === preference}
              onClick={() => {
                actions.setMotionPreference(preference)
              }}
            >
              {MOTION_PREFERENCE_LABELS[preference]}
            </button>
          ))}
        </div>
        <span className="controls__status" data-testid="motion-status">
          {motionManualOverride ? 'Manual choice' : 'Following system'}
        </span>
      </fieldset>
    </div>
  )
}

/** Loading state: covers the period before the first rendered frame. */
function LoadingNotice(): ReactElement {
  return (
    <div className="notice" data-testid="overlay-loading" role="status" aria-live="polite">
      <h2 className="notice__title">Building the block</h2>
      <p className="notice__body">
        Generating the scene in code — nothing is downloaded, so this only takes a moment.
      </p>
    </div>
  )
}

/** Error state: the scene failed to start, with an honest explanation. */
function ErrorNotice({
  message,
  onRetry,
}: {
  readonly message: string | null
  readonly onRetry?: (() => void) | undefined
}): ReactElement {
  return (
    <div className="notice notice--error" data-testid="overlay-error" role="alert">
      <h2 className="notice__title">The scene could not start</h2>
      <p className="notice__body">
        {message ??
          'WebGL is unavailable or the renderer failed to initialise, so the city cannot be drawn. The timeline still shows which period was requested.'}
      </p>
      {onRetry ? (
        <button type="button" className="ui-button" data-testid="overlay-retry" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

/** First-use state: explains the timeline, sound, quality and motion once. */
function FirstUseNotice({
  years,
  onDismiss,
}: {
  readonly years: readonly number[]
  readonly onDismiss: () => void
}): ReactElement {
  return (
    <div className="notice notice--intro" data-testid="overlay-first-use" role="dialog" aria-label="Getting started">
      <h2 className="notice__title">Travel the timeline</h2>
      <p className="notice__body">
        {`Pick ${formatYearList(years)} along the top of the screen — the block rebuilds itself in front of you. Drag the track, or use the arrow keys and Home/End.`}
      </p>
      <p className="notice__body">
        Sound, quality and motion are yours to set at the bottom left; the help legend lists every
        control.
      </p>
      <button type="button" className="ui-button" data-testid="overlay-dismiss" onClick={onDismiss}>
        Start exploring
      </button>
    </div>
  )
}

/** Top-pinned timeline, HUD, control strip, legend and lifecycle states. */
export function Overlay({
  eraStore,
  registry = ERA_REGISTRY,
  uiStore,
  status = 'ready',
  errorMessage = null,
  onRetry,
  children,
  className,
}: OverlayProps): ReactElement {
  const store = uiStore ?? useUIControlsStore
  const overlayVisible = useStore(store, selectOverlayVisible)
  const overlayDismissed = useStore(store, selectOverlayDismissed)
  const reducedMotion = useResolvedReducedMotion(store)

  const years = useMemo(() => registry.years, [registry])
  const firstUseVisible = overlayVisible && !overlayDismissed && status === 'ready'

  const rootClassName = ['ui-overlay', className].filter((value): value is string => Boolean(value)).join(' ')

  return (
    <div
      className={rootClassName}
      data-testid="ui-overlay"
      data-scene-status={status}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <TimelineSlider eraStore={eraStore} registry={registry} />
      <Hud eraStore={eraStore} registry={registry} />
      <OverlayControls uiStore={store} />
      <ControlsLegend uiStore={store} />
      {children}
      {status === 'error' ? <ErrorNotice message={errorMessage} onRetry={onRetry} /> : null}
      {status === 'loading' ? <LoadingNotice /> : null}
      {firstUseVisible ? (
        <FirstUseNotice
          years={years}
          onDismiss={() => {
            store.getState().dismissOverlay()
          }}
        />
      ) : null}
    </div>
  )
}
