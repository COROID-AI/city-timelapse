import { create } from 'zustand';
import { ERA_COUNT, ERA_MAX, clampEra } from '../engine/eraSampler';

// ---------------------------------------------------------------------------
// Store design
// ---------------------------------------------------------------------------
// The store holds a single source of truth: `eraFloat`, the continuous era
// coordinate. UI writes `targetEra` (an integer) via `setEra`. A frame-driven
// `tick` relaxes `eraFloat` toward `targetEra` so the scene transforms smoothly.
// All visuals + audio are pure functions of `eraFloat`.
//
// Reduced-motion mode snaps `eraFloat` straight to `targetEra` (no animation).

export type SceneState = {
  /** The continuous era coordinate the whole scene is derived from. */
  eraFloat: number;
  /** The integer era the user requested. */
  targetEra: number;
  /** True while `eraFloat` is still catching up to `targetEra`. */
  isTransitioning: boolean;
  /** Procedural audio on/off ( initialised on first user gesture). */
  sfxEnabled: boolean;
  /** Reduced-motion: instant transitions, no auto-rotate. */
  reducedMotion: boolean;
  /** Monotonic counter — components watch it to fire a camera reset. */
  cameraResetToken: number;
  /** Auto-rotate on/off. */
  autoRotate: boolean;

  // --- actions ---
  setEra: (era: number) => void;
  setEraFloat: (f: number) => void;
  /** Advance frame relaxation. Returns true if still transitioning. */
  tick: (dtSeconds: number) => boolean;
  toggleSfx: () => void;
  setSfxEnabled: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  toggleReducedMotion: () => void;
  resetCamera: () => void;
  setAutoRotate: (v: boolean) => void;
  stepEra: (delta: number) => void;
};

// Transition speed in era-units per second. Full 0->5 sweep ≈ 5.5s.
const TRANSITION_SPEED = 1.0;

// Below this distance we consider the transition complete.
const EPSILON = 0.0008;

export const useSceneStore = create<SceneState>((set, get) => ({
  eraFloat: 0,
  targetEra: 0,
  isTransitioning: false,
  sfxEnabled: false,
  reducedMotion: false,
  cameraResetToken: 0,
  autoRotate: false,

  setEra: (era: number) => {
    const target = clampEra(Math.round(era));
    const { reducedMotion, eraFloat } = get();
    if (reducedMotion) {
      set({ targetEra: target, eraFloat: target, isTransitioning: false });
    } else {
      set({
        targetEra: target,
        isTransitioning: target !== eraFloat,
      });
    }
  },

  setEraFloat: (f: number) => set({ eraFloat: clampEra(f) }),

  tick: (dtSeconds: number) => {
    const { eraFloat, targetEra, reducedMotion } = get();
    if (reducedMotion) {
      if (eraFloat !== targetEra) {
        set({ eraFloat: targetEra, isTransitioning: false });
      }
      return false;
    }
    const diff = targetEra - eraFloat;
    if (Math.abs(diff) <= EPSILON) {
      if (eraFloat !== targetEra) {
        set({ eraFloat: targetEra, isTransitioning: false });
      } else if (get().isTransitioning) {
        set({ isTransitioning: false });
      }
      return false;
    }
    // frame-rate independent relaxation toward the target
    const step = Math.sign(diff) * Math.min(Math.abs(diff), TRANSITION_SPEED * dtSeconds);
    set({ eraFloat: eraFloat + step, isTransitioning: true });
    return true;
  },

  toggleSfx: () => set((s) => ({ sfxEnabled: !s.sfxEnabled })),
  setSfxEnabled: (v: boolean) => set({ sfxEnabled: v }),
  setReducedMotion: (v: boolean) => {
    const { targetEra } = get();
    set({ reducedMotion: v });
    if (v) set({ eraFloat: targetEra, isTransitioning: false });
  },
  toggleReducedMotion: () => {
    const { reducedMotion, targetEra } = get();
    if (!reducedMotion) {
      set({ reducedMotion: true, eraFloat: targetEra, isTransitioning: false });
    } else {
      set({ reducedMotion: false });
    }
  },
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
  setAutoRotate: (v: boolean) => set({ autoRotate: v }),
  stepEra: (delta: number) => {
    const { targetEra } = get();
    get().setEra(clampEra(targetEra + delta));
  },
}));

export { ERA_COUNT, ERA_MAX };
