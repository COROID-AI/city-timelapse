import React, { useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import { Era } from '../types'

interface AudioManagerProps {
  currentEra: Era
}

// Ambient sound configurations for each era
const AMBIENT_SOUNDS: Record<number, string> = {
  1945: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', // Silent placeholder
  1965: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  1985: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  2005: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  2025: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  2055: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
}

export const AudioManager: React.FC<AudioManagerProps> = ({ currentEra }) => {
  const ambientSoundRef = useRef<Howl | null>(null)
  const transitionSoundRef = useRef<Howl | null>(null)

  // Initialize and manage ambient sounds
  useEffect(() => {
    // Create transition sound effect
    const transitionSound = new Howl({
      src: [generateTransitionSound()],
      volume: 0.3,
    })
    transitionSoundRef.current = transitionSound

    // Play transition sound when era changes
    transitionSound.play()
  }, [currentEra])

  // Manage ambient sound based on current era
  useEffect(() => {
    // Stop previous ambient sound
    if (ambientSoundRef.current) {
      ambientSoundRef.current.fade(ambientSoundRef.current.volume(), 0, 1000)
      setTimeout(() => {
        ambientSoundRef.current?.stop()
      }, 1000)
    }

    // Create new ambient sound for current era
    const ambientSound = new Howl({
      src: [generateAmbientSound(currentEra.year)],
      loop: true,
      volume: 0,
      autoplay: true,
    })
    ambientSoundRef.current = ambientSound

    // Fade in the new ambient sound
    ambientSound.fade(0, 0.5, 1000)

    return () => {
      // Cleanup on unmount
      ambientSound.fade(ambientSound.volume(), 0, 500)
      setTimeout(() => {
        ambientSound.stop()
      }, 500)
    }
  }, [currentEra])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ambientSoundRef.current?.unload()
      transitionSoundRef.current?.unload()
    }
  }, [])

  return null // Audio manager doesn't render anything
}

// Generate synthetic ambient sounds
function generateAmbientSound(year: number): string {
  // Generate a simple ambient sound with frequency based on era
  const duration = 2.0
  const sampleRate = 44100
  const frequency = getEraBaseFrequency(year)
  
  const samples = []
  for (let i = 0; i < sampleRate * duration; i++) {
    const t = i / sampleRate
    // Create a subtle ambient tone with some noise
    const noise = (Math.random() - 0.5) * 0.1
    const tone = Math.sin(2 * Math.PI * frequency * t) * 0.3
    const envelope = Math.sin(Math.PI * t / duration) // Fade in/out
    const sample = (tone + noise) * envelope
    samples.push(Math.max(-1, Math.min(1, sample)))
  }

  return createWavBase64(samples, sampleRate)
}

function generateTransitionSound(): string {
  const duration = 0.5
  const sampleRate = 44100
  
  // Create a rising sweep sound for transitions
  const samples = []
  for (let i = 0; i < sampleRate * duration; i++) {
    const t = i / sampleRate
    const freq = 200 + 800 * (t / duration)
    const sweep = Math.sin(2 * Math.PI * freq * t) * 0.3 * (1 - t / duration)
    samples.push(sweep)
  }

  return createWavBase64(samples, sampleRate)
}

function getEraBaseFrequency(year: number): number {
  // Different base frequencies for different eras
  if (year <= 1965) return 110 // Lower, warmer tones for past eras
  if (year <= 2005) return 220 // Mid tones for modern eras
  if (year <= 2025) return 330 // Higher for present
  return 440 // Highest for future
}

function createWavBase64(samples: number[], sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  
  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  
  // Convert samples to 16-bit PCM
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i] * 32767, true)
  }
  
  const bytes = new Uint8Array(buffer)
  const base64 = btoa(String.fromCharCode(...bytes))
  return `data:audio/wav;base64,${base64}`
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}