import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { SFXController } from './components/SFXController'
import { TransitionInvalidator } from './components/TransitionInvalidator'
import { useEraTransition } from './hooks/useEraTransition'
import { useEraStore } from './store/eraStore'
import { eraConfig } from './utils/eraConfig'

function FakeAsyncAssets({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 650)
    return () => window.clearTimeout(t)
  }, [])
  if (!ready) return null
  return <>{children}</>
}

function AppInner() {
  const { isTransitioning, reducedMotion, effectiveIndex, setTargetEraIndex } = useEraTransition()
  const { toIndex } = useEraStore()
  const [canvasKey, setCanvasKey] = useState(0)

  return (
    <div className="appRoot">
      <TimelineSlider
        eras={eraConfig.eras}
        selectedIndex={toIndex}
        onSelect={(idx) => {
          setTargetEraIndex(idx)
        }}
      />

      <SFXController effectiveIndex={effectiveIndex} isTransitioning={isTransitioning} reducedMotion={reducedMotion} />

      <ErrorBoundary
        onReset={() => {
          setCanvasKey((k) => k + 1)
        }}
      >
        <Canvas
          key={canvasKey}
          frameloop="demand"
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 8, 18], fov: 45, near: 0.1, far: 250 }}
          onCreated={({ gl }) => {
            const el = gl.domElement
            const onLost = (e: Event) => {
              e.preventDefault()
              setTimeout(() => {
                throw new Error('WebGL context lost')
              }, 0)
            }
            el.addEventListener('webglcontextlost', onLost)
          }}
        >
          <Suspense fallback={<LoadingScreen />}>
            <FakeAsyncAssets>
              <TransitionInvalidator />
              <CityScene />
            </FakeAsyncAssets>
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      <button
        className="resetBtn"
        onClick={() => setTargetEraIndex(0)}
        type="button"
        aria-label="Reset to 1945"
      >
        Reset to 1945
      </button>

      <div className="srOnly" aria-live="polite">
        {`Era transition: ${eraConfig.eras[Math.round(effectiveIndex)]?.year ?? ''}`}
      </div>
    </div>
  )
}

export default function App() {
  useMemo(() => null, [])
  return <AppInner />
}
