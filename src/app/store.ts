import { create } from 'zustand'
import type { EraId } from './types'

type AppState = {
  targetEraId: EraId
  sfxEnabled: boolean
  reduceMotion: boolean
  setTargetEraId: (id: EraId) => void
  setSfxEnabled: (enabled: boolean) => void
  setReduceMotion: (enabled: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  targetEraId: 0,
  sfxEnabled: true,
  reduceMotion: false,
  setTargetEraId: (id) => set({ targetEraId: id }),
  setSfxEnabled: (enabled) => set({ sfxEnabled: enabled }),
  setReduceMotion: (enabled) => set({ reduceMotion: enabled }),
}))
