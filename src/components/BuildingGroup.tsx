import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTransition, a } from '@react-spring/three'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import * as THREE from 'three'

interface BuildingProps {
  position: [number, number, number]
  height: number
  era: Era
  prefersReducedMotion: boolean
}

const Building: React.FC<BuildingProps> = ({ position, height, era, prefersReducedMotion }) => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const config = eraConfigs[era]

  const { scale } = useTransition(() => ({
    scale: prefersReducedMotion ? [1, 1, 1] : [1, height / 3, 1],
    from: { scale: prefersReducedMotion ? [1, 1, 1] : [1, 1, 1] },
    config: { duration: 2500, tension: 120, friction: 20 },
  }))

  const material = useMemo(() => {
    const color = new THREE.Color(config.buildingMaterial)
    return new THREE.MeshStandardMaterial({
      color,
      roughness: era === 2055 ? 0.1 : 0.7,
      metalness: era === 2055 ? 0.9 : 0.3,
      emissive: era === 2055 ? color.clone().multiplyScalar(0.2) : 0x000000,
    })
  }, [config.buildingMaterial, era])

  return (
    <a.group position={position} scale={scale}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[2, 1, 2]} />
        <primitive object={material} attach="material" />
      </mesh>
    </a.group>
  )
}

interface BuildingGroupProps {
  era: Era
  prefersReducedMotion: boolean
}

export const BuildingGroup: React.FC<BuildingGroupProps> = ({ era, prefersReducedMotion }) => {
  const config = eraConfigs[era]

  const buildings = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let x = -8; x <= 8; x += 4) {
      for (let z = -8; z <= 8; z += 4) {
        positions.push([x, 0, z])
      }
    }
    return positions
  }, [])

  return (
    <group>
      {buildings.map((pos, i) => (
        <Building
          key={`${era}-${i}`}
          position={pos}
          height={config.buildingHeight}
          era={era}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </group>
  )
}