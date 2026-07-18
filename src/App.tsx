import React, { useState, useRef, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Preload } from '@react-three/drei'
import { CityScene } from './components/CityScene'
import { LoadingScreen } from './components/LoadingScreen'
import { Era, EraStyles, getEraStyles, interpolateStyles } from './lib/eraStyles'
import './styles.css'

const eras: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

function App() {
  const [currentEra, setCurrentEra] = useState<Era>('2025')
  const [transitionStyles, setTransitionStyles] = useState<EraStyles | null>(null)
  const previousEraRef = useRef<Era>('2025')
  const transitionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Handle era change with transition
  const handleEraChange = useCallback((newEra: Era) => {
    if (newEra === currentEra) return
    
    const prevStyles = getEraStyles(previousEraRef.current)
    const newStyles = getEraStyles(newEra)
    previousEraRef.current = currentEra
    
    let progress = 0
    const step = 0.04
    
    transitionIntervalRef.current = setInterval(() => {
      progress += step
      setTransitionStyles(interpolateStyles(prevStyles, newStyles, progress))
      
      if (progress >= 1) {
        setCurrentEra(newEra)
        setTransitionStyles(null)
        if (transitionIntervalRef.current) {
          clearInterval(transitionIntervalRef.current)
        }
      }
    }, 40)
  }, [currentEra])

  // Get styles to use (either from transition or current era)
  const stylesToUse = transitionStyles || getEraStyles(currentEra)

  return (
    <>
      <div className="timeline-container" role="toolbar" aria-label="Era Timeline">
        <span className="timeline-label">Era:</span>
        <div className="timeline-slider">
          {eras.map((era) => (
            <button
              key={era}
              className={`era-button ${currentEra === era ? 'active' : ''}`}
              onClick={() => handleEraChange(era)}
              aria-label={`Switch to ${era} era`}
            >
              {era}
            </button>
          ))}
        </div>
        <span className="year-display" aria-live="polite">{currentEra}</span>
      </div>

      <div className="info-panel" aria-hidden="true">
        <h3>City Block Timelapse</h3>
        <ul>
          <li>Drag to orbit around scene</li>
          <li>Scroll to zoom in/out</li>
          <li>Select era to transform the city</li>
        </ul>
      </div>

      <Canvas
        frameloop="demand"
        camera={{ position: [0, 30, 60], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<LoadingScreen />}>
          <Environment preset="city" background={false} />
          <ambientLight intensity={stylesToUse.lighting.ambient} />
          <directionalLight
            position={[50, 100, 50]}
            intensity={stylesToUse.lighting.directional}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-50, 50, -50]} intensity={stylesToUse.lighting.ambient * 0.8} />
          
          <CityScene era={currentEra} interpolatedStyles={stylesToUse} transitionProgress={transitionStyles ? 0.5 : 1} />
          
          <Preload all />
        </Suspense>
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={120}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0, 0]}
        />
      </Canvas>
    </>
  )
}

export default App