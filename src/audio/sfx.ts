/**
 * Procedural Audio Buffer Generator
 * Generates era-appropriate sound effects using Web Audio API
 */

import type { EraId, SfxEraData } from '../eras'

export interface EraAudioBuffers {
  ambient: AudioBuffer
  traffic: AudioBuffer
  events: AudioBuffer[]
}

/**
 * Generate filtered noise buffer for ambient tones
 */
function generateNoiseBuffer(
  ctx: AudioContext,
  length: number,
  sampleRate: number,
  type: 'brown' | 'pink' | 'white' | 'blue'
): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  let last = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1

    let noise: number
    switch (type) {
      case 'brown':
        // Brown noise - more bass, smoother
        noise = (last + white * 0.1) / 1.1
        last = noise
        break
      case 'pink':
        // Pink noise - balanced spectrum
        noise = (last + white) / 2
        last = noise
        break
      case 'blue':
        // Blue noise - more treble
        noise = white * (i / bufferSize) + last * 0.9
        last = noise
        break
      case 'white':
      default:
        noise = white
        last = noise
        break
    }

    // Apply slight attenuation to prevent clipping
    const attenuated = noise * 0.8

    // Stereo output
    buffer[i * 2] = attenuated
    buffer[i * 2 + 1] = attenuated * (0.95 + Math.random() * 0.1)
  }

  return buffer
}

/**
 * Generate tonal drone buffer
 */
function generateDroneBuffer(
  ctx: AudioContext,
  frequency: number,
  length: number,
  sampleRate: number
): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  const detune = 0.02 // Slight detuning for richness
  const lfoFreq = 0.1 // Slow LFO for movement
  const lfoDepth = 0.005 // Subtle LFO amplitude

  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate
    const phase1 = (t * frequency * Math.PI * 2) % (Math.PI * 2)
    const phase2 = (t * frequency * (1 + detune) * Math.PI * 2) % (Math.PI * 2)
    const lfo = Math.sin(t * lfoFreq * Math.PI * 2) * lfoDepth

    let sample = (Math.sin(phase1) + Math.sin(phase2)) * 0.5 * (1 + lfo)
    sample *= Math.exp(-t * 0.5) * 0.3 // Decay

    buffer[i * 2] = sample
    buffer[i * 2 + 1] = sample * 0.8
  }

  return buffer
}

/**
 * Generate traffic/engine sound buffer
 */
function generateTrafficBuffer(
  ctx: AudioContext,
  length: number,
  sampleRate: number,
  vehicleType: 'vintage' | 'modern' | 'electric' | 'future'
): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  const rpm = vehicleType === 'vintage' ? 200 : vehicleType === 'modern' ? 800 : 1200
  const baseFreq = rpm / 60 / 4

  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate
    const enginePhase = (t * rpm / 60 * Math.PI) % (Math.PI * 2)

    let sample: number
    switch (vehicleType) {
      case 'vintage':
        // Deep rumbling with exhaust pops
        const exhaust = Math.random() > 0.997 ? Math.random() * 0.3 : 0
        sample = Math.sin(enginePhase) * 0.3 + exhaust
        sample *= Math.exp(-Math.abs(t % 0.1 - 0.05) * 20)
        break
      case 'modern':
        // Higher pitched with tire noise
        sample = Math.sin(enginePhase * 10) * 0.2
        sample += Math.sin(enginePhase * 100) * 0.1 * (0.5 + t % 1)
        break
      case 'electric':
        // Smooth hum with electronic whine
        sample = Math.sin(enginePhase * 20) * 0.15
        sample += Math.sin(enginePhase * 1000) * 0.05
        break
      case 'future':
        // Subtle digital hum
        sample = Math.sin(enginePhase * 50) * 0.1
        sample += Math.sin(enginePhase * 2000) * 0.03
        break
    }

    buffer[i * 2] = sample
    buffer[i * 2 + 1] = sample * (0.9 + Math.random() * 0.2)
  }

  return buffer
}

/**
 * Generate event sound buffers (one-shot effects)
 */
function generateSirenBuffer(_ctx: AudioContext, length: number, sampleRate: number): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate
    const freq1 = 800 + Math.sin(t * 8) * 300
    const freq2 = 600 + Math.sin(t * 6) * 200
    const sample = (Math.sin(t * freq1 * Math.PI * 2) + Math.sin(t * freq2 * Math.PI * 2)) * 0.3

    buffer[i * 2] = sample
    buffer[i * 2 + 1] = sample
  }

  return buffer
}

function generateHornBuffer(_ctx: AudioContext, length: number, sampleRate: number): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  // Quick attack, decay
  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t * 5)
    const sample = Math.sin(t * 440 * Math.PI * 2) * envelope * 0.4

    buffer[i * 2] = sample
    buffer[i * 2 + 1] = sample * 0.9
  }

  return buffer
}

function generateBellBuffer(_ctx: AudioContext, length: number, sampleRate: number): Float32Array {
  const channels = 2
  const bufferSize = length * sampleRate
  const buffer = new Float32Array(bufferSize * channels)

  const harmonics = [1, 2.1, 3.2, 4.5, 5.6]

  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t * 3)
    const sample = harmonics.reduce((sum, h) => sum + Math.sin(t * 800 * h * Math.PI * 2) * envelope / harmonics.length, 0) * 0.5

    buffer[i * 2] = sample
    buffer[i * 2 + 1] = sample * 0.85
  }

  return buffer
}

/**
 * Generate full era audio buffers
 */
export function generateEraAudioBuffers(ctx: AudioContext, eraId: EraId, data: SfxEraData): EraAudioBuffers {
  const sampleRate = ctx.sampleRate
  const length = 5 // 5 second loops

  const ambientData = generateNoiseBuffer(ctx, length, sampleRate, data.ambientTones.noiseColor)
  const ambientBuffer = ctx.createBuffer(2, ambientData.length / 2, sampleRate)
  ambientBuffer.getChannelData(0).set(new Float32Array(ambientData.length / 2))
  ambientBuffer.getChannelData(1).set(new Float32Array(ambientData.length / 2))

  const trafficData = generateTrafficBuffer(
    ctx,
    length,
    sampleRate,
    eraId === '1945' || eraId === '1965' ? 'vintage' :
    eraId === '1985' || eraId === '2005' ? 'modern' :
    eraId === '2025' ? 'electric' : 'future'
  ) as Float32Array
  const trafficBuffer = ctx.createBuffer(2, trafficData.length / 2, sampleRate)
  trafficBuffer.getChannelData(0).set(new Float32Array(ambientData.length / 2))
  trafficBuffer.getChannelData(1).set(new Float32Array(ambientData.length / 2))

  // Generate event buffers
  const eventBuffers: AudioBuffer[] = []
  for (const event of data.eventTypes) {
    let eventData: Float32Array
    const eventLength = Math.min(event.duration, 3)
    const eventSampleCount = eventLength * sampleRate

    if (event.name.includes('siren')) {
      eventData = generateSirenBuffer(ctx, eventLength, sampleRate)
    } else if (event.name.includes('horn')) {
      eventData = generateHornBuffer(ctx, eventLength, sampleRate)
    } else {
      eventData = generateBellBuffer(ctx, eventLength, sampleRate)
    }

    const eventBuffer = ctx.createBuffer(2, eventSampleCount, sampleRate)
    eventBuffer.getChannelData(0).set(new Float32Array(eventData.length / 2))
    eventBuffer.getChannelData(1).set(new Float32Array(eventData.length / 2))
    eventBuffers.push(eventBuffer)
  }

  return { ambient: ambientBuffer, traffic: trafficBuffer, events: eventBuffers }
}

/**
 * Generate all era buffers at once
 */
export function generateAllEraBuffers(ctx: AudioContext): Record<EraId, EraAudioBuffers> {
  const importSfxData = async (): Promise<Record<EraId, SfxEraData>> => {
    const { SFX_ERA_DATA } = await import('../eras')
    return SFX_ERA_DATA
  }

  // This will be called with preloaded data
  return {} as Record<EraId, EraAudioBuffers>
}