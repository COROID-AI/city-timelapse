/**
 * Public type surface of the era-agnostic WebAudio engine.
 *
 * The engine knows nothing about time periods: a registry record supplies a
 * {@link SoundscapeDescriptor} and the engine renders it. Everything the era
 * registry, the transition director and the composition need in order to talk
 * to the engine is declared here, so sound design stays pure data and the
 * engine stays free of dependencies on the scene pipeline.
 *
 * Nothing in this module (or any sibling in `src/audio`) touches `AudioContext`
 * at import time: the audio graph is built lazily inside `unlock()`.
 */

/* ------------------------------------------------------------------ buses -- */

/** Mixer buses in signal order: every child bus feeds `master`. */
export const BUS_NAMES = ['master', 'music', 'ambience', 'sfx'] as const

/** Name of a mixer bus. */
export type BusName = (typeof BUS_NAMES)[number]

/** Human-readable bus labels for the audio indicator / mixer UI. */
export const BUS_LABELS: Readonly<Record<BusName, string>> = {
  master: 'Master',
  music: 'Music',
  ambience: 'Ambience',
  sfx: 'SFX',
}

/** Linear per-bus gains in `[0, 1]`. */
export type BusVolumes = Readonly<Record<BusName, number>>

/* --------------------------------------------------- descriptor vocabulary -- */

/** Oscillator waveforms accepted in descriptors (`custom` is rejected). */
export const OSCILLATOR_WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'] as const

/** Oscillator waveform name. */
export type OscillatorWaveform = (typeof OSCILLATOR_WAVEFORMS)[number]

/** Noise colours synthesised at runtime; no sample files are ever fetched. */
export const NOISE_COLORS = ['white', 'pink', 'brown'] as const

/** Colour of a generated noise buffer. */
export type NoiseColor = (typeof NOISE_COLORS)[number]

/** Biquad filter types supported by the bed renderer. */
export const FILTER_TYPES = [
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'peaking',
  'lowshelf',
  'highshelf',
  'allpass',
] as const

/** Biquad filter type name. */
export type FilterType = (typeof FILTER_TYPES)[number]

/**
 * Slow periodic modulation of a filter cutoff. `depth` is in hertz, so it is
 * meaningful for band-limited ambience (wind gusts, traffic swells).
 */
export interface ModulationDescriptor {
  /** Frequency of the modulation LFO in hertz. */
  readonly rate: number
  /** Peak deviation applied to the modulated parameter, in hertz. */
  readonly depth: number
  /** LFO shape; defaults to `sine`. */
  readonly waveform?: OscillatorWaveform
}

/** Slow pitch modulation of an oscillator, in cents. */
export interface VibratoDescriptor {
  /** Frequency of the vibrato LFO in hertz. */
  readonly rate: number
  /** Peak deviation applied to the oscillator detune, in cents. */
  readonly depth: number
}

/** A biquad filter stage, optionally with its own cutoff modulation. */
export interface FilterDescriptor {
  readonly type: FilterType
  /** Cutoff / centre frequency in hertz. */
  readonly frequency: number
  /** Filter resonance; defaults to 1. */
  readonly q?: number
  /** Shelf/peaking gain in decibels; defaults to 0. */
  readonly gain?: number
  /** Cutoff wobble, e.g. a wind gust or a traffic swell. */
  readonly modulation?: ModulationDescriptor
}

/** A continuously running oscillator layer of an ambience bed. */
export interface OscillatorLayerDescriptor {
  readonly type: 'oscillator'
  /** Waveform; defaults to `sine`. */
  readonly waveform?: OscillatorWaveform
  /** Base frequency in hertz. */
  readonly frequency: number
  /** Static detune in cents; defaults to 0. */
  readonly detune?: number
  /** Layer level before the bed gain; defaults to 1. */
  readonly level?: number
  /** Optional slow pitch drift. */
  readonly vibrato?: VibratoDescriptor
}

/** A looping generated-noise layer of an ambience bed. */
export interface NoiseLayerDescriptor {
  readonly type: 'noise'
  /** Noise colour; defaults to `white`. */
  readonly color?: NoiseColor
  /** Layer level before the bed gain; defaults to 1. */
  readonly level?: number
  /** Optional per-layer filter (for example a band-limited rain hiss). */
  readonly filter?: FilterDescriptor
}

/** One layer of an ambience bed. */
export type AmbienceLayerDescriptor = OscillatorLayerDescriptor | NoiseLayerDescriptor

/**
 * A complete ambience bed description.
 *
 * This is the record an era registry stores per time period; the engine renders
 * any valid descriptor it is handed, so eras can invent their own sound design
 * without touching engine code.
 */
export interface SoundscapeDescriptor {
  /** Stable identifier, unique per era record. */
  readonly id: string
  /** Optional human-readable label for the audio indicator. */
  readonly name?: string
  /** Overall bed level `0..2`; defaults to 1. */
  readonly gain?: number
  /** Fade-in seconds used when a crossfade duration is not supplied. */
  readonly fadeInSeconds?: number
  /** Layers mixed into the bed; at least one is required. */
  readonly layers: readonly AmbienceLayerDescriptor[]
  /** Optional bed-wide filter applied after the layers are summed. */
  readonly filter?: FilterDescriptor
  /** Optional bed-wide cutoff modulation. */
  readonly modulation?: ModulationDescriptor
}

/* --------------------------------------------------------- normalised form -- */

/** Modulation after defaults have been applied. */
export interface NormalizedModulation {
  readonly rate: number
  readonly depth: number
  readonly waveform: OscillatorWaveform
}

/** Vibrato after defaults have been applied. */
export interface NormalizedVibrato {
  readonly rate: number
  readonly depth: number
}

/** Filter after defaults have been applied. */
export interface NormalizedFilter {
  readonly type: FilterType
  readonly frequency: number
  readonly q: number
  readonly gain: number
  readonly modulation: NormalizedModulation | null
}

/** Oscillator layer after defaults have been applied. */
export interface NormalizedOscillatorLayer {
  readonly type: 'oscillator'
  readonly waveform: OscillatorWaveform
  readonly frequency: number
  readonly detune: number
  readonly level: number
  readonly vibrato: NormalizedVibrato | null
}

/** Noise layer after defaults have been applied. */
export interface NormalizedNoiseLayer {
  readonly type: 'noise'
  readonly color: NoiseColor
  readonly level: number
  readonly filter: NormalizedFilter | null
}

/** Ambience layer after defaults have been applied. */
export type NormalizedAmbienceLayer = NormalizedOscillatorLayer | NormalizedNoiseLayer

/**
 * A descriptor that passed validation, with every optional field resolved.
 * Bed rendering consumes only this shape, which is why a validated record can
 * never fail silently: what is rendered is exactly what was validated.
 */
export interface NormalizedSoundscapeDescriptor {
  readonly id: string
  readonly name: string
  readonly gain: number
  readonly fadeInSeconds: number
  readonly layers: readonly NormalizedAmbienceLayer[]
  readonly filter: NormalizedFilter | null
  readonly modulation: NormalizedModulation | null
}

/* -------------------------------------------------------- accepted surface -- */

/**
 * Accepted descriptor field names, per level. Validation rejects anything
 * outside these sets, so a typo in an era record is reported instead of being
 * quietly dropped (which would otherwise produce silent or wrong audio).
 */
export const SOUNDSCAPE_FIELDS = [
  'id',
  'name',
  'gain',
  'fadeInSeconds',
  'layers',
  'filter',
  'modulation',
] as const

export const OSCILLATOR_LAYER_FIELDS = [
  'type',
  'waveform',
  'frequency',
  'detune',
  'level',
  'vibrato',
] as const

export const NOISE_LAYER_FIELDS = ['type', 'color', 'level', 'filter'] as const

export const LAYER_FIELDS = ['type', ...OSCILLATOR_LAYER_FIELDS, ...NOISE_LAYER_FIELDS] as const

export const FILTER_FIELDS = ['type', 'frequency', 'q', 'gain', 'modulation'] as const

export const MODULATION_FIELDS = ['rate', 'depth', 'waveform'] as const

export const VIBRATO_FIELDS = ['rate', 'depth'] as const

/**
 * Accepted numeric ranges. Validation reports out-of-range values instead of
 * clamping them, and rendering uses the same numbers as its defaults.
 */
export const DESCRIPTOR_LIMITS = {
  id: { minLength: 1, maxLength: 64 },
  name: { maxLength: 120 },
  gain: { min: 0, max: 2, fallback: 1 },
  fadeInSeconds: { min: 0, max: 60, fallback: 1.5 },
  layerCount: { min: 1, max: 24 },
  oscillatorFrequency: { min: 1, max: 20000 },
  detune: { min: -4800, max: 4800, fallback: 0 },
  layerLevel: { min: 0, max: 2, fallback: 1 },
  filterFrequency: { min: 10, max: 20000 },
  filterQ: { min: 0.0001, max: 40, fallback: 1 },
  filterGain: { min: -40, max: 40, fallback: 0 },
  modulationRate: { min: 0.01, max: 40 },
  modulationDepth: { min: 0, max: 8000 },
  vibratoRate: { min: 0.01, max: 60 },
  vibratoDepth: { min: 0, max: 1200 },
} as const

/* --------------------------------------------------------------- one-shots -- */

/** Canonical one-shot SFX ids. Every entry has a synthesised patch. */
export const ONE_SHOT_IDS = [
  'horn',
  'streetcar-bell',
  'engine',
  'jackhammer',
  'door-bell',
  'crowd-cheer',
  'birds',
  'siren',
  'train',
  'seagull',
  'ev-whine',
] as const

/** Identifier of a synthesised one-shot. */
export type OneShotId = (typeof ONE_SHOT_IDS)[number]

/**
 * Alternate spellings accepted by `playOneShot`, mapped to canonical ids.
 * Era registries may name a sound after the period's flavour ("trolley-bell")
 * without having to know the library's internal naming.
 */
export const ONE_SHOT_ALIASES: Readonly<Record<string, OneShotId>> = {
  horn: 'horn',
  'car-horn': 'horn',
  'taxi-horn': 'horn',
  bell: 'streetcar-bell',
  'streetcar-bell': 'streetcar-bell',
  'trolley-bell': 'streetcar-bell',
  'tram-bell': 'streetcar-bell',
  engine: 'engine',
  'engine-start': 'engine',
  'engine-idle': 'engine',
  'combustion-engine': 'engine',
  jackhammer: 'jackhammer',
  'pneumatic-drill': 'jackhammer',
  drill: 'jackhammer',
  door: 'door-bell',
  'door-bell': 'door-bell',
  doorbell: 'door-bell',
  crowd: 'crowd-cheer',
  cheer: 'crowd-cheer',
  'crowd-cheer': 'crowd-cheer',
  birds: 'birds',
  birdsong: 'birds',
  siren: 'siren',
  'emergency-siren': 'siren',
  train: 'train',
  transit: 'train',
  subway: 'train',
  streetcar: 'train',
  seagull: 'seagull',
  gull: 'seagull',
  'ev-whine': 'ev-whine',
  ev: 'ev-whine',
  'ev-motor': 'ev-whine',
  'electric-whine': 'ev-whine',
}

/* ------------------------------------------------------------------ engine -- */

/** Context state as reported to the UI, including the pre-gesture state. */
export type AudioContextStateLike = 'suspended' | 'running' | 'closed' | 'interrupted' | 'unavailable'

/**
 * Snapshot of everything the audio indicator needs. `getState()` is cheap and
 * side-effect free apart from releasing finished voices.
 */
export interface AudioEngineState {
  /**
   * Live `AudioContext.state`. Before the first unlock the engine has not
   * constructed a context yet, so it reports `suspended`: the graph exists but
   * cannot produce sound until `unlock()` runs.
   */
  readonly contextState: AudioContextStateLike
  /** True once `unlock()` has constructed the context. */
  readonly contextCreated: boolean
  /** False when the environment has no WebAudio; the engine is then a no-op. */
  readonly supported: boolean
  /** True once `unlock()` has been called successfully. */
  readonly unlocked: boolean
  /** True while the context is actually running. */
  readonly running: boolean
  /** True while the master output is muted. */
  readonly muted: boolean
  /** True after `dispose()`; every later call is a safe no-op. */
  readonly disposed: boolean
  /** Current per-bus gains. */
  readonly volumes: BusVolumes
  /** Id of the bed currently being played, or null. */
  readonly currentBed: string | null
  /** Id of a bed waiting for the first unlock, or null. */
  readonly pendingBed: string | null
  /** Ids of beds that are fading out before being disposed. */
  readonly retiringBeds: readonly string[]
  /** One-shot voices plus bed voices. */
  readonly liveVoices: number
  /** One-shot voices still inside their scheduled window. */
  readonly oneShotVoices: number
  /** Ambience beds still producing sound (active plus fading out). */
  readonly bedVoices: number
  /** RMS of the master output as measured by the engine's analyser. */
  readonly analyserRms: number
}

/** Per-trigger variation for a one-shot. */
export interface OneShotOptions {
  /** Peak gain `0..2`; defaults to 1. */
  readonly gain?: number
  /** Stereo position `-1..1`; defaults to 0. */
  readonly pan?: number
  /** Playback rate multiplier (pitch and duration); defaults to 1. */
  readonly rate?: number
  /** Delay before the voice starts, in seconds; defaults to 0. */
  readonly delaySeconds?: number
}

/** Why a one-shot was not started. */
export type OneShotRejectionReason = 'locked' | 'unsupported' | 'disposed' | 'unknown-id'

/** Result of `playOneShot`; `started` is false for every rejection reason. */
export interface OneShotHandle {
  /** Resolved canonical id, or null when the request was rejected. */
  readonly id: OneShotId | null
  readonly started: boolean
  readonly reason: OneShotRejectionReason | null
  /** Nominal length of the voice in seconds (already rate-scaled). */
  readonly durationSeconds: number
  readonly gain: number
  readonly pan: number
  readonly rate: number
  /** Context time the voice was scheduled at. */
  readonly startTime: number
  /** Fade the voice out early; safe to call more than once. */
  stop(when?: number): void
}

/** Why a bed crossfade was not applied. */
export type CrossfadeRejectionReason = 'locked' | 'unsupported' | 'disposed' | 'invalid-descriptor'

/** Result of `crossfadeBeds` / `stopBeds`. */
export interface CrossfadeResult {
  /** True when the bed was built and mixed in. */
  readonly applied: boolean
  /** True when the bed was remembered and is waiting for `unlock()`. */
  readonly pending: boolean
  /** Descriptor id involved in the operation, when known. */
  readonly bedId: string | null
  /** Fade duration that was used, in seconds. */
  readonly durationSeconds: number
  /** Set when the operation did not change what is playing. */
  readonly reason: CrossfadeRejectionReason | null
  /** Validation diagnostics for a rejected descriptor. */
  readonly issues: readonly ValidationIssue[]
}

/** Severity-free diagnostic describing one rejected descriptor field. */
export interface ValidationIssue {
  /** Dotted path to the offending field, e.g. `layers[1].frequency`. */
  readonly path: string
  readonly code: ValidationIssueCode
  /** Human-readable explanation, including the accepted range/value set. */
  readonly message: string
}

/** Why a descriptor field was rejected. */
export type ValidationIssueCode =
  | 'missing-field'
  | 'unknown-field'
  | 'wrong-type'
  | 'out-of-range'
  | 'unsupported-value'
  | 'empty-collection'
  | 'too-many-items'
  | 'unknown-id'

/** Options for {@link AudioEngine} construction. */
export interface AudioEngineOptions {
  /**
   * Builds the `AudioContext` on first unlock. Defaults to the platform
   * constructor, and unit tests inject a stub here.
   */
  readonly contextFactory?: () => AudioContext | null
  /** Initial per-bus gains; missing buses default to 1. */
  readonly volumes?: Partial<BusVolumes>
  /** Start muted (useful when restoring a stored preference). */
  readonly muted?: boolean
  /** Fade duration used by `crossfadeBeds`/`stopBeds` when none is given. */
  readonly crossfadeSeconds?: number
  /** Random source for generated noise; inject a seeded RNG for determinism. */
  readonly random?: () => number
  /** Analyser FFT size used for the RMS readout; defaults to 2048. */
  readonly analyserFftSize?: number
  /** Analyser smoothing constant; defaults to 0.6. */
  readonly analyserSmoothing?: number
}

/**
 * The complete engine contract.
 *
 * Lifecycle: construct with `createAudioEngine`, call `unlock()` from a user
 * gesture, then drive `crossfadeBeds` / `playOneShot`; finally call `dispose()`
 * on unmount so no oscillators, gains or buffers leak between era switches.
 */
export interface AudioEngine {
  /** Creates the context if needed, resumes it and applies any pending bed. */
  unlock(): Promise<AudioEngineState>
  /** Current snapshot; releases voices that have finished. */
  getState(): AudioEngineState
  /** Observable state, so the UI can render an audio indicator. */
  subscribe(listener: (state: AudioEngineState) => void): () => void
  /** Sets one bus gain and returns the applied (clamped) value. */
  setVolume(bus: BusName, value: number): number
  /** Reads one bus gain. */
  getVolume(bus: BusName): number
  /** Reads every bus gain. */
  getVolumes(): BusVolumes
  /** Mutes or unmutes the master output without touching bus gains. */
  mute(muted?: boolean): boolean
  /** True while muted. */
  isMuted(): boolean
  /** Flips mute and returns the new value. */
  toggleMute(): boolean
  /**
   * Crossfades to a bed, retiring whatever was playing. Passing `null` fades
   * the current bed out. Before the first unlock the request is remembered and
   * applied by `unlock()`.
   */
  crossfadeBeds(descriptor: SoundscapeDescriptor | null, seconds?: number): CrossfadeResult
  /** Fades the current bed out and clears any pending request. */
  stopBeds(seconds?: number): CrossfadeResult
  /** Fires one synthesised one-shot voice with per-shot gain/pan/rate. */
  playOneShot(id: string, options?: OneShotOptions): OneShotHandle
  /** Master-output RMS in `[0, 1]`; 0 when the engine has no analyser. */
  getAnalyserRms(): number
  /** Releases every node, closes the context and makes the engine inert. */
  dispose(): void
}
