import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useEraStore, ERA_YEARS, type EraYear } from './useCityEra'
import { ERA_THEMES, type EraTheme, lerpTheme } from './theme'

/** Duration of a full era transition in milliseconds. */
export const TRANSITION_DURATION = 2200

/**
 * Returns the current interpolated theme + progress.
 *
 * The transition is driven by a monotonically increasing `transitionVersion`
 * counter that is bumped every time the user selects a new target year.
 * Each time the version changes we start a fresh animation loop. If the user
 * interrupts mid-transition, the old loop is abandoned (its captured version
 * no longer matches the current one) and a new loop begins from the current
 * theme toward the new target. This guarantees the endpoint is always
 * deterministic: the final theme is always `ERA_THEMES[targetYear]`.
 */
export function useEraTransition() {
  const targetYear = useEraStore((s) => s.targetYear)
  const version = useEraStore((s) => s.transitionVersion)
  // Use a stable reference to setYear via useSyncExternalStore to avoid
  // the getSnapshot infinite-loop warning. The setYear action is defined
  // once in the store, so we can safely extract it without triggering
  // re-renders.
  const setYear = useSyncExternalStore(
    () => () => {},
    () => useEraStore.getState().setYear,
    () => useEraStore.getState().setYear
  )

  const [theme, setTheme] = useState<EraTheme>(() => ERA_THEMES[ERA_YEARS[0]])
  const [progress, setProgress] = useState(0)

  // Refs to avoid stale closures inside the animation loop.
  const versionRef = useRef(version)
  versionRef.current = version

  const fromThemeRef = useRef<EraTheme>(ERA_THEMES[ERA_YEARS[0]])
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    const fromIdx = ERA_YEARS.indexOf(targetYear)
    const fromYear = fromIdx > 0 ? ERA_YEARS[fromIdx - 1] : targetYear
    const fromTheme = fromYear === targetYear ? ERA_THEMES[targetYear] : ERA_THEMES[fromYear]
    fromThemeRef.current = fromTheme
    startTimeRef.current = 0

    const loop = (now: number) => {
      // If the version changed since this loop was scheduled, abort — a newer
      // loop is running and will drive toward the correct endpoint.
      if (versionRef.current !== version) return

      if (startTimeRef.current === 0) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const t = Math.min(1, elapsed / TRANSITION_DURATION)

      const nextTheme = lerpTheme(fromThemeRef.current, ERA_THEMES[targetYear], t)
      setTheme(nextTheme)
      setProgress(t)

      if (t < 1) {
        requestAnimationFrame(loop)
      } else {
        // Deterministic endpoint: snap exactly to the target theme.
        setTheme(ERA_THEMES[targetYear])
        setProgress(1)
        setYear(targetYear)
      }
    }

    requestAnimationFrame(loop)
    // We intentionally only re-run when the version (i.e. target) changes.
  }, [version, targetYear, setYear])

  return { theme, progress, targetYear }
}