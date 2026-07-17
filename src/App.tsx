import { useState, useEffect, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { CityBlock } from './components/CityBlock'
import { PostProcessing } from './components/PostProcessing'
import { AudioManager } from './components/AudioManager'
import { EraSelector } from './components/EraSelector'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useEraTransition } from './hooks/useEraTransition'
import type { Era } from './types/era'
import './App.css'

function App() {
  const [currentEra, setCurrentEra] = useState<Era>('1945')
  const [isLoading, setIsLoading] = useState(true)
  const [transitionProgress, setTransitionProgress] = useState(0)
  
  const { startTransition } = useEraTransition(setTransitionProgress)

  const handleEraChange = useCallback((era: Era) => {
    if (era !== currentEra) {
      startTransition(() => setCurrentEra(era))
    }
  }, [currentEra, startTransition])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <div className="timeline-container">
        <div className="timeline-year">{currentEra}</div>
        <EraSelector currentEra={currentEra} onEraChange={handleEraChange} />
      </div>
      
      <ErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [30, 30, 50], fov: 60 }}
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0c0c14')
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[10, 20, 10]}
              intensity={1.5}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-far={100}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
            />
            
            <Environment preset="city" />
            
            <CityBlock era={currentEra} transitionProgress={transitionProgress} />
            
            <PostProcessing era={currentEra} />
          </Suspense>
          
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={15}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2.2}
            minPolarAngle={Math.PI / 6}
          />
        </Canvas>
        
        <AudioManager era={currentEra} />
      </ErrorBoundary>
    </>
  )
}

export default App