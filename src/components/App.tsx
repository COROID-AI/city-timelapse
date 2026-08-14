import React, { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GridHelper, AmbientLight, DirectionalLight } from 'three'
import { TablewareLighting } from './TablewareLighting'
import { Patrons } from './Patrons'
import { CafeShell } from './CafeShell'
import { SfxMixer } from '../audio/mixer'
import { useEraTransition } from '../systems/TransitionManager'
import { useEraStore } from '../store/eraStore'
import { TimelineSlider } from './TimelineSlider'

export const App: React.FC = () => {
  const [muted, setMuted] = useState<boolean>(SfxMixer.isMuted())

  const currentEra = useEraStore(s => s.currentEra)
  const currentEraRef = useRef(currentEra)

  useEffect(() => {
    currentEraRef.current = currentEra
  }, [currentEra])

  // Consume TransitionManager so visual transitions animate
  // over the same ~1.5s window as audio crossfade.
  const { ambientLightColor } = useEraTransition()

  useEffect(() => {
    // Document body overflow hidden to prevent scrollbars
    document.body.style.overflow = 'hidden'
    document.body.style.margin = '0'
    document.body.style.padding = '0'

    return () => {
      document.body.style.overflow = ''
      document.body.style.margin = ''
      document.body.style.padding = ''
    }
  }, [])

  // Unlock audio context on first user gesture (autoplay policy)
  useEffect(() => {
    let didUnlock = false

    const onFirstGesture = async () => {
      if (didUnlock) return
      didUnlock = true

      // Idempotent: safe to call multiple times.
      const startedFromPending = await SfxMixer.unlock()

      // If no era was queued before unlock, start current era now.
      if (!startedFromPending) {
        SfxMixer.setEra(currentEraRef.current, 1500)
      }

      document.removeEventListener('pointerdown', onFirstGesture, true)
    }

    document.addEventListener('pointerdown', onFirstGesture, { capture: true })

    return () => {
      document.removeEventListener('pointerdown', onFirstGesture, true)
    }
  }, [])

  // Keep UI in sync with mute state
  useEffect(() => {
    return SfxMixer.subscribeMute(setMuted)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => SfxMixer.toggleMuted()}
        aria-label="Audio"
        aria-pressed={muted}
        data-testid="audio-toggle"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 2000,
          pointerEvents: 'auto',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(20,20,20,0.65)',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {muted ? 'Audio 🔇 Muted' : 'Audio 🔊 On'}
      </button>

      <Canvas
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {/* OrbitControls with constrained navigation */}
        <OrbitControls
          enableDamping={true}
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={15}
          minPolarAngle={Math.PI / 6} // Prevents camera from clipping through floor
          maxPolarAngle={5 * Math.PI / 6} // Prevents camera from going below the floor/ground
          enablePan={false}
          screenSpacePanning={false}
        />

        {/* Grid helper for spatial grounding */}
        <GridHelper
          size={10}
          color="0x444444"
          divideCount={10}
          opacity={0.5}
        />

        {/* Ambient light for basic scene illumination - color shifts with era */}
        <AmbientLight intensity={0.6} color={ambientLightColor} />

        {/* Directional light to simulate sunlight/overhead lighting */}
        <DirectionalLight
          intensity={0.8}
          color="0xffffff"
          position={[10, 10, 10]}
        />

        {/* Café interior shell - permanent architectural container */}
        <CafeShell />

        {/* Era-specific tableware and lighting fixtures */}
        <TablewareLighting />

        {/* Era-specific patron figures */}
        <Patrons />
      </Canvas>

      {/* Era selection overlay */}
      <TimelineSlider />
    </>
  )
}
