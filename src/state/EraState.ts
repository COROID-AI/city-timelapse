/**
 * src/state/EraState.ts — subscribe/emit era store.
 *
 * Plain TypeScript observers, decoupled from the render loop and from Three
 * objects. UI and scene modules subscribe; every mutation emits a frozen
 * snapshot so listeners can diff safely.
 */

import type { EraId } from '../eras';
import { ERA_IDS, getEraSpec } from '../eras';

export type EraListener = (era: EraId, prev: EraId) => void;

export interface EraStateSnapshot {
  era: EraId;
  index: number;
  prev: EraId;
}

/** 2s global transition, shortened when the user prefers reduced motion. */
export const ERA_TRANSITION_MS = 2000;
export const ERA_TRANSITION_REDUCED_MS = 500;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duration currently used for era transitions. */
export function getTransitionDuration(): number {
  return prefersReducedMotion() ? ERA_TRANSITION_REDUCED_MS : ERA_TRANSITION_MS;
}

export class EraState {
  private _era: EraId = ERA_IDS[0];
  private listeners = new Set<EraListener>();
  private _transitionMs: number;

  constructor(initial: EraId = ERA_IDS[0], transitionMs: number = getTransitionDuration()) {
    this._era = initial;
    this._transitionMs = transitionMs;
  }

  get era(): EraId {
    return this._era;
  }

  get index(): number {
    return ERA_IDS.indexOf(this._era);
  }

  get transitionMs(): number {
    return this._transitionMs;
  }

  setTransitionMs(ms: number): void {
    this._transitionMs = Math.max(0, ms);
  }

  /** Snapshot of the current state for passive consumers. */
  snapshot(): EraStateSnapshot {
    return { era: this._era, index: this.index, prev: this._era };
  }

  /** Set the current era; no-ops when unchanged, else emits to all listeners. */
  setEra(id: EraId): void {
    if (!ERA_IDS.includes(id)) {
      throw new Error(`Cannot set unknown era: ${String(id)}`);
    }
    if (id === this._era) {
      return;
    }
    const prev = this._era;
    this._era = id;
    for (const listener of this.listeners) {
      listener(id, prev);
    }
  }

  /** Move one step along the timeline; wraps around both directions. */
  step(delta = 1): void {
    const idx = (this.index + delta + ERA_IDS.length) % ERA_IDS.length;
    this.setEra(ERA_IDS[idx]);
  }

  subscribe(listener: EraListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Latest spec for the active era. */
  get spec() {
    return getEraSpec(this._era);
  }

  dispose(): void {
    this.listeners.clear();
  }
}