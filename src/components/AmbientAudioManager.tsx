import React, { useEffect, useRef, useState } from 'react'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'

export const AmbientAudioManager: React.FC<{ era: Era }> = ({ era }) => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])

  useEffect(() => {
    // Initialize audio context on first interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    // Clean up previous oscillators
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop()
      } catch (e) {
        // Oscillator may already be stopped
      }
    })
    oscillatorsRef.current = []

    if (audioContextRef.current) {
      const ctx = audioContextRef.current

      // Era-specific ambient sounds (using Web Audio API for procedural sounds)
      switch (era) {
        case 1945:
          // Post-war ambience - gentle, nostalgic
          createAmbientSound(ctx, 110, 0.02, 'sine') // Low hum
          break
        case 1965:
          // Mid-century - bright, optimistic
          createAmbientSound(ctx, 220, 0.03, 'triangle')
          break
        case 1985:
          // 80s - energetic, electronic
          createAmbientSound(ctx, 440, 0.04, 'square')
          break
        case 2005:
          // Modern - busy, digital
          createAmbientSound(ctx, 110, 0.03, 'sawtooth')
          break
        case 2025:
          // Sustainable - clean, futuristic hints
          createAmbientSound(ctx, 220, 0.02, 'sine')
          createFuturisticHum(ctx, 880, 0.01)
          break
        case 2055:
          // Cyberpunk - synthetic, layered
          createAmbientSound(ctx, 110, 0.04, 'square')
          createFuturisticHum(ctx, 440, 0.02)
          createHighTechHum(ctx, 1760, 0.015)
          break
      }
    }

    // Add event listeners for user interaction to enable audio
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })

    return () => {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop()
        } catch (e) {
          // Ignore errors on stop
        }
      })
      oscillatorsRef.current = []
    }
  }, [era])

  return null
}

function createAmbientSound(
  ctx: AudioContext,
  frequency: number,
  gain: number,
  type: OscillatorType
) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency
  gainNode.gain.value = gain

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start()

  ;(oscillation as any).gainNode = gainNode
}

function createFuturisticHum(ctx: AudioContext, frequency: number, gain: number) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gainNode.gain.value = gain

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start()
}

function createHighTechHum(ctx: AudioContext, frequency: number, gain: number) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gainNode.gain.value = gain

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start()
}