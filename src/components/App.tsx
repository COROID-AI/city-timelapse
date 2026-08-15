import React, { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GridHelper } from 'three'
import { TablewareLighting } from './TablewareLighting'
import { Patrons } from './Patrons'
import { CafeShell } from './CafeShell'
import { SfxMixer } from '../audio/mixer'
import { useEraTransition } from '../systems/TransitionManager'
import { useEraStore } from '../store/eraStore'
import { TimelineSlider } from './TimelineSlider'
import { Stats } from '@react-three/drei'

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
          maxPolarAngle={(5 * Math.PI) / 6} // Prevents camera from going below the floor/ground
          enablePan={false}
          screenSpacePanning={false}
        />

        {/* Grid helper for spatial grounding */}
        <GridHelper size={10} color="0x444444" divideCount={10} opacity={0.5} />

        {/* Era-specific fog + lighting temperature + ambient color */}
        <AtmosphereSystem />

        {/* Café interior shell - permanent architectural container */}
        <CafeShell />

        {/* Era-specific tableware and lighting fixtures */}
        <TablewareLighting />

        {/* Era-specific patron figures with LOD */}
        <Patrons />

        {/* Timeline slider for era selection */}
        <TimelineSlider />

        {/* Performance monitoring overlay - FPS counter */}
        <Stats position="top-left" fps={true} ms={false} memory={true} />
      </Canvas>
    </>
  )
}