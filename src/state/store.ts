/**
 * Global UI state via Zustand.
 *
 * Holds the *target* era index selected by the user; the actual continuous
 * `eraFloat` used by the 3D scene lives in a ref-driven animation loop so it
 * can be eased every frame without triggering React re-renders.
 */

import { create } from "zustand";
import { ERA_YEARS, type EraYear } from "../data/eras";

export type LoadStatus = "loading" | "ready" | "error";

export interface ErrorState {
  /** short machine code, e.g. "webgl-unavailable" */
  code: string;
  /** human-readable message shown in the DOM */
  message: string;
}

export interface AppState {
  /** currently selected era as a year */
  targetYear: EraYear;
  /** selected era index 0..N-1 */
  targetEra: number;
  /** whether synthesized audio is enabled */
  audioEnabled: boolean;
  /** whether audio has been unlocked by a user gesture */
  audioStarted: boolean;
  /** reduced-motion preference */
  reducedMotion: boolean;
  /** asset / context load status */
  status: LoadStatus;
  /** error details when status === "error" */
  error: ErrorState | null;
  /** whether the WebGL context was lost (separate from init errors) */
  contextLost: boolean;

  selectEra: (year: EraYear) => void;
  selectEraIndex: (index: number) => void;
  stepEra: (delta: number) => void;
  toggleAudio: () => void;
  markAudioStarted: () => void;
  setReducedMotion: (v: boolean) => void;
  setStatus: (s: LoadStatus) => void;
  setError: (code: string, message: string) => void;
  clearError: () => void;
  setContextLost: (v: boolean) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const useAppStore = create<AppState>((set, get) => ({
  targetYear: 2025,
  targetEra: 4,
  audioEnabled: true,
  audioStarted: false,
  reducedMotion: prefersReducedMotion(),
  status: "loading",
  error: null,
  contextLost: false,

  selectEra: (year) =>
    set({ targetYear: year, targetEra: ERA_YEARS.indexOf(year) }),
  selectEraIndex: (index) => {
    const clamped = Math.max(0, Math.min(ERA_YEARS.length - 1, index));
    set({ targetEra: clamped, targetYear: ERA_YEARS[clamped] });
  },
  stepEra: (delta) => {
    const next = Math.max(0, Math.min(ERA_YEARS.length - 1, get().targetEra + delta));
    set({ targetEra: next, targetYear: ERA_YEARS[next] });
  },
  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  markAudioStarted: () => set({ audioStarted: true }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  setStatus: (s) => set({ status: s }),
  setError: (code, message) => set({ status: "error", error: { code, message } }),
  clearError: () => set({ status: "ready", error: null }),
  setContextLost: (v) => set({ contextLost: v }),
}));
