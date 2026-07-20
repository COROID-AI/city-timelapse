import React, { useEffect, useRef } from 'react'
import type { Era } from '../App'

interface SoundManagerProps {
  era: Era
}

// Era-specific ambient sounds using Web Audio API (procedural)
const eraSounds: Record<Era, { frequencies: number[]; duration: number }> = {
  1945: {
    frequencies: [220, 330, 440], // Warm, nostalgic tones
    duration: 5000,
  },
  1965: {
    frequencies: [330, 550, 660], // Upbeat, modern
    duration: 3000,
  },
  1985: {
    frequencies: [440, 880, 1760], // Bright, synth-like
    duration: 2000,
  },
  2005: {
    frequencies: [220, 440, 880, 1760], // Digital ambience
    duration: 1000,
  },
  2025: {
    frequencies: [110, 220, 330, 550], // Present day
    duration: 1500,
  },
  2055: {
    frequencies: [110, 165, 220, 330, 550], // Futuristic tones
    duration: 800,
  },
}

// Global audio context for AudioContext management
let globalAudioContext: AudioContext | null = null
let soundEnabled = false

export const SoundManager: React.FC<SoundManagerProps> = ({ era }) => {
  const prevEraRef = useRef<Era>(era)

  useEffect(() => {
    // Initialize audio context on first user interaction
    const initAudio = () => {
      if (!globalAudioContext && !soundEnabled) {
        try {
          globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          soundEnabled = true
        } catch (e) {
          console.warn('Web Audio API not supported', e)
        }
      }
    }

    // Initialize on first click anywhere
    const handleFirstInteraction = () => {
      initAudio()
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)

    const playAmbient = () => {
      if (!globalAudioContext || !soundEnabled) return

      const ctx = globalAudioContext
      const sound = eraSounds[era]

      sound.frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.connect(gain)
        gain.connect(ctx.destination)

        oscillator.frequency.setValueAtTime(freq, ctx.currentTime)
        oscillator.type = era === 2055 ? 'sine' : 'square'

        gain.gain.setValueAtTime(0.02, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.duration / 1000)

        oscillator.start(ctx.currentTime + (i * 0.1))
        oscillator.stop(ctx.currentTime + sound.duration / 1000)
      })
    }

    // Only play after context is enabled
    if (soundEnabled && prevEraRef.current !== era) {
      playAmbient()
    }
    prevEraRef.current = era

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [era])

  return null
}