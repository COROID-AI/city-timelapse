import { create } from 'zustand'
import { Era } from './types'

interface TimelineState {
  currentEra: Era
  targetEra: Era
  isTransitioning: boolean
  transitionProgress: number
  setEra: (era: Era) => void
  updateProgress: (progress: number) => void
}

const useStore = create<TimelineState>((set) => ({
  currentEra: '1945',
  targetEra: '1945',
  isTransitioning: false,
  transitionProgress: 0,
  setEra: (era: Era) => set({ 
    targetEra: era, 
    isTransitioning: true, 
    transitionProgress: 0 
  }),
  updateProgress: (progress: number) => set({ transitionProgress: progress }),
}))

export default useStore