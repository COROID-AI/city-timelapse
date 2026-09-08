/**
 * Nitrous boost system for the player vehicle.
 *
 * Two pure, deterministic functions model the full charge / discharge cycle:
 *
 *   - `accumulateNitrous`   drifting on the track charges the canister;
 *   - `consumeNitrous`      holding the boost trigger drains the canister and
 *                           applies a speed multiplier while we still have
 *                           gas.
 *
 * Nitrous is earned by *sustained* drifting. `detectDrift` (from `physics.ts`)
 * reports a continuous `slide` intensity, and that intensity is integrated
 * over time — so a corner of hard drifting fills the canister while coasting
 * or gripping on straight sections never does. When the canister is full, a
 * boost spends it dramatically and reports exhaust flame intensity for the FX
 * task to visualize (blue-purple flames).
 *
 * The "wide-angle speed boost with blue-purple exhaust flames" is expressed
 * here purely as state:
 *   - `exhaustFlame` 0..1 drives the FX flame scale / brightness;
 *   - `boostMultiplier` (>= 1) is the speed multiplier applied while boosting.
 */

/** Tuning constants for the nitrous charge / discharge cycle. */
export interface NitrousTuning {
  /** Nitrous canister capacity in charge units. */
  readonly capacity: number;
  /** Charge units gained per second of sustained drifting (charge * slide). */
  readonly chargeRate: number;
  /** Charge units the canister reaches before a boost starts. */
  readonly boostRequirement: number;
  /** Charge units consumed per second while the trigger is held. */
  readonly dischargeRate: number;
  /** Speed multiplier applied while boosting (>= 1). */
  readonly boostMultiplier: number;
  /** Seconds of boost available when starting a full boost. */
  readonly boostDuration: number;
}

/** Default nitrous tuning for the player's neon sports car. */
export const defaultNitrous: Readonly<NitrousTuning> = {
  capacity: 1,
  chargeRate: 0.55,
  boostRequirement: 1,
  dischargeRate: 1.1,
  boostMultiplier: 1.55,
  boostDuration: 1.8,
};

/** Observable nitrous state for a vehicle. */
export interface NitrousCharge {
  /** Current canister charge in [0, capacity]. */
  charge: number;
  /** Whether the boost system is currently discharging. */
  boosting: boolean;
  /** Boost progress 0..1 (0 = just started, 1 = spent). */
  boostProgress: number;
  /** Exhaust flame intensity 0..1 for the FX task (0 = cold). */
  exhaustFlame: number;
  /** Current speed multiplier (>= 1 while boosting, else 1). */
  boostMultiplier: number;
  /** Agent-visible flag: canister leveled "Ready to boost". */
  ready: boolean;
}

/** Clamp `value` into the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Create a fresh, empty nitrous state. */
export function createNitrous(): NitrousCharge {
  return {
    charge: 0,
    boosting: false,
    boostProgress: 0,
    exhaustFlame: 0,
    boostMultiplier: 1,
    ready: false,
  };
}

/**
 * Convert a raw `slide` intensity (0..1 from `detectDrift`) into a charge-in,
 * applying `params.chargeRate` over `dt`. Only positive charge flows; the
 * canister never leaks charge from drifting alone.
 */
export function accumulateNitrous(
  state: NitrousCharge,
  slide: number,
  dt: number,
  params: Readonly<NitrousTuning> = defaultNitrous,
): NitrousCharge {
  const gained = Math.max(0, slide) * params.chargeRate * dt;
  const charge = clamp(state.charge + gained, 0, params.capacity);
  return { ...state, charge, ready: charge >= params.boostRequirement };
}

/**
 * Consume nitrous for one `dt` tick.
 *
 * When `trigger` is held and charge is available, the system enters a boost:
 * charge drains, `boosting` becomes true, `boostMultiplier` = the tuned speed
 * multiplier, and `exhaustFlame` ramps to 1 (blue-purple flame). When the
 * charge is spent or the trigger is released the boost decays, flame fades,
 * and the multiplier returns to 1.
 */
export function consumeNitrous(
  state: NitrousCharge,
  trigger: boolean,
  dt: number,
  params: Readonly<NitrousTuning> = defaultNitrous,
): NitrousCharge {
  const holding = trigger && state.charge > 0;
  const had = state.boosting;

  if (holding) {
    const spent = clamp(state.charge, 0, params.dischargeRate * dt);
    const charge = clamp(state.charge - spent, 0, params.capacity);
    const exhausted = charge <= 0;
    // Flame intensity tracks how much gas is left in this boost so the FX
    // blazes at ignition and tapers as the canister empties.
    const flame = exhausted
      ? 0
      : clamp(charge / Math.max(params.boostRequirement, 1e-6), 0, 1);
    const boostProgress = 1 - flame;
    return {
      charge,
      // A boost that runs dry this frame ends immediately (no ghost boost).
      boosting: !exhausted,
      boostProgress,
      exhaustFlame: flame,
      boostMultiplier: exhausted ? 1 : params.boostMultiplier,
      ready: charge >= params.boostRequirement,
    };
  }

  // No boost: fade the flame out smoothly so FX doesn't pop off.
  const fade = Math.max(0, state.exhaustFlame - (dt / 0.12));
  return {
    charge: state.charge,
    boosting: had && state.exhaustFlame > 0,
    boostProgress: 0,
    exhaustFlame: clamp(fade, 0, 1),
    boostMultiplier: 1,
    ready: state.charge >= params.boostRequirement,
  };
}

/**
 * The one-call frame entrypoint: charge from this frame's drift, then apply
 * the boost trigger. Returns the new nitrous state (allocation-free on the
 * player hot path when callers reuse the same object).
 */
export function stepNitrous(
  state: NitrousCharge,
  input: Readonly<{ slide: number; boost: boolean }>,
  dt: number,
  params: Readonly<NitrousTuning> = defaultNitrous,
): NitrousCharge {
  const charged = accumulateNitrous(state, input.slide, dt, params);
  return consumeNitrous(charged, input.boost, dt, params);
}