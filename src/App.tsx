import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/drei'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { SoundManager } from './components/SoundManager'
import { PerformanceMonitor } from './components/PerformanceMonitor'
import { EraYear, ERAS } from './types'

function App() {
  const [currentEra, setCurrentEra] = useState<EraYear>(1945)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
  }, [])

  const handleEraChange = useCallback((year: EraYear) => {
    setCurrentEra(year)
  }, [])

  const interpolatedEra = useMemo(() => {
    return currentEra
  }, [currentEra])

  return (
    <div className="relative w-full h-full">
      {/* Timeline Slider - semantic HTML outside canvas */}
      <header className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-auto">
        <nav aria-label="Era selection">
          <TimelineSlider
            eras={ERAS}
            currentEra={currentEra}
            onEraChange={handleEraChange}
          />
        </nav>
      </header>

      {/* Loading state */}
      {loading && (
        <div 
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/80"
          role="status"
          aria-label="Loading city scene"
        >
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white text-lg">Loading City Timeline...</p>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 20, 40], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={() => setLoading(false)}
      >
        <color attach="background" args={['#0a0a1a']} />
        
        {/* Environment lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1} 
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <CityScene 
          era={interpolatedEra} 
          reducedMotion={reducedMotion}
        />

        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom 
            mipmapBlur
            intensity={0.5}
            luminanceThreshold={0.1}
            luminanceRange={0.5}
          />
          <ToneMapping />
        </EffectComposer>
      </Canvas>

      {/* Performance Monitor */}
      <PerformanceMonitor />

      {/* Sound Manager */}
      <SoundManager era={currentEra} />
    </div>
  )
}

export default App