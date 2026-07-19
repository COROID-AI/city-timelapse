import { useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { CityScene } from './components/CityScene'
import { EraSelector } from './components/EraSelector'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorBoundary } from './components/ErrorBoundary'

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

const ERAS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

function App() {
  const [currentEra, setCurrentEra] = useState<Era>('1945')
  const [isLoading, setIsLoading] = useState(true)
  const [transitionPhase, setTransitionPhase] = useState(0)

  const handleEraChange = useCallback((era: Era) => {
    setTransitionPhase(0)
    setCurrentEra(era)
  }, [])

  return (
    <div className="w-full h-full relative">
      <ErrorBoundary>
        <Canvas
          shadows
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          camera={{ 
            position: [30, 25, 30], 
            fov: 60,
            near: 0.1,
            far: 1000
          }}
        >
          <Suspense fallback={null}>
            <CityScene currentEra={currentEra} transitionPhase={transitionPhase} />
            <EffectComposer>
              <Bloom 
                luminanceThreshold={0.2}
                luminanceSmoothing={0.9}
                height={300}
                intensity={0.5}
              />
            </EffectComposer>
            <Preload all />
          </Suspense>
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={15}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2 - 0.1}
            minPolarAngle={Math.PI / 4}
            target={[0, 0, 0]}
          />
        </Canvas>
      </ErrorBoundary>
      
      <EraSelector 
        eras={ERAS} 
        currentEra={currentEra} 
        onEraChange={handleEraChange}
      />
      
      {isLoading && <LoadingScreen />}
    </div>
  )
}

export { App }