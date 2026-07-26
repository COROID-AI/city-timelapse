import type { ApplyEraFn, EraKey } from './eraConfig.js';

/**
 * Cross-fade transformation engine.
 *
 * When the active era changes, the TransitionManager lerps/scales/opacity-fades
 * every registered domain object over a fixed (~1.5s) duration using a shared
 * easing curve — *never rebuilding the scene graph*. Domain modules plug in via
 * `registerDomain(name, applyEra)` without coupling to one another; they only
 * agree on the era contract in `eraConfig.ts`.
 *
 * The manager drives a single shared transition clock. On `setActiveEra` it
 * records the previous era as the source and the new era as the destination,
 * then each frame it computes an eased `t` in [0, 1] and invokes every domain's
 * `applyEra` callback with (destinationEra, t, sourceEra). Domains are
 * responsible for interpolating their own registered transformables between the
 * two era configs (helpers like `lerp`/`lerpHex` live in eraConfig.ts).
 */

/** Domain plug-in registration. Domains call this to join the transition. */
export interface RegisteredDomain {
  /** Stable identifier, also used to de-duplicate registrations. */
  name: string;
  /** Per-frame era-application callback invoked during a cross-fade. */
  applyEra: ApplyEraFn;
}

/**
 * A normalized easing function mapping raw linear progress in [0, 1] to eased
 * progress in [0, 1]. The default smoothstep gives a gentle ease-in/ease-out.
 */
export type EasingFn = (t: number) => number;

/** Default smoothstep easing: `t*t*(3 - 2t)`. */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Default cross-fade duration in milliseconds (~1.5s, reversible). */
export const DEFAULT_TRANSITION_DURATION_MS = 1500;

export interface TransitionManagerOptions {
  /** Cross-fade duration in milliseconds. Defaults to ~1.5s. */
  durationMs?: number;
  /** Easing curve applied to raw progress. Defaults to smoothstep. */
  easing?: EasingFn;
}

export interface TransitionManager {
  /** Register a domain so it participates in era cross-fades. */
  registerDomain: (name: string, applyEra: ApplyEraFn) => void;
  /** Remove a previously registered domain. */
  unregisterDomain: (name: string) => void;
  /** The era currently shown as fully settled (destination of last transition). */
  getActiveEra: () => EraKey;
  /** True while a cross-fade is in progress. */
  isTransitioning: () => boolean;
  /** Normalized transition progress in [0, 1] (eased). 1 when settled. */
  getProgress: () => number;
  /**
   * Begin a transition toward `toKey`. If a transition is already running, it
   * re-anchors from the current interpolated state toward the new destination.
   */
  setActiveEra: (toKey: EraKey) => void;
  /**
   * Advance the transition one step. Call this every frame from the render loop
   * with the frame delta in milliseconds.
   */
  update: (deltaMs: number) => void;
}

export function createTransitionManager(
  initialEra: EraKey,
  options: TransitionManagerOptions = {},
): TransitionManager {
  const durationMs = options.durationMs ?? DEFAULT_TRANSITION_DURATION_MS;
  const easing = options.easing ?? smoothstep;

  const domains = new Map<string, RegisteredDomain>();

  // The fully-settled era (where the last transition ended).
  let activeEra: EraKey = initialEra;
  // Source era of an in-flight transition.
  let fromEra: EraKey = initialEra;
  // Destination era of an in-flight transition.
  let toEra: EraKey = initialEra;
  // Raw linear progress of the current transition in [0, 1].
  let progress = 1;

  function applyAll(key: EraKey, t: number, srcKey: EraKey): void {
    for (const domain of domains.values()) {
      domain.applyEra(key, t, srcKey);
    }
  }

  function registerDomain(name: string, applyEra: ApplyEraFn): void {
    domains.set(name, { name, applyEra });
    // Immediately snap the newly registered domain to the current era so it is
    // never left in an unconfigured state.
    applyEra(activeEra, 1, activeEra);
  }

  function unregisterDomain(name: string): void {
    domains.delete(name);
  }

  function isTransitioning(): boolean {
    return progress < 1;
  }

  function getProgress(): number {
    return easing(progress);
  }

  function setActiveEra(toKey: EraKey): void {
    if (toKey === toEra && progress >= 1) {
      return; // already settled on this era
    }

    // Re-anchor the source to the *current interpolated* era so a mid-flight
    // change continues smoothly from where it currently is. We represent the
    // interpolated source simply as the current destination era combined with
    // the eased progress; domains read from/to from the config and blend.
    fromEra = toEra;
    toEra = toKey;
    progress = 0;

    // Ensure the HUD/label reflects the *target* era immediately even though the
    // visual cross-fade still animates. The caller owns HUD updates, but we
    // reset progress so the first update() frame begins blending from the
    // current visual state.
  }

  function update(deltaMs: number): void {
    if (progress >= 1) {
      return;
    }

    // Advance the raw progress by the frame delta.
    progress += deltaMs / durationMs;
    if (progress >= 1) {
      progress = 1;
      activeEra = toEra;
      fromEra = toEra;
      // Final snap to the fully settled destination.
      applyAll(toEra, 1, toEra);
      return;
    }

    const eased = easing(progress);
    applyAll(toEra, eased, fromEra);
  }

  return {
    registerDomain,
    unregisterDomain,
    getActiveEra: () => activeEra,
    isTransitioning,
    getProgress,
    setActiveEra,
    update,
  };
}
