import React, { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Preload } from '@react-three/drei'
import { useStore } from './lib/store'
import { Scene } from './components/Scene'
import { TimelineSlider } from './components/TimelineSlider'
import { LoadingOverlay } from './components/LoadingOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PerformanceMonitor } from './components/PerformanceMonitor'

export default function App() {
  const { webglAvailable, loading, error, setWebglAvailable, setError, audioEnabled, setAudioEnabled } = useStore()
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      setWebglAvailable(!!gl)
      canvas.remove()
    } catch (e) {
      setWebglAvailable(false)
      setError({ hasError: true, message: 'WebGL is not available in your browser' })
    }

    // Initialize audio context on first interaction
    const handleInteraction = () => {
      if (!audioContext && audioEnabled) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(ctx)
      }
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [audioContext, audioEnabled, setWebglAvailable, setError])

  if (!webglAvailable) {
    return (
      <div className="error-boundary">
        <h2>WebGL Not Available</h2>
        <p>Your browser does not support WebGL, which is required to view this 3D scene.</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    )
  }

  return (
    <>
      <TimelineSlider />
      <ErrorBoundary>
        <Canvas
          ref={canvasRef}
          frameloop="demand"
          camera={{ position: [50, 50, 80], fov: 60 }}
          gl={{ 
            antialias: true, 
            alpha: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene />
            <Preload all />
          </Suspense>
          <PerformanceMonitor />
        </Canvas>
      </ErrorBoundary>
      <LoadingOverlay 
        progress={loading.progress} 
        visible={loading.progress < 100} 
      />
    </>
  )
}