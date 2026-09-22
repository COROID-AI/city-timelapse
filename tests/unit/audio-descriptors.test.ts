/**
 * Descriptor contract tests.
 *
 * The era registry feeds the engine data, so the contract that matters is the
 * one between a registry record and the renderer: every documented shape must
 * be accepted, every malformed shape must be rejected deterministically and
 * with a diagnostic, and a record must survive a normalise/JSON round trip
 * unchanged in meaning. A descriptor that is quietly dropped would show up in
 * the product as missing audio for one era, which is exactly what these tests
 * exist to prevent.
 */

import { describe, expect, it } from 'vitest'
import {
  DESCRIPTOR_LIMITS,
  FILTER_TYPES,
  NOISE_COLORS,
  ONE_SHOT_ALIASES,
  ONE_SHOT_DEFINITIONS,
  ONE_SHOT_IDS,
  OSCILLATOR_WAVEFORMS,
  SOUNDSCAPE_FIELDS,
  formatValidationIssues,
  isOneShotId,
  isSoundscapeDescriptor,
  parseSoundscapeDescriptor,
  resolveOneShotId,
  validateOneShotId,
  validateSoundscapeDescriptor,
} from '../../src/audio'
import type {
  AmbienceLayerDescriptor,
  NormalizedSoundscapeDescriptor,
  SoundscapeDescriptor,
  ValidationIssueCode,
} from '../../src/audio'

/** Smallest descriptor that must always pass. */
const MINIMAL: SoundscapeDescriptor = {
  id: 'minimal',
  layers: [{ type: 'noise' }],
}

/** Descriptor exercising every documented field at every level. */
const COMPLETE: SoundscapeDescriptor = {
  id: 'complete-1965',
  name: '1965 city block',
  gain: 0.8,
  fadeInSeconds: 2,
  filter: {
    type: 'bandpass',
    frequency: 800,
    q: 0.7,
    gain: -2,
    modulation: { rate: 0.25, depth: 150, waveform: 'triangle' },
  },
  modulation: { rate: 0.1, depth: 300, waveform: 'sine' },
  layers: [
    {
      type: 'noise',
      color: 'pink',
      level: 0.6,
      filter: { type: 'lowpass', frequency: 400, q: 0.5, modulation: { rate: 0.2, depth: 90 } },
    },
    {
      type: 'oscillator',
      waveform: 'sawtooth',
      frequency: 110,
      detune: -12,
      level: 0.25,
      vibrato: { rate: 0.4, depth: 18 },
    },
  ],
}

/** The six bed shapes the intent calls out, as an era registry would store them. */
const ERA_BEDS: Record<string, SoundscapeDescriptor> = {
  'traffic hum': {
    id: 'traffic-hum',
    name: 'Traffic hum',
    gain: 0.55,
    fadeInSeconds: 2,
    filter: { type: 'lowpass', frequency: 1100, q: 0.4, modulation: { rate: 0.07, depth: 260 } },
    layers: [
      { type: 'noise', color: 'brown', level: 0.5, filter: { type: 'lowpass', frequency: 220 } },
      { type: 'noise', color: 'pink', level: 0.16, filter: { type: 'bandpass', frequency: 900 } },
      { type: 'oscillator', waveform: 'sine', frequency: 55, level: 0.14 },
    ],
  },
  rain: {
    id: 'rain',
    gain: 0.45,
    layers: [
      { type: 'noise', color: 'white', level: 0.35, filter: { type: 'highpass', frequency: 700 } },
      { type: 'noise', color: 'pink', level: 0.3, filter: { type: 'bandpass', frequency: 2400 } },
    ],
  },
  wind: {
    id: 'wind',
    gain: 0.4,
    fadeInSeconds: 3,
    filter: { type: 'lowpass', frequency: 900, modulation: { rate: 0.05, depth: 500 } },
    layers: [
      { type: 'noise', color: 'brown', level: 0.55, filter: { type: 'lowpass', frequency: 500 } },
      { type: 'oscillator', waveform: 'sine', frequency: 96, level: 0.05, vibrato: { rate: 0.09, depth: 120 } },
    ],
  },
  'city drone': {
    id: 'city-drone',
    gain: 0.4,
    layers: [
      { type: 'oscillator', waveform: 'triangle', frequency: 110, level: 0.18 },
      { type: 'oscillator', waveform: 'triangle', frequency: 165, level: 0.12, detune: 6 },
      { type: 'noise', color: 'pink', level: 0.12, filter: { type: 'bandpass', frequency: 420 } },
    ],
  },
  birds: {
    id: 'birds-air',
    gain: 0.35,
    layers: [
      {
        type: 'oscillator',
        waveform: 'triangle',
        frequency: 3200,
        level: 0.08,
        vibrato: { rate: 7.5, depth: 420 },
      },
      { type: 'noise', color: 'white', level: 0.06, filter: { type: 'highpass', frequency: 4200 } },
    ],
  },
  'crowd murmur': {
    id: 'crowd-murmur',
    gain: 0.42,
    filter: { type: 'bandpass', frequency: 800, q: 0.5, modulation: { rate: 0.6, depth: 120 } },
    layers: [
      { type: 'noise', color: 'pink', level: 0.5, filter: { type: 'bandpass', frequency: 700 } },
      { type: 'noise', color: 'white', level: 0.08, filter: { type: 'bandpass', frequency: 1800 } },
    ],
  },
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('soundscape descriptor acceptance', () => {
  it('normalises a minimal descriptor with documented defaults', () => {
    const result = validateSoundscapeDescriptor(MINIMAL)
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
    const value = result.value
    expect(value).not.toBeNull()
    expect(value).toEqual({
      id: 'minimal',
      name: 'minimal',
      gain: DESCRIPTOR_LIMITS.gain.fallback,
      fadeInSeconds: DESCRIPTOR_LIMITS.fadeInSeconds.fallback,
      filter: null,
      modulation: null,
      layers: [{ type: 'noise', color: 'white', level: 1, filter: null }],
    })
  })

  it('resolves defaults for every optional field of a complete descriptor', () => {
    const value = parseSoundscapeDescriptor(COMPLETE)
    expect(value.id).toBe('complete-1965')
    expect(value.name).toBe('1965 city block')
    expect(value.gain).toBe(0.8)
    expect(value.fadeInSeconds).toBe(2)
    expect(value.filter).toEqual({
      type: 'bandpass',
      frequency: 800,
      q: 0.7,
      gain: -2,
      modulation: { rate: 0.25, depth: 150, waveform: 'triangle' },
    })
    expect(value.modulation).toEqual({ rate: 0.1, depth: 300, waveform: 'sine' })
    expect(value.layers[0]).toEqual({
      type: 'noise',
      color: 'pink',
      level: 0.6,
      filter: { type: 'lowpass', frequency: 400, q: 0.5, gain: 0, modulation: { rate: 0.2, depth: 90, waveform: 'sine' } },
    })
    expect(value.layers[1]).toEqual({
      type: 'oscillator',
      waveform: 'sawtooth',
      frequency: 110,
      detune: -12,
      level: 0.25,
      vibrato: { rate: 0.4, depth: 18 },
    })
  })

  it('accepts every era bed shape the registry can emit', () => {
    for (const [label, descriptor] of Object.entries(ERA_BEDS)) {
      const result = validateSoundscapeDescriptor(descriptor)
      expect(result.valid, `${label} should validate: ${formatValidationIssues(result.issues)}`).toBe(true)
      expect(result.value?.layers.length).toBe(descriptor.layers.length)
      expect(isSoundscapeDescriptor(descriptor)).toBe(true)
    }
  })

  it('accepts every documented enum member and layer combination', () => {
    for (const waveform of OSCILLATOR_WAVEFORMS) {
      for (const color of NOISE_COLORS) {
        const layers: AmbienceLayerDescriptor[] = [
          { type: 'oscillator', waveform, frequency: 440, detune: -4800, level: 0, vibrato: { rate: 0.02, depth: 0 } },
          { type: 'noise', color, level: 2 },
        ]
        expect(validateSoundscapeDescriptor({ id: `${waveform}-${color}`, layers }).valid).toBe(true)
      }
    }
    for (const type of FILTER_TYPES) {
      const descriptor: SoundscapeDescriptor = {
        id: `filter-${type}`,
        filter: { type, frequency: 1000 },
        layers: [{ type: 'noise', filter: { type, frequency: 2000, q: 40, gain: 40 } }],
      }
      expect(validateSoundscapeDescriptor(descriptor).valid, type).toBe(true)
    }
  })

  it('accepts the exact numeric boundaries of every documented range', () => {
    const atLimits: SoundscapeDescriptor = {
      id: 'x'.repeat(DESCRIPTOR_LIMITS.id.maxLength),
      name: 'y'.repeat(DESCRIPTOR_LIMITS.name.maxLength),
      gain: DESCRIPTOR_LIMITS.gain.max,
      fadeInSeconds: DESCRIPTOR_LIMITS.fadeInSeconds.max,
      layers: Array.from({ length: DESCRIPTOR_LIMITS.layerCount.max }, (): AmbienceLayerDescriptor => ({
        type: 'oscillator',
        frequency: DESCRIPTOR_LIMITS.oscillatorFrequency.min,
        detune: DESCRIPTOR_LIMITS.detune.min,
        level: DESCRIPTOR_LIMITS.layerLevel.max,
        vibrato: { rate: DESCRIPTOR_LIMITS.vibratoRate.max, depth: DESCRIPTOR_LIMITS.vibratoDepth.max },
      })),
    }
    expect(validateSoundscapeDescriptor(atLimits).valid).toBe(true)
    expect(validateSoundscapeDescriptor({ ...MINIMAL, gain: 0, fadeInSeconds: 0 }).valid).toBe(true)
  })

  it('round-trips a normalised record through JSON without changing its meaning', () => {
    const first = parseSoundscapeDescriptor(COMPLETE)
    const second = validateSoundscapeDescriptor(clone(first))
    expect(second.valid).toBe(true)
    expect(second.value).toEqual(first)
    expect(clone(second.value)).toEqual(clone(first))
  })
})

describe('soundscape descriptor rejections', () => {
  const cases: Array<{ name: string; input: unknown; code: ValidationIssueCode; path: string }> = [
    {
      name: 'a non-object descriptor',
      input: 'not an object',
      code: 'wrong-type',
      path: 'descriptor',
    },
    { name: 'a missing id', input: { layers: [{ type: 'noise' }] }, code: 'missing-field', path: 'id' },
    { name: 'a blank id', input: { ...MINIMAL, id: '   ' }, code: 'out-of-range', path: 'id' },
    { name: 'a non-string id', input: { ...MINIMAL, id: 7 }, code: 'wrong-type', path: 'id' },
    {
      name: 'an over-long id',
      input: { ...MINIMAL, id: 'x'.repeat(DESCRIPTOR_LIMITS.id.maxLength + 1) },
      code: 'out-of-range',
      path: 'id',
    },
    { name: 'an unknown top-level field', input: { ...MINIMAL, gainDb: 3 }, code: 'unknown-field', path: 'gainDb' },
    { name: 'a misspelled layers field', input: { id: 'typo', layres: [] }, code: 'missing-field', path: 'layers' },
    {
      name: 'layers that are not an array',
      input: { ...MINIMAL, layers: { type: 'noise' } },
      code: 'wrong-type',
      path: 'layers',
    },
    { name: 'an empty layers array', input: { ...MINIMAL, layers: [] }, code: 'empty-collection', path: 'layers' },
    {
      name: 'too many layers',
      input: {
        ...MINIMAL,
        layers: Array.from({ length: DESCRIPTOR_LIMITS.layerCount.max + 1 }, () => ({ type: 'noise' })),
      },
      code: 'too-many-items',
      path: 'layers',
    },
    {
      name: 'a layer without a type',
      input: { ...MINIMAL, layers: [{ color: 'pink' }] },
      code: 'missing-field',
      path: 'layers[0].type',
    },
    {
      name: 'an unsupported layer type',
      input: { ...MINIMAL, layers: [{ type: 'sample' }] },
      code: 'unsupported-value',
      path: 'layers[0].type',
    },
    {
      name: 'an unknown oscillator layer field',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 220, detuneCents: 4 }] },
      code: 'unknown-field',
      path: 'layers[0].detuneCents',
    },
    {
      name: 'a noise-only field on an oscillator layer',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 220, color: 'pink' }] },
      code: 'unknown-field',
      path: 'layers[0].color',
    },
    {
      name: 'an oscillator layer without a frequency',
      input: { ...MINIMAL, layers: [{ type: 'oscillator' }] },
      code: 'missing-field',
      path: 'layers[0].frequency',
    },
    {
      name: 'a zero oscillator frequency',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 0 }] },
      code: 'out-of-range',
      path: 'layers[0].frequency',
    },
    {
      name: 'an inaudible oscillator frequency',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 24000 }] },
      code: 'out-of-range',
      path: 'layers[0].frequency',
    },
    {
      name: 'a non-finite frequency',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: Number.POSITIVE_INFINITY }] },
      code: 'wrong-type',
      path: 'layers[0].frequency',
    },
    {
      name: 'a NaN detune',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 200, detune: Number.NaN }] },
      code: 'wrong-type',
      path: 'layers[0].detune',
    },
    {
      name: 'an unsupported waveform',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 200, waveform: 'custom' }] },
      code: 'unsupported-value',
      path: 'layers[0].waveform',
    },
    {
      name: 'an unsupported noise colour',
      input: { ...MINIMAL, layers: [{ type: 'noise', color: 'green' }] },
      code: 'unsupported-value',
      path: 'layers[0].color',
    },
    {
      name: 'a negative layer level',
      input: { ...MINIMAL, layers: [{ type: 'noise', level: -0.1 }] },
      code: 'out-of-range',
      path: 'layers[0].level',
    },
    {
      name: 'a vibrato without a depth',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 200, vibrato: { rate: 5 } }] },
      code: 'missing-field',
      path: 'layers[0].vibrato.depth',
    },
    {
      name: 'an unknown vibrato field',
      input: { ...MINIMAL, layers: [{ type: 'oscillator', frequency: 200, vibrato: { rate: 5, depth: 10, cents: 3 } }] },
      code: 'unknown-field',
      path: 'layers[0].vibrato.cents',
    },
    {
      name: 'a filter without a type',
      input: { ...MINIMAL, filter: { frequency: 500 } },
      code: 'missing-field',
      path: 'filter.type',
    },
    {
      name: 'an unsupported filter type',
      input: { ...MINIMAL, filter: { type: 'resonator', frequency: 500 } },
      code: 'unsupported-value',
      path: 'filter.type',
    },
    {
      name: 'a filter frequency out of range',
      input: { ...MINIMAL, filter: { type: 'lowpass', frequency: 5 } },
      code: 'out-of-range',
      path: 'filter.frequency',
    },
    {
      name: 'an unknown filter field',
      input: { ...MINIMAL, filter: { type: 'lowpass', frequency: 500, resonance: 2 } },
      code: 'unknown-field',
      path: 'filter.resonance',
    },
    {
      name: 'a modulation without a rate',
      input: { ...MINIMAL, filter: { type: 'lowpass', frequency: 500, modulation: { depth: 50 } } },
      code: 'missing-field',
      path: 'filter.modulation.rate',
    },
    {
      name: 'an out-of-range modulation depth',
      input: { ...MINIMAL, filter: { type: 'lowpass', frequency: 500, modulation: { rate: 0.5, depth: 9000 } } },
      code: 'out-of-range',
      path: 'filter.modulation.depth',
    },
    {
      name: 'an unsupported modulation waveform',
      input: { ...MINIMAL, filter: { type: 'lowpass', frequency: 500, modulation: { rate: 0.5, depth: 50, waveform: 'noise' } } },
      code: 'unsupported-value',
      path: 'filter.modulation.waveform',
    },
    { name: 'a non-object modulation', input: { ...MINIMAL, modulation: 3 }, code: 'wrong-type', path: 'modulation' },
    { name: 'a negative gain', input: { ...MINIMAL, gain: -1 }, code: 'out-of-range', path: 'gain' },
    {
      name: 'an absurd fadeInSeconds',
      input: { ...MINIMAL, fadeInSeconds: 600 },
      code: 'out-of-range',
      path: 'fadeInSeconds',
    },
  ]

  it.each(cases)('rejects $name without rendering silently', ({ input, code, path }) => {
    const result = validateSoundscapeDescriptor(input)
    expect(result.valid).toBe(false)
    expect(result.value, 'rejected records never produce a renderable value').toBeNull()
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.map((issue) => issue.code)).toContain(code)
    expect(result.issues.map((issue) => issue.path)).toContain(path)
    expect(isSoundscapeDescriptor(input)).toBe(false)
  })

  it('reports every problem at once and repeats deterministically', () => {
    const broken = {
      id: '   ',
      gain: 9,
      extra: true,
      layers: [{ type: 'oscillator', frequency: -1, waveform: 'custom' }, { type: 'noise', color: 'green' }],
    }
    const first = validateSoundscapeDescriptor(broken)
    const second = validateSoundscapeDescriptor(broken)
    expect(first.issues.length).toBeGreaterThanOrEqual(6)
    expect(second.issues).toEqual(first.issues)
    const paths = first.issues.map((issue) => issue.path)
    expect(paths).toContain('id')
    expect(paths).toContain('gain')
    expect(paths).toContain('extra')
    expect(paths).toContain('layers[0].frequency')
    expect(paths).toContain('layers[0].waveform')
    expect(paths).toContain('layers[1].color')
  })

  it('throws a diagnostic-rich error from parseSoundscapeDescriptor', () => {
    expect(() => parseSoundscapeDescriptor({ id: 'bad', layers: [] })).toThrow(
      /Invalid soundscape descriptor/,
    )
    try {
      parseSoundscapeDescriptor({ id: 'bad', gain: 5, layers: [] })
      throw new Error('expected parseSoundscapeDescriptor to throw')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).toContain('gain')
      expect(message).toContain('layers')
    }
  })

  it('formats issues for logs, including a non-throwing empty case', () => {
    expect(formatValidationIssues([])).toBe(' - (no issues)')
    const result = validateSoundscapeDescriptor(7)
    expect(formatValidationIssues(result.issues)).toContain('descriptor')
  })

  it('documents the accepted soundscape field surface', () => {
    const allowed = new Set<string>(SOUNDSCAPE_FIELDS)
    const unknown = Object.keys({ ...MINIMAL, gainDb: 1 }).filter((key) => !allowed.has(key))
    expect(unknown).toEqual(['gainDb'])
    expect(allowed.has('layers')).toBe(true)
  })
})

describe('one-shot id contract', () => {
  it('resolves every canonical id and documents every library entry', () => {
    expect(Object.keys(ONE_SHOT_DEFINITIONS).sort()).toEqual([...ONE_SHOT_IDS].sort())
    for (const id of ONE_SHOT_IDS) {
      expect(resolveOneShotId(id)).toBe(id)
      expect(isOneShotId(id)).toBe(true)
      const definition = ONE_SHOT_DEFINITIONS[id]
      expect(definition.id).toBe(id)
      expect(definition.durationSeconds).toBeGreaterThan(0)
      expect(definition.label.length).toBeGreaterThan(0)
      expect(definition.description.length).toBeGreaterThan(0)
      expect(definition.categories.length).toBeGreaterThan(0)
    }
  })

  it('covers the acceptance-criteria sound vocabulary', () => {
    const vocabulary = [
      'horn',
      'bell',
      'engine',
      'jackhammer',
      'siren',
      'crowd',
      'birds',
      'door',
      'transit',
      'ev-whine',
      'train',
      'seagull',
    ]
    for (const name of vocabulary) {
      expect(resolveOneShotId(name), `${name} should resolve`).not.toBeNull()
    }
  })

  it('resolves documented aliases to canonical ids', () => {
    for (const [alias, target] of Object.entries(ONE_SHOT_ALIASES)) {
      expect(ONE_SHOT_IDS).toContain(target)
      expect(resolveOneShotId(alias), alias).toBe(target)
      expect(resolveOneShotId(alias.toUpperCase()), `${alias} is case-insensitive`).toBe(target)
    }
  })

  it('rejects unknown or mistyped ids deterministically', () => {
    expect(resolveOneShotId('laser')).toBeNull()
    expect(resolveOneShotId('')).toBeNull()
    expect(isOneShotId(42)).toBe(false)

    const unknown = validateOneShotId('laser')
    expect(unknown.valid).toBe(false)
    expect(unknown.id).toBeNull()
    expect(unknown.issues[0]?.code).toBe('unknown-id')
    expect(unknown.issues[0]?.message).toContain('Known ids')

    const mistyped = validateOneShotId(null)
    expect(mistyped.valid).toBe(false)
    expect(mistyped.issues[0]?.code).toBe('wrong-type')

    const ok = validateOneShotId('trolley-bell')
    expect(ok.valid).toBe(true)
    expect(ok.id).toBe('streetcar-bell')
    expect(ok.issues).toEqual([])
  })
})

describe('normalised descriptor typing', () => {
  it('produces a record the renderer can consume without further checks', () => {
    const value: NormalizedSoundscapeDescriptor = parseSoundscapeDescriptor(ERA_BEDS['traffic hum'])
    expect(value.layers.every((layer) => layer.level > 0)).toBe(true)
    const oscillators = value.layers.filter((layer) => layer.type === 'oscillator')
    const noise = value.layers.filter((layer) => layer.type === 'noise')
    expect(oscillators.length + noise.length).toBe(value.layers.length)
    expect(noise.every((layer) => layer.color === 'brown' || layer.color === 'pink')).toBe(true)
  })
})
