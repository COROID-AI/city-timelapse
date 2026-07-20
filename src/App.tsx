import React, { useState, Suspense, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload, Html } from '@react-three/drei'
import { CityScene } from './components/CityScene'
import { Timeline } from './components/Timeline'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { SoundManager } from './components/SoundManager'

export type Era = 1945 | 1965 | 1985 | 2005 | 2025 | 2055

const ERAS: Era[] = [1945, 1965, 1985, 2005, 2025, 2055]

function App() {
  const [currentEra, setCurrentEra] = useState<Era>(1945)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleEraChange = useCallback((newEra: Era) => {
    if (newEra === currentEra) return
    setIsTransitioning(true)
    setCurrentEra(newEra)
    // 2-3 second morph animation as per requirements
    setTimeout(() => setIsTransitioning(false), 2500)
  }, [currentEra])

  return (
    <div className="w-full h-full relative">
      <ErrorBoundary>
        <Canvas
          frameloop="demand"
          camera={{ position: [0, 50, 100], fov: 60 }}
          performance={{ min: 0.5, max: 1 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={
            <Html center>
              <LoadingScreen />
            </Html>
          }>
            <CityScene era={currentEra} />
            <Preload all />
          </Suspense>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI * 0.85}
            minPolarAngle={Math.PI * 0.15}
            minDistance={20}
            maxDistance={200}
            target={[0, 0, 0]}
          />
        </Canvas>
      </ErrorBoundary>

      <SoundManager era={currentEra} />

      <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
        <Timeline
          eras={ERAS}
          currentEra={currentEra}
          onEraChange={handleEraChange}
          isTransitioning={isTransitioning}
        />
      </div>
    </div>
  )
}

export default App