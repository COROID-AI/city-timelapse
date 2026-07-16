import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload, Environment, Bloom } from '@react-three/drei'
import { useState, useCallback, Suspense } from 'react'
import { CityBlock } from './components/CityBlock'
import { TimelineSlider } from './components/TimelineSlider'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SoundManager } from './components/SoundManager'
import { EraProvider } from './contexts/EraContext'

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleAssetsLoaded = useCallback(() => {
    setIsLoading(false)
  }, [])

  const handleError = useCallback((error: Error) => {
    console.error('Scene error:', error)
    setHasError(true)
  }, [])

  return (
    <ErrorBoundary onError={handleError}>
      <EraProvider>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {!isLoading && <TimelineSlider />}
          <Canvas
            camera={{ position: [50, 30, 50], fov: 60 }}
            gl={{
              antialias: true,
              alpha: false,
              stencil: false,
              depth: true,
              powerPreference: 'high-performance',
              pixelRatio: Math.min(window.devicePixelRatio, 2),
              outputColorSpace: 'srgb',
              toneMapping: 4,
              toneMappingExposure: 1.0
            }}
            onCreated={({ gl, camera }) => {
              gl.setClearColor('#050505')
              camera.lookAt(0, 10, 0)
            }}
          >
            <Suspense fallback={null}>
              <CityBlock onLoaded={handleAssetsLoaded} />
              <Preload all />
            </Suspense>
            <Environment preset="night" />
            <Bloom 
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              height={300}
              intensity={0.5}
            />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              maxPolarAngle={Math.PI / 2}
              minDistance={20}
              maxDistance={150}
            />
          </Canvas>
        </div>
        {!isLoading && <SoundManager />}
        <LoadingScreen isVisible={isLoading || hasError} hasError={hasError} />
      </EraProvider>
    </ErrorBoundary>
  )
}
