/**
 * Era street furniture producer: the complete ground + furniture layer for
 * one era, composed from the street, lamps, props, greenery and atmosphere
 * submodules and placed on the real BlockLayout anchors.
 *
 * `buildStreetFurniture(era)` is the single entry point scene-integration
 * consumes. All output is pure procedural data — deterministic for a given
 * seed — and the atmosphere preset is applied downstream only through
 * SceneEngine's public atmosphere hooks.
 *
 * Submodules:
 * - street.ts     asphalt, lane/crosswalk markings, drains, manholes, curbs
 * - lamps.ts      era lamp posts (incandescent globe → LED)
 * - props.ts      traffic lights, hydrants, benches, booths, bins, litter
 * - greenery.ts   era tree stock, branches and leaf clumps
 * - atmosphere.ts sky/fog/sun presets derived from the EraTheme palette
 */

import type { EraId } from '../../era/types';
import { ERA_YEARS } from '../../era/types';
import type { BlockLayout } from '../layout';
import { createBlockLayout } from '../layout';
import type { AtmospherePreset } from '../../core/lighting';
import type {
  StreetSurfaceResult,
} from './street';
import { buildStreetSurface } from './street';
import type { LampPostResult } from './lamps';
import { buildLampPosts } from './lamps';
import type {
  BenchResult,
  BoothResult,
  FurniturePropsResult,
  HydrantResult,
  LitterResult,
  MailboxResult,
  TrafficLightResult,
  TrashBinResult,
} from './props';
import { buildFurnitureProps } from './props';
import type { TreeResult } from './greenery';
import { buildTrees } from './greenery';
import { buildAtmospherePreset } from './atmosphere';

/** Options controlling one furniture build. */
export interface StreetFurnitureOptions {
  /**
   * Master RNG seed. Defaults to a stable per-era value, so every era is
   * deterministic out of the box; identical seeds produce identical output.
   */
  seed?: number;
  /** Optional pre-built layout (defaults to `createBlockLayout(seed)`). */
  layout?: BlockLayout;
}

/** The complete per-era street furniture + atmosphere result. */
export interface EraStreetFurniture {
  era: EraId;
  seed: number;
  /** The shared layout every anchor and surface references. */
  layout: BlockLayout;
  /** Engine-ready atmosphere preset (sky/fog/sun/ambient). */
  atmosphere: AtmospherePreset;
  /** Asphalt, markings, drains/manholes, sidewalks and curbs. */
  ground: StreetSurfaceResult;
  lamps: LampPostResult[];
  trafficLights: TrafficLightResult[];
  hydrants: HydrantResult[];
  benches: BenchResult[];
  booths: BoothResult[];
  bins: TrashBinResult[];
  mailboxes: MailboxResult[];
  trees: TreeResult[];
  litter: LitterResult;
}

function defaultSeedFor(era: EraId): number {
  return era * 1000 + 7;
}

/**
 * Build the complete per-era street furniture and atmosphere layer.
 *
 * - validates the era against `ERA_YEARS`,
 * - creates the deterministic layout (unless one is injected),
 * - runs every submodule against the real `BlockLayout` anchors,
 * - returns the engine-ready atmosphere preset.
 *
 * Calling with the same seed (or default seed for the same era) returns
 * structurally identical output.
 */
export function buildStreetFurniture(era: EraId, options: StreetFurnitureOptions = {}): EraStreetFurniture {
  if (!ERA_YEARS.includes(era)) {
    throw new Error(`buildStreetFurniture: unknown era ${String(era)}; expected one of ${ERA_YEARS.join(', ')}`);
  }
  const seed = options.seed ?? defaultSeedFor(era);
  const layout = options.layout ?? createBlockLayout(seed);
  const props: FurniturePropsResult = buildFurnitureProps(layout, era, seed);
  const atmosphere = buildAtmospherePreset(era);

  return {
    era,
    seed,
    layout,
    atmosphere: atmosphere.preset,
    ground: buildStreetSurface(layout, era, seed),
    lamps: buildLampPosts(layout, era, seed),
    trafficLights: props.trafficLights,
    hydrants: props.hydrants,
    benches: props.benches,
    booths: props.booths,
    bins: props.bins,
    mailboxes: props.mailboxes,
    trees: buildTrees(layout, era, seed),
    litter: props.litter,
  };
}