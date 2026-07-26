/**
 * TrafficLightController — cycles a signalized intersection through
 * green → yellow → red (and the complementary direction inversely) on a
 * configurable period, and exposes the current phase for vehicles to obey.
 *
 * Like `roadNetwork.ts`, the controller's *logic* is framework-free so it can be
 * unit-tested and consumed by vehicle tasks. The visual signal heads (lamp
 * meshes / emissive materials) are driven by `blockLayout.ts`, which calls
 * {@link TrafficLightController.getPhase} each frame.
 */

import type { SignalPhase } from './roadNetwork.js';

/** Default full cycle period (green+yellow+red), in milliseconds. */
export const DEFAULT_SIGNAL_CYCLE_MS = 12_000;

/** How much of the cycle is green, as a fraction in (0, 1). */
export const DEFAULT_GREEN_FRACTION = 0.42;
/** How much of the cycle is yellow, as a fraction in (0, 1). */
export const DEFAULT_YELLOW_FRACTION = 0.12;
/** Red takes the remainder of the cycle. */

export interface TrafficLightOptions {
  /** Full cycle period in milliseconds (green + yellow + red). */
  cycleMs?: number;
  /** Fraction of the cycle that is green. */
  greenFraction?: number;
  /** Fraction of the cycle that is yellow. */
  yellowFraction?: number;
  /**
   * Optional initial elapsed offset in milliseconds; useful for staggering two
   * controllers so their greens don't overlap.
   */
  initialOffsetMs?: number;
}

/**
 * A deterministic, time-driven traffic-light controller. Vehicles query
 * {@link TrafficLightController.getPhase} to decide whether to proceed.
 *
 * The controller is stateless across frames except for its accumulated elapsed
 * time, so it survives era transitions and scene reloads cleanly.
 */
export interface TrafficLightController {
  /** Advance the controller by `deltaMs`. Call every frame from the loop. */
  update: (deltaMs: number) => void;
  /**
   * Current phase for the primary axis (e.g. east-west). One of
   * `'green' | 'yellow' | 'red'`.
   */
  getPhase: () => SignalPhase;
  /**
   * Current phase for the complementary axis (e.g. north-south). This is the
   * inverse of {@link getPhase}: when the primary axis is green/yellow the
   * complementary axis is red, and vice versa.
   */
  getComplementaryPhase: () => SignalPhase;
  /** The configured cycle period in milliseconds. */
  getCycleMs: () => number;
  /** Reset the controller to the start of the cycle (green). */
  reset: () => void;
}

/**
 * Create a {@link TrafficLightController}.
 *
 * The cycle is divided: green → yellow → red, then repeats. The complementary
 * direction is the inverse (its green is the primary's red and vice versa).
 */
export function createTrafficLightController(
  options: TrafficLightOptions = {},
): TrafficLightController {
  const cycleMs = options.cycleMs ?? DEFAULT_SIGNAL_CYCLE_MS;
  const greenFraction = options.greenFraction ?? DEFAULT_GREEN_FRACTION;
  const yellowFraction = options.yellowFraction ?? DEFAULT_YELLOW_FRACTION;

  // Derive per-phase durations from fractions. redMs is implicit (the remainder
  // after green + yellow); phaseAt resolves it via cumulative thresholds.
  const greenMs = cycleMs * greenFraction;
  const yellowMs = cycleMs * yellowFraction;

  let elapsed = options.initialOffsetMs ?? 0;

  function phaseAt(t: number): SignalPhase {
    // Normalize into [0, cycleMs).
    const m = ((t % cycleMs) + cycleMs) % cycleMs;
    if (m < greenMs) return 'green';
    if (m < greenMs + yellowMs) return 'yellow';
    return 'red';
  }

  function invert(phase: SignalPhase): SignalPhase {
    // When primary is green or yellow, complementary is red; when primary is
    // red, complementary is green.
    return phase === 'red' ? 'green' : 'red';
  }

  return {
    update(deltaMs: number) {
      elapsed += deltaMs;
    },
    getPhase() {
      return phaseAt(elapsed);
    },
    getComplementaryPhase() {
      return invert(phaseAt(elapsed));
    },
    getCycleMs() {
      return cycleMs;
    },
    reset() {
      elapsed = 0;
    },
  };
}
