import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Era } from './EraContext'

interface AudioContextType {
  playEraSound: (era: Era) => void
  isPlaying: boolean
}

export const AudioContext = createContext<AudioContextType>({
  playEraSound: () => {},
  isPlaying: false,
})

// Era-specific audio configurations
const eraAudio: Record<Era, { frequency: number; type: OscillatorType }> = {
  '1945': { frequency: 110, type: 'sine' }, // Warm, nostalgic
  '1965': { frequency: 220, type: 'sine' }, // Upbeat, optimistic
  '1985': { frequency: 165, type: 'triangle' }, // Electric, synthetic
  '2005': { frequency: 330, type: 'sawtooth' }, // Modern, digital
  '2025': { frequency: 440, type: 'sine' }, // Contemporary, ambient
  '2055': { frequency: 550, type: 'square' }, // Futuristic, ethereal
}

interface AudioProviderProps {
  children: ReactNode
}

export function AudioProvider({ children }: AudioProviderProps) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentOscillator, setCurrentOscillator] = useState<OscillatorNode | null>(null)

  useEffect(() => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioContext(ctx)
    }
  }, [audioContext])

  const playEraSound = useCallback((era: Era) => {
    if (!audioContext) return

    // Stop current sound
    if (currentOscillator) {
      currentOscillator.stop()
      setCurrentOscillator(null)
    }

    const config = eraAudio[era]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = config.type
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime)
    
    // Add subtle modulation for richness
    const lfo = audioContext.createOscillator()
    const lfoGain = audioContext.createGain()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(0.5, audioContext.currentTime)
    lfoGain.gain.setValueAtTime(config.frequency * 0.1, audioContext.currentTime)
    lfo.connect(lfoGain).connect(oscillator.frequency)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.5)

    oscillator.start()
    lfo.start()
    setCurrentOscillator(oscillator)
    setIsPlaying(true)

    // Schedule stop after transition
    setTimeout(() => {
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1)
    }, 4000)
  }, [audioContext, currentOscillator])

  return (
    <AudioContext.Provider value={{ playEraSound, isPlaying }}>
      {children}
    </AudioContext.Provider>
  )
}