import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useEraTransition } from '../era/useEraTransition'

/**
 * Procedural SFX system using the Web Audio API.
 * Generates era-appropriate ambient sounds (no external audio files).
 *
 * - 1945/1965: gentle wind + distant traffic hum
 * - 1985: neon hum + arcade beeps
 * - 2005/2025: city ambience + traffic
 * - 2055: sci-fi hum + digital chirps
 */
export function SFX() {
  const { theme, progress } = useEraTransition()
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map())
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map())

  const initAudio = () => {
    if (audioCtxRef.current) return
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new AudioContext()
    } catch (e) {
      console.warn('Web Audio API not available')
    }
  }

  useEffect(() => {
    initAudio()
    const ctx = audioCtxRef.current
    if (!ctx) return

    const now = ctx.currentTime

    // Determine SFX profile based on era
    const profile = getSFXProfile(theme)

    // Stop existing oscillators
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop(now + 0.5)
      } catch (e) {
        // already stopped
      }
    })
    oscillatorsRef.current.clear()
    gainNodesRef.current.clear()

    // Create new oscillators for the current era
    profile.sounds.forEach((sound, i) => {
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = sound.type
        osc.frequency.setValueAtTime(sound.freq, now)

        // Add subtle frequency modulation for interest
        if (sound.lfoFreq) {
          const lfo = ctx.createOscillator()
          const lfoGain = ctx.createGain()
          lfo.type = 'sine'
          lfo.frequency.setValueAtTime(sound.lfoFreq, now)
          lfoGain.gain.setValueAtTime(sound.freq * (sound.lfoDepth ?? 0.1), now)
          lfo.connect(lfoGain)
          lfoGain.connect(osc.frequency)
          lfo.start(now)
          lfo.stop(now + 60)
        }

        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(sound.volume * (progress < 1 ? progress : 1), now + 1)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 59)

        oscillatorsRef.current.set(sound.name, osc)
        gainNodesRef.current.set(sound.name, gain)
      } catch (e) {
        // ignore
      }
    })

    return () => {
      // Cleanup
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop()
        } catch (e) {
          // already stopped
        }
      })
      oscillatorsRef.current.clear()
      gainNodesRef.current.clear()
    }
  }, [theme, progress])

  // Handle user interaction to resume audio context
  useEffect(() => {
    const handleInteraction = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    }

    document.addEventListener('click', handleInteraction, { once: true })
    document.addEventListener('touchstart', handleInteraction, { once: true })

    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  return null
}

type SoundDef = {
  name: string
  type: OscillatorType
  freq: number
  volume: number
  lfoFreq?: number
  lfoDepth?: number
}

type SFXProfile = {
  sounds: SoundDef[]
}

function getSFXProfile(theme: any): SFXProfile {
  const year = theme.year

  if (year <= 1965) {
    // Post-war / Googie: gentle wind + distant traffic
    return {
      sounds: [
        { name: 'wind', type: 'sawtooth', freq: 180, volume: 0.06 },
        { name: 'traffic', type: 'sawtooth', freq: 60, volume: 0.04, lfoFreq: 0.3, lfoDepth: 0.1 },
      ],
    }
  }

  if (year <= 1985) {
    // Neon era: hum + arcade beeps
    return {
      sounds: [
        { name: 'neon-hum', type: 'sine', freq: 120, volume: 0.08, lfoFreq: 0.15, lfoDepth: 0.05 },
        { name: 'arcade-beep', type: 'square', freq: 880, volume: 0.03 },
      ],
    }
  }

  if (year <= 2025) {
    // Modern: city ambience
    return {
      sounds: [
        { name: 'city-hum', type: 'sine', freq: 90, volume: 0.07, lfoFreq: 0.08, lfoDepth: 0.03 },
        { name: 'traffic-low', type: 'triangle', freq: 55, volume: 0.05, lfoFreq: 0.5, lfoDepth: 0.15 },
      ],
    }
  }

  // 2055: Neo-future
  return {
    sounds: [
      { name: 'sci-fi-hum', type: 'sine', freq: 180, volume: 0.09, lfoFreq: 0.25, lfoDepth: 0.1 },
      { name: 'digital-chirp', type: 'square', freq: 1200, volume: 0.04 },
      { name: 'ambient-whoosh', type: 'sawtooth', freq: 40, volume: 0.06, lfoFreq: 0.1, lfoDepth: 0.3 },
    ],
  }
}
