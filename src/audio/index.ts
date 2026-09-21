/**
 * Public surface of the era-agnostic audio module.
 *
 * Consumers (the transition director, the composition and the era registry)
 * need exactly three things: the engine factory, the descriptor/one-shot types
 * they build records from, and the validators that keep a bad record from
 * failing silently. Internal wiring — beds, patches, node graphs — stays
 * private to this folder.
 *
 * ```ts
 * const audio = createAudioEngine()
 * // from a user gesture:
 * await audio.unlock()
 * audio.crossfadeBeds(eraRegistry['1965'].soundscape, 2.5)
 * audio.playOneShot('streetcar-bell', { pan: -0.4 })
 * // on unmount:
 * audio.dispose()
 * ```
 */

export { createAudioEngine } from './engine'

export {
  BUS_LABELS,
  BUS_NAMES,
  DESCRIPTOR_LIMITS,
  FILTER_TYPES,
  NOISE_COLORS,
  ONE_SHOT_ALIASES,
  ONE_SHOT_IDS,
  OSCILLATOR_WAVEFORMS,
  SOUNDSCAPE_FIELDS,
} from './types'

export type {
  AmbienceLayerDescriptor,
  AudioContextStateLike,
  AudioEngine,
  AudioEngineOptions,
  AudioEngineState,
  BusName,
  BusVolumes,
  CrossfadeRejectionReason,
  CrossfadeResult,
  FilterDescriptor,
  FilterType,
  ModulationDescriptor,
  NoiseColor,
  NoiseLayerDescriptor,
  NormalizedAmbienceLayer,
  NormalizedFilter,
  NormalizedModulation,
  NormalizedNoiseLayer,
  NormalizedOscillatorLayer,
  NormalizedSoundscapeDescriptor,
  NormalizedVibrato,
  OneShotHandle,
  OneShotId,
  OneShotOptions,
  OneShotRejectionReason,
  OscillatorLayerDescriptor,
  OscillatorWaveform,
  SoundscapeDescriptor,
  ValidationIssue,
  ValidationIssueCode,
  VibratoDescriptor,
} from './types'

export { ONE_SHOT_DEFINITIONS, isOneShotId, resolveOneShotId } from './oneshots'

export type { OneShotDefinition } from './oneshots'

export {
  formatValidationIssues,
  isSoundscapeDescriptor,
  parseSoundscapeDescriptor,
  validateOneShotId,
  validateSoundscapeDescriptor,
} from './validation'

export type { OneShotIdValidationResult, SoundscapeValidationResult } from './validation'
