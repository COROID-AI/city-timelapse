import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { LoadingScreen } from './components/LoadingScreen'
import { AudioManager } from './components/AudioManager'
import { Era } from './types'

const ERAS: Era[] = [
  { year: 1945, label: '1945', description: 'Post-war reconstruction era' },
  { year: 1965, label: '1965', description: 'Economic boom and suburban growth' },
  { year: 1985, label: '1985', description: 'Modernization and glass facades' },
  { year: 2005, label: '2005', description: 'Digital revolution and consumer culture' },
  { year: 2025, label: '2025', description: 'Sustainable smart city' },
  { year: 2055, label: '2055', description: 'Futuristic urban landscape' },
]

function App() {
  const [currentEra, setCurrentEra] = useState<Era>(ERAS[2]) // Start at 1985
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const transitionRef = useRef<gsap.core.Timeline | null>(null)

  // Handle era transitions with smooth animations
  const handleEraChange = useCallback((era: Era) => {
    setCurrentEra(era)
  }, [])

  // Loading simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsLoading(false)
          return 100
        }
        return prev + Math.random() * 10
      })
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = ERAS.findIndex(era => era.year === currentEra.year)
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentIndex > 0) {
          setCurrentEra(ERAS[currentIndex - 1])
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentIndex < ERAS.length - 1) {
          setCurrentEra(ERAS[currentIndex + 1])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentEra])

  // Screen reader announcements
  useEffect(() => {
    const announcement = document.getElementById('sr-announcement')
    if (announcement) {
      announcement.textContent = `Viewing era ${currentEra.year}: ${currentEra.description}`
    }
  }, [currentEra])

  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      {/* Screen reader announcement for accessibility */}
      <div
        id="sr-announcement"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Timeline Slider */}
      <TimelineSlider
        eras={ERAS}
        currentEra={currentEra}
        onEraChange={handleEraChange}
      />

      {/* 3D Canvas */}
      <Canvas
        shadows
        frameloop="demand"
        camera={{ position: [30, 30, 30], fov: 50 }}
        className="canvas-container"
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <CityScene currentEra={currentEra} />
      </Canvas>

      {/* Audio Manager */}
      <AudioManager currentEra={currentEra} />

      {/* Loading Screen */}
      {isLoading && <LoadingScreen progress={progress} />}
    </div>
  )
}

export default App