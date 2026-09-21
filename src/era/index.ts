/**
 * Public surface of the era model.
 *
 * Content layers, the timeline UI, the transition director and the audio engine
 * all import from `src/era`, never from the individual modules, so the contract
 * has exactly one entry point:
 *
 * ```ts
 * import { ERA_DEFINITIONS, getEra, getNextEra, type EraDefinition, type EraId } from '../era'
 * ```
 *
 * The module stays dependency-light (no three.js, no React, no layer imports)
 * so any content layer can consume it without creating an import cycle.
 */

export {
  DEFAULT_ERA_ID,
  ERA_COUNT,
  ERA_IDS,
  ERA_YEARS,
  ERA_YEAR_BY_ID,
  LATEST_ERA_ID,
  UnknownEraIdError,
  eraIdAt,
  eraIdIndex,
  isEraId,
  offsetEraId,
  requireEraId,
  resolveEraId,
} from './eraIds'
export type { EraId, EraYear } from './eraIds'

export type {
  ColourChannel,
  EraAtmosphere,
  EraColourGrade,
  EraContentTags,
  EraDefinition,
  EraLighting,
  EraPalette,
  EraPopulation,
  EraSoundscape,
  EraSoundscapeCue,
  EraTraffic,
  HexColor,
  PrecipitationKind,
  SoundscapeCueLayer,
  TransitionState,
} from './types'

export { ERA_RECORDS } from './eras'

export {
  ERA_DEFINITIONS,
  ERA_ID_ORDER,
  ERA_REGISTRY,
  ERA_YEAR_ORDER,
  createEraRegistry,
  findEra,
  findEraByYear,
  getEra,
  getEraAtOffset,
  getEraIndex,
  getNeighbouringEras,
  getNextEra,
  getPreviousEra,
  isFirstEra,
  isKnownEraId,
  isLastEra,
} from './registry'
export type { EraRegistry } from './registry'

export { ERA_SOUNDSCAPES, getSoundscape } from './soundscape'
