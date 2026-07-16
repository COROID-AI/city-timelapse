import React from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { UIProvider } from './context/UIContext'
import './styles.css'

// Get reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UIProvider prefersReducedMotion={prefersReducedMotion}>
      <div className="app-container">
        <TimelineSlider />
        <Canvas
          camera={{ position: [0, 2, 10], fov: 60 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
        >
          <CityScene />
        </Canvas>
        <Loader />
      </div>
    </UIProvider>
  </React.StrictMode>
)