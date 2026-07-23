import React from 'react'
import { Canvas } from '@react-three/fiber'
import { CityScene, TransitionOverlay } from './components/CityScene/CityScene'
import { TimelineBar } from './components/TimelineBar/TimelineBar'
import { useEraTransition } from './components/era/useEraTransition'

export default function App() {
  const { progress, targetYear } = useEraTransition()

  return (
    <div className="appRoot">
      <Canvas
        shadows
        camera={{ position: [0, 18, 30], fov: 45, near: 0.1, far: 400 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <CityScene />
      </Canvas>

      <div className="uiTop">
        <TimelineBar />
      </div>

      <div className="uiBottom">
        <div className="hint">Drag to orbit • Scroll to zoom</div>
      </div>

      {progress < 1 && (
        <TransitionOverlay
          progress={progress}
          fromYear={targetYear === 1945 ? 1945 : targetYear - 20}
          toYear={targetYear}
        />
      )}
    </div>
  )
}
