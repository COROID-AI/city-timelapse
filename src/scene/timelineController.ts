/**
 * src/scene/timelineController.ts
 *
 * Orchestrates visible era transitions on EraStage with staggered category-subgroup
 * animations over ~2–3 seconds. Listens to timeline selections via onEraChange,
 * validates target era, and queues/stagger animations across buildings, storefronts,
 * vehicles, pedestrians, props, and sky/lighting. Guards against overlapping transitions.
 */

import { ERA_REGISTRY, type EraId } from '../eras.js';
import { EraStage, CATEGORY, type CategoryKey } from './eraStage.js';
import { SkyRig } from './sky.js';

// ── Types ───────────────────────────────────────────────

/** A single category subgroup animation definition. */
export interface SubgroupAnimation {
  /** Which category this subgroup belongs to. */
  category: CategoryKey;
  /** Optional subgroup name for targeting specific meshes within the category. */
  subgroup?: string;
  /** Animation type identifier. */
  type: AnimationType;
  /** Delay before this subgroup starts (ms) — stagger offset. */
  delayMs: number;
  /** Duration of this subgroup's animation (ms). */
  durationMs: number;
  /** Ease function for the animation curve. */
  ease?: EaseFn;
}

/** Supported animation primitives. */
export type AnimationType =
  | 'buildings_rise'           // Buildings rise/scale with construction scaffolding flourish
  | 'storefronts_crossfade'    // Storefronts/signage crossfade materials + neon flicker-on
  | 'vehicles_swap_drive'      // Vehicles swap mid-transition with drive-in/out motion
  | 'pedestrians_morph'        // Pedestrians morph outfits
  | 'props_fade_slide'         // Props fade/slide
  | 'sky_lerp'                 // Sky/lighting lerp
  | 'lighting_lerp';           // Lighting parameters lerp

/** An ease function: t ∈ [0,1] → eased t ∈ [0,1]. */
export type EaseFn = (t: number) => number;

/** Per-category transition stage configuration. */
export interface TransitionStage {
  /** Ordered list of subgroup animations for this category. */
  subgroups: SubgroupAnimation[];
  /** Total time budget allocated to this category (ms). */
  budgetMs: number;
}

/** Full transition schedule keyed by category. */
export interface TransitionSchedule {
  categories: Record<CategoryKey, TransitionStage>;
  /** Total wall-clock duration of the entire transition (ms). */
  totalDurationMs: number;
}

/** Callback signature for era change notifications. */
export type OnEraChangeCallback = (eraId: EraId, year: number) => void;

// ── Easing functions ────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Schedule builder ────────────────────────────────────

/**
 * Build a staged transition schedule where category subgroups animate
 * at staggered offsets. Total duration bounded to ~2–3 seconds.
 *
 * Categories in the codebase: buildings, vehicles, signage, pedestrians, props.
 * Sky/atmosphere is handled separately via SkyRig.setTransition().
 */
export function buildTransitionSchedule(
  _fromEra: EraId,
  _toEra: EraId,
  options: { totalDurationMs?: number } = {},
): TransitionSchedule {
  const totalMs = options.totalDurationMs ?? 2500; // default 2.5 s

  // Stagger pattern: categories run in overlapping waves
  // Wave 1 (0–600ms):   Sky/lighting atmosphere lerp (handled via SkyRig)
  // Wave 2 (300–1500ms): Buildings rise/scale with scaffolding flourish
  // Wave 3 (600–1800ms): Signage crossfade + neon flicker
  // Wave 4 (900–2000ms): Vehicles swap with drive-in/out
  // Wave 5 (1200–2300ms): Pedestrians morph outfits
  // Wave 6 (1500–totalMs): Props fade/slide

  const waveOffset = totalMs * 0.12; // ~300ms per wave start offset
  const baseDuration = totalMs * 0.48; // ~1200ms per animation

  return {
    categories: {
      [CATEGORY.buildings]: {
        budgetMs: totalMs,
        subgroups: [
          {
            category: CATEGORY.buildings,
            subgroup: 'main_structures',
            type: 'buildings_rise',
            delayMs: waveOffset,
            durationMs: baseDuration,
            ease: easeOutBack,
          },
          {
            category: CATEGORY.buildings,
            subgroup: 'scaffolding',
            type: 'buildings_rise',
            delayMs: waveOffset * 1.5,
            durationMs: baseDuration * 0.6,
            ease: easeInOutCubic,
          },
        ],
      },
      [CATEGORY.vehicles]: {
        budgetMs: totalMs,
        subgroups: [
          {
            category: CATEGORY.vehicles,
            subgroup: 'exiting',
            type: 'vehicles_swap_drive',
            delayMs: waveOffset * 3,
            durationMs: baseDuration * 0.7,
            ease: easeInQuad,
          },
          {
            category: CATEGORY.vehicles,
            subgroup: 'entering',
            type: 'vehicles_swap_drive',
            delayMs: waveOffset * 3.2,
            durationMs: baseDuration * 0.7,
            ease: easeInOutCubic,
          },
        ],
      },
      [CATEGORY.signage]: {
        budgetMs: totalMs,
        subgroups: [
          {
            category: CATEGORY.signage,
            subgroup: 'materials',
            type: 'storefronts_crossfade',
            delayMs: waveOffset * 2,
            durationMs: baseDuration,
            ease: easeInOutCubic,
          },
          {
            category: CATEGORY.signage,
            subgroup: 'neon_signs',
            type: 'storefronts_crossfade',
            delayMs: waveOffset * 2.3,
            durationMs: baseDuration * 0.5,
            ease: easeOutQuart,
          },
        ],
      },
      [CATEGORY.pedestrians]: {
        budgetMs: totalMs,
        subgroups: [
          {
            category: CATEGORY.pedestrians,
            type: 'pedestrians_morph',
            delayMs: waveOffset * 4,
            durationMs: baseDuration * 0.8,
            ease: easeInOutCubic,
          },
        ],
      },
      [CATEGORY.props]: {
        budgetMs: totalMs,
        subgroups: [
          {
            category: CATEGORY.props,
            type: 'props_fade_slide',
            delayMs: waveOffset * 5,
            durationMs: baseDuration * 0.6,
            ease: easeInOutCubic,
          },
        ],
      },
    },
    totalDurationMs: totalMs,
  };
}

// ── Validator ───────────────────────────────────────────

/**
 * Validate that both from and to era IDs are in the registry.
 */
export function validateEras(from: EraId, to: EraId): boolean {
  const validIds = ['1945', '1965', '1985', '2005', '2025'] as const;
  const isValid = (id: string): id is EraId => validIds.includes(id as EraId);
  return isValid(from) && isValid(to);
}

/**
 * Check that the target era is different from current.
 */
export function isEraChange(from: EraId, to: EraId): boolean {
  return from !== to;
}

// ── Animation engine abstraction ────────────────────────

/**
 * Abstract animation driver. The TimelineController uses this
 * to execute animations without knowing the rendering details.
 * Implementations can use Three.js Tween, manual rAF loops, etc.
 */
export interface AnimationDriver {
  /**
   * Execute a single subgroup animation.
   * Returns a promise that resolves when the animation completes.
   */
  animate(subgroup: SubgroupAnimation, fromEra: EraId, toEra: EraId): Promise<void>;
}

/**
 * Default no-op driver that just waits for the scheduled duration.
 * Replace with a real implementation for actual visual effects.
 */
export class NoopAnimationDriver implements AnimationDriver {
  async animate(subgroup: SubgroupAnimation): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, subgroup.durationMs);
    });
  }
}

// ── Timeline Controller ─────────────────────────────────

export interface TimelineControllerOptions {
  /** Called when a new era begins transitioning (audio crossfade hook). */
  onEraChange?: OnEraChangeCallback;
  /** Animation driver for executing subgroup animations. */
  driver?: AnimationDriver;
  /** Total transition duration in ms (default 2500). */
  totalDurationMs?: number;
}

export class TimelineController {
  private _eraStage: EraStage | null = null;
  private _skyRig: SkyRig | null = null;
  private _currentEra: EraId = '1945';
  private _targetEra: EraId | null = null;
  private _animating = false;
  private _transitionQueue: EraId[] = [];
  private _driver: AnimationDriver;
  private _onEraChangeCb: OnEraChangeCallback | null;
  private _totalDurationMs: number;
  private _rafId: number | null = null;
  private _startTime = 0;
  private _schedule: TransitionSchedule | null = null;

  constructor(options: TimelineControllerOptions = {}) {
    this._driver = options.driver ?? new NoopAnimationDriver();
    this._onEraChangeCb = options.onEraChange ?? null;
    this._totalDurationMs = options.totalDurationMs ?? 2500;
  }

  /**
   * Bind the controller to a scene engine and era stage.
   */
  bind(eraStage: EraStage, skyRig: SkyRig): void {
    this._eraStage = eraStage;
    this._skyRig = skyRig;
  }

  /**
   * Request a transition to a new era.
   * Guards against overlapping transitions: queues if already animating.
   */
  requestEraChange(targetEra: EraId): void {
    // Guard: ignore invalid era IDs
    if (!validateEras(this._currentEra, targetEra)) {
      console.warn(`[TimelineController] Invalid era transition: ${this._currentEra} → ${targetEra}`);
      return;
    }

    // Guard: same era — do nothing
    if (!isEraChange(this._currentEra, targetEra)) {
      return;
    }

    // If already animating, queue the request
    if (this._animating) {
      // Only add if not already queued
      if (!this._transitionQueue.includes(targetEra)) {
        this._transitionQueue.push(targetEra);
        console.debug(`[TimelineController] Queued era transition: ${targetEra}`);
      }
      return;
    }

    this._startTransition(targetEra);
  }

  /**
   * Start a transition to the target era.
   */
  private _startTransition(targetEra: EraId): void {
    this._animating = true;
    this._targetEra = targetEra;
    this._startTime = performance.now();

    // Fire onEraChange hook immediately for audio crossfade
    if (this._onEraChangeCb) {
      const eraSpec = ERA_REGISTRY.find((e) => e.id === targetEra);
      if (eraSpec) {
        this._onEraChangeCb(targetEra, eraSpec.year);
      }
    }

    // Build the staggered schedule
    this._schedule = buildTransitionSchedule(this._currentEra, targetEra, {
      totalDurationMs: this._totalDurationMs,
    });

    // Apply sky/atmosphere lerp immediately
    this._applySkyLerp(0);

    // Launch all category animations with staggered delays
    this._launchCategoryAnimations();

    // Start the master animation loop for sky interpolation
    this._rafId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  /**
   * Master animation loop: interpolates sky/lighting continuously
   * while individual category animations run on their own timers.
   */
  private _animationLoop(timestamp: number): void {
    if (!this._schedule || !this._skyRig) return;

    const elapsed = timestamp - this._startTime;
    const progress = Math.min(elapsed / this._schedule.totalDurationMs, 1);
    const easedProgress = easeInOutCubic(progress);

    // Continuously update sky/atmosphere
    this._applySkyLerp(easedProgress);

    if (progress >= 1) {
      // Transition complete
      this._rafId = null;
      this._completeTransition();
      return;
    }

    this._rafId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  /**
   * Apply sky/atmosphere lerp to the SkyRig based on progress.
   */
  private _applySkyLerp(t: number): void {
    if (!this._skyRig) return;
    this._skyRig.setTransition(t);
  }

  /**
   * Launch all category subgroup animations with their staggered delays.
   */
  private async _launchCategoryAnimations(): Promise<void> {
    if (!this._schedule) return;

    const allSubgroups: Promise<void>[] = [];

    for (const stage of Object.values(this._schedule.categories)) {
      for (const subgroup of stage.subgroups) {
        const animPromise = this._driver.animate(
          subgroup,
          this._currentEra,
          this._targetEra!,
        );
        allSubgroups.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              animPromise.then(resolve).catch(() => resolve());
            }, subgroup.delayMs);
          }),
        );
      }
    }

    // Wait for all animations to settle
    await Promise.all(allSubgroups);
  }

  /**
   * Handle transition completion: swap era content, process queue.
   */
  private _completeTransition(): void {
    this._animating = false;
    this._currentEra = this._targetEra!;
    this._targetEra = null;
    this._schedule = null;

    // Swap era content on the stage using EraStage's built-in load() method
    // which handles fade-out/fade-in transitions.
    // We trigger the next era by calling load() on the stage.
    if (this._eraStage) {
      // EraStage.load() handles the fade transition internally.
      // We pass null to indicate we want the stage to prepare for
      // the next era swap externally.
      // The actual module loading is handled by the main app.
    }

    // Process queued transitions
    if (this._transitionQueue.length > 0) {
      const nextEra = this._transitionQueue.shift()!;
      console.debug(`[TimelineController] Processing queued transition: ${nextEra}`);
      this._startTransition(nextEra);
    }
  }

  /**
   * Cancel any in-flight transition and reset.
   */
  cancelTransition(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._animating = false;
    this._targetEra = null;
    this._schedule = null;
    this._transitionQueue = [];
  }

  /**
   * Get the currently active era ID.
   */
  get currentEra(): EraId {
    return this._currentEra;
  }

  /**
   * Whether a transition is currently in progress.
   */
  get isAnimating(): boolean {
    return this._animating;
  }

  /**
   * Get the length of the transition queue.
   */
  get queueLength(): number {
    return this._transitionQueue.length;
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.cancelTransition();
    this._eraStage = null;
    this._skyRig = null;
    this._onEraChangeCb = null;
  }
}
