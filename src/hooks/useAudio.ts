import { useEffect, useRef } from 'react'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export function useAudio() {
  const contextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    contextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop()
      }
      if (contextRef.current) {
        contextRef.current.close()
      }
    }
  }, [])

  const playEraTransition = (era: Era) => {
    if (!contextRef.current) return

    const frequencies: Record<Era, number> = {
      '1945': 110,
      '1965': 220,
      '1985': 330,
      '2005': 440,
      '2025': 550,
      '2055': 660,
    }

    const now = contextRef.current.currentTime
    
    const oscillator = contextRef.current.createOscillator()
    const gainNode = contextRef.current.createGain()
    
    oscillator.type = 'sine'
    oscillator.frequency.value = frequencies[era]
    
    oscillator.connect(gainNode)
    gainNode.connect(contextRef.current.destination)
    
    gainNode.gain.setValueAtTime(0.1, now)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2)
    
    oscillator.start(now)
    oscillator.stop(now + 2)
    
    oscillatorRef.current = oscillator
    gainRef.current = gainNode
  }

  const playAmbientSound = (era: Era) => {
    if (!contextRef.current) return

    const now = contextRef.current.currentTime
    const gainNode = contextRef.current.createGain()
    gainNode.connect(contextRef.current.destination)
    gainNode.gain.setValueAtTime(0.05, now)
    
    const noiseBuffer = contextRef.current.createBuffer(2, contextRef.current.sampleRate * 2, contextRef.current.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    
    for (let i = 0; i < noiseBuffer.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1
    }
    
    const source = contextRef.current.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true
    source.connect(gainNode)
    source.start(now)
    
    setTimeout(() => {
      source.stop()
    }, 30000)
  }

  return { playEraTransition, playAmbientSound }
}