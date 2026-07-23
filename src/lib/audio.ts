import type { EraConfig, EraId } from '../app/types'

export type EraSfxController = {
  arm: () => void
  setEnabled: (enabled: boolean) => void
  setEra: (eraConfig: EraConfig, eraId: EraId) => void
}

function createNoiseBuffer(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export function createEraSfxController(): EraSfxController & { playUiClick: () => void } {
  let ctx: AudioContext | null = null
  let enabled = true
  let armed = false

  let eraConfig: EraConfig | null = null
  let eraId: EraId = 0

  let trafficSource: AudioBufferSourceNode | null = null
  let trafficGain: GainNode | null = null
  let trafficFilter: BiquadFilterNode | null = null
  let interval: number | undefined

  const uiClick = () => {
    if (!enabled || !armed) return
    if (!ctx) return

    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(620, now)
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.06)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  }

  const startTraffic = () => {
    if (!ctx || !eraConfig) return
    if (trafficSource) return

    const noiseBuffer = createNoiseBuffer(ctx)

    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 260 + eraConfig.vehicleSpeed * 120
    filter.Q.value = 0.75

    const gain = ctx.createGain()
    gain.gain.value = 0.0001

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.06 * eraConfig.vehicleDensity, now + 0.3)

    source.start()

    trafficSource = source
    trafficGain = gain
    trafficFilter = filter
  }

  const stopTraffic = () => {
    if (!ctx) return
    if (trafficSource) {
      const now = ctx.currentTime
      trafficGain?.gain.cancelScheduledValues(now)
      trafficGain?.gain.setValueAtTime(trafficGain.gain.value, now)
      trafficGain?.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      const src = trafficSource
      trafficSource = null
      window.setTimeout(() => {
        try {
          src.stop()
        } catch {
          // ignore
        }
      }, 160)
    }
    trafficFilter = null
    trafficGain = null
  }

  const tickScheduled = () => {
    if (!ctx || !eraConfig) return
    if (!enabled || !armed) return

    // A little periodic blip for traffic texture.
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(90 + (eraId % 7) * 12 + eraConfig.vehicleSpeed * 55, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.015 * eraConfig.vehicleDensity, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380 + eraConfig.vehicleSpeed * 240

    osc.connect(gain)
    gain.connect(filter)
    filter.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.1)
  }

  const scheduleInterval = () => {
    if (interval) window.clearInterval(interval)
    if (!eraConfig) return

    const ms = Math.round(260 / Math.max(0.15, eraConfig.vehicleDensity))
    interval = window.setInterval(() => {
      tickScheduled()
    }, ms)
  }

  return {
    arm: () => {
      if (armed) return
      armed = true
      ctx = ctx ?? new AudioContext()
      if (enabled && eraConfig) {
        startTraffic()
        scheduleInterval()
      }
    },

    setEnabled: (e) => {
      enabled = e
      if (!ctx) {
        // Will start once armed.
        return
      }
      if (enabled) {
        if (eraConfig) {
          startTraffic()
          scheduleInterval()
        }
      } else {
        stopTraffic()
        if (interval) window.clearInterval(interval)
        interval = undefined
      }
    },

    setEra: (cfg: EraConfig, id: EraId) => {
      eraConfig = cfg
      eraId = id

      if (!ctx) return
      if (!armed) return

      if (enabled) {
        stopTraffic()
        trafficSource = null
        startTraffic()
        scheduleInterval()
      }

      if (trafficFilter && eraConfig) {
        trafficFilter.frequency.value = 240 + eraConfig.vehicleSpeed * 130
      }
    },

    playUiClick: uiClick,
  }
}
