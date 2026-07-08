/**
 * Transition Manager - Smooth interpolated transitions between era states with timeline scrubbing support
 */

import type { EraId } from '../eras';

export interface TransitionTarget {
  x: number;
  y: number;
  z: number;
}

export interface EraTransition {
  from: EraId | null;
  to: EraId;
  progress: number;
  duration: number;
}

export class TransitionManager {
  private currentEra: EraId | null = null;
  private transition: EraTransition | null = null;
  private callbacks: Map<string, ((value: number | EraId) => void)[]> = new Map();

  /**
   * Start transition to a new era
   */
  startTransition(toEra: EraId, duration: number = 1500): void {
    this.transition = {
      from: this.currentEra,
      to: toEra,
      progress: 0,
      duration
    };
    
    this.currentEra = toEra;
  }

  /**
   * Update transition progress
   */
  update(deltaTime: number): number {
    if (!this.transition) return 0;
    
    this.transition.progress += deltaTime * 1000;
    const ratio = Math.min(this.transition.progress / this.transition.duration, 1);
    
    // Notify observers
    const progressCallbacks = this.callbacks.get('progress') || [];
    progressCallbacks.forEach(cb => cb(ratio));
    
    if (ratio >= 1) {
      this.transition = null;
      return 1;
    }
    
    return ratio;
  }

  /**
   * Subscribe to transition events
   */
  on(event: string, callback: (value: unknown) => void): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  /**
   * Scrub timeline to specific era (for direct selection)
   */
  scrubToEra(eraId: EraId): void {
    this.currentEra = eraId;
    this.transition = null;
    
    const callbacks = this.callbacks.get('eraChange') || [];
    callbacks.forEach(cb => cb(eraId));
  }

  /**
   * Linear interpolation between values
   */
  lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Get interpolated position
   */
  interpolatePosition(from: TransitionTarget, to: TransitionTarget, t: number): TransitionTarget {
    return {
      x: this.lerp(from.x, to.x, t),
      y: this.lerp(from.y, to.y, t),
      z: this.lerp(from.z, to.z, t)
    };
  }

  /**
   * Get current era
   */
  getCurrentEra(): EraId | null {
    return this.currentEra;
  }

  /**
   * Is transition in progress
   */
  isTransitioning(): boolean {
    return this.transition !== null && this.transition.progress < this.transition.duration;
  }
}