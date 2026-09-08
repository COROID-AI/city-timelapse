/**
 * Motion-blur post-processing pass for the neon-racer game.
 *
 * Uses three.js's `AfterimagePass` (an EffectComposer pass) to build a
 * cheap afterimage/velocity-style trail. This is the lowest-risk reversible
 * motion-blur approach for an arcade racer: instead of true per-pixel motion
 * vectors, the pass blends the current frame with a decaying copy of the
 * previous one.
 *
 * Intensity is driven live from the player's state:
 *   - at speed, the trail lengthens (`damp` drops toward a "stronger" value);
 *   - during nitrous boost the intensity additionally peaks, so the boost
 *     surge reads as an extra smearing of the action.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate(options)` -> build the pass
 *   `update(speed, boost, dt)` -> scale intensity from speed/boost
 *   `dispose()`            -> release render targets / materials
 */
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

/** Tuning for the motion-blur pass. */
export interface MotionBlurOptions {
  /** Base damp at zero speed in [0, 1] (higher = weaker trail). */
  readonly idleDamp?: number;
  /** Damp at full speed in [0, 1] (lower = stronger trail). */
  readonly speedDamp?: number;
  /** Speed (units/s) at which the speed-scaled trail saturates. */
  readonly speedMax?: number;
  /** Extra damp reduction applied at full boost intensity in [0, 1]. */
  readonly boostDamp?: number;
}

/** Default motion-blur tuning. */
export const defaultMotionBlurOptions: Readonly<Required<MotionBlurOptions>> = {
  idleDamp: 0.96,
  speedDamp: 0.82,
  speedMax: 55,
  boostDamp: 0.18,
};

export interface MotionBlurPass {
  /** The underlying AfterimagePass (integration adds it to the composer). */
  readonly pass: AfterimagePass;
  /** Current damp value in [0, 1] (lower = stronger blur trail). */
  getDamp(): number;
  /** Scale the trail intensity from `speed` and `boostIntensity` each frame. */
  update(speed: number, boostIntensity: number, dt: number): void;
  /** Release all render targets / materials the pass owns. */
  dispose(): void;
}

/** Compute the target damp for a speed + boost combo (pure, jest-tested). */
export function computeDamp(
  speed: number,
  boostIntensity: number,
  options: MotionBlurOptions = {},
): number {
  const cfg: Required<MotionBlurOptions> = {
    ...defaultMotionBlurOptions,
    ...options,
  };
  const speedT = Math.min(1, Math.max(0, cfg.speedMax > 0 ? speed / cfg.speedMax : 0));
  const boostT = Math.min(1, Math.max(0, boostIntensity));
  // Lower damp = stronger trail. Pull toward speedDamp as we speed up, then
  // pull a little further during boost so the surge smears harder.
  const damp = cfg.idleDamp - (cfg.idleDamp - cfg.speedDamp) * speedT;
  return damp - cfg.boostDamp * boostT;
}

/** Build a motion-blur pass wired to an EffectComposer-ready pipeline. */
export function createMotionBlurPass(
  options: MotionBlurOptions = {},
): MotionBlurPass {
  const pass = new AfterimagePass(defaultMotionBlurOptions.idleDamp);

  // Current damp, smoothed so boosts & accelerations feel eased not stepped.
  let damp = computeDamp(0, 0, options);

  const update = (speed: number, boostIntensity: number, dt: number): void => {
    const target = computeDamp(speed, boostIntensity, options);
    // Frame-rate-independent approach toward the target damp.
    const alpha = 1 - Math.exp(-10 * Math.max(0, dt));
    damp = damp + (target - damp) * alpha;
    // AfterimagePass.damp is the live uniform; higher = weaker trail.
    pass.damp = damp;
  };

  const dispose = (): void => {
    pass.dispose();
  };

  return { pass, getDamp: () => damp, update, dispose };
}