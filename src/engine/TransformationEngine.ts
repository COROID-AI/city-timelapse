/**
 * TransformationEngine: smooth per-frame blending between era datasets.
 *
 * The engine drives a single continuous progress value (0..1) that represents
 * how far a transition from one era's data to the next era's data has
 * progressed. Every frame the caller feeds it the current store progress and
 * it applies the interpolated values to the registered era-scoped subsystems.
 *
 * Subsystems register against the engine by era key. The engine holds the
 * "from" and "to" era datasets and, for each registered target, interpolates
 * the following channels over the configured duration with smooth easing:
 *
 *   - material colors (Color)
 *   - emissive colors (Color)
 *   - fog color (Color) and fog density (number)
 *   - object visibility (boolean, thresholded)
 *
 * The engine is decoupled from three.js scene graph construction: it receives
 * plain `EraTransformation` descriptors (colors and numbers) and applies them
 * to whatever objects the caller registered. This keeps it testable in a pure
 * Node environment (no WebGL, no DOM).
 */
import { MathUtils } from 'three';
import type { Color } from 'three';

import type { EraId } from './eras';

const clamp = MathUtils.clamp;

/** Default duration of a full era transition, in seconds. */
export const DEFAULT_TRANSITION_DURATION = 2;

/** A single era's visual transformation data. */
export interface EraTransformation {
  /** Base material color, as a hex number (0xrrggbb). */
  readonly materialColor: number;
  /** Emissive color, as a hex number (0xrrggbb). */
  readonly emissiveColor: number;
  /** Emissive intensity (0 = no glow). */
  readonly emissiveIntensity: number;
  /** Fog color, as a hex number (0xrrggbb). */
  readonly fogColor: number;
  /** Fog density (0 = no fog). */
  readonly fogDensity: number;
  /** True when the era's objects are visible. */
  readonly visible: boolean;
}

/** A target channel the engine writes into. */
export interface TransformationTarget {
  /** Optional material whose color/emissive are interpolated. */
  readonly material?: {
    color: Color;
    emissive?: Color;
    emissiveIntensity?: number;
  };
  /** Optional fog whose color/density are interpolated. */
  readonly fog?: {
    color: Color;
    density?: number;
  };
  /** Optional object whose visibility flips at the midpoint. */
  readonly visibility?: {
    visible: boolean;
  };
}

/** What a registered target owns, keyed by era. */
export type EraTransformationTargets = {
  readonly [era in EraId]: TransformationTarget;
};

/** Callback invoked each frame with the current progress and era pair. */
export type TransitionListener = (
  progress: number,
  fromEra: EraId,
  toEra: EraId,
) => void;

/** Options accepted by the TransformationEngine constructor. */
export interface TransformationEngineOptions {
  /** Duration of a full transition in seconds (default 2). */
  duration?: number;
  /** Easing applied to the progress value (default easeInOutCubic). */
  easing?: (t: number) => number;
  /** Called every frame with the current transition state. */
  onTransition?: TransitionListener;
}

/** Ease-in-out cubic: smooth at both ends, still snappy mid-transition. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Ease-out cubic: starts fast, decelerates (used for fly-in feels). */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Blends two era datasets at progress `t` (0 = from, 1 = to) and writes the
 * result into the target. Exported for tests and for callers who want to
 * drive a single target manually.
 */
export function applyEraBlend(
  from: EraTransformation,
  to: EraTransformation,
  t: number,
  target: TransformationTarget,
): void {
  const eased = easeInOutCubic(clamp(t, 0, 1));

  if (target.material) {
    const mat = target.material;
    mat.color.setHex(lerpHex(from.materialColor, to.materialColor, eased));
    if (mat.emissive) {
      mat.emissive.setHex(lerpHex(from.emissiveColor, to.emissiveColor, eased));
    }
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity = lerp(from.emissiveIntensity, to.emissiveIntensity, eased);
    }
  }

  if (target.fog) {
    const fog = target.fog;
    fog.color.setHex(lerpHex(from.fogColor, to.fogColor, eased));
    if (fog.density !== undefined) {
      fog.density = lerp(from.fogDensity, to.fogDensity, eased);
    }
  }

  if (target.visibility) {
    // Flip visibility at the midpoint so objects don't linger half-faded.
    target.visibility.visible = eased >= 0.5 ? to.visible : from.visible;
  }
}

/**
 * TransformationEngine. Register era datasets with `setEraData()`, register
 * targets with `registerTarget()`, then call `update(deltaSec, progress)`
 * every frame. When the progress crosses an era boundary the engine snaps to
 * the new era pair and begins blending over `duration`.
 */
export class TransformationEngine {
  private readonly duration: number;
  private readonly easing: (t: number) => number;
  private readonly onTransition: TransitionListener | undefined;

  /** Era datasets keyed by era id. */
  private readonly eraData = new Map<EraId, EraTransformation>();

  /** Registered targets. */
  private readonly targets = new Set<TransformationTarget>();

  private fromEra: EraId | null = null;
  private toEra: EraId | null = null;
  private progress = 0;
  private lastEra: EraId | null = null;

  constructor(options: TransformationEngineOptions = {}) {
    this.duration = Math.max(0.01, options.duration ?? DEFAULT_TRANSITION_DURATION);
    this.easing = options.easing ?? easeInOutCubic;
    this.onTransition = options.onTransition;
  }

  /** Registers (or replaces) the transformation data for an era. */
  setEraData(era: EraId, data: EraTransformation): void {
    this.eraData.set(era, data);
  }

  /** Registers a target to receive blended values each frame. */
  registerTarget(target: TransformationTarget): void {
    this.targets.add(target);
  }

  /** Removes a previously registered target. */
  unregisterTarget(target: TransformationTarget): void {
    this.targets.delete(target);
  }

  /** Returns the currently active transition pair, if any. */
  getTransition(): { fromEra: EraId; toEra: EraId; progress: number } | null {
    if (this.fromEra === null || this.toEra === null) return null;
    return { fromEra: this.fromEra, toEra: this.toEra, progress: this.progress };
  }

  /**
   * Advances the transition. `selectedEra` is the era being transitioned to;
   * when it changes, the engine re-bases the transition from the previous era
   * and animates the blended values over the duration.
   */
  update(deltaSec: number, selectedEra: EraId): void {
    if (this.lastEra === null) {
      this.lastEra = selectedEra;
    }

    // Detect an era change: snap to the new pair.
    if (selectedEra !== this.lastEra) {
      this.fromEra = this.lastEra;
      this.toEra = selectedEra;
      this.progress = 0;
      this.lastEra = selectedEra;
    }

    if (this.fromEra === null || this.toEra === null) {
      // No transition yet: apply the initial era data directly.
      const initial = this.eraData.get(selectedEra);
      if (initial) {
        this.applyToTargets(initial, initial, 1);
      }
      return;
    }

    // Advance the transition progress by wall-clock time, not by the store's
    // progress (the store may jump), but always cap at 1.
    this.progress = clamp(this.progress + (deltaSec / this.duration), 0, 1);

    const from = this.eraData.get(this.fromEra);
    const to = this.eraData.get(this.toEra);
    if (from && to) {
      const eased = this.easing(this.progress);
      this.applyToTargets(from, to, eased);
      this.onTransition?.(this.progress, this.fromEra, this.toEra);
    }
  }

  /** Applies a blend of two era datasets to every registered target. */
  private applyToTargets(
    from: EraTransformation,
    to: EraTransformation,
    t: number,
  ): void {
    for (const target of this.targets) {
      applyEraBlend(from, to, t, target);
    }
  }
}

/** Linearly interpolates two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolates two hex colors (channel-wise). */
function lerpHex(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(lerp(fr, tr, t));
  const g = Math.round(lerp(fg, tg, t));
  const b = Math.round(lerp(fb, tb, t));
  return (r << 16) | (g << 8) | b;
}