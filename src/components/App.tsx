import React, { ReactElement, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useResize } from '@react-three/drei'
import { GridHelper } from 'three'

import { CafeShell } from './CafeShell'
import { TablewareLighting } from './TablewareLighting'
import { AtmosphereSystem } from '../systems/AtmosphereSystem'

export const App: React.FC = (): ReactElement => {
  // Resize hook from drei - handles canvas responsiveness
  const { size } = useResize()

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

  return (
    <Canvas
      style={{
        width: '100%',
        height: '100%',
      }}
      resize={size}
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
    </Canvas>
  )
}
