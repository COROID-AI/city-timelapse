import React, { useEffect, useRef } from 'react'
import { useEraStore } from '../stores/eraStore'
import { Era } from '../lib/types'

export const AudioManager: React.FC = () => {
  const { currentEra } = useEraStore()
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)

  useEffect(() => {
    // Create audio context on first interaction (required by browsers)
    const handleInteraction = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  useEffect(() => {
    if (audioContextRef.current) {
      // Stop any existing oscillator
      if (oscillatorRef.current) {
        oscillatorRef.current.stop()
      }

      // Create ambient sound based on era
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      oscillator.type = 'sine'

      // Set frequency based on era for different atmosphere
      const frequencies: Record<Era, number> = {
        '1945': 110, // Wartime - somber tones
        '1965': 220, // Busy - mid range
        '1985': 440, // Neon - higher energy
        '2005': 330, // Modern - balanced
        '2025': 277, // Eco - peaceful
        '2055': 880, // Future - high tech
      }

      oscillator.frequency.value = frequencies[currentEra]
      gainNode.gain.value = 0.05 // Very quiet ambient

      oscillator.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start()
      oscillatorRef.current = oscillator
    }
  }, [currentEra])

  return null
}