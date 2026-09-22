/**
 * Staged era-morph choreography for the composed city block.
 *
 * This module is the ONE configurable place for the block's morph order:
 *
 *   facades → signage → fleet → crowd → lights → sound
 *
 * The order mirrors `ERA_MORPH_STAGES` in the shared era contract (the
 * contract owns the math — `stageOffset`/`stageProgress` — while this config
 * owns the block-level description of who moves when), and
 * `auditChoreography` fails loudly if the two ever diverge.
 *
 * Each step declares how it receives era frames:
 * - `registry`: the `EraMorphDriver` dispatches every transition frame to all
 *   registered `EraTransformable`s in this stage (buildings, storefront
 *   signage, the traffic fleet, the crowd, atmosphere lights…);
 * - `timeline-core`: the step is advanced by a direct subscriber of the shared
 *   `EraTimelineCore`. The `sound` stage is owned by the audio director,
 *   which subscribes to the core itself, so the full six-step order still
 *   lives here even though no registry member can claim it.
 *
 * `createStagedEraPump` is the shared per-frame driver used by the app and
 * the composition test: it advances the morph driver during animated
 * transitions, and additionally dispatches when the slider is dragged (or a
 * year snaps) without an animation, so the scene always tracks what the
 * timeline shows.
 */

import {
  ERA_MORPH_STAGES,
  stageIndex,
  stageOffset,
  type EraMorphStage,
  type EraMorphSystem,
  type EraTransformRegistry,
} from '../era/contracts';
import type { EraBlend, EraFrame } from '../era/timeline';

/** One step of the block's staged morph choreography. */
export interface MorphStageStep {
  /** Choreography stage from the shared era contract. */
  readonly stage: EraMorphStage;
  /** Human-readable step name (facades, signage, fleet, crowd, lights, sound). */
  readonly label: string;
  /** What visibly happens during this step. */
  readonly summary: string;
  /** How the step receives era frames. */
  readonly driver: 'registry' | 'timeline-core';
}

/**
 * The block's choreography, in order. Edit here to re-order or re-label the
 * staged morph; the contract math and every module follow automatically via
 * `EraMorphStage`, and `auditChoreography` verifies this list stays in sync
 * with `ERA_MORPH_STAGES`.
 */
export const CITY_MORPH_CHOREOGRAPHY: readonly MorphStageStep[] = Object.freeze([
  {
    stage: 'facade',
    label: 'Facades',
    summary: 'Building skins, massing, windows, and roadway surfacing lead the morph.',
    driver: 'registry',
  },
  {
    stage: 'signage',
    label: 'Signage',
    summary: 'Storefront fascia signs, blade signs, posters, billboards, and kiosks follow.',
    driver: 'registry',
  },
  {
    stage: 'fleet',
    label: 'Fleet',
    summary: 'The vehicle fleet and street furniture swap to the era’s models.',
    driver: 'registry',
  },
  {
    stage: 'crowd',
    label: 'Crowd',
    summary: 'Pedestrian outfits, props, and silhouettes catch up next.',
    driver: 'registry',
  },
  {
    stage: 'lights',
    label: 'Lights',
    summary: 'Sky, sun, fog, street lamps, and emissive glow settle after the crowd.',
    driver: 'registry',
  },
  {
    stage: 'sound',
    label: 'Sound',
    summary: 'The era soundscape crossfades last, driven by the audio director’s core subscription.',
    driver: 'timeline-core',
  },
]);

/** The configured stages, in choreography order. */
export function choreographyStages(): readonly EraMorphStage[] {
  return CITY_MORPH_CHOREOGRAPHY.map((step) => step.stage);
}

/** Stages advanced through the shared `EraTransformRegistry`. */
export function registryDrivenStages(): readonly EraMorphStage[] {
  return CITY_MORPH_CHOREOGRAPHY.filter((step) => step.driver === 'registry').map(
    (step) => step.stage,
  );
}

/** Label for a stage (`Unknown stage` for anything unconfigured). */
export function stageLabel(stage: EraMorphStage): string {
  const step = CITY_MORPH_CHOREOGRAPHY.find((candidate) => candidate.stage === stage);
  return step ? step.label : `Unknown stage (${stage})`;
}

/**
 * Where a stage runs inside one transition, as `{ start, end }` fractions of
 * the overall progress. Equal consecutive windows: facade 0..1/6, signage
 * 1/6..2/6, … sound 5/6..1.
 */
export function stageWindow(stage: EraMorphStage): { start: number; end: number } {
  const start = stageOffset(stage);
  const index = stageIndex(stage);
  return { start, end: (index + 1) / ERA_MORPH_STAGES.length };
}

/** Per-stage registry member counts plus diagnostics. */
export interface ChoreographyAudit {
  /** Configured steps with the live registry member count for each stage. */
  readonly steps: readonly (MorphStageStep & { readonly memberCount: number })[];
  /** True when `CITY_MORPH_CHOREOGRAPHY` order equals `ERA_MORPH_STAGES`. */
  readonly orderMatchesContract: boolean;
  /** Registry-driven stages that currently have zero registered members. */
  readonly missingRegistryStages: readonly EraMorphStage[];
  /** Human-readable violations (config/contract drift, member mis-ordering). */
  readonly orderViolations: readonly string[];
  /** True when the composed registry is complete and correctly ordered. */
  readonly ok: boolean;
}

/**
 * Audit the choreography configuration against a live registry: every
 * registry-driven stage must have members, members must sit in stage order,
 * and the config order must match the shared contract.
 */
export function auditChoreography(
  registry: EraTransformRegistry,
  config: readonly MorphStageStep[] = CITY_MORPH_CHOREOGRAPHY,
): ChoreographyAudit {
  const counts = new Map<EraMorphStage, number>();
  for (const stage of ERA_MORPH_STAGES) counts.set(stage, 0);
  for (const member of registry.members) {
    counts.set(member.stage, (counts.get(member.stage) ?? 0) + 1);
  }

  const configStages = config.map((step) => step.stage);
  const orderMatchesContract =
    configStages.length === ERA_MORPH_STAGES.length &&
    configStages.every((stage, index) => stage === ERA_MORPH_STAGES[index]);

  const orderViolations: string[] = [];
  if (!orderMatchesContract) {
    orderViolations.push(
      `CITY_MORPH_CHOREOGRAPHY [${configStages.join(' → ')}] diverges from ` +
        `ERA_MORPH_STAGES [${ERA_MORPH_STAGES.join(' → ')}]`,
    );
  }
  let previous = -1;
  let previousStage: EraMorphStage | 'none' = 'none';
  for (const member of registry.members) {
    const index = stageIndex(member.stage);
    if (index < previous) {
      orderViolations.push(
        `registry member stage "${member.stage}" appears after "${previousStage}"`,
      );
    }
    previous = index;
    previousStage = member.stage;
  }

  const missingRegistryStages = config
    .filter((step) => step.driver === 'registry' && (counts.get(step.stage) ?? 0) === 0)
    .map((step) => step.stage);

  return {
    steps: config.map((step) => ({ ...step, memberCount: counts.get(step.stage) ?? 0 })),
    orderMatchesContract,
    missingRegistryStages,
    orderViolations,
    ok: orderViolations.length === 0 && missingRegistryStages.length === 0,
  };
}

/** Per-frame era pump shared by the app loop and the composition test. */
export interface StagedEraPump {
  /**
   * Advance the timeline by `deltaSeconds` and dispatch the resulting frame:
   * during an animated transition the morph driver dispatches (staged stage
   * progress); when the slider moved without an animation (drag, snap, or
   * programmatic select) the settled frame dispatches so the scene tracks the
   * slider WYSIWYG. Returns the timeline frame for HUD repaints.
   */
  advance(deltaSeconds: number): EraFrame;
  /** Immediately dispatch the current frame to every member; returns count. */
  sync(): number;
}

/**
 * Create the shared staged era pump for a wired morph system. One dispatch at
 * most per `advance` call; idle frames with an unchanged position dispatch
 * nothing.
 */
export function createStagedEraPump(system: EraMorphSystem): StagedEraPump {
  const { core, registry, driver } = system;
  let lastPosition = core.position;

  return {
    advance(deltaSeconds: number): EraFrame {
      const wasTransitioning = core.isTransitioning;
      const frame = driver.advance(deltaSeconds); // dispatches iff transitioning
      const moved = frame.position !== lastPosition;
      lastPosition = frame.position;
      if (!wasTransitioning && moved) {
        // Manual scrub or snap: idle progress is 1, which opens every stage
        // window, so the whole scene resolves to the slider's blend.
        registry.dispatch(frame.blend, frame.progress);
      }
      return frame;
    },
    sync(): number {
      lastPosition = core.position;
      return driver.sync();
    },
  };
}

/** The blend shape used by diagnostics (`EraBlend` re-exported for tests). */
export type ChoreographyBlend = EraBlend;
