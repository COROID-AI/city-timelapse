import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { Era } from '../App'

interface SkyProps {
  era: Era
}

export const Sky: React.FC<SkyProps> = ({ era }) => {
  const skyParams = useMemo(() => {
    return {
      1945: {
        color: '#87ceeb',
        sunColor: '#ffd700',
        sunIntensity: 1.5,
        turbidity: 2,
        rayleigh: 1,
      },
      1965: {
        color: '#6fb3d2',
        sunColor: '#ffeb3b',
        sunIntensity: 1.8,
        turbidity: 3,
        rayleigh: 2,
      },
      1985: {
        color: '#000080',
        sunColor: '#ff6b6b',
        sunIntensity: 0.8,
        turbidity: 8,
        rayleigh: 4,
      },
      2005: {
        color: '#4682b4',
        sunColor: '#ffffff',
        sunIntensity: 1.2,
        turbidity: 4,
        rayleigh: 2,
      },
      2025: {
        color: '#87cefa',
        sunColor: '#ffffff',
        sunIntensity: 1.5,
        turbidity: 3,
        rayleigh: 1.5,
      },
      2055: {
        color: '#000030',
        sunColor: '#00ffff',
        sunIntensity: 0.5,
        turbidity: 10,
        rayleigh: 6,
      },
    }[era]
  }, [era])

  return (
    <group>
      {/* Sky sphere */}
      <mesh>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial
          color={skyParams.color}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Sun/Moon */}
      {era === 2055 ? (
        // Futuristic glowing orb
        <mesh position={[100, 150, -100]}>
          <sphereGeometry args={[15, 32, 32]} />
          <meshBasicMaterial
            color={skyParams.sunColor}
            transparent
            opacity={0.8}
          />
        </mesh>
      ) : (
        // Regular sun
        <directionalLight
          position={[100, 150, -100]}
          intensity={skyParams.sunIntensity * 0.5}
          color={skyParams.sunColor}
        />
      )}
    </group>
  )
}