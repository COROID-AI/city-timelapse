import { create } from 'zustand'
import { type Era, type LoadingState, type ErrorState } from './types'

interface AppState {
  currentEra: Era
  targetEra: Era
  isTransitioning: boolean
  transitionProgress: number
  loading: LoadingState
  error: ErrorState
  webglAvailable: boolean
  audioEnabled: boolean
  
  setCurrentEra: (era: Era) => void
  setTargetEra: (era: Era) => void
  setTransitioning: (transitioning: boolean) => void
  setTransitionProgress: (progress: number) => void
  setLoading: (loading: LoadingState) => void
  setError: (error: ErrorState) => void
  setWebglAvailable: (available: boolean) => void
  setAudioEnabled: (enabled: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  currentEra: 1945,
  targetEra: 1945,
  isTransitioning: false,
  transitionProgress: 0,
  loading: {
    progress: 0,
    loadedAssets: [],
    totalAssets: 0
  },
  error: {
    hasError: false,
    message: ''
  },
  webglAvailable: true,
  audioEnabled: true,
  
  setCurrentEra: (era) => set({ currentEra: era }),
  setTargetEra: (era) => set({ targetEra: era }),
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
  setTransitionProgress: (progress) => set({ transitionProgress: progress }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setWebglAvailable: (available) => set({ webglAvailable: available }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled })
}))

export const getEraProgress = (current: Era, target: Era, progress: number): Era => {
  const eras: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]
  const currentIndex = eras.indexOf(current)
  const targetIndex = eras.indexOf(target)
  
  if (currentIndex === -1 || targetIndex === -1) return 1945
  if (currentIndex === targetIndex) return current
  
  const interpolatedIndex = Math.round(currentIndex + (targetIndex - currentIndex) * progress)
  return eras[interpolatedIndex] as Era
}