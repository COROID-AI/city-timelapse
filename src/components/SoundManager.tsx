import { useEffect, useRef } from 'react'

// Mock audio files using Web Audio API tones
const createAudioContext = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return ctx
}

const ERA_SOUNDS: Record<number, { frequencies: number[], type: string }> = {
  1945: { frequencies: [220, 330, 440], type: 'warm' }, // Post-war ambiance
  1965: { frequencies: [110, 220, 330], type: 'bright' }, // Modernist jazz
  1985: { frequencies: [880, 1760, 3520], type: 'electronic' }, // Synth/electronic
  2005: { frequencies: [440, 880, 1320], type: 'digital' }, // Digital hum
  2025: { frequencies: [1760, 2200, 2640], type: 'smart' }, // Futuristic tones
  2055: { frequencies: [880, 1760, 3520], type: 'holographic' }, // Holographic
}

export function SoundManager({ era }: { era: number }) {
  const audioRef = useRef<{
    ctx: AudioContext | null
    oscillator: OscillatorNode | null
    gainNode: GainNode | null
    isPlaying: boolean
  }>({
    ctx: null,
    oscillator: null,
    gainNode: null,
    isPlaying: false
  })

  useEffect(() => {
    const { ctx, oscillator, gainNode, isPlaying } = audioRef.current
    
    // Smooth transition to new era sound
    if (isPlaying && oscillator) {
      gainNode?.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + 1)
    }
    
    // Create new audio for era
    const resumeEraAudio = async () => {
      try {
        const ctx = createAudioContext()
        await ctx.resume()
        
        const gainNode = ctx.createGain()
        gainNode.gain.value = 0.1
        
        const { frequencies, type } = ERA_SOUNDS[era as keyof typeof ERA_SOUNDS]
        
        // Create ambient sound using multiple oscillators
        frequencies.forEach(freq => {
          const osc = ctx.createOscillator()
          osc.type = type === 'warm' ? 'sine' : type === 'electronic' ? 'square' : 'sine'
          osc.frequency.value = freq
          
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.value = type === 'holographic' ? 2000 : 1000
          
          osc.connect(filter)
          filter.connect(gainNode)
          
          osc.start()
          osc.stop(ctx.currentTime + 30) // Auto-stop after 30s
        })
        
        gainNode.connect(ctx.destination)
        
        audioRef.current = { ctx, oscillator: null, gainNode, isPlaying: true }
      } catch (e) {
        // Audio context might not be available
        console.debug('Audio context not available')
      }
    }
    
    resumeEraAudio()
    
    return () => {
      // Cleanup on unmount or era change
      const { ctx, gainNode } = audioRef.current
      gainNode?.gain.cancelScheduledValues(ctx?.currentTime || 0)
    }
  }, [era])

  return null
}