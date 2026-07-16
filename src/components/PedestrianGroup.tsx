import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTransition, a } from '@react-spring/three'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import * as THREE from 'three'

interface PedestrianProps {
  position: [number, number, number]
  era: Era
  prefersReducedMotion: boolean
}

const Pedestrian: React.FC<PedestrianProps> = ({ position, era, prefersReducedMotion }) => {
  const groupRef = useRef<THREE.Group>(null!)

  // Era-appropriate clothing colors
  const clothingColor = useMemo(() => {
    const colors = {
      1945: '#4A2C2A',
      1965: '#FF6B6B',
      1985: '#2C3E50',
      2005: '#3498DB',
      2025: '#27AE60',
      2055: '#9B59B6',
    }
    return colors[era as keyof typeof colors]
  }, [era])

  useFrame((state) => {
    if (!prefersReducedMotion && groupRef.current) {
      // Walking animation
      const time = state.clock.elapsedTime
      groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#FDBCB4" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.35, 1.4, 0]}>
        <boxGeometry args={[0.1, 0.5, 0.1]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>
      <mesh position={[0.35, 1.4, 0]}>
        <boxGeometry args={[0.1, 0.5, 0.1]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.15, 1.1, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.15, 1.1, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  )
}

interface PedestrianGroupProps {
  era: Era
  prefersReducedMotion: boolean
}

export const PedestrianGroup: React.FC<PedestrianGroupProps> = ({ era, prefersReducedMotion }) => {
  const pedestrians = useMemo(() => {
    const positions: [number, number, number][] = []
    // Add pedestrians on sidewalks
    for (let i = 0; i < 8; i++) {
      positions.push([
        -7 + (i * 2),
        0,
        -5 + (i % 2) * 2,
      ])
    }
    return positions
  }, [])

  return (
    <group>
      {pedestrians.map((pos, i) => (
        <Pedestrian
          key={`${era}-pedestrian-${i}`}
          position={pos}
          era={era}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </group>
  )
}