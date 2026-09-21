/**
 * Tour extension: the cinematic autopilot's control and its dismissal.
 *
 * The tour itself lives in `../tour` as a pure state machine and is advanced by
 * the shared controller; this module is the part that must touch the DOM — a
 * button to start it, a status line that names the point of interest being held,
 * and the listeners that make "dismissible by any user input" literal: a press, a
 * wheel, a touch or a key while the tour runs stops it and hands the camera back
 * to the state the viewer had before it started.
 *
 * The `T` key is exempt from the blanket key handler because the interaction key
 * map owns it as the toggle; every other key dismisses, as documented.
 */

import { useEffect, type CSSProperties, type ReactElement } from 'react'
import type { ExtensionProps } from '../../app/extensionSlots'
import { useInteractionController, useInteractionFeature, useInteractionSnapshot } from '../index'

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  top: '13rem',
  left: '17.25rem',
  zIndex: 6,
  display: 'grid',
  gap: '6px',
  padding: '10px 12px',
  width: 'min(16rem, calc(100vw - 2rem))',
  borderRadius: '12px',
  border: '1px solid rgba(120, 150, 200, 0.28)',
  background: 'rgba(9, 13, 22, 0.82)',
  color: '#e8edf7',
  font: 'inherit',
  fontSize: '0.82rem',
  backdropFilter: 'blur(10px)',
}

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '0.7rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#6fd3ff',
}

const BUTTON_STYLE: CSSProperties = {
  border: '1px solid rgba(120, 150, 200, 0.36)',
  borderRadius: '8px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.78rem',
  padding: '5px 10px',
  cursor: 'pointer',
}

const HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '0.76rem',
  lineHeight: 1.4,
  color: '#9dabc7',
}

/** The tour button, its status line and every input that stops it. */
export default function TourExtension(props: ExtensionProps): ReactElement {
  const controller = useInteractionController(props)
  const snapshot = useInteractionSnapshot(controller)
  useInteractionFeature(controller, 'tour')
  const active = snapshot.tour.active

  useEffect(() => {
    if (!active) {
      return undefined
    }
    const dismiss = (): void => {
      controller.notifyUserInput('pointer')
    }
    const onWheel = (): void => {
      controller.notifyUserInput('wheel')
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      // `T` is the toggle the key map owns; every other key dismisses the tour.
      if (event.code === 'KeyT') {
        return
      }
      controller.notifyUserInput('key')
    }
    window.addEventListener('pointerdown', dismiss, true)
    window.addEventListener('touchstart', dismiss, true)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', dismiss, true)
      window.removeEventListener('touchstart', dismiss, true)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [active, controller])

  const status = (() => {
    if (!snapshot.tour.available) {
      return 'No sidewalk route in this block.'
    }
    if (!active) {
      return 'Autopilot: walks the pavement and pauses at points of interest.'
    }
    const station = snapshot.tour.stationLabel
    if (station !== null) {
      return `Paused at ${station}.`
    }
    return `Walking — ${Math.round(snapshot.tour.progress * 100)}% of one lap.`
  })()

  return (
    <div style={PANEL_STYLE} data-testid="tour-panel" aria-label="Cinematic tour">
      <p style={TITLE_STYLE}>Tour</p>
      <button
        type="button"
        style={BUTTON_STYLE}
        data-testid="tour-toggle"
        aria-pressed={active}
        onClick={() => {
          if (active) {
            controller.stopTour('button')
          } else {
            controller.startTour()
          }
        }}
      >
        {active ? 'Stop tour (T)' : 'Start tour (T)'}
      </button>
      <p style={HINT_STYLE} data-testid="tour-status" data-active={active ? 'true' : 'false'}>
        {status}
      </p>
      <p style={HINT_STYLE}>Any input stops the tour and returns your camera.</p>
    </div>
  )
}
