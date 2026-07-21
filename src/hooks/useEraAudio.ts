import { useEffect, useRef } from 'react'
import { Era } from '@/App'

// Era-specific sound profiles (using Web Audio API for synthesised sounds)
const ERA_SOUNDS: Record<Era, { 
  ambient: string
  traffic: string
  description: string
}> = {
  '1945': {
    ambient: 'wartime_rebuilding',
    traffic: 'classic_cars',
    description: 'Steam trains, early traffic, reconstruction sounds'
  },
  '1965': {
    ambient: 'midcentury_bustle',
    traffic: 'muscle_car_engines',
    description: 'Car horns, bustling streets, radio music'
  },
  '1985': {
    ambient: 'urban_development',
    traffic: 'synthesizer_cars',
    description: 'Early synthesizers, digital beeps, urban noise'
  },
  '2005': {
    ambient: 'digital_age',
    traffic: 'hybrid_cars',
    description: 'Cell phone ringtones, traffic, digital sounds'
  },
  '2025': {
    ambient: 'sustainable_future',
    traffic: 'electric_vehicles',
    description: 'Electric hums, clean energy sounds, subtle tech'
  },
  '2055': {
    ambient: 'sci_fi_tomorrow',
    traffic: 'hover_vehicles',
    description: 'Hover sounds, futuristic ambiance, advanced tech'
  }
}

export function useEraAudio(era: Era) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<{[key: string]: OscillatorNode | null}>({})
  const gainNodesRef = useRef<{[key: string]: GainNode | null}>({})

  useEffect(() => {
    // Initialize audio context on first user interaction
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Create gain nodes for different sound layers
      gainNodesRef.current.ambient = audioContextRef.current.createGain()
      gainNodesRef.current.ambient.gain.value = 0
      gainNodesRef.current.ambient.connect(audioContextRef.current.destination)
      
      gainNodesRef.current.traffic = audioContextRef.current.createGain()
      gainNodesRef.current.traffic.gain.value = 0
      gainNodesRef.current.traffic.connect(audioContextRef.current.destination)
    }

    const ctx = audioContextRef.current
    if (!ctx) return

    // Stop any existing sounds
    Object.values(oscillatorsRef.current).forEach(osc => {
      if (osc) {
        try {
          osc.stop()
        } catch (e) {
          // Already stopped
        }
      }
    })
    oscillatorsRef.current = {}

    // Start era-appropriate ambient sound
    const ambientOsc = ctx.createOscillator()
    oscillatorsRef.current.ambient = ambientOsc

    switch (era) {
      case '1945':
        ambientOsc.frequency.value = 110 // Lower, warm tones
        ambientOsc.type = 'sine'
        break
      case '1965':
        ambientOsc.frequency.value = 220 // Mid-tones
        ambientOsc.type = 'triangle'
        break
      case '1985':
        ambientOsc.frequency.value = 330 // Higher, synth-like
        ambientOsc.type = 'sawtooth'
        break
      case '2005':
        ambientOsc.frequency.value = 220 // Digital tone
        ambientOsc.type = 'sine'
        break
      case '2025':
        ambientOsc.frequency.value = 440 // Clean tone
        ambientOsc.type = 'sine'
        break
      case '2055':
        ambientOsc.frequency.value = 880 // High-tech tone
        ambientOsc.type = 'sine'
        break
    }

    ambientOsc.connect(gainNodesRef.current.ambient!)
    gainNodesRef.current.ambient!.gain.setValueAtTime(0, ctx.currentTime)
    gainNodesRef.current.ambient!.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1)
    ambientOsc.start()

    // Traffic sounds - rhythmic pulsing
    const trafficOsc = ctx.createOscillator()
    oscillatorsRef.current.traffic = trafficOsc
    const trafficGain = gainNodesRef.current.traffic!

    trafficOsc.type = 'sine'
    trafficOsc.frequency.value = era === '2055' ? 1760 : era === '2025' ? 880 : 440

    const trafficMod = ctx.createOscillator()
    trafficMod.type = 'sine'
    trafficMod.frequency.value = era === '1945' ? 0.5 : era === '2055' ? 8 : 2

    trafficMod.connect(trafficOsc.frequency)
    trafficOsc.connect(trafficGain)
    trafficGain.connect(ctx.destination)

    trafficGain.gain.setValueAtTime(0, ctx.currentTime)
    trafficGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1)
    trafficOsc.start()
    trafficMod.start()

    // Cleanup on unmount or era change
    return () => {
      if (gainNodesRef.current.ambient) {
        gainNodesRef.current.ambient.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      }
      if (gainNodesRef.current.traffic) {
        gainNodesRef.current.traffic.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      }
    }
  }, [era])

  return null
}