/**
 * Quality / performance scaler for the neon racer.
 *
 * This module owns the single knob the integration task uses to tune
 * render quality against frame rate. It is **composition-only**: it feeds
 * option objects into the consumed producer factories (post-FX composer,
 * nitrous-flame emitter, renderer, world reflector) and never reimplements
 * any system logic.
 *
 * Budgets exposed here:
 *   - `pixelRatioCap`  -> renderer + EffectComposer pixel ratio ceiling
 *   - `antialias`      -> MSAA on the WebGL renderer
 *   - `motionBlur`     -> whether the afterimage/velocity trail is enabled
 *   - `motionBlurBoost`-> 0..1 extra smearing during nitrous boost
 *   - `flameParticles` -> max concurrent nitrous flame particles (pool size)
 *   - `reflections`    -> toggles the wet-street reflector + sign glow budget
 *
 * It is safe to import in Node (Jest): all hardware probing is guarded so the
 * module never touches `navigator` in a non-browser environment.
 */

/** Named quality presets the scaler can resolve to. */
export type QualityMode = 'low' | 'medium' | 'high' | 'ultra';

/** Resolved quality budget for the composed game. */
export interface QualityConfig {
  /** The named preset this config was derived from. */
  readonly mode: QualityMode;
  /** Enable MSAA on the renderer. */
  readonly antialias: boolean;
  /** Cap on renderer / composer pixel ratio (`Math.min(dpr, cap)`). */
  readonly pixelRatioCap: number;
  /** Whether the motion-blur afterimage trail is on. */
  readonly motionBlur: boolean;
  /** 0..1 extra blur smearing applied while the nitrous boost is active. */
  readonly motionBlurBoost: number;
  /** Maximum live nitrous flame particles (emitter pool size). */
  readonly flameParticles: number;
  /** Show the wet reflectors / sign glow (part of the reflection budget). */
  readonly reflections: boolean;
}

/** Base budgets by preset. */
const PRESETS: Readonly<Record<QualityMode, QualityConfig>> = {
  low: {
    mode: 'low',
    antialias: false,
    pixelRatioCap: 1,
    motionBlur: false,
    motionBlurBoost: 0,
    flameParticles: 40,
    reflections: false,
  },
  medium: {
    mode: 'medium',
    antialias: false,
    pixelRatioCap: 1.5,
    motionBlur: true,
    motionBlurBoost: 0.12,
    flameParticles: 64,
    reflections: true,
  },
  high: {
    mode: 'high',
    antialias: true,
    pixelRatioCap: 2,
    motionBlur: true,
    motionBlurBoost: 0.18,
    flameParticles: 96,
    reflections: true,
  },
  ultra: {
    mode: 'ultra',
    antialias: true,
    pixelRatioCap: 3,
    motionBlur: true,
    motionBlurBoost: 0.24,
    flameParticles: 140,
    reflections: true,
  },
};

/** All valid preset keys. */
export const QUALITY_MODES: readonly QualityMode[] = [
  'low',
  'medium',
  'high',
  'ultra',
];

/** Clamp a raw (possibly non-browser) value into `[min, max]`. */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Guarded device-pixel-ratio read (1 in Node / non-browser). */
function devicePixelRatio(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio
    ? window.devicePixelRatio
    : 1;
}

/** Guarded hardware-concurrency read (unknown in Node / non-browser). */
function hardwareConcurrency(): number {
  return typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;
}

/**
 * Pick a sensible default mode from the runtime's capabilities. Falls back to
 * `high` for the common desktop browser profile.
 */
export function defaultQualityMode(): QualityMode {
  const dpr = devicePixelRatio();
  const threads = hardwareConcurrency();
  if (dpr <= 1 && threads <= 4) return 'medium';
  if (threads >= 8) return 'ultra';
  return 'high';
}

/** Resolve a named quality preset (default: runtime-derived). */
export function resolveQuality(mode?: QualityMode): QualityConfig {
  const key = mode ?? defaultQualityMode();
  return PRESETS[key] ?? PRESETS.high;
}

/**
 * Docstring-preserving factory that folds any partial overrides on top of a
 * preset. Lets callers (bootstrap / tests) sharpen individual budgets without
 * forking the whole config.
 */
export function quality(overrides: Partial<QualityConfig> = {}): QualityConfig {
  const base = resolveQuality(overrides.mode ?? defaultQualityMode());
  const merged: QualityConfig = { ...base, ...overrides };
  return {
    ...merged,
    // Guard invariant fields no matter what the caller passed.
    pixelRatioCap: clamp(merged.pixelRatioCap, 1, 4),
    motionBlurBoost: clamp(merged.motionBlurBoost, 0, 1),
    flameParticles: Math.max(8, Math.floor(merged.flameParticles)),
  };
}

/** The game-wide quality budget consumed by `src/main.ts` composition. */
export const QUALITY: QualityConfig = quality();