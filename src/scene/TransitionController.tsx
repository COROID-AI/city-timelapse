import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEraStore } from '../lib/store';
import { type SceneState, updateSceneState } from './scene-state';

/**
 * The single source of truth for the animated `displayEra`.
 *
 * It owns the continuously interpolated era value and writes it (every frame)
 * into the shared mutable {@link SceneState}. Every other scene component reads
 * derived parameters from that state — the tree never remounts on era change.
 *
 * Transition model:
 *  - Continuous animation with easeInOut over {@link TRANSITION_SECONDS} (~1.6s).
 *  - Deterministic on interruption: whenever the target changes, the in-progress
 *    displayed value becomes the new transition start, so rapid / back-and-forth
 *    era changes always resolve to the correct target era with no stuck state.
 *  - Under reduced motion, snaps instantly to the target while still applying
 *    the exact final appearance (updateSceneState with the integer target).
 */
export const TRANSITION_SECONDS = 1.6;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function TransitionController({ state }: { state: SceneState }) {
  const targetEra = useEraStore((s) => s.targetEra);
  const reduced = useEraStore((s) => s.reducedMotion || s.prefersReducedMotion);

  // Per-transition mutable bookkeeping.
  const startEra = useRef(targetEra); // era value the current transition started from
  const progress = useRef(1); // 0..1 eased-progress along the current transition
  const lastTarget = useRef(targetEra);

  useFrame((_, rawDelta) => {
    // Clamp delta after tab suspension / long frames.
    const delta = Math.min(rawDelta, 0.05);

    // Rebase on target change so interruptions resolve deterministically:
    // the value currently being displayed becomes the new transition start.
    if (targetEra !== lastTarget.current) {
      const eased = easeInOut(progress.current);
      const currentDisplay =
        startEra.current + (lastTarget.current - startEra.current) * eased;
      startEra.current = currentDisplay;
      progress.current = 0;
      lastTarget.current = targetEra;
    }

    if (reduced) {
      progress.current = 1;
      updateSceneState(state, targetEra);
      return;
    }

    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / TRANSITION_SECONDS);
    }
    const eased = easeInOut(progress.current);
    const display = startEra.current + (targetEra - startEra.current) * eased;
    updateSceneState(state, display);
  });

  return null;
}
