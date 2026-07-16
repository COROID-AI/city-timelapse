import { useEffect, useRef } from 'react'
import useStore from '../stores/timelineStore'
import { Era, ERA_CONFIGS } from '../stores/types'

// Sound manager using Web Audio API
class SoundManager {
  private context: AudioContext | null = null
  private ambientGain: GainNode | null = null
  private vehicleGain: GainNode | null = null
  private isInitialized = false

  init() {
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.ambientGain = this.context.createGain()
      this.vehicleGain = this.context.createGain()
      
      this.ambientGain.gain.value = 0.3
      this.vehicleGain.gain.value = 0.2
      
      this.ambientGain.connect(this.context.destination)
      this.vehicleGain.connect(this.context.destination)
      this.isInitialized = true
    }
  }

  playAmbient(era: Era) {
    if (!this.context) return
    
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    
    oscillator.connect(gain)
    gain.connect(this.ambientGain!)
    
    // Different ambient sounds for each era
    const frequencies: Record<Era, number> = {
      '1945': 110, // Warm, nostalgic
      '1965': 220, // Upbeat, modern
      '1985': 330, // Energetic, vibrant
      '2005': 440, // Digital, clean
      '2025': 550, // Modern, crisp
      '2055': 660  // Futuristic, ethereal
    }
    
    oscillator.frequency.value = frequencies[era]
    oscillator.type = era === '2055' ? 'sine' : 'triangle'
    gain.gain.value = 0.05
    
    oscillator.start()
    oscillator.stop(this.context!.currentTime + 2)
  }

  playTransition() {
    if (!this.context) return
    
    // Sweep sound for transitions
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    
    oscillator.connect(gain)
    gain.connect(this.vehicleGain!)
    
    oscillator.frequency.setValueAtTime(100, this.context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1000, this.context.currentTime + 1)
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1)
    
    oscillator.start()
    oscillator.stop(this.context!.currentTime + 1)
  }

  playVehicleSound(era: Era) {
    if (!this.context) return
    
    // Subtle engine sounds based on vehicle type
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    
    oscillator.connect(gain)
    gain.connect(this.vehicleGain!)
    
    const frequencies: Record<Era, number> = {
      '1945': 80,
      '1965': 120,
      '1985': 100,
      '2005': 150,
      '2025': 200,
      '2055': 400
    }
    
    oscillator.frequency.value = frequencies[era]
    oscillator.type = 'sawtooth'
    gain.gain.value = 0.02
    
    oscillator.start()
    oscillator.stop(this.context!.currentTime + 0.5)
  }

  async resume() {
    if (this.context?.state === 'suspended') {
      await this.context.resume()
    }
  }
}

export const soundManager = new SoundManager()

export function useSoundEffects() {
  const { currentEra, targetEra, isTransitioning } = useStore()
  const wasTransitioning = useRef(false)

  useEffect(() => {
    soundManager.init()
    return () => {
      if (soundManager.context) {
        soundManager.context.close()
      }
    }
  }, [])

  useEffect(() => {
    if (isTransitioning && !wasTransitioning.current) {
      soundManager.playTransition()
    }
    wasTransitioning.current = isTransitioning
    
    // Play ambient sound periodically
    const interval = setInterval(() => {
      soundManager.playAmbient(currentEra)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [currentEra, isTransitioning])

  useEffect(() => {
    // Resume audio context on user interaction
    const handleInteraction = () => {
      soundManager.resume()
    }
    
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('touchstart', handleInteraction, { once: true })
    
    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  return null
}