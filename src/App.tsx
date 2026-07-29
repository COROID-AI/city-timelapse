import React, { Suspense, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Html } from '@react-three/drei'
import { useAppStore } from './state'
import { CityScene } from './scenes/CityScene'
import { Atmosphere } from './scenes/atmosphere'
import { Timeline } from './scenes/Timeline'
import { ERA_REGISTRY } from './eras'
import { createAmbientSound, setMuted } from './audio/mixer'
import './app.css'

export default function App() {
  const { reducedMotion, setEraIndex, eraId, audioMuted, setAudioMuted, showLabels } = useAppStore()

  const handleAudioToggle = useCallback(() => {
    const newMuted = !audioMuted
    setAudioMuted(newMuted)
    if (!newMuted) {
      try { createAmbientSound(eraId) } catch (_) { /* no-op */ }
    } else {
      setMuted(true)
    }
  }, [audioMuted, eraId, setAudioMuted])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setAudioMuted(mq.matches)
    const handler = (_e: MediaQueryListEvent) => { /* no-op for now */ }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setAudioMuted])

  return (
    <div className="app-root">
      <Canvas
        shadows
        camera={{ position: [0, 18, 35], fov: 50, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = 3
          gl.toneMappingExposure = 1.1
          gl.shadowMap.enabled = true
          gl.shadowMap.type = 2
        }}
        frameloop="demand"
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#0a0a1a']} />
          <fog attach="fog" args={['#0a0a1a', 80, 250]} />
          <ambientLight intensity={0.3} />
          <hemisphereLight args={['#4466aa', '#332211', 0.4]} />
          <directionalLight
            position={[30, 40, 20]}
            intensity={1.8}
            color="#ffffff"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={1}
            shadow-camera-far={120}
            shadow-camera-left={-60}
            shadow-camera-right={60}
            shadow-camera-top={60}
            shadow-camera-bottom={-60}
            shadow-bias={-0.0005}
          />
          <spotLight
            position={[10, 25, 10]}
            intensity={0.5}
            color="#aaccff"
            angle={0.4}
            penumbra={0.5}
            castShadow
          />

          <CityScene />

          <Atmosphere />

          <Environment preset="city" />

          <OrbitControls
            target={[0, 8, 0]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={12}
            maxDistance={90}
            enableDamping
            dampingFactor={0.06}
            minZoom={0.3}
            maxZoom={5}
            rotateSpeed={0.6}
            panSpeed={0.4}
          />

          {showLabels && <Html distanceFactor={60}><EraLabel /></Html>}
        </Suspense>
      </Canvas>

      <div className="ui-overlay">
        <Timeline />
        <header className="ui-header">
          <h1>City Era Timelapse</h1>
          <p>1945 — 2055</p>
        </header>
        <div className="ui-controls">
          <button className="ctrl-btn" onClick={handleAudioToggle} title="Toggle sound">
            {audioMuted ? '🔇' : '🔊'}
          </button>
          <button className="ctrl-btn" onClick={() => useAppStore.getState().setShowLabels(!showLabels)} title="Toggle labels">
            {showLabels ? '🏷️' : '🔇'}
          </button>
          <span className="era-label">{eraId}</span>
        </div>
      </div>

      <div className="loading-screen" id="loading">
        <div className="loading-content">
          <h2>Loading City Timeline</h2>
          <div className="loading-bar"><div className="loading-fill" /></div>
        </div>
      </div>
    </div>
  )
}

function EraLabel() {
  const eraId = useAppStore((s) => s.eraId)
  const spec = ERA_REGISTRY.find((e) => e.id === eraId)
  return (
    <div style={{ color: '#fff', textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '2px', textShadow: '0 0 20px rgba(0,0,0,0.8)' }}>{spec?.label}</div>
      <div style={{ fontSize: '14px', opacity: 0.7, textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{spec?.description}</div>
    </div>
  )
}