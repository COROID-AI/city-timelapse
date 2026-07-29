import React from 'react'
import * as THREE from 'three'
import type { EraPalette } from '../eras'

interface StreetLightsProps {
  positions: Array<[number, number]>
  palette: EraPalette
}

export function StreetLights({ positions, palette }: StreetLightsProps) {
  return (
    <group>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Pole */}
          <mesh position={[0, 4.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 9, 6]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.5} metalness={0.7} />
          </mesh>
          {/* Lamp head */}
          <mesh position={[0, 9.2, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial
              color={palette.lampColor}
              emissive={palette.lampColor}
              emissiveIntensity={palette.lampIntensity}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
          {/* Light cone */}
          <spotLight
            position={[0, 9, 0]}
            intensity={palette.lampIntensity}
            color={palette.lampColor}
            angle={0.35}
            penumbra={0.6}
            distance={25}
            decay={2}
          />
        </group>
      ))}
    </group>
  )
}