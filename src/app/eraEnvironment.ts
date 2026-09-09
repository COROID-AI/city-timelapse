/**
 * Unified Era Environment for City Time Period Timelapse.
 *
 * Aggregates the six per-system era datasets (buildings, signage, vehicles,
 * pedestrians, atmosphere, and audio) into one typed data record for all
 * five supported years: 1945, 1965, 1985, 2005, 2025.
 *
 * Consumed by sceneApp, transitionDirector, and downstream polish tasks.
 */

import type {
  AudioEraSpec,
  BuildingsEraSpec,
  PedestriansEraSpec,
  VehiclesEraSpec,
} from '../era/types';
import {
  DEFAULT_ERA,
  ERAS,
  type EraId,
  eraToYearNumber,
  isEraId,
} from '../era/years';
import { audioEraData } from '../audio/audioEraData';
import { eraDescriptors, eraSubtitles } from '../ui/eraDescriptors';
import {
  atmosphereEraData,
  type AtmosphereEraDetailedSpec,
} from '../world/systems/atmosphere/atmosphereEraData';
import {
  buildingEraData,
  buildingEraSpecs,
  type BuildingsEraData,
} from '../world/systems/buildings/buildingEraData';
import { pedestrianEraData } from '../world/systems/pedestrians/pedestrianEraData';
import {
  signageEraData,
  type SignageEraSpecData,
} from '../world/systems/signage/signageEraData';
import { vehicleEraData } from '../world/systems/vehicles/vehicleEraData';

/**
 * Aggregated dataset for a single era across all six subsystems.
 */
export interface EraDataSet {
  /** Canonical era identifier ('1945', '1965', '1985', '2005', '2025'). */
  readonly id: EraId;
  /** Numeric year value (e.g. 1945). */
  readonly year: number;
  /** Full descriptive title for the era. */
  readonly descriptor: string;
  /** Short subtitle / theme descriptor. */
  readonly subtitle: string;
  /** Buildings system dataset including architectural specs and roof directives. */
  readonly buildings: BuildingsEraData;
  /** Buildings architectural specification. */
  readonly buildingsSpec: BuildingsEraSpec;
  /** Signage system dataset including curated sign items. */
  readonly signage: SignageEraSpecData;
  /** Vehicles system dataset including traffic speeds and model templates. */
  readonly vehicles: VehiclesEraSpec;
  /** Pedestrians system dataset including crowd densities and outfit specs. */
  readonly pedestrians: PedestriansEraSpec;
  /** Atmosphere system dataset including lighting, fog, and particle styles. */
  readonly atmosphere: AtmosphereEraDetailedSpec;
  /** Audio engine dataset including synth profiles, ambience, and horn types. */
  readonly audio: AudioEraSpec;
}

/** Complete era environment dictionary keyed by EraId. */
export type EraEnvironment = Record<EraId, EraDataSet>;

/**
 * Builds and returns the typed aggregation of all six per-system era datasets
 * for all five eras.
 */
export function buildEraEnvironment(): EraEnvironment {
  const env = {} as Record<EraId, EraDataSet>;

  for (const era of ERAS) {
    env[era] = {
      id: era,
      year: eraToYearNumber(era),
      descriptor: eraDescriptors[era] ?? `Year ${era}`,
      subtitle: eraSubtitles[era] ?? `Era ${era}`,
      buildings: buildingEraData[era],
      buildingsSpec: buildingEraSpecs[era] ?? buildingEraData[era].spec,
      signage: signageEraData[era],
      vehicles: vehicleEraData[era],
      pedestrians: pedestrianEraData[era],
      atmosphere: atmosphereEraData[era],
      audio: audioEraData[era],
    };
  }

  return Object.freeze(env);
}

// Cached singleton instance
let cachedEnvironment: EraEnvironment | null = null;

/**
 * Returns the cached singleton era environment.
 */
export function getEraEnvironment(): EraEnvironment {
  if (!cachedEnvironment) {
    cachedEnvironment = buildEraEnvironment();
  }
  return cachedEnvironment;
}

/**
 * Retrieves the aggregated dataset for a specific era.
 * Falls back to DEFAULT_ERA ('1945') if the era is not recognized.
 */
export function getEraDataSet(era: EraId | string): EraDataSet {
  const env = getEraEnvironment();
  if (isEraId(era)) {
    return env[era];
  }
  return env[DEFAULT_ERA];
}
