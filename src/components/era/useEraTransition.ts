import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useEraStore, ERA_YEARS, type EraYear } from './useCityEra'
import { ERA_THEMES, type EraTheme, lerpTheme } from './theme'

/** Duration of a full era transition in milliseconds. */
export const TRANSITION_DURATION = 2200

/**
 * Core animation loop for era transitions.
 *
 * Extracted into its own hook so the transition logic is isolated and testable.
 * The loop is driven by a monotonically increasing `transitionVersion` counter
 * that is bumped every time the user selects a new target year. Each time the
 * version changes we start a fresh animation loop.
 *
 * **Deterministic endpoints on interruption:**
 * When the user interrupts mid-transition, the old loop is abandoned (its
 * captured version no longer matches the current one) and a new loop begins
 * from the *current interpolated theme* (not the previous era's discrete
 * theme). This guarantees the endpoint is always deterministic: the final
 * theme is always exactly `ERA_THEMES[targetYear]`.
 */
function useEraAnimation(
  targetYear: EraYear,
  version: number,
  setYear: (y: EraYear) => void
) {
  const [theme, setTheme] = useState<EraTheme>(() => ERA_THEMES[ERA_YEARS[0]])
  const [progress, setProgress] = useState(0)

  // Refs to avoid stale closures inside the animation loop.
  const versionRef = useRef(version)
  versionRef.current = version

  // The starting theme for the current transition. On interruption this is
  // set to the *current* theme (the last interpolated value), not the
  // discrete theme of the previous era year — this is what makes endpoints
  // deterministic.
  const fromThemeRef = useRef<EraTheme>(ERA_THEMES[ERA_YEARS[0]])
  const startTimeRef = useRef<number>(0)
  const latestThemeRef = useRef<EraTheme>(ERA_THEMES[ERA_YEARS[0]])

  useEffect(() => {
    // On every new transition (version change), the "from" theme is the
    // current interpolated theme, ensuring smooth chained transitions.
    fromThemeRef.current = latestThemeRef.current
    startTimeRef.current = 0

    const loop = (now: number) => {
      // If the version changed since this loop was scheduled, abort — a newer
      // loop is running and will drive toward the correct endpoint.
      if (versionRef.current !== version) return

      if (startTimeRef.current === 0) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const t = Math.min(1, elapsed / TRANSITION_DURATION)

      const nextTheme = lerpTheme(fromThemeRef.current, ERA_THEMES[targetYear], t)
      latestThemeRef.current = nextTheme
      setTheme(nextTheme)
      setProgress(t)

      if (t < 1) {
        requestAnimationFrame(loop)
      } else {
        // Deterministic endpoint: snap exactly to the target theme.
        setTheme(ERA_THEMES[targetYear])
        latestThemeRef.current = ERA_THEMES[targetYear]
        setProgress(1)
        setYear(targetYear)
      }
    }

    requestAnimationFrame(loop)
    // We intentionally only re-run when the version (i.e. target) changes.
  }, [version, targetYear, setYear])

  return { theme, progress }
}

/**
 * Public hook: returns the current interpolated theme, transition progress,
 * and the target year.
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

  const { theme, progress } = useEraAnimation(targetYear, version, setYear)

  return { theme, progress, targetYear }
}
