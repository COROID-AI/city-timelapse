/**
 * Strict validation of the descriptor records the era registry feeds the
 * engine.
 *
 * The engine must never fail silently: an era record with a typo (a misspelled
 * layer field, a frequency of `0`, a `custom` waveform) has to be reported
 * rather than rendered as a wrong or inaudible bed. Validation therefore
 * rejects unknown fields at every level and returns one diagnostic per problem,
 * and {@link parseSoundscapeDescriptor} turns a valid record into the fully
 * defaulted form the renderer consumes.
 */

import { resolveOneShotId } from './oneshots'
import {
  DESCRIPTOR_LIMITS,
  FILTER_FIELDS,
  FILTER_TYPES,
  MODULATION_FIELDS,
  NOISE_COLORS,
  NOISE_LAYER_FIELDS,
  ONE_SHOT_IDS,
  OSCILLATOR_LAYER_FIELDS,
  OSCILLATOR_WAVEFORMS,
  SOUNDSCAPE_FIELDS,
  VIBRATO_FIELDS,
} from './types'
import type {
  FilterType,
  NoiseColor,
  NormalizedAmbienceLayer,
  NormalizedFilter,
  NormalizedModulation,
  NormalizedNoiseLayer,
  NormalizedOscillatorLayer,
  NormalizedSoundscapeDescriptor,
  NormalizedVibrato,
  OneShotId,
  OscillatorWaveform,
  SoundscapeDescriptor,
  ValidationIssue,
  ValidationIssueCode,
} from './types'

/** Outcome of {@link validateSoundscapeDescriptor}. */
export interface SoundscapeValidationResult {
  readonly valid: boolean
  /** One entry per rejected field; empty when `valid` is true. */
  readonly issues: readonly ValidationIssue[]
  /** Fully defaulted record, or null when the input was rejected. */
  readonly value: NormalizedSoundscapeDescriptor | null
}

/** Outcome of {@link validateOneShotId}. */
export interface OneShotIdValidationResult {
  readonly valid: boolean
  /** Canonical id, or null when the input was rejected. */
  readonly id: OneShotId | null
  readonly issues: readonly ValidationIssue[]
}

/** Inclusive numeric range used by the readers below. */
interface NumberLimits {
  readonly min: number
  readonly max: number
}

/** Collector that keeps validation side-effect free and reportable. */
class IssueCollector {
  private readonly collected: ValidationIssue[] = []

  get issues(): readonly ValidationIssue[] {
    return this.collected
  }

  fail(path: string, code: ValidationIssueCode, message: string): void {
    this.collected.push({ path, code, message })
  }

  /** Rejects every field whose name is not part of the documented surface. */
  checkUnknownFields(source: Record<string, unknown>, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(source)) {
      if (allowed.includes(key)) {
        continue
      }
      this.fail(
        joinPath(path, key),
        'unknown-field',
        `Unsupported field. Accepted fields: ${allowed.join(', ')}.`,
      )
    }
  }
}

function joinPath(path: string, key: string): string {
  return path.length === 0 ? key : `${path}.${key}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `an array of ${value.length}`
  }
  if (typeof value === 'object') {
    return 'an object'
  }
  return String(value)
}

function readNumber(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  limits: NumberLimits,
  label: string,
): number | null {
  if (raw === undefined) {
    return null
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    collector.fail(path, 'wrong-type', `${label} must be a finite number, received ${describeValue(raw)}.`)
    return null
  }
  if (raw < limits.min || raw > limits.max) {
    collector.fail(
      path,
      'out-of-range',
      `${label} must be within [${limits.min}, ${limits.max}], received ${raw}.`,
    )
    return null
  }
  return raw
}

function readRequiredNumber(
  collector: IssueCollector,
  source: Record<string, unknown>,
  key: string,
  path: string,
  limits: NumberLimits,
  label: string,
): number | null {
  const raw = source[key]
  if (raw === undefined) {
    collector.fail(path, 'missing-field', `${label} is required.`)
    return null
  }
  return readNumber(collector, raw, path, limits, label)
}

function readOptionalNumber(
  collector: IssueCollector,
  source: Record<string, unknown>,
  key: string,
  path: string,
  limits: NumberLimits,
  fallback: number,
  label: string,
): number {
  const raw = source[key]
  if (raw === undefined) {
    return fallback
  }
  const value = readNumber(collector, raw, path, limits, label)
  return value === null ? fallback : value
}

function readEnum<T extends string>(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  allowed: readonly T[],
  fallback: T,
  label: string,
): T {
  if (raw === undefined) {
    return fallback
  }
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    collector.fail(
      path,
      'unsupported-value',
      `${label} must be one of ${allowed.join(', ')}, received ${describeValue(raw)}.`,
    )
    return fallback
  }
  return raw as T
}

function readRequiredEnum<T extends string>(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  allowed: readonly T[],
  label: string,
): T | null {
  if (raw === undefined) {
    collector.fail(path, 'missing-field', `${label} is required.`)
    return null
  }
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    collector.fail(
      path,
      'unsupported-value',
      `${label} must be one of ${allowed.join(', ')}, received ${describeValue(raw)}.`,
    )
    return null
  }
  return raw as T
}

function readRequiredString(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  limits: { readonly minLength: number; readonly maxLength: number },
  label: string,
): string | null {
  if (raw === undefined) {
    collector.fail(path, 'missing-field', `${label} is required.`)
    return null
  }
  if (typeof raw !== 'string') {
    collector.fail(path, 'wrong-type', `${label} must be a string, received ${describeValue(raw)}.`)
    return null
  }
  const trimmed = raw.trim()
  if (trimmed.length < limits.minLength) {
    collector.fail(path, 'out-of-range', `${label} must not be empty.`)
    return null
  }
  if (trimmed.length > limits.maxLength) {
    collector.fail(
      path,
      'out-of-range',
      `${label} must be at most ${limits.maxLength} characters, received ${trimmed.length}.`,
    )
    return null
  }
  return trimmed
}

function readOptionalString(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  limits: { readonly maxLength: number },
  fallback: string,
  label: string,
): string {
  if (raw === undefined) {
    return fallback
  }
  if (typeof raw !== 'string') {
    collector.fail(path, 'wrong-type', `${label} must be a string, received ${describeValue(raw)}.`)
    return fallback
  }
  const trimmed = raw.trim()
  if (trimmed.length > limits.maxLength) {
    collector.fail(
      path,
      'out-of-range',
      `${label} must be at most ${limits.maxLength} characters, received ${trimmed.length}.`,
    )
    return fallback
  }
  return trimmed.length === 0 ? fallback : trimmed
}

function validateModulation(
  collector: IssueCollector,
  raw: unknown,
  path: string,
  depthLimits: NumberLimits,
): NormalizedModulation | null {
  if (raw === undefined) {
    return null
  }
  if (!isPlainObject(raw)) {
    collector.fail(path, 'wrong-type', `Modulation must be an object, received ${describeValue(raw)}.`)
    return null
  }
  collector.checkUnknownFields(raw, MODULATION_FIELDS, path)
  const rate = readRequiredNumber(
    collector,
    raw,
    'rate',
    joinPath(path, 'rate'),
    DESCRIPTOR_LIMITS.modulationRate,
    'Modulation rate',
  )
  const depth = readRequiredNumber(
    collector,
    raw,
    'depth',
    joinPath(path, 'depth'),
    depthLimits,
    'Modulation depth',
  )
  const waveform = readEnum(
    collector,
    raw['waveform'],
    joinPath(path, 'waveform'),
    OSCILLATOR_WAVEFORMS,
    'sine',
    'Modulation waveform',
  )
  if (rate === null || depth === null) {
    return null
  }
  return { rate, depth, waveform }
}

function validateVibrato(
  collector: IssueCollector,
  raw: unknown,
  path: string,
): NormalizedVibrato | null {
  if (raw === undefined) {
    return null
  }
  if (!isPlainObject(raw)) {
    collector.fail(path, 'wrong-type', `Vibrato must be an object, received ${describeValue(raw)}.`)
    return null
  }
  collector.checkUnknownFields(raw, VIBRATO_FIELDS, path)
  const rate = readRequiredNumber(
    collector,
    raw,
    'rate',
    joinPath(path, 'rate'),
    DESCRIPTOR_LIMITS.vibratoRate,
    'Vibrato rate',
  )
  const depth = readRequiredNumber(
    collector,
    raw,
    'depth',
    joinPath(path, 'depth'),
    DESCRIPTOR_LIMITS.vibratoDepth,
    'Vibrato depth',
  )
  if (rate === null || depth === null) {
    return null
  }
  return { rate, depth }
}

function validateFilter(
  collector: IssueCollector,
  raw: unknown,
  path: string,
): NormalizedFilter | null {
  if (raw === undefined) {
    return null
  }
  if (!isPlainObject(raw)) {
    collector.fail(path, 'wrong-type', `Filter must be an object, received ${describeValue(raw)}.`)
    return null
  }
  collector.checkUnknownFields(raw, FILTER_FIELDS, path)
  const type: FilterType | null = readRequiredEnum(
    collector,
    raw['type'],
    joinPath(path, 'type'),
    FILTER_TYPES,
    'Filter type',
  )
  const frequency = readRequiredNumber(
    collector,
    raw,
    'frequency',
    joinPath(path, 'frequency'),
    DESCRIPTOR_LIMITS.filterFrequency,
    'Filter frequency',
  )
  const q = readOptionalNumber(
    collector,
    raw,
    'q',
    joinPath(path, 'q'),
    DESCRIPTOR_LIMITS.filterQ,
    DESCRIPTOR_LIMITS.filterQ.fallback,
    'Filter Q',
  )
  const gain = readOptionalNumber(
    collector,
    raw,
    'gain',
    joinPath(path, 'gain'),
    DESCRIPTOR_LIMITS.filterGain,
    DESCRIPTOR_LIMITS.filterGain.fallback,
    'Filter gain',
  )
  const modulation = validateModulation(
    collector,
    raw['modulation'],
    joinPath(path, 'modulation'),
    DESCRIPTOR_LIMITS.modulationDepth,
  )
  if (type === null || frequency === null) {
    return null
  }
  return { type, frequency, q, gain, modulation }
}

function validateOscillatorLayer(
  collector: IssueCollector,
  raw: Record<string, unknown>,
  path: string,
): NormalizedOscillatorLayer | null {
  collector.checkUnknownFields(raw, OSCILLATOR_LAYER_FIELDS, path)
  const waveform: OscillatorWaveform = readEnum(
    collector,
    raw['waveform'],
    joinPath(path, 'waveform'),
    OSCILLATOR_WAVEFORMS,
    'sine',
    'Layer waveform',
  )
  const frequency = readRequiredNumber(
    collector,
    raw,
    'frequency',
    joinPath(path, 'frequency'),
    DESCRIPTOR_LIMITS.oscillatorFrequency,
    'Layer frequency',
  )
  const detune = readOptionalNumber(
    collector,
    raw,
    'detune',
    joinPath(path, 'detune'),
    DESCRIPTOR_LIMITS.detune,
    DESCRIPTOR_LIMITS.detune.fallback,
    'Layer detune',
  )
  const level = readOptionalNumber(
    collector,
    raw,
    'level',
    joinPath(path, 'level'),
    DESCRIPTOR_LIMITS.layerLevel,
    DESCRIPTOR_LIMITS.layerLevel.fallback,
    'Layer level',
  )
  const vibrato = validateVibrato(collector, raw['vibrato'], joinPath(path, 'vibrato'))
  if (frequency === null) {
    return null
  }
  return { type: 'oscillator', waveform, frequency, detune, level, vibrato }
}

function validateNoiseLayer(
  collector: IssueCollector,
  raw: Record<string, unknown>,
  path: string,
): NormalizedNoiseLayer | null {
  collector.checkUnknownFields(raw, NOISE_LAYER_FIELDS, path)
  const color: NoiseColor = readEnum(
    collector,
    raw['color'],
    joinPath(path, 'color'),
    NOISE_COLORS,
    'white',
    'Noise colour',
  )
  const level = readOptionalNumber(
    collector,
    raw,
    'level',
    joinPath(path, 'level'),
    DESCRIPTOR_LIMITS.layerLevel,
    DESCRIPTOR_LIMITS.layerLevel.fallback,
    'Layer level',
  )
  const filter = validateFilter(collector, raw['filter'], joinPath(path, 'filter'))
  return { type: 'noise', color, level, filter }
}

function validateLayer(
  collector: IssueCollector,
  raw: unknown,
  path: string,
): NormalizedAmbienceLayer | null {
  if (!isPlainObject(raw)) {
    collector.fail(path, 'wrong-type', `Layer must be an object, received ${describeValue(raw)}.`)
    return null
  }
  const type = raw['type']
  if (type === 'oscillator') {
    return validateOscillatorLayer(collector, raw, path)
  }
  if (type === 'noise') {
    return validateNoiseLayer(collector, raw, path)
  }
  if (type === undefined) {
    collector.fail(joinPath(path, 'type'), 'missing-field', 'Layer type is required ("oscillator" or "noise").')
    return null
  }
  collector.fail(
    joinPath(path, 'type'),
    'unsupported-value',
    `Layer type must be "oscillator" or "noise", received ${describeValue(type)}.`,
  )
  return null
}

/**
 * Validates an unknown value and, when it passes, returns the fully defaulted
 * record the bed renderer consumes. Never throws.
 */
export function validateSoundscapeDescriptor(input: unknown): SoundscapeValidationResult {
  const collector = new IssueCollector()

  if (!isPlainObject(input)) {
    collector.fail(
      'descriptor',
      'wrong-type',
      `Soundscape descriptor must be an object, received ${describeValue(input)}.`,
    )
    return { valid: false, issues: collector.issues, value: null }
  }

  collector.checkUnknownFields(input, SOUNDSCAPE_FIELDS, '')

  const id = readRequiredString(collector, input['id'], 'id', DESCRIPTOR_LIMITS.id, 'Descriptor id')
  const name = readOptionalString(
    collector,
    input['name'],
    'name',
    DESCRIPTOR_LIMITS.name,
    id ?? 'soundscape',
    'Descriptor name',
  )
  const gain = readOptionalNumber(
    collector,
    input,
    'gain',
    'gain',
    DESCRIPTOR_LIMITS.gain,
    DESCRIPTOR_LIMITS.gain.fallback,
    'Bed gain',
  )
  const fadeInSeconds = readOptionalNumber(
    collector,
    input,
    'fadeInSeconds',
    'fadeInSeconds',
    DESCRIPTOR_LIMITS.fadeInSeconds,
    DESCRIPTOR_LIMITS.fadeInSeconds.fallback,
    'Fade-in seconds',
  )
  const filter = validateFilter(collector, input['filter'], 'filter')
  const modulation = validateModulation(
    collector,
    input['modulation'],
    'modulation',
    DESCRIPTOR_LIMITS.modulationDepth,
  )

  const layers: NormalizedAmbienceLayer[] = []
  const layersRaw = input['layers']
  if (layersRaw === undefined) {
    collector.fail('layers', 'missing-field', 'Soundscape descriptor requires a layers array.')
  } else if (!Array.isArray(layersRaw)) {
    collector.fail('layers', 'wrong-type', `layers must be an array, received ${describeValue(layersRaw)}.`)
  } else if (layersRaw.length < DESCRIPTOR_LIMITS.layerCount.min) {
    collector.fail(
      'layers',
      'empty-collection',
      `layers must contain at least ${DESCRIPTOR_LIMITS.layerCount.min} entry.`,
    )
  } else if (layersRaw.length > DESCRIPTOR_LIMITS.layerCount.max) {
    collector.fail(
      'layers',
      'too-many-items',
      `layers must contain at most ${DESCRIPTOR_LIMITS.layerCount.max} entries, received ${layersRaw.length}.`,
    )
  } else {
    layersRaw.forEach((layerRaw, index) => {
      const layer = validateLayer(collector, layerRaw, `layers[${index}]`)
      if (layer !== null) {
        layers.push(layer)
      }
    })
  }

  const issues = collector.issues
  if (issues.length > 0 || id === null) {
    return { valid: false, issues, value: null }
  }
  return {
    valid: true,
    issues,
    value: { id, name, gain, fadeInSeconds, layers, filter, modulation },
  }
}

/**
 * Validates and returns the normalised record, throwing a diagnostic-rich error
 * when the input is not a usable soundscape descriptor.
 */
export function parseSoundscapeDescriptor(input: unknown): NormalizedSoundscapeDescriptor {
  const result = validateSoundscapeDescriptor(input)
  if (result.valid && result.value !== null) {
    return result.value
  }
  throw new Error(`Invalid soundscape descriptor:\n${formatValidationIssues(result.issues)}`)
}

/** Type guard for the `SoundscapeDescriptor` contract. */
export function isSoundscapeDescriptor(input: unknown): input is SoundscapeDescriptor {
  return validateSoundscapeDescriptor(input).valid
}

/** Validates a one-shot id, resolving documented aliases to canonical ids. */
export function validateOneShotId(input: unknown): OneShotIdValidationResult {
  if (typeof input !== 'string') {
    return {
      valid: false,
      id: null,
      issues: [
        {
          path: 'id',
          code: 'wrong-type',
          message: `One-shot id must be a string, received ${describeValue(input)}.`,
        },
      ],
    }
  }
  const id = resolveOneShotId(input)
  if (id === null) {
    return {
      valid: false,
      id: null,
      issues: [
        {
          path: 'id',
          code: 'unknown-id',
          message: `Unknown one-shot id ${JSON.stringify(input)}. Known ids: ${ONE_SHOT_IDS.join(', ')}.`,
        },
      ],
    }
  }
  return { valid: true, id, issues: [] }
}

/** Renders diagnostics as a newline-separated, log-friendly list. */
export function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  if (issues.length === 0) {
    return ' - (no issues)'
  }
  return issues.map((issue) => ` - ${issue.path.length === 0 ? 'descriptor' : issue.path}: ${issue.message}`).join('\n')
}
