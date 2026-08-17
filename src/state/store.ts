import { create } from 'zustand';
import type { EraInfo } from '../eras/types';
import type { EraKey } from '../eras/types';
import { ERA_ORDER, getAdjacentEra } from '../eras/types';
import { getEra, lerpEra } from '../eras/config';

export interface AppState {
  // Era state
  currentEra: EraKey;
  selectedEra: EraKey | null;
  transitionProgress: number;
  transitioning: boolean;
  previousEra: EraKey | null;

  // Timelapse
  isPlaying: boolean;
  playSpeed: number;

  // Audio
  muted: boolean;
  volume: number;

  // Interaction
  hoveredPOI: string | null;
  selectedPOI: string | null;

  // Actions
  selectEra: (key: EraKey) => void;
  nextEra: () => void;
  prevEra: () => void;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setTransitioning: (val: boolean) => void;
  setHoveredPOI: (id: string | null) => void;
  setSelectedPOI: (id: string | null) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentEra: '2025',
  selectedEra: '2025',
  transitionProgress: 1,
  transitioning: false,
  previousEra: null,

  isPlaying: false,
  playSpeed: 1,

  muted: false,
  volume: 0.5,

  hoveredPOI: null,
  selectedPOI: null,

  selectEra: (key: EraKey) => {
    const { currentEra } = get();
    if (key === currentEra) return;
    set({
      previousEra: currentEra,
      selectedEra: key,
      transitioning: true,
      transitionProgress: 0,
    });
  },

  nextEra: () => {
    const { currentEra } = get();
    const next = getAdjacentEra(currentEra, 1);
    if (next) get().selectEra(next);
  },

  prevEra: () => {
    const { currentEra } = get();
    const prev = getAdjacentEra(currentEra, -1);
    if (prev) get().selectEra(prev);
  },

  togglePlay: () => {
    const { isPlaying } = get();
    if (!isPlaying) {
      // Start cycling
      const { currentEra } = get();
      const next = getAdjacentEra(currentEra, 1);
      if (next) get().selectEra(next);
      else get().selectEra(ERA_ORDER[0]);
    }
    set({ isPlaying: !isPlaying });
  },

  setVolume: (vol: number) => set({ volume: Math.max(0, Math.min(1, vol)) }),
  toggleMute: () => set(state => ({ muted: !state.muted })),

  setTransitioning: (val: boolean) => set({ transitioning: val }),

  setHoveredPOI: (id: string | null) => set({ hoveredPOI: id }),
  setSelectedPOI: (id: string | null) => set({ selectedPOI: id }),

  reset: () => {
    set({
      currentEra: '2025',
      selectedEra: '2025',
      transitionProgress: 1,
      transitioning: false,
      previousEra: null,
      isPlaying: false,
      hoveredPOI: null,
      selectedPOI: null,
    });
  },
}));

// Derive effective era during transition
export function getEffectiveEra(): EraInfo {
  const { currentEra, selectedEra, transitionProgress, transitioning } = useStore.getState();
  const active = selectedEra ?? currentEra;
  if (!transitioning || transitionProgress >= 1) {
    return getEra(active);
  }
  return {
    ...getEra(currentEra),
    ...lerpEra(getEra(currentEra), getEra(active), transitionProgress),
  };
}
