import { useEffect, useRef } from 'react'
import type { Era } from '../types/era'

interface AudioManagerProps {
  era: Era
}

export function AudioManager({ era }: AudioManagerProps) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodesRef = useRef<GainNode[]>([])
  const prevEraRef = useRef<Era | null>(null)

  useEffect(() => {
    // Create audio context on first interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        createAmbientSounds()
      }
    }

    // Handle user interaction for audio unlock
    const handleInteraction = () => {
      initAudio()
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      // Dispose audio resources
      oscillatorsRef.current.forEach(osc => {
        try {
          osc.stop()
        } catch (e) {
          // Ignore errors on stop
        }
      })
      oscillatorsRef.current = []
      gainNodesRef.current = []
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!audioContextRef.current || !prevEraRef.current) {
      prevEraRef.current = era
      return
    }

    // Play transition sound when era changes
    if (prevEraRef.current !== era) {
      playTransitionSound()
    }
    
    prevEraRef.current = era
  }, [era])

  const createAmbientSounds = () => {
    if (!audioContextRef.current) return

    try {
      // Create multiple ambient sounds - traffic, crowd, wind
      const traffic = audioContextRef.current.createOscillator()
      const trafficGain = audioContextRef.current.createGain()
      traffic.type = 'sine'
      traffic.frequency.setValueAtTime(80, audioContextRef.current.currentTime)
      trafficGain.gain.setValueAtTime(0.05, audioContextRef.current.currentTime)
      
      traffic.connect(trafficGain)
      trafficGain.connect(audioContextRef.current.destination)
      traffic.start()
      
      oscillatorsRef.current.push(traffic)
      gainNodesRef.current.push(trafficGain)
    } catch (e) {
      console.warn('Audio creation failed:', e)
    }
  }

  const playTransitionSound = () => {
    if (!audioContextRef.current) return

    try {
      // Create a pleasant transition sound using Web Audio API
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(200, audioContextRef.current.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContextRef.current.currentTime + 0.5)
      
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.5)
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + 0.5)
    } catch (e) {
      console.warn('Transition sound failed:', e)
    }
  }

  return null
}