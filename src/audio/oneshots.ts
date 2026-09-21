/**
 * Synthesised one-shot SFX library.
 *
 * Every effect is a small WebAudio patch built from oscillators, generated
 * noise and gain/filter envelopes — no audio files are shipped or fetched. A
 * patch renders into one {@link OneShotVoice} that the engine tracks, so live
 * voices can be counted, released early and disposed without leaking nodes
 * across era switches.
 *
 * Patches are parameterised by a playback `rate` (pitch and length) and render
 * their amplitude envelope on the voice output, which lets the engine apply
 * per-shot gain and pan on top without touching the patch.
 */

import { clamp, createLfo, disconnectNode, holdParam, rampGain, PARAM_FLOOR } from './beds'
import { ONE_SHOT_ALIASES, ONE_SHOT_IDS } from './types'
import type { NoiseColor, OneShotId } from './types'

/** Extra time a voice keeps its nodes alive after its nominal length. */
export const VOICE_TAIL_SECONDS = 0.15

/** Fade applied by `release()` when a voice is stopped early. */
export const VOICE_RELEASE_SECONDS = 0.04

/** Descriptive metadata for one library entry. */
export interface OneShotDefinition {
  readonly id: OneShotId
  /** Label for the harness / UI. */
  readonly label: string
  /** What the patch sounds like, for reviewers and sound designers. */
  readonly description: string
  /** Nominal length in seconds at rate 1. */
  readonly durationSeconds: number
  /** Era flavour tags: what kind of period sound this stands in for. */
  readonly categories: readonly string[]
}

/** The library, keyed by canonical id. */
export const ONE_SHOT_DEFINITIONS: Readonly<Record<OneShotId, OneShotDefinition>> = {
  horn: {
    id: 'horn',
    label: 'Car horn',
    description: 'Detuned sawtooth triad through a lowpass with a short pitch bend.',
    durationSeconds: 0.6,
    categories: ['traffic', 'street'],
  },
  'streetcar-bell': {
    id: 'streetcar-bell',
    label: 'Streetcar bell',
    description: 'Two struck bell tones with inharmonic sine partials.',
    durationSeconds: 1.4,
    categories: ['transit', 'street'],
  },
  engine: {
    id: 'engine',
    label: 'Combustion engine',
    description: 'Sawtooth idle-to-rev sweep plus bandpassed brown-noise roughness.',
    durationSeconds: 1.7,
    categories: ['traffic'],
  },
  jackhammer: {
    id: 'jackhammer',
    label: 'Jackhammer',
    description: 'Twelve gated thump-and-hiss pulses from a square wave and white noise.',
    durationSeconds: 1.4,
    categories: ['construction'],
  },
  'door-bell': {
    id: 'door-bell',
    label: 'Door bell',
    description: 'Two-note chime with a mallet click transient.',
    durationSeconds: 1.9,
    categories: ['interior', 'storefront'],
  },
  'crowd-cheer': {
    id: 'crowd-cheer',
    label: 'Crowd cheer',
    description: 'Bandpassed pink-noise swell with tremolo and a bright layer.',
    durationSeconds: 2.3,
    categories: ['crowd'],
  },
  birds: {
    id: 'birds',
    label: 'Birdsong',
    description: 'Six pitch-swept sine chirps with randomised spacing and vibrato.',
    durationSeconds: 1.9,
    categories: ['nature'],
  },
  siren: {
    id: 'siren',
    label: 'Emergency siren',
    description: 'Triangle wail sweeping between two tones, banded with a sawtooth partner.',
    durationSeconds: 2.6,
    categories: ['emergency', 'street'],
  },
  train: {
    id: 'train',
    label: 'Train',
    description: 'Low rumble, bogie drone with vibrato, wheel clatter and a two-tone call.',
    durationSeconds: 2.8,
    categories: ['transit'],
  },
  seagull: {
    id: 'seagull',
    label: 'Seagull',
    description: 'Three descending squawks mixing a swept sine with bandpassed noise.',
    durationSeconds: 1.6,
    categories: ['nature', 'waterfront'],
  },
  'ev-whine': {
    id: 'ev-whine',
    label: 'EV whine',
    description: 'Rising sine whine with a triangle harmonic and faint road noise.',
    durationSeconds: 1.7,
    categories: ['traffic', 'future'],
  },
}

/** Resolves a canonical id or documented alias; null when unknown. */
export function resolveOneShotId(value: string): OneShotId | null {
  if ((ONE_SHOT_IDS as readonly string[]).includes(value)) {
    return value as OneShotId
  }
  const normalized = value.trim().toLowerCase()
  return ONE_SHOT_ALIASES[normalized] ?? null
}

/** Type guard for ids the library can synthesise. */
export function isOneShotId(value: unknown): value is OneShotId {
  return typeof value === 'string' && resolveOneShotId(value) !== null
}

/** Attack / hold / exponential-release envelope shape. */
interface Envelope {
  readonly peak: number
  readonly attack: number
  readonly hold?: number
  readonly release: number
}

/** Schedules an envelope that starts and ends in silence. */
function scheduleEnvelope(param: AudioParam, when: number, envelope: Envelope): void {
  const attack = Math.max(envelope.attack, 0.001)
  const hold = Math.max(envelope.hold ?? 0, 0)
  const release = Math.max(envelope.release, 0.02)
  const peak = Math.max(envelope.peak, PARAM_FLOOR)
  param.cancelScheduledValues(when)
  param.setValueAtTime(PARAM_FLOOR, when)
  param.linearRampToValueAtTime(peak, when + attack)
  const holdEnd = when + attack + hold
  if (hold > 0) {
    param.setValueAtTime(peak, holdEnd)
  }
  param.exponentialRampToValueAtTime(PARAM_FLOOR, holdEnd + release)
}

/**
 * Node factory for a patch. Everything a patch creates is registered here, so
 * the engine can dispose a voice completely.
 */
class SynthRig {
  readonly nodes: AudioNode[] = []
  readonly sources: AudioScheduledSourceNode[] = []

  private readonly context: AudioContext
  private readonly noiseBuffer: (color: NoiseColor) => AudioBuffer
  private readonly random: () => number

  constructor(
    context: AudioContext,
    noiseBuffer: (color: NoiseColor) => AudioBuffer,
    random: () => number,
  ) {
    this.context = context
    this.noiseBuffer = noiseBuffer
    this.random = random
  }

  /** Deterministic-per-engine uniform float in `[min, max)`. */
  float(min: number, max: number): number {
    return min + this.random() * (max - min)
  }

  oscillator(waveform: OscillatorType, frequency: number, detune = 0): OscillatorNode {
    const node = this.context.createOscillator()
    node.type = waveform
    node.frequency.value = frequency
    node.detune.value = detune
    this.nodes.push(node)
    this.sources.push(node)
    return node
  }

  noise(color: NoiseColor): AudioBufferSourceNode {
    const node = this.context.createBufferSource()
    node.buffer = this.noiseBuffer(color)
    node.loop = true
    this.nodes.push(node)
    this.sources.push(node)
    return node
  }

  gain(value: number): GainNode {
    const node = this.context.createGain()
    node.gain.value = value
    this.nodes.push(node)
    return node
  }

  filter(type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode {
    const node = this.context.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    this.nodes.push(node)
    return node
  }

  /** Adds an LFO to a parameter; the voice owner starts every rig source. */
  lfo(rate: number, depth: number, target: AudioParam): OscillatorNode {
    const chain = createLfo(this.context, { rate, depth, waveform: 'sine' }, target)
    this.nodes.push(chain.oscillator, chain.depth)
    this.sources.push(chain.oscillator)
    return chain.oscillator
  }
}

/** Timing bag handed to a patch. */
interface PatchTiming {
  readonly rate: number
  /** Nominal length in seconds, already rate-scaled. */
  readonly duration: number
}

/** A patch renders one voice: `voice` is the envelope-carrying output gain. */
type OneShotPatch = (rig: SynthRig, voice: GainNode, when: number, timing: PatchTiming) => void

const PATCHES: Readonly<Record<OneShotId, OneShotPatch>> = {
  horn: (rig, voice, when, timing) => {
    const shape = rig.filter('lowpass', 2200 * timing.rate, 0.9)
    shape.connect(voice)
    const partials = [
      { frequency: 440 * timing.rate, detune: 0, level: 0.45 },
      { frequency: 554 * timing.rate, detune: 6, level: 0.3 },
      { frequency: 220 * timing.rate, detune: -4, level: 0.4 },
    ]
    for (const partial of partials) {
      const oscillator = rig.oscillator('sawtooth', partial.frequency, partial.detune)
      const level = rig.gain(partial.level)
      oscillator.connect(level)
      level.connect(shape)
      oscillator.frequency.setValueAtTime(partial.frequency, when)
      oscillator.frequency.linearRampToValueAtTime(partial.frequency * 0.985, when + timing.duration * 0.85)
    }
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.025,
      hold: timing.duration * 0.55,
      release: timing.duration * 0.32,
    })
  },

  'streetcar-bell': (rig, voice, when, timing) => {
    const base = 1180 * timing.rate
    const partials = [
      { ratio: 1, level: 0.7 },
      { ratio: 1.51, level: 0.32 },
      { ratio: 2.03, level: 0.18 },
    ]
    for (const offset of [0, 0.45]) {
      const strikeAt = when + offset / timing.rate
      const strike = rig.gain(1)
      strike.connect(voice)
      scheduleEnvelope(strike.gain, strikeAt, {
        peak: 0.55,
        attack: 0.004,
        hold: 0.012,
        release: 0.85 / timing.rate,
      })
      for (const partial of partials) {
        const frequency = base * partial.ratio
        const oscillator = rig.oscillator('sine', frequency, rig.float(-3, 3))
        const level = rig.gain(partial.level)
        oscillator.connect(level)
        level.connect(strike)
        oscillator.frequency.setValueAtTime(frequency, strikeAt)
        oscillator.frequency.linearRampToValueAtTime(frequency * 0.997, strikeAt + 0.6 / timing.rate)
      }
    }
  },

  engine: (rig, voice, when, timing) => {
    const body = rig.filter('lowpass', 420 * timing.rate, 1.5)
    body.connect(voice)
    const fundamental = rig.oscillator('sawtooth', 48 * timing.rate, 0)
    const harmonic = rig.oscillator('sawtooth', 96 * timing.rate, 7)
    const fundamentalLevel = rig.gain(0.65)
    const harmonicLevel = rig.gain(0.15)
    fundamental.connect(fundamentalLevel)
    fundamentalLevel.connect(body)
    harmonic.connect(harmonicLevel)
    harmonicLevel.connect(body)
    const sweeps = [
      [fundamental, 48, 98] as const,
      [harmonic, 96, 196] as const,
    ]
    for (const [oscillator, start, peak] of sweeps) {
      oscillator.frequency.setValueAtTime(start * timing.rate, when)
      oscillator.frequency.linearRampToValueAtTime(peak * timing.rate, when + timing.duration * 0.3)
      oscillator.frequency.linearRampToValueAtTime((start + 8) * timing.rate, when + timing.duration)
    }
    rig.lfo(9.5, 3.5, fundamental.detune)
    const roughness = rig.noise('brown')
    const roughnessFilter = rig.filter('bandpass', 175 * timing.rate, 0.9)
    const roughnessLevel = rig.gain(0.3)
    roughness.connect(roughnessFilter)
    roughnessFilter.connect(roughnessLevel)
    roughnessLevel.connect(voice)
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.07,
      hold: timing.duration * 0.5,
      release: timing.duration * 0.38,
    })
  },

  jackhammer: (rig, voice, when, timing) => {
    const pulseCount = 12
    const spacing = (timing.duration * 0.78) / pulseCount
    const thump = rig.oscillator('square', 62 * timing.rate, 0)
    const thumpFilter = rig.filter('lowpass', 320 * timing.rate, 1)
    const thumpLevel = rig.gain(0.55)
    thump.connect(thumpFilter)
    thumpFilter.connect(thumpLevel)
    const hiss = rig.noise('white')
    const hissFilter = rig.filter('bandpass', 1500 * timing.rate, 0.8)
    const hissLevel = rig.gain(0.3)
    hiss.connect(hissFilter)
    hissFilter.connect(hissLevel)
    voice.gain.setValueAtTime(1, when)
    for (let index = 0; index < pulseCount; index += 1) {
      const pulseAt = when + index * spacing
      const pulse = rig.gain(1)
      pulse.connect(voice)
      thumpLevel.connect(pulse)
      hissLevel.connect(pulse)
      scheduleEnvelope(pulse.gain, pulseAt, {
        peak: 1,
        attack: 0.002,
        hold: 0.012,
        release: Math.max(spacing * 0.6, 0.02),
      })
    }
  },

  'door-bell': (rig, voice, when, timing) => {
    const notes = [
      { frequency: 659.25, at: 0 },
      { frequency: 523.25, at: 0.55 },
    ]
    const partials = [
      { ratio: 1, level: 0.85 },
      { ratio: 2.01, level: 0.25 },
      { ratio: 2.98, level: 0.08 },
    ]
    for (const note of notes) {
      const noteAt = when + note.at / timing.rate
      const tone = rig.gain(1)
      tone.connect(voice)
      scheduleEnvelope(tone.gain, noteAt, {
        peak: 0.5,
        attack: 0.005,
        hold: 0.04,
        release: 1.1 / timing.rate,
      })
      for (const partial of partials) {
        const oscillator = rig.oscillator('sine', note.frequency * timing.rate * partial.ratio, 0)
        const level = rig.gain(partial.level)
        oscillator.connect(level)
        level.connect(tone)
      }
      const click = rig.noise('white')
      const clickFilter = rig.filter('highpass', 2500 * timing.rate, 0.7)
      const clickLevel = rig.gain(0.12)
      click.connect(clickFilter)
      clickFilter.connect(clickLevel)
      clickLevel.connect(tone)
    }
  },

  'crowd-cheer': (rig, voice, when, timing) => {
    const tremolo = rig.gain(0.75)
    tremolo.connect(voice)
    rig.lfo(6.2, 0.22, tremolo.gain)
    const body = rig.noise('pink')
    const bodyFilter = rig.filter('bandpass', 900 * timing.rate, 0.7)
    const bodyLevel = rig.gain(0.95)
    body.connect(bodyFilter)
    bodyFilter.connect(bodyLevel)
    bodyLevel.connect(tremolo)
    const shimmer = rig.noise('white')
    const shimmerFilter = rig.filter('bandpass', 2600 * timing.rate, 1.2)
    const shimmerLevel = rig.gain(0.22)
    shimmer.connect(shimmerFilter)
    shimmerFilter.connect(shimmerLevel)
    shimmerLevel.connect(tremolo)
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.3,
      hold: timing.duration * 0.35,
      release: timing.duration * 0.4,
    })
  },

  birds: (rig, voice, when, timing) => {
    const chirpCount = 6
    const spacing = (timing.duration * 0.72) / chirpCount
    for (let index = 0; index < chirpCount; index += 1) {
      const chirpAt = when + index * spacing + rig.float(0, spacing * 0.25)
      const base = rig.float(2100, 2900) * timing.rate
      const oscillator = rig.oscillator('sine', base, 0)
      oscillator.frequency.setValueAtTime(base * 0.9, chirpAt)
      oscillator.frequency.linearRampToValueAtTime(base * 1.28, chirpAt + 0.045 / timing.rate)
      oscillator.frequency.linearRampToValueAtTime(base * 0.78, chirpAt + 0.13 / timing.rate)
      rig.lfo(38, 90, oscillator.detune)
      const chirp = rig.gain(1)
      oscillator.connect(chirp)
      chirp.connect(voice)
      scheduleEnvelope(chirp.gain, chirpAt, {
        peak: 0.32,
        attack: 0.008,
        hold: 0.03 / timing.rate,
        release: 0.09 / timing.rate,
      })
    }
  },

  siren: (rig, voice, when, timing) => {
    const low = 640 * timing.rate
    const high = 1180 * timing.rate
    const cycle = 0.72 / timing.rate
    const wail = rig.oscillator('triangle', low, 0)
    const partner = rig.oscillator('sawtooth', low * 1.5, 9)
    const partnerLevel = rig.gain(0.28)
    const band = rig.filter('bandpass', 1100 * timing.rate, 1.1)
    band.connect(voice)
    wail.connect(band)
    partner.connect(partnerLevel)
    partnerLevel.connect(band)
    wail.frequency.setValueAtTime(low, when)
    partner.frequency.setValueAtTime(low * 1.5, when)
    let cursor = when
    let rising = true
    const step = cycle * 0.5
    while (cursor < when + timing.duration - step) {
      const next = rising ? high : low
      wail.frequency.linearRampToValueAtTime(next, cursor + step)
      partner.frequency.linearRampToValueAtTime(next * 1.5, cursor + step)
      cursor += step
      rising = !rising
    }
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.2,
      hold: timing.duration * 0.6,
      release: timing.duration * 0.32,
    })
  },

  train: (rig, voice, when, timing) => {
    const rumble = rig.noise('brown')
    const rumbleFilter = rig.filter('lowpass', 260 * timing.rate, 0.8)
    const rumbleLevel = rig.gain(0.9)
    rumble.connect(rumbleFilter)
    rumbleFilter.connect(rumbleLevel)
    rumbleLevel.connect(voice)

    const hull = rig.oscillator('sine', 44 * timing.rate, 0)
    const hullLevel = rig.gain(0.4)
    hull.connect(hullLevel)
    hullLevel.connect(voice)
    rig.lfo(5.2, 6, hull.frequency)

    const clatter = rig.noise('white')
    const clatterFilter = rig.filter('bandpass', 1700 * timing.rate, 1.3)
    const clatterLevel = rig.gain(0.35)
    clatter.connect(clatterFilter)
    clatterFilter.connect(clatterLevel)
    const clatterCount = 9
    const clatterSpacing = (timing.duration * 0.7) / clatterCount
    for (let index = 0; index < clatterCount; index += 1) {
      const clatterAt = when + index * clatterSpacing
      const pulse = rig.gain(1)
      pulse.connect(voice)
      clatterLevel.connect(pulse)
      scheduleEnvelope(pulse.gain, clatterAt, {
        peak: 1,
        attack: 0.002,
        hold: 0.008,
        release: Math.max(clatterSpacing * 0.35, 0.02),
      })
    }

    const hornAt = when + timing.duration * 0.3
    const hornFilter = rig.filter('lowpass', 1400 * timing.rate, 0.8)
    const hornLevel = rig.gain(1)
    hornFilter.connect(hornLevel)
    hornLevel.connect(voice)
    const hornPartials = [
      { frequency: 311, level: 0.5 },
      { frequency: 415, level: 0.35 },
    ]
    for (const partial of hornPartials) {
      const oscillator = rig.oscillator('sawtooth', partial.frequency * timing.rate, 0)
      const level = rig.gain(partial.level)
      oscillator.connect(level)
      level.connect(hornFilter)
    }
    scheduleEnvelope(hornLevel.gain, hornAt, {
      peak: 0.55,
      attack: 0.12,
      hold: timing.duration * 0.25,
      release: timing.duration * 0.25,
    })
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.35,
      hold: timing.duration * 0.5,
      release: timing.duration * 0.35,
    })
  },

  seagull: (rig, voice, when, timing) => {
    const calls = [
      { at: 0, pitch: 1 },
      { at: 0.72, pitch: 0.9 },
      { at: 1.24, pitch: 0.95 },
    ]
    for (const call of calls) {
      const callAt = when + call.at / timing.rate
      const callGain = rig.gain(1)
      callGain.connect(voice)
      const squawk = rig.oscillator('sine', 1600 * timing.rate * call.pitch, 0)
      squawk.frequency.setValueAtTime(1750 * timing.rate * call.pitch, callAt)
      squawk.frequency.linearRampToValueAtTime(900 * timing.rate * call.pitch, callAt + 0.26 / timing.rate)
      rig.lfo(11, 60, squawk.frequency)
      const squawkLevel = rig.gain(0.5)
      squawk.connect(squawkLevel)
      squawkLevel.connect(callGain)
      const breath = rig.noise('white')
      const breathFilter = rig.filter('bandpass', 1900 * timing.rate, 1.6)
      const breathLevel = rig.gain(0.3)
      breath.connect(breathFilter)
      breathFilter.connect(breathLevel)
      breathLevel.connect(callGain)
      scheduleEnvelope(callGain.gain, callAt, {
        peak: 0.42,
        attack: 0.02,
        hold: 0.07 / timing.rate,
        release: 0.24 / timing.rate,
      })
    }
  },

  'ev-whine': (rig, voice, when, timing) => {
    const whine = rig.oscillator('sine', 1900 * timing.rate, 0)
    whine.frequency.setValueAtTime(1900 * timing.rate, when)
    whine.frequency.linearRampToValueAtTime(3200 * timing.rate, when + timing.duration * 0.72)
    whine.frequency.linearRampToValueAtTime(2950 * timing.rate, when + timing.duration)
    rig.lfo(17, 26, whine.detune)
    const tone = rig.filter('lowpass', 6200 * timing.rate, 0.7)
    tone.connect(voice)
    whine.connect(tone)
    const harmonic = rig.oscillator('triangle', 3800 * timing.rate, 4)
    const harmonicLevel = rig.gain(0.12)
    harmonic.connect(harmonicLevel)
    harmonicLevel.connect(tone)
    const road = rig.noise('pink')
    const roadFilter = rig.filter('bandpass', 3200 * timing.rate, 0.9)
    const roadLevel = rig.gain(0.07)
    road.connect(roadFilter)
    roadFilter.connect(roadLevel)
    roadLevel.connect(voice)
    scheduleEnvelope(voice.gain, when, {
      peak: 1,
      attack: 0.14,
      hold: timing.duration * 0.58,
      release: timing.duration * 0.32,
    })
  },
}

/** Render inputs for one voice; the engine supplies the shared noise cache. */
export interface OneShotRenderOptions {
  /** Bus the voice is mixed into; normally the SFX bus. */
  readonly destination: AudioNode
  /** Context time the voice starts at. */
  readonly when: number
  /** Per-shot gain `0..2`. */
  readonly gain: number
  /** Per-shot stereo position `-1..1`. */
  readonly pan: number
  /** Playback rate multiplier. */
  readonly rate: number
  /** Random source used for per-shot variation. */
  readonly random: () => number
  /** Engine-owned cache of generated noise buffers. */
  readonly noiseBuffer: (color: NoiseColor) => AudioBuffer
}

/** One live synthesised one-shot voice. */
export interface OneShotVoice {
  readonly id: OneShotId
  /** Envelope-carrying output gain of the patch. */
  readonly output: GainNode
  /** Every node the voice created. */
  readonly nodes: readonly AudioNode[]
  /** Every scheduled source the voice created. */
  readonly sources: readonly AudioScheduledSourceNode[]
  readonly startedAt: number
  /** Context time the voice is guaranteed to be silent by. */
  readonly endsAt: number
  /** Nominal length in seconds, rate-scaled. */
  readonly durationSeconds: number
  readonly disposed: boolean
  /** Fades the voice out early; safe to call repeatedly. */
  release(when?: number): void
  /** Stops and disconnects every node the voice owns. */
  dispose(): void
}

class SynthesizedVoice implements OneShotVoice {
  readonly id: OneShotId
  readonly output: GainNode
  readonly nodes: AudioNode[]
  readonly sources: AudioScheduledSourceNode[]
  readonly startedAt: number
  readonly durationSeconds: number

  private endedAt: number
  private isDisposed = false
  private released = false

  constructor(
    id: OneShotId,
    output: GainNode,
    nodes: AudioNode[],
    sources: AudioScheduledSourceNode[],
    startedAt: number,
    durationSeconds: number,
  ) {
    this.id = id
    this.output = output
    this.nodes = nodes
    this.sources = sources
    this.startedAt = startedAt
    this.durationSeconds = durationSeconds
    this.endedAt = startedAt + durationSeconds + VOICE_TAIL_SECONDS
    for (const source of sources) {
      source.start(startedAt)
      source.stop(this.endedAt)
    }
  }

  get endsAt(): number {
    return this.endedAt
  }

  get disposed(): boolean {
    return this.isDisposed
  }

  release(when: number = this.startedAt): void {
    if (this.released || this.isDisposed) {
      return
    }
    this.released = true
    const at = Math.max(when, this.startedAt)
    holdParam(this.output.gain, at)
    rampGain(this.output.gain, 0, at, at + VOICE_RELEASE_SECONDS)
    const stopAt = at + VOICE_RELEASE_SECONDS + 0.02
    for (const source of this.sources) {
      source.stop(stopAt)
    }
    this.endedAt = Math.min(this.endedAt, stopAt)
  }

  dispose(): void {
    if (this.isDisposed) {
      return
    }
    this.isDisposed = true
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        // A source that never started cannot be stopped; disposal continues.
      }
    }
    for (const node of this.nodes) {
      disconnectNode(node)
    }
  }
}

/**
 * Builds the patch for `id`, starts every source at `options.when` and returns
 * the voice the engine tracks. Gain and pan are applied after the patch, so
 * each patch stays a normalised, reusable sound design.
 */
export function renderOneShot(
  context: AudioContext,
  id: OneShotId,
  options: OneShotRenderOptions,
): OneShotVoice {
  const definition = ONE_SHOT_DEFINITIONS[id]
  const rate = clamp(options.rate, 0.25, 4)
  const gain = clamp(options.gain, 0, 2)
  const pan = clamp(options.pan, -1, 1)
  const durationSeconds = definition.durationSeconds / rate

  const output = context.createGain()
  output.gain.value = PARAM_FLOOR
  const panner = context.createStereoPanner()
  panner.pan.value = pan
  const level = context.createGain()
  level.gain.value = gain
  output.connect(panner)
  panner.connect(level)
  level.connect(options.destination)

  const rig = new SynthRig(context, options.noiseBuffer, options.random)
  const timing: PatchTiming = { rate, duration: durationSeconds }
  PATCHES[id](rig, output, options.when, timing)

  const nodes: AudioNode[] = [output, panner, level, ...rig.nodes]
  return new SynthesizedVoice(id, output, nodes, rig.sources, options.when, durationSeconds)
}
