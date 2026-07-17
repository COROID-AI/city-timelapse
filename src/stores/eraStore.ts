import { create } from 'zustand'
import { Era } from '../lib/types'

interface EraState {
  currentEra: Era
  targetEra: Era | null
  isTransitioning: boolean
  setEra: (era: Era) => void
}

const ERA_ORDER: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

export const useEraStore = create<EraState>((set, get) => ({
  currentEra: '1945',
  targetEra: null,
  isTransitioning: false,
  setEra: (era: Era) => {
    const current = get().currentEra
    if (current !== era) {
      set({ targetEra: era, isTransitioning: true })
      // Simulate transition time for smooth animation
      setTimeout(() => {
        set({ currentEra: era, isTransitioning: false })
      }, 1000)
    }
  },
}))

export const getEraIndex = (era: Era): number => ERA_ORDER.indexOf(era)

export const getEraProgress = (from: Era, to: Era): number => {
  return getEraIndex(to) / (ERA_ORDER.length - 1)
}