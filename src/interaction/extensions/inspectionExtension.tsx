/**
 * Inspection extension: pointer picking on the canvas and the info card.
 *
 * Click behaviour is deliberately generous about what counts as a click: the
 * pointer must go down and up within {@link CLICK_SLOP_PX} pixels and
 * {@link CLICK_HOLD_MS} milliseconds, so dragging to orbit — which the render
 * pipeline's own navigation controller binds on the same canvas — never opens a
 * card by accident. A press that misses every target releases the current focus,
 * which is how "click empty space to close" works.
 *
 * The extension owns no camera maths: it hands the canvas point to the
 * controller, which picks through the composition's inspection-targets surface,
 * starts the focus tween and publishes the card state this component renders.
 */

import { useEffect, useRef, type ReactElement } from 'react'
import type { ExtensionProps } from '../../app/extensionSlots'
import { useInteractionController, useInteractionFeature, useInteractionSnapshot } from '../index'
import { InspectorCard } from '../InspectorCard'

/** Pointer travel, in CSS pixels, still counted as a click rather than a drag. */
export const CLICK_SLOP_PX = 5

/** Longest press, in milliseconds, still counted as a click. */
export const CLICK_HOLD_MS = 400

/** The click-to-focus surface and the era-aware info card. */
export default function InspectionExtension(props: ExtensionProps): ReactElement | null {
  const controller = useInteractionController(props)
  const snapshot = useInteractionSnapshot(controller)
  useInteractionFeature(controller, 'inspection')
  const pressRef = useRef<{ x: number; y: number; at: number; pointerId: number } | null>(null)

  useEffect(() => {
    const canvas = props.pipeline.canvas

    const onPointerDown = (event: PointerEvent): void => {
      controller.notifyUserInput('pointer')
      if (event.button !== 0) {
        pressRef.current = null
        return
      }
      pressRef.current = { x: event.clientX, y: event.clientY, at: Date.now(), pointerId: event.pointerId }
    }

    const onPointerUp = (event: PointerEvent): void => {
      const press = pressRef.current
      pressRef.current = null
      if (press === null || press.pointerId !== event.pointerId) {
        return
      }
      const travel = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      if (travel > CLICK_SLOP_PX || Date.now() - press.at > CLICK_HOLD_MS) {
        return
      }
      controller.pickAtPoint(event.clientX, event.clientY)
    }

    const onPointerCancel = (): void => {
      pressRef.current = null
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [controller, props.pipeline])

  const card = snapshot.inspector.card
  if (card === null) {
    return null
  }
  return (
    <InspectorCard
      card={card}
      onClose={() => {
        controller.releaseFocus()
      }}
    />
  )
}
