/**
 * Adaptive-quality extension: the honest report of what the frame budget did.
 *
 * The policy lives in `../qualityAuto` as a pure reducer and is advanced by the
 * shared controller; this module renders its state and offers the one control the
 * policy cannot offer itself — handing quality back to the automatic controller
 * after the viewer took it over by hand.
 *
 * The notice is deliberately non-blocking: it is a `role="status"` line that
 * names the tiers, the measured frame time and the budget, appears for a few
 * seconds, and never covers the scene or steals focus.
 */

import type { CSSProperties, ReactElement } from 'react'
import type { ExtensionProps } from '../../app/extensionSlots'
import { QUALITY_TIERS } from '../../lib/quality'
import { useInteractionController, useInteractionFeature, useInteractionSnapshot } from '../index'

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  bottom: '9rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 7,
  display: 'grid',
  gap: '6px',
  justifyItems: 'center',
  width: 'min(26rem, calc(100vw - 2rem))',
  pointerEvents: 'none',
}

const NOTICE_STYLE: CSSProperties = {
  margin: 0,
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(111, 211, 255, 0.4)',
  background: 'rgba(9, 13, 22, 0.88)',
  color: '#e8edf7',
  font: 'inherit',
  fontSize: '0.78rem',
  lineHeight: 1.4,
  textAlign: 'center',
}

const REPORT_STYLE: CSSProperties = {
  ...NOTICE_STYLE,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid rgba(120, 150, 200, 0.28)',
  color: '#9dabc7',
}

const BUTTON_STYLE: CSSProperties = {
  border: '1px solid rgba(120, 150, 200, 0.36)',
  borderRadius: '8px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.74rem',
  padding: '3px 8px',
  cursor: 'pointer',
}

/** Adaptive-quality status, the manual-override escape hatch and the notice. */
export default function QualityExtension(props: ExtensionProps): ReactElement {
  const controller = useInteractionController(props)
  const snapshot = useInteractionSnapshot(controller)
  useInteractionFeature(controller, 'quality')
  const quality = snapshot.quality
  const notice = quality.notices[quality.notices.length - 1] ?? null
  const mode = quality.manualOverride ? 'manual' : quality.suspended ? 'suspended' : 'automatic'

  return (
    <div style={PANEL_STYLE} data-testid="quality-panel" aria-label="Adaptive quality">
      <div
        style={REPORT_STYLE}
        data-testid="adaptive-quality"
        data-mode={mode}
        data-suspended={quality.suspended ? 'true' : 'false'}
        data-tier={quality.tier}
      >
        <span>
          {mode === 'manual'
            ? `Quality: ${QUALITY_TIERS[quality.tier].label} · manual choice`
            : mode === 'suspended'
              ? `Quality: ${QUALITY_TIERS[quality.tier].label} · automatic paused`
              : `Quality: ${QUALITY_TIERS[quality.tier].label} · automatic`}
        </span>
        {quality.manualOverride ? (
          <button
            type="button"
            style={BUTTON_STYLE}
            data-testid="quality-auto"
            onClick={() => {
              props.uiStore.getState().clearQualityOverride()
            }}
          >
            Back to automatic
          </button>
        ) : null}
      </div>
      {notice === null ? null : (
        <p style={NOTICE_STYLE} role="status" data-testid="quality-notice" data-reason={notice.reason}>
          {notice.message}
        </p>
      )}
    </div>
  )
}
