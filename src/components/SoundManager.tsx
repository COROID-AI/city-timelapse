import { useEffect, useRef } from 'react'
import { useEra, Era } from '../contexts/EraContext'

interface SoundConfig {
  traffic: string
  ambiance: string
  volume: number
}

const SOUND_CONFIGS: Record<Era, SoundConfig> = {
  1945: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.3
  },
  1965: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.35
  },
  1985: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64;//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.4
  },
  2005: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.45
  },
  2025: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.5
  },
  2055: {
    traffic: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    ambiance: 'data:audio/wav;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAhZGF0YQAAAAA=',
    volume: 0.4
  }
}

export function SoundManager() {
  const { era } = useEra()
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map())
  const lastEraRef = useRef<Era | null>(null)

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const config = SOUND_CONFIGS[era]
    
    // Stop previous sounds
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop()
      } catch (e) {}
    })
    oscillatorsRef.current.clear()

    // Create ambient sounds
    const createAmbientSound = (type: OscillatorType, freq: number, gain: number) => {
      if (!audioContextRef.current) return
      const osc = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      
      osc.type = type
      osc.frequency.value = freq
      gainNode.gain.value = gain * config.volume
      
      osc.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      osc.start()
      oscillatorsRef.current.set(type, osc)
    }

    try {
      createAmbientSound('sine', 110, 0.02)
      createAmbientSound('triangle', 220, 0.01)
    } catch (e) {
      console.log('Audio context not available')
    }

    lastEraRef.current = era

    return () => {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop()
        } catch (e) {}
      })
    }
  }, [era])

  return null
}
