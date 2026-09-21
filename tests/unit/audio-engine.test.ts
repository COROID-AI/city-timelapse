/**
 * Behavioural tests for the era-agnostic audio engine.
 *
 * jsdom has no WebAudio, so these tests drive the engine through a recording
 * stub that implements the small slice of the API the engine uses. That makes
 * the assertions structural rather than acoustic: how many buses exist, which
 * nodes feed which, that a crossfade ramps over exactly the requested duration,
 * that a one-shot starts each source once, and that disposal detaches every
 * node before the context is closed.
 *
 * Nothing here imports the era registry, React or the scene pipeline, which is
 * the point of the module boundary these tests protect.
 */

import { describe, expect, it } from 'vitest'
import { createAudioEngine, ONE_SHOT_IDS } from '../../src/audio'
import type { AudioEngine, AudioEngineState, SoundscapeDescriptor } from '../../src/audio'

/* ------------------------------------------------------------- stub pieces -- */

type ParamMethod =
  | 'setValueAtTime'
  | 'linearRampToValueAtTime'
  | 'exponentialRampToValueAtTime'
  | 'setTargetAtTime'
  | 'cancelScheduledValues'

interface ParamEvent {
  readonly method: ParamMethod
  readonly args: readonly number[]
}

/** Records every automation call so ramps can be asserted exactly. */
class FakeParam {
  value: number
  readonly events: ParamEvent[] = []

  constructor(value: number) {
    this.value = value
  }

  setValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ method: 'setValueAtTime', args: [value, time] })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ method: 'linearRampToValueAtTime', args: [value, time] })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    if (value === 0) {
      throw new Error('exponentialRampToValueAtTime cannot target 0')
    }
    this.value = value
    this.events.push({ method: 'exponentialRampToValueAtTime', args: [value, time] })
    return this
  }

  setTargetAtTime(value: number, time: number, constant: number): this {
    this.value = value
    this.events.push({ method: 'setTargetAtTime', args: [value, time, constant] })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ method: 'cancelScheduledValues', args: [time] })
    return this
  }
}

let nodeSequence = 0

class FakeNode {
  readonly id: string
  readonly kind: string
  readonly outputs: FakeNode[] = []
  connectCalls = 0
  disconnectCalls = 0

  constructor(kind: string) {
    nodeSequence += 1
    this.kind = kind
    this.id = `${kind}#${nodeSequence}`
  }

  connect(target: FakeNode): FakeNode {
    this.connectCalls += 1
    this.outputs.push(target)
    return target
  }

  disconnect(): void {
    this.disconnectCalls += 1
    this.outputs.length = 0
  }
}

class FakeSource extends FakeNode {
  startCalls = 0
  stopCalls = 0
  startedAt: number | null = null
  stoppedAt: number | null = null
  onended: (() => void) | null = null

  start(when = 0): void {
    this.startCalls += 1
    this.startedAt = when
  }

  stop(when = 0): void {
    if (this.startCalls === 0) {
      throw new Error(`stop() called before start() on ${this.id}`)
    }
    this.stopCalls += 1
    this.stoppedAt = when
  }

  /** Simulates the browser firing `ended` for a finished source. */
  finish(): void {
    this.onended?.()
  }
}

class FakeOscillator extends FakeSource {
  type = 'sine'
  readonly frequency = new FakeParam(440)
  readonly detune = new FakeParam(0)

  constructor() {
    super('oscillator')
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)

  constructor() {
    super('gain')
  }
}

class FakeBiquad extends FakeNode {
  type = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
  readonly gain = new FakeParam(0)

  constructor() {
    super('biquad')
  }
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0)

  constructor() {
    super('panner')
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048
  smoothingTimeConstant = 0
  readonly data = new Float32Array(2048)

  constructor() {
    super('analyser')
  }

  get frequencyBinCount(): number {
    return this.fftSize / 2
  }

  getFloatTimeDomainData(target: Float32Array): void {
    for (let index = 0; index < target.length; index += 1) {
      target[index] = this.data[index] ?? 0
    }
  }
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null
  loop = false
  readonly playbackRate = new FakeParam(1)

  constructor() {
    super('buffer-source')
  }
}

class FakeBuffer {
  readonly channels: Float32Array[]

  constructor(
    readonly length: number,
    readonly sampleRate: number,
    channelCount: number,
  ) {
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length))
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel] ?? this.channels[0]
    if (data === undefined) {
      throw new Error('FakeBuffer has no channels')
    }
    return data
  }
}

/** Recording stand-in for `AudioContext`. */
class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  currentTime = 0
  sampleRate = 48000
  readonly destination = new FakeNode('destination')
  readonly nodes: FakeNode[] = [this.destination]
  readonly sources: FakeSource[] = []
  readonly buffers: FakeBuffer[] = []
  resumeCalls = 0
  closeCalls = 0

  resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.state !== 'closed') {
      this.state = 'running'
    }
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.closeCalls += 1
    this.state = 'closed'
    return Promise.resolve()
  }

  createGain(): FakeGain {
    return this.track(new FakeGain())
  }

  createBiquadFilter(): FakeBiquad {
    return this.track(new FakeBiquad())
  }

  createStereoPanner(): FakePanner {
    return this.track(new FakePanner())
  }

  createAnalyser(): FakeAnalyser {
    return this.track(new FakeAnalyser())
  }

  createOscillator(): FakeOscillator {
    return this.trackSource(new FakeOscillator())
  }

  createBufferSource(): FakeBufferSource {
    return this.trackSource(new FakeBufferSource())
  }

  createBuffer(channelCount: number, length: number, sampleRate: number): FakeBuffer {
    const buffer = new FakeBuffer(length, sampleRate, channelCount)
    this.buffers.push(buffer)
    return buffer
  }

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node)
    return node
  }

  private trackSource<T extends FakeSource>(source: T): T {
    this.nodes.push(source)
    this.sources.push(source)
    return source
  }

  /** Simulates the audio clock moving forward. */
  advance(seconds: number): void {
    this.currentTime += seconds
  }

  /** Everything the engine created, excluding the destination. */
  createdNodes(): FakeNode[] {
    return this.nodes.filter((node) => node !== this.destination)
  }

  /** Every automation event recorded for one parameter name. */
  paramEvents(paramName: 'gain' | 'frequency' | 'pan'): Array<{ node: FakeNode; event: ParamEvent }> {
    const events: Array<{ node: FakeNode; event: ParamEvent }> = []
    for (const node of this.nodes) {
      const param = (node as unknown as Record<string, unknown>)[paramName]
      if (param instanceof FakeParam) {
        for (const event of param.events) {
          events.push({ node, event })
        }
      }
    }
    return events
  }
}

/* -------------------------------------------------------------- test data -- */

function seededRandom(seed = 0x5eed): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

/** Two layers, a modulated bed filter and oscillator vibrato. */
const TRAFFIC_BED: SoundscapeDescriptor = {
  id: 'traffic',
  name: 'Traffic hum',
  gain: 0.5,
  fadeInSeconds: 1,
  filter: {
    type: 'lowpass',
    frequency: 900,
    q: 0.5,
    modulation: { rate: 0.1, depth: 200 },
  },
  layers: [
    {
      type: 'noise',
      color: 'brown',
      level: 0.5,
      filter: { type: 'lowpass', frequency: 220, q: 0.7 },
    },
    { type: 'oscillator', waveform: 'sine', frequency: 55, level: 0.2, vibrato: { rate: 0.2, depth: 12 } },
  ],
}

const WIND_BED: SoundscapeDescriptor = {
  id: 'wind',
  name: 'Wind',
  gain: 0.35,
  fadeInSeconds: 0.75,
  layers: [{ type: 'noise', color: 'brown', level: 0.6 }],
}

/* --------------------------------------------------------------- helpers -- */

interface Harness {
  readonly context: FakeAudioContext
  readonly engine: AudioEngine
}

function createHarness(options: { muted?: boolean; volumes?: { sfx?: number } } = {}): Harness {
  const context = new FakeAudioContext()
  const engine = createAudioEngine({
    contextFactory: () => context as unknown as AudioContext,
    random: seededRandom(),
    ...(options.muted === undefined ? {} : { muted: options.muted }),
    ...(options.volumes === undefined ? {} : { volumes: options.volumes }),
  })
  return { context, engine }
}

function analyserOf(context: FakeAudioContext): FakeAnalyser {
  const analyser = context.nodes.find((node): node is FakeAnalyser => node instanceof FakeAnalyser)
  if (analyser === undefined) {
    throw new Error('engine created no analyser')
  }
  return analyser
}

/** The mute gate is the only gain node feeding the analyser. */
function muteGainOf(context: FakeAudioContext): FakeGain {
  const analyser = analyserOf(context)
  const feeding = context.nodes.filter(
    (node): node is FakeGain => node instanceof FakeGain && node.outputs.includes(analyser),
  )
  const [mute] = feeding
  if (mute === undefined || feeding.length !== 1) {
    throw new Error(`expected exactly one mute gate, found ${feeding.length}`)
  }
  return mute
}

function gainNodes(context: FakeAudioContext): FakeGain[] {
  return context.nodes.filter((node): node is FakeGain => node instanceof FakeGain)
}

/** The three child buses, identified structurally by what feeds master. */
function childBuses(context: FakeAudioContext): FakeGain[] {
  const mute = muteGainOf(context)
  const master = gainNodes(context).find((node) => node !== mute && node.outputs.includes(mute))
  return gainNodes(context).filter((node) => node !== mute && node !== master)
}

function rampsTo(context: FakeAudioContext, value: number, endTime: number): boolean {
  return context
    .paramEvents('gain')
    .some(
      ({ event }) =>
        event.method === 'linearRampToValueAtTime' &&
        event.args[0] === value &&
        Math.abs((event.args[1] ?? Number.NaN) - endTime) < 1e-9,
    )
}

/* ------------------------------------------------------------------ tests -- */

describe('audio engine lifecycle', () => {
  it('constructs no AudioContext until unlock() is called', async () => {
    const context = new FakeAudioContext()
    let created = 0
    const engine = createAudioEngine({
      contextFactory: () => {
        created += 1
        return context as unknown as AudioContext
      },
    })

    expect(created, 'factory untouched at construction time').toBe(0)
    const initial = engine.getState()
    expect(initial.contextCreated).toBe(false)
    expect(initial.contextState, 'starts suspended before the gesture').toBe('suspended')
    expect(initial.unlocked).toBe(false)
    expect(initial.running).toBe(false)
    expect(initial.supported).toBe(true)
    expect(initial.currentBed).toBeNull()
    expect(initial.liveVoices).toBe(0)
    expect(context.createdNodes()).toEqual([])

    const afterUnlock = await engine.unlock()
    expect(created).toBe(1)
    expect(context.resumeCalls).toBe(1)
    expect(afterUnlock.contextState).toBe('running')
    expect(afterUnlock.contextCreated).toBe(true)
    expect(afterUnlock.unlocked).toBe(true)
    expect(afterUnlock.running).toBe(true)
  })

  it('builds master, music, ambience and SFX buses through a mute gate and analyser', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    const analyser = analyserOf(context)
    expect(analyser.outputs).toContain(context.destination)

    const mute = muteGainOf(context)
    const master = gainNodes(context).find((node) => node !== mute && node.outputs.includes(mute))
    expect(master, 'one gain feeds the mute gate').toBeDefined()

    const children = childBuses(context)
    expect(children, 'music, ambience and SFX buses').toHaveLength(3)
    for (const bus of children) {
      expect(bus.outputs).toContain(master)
    }
    expect(master?.outputs).toContain(mute)
  })
})

describe('audio engine mixer', () => {
  it('sets independent bus volumes, clamping and ignoring junk values', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    expect(engine.setVolume('sfx', 0.25)).toBe(0.25)
    expect(engine.setVolume('master', 0.8)).toBe(0.8)
    expect(engine.setVolume('ambience', 0.5)).toBe(0.5)
    expect(engine.setVolume('sfx', 5), 'clamped to 1').toBe(1)
    expect(engine.setVolume('sfx', Number.NaN), 'keeps the previous value').toBe(1)
    expect(engine.getVolume('sfx')).toBe(1)
    expect(engine.getVolumes()).toEqual({ master: 0.8, music: 1, ambience: 0.5, sfx: 1 })

    // Each bus ramps on its own gain node: three distinct nodes, three ramps.
    const ramped = new Set(
      context
        .paramEvents('gain')
        .filter(({ event }) => event.method === 'linearRampToValueAtTime')
        .map(({ node }) => node.id),
    )
    expect(ramped.size).toBe(3)
  })

  it('mutes the master output without disturbing bus gains', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    engine.setVolume('sfx', 0.3)
    const mute = muteGainOf(context)
    expect(mute.gain.value).toBe(1)

    expect(engine.mute()).toBe(true)
    expect(engine.isMuted()).toBe(true)
    expect(mute.gain.value, 'mute gate closed').toBe(0)
    expect(engine.getVolume('sfx'), 'bus gain untouched by mute').toBe(0.3)

    expect(engine.toggleMute()).toBe(false)
    expect(mute.gain.value, 'mute gate reopened').toBe(1)
    expect(engine.mute(false), 'unmuting an unmuted engine is a no-op').toBe(false)
    expect(mute.gain.value).toBe(1)
  })

  it('starts muted when the stored preference says so', async () => {
    const { context, engine } = createHarness({ muted: true })
    await engine.unlock()
    expect(engine.isMuted()).toBe(true)
    expect(muteGainOf(context).gain.value).toBe(0)
    expect(engine.getState().muted).toBe(true)
  })
})

describe('audio engine ambience beds', () => {
  it('crossfades a descriptor bed over the requested duration', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    const buses = childBuses(context)
    const beforeCrossfade = context.nodes.length
    const result = engine.crossfadeBeds(TRAFFIC_BED, 2.5)
    expect(result).toMatchObject({
      applied: true,
      pending: false,
      bedId: 'traffic',
      durationSeconds: 2.5,
      reason: null,
      issues: [],
    })

    const state = engine.getState()
    expect(state.currentBed).toBe('traffic')
    expect(state.bedVoices).toBe(1)
    expect(state.liveVoices).toBe(1)

    // The bed must actually reach a mixer bus, not just build an island graph.
    const bedOutput = context.nodes[beforeCrossfade]
    expect(bedOutput).toBeInstanceOf(FakeGain)
    expect(
      bedOutput?.outputs.some((target) => buses.includes(target as FakeGain)),
      'bed output feeds a mixer bus',
    ).toBe(true)

    // Both layer kinds resolved to nodes: one noise loop, the layer oscillator
    // plus an LFO each for the bed filter modulation and the layer vibrato.
    const oscillators = context.sources.filter((source) => source instanceof FakeOscillator)
    const noiseSources = context.sources.filter((source) => source instanceof FakeBufferSource)
    expect(oscillators).toHaveLength(3)
    expect(noiseSources).toHaveLength(1)
    for (const source of context.sources) {
      expect(source.startCalls, `${source.id} started once`).toBe(1)
      expect(source.startedAt).toBe(0)
    }
    expect(context.buffers.length, 'noise buffer generated once').toBe(1)

    // The bed gain ramps from silence to the descriptor gain, ending exactly at
    // the requested fade duration.
    expect(rampsTo(context, 0.5, 2.5)).toBe(true)
  })

  it('uses the descriptor fadeInSeconds when no duration is given', async () => {
    const { engine } = createHarness()
    await engine.unlock()

    const result = engine.crossfadeBeds(WIND_BED)
    expect(result.durationSeconds).toBe(0.75)
    expect(engine.crossfadeBeds(TRAFFIC_BED, Number.NaN).durationSeconds, 'falls back').toBe(1.5)
  })

  it('retires the previous bed, fading it out before releasing its nodes', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    engine.crossfadeBeds(TRAFFIC_BED, 2)
    const trafficSources = [...context.sources]

    engine.crossfadeBeds(WIND_BED, 1)
    let state = engine.getState()
    expect(state.currentBed).toBe('wind')
    expect(state.retiringBeds).toEqual(['traffic'])
    expect(state.bedVoices).toBe(2)
    expect(rampsTo(context, 0, 1), 'previous bed ramps to silence over 1 s').toBe(true)
    for (const source of trafficSources) {
      expect(source.stopCalls, 'previously started sources are stopped after the fade').toBe(1)
    }

    context.advance(1.2)
    state = engine.getState()
    expect(state.retiringBeds).toEqual([])
    expect(state.bedVoices).toBe(1)
    expect(state.currentBed).toBe('wind')
    for (const source of trafficSources) {
      expect(source.disconnectCalls, `${source.id} released`).toBeGreaterThan(0)
    }
  })

  it('stops the active bed and releases every node', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    engine.crossfadeBeds(TRAFFIC_BED, 1)
    const bedSources = [...context.sources]

    const result = engine.stopBeds(0)
    expect(result.applied).toBe(true)
    const state = engine.getState()
    expect(state.currentBed).toBeNull()
    expect(state.bedVoices).toBe(0)
    expect(state.liveVoices).toBe(0)
    for (const source of bedSources) {
      expect(source.stopCalls).toBe(1)
      expect(source.disconnectCalls).toBeGreaterThan(0)
    }
  })

  it('remembers a bed requested before unlock and applies it on unlock', async () => {
    const { context, engine } = createHarness()
    const result = engine.crossfadeBeds(TRAFFIC_BED, 1.25)
    expect(result).toMatchObject({
      applied: false,
      pending: true,
      bedId: 'traffic',
      durationSeconds: 1.25,
      reason: 'locked',
    })
    expect(engine.getState().pendingBed).toBe('traffic')
    expect(context.createdNodes(), 'no audio nodes built while locked').toEqual([])

    await engine.unlock()
    const state = engine.getState()
    expect(state.currentBed).toBe('traffic')
    expect(state.pendingBed).toBeNull()
    expect(state.bedVoices).toBe(1)
    expect(context.resumeCalls).toBe(1)
  })

  it('rejects an invalid descriptor with diagnostics instead of rendering it', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    const before = context.nodes.length

    const broken = { id: 'broken', layers: [] } as unknown as SoundscapeDescriptor
    const result = engine.crossfadeBeds(broken, 1)
    expect(result.applied).toBe(false)
    expect(result.reason).toBe('invalid-descriptor')
    expect(result.bedId).toBe('broken')
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.some((issue) => issue.path === 'layers')).toBe(true)
    expect(context.nodes.length, 'nothing was built').toBe(before)
    expect(engine.getState().currentBed).toBeNull()
  })
})

describe('audio engine one-shots', () => {
  it('fires one voice per trigger with per-shot gain, pan and rate', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    const before = context.nodes.length

    const handle = engine.playOneShot('horn', { gain: 0.4, pan: -0.5, rate: 1.5 })
    expect(handle.started).toBe(true)
    expect(handle.id).toBe('horn')
    expect(handle.reason).toBeNull()
    expect(handle.durationSeconds).toBeCloseTo(0.6 / 1.5, 6)
    expect(handle.gain).toBe(0.4)
    expect(handle.pan).toBe(-0.5)
    expect(handle.rate).toBe(1.5)
    expect(handle.startTime).toBe(0)

    const created = context.nodes.slice(before)
    const sources = created.filter((node): node is FakeSource => node instanceof FakeSource)
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source.startCalls, `${source.id} started exactly once`).toBe(1)
      expect(source.stopCalls).toBe(1)
    }
    const panner = created.find((node): node is FakePanner => node instanceof FakePanner)
    expect(panner?.pan.value).toBe(-0.5)
    const level = created.find(
      (node): node is FakeGain => node instanceof FakeGain && node.gain.value === 0.4,
    )
    expect(level, 'per-shot gain applied on its own node').toBeDefined()
    expect(engine.getState().oneShotVoices).toBe(1)

    // Documented aliases resolve, and a second trigger is a second voice.
    const aliased = engine.playOneShot('car-horn')
    expect(aliased.id).toBe('horn')
    expect(aliased.started).toBe(true)
    expect(engine.getState().oneShotVoices).toBe(2)
    expect(engine.getState().liveVoices).toBe(2)
  })

  it('rejects locked, unknown and malformed trigger requests without side effects', () => {
    const { context, engine } = createHarness()

    const locked = engine.playOneShot('siren')
    expect(locked.started).toBe(false)
    expect(locked.reason).toBe('locked')
    expect(locked.id).toBeNull()
    expect(context.nodes.length, 'nothing built before unlock').toBe(1)
    expect(() => locked.stop()).not.toThrow()

    return engine.unlock().then(() => {
      const afterUnlock = context.nodes.length
      const unknown = engine.playOneShot('not-a-real-sound')
      expect(unknown.started).toBe(false)
      expect(unknown.reason).toBe('unknown-id')
      expect(context.nodes.length, 'unknown id builds nothing').toBe(afterUnlock)

      const clamped = engine.playOneShot('birds', { gain: 99, pan: -9, rate: 0.01 })
      expect(clamped.gain).toBe(2)
      expect(clamped.pan).toBe(-1)
      expect(clamped.rate).toBe(0.25)
      expect(clamped.started).toBe(true)
    })
  })

  it('releases a voice when its window ends and when it is stopped early', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    const handle = engine.playOneShot('siren')
    const sirenSources = [...context.sources]
    expect(engine.getState().oneShotVoices).toBe(1)

    context.advance(handle.durationSeconds + 0.2)
    expect(engine.getState().oneShotVoices).toBe(0)
    for (const source of sirenSources) {
      expect(source.disconnectCalls).toBeGreaterThan(0)
    }

    const early = engine.playOneShot('train')
    const trainSources = context.sources.filter((source) => !sirenSources.includes(source))
    const stopAt = context.currentTime
    early.stop()
    expect(rampsTo(context, 0, stopAt + 0.04), 'early stop ramps the voice down').toBe(true)
    expect(trainSources.length).toBeGreaterThan(0)
    context.advance(0.2)
    expect(engine.getState().oneShotVoices).toBe(0)
    expect(() => early.stop(), 'stop is idempotent').not.toThrow()

    // A browser starting `ended` releases the voice immediately.
    const beforeBirds = context.sources.length
    engine.playOneShot('birds')
    const birdSources = context.sources.slice(beforeBirds)
    expect(engine.getState().oneShotVoices).toBe(1)
    birdSources[0]?.finish()
    expect(engine.getState().oneShotVoices).toBe(0)
    for (const source of birdSources) {
      expect(source.disconnectCalls).toBeGreaterThan(0)
    }
  })

  it('has a patch for every documented id that fires exactly one voice', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    for (const id of ONE_SHOT_IDS) {
      const before = context.nodes.length
      const handle = engine.playOneShot(id)
      expect(handle.started, `${id} started`).toBe(true)
      expect(handle.id).toBe(id)
      expect(handle.durationSeconds, `${id} reports a duration`).toBeGreaterThan(0)
      const sources = context.nodes
        .slice(before)
        .filter((node): node is FakeSource => node instanceof FakeSource)
      expect(sources.length, `${id} builds at least one source`).toBeGreaterThan(0)
      for (const source of sources) {
        expect(source.startCalls, `${id} starts ${source.id} once`).toBe(1)
        expect(source.stopCalls).toBe(1)
      }
    }
    expect(engine.getState().oneShotVoices).toBe(ONE_SHOT_IDS.length)
  })

  it('scales patch pitch and length with the requested rate', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()

    const peakFrequency = (before: number): number => {
      const oscillators = context.nodes
        .slice(before)
        .filter((node): node is FakeOscillator => node instanceof FakeOscillator)
      expect(oscillators.length).toBeGreaterThan(0)
      return Math.max(...oscillators.map((oscillator) => oscillator.frequency.value))
    }

    const slowStart = context.nodes.length
    const slow = engine.playOneShot('ev-whine', { rate: 1 })
    const slowPeak = peakFrequency(slowStart)

    const fastStart = context.nodes.length
    const fast = engine.playOneShot('ev-whine', { rate: 2 })
    const fastPeak = peakFrequency(fastStart)

    expect(slowPeak).toBeGreaterThan(0)
    expect(fastPeak, 'partials scale with the playback rate').toBeCloseTo(slowPeak * 2, 3)
    expect(fast.durationSeconds).toBeCloseTo(slow.durationSeconds / 2, 6)
    expect(engine.getState().oneShotVoices).toBe(2)
  })
})

describe('audio engine analyser and observers', () => {
  it('reports the master-output RMS, and zero before any graph exists', async () => {
    const { context, engine } = createHarness()
    expect(engine.getAnalyserRms()).toBe(0)

    await engine.unlock()
    const analyser = analyserOf(context)
    analyser.data.fill(0.5)
    expect(engine.getAnalyserRms()).toBeCloseTo(0.5, 6)
    expect(engine.getState().analyserRms).toBeCloseTo(0.5, 6)

    analyser.data.fill(0)
    expect(engine.getAnalyserRms()).toBe(0)
  })

  it('notifies subscribers of every state change until they unsubscribe', async () => {
    const { engine } = createHarness()
    const states: AudioEngineState[] = []
    const unsubscribe = engine.subscribe((state) => {
      states.push(state)
    })

    await engine.unlock()
    engine.setVolume('music', 0.5)
    engine.mute(true)
    engine.playOneShot('door-bell')
    engine.crossfadeBeds(WIND_BED, 1)

    expect(states.length).toBeGreaterThanOrEqual(5)
    expect(states[states.length - 1]?.muted).toBe(true)
    expect(states[states.length - 1]?.currentBed).toBe('wind')

    const seen = states.length
    unsubscribe()
    engine.setVolume('music', 0.9)
    expect(states.length).toBe(seen)
  })
})

describe('audio engine degradation and disposal', () => {
  it('degrades to a silent no-op when WebAudio is unavailable', async () => {
    const engine = createAudioEngine({ contextFactory: () => null })
    const state = await engine.unlock()

    expect(state.supported).toBe(false)
    expect(state.contextState).toBe('unavailable')
    expect(state.contextCreated).toBe(false)
    expect(state.unlocked).toBe(false)

    const oneShot = engine.playOneShot('horn')
    expect(oneShot.started).toBe(false)
    expect(oneShot.reason).toBe('unsupported')

    const bed = engine.crossfadeBeds(TRAFFIC_BED, 1)
    expect(bed.applied).toBe(false)
    expect(bed.pending).toBe(true)
    expect(bed.reason).toBe('unsupported')

    expect(engine.getAnalyserRms()).toBe(0)
    expect(() => engine.dispose()).not.toThrow()
    expect(engine.getState().disposed).toBe(true)
    expect(engine.playOneShot('horn').reason).toBe('disposed')
    expect(engine.crossfadeBeds(TRAFFIC_BED, 1).reason).toBe('disposed')
  })

  it('treats a throwing context factory as an unsupported environment', async () => {
    const engine = createAudioEngine({
      contextFactory: () => {
        throw new Error('audio device denied')
      },
    })
    const state = await engine.unlock()
    expect(state.supported).toBe(false)
    expect(state.contextState).toBe('unavailable')
    expect(() => engine.dispose()).not.toThrow()
  })

  it('disposes every node, closes the context and stays inert', async () => {
    const { context, engine } = createHarness()
    await engine.unlock()
    engine.crossfadeBeds(TRAFFIC_BED, 1)
    engine.playOneShot('train')
    engine.crossfadeBeds(WIND_BED, 1)

    const created = context.createdNodes()
    const sources = [...context.sources]
    expect(created.length).toBeGreaterThan(5)

    engine.dispose()

    expect(context.closeCalls).toBe(1)
    for (const node of created) {
      expect(node.disconnectCalls, `${node.id} was disconnected`).toBeGreaterThan(0)
    }
    for (const source of sources) {
      expect(source.stopCalls, `${source.id} was stopped`).toBeGreaterThan(0)
    }

    const state = engine.getState()
    expect(state.disposed).toBe(true)
    expect(state.contextState).toBe('closed')
    expect(state.unlocked).toBe(false)
    expect(state.liveVoices).toBe(0)
    expect(state.bedVoices).toBe(0)
    expect(state.retiringBeds).toEqual([])
    expect(state.currentBed).toBeNull()

    expect(engine.playOneShot('horn').started).toBe(false)
    expect(engine.crossfadeBeds(TRAFFIC_BED, 1).applied).toBe(false)
    expect(engine.stopBeds(1).applied).toBe(false)
    expect(() => engine.dispose()).not.toThrow()
    expect(context.closeCalls, 'dispose is idempotent').toBe(1)
  })
})
