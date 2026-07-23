import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025 | 2055
export const ERA_YEARS: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055]

type EraStore = {
  year: EraYear
  targetYear: EraYear
  setTargetYear: (y: EraYear) => void
  onUserInteracted: () => void
  /** monotonically increasing counter bumped whenever the target changes */
  transitionVersion: number
  /** timestamp of last user interaction (for SFX gating) */
  userInteractedAt: number
  /** programmatic setter for the current year */
  setYear: (y: EraYear) => void
}

export const useEraStore = create<EraStore>()(
  subscribeWithSelector((set) => ({
    year: 1945,
    targetYear: 1945,
    setTargetYear: (y) =>
      set((s) => ({
        targetYear: y,
        transitionVersion: s.transitionVersion + 1,
      })),
    setYear: (y) => set((s) => ({ year: y })),
    onUserInteracted: () =>
      set({ userInteractedAt: Date.now() }),
    transitionVersion: 0,
    userInteractedAt: 0,
  }))
)

/** Hook for UI components that read/display the current year. */
export function useCityEra() {
  const year = useEraStore((s) => s.year)
  const targetYear = useEraStore((s) => s.targetYear)
  const setTargetYear = useEraStore((s) => s.setTargetYear)
  const onUserInteracted = useEraStore((s) => s.onUserInteracted)
  return { year, targetYear, setTargetYear, onUserInteracted }
}

/** Hook for the scene: exposes target + a version counter so transitions
 *  can detect interruption and always snap to the deterministic endpoint. */
export function useCityEraInternal() {
  const targetYear = useEraStore((s) => s.targetYear)
  const transitionVersion = useEraStore((s) => s.transitionVersion)
  const setYear = useEraStore((s) => s.setYear)
  return { targetYear, transitionVersion, setYear }
}