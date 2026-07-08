/**
 * CityBlock - Main 3D scene component
 * Contains buildings, vehicles, pedestrians, storefronts
 */

import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraId } from '../eras'
import { getEraSpec } from '../eras'
import { BuildingRow } from './BuildingRow'
import { Street } from './Street'
import { VehicleManager } from './VehicleManager'
import { PedestrianManager } from './PedestrianManager'

export function CityBlock({ era }: { era: EraId }) {
  const spec = useMemo(() => getEraSpec(era), [era])

  // Color palettes per era
  const getEraColors = (eraId: EraId) => {
    switch (eraId) {
      case '1945':
        return {
          building: '#8B4513',
          window: '#FFA500',
          road: '#2F4F4F',
          sidewalk: '#8B4513',
          signage: '#8B0000',
        }
      case '1965':
        return {
          building: '#4169E1',
          window: '#87CEEB',
          road: '#2F4F4F',
          sidewalk: '#C0C0C0',
          signage: '#FFFFFF',
        }
      case '1985':
        return {
          building: '#FF1493',
          window: '#00FFFF',
          road: '#1C1C1C',
          sidewalk: '#4B0082',
          signage: '#FF00FF',
        }
      case '2005':
        return {
          building: '#00CED1',
          window: '#FFFFFF',
          road: '#363636',
          sidewalk: '#708090',
          signage: '#00BFFF',
        }
      case '2025':
        return {
          building: '#32CD32',
          window: '#90EE90',
          road: '#2F4F4F',
          sidewalk: '#556B2F',
          signage: '#3CB371',
        }
      case '2055':
        return {
          building: '#9370DB',
          window: '#DDA0DD',
          road: '#4B0082',
          sidewalk: '#9932CC',
          signage: '#8A2BE2',
        }
    }
  }

  const colors = useMemo(() => getEraColors(era), [era])

  // Animate subtle changes
  useFrame((_state, delta) => {
    // Any per-frame updates for the whole scene
  })

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* City block - centered at origin */}
      <group position={[0, 0, 0]}>
        {/* Four building rows forming a block */}
        <BuildingRow
          era={era}
          position={[-15, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          colors={colors}
        />
        <BuildingRow
          era={era}
          position={[15, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          colors={colors}
        />
        <BuildingRow
          era={era}
          position={[0, 0, -15]}
          rotation={[0, Math.PI, 0]}
          colors={colors}
        />
        <BuildingRow
          era={era}
          position={[0, 0, 15]}
          rotation={[0, 0, 0]}
          colors={colors}
        />

        {/* Street surface */}
        <Street era={era} colors={colors} />

        {/* Vehicles on streets */}
        <VehicleManager era={era} colors={colors} />

        {/* Pedestrians on sidewalks */}
        <PedestrianManager era={era} colors={colors} />
      </group>

      {/* Atmospheric fog */}
      <fog attach="fog" args={['#000000', 30, 80]} />
    </group>
  )
}