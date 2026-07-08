/**
 * Era-Aware Crossfade Mixer
 * Manages smooth audio transitions between time periods
 */

import type { EraId, SfxEraData } from '../eras'
import { SFX_ERA_DATA, getEraSpec } from '../eras'

export interface SfxMixerOptions {
  crossfadeDuration?: number
  masterVolume?: number
  enableAudio?: boolean
}

export class SfxMixer {
  private ctx: AudioContext | null = null
  private ambientSource: AudioBufferSourceNode | null = null
  private trafficSource: AudioBufferSourceNode | null = null
  private ambientGain: GainNode | null = null
  private trafficGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private currentEra: EraId | null = null
  private buffers: Map<EraId, EraAudioBuffers> = new Map()
  private eventPlayers: Set<AudioBufferSourceNode> = new Set()
  private crossfadeDuration: number
  private enableAudio: boolean
  private initialized: boolean = false

  constructor(private options: SfxMixerOptions = {}) {
    this.crossfadeDuration = options.crossfadeDuration ?? 1.5
    this.enableAudio = options.enableAudio ?? true
    this.masterGain = null
  }

  /**
   * Initialize audio context on first user gesture (required for autoplay policy)
   */
  async init(): Promise<void> {
    if (this.initialized || !this.enableAudio) return

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.ambientGain = this.ctx.createGain()
      this.trafficGain = this.ctx.createGain()
      this.masterGain = this.ctx.createGain()

      this.ambientGain.gain.value = 0
      this.trafficGain.gain.value = 0
      this.masterGain.gain.value = this.options.masterVolume ?? 0.5

      this.ambientGain.connect(this.masterGain)
      this.trafficGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)

      // Generate all era buffers
      this.generateAllBuffers()
      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize audio context:', error)
    }
  }

  private generateAllBuffers(): void {
    if (!this.ctx) return

    for (const eraId of Object.keys(SFX_ERA_DATA) as EraId[]) {
      const data = SFX_ERA_DATA[eraId]
      const buffers: EraAudioBuffers = {
        ambient: this.createAmbientBuffer(data),
        traffic: this.createTrafficBuffer(data),
        events: this.createEventBuffers(data),
      }
      this.buffers.set(eraId, buffers)
    }
  }

  private createAmbientBuffer(data: SfxEraData): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not initialized')

    const length = this.ctx.sampleRate * 5
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    const channelData = [buffer.getChannelData(0), buffer.getChannelData(1)]

    // Generate filtered noise
    for (let i = 0; i < length; i++) {
      const t = i / this.ctx.sampleRate
      let noise = (Math.random() * 2 - 1) * 0.3

      // Apply filtering based on noise color
      switch (data.ambientTones.noiseColor) {
        case 'brown':
          noise *= 0.5
          break
        case 'pink':
          noise *= 0.7
          break
        case 'blue':
          noise *= 0.9
          break
      }

      // Apply envelope
      noise *= data.ambientTones.baseVolume

      channelData[0][i] = noise
      channelData[1][i] = noise * (0.8 + Math.random() * 0.4)
    }

    return buffer
  }

  private createTrafficBuffer(data: SfxEraData): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not initialized')

    const length = this.ctx.sampleRate * 3
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    const channelData = [buffer.getChannelData(0), buffer.getChannelData(1)]

    for (let i = 0; i < length; i++) {
      const t = i / this.ctx.sampleRate
      const freq = data.trafficProfile.speed * 0.5
      const sample = Math.sin(t * freq * Math.PI * 2) * 0.2 * data.trafficProfile.density
      channelData[0][i] = sample
      channelData[1][i] = sample * 0.7
    }

    return buffer
  }

  private createEventBuffers(data: SfxEraData): AudioBuffer[] {
    if (!this.ctx) return []

    return data.eventTypes.map((event) => {
      const length = this.ctx!.sampleRate * event.duration
      const buffer = this.ctx!.createBuffer(1, length, this.ctx!.sampleRate)
      const channelData = buffer.getChannelData(0)

      for (let i = 0; i < length; i++) {
        const t = i / this.ctx!.sampleRate
        const envelope = Math.exp(-t * 2)
        const sample = Math.sin(t * 440 * Math.PI * 2) * envelope * 0.3
        channelData[i] = sample
      }

      return buffer
    })
  }

  /**
   * Set the current era, triggering crossfade transition
   */
  async setEra(eraId: EraId): Promise<void> {
    if (!this.initialized || !this.ctx) {
      await this.init()
    }

    if (!this.ctx || !this.ambientGain || !this.trafficGain || !this.masterGain) return

    const wasPlaying = this.currentEra !== null
    const prevEra = this.currentEra
    const data = SFX_ERA_DATA[eraId]

    // Stop previous sources
    if (this.ambientSource) {
      this.ambientSource.stop()
      this.ambientSource.disconnect()
    }
    if (this.trafficSource) {
      this.trafficSource.stop()
      this.trafficSource.disconnect()
    }

    this.currentEra = eraId
    const buffers = this.buffers.get(eraId)

    if (buffers) {
      // Start new sources
      this.ambientSource = this.ctx.createBufferSource()
      this.ambientSource.buffer = buffers.ambient
      this.ambientSource.loop = true
      this.ambientSource.connect(this.ambientGain!)

      this.trafficSource = this.ctx.createBufferSource()
      this.trafficSource.buffer = buffers.traffic
      this.trafficSource.loop = true
      this.trafficSource.connect(this.trafficGain!)

      // Crossfade
      if (wasPlaying && prevEra) {
        // Fade out previous, fade in new
        this.ambientGain!.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + this.crossfadeDuration)
        this.trafficGain!.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + this.crossfadeDuration)

        this.ambientSource.start()
        this.trafficSource.start()

        this.ambientGain!.gain.setValueAtTime(0.001, this.ctx.currentTime + this.crossfadeDuration)
        this.trafficGain!.gain.setValueAtTime(0.001, this.ctx.currentTime + this.crossfadeDuration)

        this.ambientGain!.gain.exponentialRampToValueAtTime(data.ambientTones.baseVolume, this.ctx.currentTime + this.crossfadeDuration * 2)
        this.trafficGain!.gain.exponentialRampToValueAtTime(data.ambientTones.baseVolume * 0.7, this.ctx.currentTime + this.crossfadeDuration * 2)
      } else {
        // First play
        this.ambientGain!.gain.setValueAtTime(0, this.ctx.currentTime)
        this.ambientGain!.gain.linearRampToValueAtTime(data.ambientTones.baseVolume, this.ctx.currentTime + this.crossfadeDuration)

        this.trafficGain!.gain.setValueAtTime(0, this.ctx.currentTime)
        this.trafficGain!.gain.linearRampToValueAtTime(data.ambientTones.baseVolume * 0.7, this.ctx.currentTime + this.crossfadeDuration)

        this.ambientSource.start()
        this.trafficSource.start()
      }
    }
  }

  /**
   * Play a random event sound
   */
  playEvent(): void {
    if (!this.initialized || !this.currentEra) return

    const buffers = this.buffers.get(this.currentEra)
    if (!buffers || !buffers.events.length || !this.ctx) return

    const eventBuffer = buffers.events[Math.floor(Math.random() * buffers.events.length)]
    const source = this.ctx.createBufferSource()
    source.buffer = eventBuffer
    source.connect(this.masterGain!)

    const gain = this.ctx.createGain()
    gain.gain.value = 0.5
    source.connect(gain)
    gain.connect(this.ctx.destination)

    source.start()
    source.onended = () => this.eventPlayers.delete(source)
    this.eventPlayers.add(source)
  }

  /**
   * Clean up all audio resources
   */
  dispose(): void {
    if (this.ambientSource) {
      this.ambientSource.stop()
      this.ambientSource.disconnect()
    }
    if (this.trafficSource) {
      this.trafficSource.stop()
      this.trafficSource.disconnect()
    }
    this.eventPlayers.forEach((source) => {
      source.stop()
      source.disconnect()
    })
    this.eventPlayers.clear()
    if (this.ctx) {
      this.ctx.close()
    }
    this.ctx = null
    this.initialized = false
  }
}

interface EraAudioBuffers {
  ambient: AudioBuffer
  traffic: AudioBuffer
  events: AudioBuffer[]
}