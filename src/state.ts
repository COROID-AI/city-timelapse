import { create } from 'zustand';

export const ERAS = [
  { year: 1945, name: 'Post-War Era', color: '#8B7355' },
  { year: 1965, name: 'Mid-Century Modern', color: '#4A90D9' },
  { year: 1985, name: 'Neon Age', color: '#E94B3C' },
  { year: 2005, name: 'Digital Dawn', color: '#50C878' },
  { year: 2025, name: 'Smart City', color: '#7B68EE' },
  { year: 2055, name: 'Future', color: '#00CED1' },
] as const;

export type EraIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface EraState {
  currentEra: EraIndex;
  targetEra: EraIndex;
  transitionProgress: number; // 0 = at current, 1 = at target
  isTransitioning: boolean;
  isLoaded: boolean;
  setEra: (index: EraIndex) => void;
  startTransition: (index: EraIndex) => void;
  setLoaded: (loaded: boolean) => void;
  resetTransition: () => void;
}

const TRANSITION_DURATION = 2000;

export const useStore = create<EraState>((set, get) => ({
  currentEra: 0,
  targetEra: 0,
  transitionProgress: 0,
  isTransitioning: false,
  isLoaded: false,
  setEra: (index: EraIndex) => {
    set({ currentEra: index, targetEra: index, transitionProgress: 1, isTransitioning: false });
  },
  startTransition: (index: EraIndex) => {
    const state = get();
    if (state.currentEra === index) return;
    set({ targetEra: index, isTransitioning: true, transitionProgress: 0 });
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      const eased = easeInOutCubic(progress);
      set({ transitionProgress: eased });
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        set({ currentEra: index, transitionProgress: 1, isTransitioning: false });
      }
    };
    requestAnimationFrame(animate);
  },
  setLoaded: (loaded: boolean) => set({ isLoaded: loaded }),
  resetTransition: () => set({ transitionProgress: 0, isTransitioning: false }),
}));

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
