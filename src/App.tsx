import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from '@react-three/postprocessing'
import { CityScene } from './components/CityScene'
import { TimelineSlider } from './components/TimelineSlider'
import { EraProvider } from './contexts/EraContext'
import { AudioProvider } from './contexts/AudioContext'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'

function AppContent() {
  useEffect(() => {
    const handleResize = () => {
      // Responsive handling if needed
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <TimelineSlider />
      <Canvas
        shadows
        camera={{ position: [0, 50, 100], fov: 60 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true
        }}
        onCreated={({ gl }) => {
          gl.setClearColor('#87ceeb')
        }}
      >
        <Suspense fallback={null}>
          <Environment preset="sunset" background blur={0.5} />
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2.2}
            minPolarAngle={Math.PI / 6}
            maxDistance={300}
            minDistance={50}
          />
          <CityScene />
          <Preload all />
        </Suspense>
        <EffectComposer multisampling={0}>
          <SMAA />
          <Bloom 
            intensity={0.5} 
            luminanceThreshold={0.2} 
            luminanceSmoothing={0.9} 
            height={300}
          />
          <ChromaticAberration 
            offset={new THREE.Vector2(0.001, 0.001)} 
            radialMod={0.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

function App() {
  return (
    <EraProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </EraProvider>
  )
}

export default App