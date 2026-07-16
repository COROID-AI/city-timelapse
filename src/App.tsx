import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Preload } from '@react-three/drei'
import { useState, useEffect, Suspense, useCallback } from 'react'
import { Leva } from 'leva'
import useStore from './stores/timelineStore'
import { Era, ERAS, ERA_LABELS } from './stores/types'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  const { currentEra, targetEra, isTransitioning, setEra } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)

  useEffect(() => {
    // Simulate loading progress
    const timer = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          setIsLoading(false)
          clearInterval(timer)
          return 100
        }
        return prev + 10
      })
    }, 200)
    return () => clearInterval(timer)
  }, [])

  const handleEraChange = useCallback((era: Era) => {
    setEra(era)
  }, [setEra])

  return (
    <div className="w-full h-full relative">
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen progress={loadingProgress} />}>
          {!isLoading && (
            <>
              <TimelineSlider 
                currentEra={currentEra} 
                targetEra={targetEra}
                isTransitioning={isTransitioning}
                onEraChange={handleEraChange}
              />
              <Leva collapsed={false} />
              <Canvas
                camera={{ position: [30, 30, 30], fov: 60 }}
                frameloop="demand"
                gl={{ antialias: true, alpha: false }}
              >
                <Environment preset="city" background={false} />
                <ambientLight intensity={0.6} />
                <directionalLight 
                  position={[50, 50, 50]} 
                  intensity={1.2} 
                  castShadow 
                  shadow-mapSize={[2048, 2048]}
                />
                <CityScene />
                <OrbitControls 
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  maxPolarAngle={Math.PI / 2}
                  minDistance={10}
                  maxDistance={100}
                />
                <Preload allFragments />
              </Canvas>
            </>
          )}
          {isLoading && <LoadingScreen progress={loadingProgress} />}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default App