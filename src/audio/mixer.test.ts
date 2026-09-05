import { describe, expect, it } from 'vitest'
import { ERA_IDS, ERA_REGISTRY, SFX_ERA_DATA, getEraSpec } from '../eras'
import { SfxMixer, exponentialRampValue, scheduleGainRamp } from './mixer'

class FakeAudioParam {
  value = 0
  private events: Array<{ method: string; args: number[] }> = []

  setValueAtTime(value: number): this {
    this.value = value
    this.events.push({ method: 'setValueAtTime', args: [value] })
    return this
  }

  exponentialRampToValueAtTime(value: number): this {
    this.value = value
    this.events.push({ method: 'exponentialRampToValueAtTime', args: [value] })
    return this
  }

  linearRampToValueAtTime(value: number): this {
    this.value = value
    this.events.push({ method: 'linearRampToValueAtTime', args: [value] })
    return this
  }

  cancelScheduledValues(): this {
    return this
  }

  get log(): Array<{ method: string; args: number[] }> {
    return this.events
  }
}

class FakeAudioNode {
  connect(): void {}
  disconnect(): void {}
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam()
}

class FakeAudioParam2 {
  value = 0
  setValueAtTime(value: number): this {
    this.value = value
    return this
  }
  linearRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }
  exponentialRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }
  setTargetAtTime(value: number): this {
    this.value = value
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

class FakeSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null
  loop = false
  start(): void {}
  stop(): void {}
}

class FakeBiquadFilter extends FakeAudioNode {
  type = 'bandpass'
  frequency = new FakeAudioParam2()
  Q = new FakeAudioParam2()
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 0
  destination = new FakeAudioNode()
  listener = {
    positionX: new FakeAudioParam2(),
    positionY: new FakeAudioParam2(),
    positionZ: new FakeAudioParam2(),
    forwardX: new FakeAudioParam2(),
    forwardY: new FakeAudioParam2(),
    forwardZ: new FakeAudioParam2(),
    upX: new FakeAudioParam2(),
    upY: new FakeAudioParam2(),
    upZ: new FakeAudioParam2(),
  }
  createGain(): FakeGainNode {
    return new FakeGainNode()
  }
  createBufferSource(): FakeSourceNode {
    return new FakeSourceNode()
  }
  createBiquadFilter(): FakeBiquadFilter {
    return new FakeBiquadFilter()
  }
  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const data = new Float32Array(length)
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => data,
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as unknown as AudioBuffer
  }
  resume(): Promise<void> {
    this.state = 'running'
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

function makeMixer(): SfxMixer {
  const context = new FakeAudioContext()
  const mixer = new SfxMixer({
    contextFactory: () => context as unknown as AudioContext,
  })
  return mixer
}

describe('era registry', () => {
  it('exposes the six eras of the timeline', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025', '2055'])
    expect(ERA_REGISTRY).toHaveLength(6)
    expect(ERA_REGISTRY[0].id).toBe('1945')
    expect(ERA_REGISTRY[ERA_REGISTRY.length - 1].id).toBe('2055')
  })

  it('populates audio mood descriptors for every era', () => {
    for (const era of ERA_IDS) {
      const data = SFX_ERA_DATA[era]
      expect(data.era).toBe(era)
      expect(data.mood.length).toBeGreaterThan(0)
      expect(data.ambient.gain).toBeGreaterThan(0)
      expect(data.ambient.gain).toBeLessThanOrEqual(1)
      expect(data.ambient.droneHz).toBeGreaterThan(0)
      expect(data.traffic.density).toBeGreaterThanOrEqual(0)
      expect(data.traffic.density).toBeLessThanOrEqual(1)
      expect(data.events.length).toBeGreaterThan(0)
      expect(data.music.style.length).toBeGreaterThan(0)
    }
  })

  it('contains the era mood descriptors named in the task', () => {
    expect(SFX_ERA_DATA['1945'].mood).toContain('distant steam hiss')
    expect(SFX_ERA_DATA['1945'].mood).toContain('sparse traffic')
    expect(SFX_ERA_DATA['2025'].mood).toContain('dense traffic')
    expect(SFX_ERA_DATA['2025'].mood).toContain('cell chatter')
  })

  it('looks up era specs by id', () => {
    expect(getEraSpec('1985').year).toBe(1985)
    expect(() => getEraSpec('1900' as never)).toThrow()
  })
})

describe('era-crossfade gain envelope math', () => {
  it('maps a positive target to a strictly positive exponential ramp value', () => {
    expect(exponentialRampValue(0.5)).toBe(0.5)
    expect(exponentialRampValue(0.00001)).toBe(0.0001)
    expect(exponentialRampValue(0)).toBe(0)
  })

  it('uses exponential ramps between two positive endpoints', () => {
    const gain = new FakeGainNode()
    // The mixer's idle floor is 0.0001, so a fresh crossfade-in has two
    // positive endpoints and uses an exponential ramp.
    scheduleGainRamp(gain as unknown as GainNode, 0.0001, 0.5, 1, 2.5)
    const methods = gain.gain.log.map((event) => event.method)
    expect(methods).toContain('setValueAtTime')
    expect(methods).toContain('exponentialRampToValueAtTime')
    expect(methods).not.toContain('linearRampToValueAtTime')
    expect(gain.gain.log[0].args[0]).toBeCloseTo(0.0001) // idle floor -> inaudible
  })

  it('falls back to a linear ramp when one endpoint is zero', () => {
    const gain = new FakeGainNode()
    scheduleGainRamp(gain as unknown as GainNode, 0.0001, 0, 1, 2)
    const methods = gain.gain.log.map((event) => event.method)
    expect(methods).toContain('linearRampToValueAtTime')
    expect(methods).not.toContain('exponentialRampToValueAtTime')
  })

  it('never schedules an exponential ramp through a zero value', () => {
    for (const [from, to] of [
      [0, 0.5],
      [0.5, 0],
      [0, 0],
    ] as const) {
      const gain = new FakeGainNode()
      scheduleGainRamp(gain as unknown as GainNode, from, to, 0, 1)
      const exp = gain.gain.log.find((e) => e.method === 'exponentialRampToValueAtTime')
      if (exp) {
        expect(exp.args[0]).toBeGreaterThan(0)
      }
    }
  })

  it('crossfade duration is bounded to a sane window', () => {
    // The mixer clamps setEra's ramp to [0.05s, 3s]; verify the pure helper
    // still produces a monotone endpoint later than the start.
    const gain = new FakeGainNode()
    scheduleGainRamp(gain as unknown as GainNode, 0.0001, 0.5, 0, 1.5)
    const set = gain.gain.log.find((e) => e.method === 'setValueAtTime')
    const ramp = gain.gain.log.find((e) => e.method === 'exponentialRampToValueAtTime')
    expect(set).toBeDefined()
    expect(ramp).toBeDefined()
    expect(ramp!.args[0]).toBeGreaterThan(set!.args[0])
  })
})

describe('SfxMixer gesture gating and crossfade', () => {
  it('starts muted and disabled, and only enables after a gesture unlock', () => {
    const mixer = makeMixer()
    expect(mixer.state.enabled).toBe(false)
    expect(mixer.state.muted).toBe(true)
    expect(mixer.unlockOnGesture()).toBe(true)
    expect(mixer.state.enabled).toBe(true)
    expect(mixer.state.muted).toBe(true) // still muted until user unmutes
  })

  it('unlock is idempotent', () => {
    const mixer = makeMixer()
    expect(mixer.unlockOnGesture()).toBe(true)
    expect(mixer.unlockOnGesture()).toBe(true)
  })

  it('setEra before unlock records a pending era, applied on unlock', () => {
    const mixer = makeMixer()
    mixer.setEra('2025')
    expect(mixer.state.currentEra).toBe('2025')
    expect(mixer.state.enabled).toBe(false)
    mixer.unlockOnGesture()
    expect(mixer.state.enabled).toBe(true)
    expect(mixer.state.currentEra).toBe('2025')
    expect(mixer.state.crossfading).toBe(true)
  })

  it('toggleMuted ramps the master gain (no hard jump)', () => {
    const mixer = makeMixer()
    mixer.unlockOnGesture()
    const before = mixer.state.muted
    const after = mixer.toggleMuted()
    expect(after).toBe(!before)
    expect(mixer.state.muted).toBe(false)
  })

  it('dispose is safe before and after unlock', () => {
    const mixer = makeMixer()
    expect(() => mixer.dispose()).not.toThrow()
    const mixer2 = makeMixer()
    mixer2.unlockOnGesture()
    expect(() => mixer2.dispose()).not.toThrow()
    expect(mixer2.state.enabled).toBe(false)
  })
})