import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload, Loader } from '@react-three/drei'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { CameraControls } from './components/CameraControls'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EraProvider, useEra, Era } from './contexts/EraContext'
import { useEraAudio } from './hooks/useEraAudio'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mediaQuery.addEventListener('change', handler)
    
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return reduced
}

function SceneContent() {
  const { currentEra, transitionProgress } = useEra()
  const prefersReducedMotion = useReducedMotion()
  useEraAudio(currentEra)

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Suspense fallback={null}>
        <CityScene 
          currentEra={currentEra} 
          transitionProgress={prefersReducedMotion ? 1 : transitionProgress}
        />
        <Preload all />
      </Suspense>
    </>
  )
}

function AppInner() {
  const { currentEra, setEra, transitionProgress, isTransitioning } = useEra()
  const prefersReducedMotion = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleEraChange = useCallback((era: Era) => {
    setEra(era)
  }, [setEra])

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (error) {
    return (
      <div 
        className="w-full h-screen flex items-center justify-center bg-slate-900 text-white"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center px-4">
          <h1 className="text-2xl mb-4">Error Loading Scene</h1>
          <p className="mb-4 max-w-md">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            aria-label="Reload the page"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="w-full h-screen relative">
      <TimelineSlider 
        currentEra={currentEra} 
        onEraChange={handleEraChange}
        transitionProgress={transitionProgress}
        isTransitioning={isTransitioning}
      />
      <CameraControls />
      <Canvas
        shadows
        camera={{ position: [0, 5, 15], fov: 60 }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        }}
      >
        <color attach="background" args={['#0f172a']} />
        <ErrorBoundary onError={setError}>
          <SceneContent />
        </ErrorBoundary>
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          minDistance={8}
          maxDistance={30}
          maxAzimuthAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 2}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
      <Loader 
        containerStyles={{ background: 'rgba(15, 23, 42, 0.9)' }}
        barStyles={{ background: '#3b82f6' }}
        initialState={(active) => { setLoading(true); return true }}
      />
    </div>
  )
}

export default function App() {
  return (
    <EraProvider>
      <AppInner />
    </EraProvider>
  )
}