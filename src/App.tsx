import React from 'react'
import { Canvas } from '@react-three/fiber'
import { CityScene } from './components/CityScene/CityScene'
import { TimelineBar } from './components/TimelineBar/TimelineBar'

export default function App() {
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
    </div>
  )
}
