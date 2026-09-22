/**
 * Viewpoints extension: the named-framing palette and the interaction key map.
 *
 * One of the modules the composition's glob extension slot discovers. It mounts
 * two surfaces — the viewpoint palette and the camera-mode chips — and owns the
 * single global `keydown` listener for the interaction layer, routing every
 * mapped key through the shared controller so camera modes, viewpoints, the
 * tour, era stepping, quality and mute all land in one place.
 *
 * It renders HTML rather than three.js objects because a viewpoint is a *choice*
 * the viewer makes, and the buttons are how that choice is discoverable.
 */

import { useEffect, type CSSProperties, type ReactElement } from 'react'
import type { ExtensionProps } from '../../app/extensionSlots'
import {
  VIEWPOINT_DEFINITIONS,
  useInteractionController,
  useInteractionFeature,
  useInteractionSnapshot,
} from '../index'
import type { ViewpointId } from '../index'

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  top: '13rem',
  left: '1rem',
  zIndex: 6,
  display: 'grid',
  gap: '6px',
  padding: '10px 12px',
  width: 'min(15rem, calc(100vw - 2rem))',
  borderRadius: '12px',
  border: '1px solid rgba(120, 150, 200, 0.28)',
  background: 'rgba(9, 13, 22, 0.82)',
  color: '#e8edf7',
  font: 'inherit',
  fontSize: '0.82rem',
  backdropFilter: 'blur(10px)',
}

const TITLE_STYLE = {
  margin: 0,
  fontSize: '0.7rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#6fd3ff',
} as const

const ROW_STYLE = { display: 'flex', flexWrap: 'wrap', gap: '4px' } as const

function chipStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? 'rgba(111, 211, 255, 0.9)' : 'rgba(120, 150, 200, 0.36)'}`,
    borderRadius: '8px',
    background: active ? 'rgba(111, 211, 255, 0.18)' : 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: '0.78rem',
    padding: '4px 9px',
    cursor: 'pointer',
  }
}

/** The viewpoint palette, the camera-mode chips and the key listener. */
export default function ViewpointsExtension(props: ExtensionProps): ReactElement {
  const controller = useInteractionController(props)
  const snapshot = useInteractionSnapshot(controller)
  useInteractionFeature(controller, 'viewpoints')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (controller.handleKeyEvent(event)) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [controller])

  const active = snapshot.activeViewpoint
  const cameraMode = snapshot.camera.mode

  return (
    <div style={PANEL_STYLE} data-testid="viewpoint-panel" aria-label="Viewpoints">
      <p style={TITLE_STYLE}>Camera</p>
      <div style={ROW_STYLE}>
        <button
          type="button"
          style={chipStyle(cameraMode === 'orbit')}
          data-testid="camera-mode-orbit"
          aria-pressed={cameraMode === 'orbit'}
          onClick={() => {
            controller.setCameraMode('orbit')
          }}
        >
          Orbit (O)
        </button>
        <button
          type="button"
          style={chipStyle(cameraMode === 'street')}
          data-testid="camera-mode-street"
          aria-pressed={cameraMode === 'street'}
          onClick={() => {
            controller.setCameraMode('street')
          }}
        >
          Street (C)
        </button>
      </div>
      <p style={TITLE_STYLE}>Viewpoints</p>
      <div style={ROW_STYLE}>
        {VIEWPOINT_DEFINITIONS.map((definition, index) => {
          const framing = snapshot.viewpoints.find((candidate) => candidate.id === definition.id)
          return (
            <button
              key={definition.id}
              type="button"
              style={chipStyle(active === definition.id)}
              data-testid={`viewpoint-${definition.id}`}
              data-available={framing === undefined ? 'false' : 'true'}
              aria-pressed={active === definition.id}
              title={definition.summary}
              onClick={() => {
                controller.applyViewpoint(definition.id as ViewpointId)
              }}
            >
              {`${index + 1}. ${definition.label}`}
            </button>
          )
        })}
      </div>
      <p style={{ ...TITLE_STYLE, color: '#9dabc7', textTransform: 'none', letterSpacing: 'normal' }}>
        {active === null
          ? 'Keys 1–5, or click a viewpoint.'
          : `Viewing: ${VIEWPOINT_DEFINITIONS.find((entry) => entry.id === active)?.label ?? active}`}
      </p>
    </div>
  )
}
