import React, { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { EraSlider } from './components/EraSlider'
import { CityScene } from './components/CityScene'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AudioManager } from './components/AudioManager'
import { useEraStore } from './stores/eraStore'
import { Era } from './lib/types'

const ERA_YEARS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

function App() {
  const { currentEra, setEra } = useEraStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initial load
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <AudioManager />
      <EraSlider years={ERA_YEARS} currentEra={currentEra} onEraChange={setEra} />
      <ErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 20, 50], fov: 60 }}
          performance={{ min: 0.5, max: 1, current: 1 }}
        >
          <Suspense fallback={null}>
            <CityScene />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      <Loader />
    </div>
  )
}

export default App