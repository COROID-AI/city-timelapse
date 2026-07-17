/**
 * Demand-frameloop controller.
 *
 * In `frameloop="demand"` mode, `useFrame` callbacks only run when someone
 * calls `invalidate()`. This component manages ALL rendering cadence via a
 * single recursive setTimeout timer:
 *
 *  - Idle: renders at a low rate (~2fps) so vehicles, crowds, signs, and lamps
 *    keep subtly animating.
 *  - Transitioning: renders at a moderate rate (~8fps) so the timelapse is
 *    visible but the browser event loop stays responsive between frames.
 *
 * Uses recursive setTimeout (not setInterval) so each render is scheduled
 * AFTER the previous one completes, guaranteeing a gap for DOM event
 * processing — critical for software renderers and automated testing.
 *
 * Reduced-motion: still invalidates so the scene snaps to the exact target era.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useCityStore } from '../era/store'

const IDLE_MS = 500
const TRANSITION_MS = 120

export function FrameloopController() {
  const invalidate = useThree((s) => s.invalidate)
  const transitioningRef = useRef(false)

  // Track transition state via store subscription (avoids re-renders).
  useEffect(() => {
    const unsub = useCityStore.subscribe((state) => {
      transitioningRef.current = state.transitioning
    })
    return unsub
  }, [])

  // Single recursive-timer render loop.
  useEffect(() => {
    let timeoutId: number

    const tick = () => {
      invalidate()
      const delay = transitioningRef.current ? TRANSITION_MS : IDLE_MS
      timeoutId = window.setTimeout(tick, delay)
    }

    timeoutId = window.setTimeout(tick, IDLE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [invalidate])

  // Kick off rendering immediately when the user selects a new era.
  useEffect(() => {
    let prev = useCityStore.getState().selectedEra
    const unsub = useCityStore.subscribe((state) => {
      if (state.selectedEra !== prev) {
        prev = state.selectedEra
        invalidate()
      }
    })
    return unsub
  }, [invalidate])

  return null
}
