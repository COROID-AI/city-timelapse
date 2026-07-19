import { Canvas, invalidate } from '@react-three/fiber'
import { OrbitControls, Preload, Loader } from '@react-three/drei'
import { useState, useEffect, useRef, useCallback } from 'react'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EraIndicator } from './components/EraIndicator'
import { EraType } from './types/era'

const ERAS = [1945, 1965, 1985, 2005, 2025, 2055] as const
type Era = typeof ERAS[number]

const TRANSITION_DURATION = 1500

function App() {
  const [currentEra, setCurrentEra] = useState<Era>(1945)
  const [transitionTarget, setTransitionTarget] = useState<Era | null>(null)
  const [transitionProgress, setTransitionProgress] = useState(1)
  const isTransitioning = transitionTarget !== null
  const reducedMotion = useRef(false)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mediaQuery.matches
    
    const handleChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (transitionTarget !== null) {
      setTransitionProgress(0)
      
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1)
        setTransitionProgress(progress)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCurrentEra(transitionTarget)
          setTransitionTarget(null)
        }
      }
      requestAnimationFrame(animate)
    }
  }, [transitionTarget])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          const prevIndex = ERAS.indexOf(currentEra)
          if (prevIndex > 0 && !isTransitioning) {
            setTransitionTarget(ERAS[prevIndex - 1])
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          const nextIndex = ERAS.indexOf(currentEra)
          if (nextIndex < ERAS.length - 1 && !isTransitioning) {
            setTransitionTarget(ERAS[nextIndex + 1])
          }
          break
        case 'Home':
          e.preventDefault()
          if (!isTransitioning) setTransitionTarget(1945)
          break
        case 'End':
          e.preventDefault()
          if (!isTransitioning) setTransitionTarget(2055)
          break
        case 'r':
        case 'R':
          if ((e.ctrlKey || e.metaKey) && !isTransitioning) {
            e.preventDefault()
            setTransitionTarget(1945)
          }
          break
        case '1':
          if (!isTransitioning) setTransitionTarget(1945)
          break
        case '2':
          if (!isTransitioning) setTransitionTarget(1965)
          break
        case '3':
          if (!isTransitioning) setTransitionTarget(1985)
          break
        case '4':
          if (!isTransitioning) setTransitionTarget(2005)
          break
        case '5':
          if (!isTransitioning) setTransitionTarget(2025)
          break
        case '6':
          if (!isTransitioning) setTransitionTarget(2055)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentEra, isTransitioning])

  const handlePointerDown = () => {
    // Force a render on interaction for frameloop='demand'
    invalidate()
  }

  const handleResetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
  }, [])

  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <TimelineSlider
          eras={ERAS}
          currentEra={currentEra}
          onEraChange={setTransitionTarget}
          isTransitioning={isTransitioning}
        />
        
        <EraIndicator era={currentEra} />
        
        {/* Reset button */}
        <button
          onClick={handleResetCamera}
          aria-label="Reset camera view"
          title="Reset Camera View (R)"
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            fontSize: '1rem',
          }}
        >
          ↺ Reset View
        </button>
        
        <Canvas
          shadows
          frameloop="demand"
          dpr={[1, Math.min(2, window.devicePixelRatio || 1)]}
          performance={{ min: 0.5, max: 1 }}
          camera={{ position: [0, 30, 80], fov: 60 }}
          onPointerDown={handlePointerDown}
        >
          <color attach="background" args={['#000']} />
          
          <CityScene
            era={currentEra}
            targetEra={transitionTarget}
            transitionProgress={transitionProgress}
            reducedMotion={reducedMotion.current}
          />
          
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.1}
            minDistance={20}
            maxDistance={200}
            maxPolarAngle={Math.PI / 2 - 0.1}
            minPolarAngle={0.1}
            screenSpacePanning
          />
          
          <Preload all />
        </Canvas>
        
        <Loader 
          containerStyles={{ 
            background: 'rgba(0,0,0,0.8)',
            color: '#fff'
          }}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App