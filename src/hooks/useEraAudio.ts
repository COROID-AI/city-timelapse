import { useEffect, useRef } from 'react'
import { Era } from '../contexts/EraContext'

// Audio context for Web Audio API (fallback for howler)
const eraAudioConfigs: Record<Era, { frequency: number; type: OscillatorType }> = {
  '1945': { frequency: 110, type: 'sine' },
  '1965': { frequency: 220, type: 'triangle' },
  '1985': { frequency: 330, type: 'square' },
  '2005': { frequency: 440, type: 'sine' },
  '2025': { frequency: 550, type: 'sine' },
  '2055': { frequency: 660, type: 'sine' },
}

export function useEraAudio(currentEra: Era) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Create audio context on first run
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const config = eraAudioConfigs[currentEra]
    const fadeDuration = 1000

    // Fade out current sound
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current?.currentTime! + fadeDuration / 1000)
      setTimeout(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop()
        }
      }, fadeDuration)
    }

    // Create and start new sound
    if (audioContextRef.current) {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      
      oscillator.type = config.type
      oscillator.frequency.value = config.frequency
      gainNode.gain.value = 0
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      oscillator.start()
      gainNode.gain.linearRampToValueAtTime(0.05, audioContextRef.current.currentTime + fadeDuration / 1000)
      
      oscillatorRef.current = oscillator
      gainNodeRef.current = gainNode
    }

    return () => {
      // Cleanup on unmount or era change
    }
  }, [currentEra])

  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])
}