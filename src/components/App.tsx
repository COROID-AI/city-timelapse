import React, { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GridHelper } from 'three'
import { AmbientLight, DirectionalLight } from 'three'
import { useEraStore } from '../store/eraStore'
import { TablewareLighting } from './TablewareLighting'
import { Patrons } from './Patrons'
import { CafeShell } from './CafeShell'

export const App: React.FC = () => {
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

  // Get era data from store for ambient light color
  const eraData = useEraStore(state => state.getEraData())

  return (
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
      <AmbientLight
        intensity={0.6}
        color={eraData.ambientLightColor}
      />

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
  )
}