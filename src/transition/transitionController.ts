/**
 * TransitionController: the in-view era morph for the City Time Period
 * Timelapse.
 *
 * Selecting a different year must transform the block in front of the user's
 * eyes: the outgoing era content dissolves and scales out while the incoming
 * era content builds in with staggered, eased timelines. This controller owns
 * exactly that choreography, operating on generic {@link EraContentBundle}
 * instances so it stays decoupled from the concrete builders (buildings,
 * vehicles, storefronts, pedestrians ...):
 *
 * - `play(outgoing, incoming, eraId)` starts a morph between two bundles.
 *   `outgoing` dissolves/scales out (window `[0, 0.45]` by default, eased),
 *   `incoming` builds in with a per-element stagger (`[0.3, 1]` by default,
 *   so the two sides overlap and read as one continuous transformation).
 * - Durations, windows and curves are data-driven constants
 *   ({@link TransitionControllerOptions}, {@link DEFAULT_MORPH_DURATION}, and
 *   the easing curves from src/transition/easing.ts); `update(dt)` is
 *   allocation-free.
 * - Progress events run from 0 to 1 through {@link TransitionController.onProgress}
 *   and the settled era is reported exactly once through
 *   {@link TransitionController.onComplete}.
 * - Calling `play` again mid-flight interrupts cleanly. Superseded bundles
 *   are disposed exactly once (nothing gets stuck or orphaned), and when the
 *   previous incoming bundle is handed back as the new outgoing (the natural
 *   store-driven wiring pattern) its role is reassigned: it demodels down
 *   from the exact visual state it was interrupted in, because per-element
 *   factors are applied monotonically and persisted per bundle object.
 * - With reduced motion active (media query or injected override) the
 *   staggered build/demolish replaces itself with a minimal fixed-duration,
 *   linear, un-staggered crossfade with no scale movement, while still fully
 *   swapping the content.
 *
 * Lifecycle: construct -> (play | update)* -> dispose. After dispose every
 * method is a safe no-op, the running timeline is cancelled and all held
 * content and listeners are released, so scene-integration can tear down
 * without leaks.
 */

import { ERA_YEARS, type EraId } from '../era/types';
import {
  clamp01,
  easeInCubic,
  easeLinear,
  easeOutCubic,
  staggerProgress,
  windowProgress,
  type Easing,
} from './easing';

/** One animatable element of an era content bundle. */
export interface EraElement {
  /** Apply a visibility factor in [0, 1] (0 = hidden, 1 = fully shown). */
  setOpacity(factor: number): void;
  /** Apply a uniform scale factor (1 = identity). */
  setScale(factor: number): void;
}

/**
 * The generic era content the controller choreographs.
 *
 * The mandatory surface is intentionally tiny — `group`, `update(dt)` and
 * `dispose()` — so the controller stays decoupled from the concrete builders.
 * The morph touches the visual surface only through optional hooks:
 *
 * - `elements`: per-element targets whose order drives the stagger.
 * - `setOpacity` / `setScale`: whole-bundle hooks used when a bundle is a
 *   single logical piece.
 *
 * Bundles exposing neither visual surface still participate in the timeline
 * (they are fully swapped, updated and disposed) — they just cannot be faded.
 */
export interface EraContentBundle {
  /** Logical group label of this content ('buildings', 'vehicles', ...). */
  readonly group: string;
  /** Per-element morph targets; stagger is derived from their order. */
  readonly elements?: readonly EraElement[];
  /** Whole-bundle visibility hook (used when `elements` is empty/absent). */
  setOpacity?(factor: number): void;
  /** Whole-bundle scale hook (used when `elements` is empty/absent). */
  setScale?(factor: number): void;
  /** Per-frame content animation, forwarded while the bundle is active. */
  update?(dt: number): void;
  /** Release every resource this bundle owns. */
  dispose(): void;
}

/** Eased morph window for one side of the choreography. */
export interface TransitionPhase {
  /** Window start, as a fraction of the total morph duration (0..1). */
  readonly start: number;
  /** Window end, as a fraction of the total morph duration (0..1). */
  readonly end: number;
  /** Easing applied to each element's normalized window progress. */
  readonly ease: Easing;
}

/** Construction options for {@link TransitionController}. */
export interface TransitionControllerOptions {
  /** Total choreographed morph duration in seconds (default 1.5). */
  readonly duration?: number;
  /** Outgoing dissolve / demolish window (default [0, 0.45], easeInCubic). */
  readonly outgoing?: TransitionPhase;
  /** Incoming build-in window (default [0.3, 1], easeOutCubic). */
  readonly incoming?: TransitionPhase;
  /** Outgoing scale overflow when fully dissolved (default 0.08). */
  readonly outgoingScale?: number;
  /** Incoming scale undershoot at build start (default 0.06). */
  readonly incomingScale?: number;
  /** Reduced-motion crossfade duration in seconds (default 0.35). */
  readonly reducedMotionDuration?: number;
  /**
   * Hard reduced-motion override. When omitted the media query is consulted
   * (`prefersReducedMotion`, defaulting to `(prefers-reduced-motion: reduce)`).
   */
  readonly reducedMotion?: boolean;
  /** Media-query source consulted only when `reducedMotion` is omitted. */
  readonly prefersReducedMotion?: () => boolean;
}

/** Receives morph progress; `progress` moves monotonically from 0 to 1. */
export type TransitionProgressListener = (progress: number, eraId: EraId) => void;

/** Receives the settled era exactly once, when a morph completes. */
export type TransitionCompleteListener = (eraId: EraId) => void;

/** Default choreographed morph duration in seconds. */
export const DEFAULT_MORPH_DURATION = 1.5;
/** Default reduced-motion crossfade duration in seconds. */
export const DEFAULT_REDUCED_MOTION_DURATION = 0.35;
/** Default outgoing scale overflow at full dissolve (scale reaches 1 + delta). */
export const DEFAULT_OUTGOING_SCALE = 0.08;
/** Default incoming scale undershoot at build start (scale starts at 1 - delta). */
export const DEFAULT_INCOMING_SCALE = 0.06;

const DEFAULT_OUTGOING_PHASE: Readonly<TransitionPhase> = Object.freeze({
  start: 0,
  end: 0.45,
  ease: easeInCubic,
});

const DEFAULT_INCOMING_PHASE: Readonly<TransitionPhase> = Object.freeze({
  start: 0.3,
  end: 1,
  ease: easeOutCubic,
});

/** Reduced motion collapses both sides into one linear full-window fade. */
const REDUCED_MOTION_PHASE: Readonly<TransitionPhase> = Object.freeze({
  start: 0,
  end: 1,
  ease: easeLinear,
});

/** Per-bundle applied visual state, persisted across role changes. */
interface BundleVisualState {
  /** Applied per-element visibility factor (index = element order). */
  readonly opacity: Float64Array;
  /** Applied per-element scale factor. */
  readonly scale: Float64Array;
}

function requireNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`TransitionController: ${name} must be a finite number >= 0`);
  }
  return value;
}

function requireScale(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`TransitionController: ${name} must be a finite number in [0, 1]`);
  }
  return value;
}

function requirePhase(value: Readonly<TransitionPhase>, name: string): Readonly<TransitionPhase> {
  if (
    !Number.isFinite(value.start) ||
    !Number.isFinite(value.end) ||
    value.start < 0 ||
    value.start > 1 ||
    value.end < 0 ||
    value.end > 1 ||
    value.end < value.start
  ) {
    throw new Error(`TransitionController: ${name} window must satisfy 0 <= start <= end <= 1`);
  }
  return value;
}

function defaultPrefersReducedMotion(): boolean {
  const matchMedia = (globalThis as { matchMedia?: (query: string) => unknown }).matchMedia;
  if (typeof matchMedia !== 'function') {
    return false;
  }
  try {
    const result = matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof result !== 'object' || result === null) {
      return false;
    }
    // DOM MediaQueryList exposes the query result through `matches`.
    return (result as { matches?: boolean }).matches === true;
  } catch {
    return false;
  }
}

/**
 * See the module doc comment for the full contract.
 */
export class TransitionController {
  private readonly durationSeconds: number;
  private readonly reducedDurationSeconds: number;
  private readonly outgoingPhase: Readonly<TransitionPhase>;
  private readonly incomingPhase: Readonly<TransitionPhase>;
  private readonly outgoingScaleDelta: number;
  private readonly incomingScaleDelta: number;
  private readonly reducedMotionOverride: boolean | undefined;
  private readonly prefersReducedMotionQuery: () => boolean;

  private readonly progressListeners = new Set<TransitionProgressListener>();
  private readonly completeListeners = new Set<TransitionCompleteListener>();
  private readonly bundleStates = new Map<EraContentBundle, BundleVisualState>();

  private outgoing: EraContentBundle | null = null;
  private incoming: EraContentBundle | null = null;
  private targetEraValue: EraId | null = null;
  private settledEraValue: EraId | null = null;
  private elapsedSeconds = 0;
  private running = false;
  private reduced = false;
  private lastEmittedProgress: number | null = null;
  private disposed = false;

  constructor(options: TransitionControllerOptions = {}) {
    this.durationSeconds = requireNonNegative(options.duration ?? DEFAULT_MORPH_DURATION, 'duration');
    this.reducedDurationSeconds = requireNonNegative(
      options.reducedMotionDuration ?? DEFAULT_REDUCED_MOTION_DURATION,
      'reducedMotionDuration',
    );
    this.outgoingPhase = requirePhase(options.outgoing ?? DEFAULT_OUTGOING_PHASE, 'outgoing');
    this.incomingPhase = requirePhase(options.incoming ?? DEFAULT_INCOMING_PHASE, 'incoming');
    this.outgoingScaleDelta = requireScale(options.outgoingScale ?? DEFAULT_OUTGOING_SCALE, 'outgoingScale');
    this.incomingScaleDelta = requireScale(options.incomingScale ?? DEFAULT_INCOMING_SCALE, 'incomingScale');
    this.reducedMotionOverride = options.reducedMotion;
    this.prefersReducedMotionQuery = options.prefersReducedMotion ?? defaultPrefersReducedMotion;
  }

  /** True while a morph is running. */
  get active(): boolean {
    return this.running;
  }

  /** Current morph progress in [0, 1]; 0 when idle. */
  get progress(): number {
    if (!this.running) {
      return 0;
    }
    const duration = this.durationFor(this.reduced);
    if (duration <= 0) {
      return 1;
    }
    return clamp01(this.elapsedSeconds / duration);
  }

  /** The era the latest morph targets (null before the first play). */
  get targetEra(): EraId | null {
    return this.targetEraValue;
  }

  /** The era currently settled on (null while morphing or before first play). */
  get settledEra(): EraId | null {
    return this.settledEraValue;
  }

  /** Whether the current (or last) morph ran in reduced-motion mode. */
  get reducedMotion(): boolean {
    return this.reduced;
  }

  /**
   * Start (or retarget) a morph that dissolves/scales out `outgoing` while
   * `incoming` builds in, settling on `eraId` when complete.
   *
   * Mid-flight calls interrupt the running morph: every tracked bundle that
   * is not part of the new pair is disposed exactly once, so nothing gets
   * stuck or orphaned. When the previous incoming bundle is handed back as
   * the new outgoing (the natural store-driven wiring pattern), its role is
   * reassigned — it demodels down from its current visual state instead of
   * snapping back. A no-op after dispose.
   *
   * @throws if `eraId` is not one of the five shipped timeline years, or when
   *   `outgoing` and `incoming` are the same bundle.
   */
  play(outgoing: EraContentBundle, incoming: EraContentBundle, eraId: EraId): void {
    if (this.disposed) {
      return;
    }
    if (!ERA_YEARS.includes(eraId)) {
      throw new Error(`TransitionController: unknown era ${String(eraId)}`);
    }
    if (incoming === outgoing) {
      throw new Error('TransitionController: outgoing and incoming must be distinct bundles');
    }
    // Interrupt any running morph: drop every tracked bundle that does not
    // take part in the new pair. Each object is guarded, so it can never be
    // disposed twice — superseded content is disposed exactly once.
    if (this.outgoing !== null && this.outgoing !== outgoing && this.outgoing !== incoming) {
      this.outgoing.dispose();
    }
    if (this.incoming !== null && this.incoming !== incoming && this.incoming !== outgoing) {
      this.incoming.dispose();
    }
    this.outgoing = outgoing;
    this.incoming = incoming;
    this.targetEraValue = eraId;
    this.settledEraValue = null;
    this.elapsedSeconds = 0;
    this.running = true;
    this.reduced = this.resolveReducedMotion();
    this.lastEmittedProgress = null;
    this.applyMorph(0);
    this.emitProgress(0);
  }

  /**
   * Advance the running morph by `dt` seconds. Allocation-free; negative or
   * non-finite deltas are ignored. A no-op when idle or after dispose.
   * Completed morphs settle the content and fire completion exactly once.
   */
  update(dt: number): void {
    if (this.disposed || !this.running) {
      return;
    }
    if (!(dt > 0) || !Number.isFinite(dt)) {
      return;
    }
    this.elapsedSeconds += dt;
    const duration = this.durationFor(this.reduced);
    const t = duration > 0 ? this.elapsedSeconds / duration : 1.0;
    if (t >= 1) {
      this.finalize();
      return;
    }
    this.applyMorph(t);
    this.advanceContent(dt);
    if (t !== this.lastEmittedProgress) {
      this.lastEmittedProgress = t;
      this.emitProgress(t);
    }
  }

  /** Subscribe to progress events (0 -> 1); returns an unsubscribe function. */
  onProgress(listener: TransitionProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /** Subscribe to the single completion event; returns an unsubscribe function. */
  onComplete(listener: TransitionCompleteListener): () => void {
    this.completeListeners.add(listener);
    return () => {
      this.completeListeners.delete(listener);
    };
  }

  /**
   * Cancel any running timeline and release all held content and listeners.
   * Idempotent; every method is a safe no-op afterwards.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.running = false;
    if (this.outgoing !== null) {
      this.outgoing.dispose();
    }
    if (this.incoming !== null && this.incoming !== this.outgoing) {
      this.incoming.dispose();
    }
    this.outgoing = null;
    this.incoming = null;
    this.targetEraValue = null;
    this.settledEraValue = null;
    this.bundleStates.clear();
    this.progressListeners.clear();
    this.completeListeners.clear();
  }

  private durationFor(reduced: boolean): number {
    return reduced ? this.reducedDurationSeconds : this.durationSeconds;
  }

  private resolveReducedMotion(): boolean {
    if (this.reducedMotionOverride !== undefined) {
      return this.reducedMotionOverride;
    }
    try {
      return this.prefersReducedMotionQuery() === true;
    } catch {
      return false;
    }
  }

  private emitProgress(value: number): void {
    const eraId = this.targetEraValue;
    if (eraId === null) {
      return;
    }
    for (const listener of this.progressListeners) {
      listener(value, eraId);
    }
  }

  private finalize(): void {
    const settledEra = this.targetEraValue;
    // Crystallize the incoming content at its final, fully-visible state.
    this.applyMorph(1);
    if (this.outgoing !== null) {
      this.outgoing.dispose();
      this.outgoing = null;
    }
    this.settledEraValue = settledEra;
    this.running = false;
    this.lastEmittedProgress = 1;
    this.emitProgress(1);
    if (settledEra !== null) {
      for (const listener of this.completeListeners) {
        listener(settledEra);
      }
    }
  }

  private advanceContent(dt: number): void {
    if (this.outgoing !== null) {
      this.outgoing.update?.(dt);
    }
    if (this.incoming !== null) {
      this.incoming.update?.(dt);
    }
  }

  private applyMorph(t: number): void {
    const reduced = this.reduced;
    const outgoingPhase = reduced ? REDUCED_MOTION_PHASE : this.outgoingPhase;
    const incomingPhase = reduced ? REDUCED_MOTION_PHASE : this.incomingPhase;
    if (this.outgoing !== null) {
      this.drive(this.outgoing, false, t, outgoingPhase, !reduced, reduced ? 0 : this.outgoingScaleDelta);
    }
    if (this.incoming !== null) {
      this.drive(this.incoming, true, t, incomingPhase, !reduced, reduced ? 0 : this.incomingScaleDelta);
    }
  }

  /**
   * Drive one bundle's visual surface at timeline fraction `t`.
   *
   * `entering` selects the build-in law (opacity/scale rise toward 1) vs the
   * dissolve law (opacity falls to 0 while scale blooms out). `stagger`
   * spreads per-element progress across the phase window; `scaleDelta` is
   * the scale displacement for this side (0 disables scale movement,
   * reduced-motion style).
   *
   * Every factor is applied monotonically per element and persisted per
   * bundle object, so a bundle handed back across morph retargets never
   * un-dissolves or un-builds: role reassignment continues from exactly the
   * visual state it was interrupted in. No closures or allocations are
   * created here — the two surface types (elements vs whole-bundle hooks)
   * are written out explicitly so `update(dt)` stays allocation-free.
   */
  private drive(
    bundle: EraContentBundle,
    entering: boolean,
    t: number,
    phase: Readonly<TransitionPhase>,
    stagger: boolean,
    scaleDelta: number,
  ): void {
    const elements = bundle.elements;
    if (elements !== undefined && elements.length > 0) {
      const state = this.visualState(bundle, entering, scaleDelta);
      const opacity = state.opacity;
      const scale = state.scale;
      const count = stagger ? elements.length : 1;
      for (let i = 0; i < elements.length; i += 1) {
        const element = elements[i];
        if (element === undefined) {
          continue;
        }
        // Reduced motion (stagger = false) applies one shared windowed
        // progress to every element; the staggered wave uses per-index slots.
        const eased = phase.ease(
          stagger ? staggerProgress(i, count, phase.start, phase.end, t) : windowProgress(t, phase.start, phase.end),
        );
        if (entering) {
          const prevOpacity = opacity[i] ?? 0;
          const nextOpacity = eased > prevOpacity ? eased : prevOpacity;
          opacity[i] = nextOpacity;
          element.setOpacity(nextOpacity);
          const prevScale = scale[i] ?? 1;
          const nextScale = 1 - scaleDelta + scaleDelta * eased;
          const appliedScale = nextScale > prevScale ? nextScale : prevScale;
          scale[i] = appliedScale;
          element.setScale(appliedScale);
        } else {
          const prevOpacity = opacity[i] ?? 1;
          const nextOpacity = 1 - eased;
          const appliedOpacity = nextOpacity < prevOpacity ? nextOpacity : prevOpacity;
          opacity[i] = appliedOpacity;
          element.setOpacity(appliedOpacity);
          const prevScale = scale[i] ?? 1;
          const nextScale = 1 + scaleDelta * eased;
          const appliedScale = nextScale > prevScale ? nextScale : prevScale;
          scale[i] = appliedScale;
          element.setScale(appliedScale);
        }
      }
      return;
    }
    if (typeof bundle.setOpacity === 'function' || typeof bundle.setScale === 'function') {
      const state = this.visualState(bundle, entering, scaleDelta);
      const opacity = state.opacity;
      const scale = state.scale;
      // A single logical element (index 0); no stagger.
      const eased = phase.ease(staggerProgress(0, 1, phase.start, phase.end, t));
      if (entering) {
        const prevOpacity = opacity[0] ?? 0;
        const nextOpacity = eased > prevOpacity ? eased : prevOpacity;
        opacity[0] = nextOpacity;
        bundle.setOpacity?.(nextOpacity);
        const prevScale = scale[0] ?? 1;
        const nextScale = 1 - scaleDelta + scaleDelta * eased;
        const appliedScale = nextScale > prevScale ? nextScale : prevScale;
        scale[0] = appliedScale;
        bundle.setScale?.(appliedScale);
      } else {
        const prevOpacity = opacity[0] ?? 1;
        const nextOpacity = 1 - eased;
        const appliedOpacity = nextOpacity < prevOpacity ? nextOpacity : prevOpacity;
        opacity[0] = appliedOpacity;
        bundle.setOpacity?.(appliedOpacity);
        const prevScale = scale[0] ?? 1;
        const nextScale = 1 + scaleDelta * eased;
        const appliedScale = nextScale > prevScale ? nextScale : prevScale;
        scale[0] = appliedScale;
        bundle.setScale?.(appliedScale);
      }
    }
  }

  /**
   * Per-bundle applied visual state, created lazily on first drive and then
   * persisted across role changes. Initial values depend on the first role a
   * bundle plays: entering content is hidden/underscaled, leaving content is
   * fully visible at identity scale.
   */
  private visualState(bundle: EraContentBundle, entering: boolean, scaleDelta: number): BundleVisualState {
    let state = this.bundleStates.get(bundle);
    if (state === undefined) {
      const count = Math.max(1, bundle.elements?.length ?? 0);
      const opacity = new Float64Array(count);
      const scale = new Float64Array(count);
      if (entering) {
        scale.fill(1 - scaleDelta);
      } else {
        opacity.fill(1);
        scale.fill(1);
      }
      state = { opacity, scale };
      this.bundleStates.set(bundle, state);
    }
    return state;
  }
}