/**
 * Era payloads: one ready-to-use record per period of the timeline.
 *
 * The content layers each resolve their own period data from the era registry,
 * but the composition needs a single, resolved description of "what period is on
 * screen" for three jobs:
 *
 * 1. **Audio.** The ambience bed the audio engine crossfades to is derived from
 *    the era's soundscape, so the payload carries both the registry record and
 *    the translated {@link SoundscapeDescriptor} (`bedId` is the era's own
 *    `soundscape.descriptor`, e.g. `1945-home-front`).
 * 2. **The debug surface.** Automated verification compares the year readout and
 *    the per-layer statistics against the selected era; the payload is that
 *    comparison's left-hand side.
 * 3. **Inspection metadata.** Every published inspection target carries the era
 *    id and year of the period it was resolved for.
 *
 * Nothing here is a second source of truth: every field is read from the shipped
 * era registry (or built by the shipped transition adapter), and the module is
 * pure, so resolving the same era twice yields an identical payload.
 */

import type { SoundscapeDescriptor } from '../audio'
import { getSoundscape, ERA_REGISTRY } from '../era'
import type { EraDefinition, EraId, EraRegistry, EraSoundscape } from '../era'
import { resolveQualityTier } from '../lib/quality'
import type { QualityTierName } from '../lib/quality'
import { soundscapeToBedDescriptor } from '../transition'

/**
 * Sun elevation (degrees) at which an era counts as a night scene.
 *
 * The vehicle and storefront layers use the same threshold for their lighting
 * behaviour, so the payload's `night` flag agrees with what the block renders.
 */
export const NIGHT_SUN_ELEVATION_DEG = 0

/** Everything the composition resolves for one period of the timeline. */
export interface EraPayload {
  readonly eraId: EraId
  readonly year: number
  readonly shortLabel: string
  readonly label: string
  readonly summary: string
  /** Era seed: the era's own procedural seed, used to fork layer content. */
  readonly seed: string
  /** True when the era's key light sits at or below the horizon. */
  readonly night: boolean
  readonly qualityTier: QualityTierName
  /** Registry soundscape record, as authored. */
  readonly soundscape: EraSoundscape
  /** Ambience bed the audio engine renders for this era. */
  readonly bed: SoundscapeDescriptor
  /** `soundscape.descriptor`; the identifier the debug surface reports. */
  readonly bedId: string
  /** Ids of the looping cues that become bed layers. */
  readonly loopCueIds: readonly string[]
  /** Ids of the one-shot cues the transition director may fire. */
  readonly eventCueIds: readonly string[]
  /** Every cue id of the era, looping first, in registry order. */
  readonly cueIds: readonly string[]
  /** Registry traffic data. */
  readonly vehicleEraTag: string
  readonly trafficDensity: number
  readonly laneCount: number
  readonly parkedRatio: number
  readonly averageSpeedMps: number
  readonly hornProbability: number
  readonly vehicleModelKeys: readonly string[]
  /** Registry population data. */
  readonly outfitEraTag: string
  readonly pedestrianDensity: number
  readonly pedestrianSpeedMps: number
  readonly childRatio: number
  readonly outfitPalette: readonly string[]
  /** Content vocabulary later layers key their catalogues off. */
  readonly buildingTags: readonly string[]
  readonly storefrontTags: readonly string[]
  readonly signageTags: readonly string[]
  readonly advertisementTags: readonly string[]
  readonly propTags: readonly string[]
  /** Palette of the period, for reports and screenshots. */
  readonly palette: EraDefinition['palette']
}

/** Options accepted by {@link resolveEraPayload}. */
export interface EraPayloadOptions {
  readonly qualityTier?: QualityTierName
  /** Registry supplying the records; defaults to the shipped table. */
  readonly registry?: EraRegistry
}

/** True when an era's key light is at or below the horizon. */
export function isNightEra(era: EraDefinition): boolean {
  return era.lighting.sunElevationDeg <= NIGHT_SUN_ELEVATION_DEG
}

/**
 * Resolves one era into the payload the composition works with.
 *
 * The bed descriptor comes from the shipped transition adapter, so the ambience
 * the audio engine plays for `eraId` is exactly what the director would
 * crossfade to — there is only one translation in the project.
 */
export function resolveEraPayload(eraId: EraId, options: EraPayloadOptions = {}): EraPayload {
  const registry = options.registry ?? ERA_REGISTRY
  const era = registry.get(eraId)
  const soundscape = getSoundscape(era.id)
  const qualityTier = resolveQualityTier(options.qualityTier).name
  const cues = soundscape.cues
  const looping = cues.filter((cue) => cue.loop)
  const events = cues.filter((cue) => !cue.loop)

  return {
    eraId: era.id,
    year: era.year,
    shortLabel: era.shortLabel,
    label: era.label,
    summary: era.summary,
    seed: era.seed,
    night: isNightEra(era),
    qualityTier,
    soundscape,
    bed: soundscapeToBedDescriptor(soundscape),
    bedId: soundscape.descriptor,
    loopCueIds: looping.map((cue) => cue.id),
    eventCueIds: events.map((cue) => cue.id),
    cueIds: [...looping, ...events].map((cue) => cue.id),
    vehicleEraTag: era.traffic.vehicleEraTag,
    trafficDensity: era.traffic.trafficDensity,
    laneCount: era.traffic.laneCount,
    parkedRatio: era.traffic.parkedRatio,
    averageSpeedMps: era.traffic.averageSpeedMps,
    hornProbability: era.traffic.hornProbability,
    vehicleModelKeys: era.traffic.modelKeys,
    outfitEraTag: era.population.outfitEraTag,
    pedestrianDensity: era.population.pedestrianDensity,
    pedestrianSpeedMps: era.population.averageSpeedMps,
    childRatio: era.population.childRatio,
    outfitPalette: era.population.outfitPalette,
    buildingTags: era.contentTags.buildings,
    storefrontTags: era.contentTags.storefronts,
    signageTags: era.contentTags.signage,
    advertisementTags: era.contentTags.advertisements,
    propTags: era.contentTags.props,
    palette: era.palette,
  }
}

/** Resolves every era of the registry, in timeline order. */
export function resolveEraPayloads(options: EraPayloadOptions = {}): readonly EraPayload[] {
  const registry = options.registry ?? ERA_REGISTRY
  return registry.ids.map((eraId) => resolveEraPayload(eraId, options))
}

/** The payload of one era inside an already resolved list. */
export function findEraPayload(
  payloads: readonly EraPayload[],
  eraId: EraId,
): EraPayload | undefined {
  return payloads.find((payload) => payload.eraId === eraId)
}

/**
 * Deterministic signature of a payload.
 *
 * Two payloads with the same signature describe the same period, the same
 * ambience bed and the same sound programme, which is what the composition's
 * "the block really switched" assertions compare.
 */
export function eraPayloadSignature(payload: EraPayload): string {
  const cues = payload.cueIds.length === 0 ? 'none' : payload.cueIds.join('+')
  return [
    payload.eraId,
    String(payload.year),
    payload.bedId,
    cues,
    payload.night ? 'night' : 'day',
    `traffic:${payload.trafficDensity.toFixed(3)}`,
    `crowd:${payload.pedestrianDensity.toFixed(3)}`,
  ].join(':')
}

