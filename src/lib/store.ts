import { create } from 'zustand';
import { ERA_COUNT } from './era-data';

const prefersReducedMotionInitial =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface EraStore {
  /** Integer target era index (0..5). The only durable era state. */
  targetEra: number;
  /** Manual reduced-motion override toggle. */
  reducedMotion: boolean;
  /** System reduced-motion preference. */
  prefersReducedMotion: boolean;
  muted: boolean;
  /** Whether the scene has finished its first render (loading gate). */
  ready: boolean;
  /** Result of the WebGL capability check (null until checked). */
  webglOk: boolean | null;
  /** Registered by the camera rig; called by the Reset View control. */
  resetFn: (() => void) | null;

  setEra: (era: number) => void;
  toggleMute: () => void;
  toggleReducedMotion: () => void;
  setReady: (ready: boolean) => void;
  setWebglOk: (ok: boolean) => void;
  registerReset: (fn: (() => void) | null) => void;
  resetView: () => void;
}

const clampEra = (era: number) => Math.max(0, Math.min(ERA_COUNT - 1, Math.round(era)));

export const useEraStore = create<EraStore>((set, get) => ({
  targetEra: 0,
  reducedMotion: false,
  prefersReducedMotion: prefersReducedMotionInitial,
  muted: false,
  ready: false,
  webglOk: null,
  resetFn: null,

  setEra: (era) => {
    const next = clampEra(era);
    if (next !== get().targetEra) set({ targetEra: next });
  },
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
  setReady: (ready) => set({ ready }),
  setWebglOk: (webglOk) => set({ webglOk }),
  registerReset: (resetFn) => set({ resetFn }),
  resetView: () => {
    const fn = get().resetFn;
    if (fn) fn();
  },
}));

/** Effective reduced-motion flag (system OR explicit toggle). */
export const selectEffectiveReducedMotion = (s: EraStore) =>
  s.reducedMotion || s.prefersReducedMotion;
