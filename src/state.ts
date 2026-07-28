/**
 * Domain state — decoupled from Three.js objects.
 * This module owns the era selection and transition state,
 * allowing scene modules to read state without React re-renders.
 */
import type { EraId } from './eras';
import { getEraIndex } from './eras';

export interface AppState {
  /** Current target era (discrete). */
  era: EraId;
  /** Previous era before the last transition (for crossfading). */
  prevEra: EraId | null;
  /** Continuous era float 0..5, eased toward target. */
  eraFloat: number;
  /** Transition progress 0..1 (1 = settled). */
  transition: number;
  /** Whether the app is currently transitioning. */
  isTransitioning: boolean;
  /** Whether reduced motion is preferred. */
  reducedMotion: boolean;
  /** Master volume 0..1. */
  volume: number;
  /** Whether audio is muted. */
  muted: boolean;
}

const DEFAULT_STATE: AppState = {
  era: '1945',
  prevEra: null,
  eraFloat: 0,
  transition: 1,
  isTransitioning: false,
  reducedMotion: false,
  volume: 0.7,
  muted: false,
};

export type StateListener = (state: AppState) => void;

/**
 * Lightweight state store that notifies listeners of changes.
 * Does NOT depend on Three.js — scene modules subscribe for fast updates.
 */
export class StateStore {
  private state: AppState = { ...DEFAULT_STATE };
  private listeners = new Set<StateListener>();

  constructor() {
    // Detect reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Set a new target era. This triggers a transition.
   * The eraFloat will ease toward the new era's index over ~2s.
   * Under reduced motion, transitions snap immediately.
   */
  setEra(id: EraId): void {
    const newEra = id;
    const currentEra = this.state.era;

    if (newEra === currentEra && !this.state.isTransitioning) {
      return;
    }

    const newIndex = getEraIndex(newEra);

    if (this.state.reducedMotion) {
      // Snap immediately under reduced motion
      this.state.prevEra = currentEra;
      this.state.era = newEra;
      this.state.eraFloat = newIndex;
      this.state.transition = 1;
      this.state.isTransitioning = false;
      this.notify();
      return;
    }

    this.state.prevEra = currentEra;
    this.state.era = newEra;
    this.state.isTransitioning = true;
    this.state.transition = 0;
    // eraFloat will be updated each frame in update()
    this.notify();
  }

  setVolume(vol: number): void {
    this.state.volume = Math.max(0, Math.min(1, vol));
    this.notify();
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    this.notify();
  }

  /**
   * Called each animation frame. Advances the eraFloat transition.
   * @param dt Delta time in seconds.
   * @returns True if state changed this frame.
   */
  update(dt: number): boolean {
    if (!this.state.isTransitioning) {
      return false;
    }

    const targetIndex = getEraIndex(this.state.era);
    const startFloat = getEraIndex(this.state.prevEra ?? this.state.era);

    // Eased progress: ease-in-out cubic
    const duration = 2.0; // seconds
    this.state.transition += dt / duration;
    const t = Math.min(1, this.state.transition);
    const eased = 1 - Math.pow(1 - t, 3) * Math.pow(t, 3); // smootherstep-ish

    // Interpolate eraFloat
    this.state.eraFloat = startFloat + (targetIndex - startFloat) * eased;

    if (t >= 1) {
      this.state.eraFloat = targetIndex;
      this.state.transition = 1;
      this.state.isTransitioning = false;
      this.notify();
    }

    return true;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const stateStore = new StateStore();
