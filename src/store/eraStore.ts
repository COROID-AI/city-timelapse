import { create } from 'zustand'
import { eraConfig } from '../utils/eraConfig'

export type EraIndex = number

export type EraStoreState = {
  fromIndex: number
  toIndex: number
  progress: number // 0..1
  durationMs: number
  isTransitioning: boolean
  setTargetEraIndex: (index: number, opts?: { reducedMotion?: boolean }) => void
  setProgress: (progress: number) => void
  setScrubIndex: (index: number) => void
}

export const useEraStore = create<EraStoreState>((set, get) => ({
  fromIndex: 0,
  toIndex: 0,
  progress: 1,
  durationMs: 1400,
  isTransitioning: false,
  setTargetEraIndex: (index: number, opts?: { reducedMotion?: boolean }) => {
    const s = get()
    const current = s.fromIndex + (s.toIndex - s.fromIndex) * s.progress
    const reduced = opts?.reducedMotion

    if (reduced) {
      set({ fromIndex: index, toIndex: index, progress: 1, isTransitioning: false })
      return
    }

    if (Math.round(current) === index && s.isTransitioning === false) {
      return
    }

    set({ fromIndex: current, toIndex: index, progress: 0, isTransitioning: true })
  },
  setProgress: (progress: number) => {
    set((s) => ({
      progress: Math.max(0, Math.min(1, progress)),
      isTransitioning: progress < 1,
      fromIndex: s.fromIndex,
    }))
  },
  setScrubIndex: (index: number) => {
    const clamped = Math.max(0, Math.min(eraConfig.eras.length - 1, index))
    set({ fromIndex: clamped, toIndex: clamped, progress: 1, isTransitioning: false })
  },
}))
