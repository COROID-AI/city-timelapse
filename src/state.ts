import { create } from 'zustand'
import { ERA_IDS, type EraId } from './eras'

export interface AppState {
  eraIndex: number
  eraId: EraId
  setEraIndex: (i: number) => void
  eraFloat: number
  setEraFloat: (v: number) => void
  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void
  audioMuted: boolean
  setAudioMuted: (v: boolean) => void
  showLabels: boolean
  setShowLabels: (v: boolean) => void
}

export const useAppStore = create<AppState>()((set) => ({
  eraIndex: 0,
  eraId: '1945',
  setEraIndex: (i) => set((s) => {
    const clamped = Math.max(0, Math.min(ERA_IDS.length - 1, i))
    return { eraIndex: clamped, eraId: ERA_IDS[clamped] }
  }),
  eraFloat: 0,
  setEraFloat: (v) => set({ eraFloat: v }),
  reducedMotion: false,
  setReducedMotion: (v) => set({ reducedMotion: v }),
  audioMuted: false,
  setAudioMuted: (v) => set({ audioMuted: v }),
  showLabels: true,
  setShowLabels: (v) => set({ showLabels: v }),
}))