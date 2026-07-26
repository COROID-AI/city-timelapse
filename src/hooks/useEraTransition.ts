import { useEffect, useMemo } from 'react'
import { useEraStore } from '../store/eraStore'
import { eraConfig } from '../utils/eraConfig'

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  }, [])
}

export function useEraTransition() {
  const reducedMotion = usePrefersReducedMotion()

  const fromIndex = useEraStore((s) => s.fromIndex)
  const toIndex = useEraStore((s) => s.toIndex)
  const progress = useEraStore((s) => s.progress)
  const durationMs = useEraStore((s) => s.durationMs)
  const isTransitioning = useEraStore((s) => s.isTransitioning)

  const setTargetEraIndex = useEraStore((s) => s.setTargetEraIndex)
  const setProgress = useEraStore((s) => s.setProgress)
  const setScrubIndex = useEraStore((s) => s.setScrubIndex)

  // Drive the transition progress via rAF. Invalidation of the R3F canvas is
  // handled inside the Canvas tree by TransitionInvalidator (which has access
  // to useThree). This hook only manages store state.
  useEffect(() => {
    if (!isTransitioning) return
    if (reducedMotion) return

    let raf = 0
    const start = performance.now()

    const tick = () => {
      const now = performance.now()
      const t = (now - start) / durationMs
      const p = Math.min(1, t)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, isTransitioning, reducedMotion, setProgress])

  useEffect(() => {
    if (!reducedMotion) return
    const s = useEraStore.getState()
    if (s.toIndex !== s.fromIndex || s.progress !== 1) {
      useEraStore.setState({ fromIndex: s.toIndex, progress: 1, isTransitioning: false })
    }
  }, [reducedMotion])

  const effectiveIndex = fromIndex + (toIndex - fromIndex) * progress

  const safeEffectiveIndex = Math.max(0, Math.min(eraConfig.eras.length - 1, effectiveIndex))

  return {
    reducedMotion,
    isTransitioning,
    fromIndex,
    toIndex,
    progress,
    effectiveIndex: safeEffectiveIndex,
    setTargetEraIndex: (index: number) => {
      setTargetEraIndex(Math.max(0, Math.min(eraConfig.eras.length - 1, index)), { reducedMotion })
    },
    setScrubIndex: (index: number) => {
      setScrubIndex(Math.max(0, Math.min(eraConfig.eras.length - 1, index)))
    },
  }
}

export type EraTransitionAPI = ReturnType<typeof useEraTransition>
