/**
 * Ambience bed synthesis.
 *
 * A bed turns one validated {@link NormalizedSoundscapeDescriptor} into a graph
 * of oscillators, generated-noise loops, layer gains, filters and optional
 * modulation LFOs. Nothing is sampled: every sound is built from WebAudio nodes
 * at runtime, so the engine ships no audio files and can render any descriptor
 * an era registry invents.
 *
 * This module also owns the small synthesis primitives (parameter ramps, noise
 * buffers, LFO chains) that the one-shot library reuses, because the ambience
 * beds are their primary consumer.
 */

import type {
  NoiseColor,
  NormalizedFilter,
  NormalizedModulation,
  NormalizedNoiseLayer,
  NormalizedOscillatorLayer,
  NormalizedSoundscapeDescriptor,
  OscillatorWaveform,
} from './types'

/** Lowest value a gain ramp approaches; exponential ramps cannot reach zero. */
export const PARAM_FLOOR = 0.0001

/** Length of every generated noise loop, in seconds. */
export const NOISE_LOOP_SECONDS = 2

/** Time a source keeps running after its gain has reached zero. */
export const SOURCE_TAIL_SECONDS = 0.05

/** Constrains a value to an inclusive range; input is expected to be finite. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

/** Detaches a node, tolerating nodes that were already disconnected. */
export function disconnectNode(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Already detached; disposal must stay idempotent.
  }
}

/**
 * Cancels pending automation and pins the parameter at its current value.
 * Uses `cancelAndHoldAtTime` where available so a crossfade that interrupts
 * another crossfade starts from the audible level instead of jumping.
 */
export function holdParam(param: AudioParam, time: number): void {
  const holder = param as AudioParam & { cancelAndHoldAtTime?: (when: number) => unknown }
  if (typeof holder.cancelAndHoldAtTime === 'function') {
    holder.cancelAndHoldAtTime(time)
    return
  }
  const current = Number.isFinite(param.value) ? param.value : 0
  param.cancelScheduledValues(time)
  param.setValueAtTime(current, time)
}

/** Ramps a parameter to `target`, finishing exactly at `endTime`. */
export function rampGain(param: AudioParam, target: number, startTime: number, endTime: number): void {
  holdParam(param, startTime)
  if (endTime <= startTime) {
    param.setValueAtTime(target, startTime)
    return
  }
  param.linearRampToValueAtTime(target, endTime)
}

/** Schedules a linear ramp between two explicit points in time. */
export function scheduleRamp(param: AudioParam, from: number, to: number, startTime: number, endTime: number): void {
  param.setValueAtTime(from, startTime)
  if (endTime <= startTime) {
    param.setValueAtTime(to, startTime)
    return
  }
  param.linearRampToValueAtTime(to, endTime)
}

/**
 * Generates a seamless-enough noise loop for one of the documented colours.
 * Buffers are cached by the engine, so repeated era switches reuse them.
 */
export function createNoiseBuffer(
  context: BaseAudioContext,
  color: NoiseColor,
  random: () => number,
  seconds: number = NOISE_LOOP_SECONDS,
): AudioBuffer {
  const sampleRate = context.sampleRate > 0 ? context.sampleRate : 44100
  const length = Math.max(1, Math.round(sampleRate * Math.max(seconds, 0.05)))
  const buffer = context.createBuffer(1, length, sampleRate)
  fillNoise(buffer.getChannelData(0), color, random)
  return buffer
}

function fillNoise(data: Float32Array, color: NoiseColor, random: () => number): void {
  switch (color) {
    case 'pink': {
      // Paul Kellet's refined method: a cheap, well-behaved 1/f approximation.
      let b0 = 0
      let b1 = 0
      let b2 = 0
      let b3 = 0
      let b4 = 0
      let b5 = 0
      let b6 = 0
      for (let index = 0; index < data.length; index += 1) {
        const white = random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
      return
    }
    case 'brown': {
      // Leaky integrator: low-frequency rumble for traffic, trains and thunder.
      let last = 0
      for (let index = 0; index < data.length; index += 1) {
        const white = random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[index] = last * 3.5
      }
      return
    }
    default: {
      for (let index = 0; index < data.length; index += 1) {
        data[index] = random() * 2 - 1
      }
    }
  }
}

/** An LFO wired to a destination parameter. */
export interface LfoChain {
  readonly oscillator: OscillatorNode
  readonly depth: GainNode
}

/**
 * Creates an LFO whose output is added to `target`. The oscillator is not
 * started here: owners start every source they create at a known context time
 * and stop it again on dispose, which keeps voice counting exact.
 */
export function createLfo(
  context: AudioContext,
  modulation: NormalizedModulation,
  target: AudioParam,
): LfoChain {
  const oscillator = context.createOscillator()
  oscillator.type = modulation.waveform
  oscillator.frequency.value = modulation.rate
  const depth = context.createGain()
  depth.gain.value = modulation.depth
  oscillator.connect(depth)
  depth.connect(target)
  return { oscillator, depth }
}

/** A biquad filter plus any nodes created for its cutoff modulation. */
export interface FilterChain {
  readonly node: BiquadFilterNode
  readonly nodes: readonly AudioNode[]
  readonly sources: readonly AudioScheduledSourceNode[]
}

/** Builds a filter stage, including the LFO of its own modulation. */
export function createFilterChain(context: AudioContext, descriptor: NormalizedFilter): FilterChain {
  const node = context.createBiquadFilter()
  node.type = descriptor.type
  node.frequency.value = descriptor.frequency
  node.Q.value = descriptor.q
  node.gain.value = descriptor.gain

  const nodes: AudioNode[] = [node]
  const sources: AudioScheduledSourceNode[] = []
  if (descriptor.modulation !== null) {
    const lfo = createLfo(context, descriptor.modulation, node.frequency)
    nodes.push(lfo.oscillator, lfo.depth)
    sources.push(lfo.oscillator)
  }
  return { node, nodes, sources }
}

/** Construction inputs for {@link createAmbienceBed}. */
export interface AmbienceBedOptions {
  /** Bus the bed is mixed into; normally the ambience bus. */
  readonly destination: AudioNode
  /** Context time the bed starts at. */
  readonly when: number
  /** Fade-in seconds. */
  readonly fadeSeconds: number
  /** Target bed level, taken from the descriptor gain. */
  readonly gain: number
  /** Random source used while generating noise buffers. */
  readonly random: () => number
  /** Engine-owned cache of noise buffers, keyed by colour. */
  readonly noiseBuffer: (color: NoiseColor) => AudioBuffer
}

/**
 * One live ambience bed. The engine keeps at most one active bed and retires
 * the previous one with {@link AmbienceBed.fadeOut} so era switches crossfade.
 */
export interface AmbienceBed {
  readonly id: string
  /** Bed output gain; every layer is mixed into it. */
  readonly gain: GainNode
  /** Context time the bed started at. */
  readonly startedAt: number
  /** Context time the bed falls silent, or null while it is still playing. */
  readonly endsAt: number | null
  readonly disposed: boolean
  /** Every node the bed created, in creation order. */
  readonly nodes: readonly AudioNode[]
  /** Every scheduled source the bed created. */
  readonly sources: readonly AudioScheduledSourceNode[]
  /** Sources still scheduled to run. */
  readonly voiceCount: number
  /** Ramps the bed level to a new value. */
  setLevel(level: number, seconds: number, now: number): void
  /** Ramps to silence, stops every source; returns the silence time. */
  fadeOut(seconds: number, now: number): number
  /** Stops and disconnects every node the bed owns. */
  dispose(): void
}

class DescriptorAmbienceBed implements AmbienceBed {
  readonly id: string
  readonly gain: GainNode
  readonly startedAt: number
  readonly nodes: AudioNode[]
  readonly sources: AudioScheduledSourceNode[]

  private endedAt: number | null = null
  private isDisposed = false
  private readonly stopped: AudioScheduledSourceNode[] = []

  constructor(
    context: AudioContext,
    descriptor: NormalizedSoundscapeDescriptor,
    options: AmbienceBedOptions,
  ) {
    this.id = descriptor.id
    this.startedAt = options.when
    this.nodes = []
    this.sources = []

    const output = context.createGain()
    output.gain.value = PARAM_FLOOR
    output.connect(options.destination)
    this.gain = output
    this.nodes.push(output)

    let head: AudioNode = output
    if (descriptor.filter !== null) {
      const chain = createFilterChain(context, descriptor.filter)
      chain.node.connect(output)
      head = chain.node
      this.track(chain.nodes, chain.sources)
      if (descriptor.modulation !== null) {
        const lfo = createLfo(context, descriptor.modulation, chain.node.frequency)
        this.track([lfo.oscillator, lfo.depth], [lfo.oscillator])
      }
    }

    for (const layer of descriptor.layers) {
      if (layer.type === 'oscillator') {
        this.addOscillatorLayer(context, layer, head)
      } else {
        this.addNoiseLayer(context, layer, head, options)
      }
    }

    for (const source of this.sources) {
      source.start(options.when)
    }
    rampGain(output.gain, options.gain, options.when, options.when + Math.max(0, options.fadeSeconds))
  }

  get endsAt(): number | null {
    return this.endedAt
  }

  get disposed(): boolean {
    return this.isDisposed
  }

  get voiceCount(): number {
    return this.sources.length - this.stopped.length
  }

  setLevel(level: number, seconds: number, now: number): void {
    if (this.isDisposed) {
      return
    }
    rampGain(this.gain.gain, clamp(level, 0, 2), now, now + Math.max(0, seconds))
  }

  fadeOut(seconds: number, now: number): number {
    if (this.isDisposed) {
      return now
    }
    const at = Math.max(now, this.startedAt)
    const duration = Math.max(0, seconds)
    rampGain(this.gain.gain, 0, at, at + duration)
    const stopAt = at + duration + SOURCE_TAIL_SECONDS
    for (const source of this.sources) {
      this.stopSource(source, stopAt)
    }
    this.endedAt = stopAt
    return stopAt
  }

  dispose(): void {
    if (this.isDisposed) {
      return
    }
    this.isDisposed = true
    for (const source of this.sources) {
      this.stopSource(source, undefined)
    }
    for (const node of this.nodes) {
      disconnectNode(node)
    }
    this.stopped.length = 0
  }

  private addOscillatorLayer(
    context: AudioContext,
    layer: NormalizedOscillatorLayer,
    head: AudioNode,
  ): void {
    const oscillator = context.createOscillator()
    oscillator.type = layer.waveform
    oscillator.frequency.value = layer.frequency
    oscillator.detune.value = layer.detune

    const level = context.createGain()
    level.gain.value = layer.level
    oscillator.connect(level)
    level.connect(head)
    this.track([oscillator, level], [oscillator])

    if (layer.vibrato !== null) {
      const vibrato: NormalizedModulation = {
        rate: layer.vibrato.rate,
        depth: layer.vibrato.depth,
        waveform: 'sine' as OscillatorWaveform,
      }
      const lfo = createLfo(context, vibrato, oscillator.detune)
      this.track([lfo.oscillator, lfo.depth], [lfo.oscillator])
    }
  }

  private addNoiseLayer(
    context: AudioContext,
    layer: NormalizedNoiseLayer,
    head: AudioNode,
    options: AmbienceBedOptions,
  ): void {
    const source = context.createBufferSource()
    source.buffer = options.noiseBuffer(layer.color)
    source.loop = true

    const level = context.createGain()
    level.gain.value = layer.level
    const nodes: AudioNode[] = [source, level]
    const sources: AudioScheduledSourceNode[] = [source]

    if (layer.filter !== null) {
      const chain = createFilterChain(context, layer.filter)
      source.connect(chain.node)
      chain.node.connect(level)
      nodes.push(...chain.nodes)
      sources.push(...chain.sources)
    } else {
      source.connect(level)
    }
    level.connect(head)
    this.track(nodes, sources)
  }

  private track(nodes: readonly AudioNode[], sources: readonly AudioScheduledSourceNode[]): void {
    this.nodes.push(...nodes)
    this.sources.push(...sources)
  }

  private stopSource(source: AudioScheduledSourceNode, when: number | undefined): void {
    if (this.stopped.includes(source)) {
      return
    }
    this.stopped.push(source)
    if (when === undefined) {
      source.stop()
    } else {
      source.stop(when)
    }
  }
}

/** Builds a live, already-started bed from a validated descriptor. */
export function createAmbienceBed(
  context: AudioContext,
  descriptor: NormalizedSoundscapeDescriptor,
  options: AmbienceBedOptions,
): AmbienceBed {
  return new DescriptorAmbienceBed(context, descriptor, options)
}
