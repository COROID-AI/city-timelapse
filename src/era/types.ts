/**
 * Serialisable era data model.
 *
 * One {@link EraDefinition} carries every knob the rest of the plan reads for a
 * period: colours, sky and lighting, haze and colour grade, soundscape,
 * traffic, pedestrians and the signage/advertising vocabulary. A single record
 * therefore describes a whole era, so a future era is one more record in
 * `eras.ts` rather than a branch inside a content generator.
 *
 * Every field is a plain, `JSON.stringify`-safe value (numbers, strings, arrays
 * and nested plain objects) so QA can snapshot, diff and hash whole eras.
 */

import type { EraId } from './eraIds'

/** `#rrggbb` colour string, the shared currency of palettes and lighting. */
export type HexColor = string

/** Linear RGB triple used by colour-grade uniforms and filter matrices. */
export type ColourChannel = readonly [number, number, number]

/** Weather kinds the atmosphere layer can request for one era. */
export type PrecipitationKind = 'none' | 'drizzle' | 'rain' | 'snow'

/** Layer a soundscape cue belongs to; the audio engine mixes per layer. */
export type SoundscapeCueLayer =
  | 'ambience'
  | 'engine'
  | 'human'
  | 'machine'
  | 'music'
  | 'weather'
  | 'signature'

/** Surface and material colours of one era. */
export interface EraPalette {
  /** Default colour of massed building volumes. */
  readonly buildingBase: HexColor
  /** Secondary block colour for panels, cornices and infill. */
  readonly buildingAccent: HexColor
  /** Stone/metal trim colour for window surrounds, sills and door frames. */
  readonly facadeTrim: HexColor
  /** Window glass tint, used for opaque and reflective glass alike. */
  readonly windowGlass: HexColor
  /** Asphalt or flagstone surface of the roadway. */
  readonly roadSurface: HexColor
  /** Painted lane markings, crossings and kerb lines. */
  readonly roadMarking: HexColor
  /** Pavement slabs the pedestrians walk on. */
  readonly sidewalk: HexColor
  /** Storefront body: shopfront joinery, canopies and pilasters. */
  readonly storefrontBody: HexColor
  /** Signage panel colour, the base for period sign textures. */
  readonly storefrontSign: HexColor
  /** Street furniture: lamps, hydrants, benches, bins and bollards. */
  readonly streetFurniture: HexColor
  /** Era accent used for highlight details such as awnings and ad frames. */
  readonly accent: HexColor
}

/** Sun, sky and artificial-light values of one era. */
export interface EraLighting {
  /** Hero time of day in 24h decimal hours, e.g. `16.6` for 16:36. */
  readonly timeOfDayHours: number
  /** Compass azimuth of the key light in degrees, 0 = north, clockwise. */
  readonly sunAzimuthDeg: number
  /** Elevation of the key light above the horizon in degrees; negative at night. */
  readonly sunElevationDeg: number
  /** Colour of the key light. */
  readonly sunColor: HexColor
  /** Intensity of the key light. */
  readonly sunIntensity: number
  /** Zenith colour of the gradient sky. */
  readonly skyTopColor: HexColor
  /** Horizon colour of the gradient sky, where it meets the haze band. */
  readonly skyHorizonColor: HexColor
  /** Colour of the ambient fill light. */
  readonly ambientColor: HexColor
  /** Intensity of the ambient fill light. */
  readonly ambientIntensity: number
  /** Intensity of the sky/ground hemisphere fill. */
  readonly hemisphereIntensity: number
  /** Colour of street lamps, neon and window glow. */
  readonly artificialLightColor: HexColor
  /** Strength of artificial lights: near 0 by day, above 1 for a night city. */
  readonly artificialLightIntensity: number
  /** Tone-mapping exposure multiplier for the era. */
  readonly exposure: number
  /** Shadow penumbra: 0 = razor sharp, 1 = fully soft. */
  readonly shadowSoftness: number
}

/** Primary colour correction of one era, applied by the post chain. */
export interface EraColourGrade {
  /** Shadow lift per channel. */
  readonly lift: ColourChannel
  /** Midtone gamma per channel. */
  readonly gamma: ColourChannel
  /** Highlight gain per channel. */
  readonly gain: ColourChannel
  /** Saturation multiplier, 1 = untouched. */
  readonly saturation: number
  /** Contrast multiplier, 1 = untouched. */
  readonly contrast: number
  /** Warm/cool balance: -1 = cool blue, +1 = warm amber. */
  readonly temperature: number
  /** Green/magenta balance: -1 = green, +1 = magenta. */
  readonly tint: number
  /** Corner darkening, 0 = none. */
  readonly vignette: number
  /** Film grain: 0 = clean digital, 1 = heavy period emulsion. */
  readonly grain: number
  /** Bloom strength, used for neon, chrome and wet asphalt. */
  readonly bloomIntensity: number
  /** Luminance above which bloom starts. */
  readonly bloomThreshold: number
}

/** Haze, weather and grading of one era's air. */
export interface EraAtmosphere {
  /** Colour of the haze/fog the city recedes into. */
  readonly hazeColor: HexColor
  /** Exponential fog density; higher means the block dissolves sooner. */
  readonly hazeDensity: number
  /** How quickly haze thins with height; higher = ground-hugging smog. */
  readonly hazeHeightFalloff: number
  /** Sky coverage: 0 = clear, 1 = fully overcast. */
  readonly cloudCover: number
  /** Weather the era's default scene plays in. */
  readonly precipitation: PrecipitationKind
  /** Rain/snow strength: 0 = dry, 1 = downpour. */
  readonly precipitationIntensity: number
  /** Ambient particle density: coal smoke, smog, dust, steam or pollen. */
  readonly particleDensity: number
  /** Wind speed in m/s; drives smoke drift, flags, litter and rain slant. */
  readonly windSpeedMps: number
  /** Primary colour correction of the era. */
  readonly colourGrade: EraColourGrade
}

/** One looping bed or one-shot event of an era's soundscape. */
export interface EraSoundscapeCue {
  /** Stable cue id the audio engine maps to a baked or synthesised layer. */
  readonly id: string
  /** Display name for the audio debug panel. */
  readonly label: string
  /** Layer the cue is mixed into. */
  readonly layer: SoundscapeCueLayer
  /** Linear gain of the cue inside its layer, 0..1. */
  readonly gain: number
  /** Looping bed (true) or one-shot event (false). */
  readonly loop: boolean
  /** Earliest repeat of the cue, in seconds of scene time. */
  readonly minIntervalSec: number
  /** Latest repeat of the cue, in seconds of scene time. */
  readonly maxIntervalSec: number
}

/** Soundscape descriptor of one era. */
export interface EraSoundscape {
  /** Stable descriptor id such as `1945-home-front`, safe as a map key. */
  readonly descriptor: string
  /** Display name of the era's sonic identity. */
  readonly label: string
  /** Gain of the ambient bed. */
  readonly ambienceGain: number
  /** Gain of the era's music bed. */
  readonly musicGain: number
  /** Base tempo of era music and rhythmic machinery, in BPM. */
  readonly tempoBpm: number
  /** Musical key of the era's score, e.g. `D minor`. */
  readonly key: string
  /** Reverb tail length in seconds; larger period rooms ring longer. */
  readonly reverbDecaySec: number
  /** Cues the era's soundscape is built from. */
  readonly cues: readonly EraSoundscapeCue[]
}

/** Vehicle behaviour and vehicle-era tag of one era. */
export interface EraTraffic {
  /** Era tag the vehicle layer keys its models off. */
  readonly vehicleEraTag: string
  /** Traffic density: 0 = empty wartime street, 1 = gridlock. */
  readonly trafficDensity: number
  /** Mean cruising speed in m/s; drives animation and motion blur. */
  readonly averageSpeedMps: number
  /** Drivable lanes across the block, including parking lanes. */
  readonly laneCount: number
  /** Fraction of vehicles parked at the kerb instead of driving. */
  readonly parkedRatio: number
  /** Head/tail light strength: 0 in daylight, 1 for full night beams. */
  readonly headlightIntensity: number
  /** Chance a moving vehicle sounds its horn per second of congestion. */
  readonly hornProbability: number
  /** Vehicle models the vehicle layer must be able to render. */
  readonly modelKeys: readonly string[]
}

/** Pedestrian behaviour and outfit-era tag of one era. */
export interface EraPopulation {
  /** Era tag the pedestrian layer keys its outfits off. */
  readonly outfitEraTag: string
  /** Pedestrian density: 0 = deserted, 1 = packed pavement. */
  readonly pedestrianDensity: number
  /** Mean walking speed in m/s. */
  readonly averageSpeedMps: number
  /** Inclusive group size people are spawned in. */
  readonly groupSizeRange: readonly [number, number]
  /** Fraction of the crowd that is children. */
  readonly childRatio: number
  /** Outfit colours of the era, used to tint garments and accessories. */
  readonly outfitPalette: readonly HexColor[]
  /** Outfit models the pedestrian layer must be able to render. */
  readonly modelKeys: readonly string[]
}

/** Per-era vocabulary for signage, advertising, storefronts, buildings and props. */
export interface EraContentTags {
  /** Signage vocabulary: lettering, materials and sign technologies. */
  readonly signage: readonly string[]
  /** Advertisement campaigns and board styles of the period. */
  readonly advertisements: readonly string[]
  /** Storefront types the block should feature. */
  readonly storefronts: readonly string[]
  /** Building archetypes of the period. */
  readonly buildings: readonly string[]
  /** Street props and small objects of the period. */
  readonly props: readonly string[]
}

/** Everything the rest of the project knows about one time period. */
export interface EraDefinition {
  /** Stable era id; also the registry key and the timeline slider value. */
  readonly id: EraId
  /** Calendar year the era represents. */
  readonly year: number
  /** Slider label, e.g. `1945`. */
  readonly shortLabel: string
  /** Display name of the period, e.g. `Postwar Recovery`. */
  readonly label: string
  /** One-sentence description for captions and tooltips. */
  readonly summary: string
  /** Seed that makes the era's procedural content reproducible and unique. */
  readonly seed: string
  /** Surface and material colours. */
  readonly palette: EraPalette
  /** Sun, sky and artificial-light values. */
  readonly lighting: EraLighting
  /** Haze, weather and colour grade. */
  readonly atmosphere: EraAtmosphere
  /** Soundscape descriptor the audio engine plays. */
  readonly soundscape: EraSoundscape
  /** Vehicle behaviour and vehicle-era tag. */
  readonly traffic: EraTraffic
  /** Pedestrian behaviour and outfit-era tag. */
  readonly population: EraPopulation
  /** Signage, advertising, storefront, building and prop vocabulary. */
  readonly contentTags: EraContentTags
}

/**
 * Snapshot of the timeline's blend between two eras.
 *
 * `progress` runs from 0 (render `fromEra` only) to 1 (render `toEra` only).
 * While `fromEra === toEra` the store is settled and `progress` is 0.
 */
export interface TransitionState {
  /** Era the user selected; always equal to `toEra`. */
  readonly selectedEra: EraId
  /** Era the blend starts from: the previous selection, or `toEra` when settled. */
  readonly fromEra: EraId
  /** Era the blend moves towards. */
  readonly toEra: EraId
  /** Blend weight in the closed interval 0..1. */
  readonly progress: number
  /** True while the pair spans two different eras, i.e. a blend is in flight. */
  readonly isTransitioning: boolean
}
