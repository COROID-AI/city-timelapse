/**
 * Era variant contract — the shared transform interface every city domain
 * module implements, plus the registry and staged morph driver that feed it.
 *
 * The period must affect all aspects of the city block, which requires one
 * shared era-transform contract: any scene object registers here and receives
 * a continuous era blend while a transition runs. Choreography is expressed
 * through ordered morph stages (facade -> signage -> fleet -> crowd -> lights
 * -> sound); each registered object declares its stage and gets a per-object
 * stage offset plus stage-local progress, so earlier stages visibly move
 * before later ones (facades before crowd).
 *
 * Pure and renderer-free: no GPU or DOM dependencies, fully unit-testable.
 */

import { EraTimelineCore, clamp01, easeInOutCubic } from './timeline';
import type { EraBlend, EraFrame, EraYear } from './timeline';

/**
 * Ordered morph stages the timeline choreographs during a transition.
 * Later stages start after earlier ones, giving the integration owner the
 * required ordering: facades, then signage, then fleet, then crowd, then
 * lights and sound.
 */
export const ERA_MORPH_STAGES = ['facade', 'signage', 'fleet', 'crowd', 'lights', 'sound'] as const;

/** One morph stage an `EraTransformable` belongs to. */
export type EraMorphStage = (typeof ERA_MORPH_STAGES)[number];

/** Index of a stage in the choreography order (unknown stages fall back to 0). */
export function stageIndex(stage: EraMorphStage): number {
  const index = ERA_MORPH_STAGES.indexOf(stage);
  return index === -1 ? 0 : index;
}

/**
 * Where a stage starts within the overall transition, as a 0..1 offset.
 * Stages occupy equal, consecutive windows: facade starts at 0, crowd starts
 * at 3/6 (= 0.5), sound starts at 5/6.
 */
export function stageOffset(stage: EraMorphStage): number {
  return stageIndex(stage) / ERA_MORPH_STAGES.length;
}

/**
 * Stage-local progress for an overall transition progress value.
 *
 * Remaps the global eased progress into the stage's own window (clamped to
 * 0..1) and eases it again so each stage eases in and out within its slot.
 * Earlier stages therefore reach 1 while later stages are still at 0.
 */
export function stageProgress(stage: EraMorphStage, transitionProgress: number): number {
  const count = ERA_MORPH_STAGES.length;
  const start = stageIndex(stage) / count;
  const local = clamp01((clamp01(transitionProgress) - start) * count);
  return easeInOutCubic(local);
}

/**
 * The shared era-transform contract implemented by every domain module.
 *
 * `applyEraBlend` is invoked once per transition frame with:
 * - `blend`: the continuous adjacent-era crossfade for this frame;
 * - `stageOffset`: the object's stage start within the transition (0..1);
 * - `progress`: eased stage-local progress (0..1) for this object's stage.
 */
export interface EraTransformable {
  /** Choreography stage this object belongs to. */
  readonly stage: EraMorphStage;
  /** Apply one transition frame to this object. */
  applyEraBlend(blend: EraBlend, stageOffset: number, progress: number): void;
}

/**
 * Registry every city module registers its transformables into. Members are
 * kept in choreography order (stage order, stable within a stage), and
 * `dispatch` drives every registered object during transition frames.
 */
export interface EraTransformRegistry {
  /** Number of registered objects. */
  readonly size: number;
  /** Registered objects in choreography order (stage order, stable ties). */
  readonly members: readonly EraTransformable[];
  /** Register an object; returns an unregister function. Duplicate registrations are ignored. */
  register(target: EraTransformable): () => void;
  /** Remove an object; returns true when it was registered. */
  unregister(target: EraTransformable): boolean;
  /** Whether an object is currently registered. */
  has(target: EraTransformable): boolean;
  /** Notify every registered object with this frame; returns the dispatch count. */
  dispatch(blend: EraBlend, transitionProgress: number): number;
  /** Remove every registered object. */
  clear(): void;
}

/** Registry implementation: insertion-ordered within each choreography stage. */
class EraTransformRegistryImpl implements EraTransformRegistry {
  readonly #targets: EraTransformable[] = [];

  get size(): number {
    return this.#targets.length;
  }

  get members(): readonly EraTransformable[] {
    return this.#targets;
  }

  register(target: EraTransformable): () => void {
    if (!this.#targets.includes(target)) {
      const order = stageIndex(target.stage);
      let index = this.#targets.length;
      while (index > 0 && stageIndex(this.#targets[index - 1].stage) > order) index -= 1;
      this.#targets.splice(index, 0, target);
    }
    return () => {
      this.unregister(target);
    };
  }

  unregister(target: EraTransformable): boolean {
    const index = this.#targets.indexOf(target);
    if (index === -1) return false;
    this.#targets.splice(index, 1);
    return true;
  }

  has(target: EraTransformable): boolean {
    return this.#targets.includes(target);
  }

  dispatch(blend: EraBlend, transitionProgress: number): number {
    const progress = clamp01(transitionProgress);
    for (const target of this.#targets) {
      target.applyEraBlend(blend, stageOffset(target.stage), stageProgress(target.stage, progress));
    }
    return this.#targets.length;
  }

  clear(): void {
    this.#targets.length = 0;
  }
}

/** Create an empty era-transform registry. */
export function createEraTransformRegistry(): EraTransformRegistry {
  return new EraTransformRegistryImpl();
}

/**
 * Morph driver: composes the timeline's eased transition driver with the
 * registry so every registered object is driven every frame of a transition.
 *
 * A transition dispatches an initial frame at progress 0, one frame per
 * `advance` tick while active (including the final frame at progress 1), and
 * nothing once idle.
 */
export class EraMorphDriver {
  constructor(
    readonly core: EraTimelineCore,
    readonly registry: EraTransformRegistry,
  ) {}

  /** True while the underlying transition is still running. */
  get isTransitioning(): boolean {
    return this.core.isTransitioning;
  }

  /**
   * Start an ease-in-out transition of the timeline (and every registered
   * object) to the era stop nearest `year`, over a clamped 1..2 seconds.
   * Dispatches the starting frame immediately so objects sync before the
   * first tick. Returns the snapped target year.
   */
  transitionTo(year: number, durationSeconds?: number): EraYear {
    const target = this.core.transitionTo(year, durationSeconds);
    if (this.core.isTransitioning) {
      const frame = this.core.frame();
      this.registry.dispatch(frame.blend, frame.progress);
    }
    return target;
  }

  /** Advance the transition and drive every registered object with the frame. */
  advance(deltaSeconds: number): EraFrame {
    const wasTransitioning = this.core.isTransitioning;
    const frame = this.core.advance(deltaSeconds);
    if (wasTransitioning) {
      this.registry.dispatch(frame.blend, frame.progress);
    }
    return frame;
  }

  /**
   * Immediately dispatch the current frame to every registered object —
   * useful right after bulk registration so new objects sync to the current
   * era without waiting for the next transition.
   */
  sync(): number {
    const frame = this.core.frame();
    return this.registry.dispatch(frame.blend, frame.progress);
  }
}

/** A wired timeline + registry + morph driver, ready for integration. */
export interface EraMorphSystem {
  readonly core: EraTimelineCore;
  readonly registry: EraTransformRegistry;
  readonly driver: EraMorphDriver;
}

/**
 * Convenience factory used by the integration owner: a fresh timeline core,
 * an empty registry, and a morph driver wiring the two together.
 */
export function createEraMorphSystem(): EraMorphSystem {
  const core = new EraTimelineCore();
  const registry = createEraTransformRegistry();
  return { core, registry, driver: new EraMorphDriver(core, registry) };
}
