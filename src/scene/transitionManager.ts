/**
 * Transition manager factory stub.
 *
 * Handles cross-fade transitions between era scenes (fade-in/out,
 * morphing geometry, particle effects). The concrete implementation
 * will wire into eraState.setEra() and animate over ~1.5 seconds.
 */

import type { EraId } from '../eras.js';

export interface TransitionManagerOptions {
  /** Duration of the transition in seconds. */
  duration?: number;
}

export interface TransitionManager {
  /** Trigger a transition to the target era. Returns a promise that resolves when done. */
  transitionTo(target: EraId): Promise<void>;
  /** Cancel any in-progress transition. */
  cancel(): void;
  /** Destroy all resources held by the manager. */
  dispose(): void;
}

/**
 * Factory function for creating a TransitionManager instance.
 * Currently returns a stub that logs transitions but performs no animation.
 */
export function createTransitionManager(options: TransitionManagerOptions = {}): TransitionManager {
  const duration = options.duration ?? 1.5;

  return {
    async transitionTo(_target: EraId) {
      console.log(`[TransitionManager] Transitioning to ${_target} (${duration}s)`);
      // Stub: await new Promise(resolve => setTimeout(resolve, duration * 1000));
    },
    cancel() {
      console.log('[TransitionManager] Transition cancelled');
    },
    dispose() {
      console.log('[TransitionManager] Disposed');
    },
  };
}
