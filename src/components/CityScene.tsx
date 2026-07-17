import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Building } from './Building'
import { Vehicles } from './Vehicles'
import { Storefronts } from './Storefronts'
import { Pedestrians } from './Pedestrians'
import { Ground } from './Ground'
import { Street } from './Street'
import { Sky } from './Sky'
import { PostProcessing } from './PostProcessing'
import { useEraStore } from '../stores/eraStore'
import { ERA_CONFIGS } from '../lib/types'
import * as THREE from 'three'

export const CityScene: React.FC = () => {
  const { currentEra, isTransitioning } = useEraStore()
  const groupRef = useRef<THREE.Group>(null!)

  // Generate city grid positions
  const buildingPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    const gridSize = 8
    const spacing = 12
    for (let x = -gridSize; x <= gridSize; x += spacing) {
      for (let z = -gridSize; z <= gridSize; z += spacing) {
        positions.push([x, 0, z])
      }
    }
    return positions
  }, [])

  // Smooth transition animation
  useFrame(() => {
    if (groupRef.current && isTransitioning) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        groupRef.current.rotation.y + 0.01,
        0.1
      )
    }
  })

  return (
    <>
      <PerspectiveCamera makeDefault fov={60} position={[0, 20, 50]} />
      <OrbitControls
        maxPolarAngle={Math.PI * 0.45}
        minPolarAngle={Math.PI * 0.1}
        minDistance={15}
        maxDistance={80}
        enablePan={false}
      />

      <Sky era={currentEra} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-20, 10, -20]} intensity={0.3} />
      <pointLight position={[20, 10, 20]} intensity={0.3} />

      <group ref={groupRef}>
        <Ground era={currentEra} />
        <Street era={currentEra} />

        {buildingPositions.map((pos, i) => (
          <Building key={i} position={pos} era={currentEra} />
        ))}

        <Storefronts era={currentEra} />
        <Vehicles era={currentEra} />
        <Pedestrians era={currentEra} />
      </group>

      <PostProcessing era={currentEra} />
    </>
  )
}