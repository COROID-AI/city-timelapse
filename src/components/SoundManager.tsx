import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import type { Era } from '../types/era'

// Audio context for generating era-specific tones
class AmbientSoundGenerator {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private isPlaying = false

  async init() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      console.warn('Audio not supported')
    }
  }

  playEraSound(era: Era, volume: number = 0.1) {
    if (!this.ctx) return

    // Different frequency for each era
    const frequencies: Record<Era, number> = {
      1945: 110,  // Low, warm tone
      1965: 220,  // Mid tone
      1985: 330,  // Higher tone
      2005: 440,  // Clear tone
      2025: 550,  // Bright tone
      2055: 880,  // Futuristic high tone
    }

    this.stop()

    this.oscillator = this.ctx.createOscillator()
    this.gainNode = this.ctx.createGain()

    this.oscillator.type = 'sine'
    this.oscillator.frequency.value = frequencies[era]

    this.oscillator.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)
    this.gainNode.gain.value = volume

    this.oscillator.start()
    this.isPlaying = true

    // Add subtle modulation
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.1
    lfoGain.gain.value = 10
    lfo.connect(lfoGain)
    lfoGain.connect(this.oscillator.frequency)
    lfo.start()
  }

  stop() {
    if (this.oscillator) {
      this.oscillator.stop()
      this.oscillator = null
    }
    this.isPlaying = false
  }
}

const soundGenerator = new AmbientSoundGenerator()

export function SoundManager({ era }: { era: Era }) {
  const currentEra = useRef<Era | null>(null)

  useEffect(() => {
    soundGenerator.init()
  }, [])

  useEffect(() => {
    if (currentEra.current === era) return
    currentEra.current = era
    soundGenerator.playEraSound(era)

    return () => {
      soundGenerator.stop()
    }
  }, [era])

  return null
}