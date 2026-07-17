import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ERA_CONFIGS, Era } from '../lib/types'
import * as THREE from 'three'

interface PedestriansProps {
  era: Era
}

export const Pedestrians: React.FC<PedestriansProps> = ({ era }) => {
  const positions = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 100,
        0.5,
        (Math.random() - 0.5) * 100,
      ] as [number, number, number],
      rotation: Math.random() * Math.PI * 2,
    }))
  }, [])

  return (
    <>
      {positions.map((p, i) => (
        <Pedestrian key={i} position={p.position} rotationY={p.rotation} era={era} />
      ))}
    </>
  )
}

interface PedestrianProps {
  position: [number, number, number]
  rotationY: number
  era: Era
}

const Pedestrian: React.FC<PedestrianProps> = ({ position, rotationY, era }) => {
  const groupRef = useRef<THREE.Group>(null!)

  const outfitColors = useMemo(() => {
    const palettes: Record<Era, string[]> = {
      '1945': ['#2F4F4F', '#8B4513', '#FFFFFF'],
      '1965': ['#FF69B4', '#FFD700', '#FFFFFF'],
      '1985': ['#00FFFF', '#FF00FF', '#000000'],
      '2005': ['#1E90FF', '#32CD32', '#FFFFFF'],
      '2025': ['#20B2AA', '#32CD32', '#FFFFFF'],
      '2055': ['#00CED1', '#FF00FF', '#FFFFFF'],
    }
    return palettes[era]
  }, [era])

  // Gentle bobbing animation
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.002 + position[0]) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={position} rotation-y={rotationY}>
      <mesh position-y={1.5}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={outfitColors[0]} />
      </mesh>
      <mesh position-y={0.8}>
        <boxGeometry args={[1, 1.2, 0.5]} />
        <meshStandardMaterial color={outfitColors[1]} />
      </mesh>
      <mesh position-x={-0.4} position-y={0.8}>
        <boxGeometry args={[0.2, 1.2, 0.4]} />
        <meshStandardMaterial color={outfitColors[2]} />
      </mesh>
      <mesh position-x={0.4} position-y={0.8}>
        <boxGeometry args={[0.2, 1.2, 0.4]} />
        <meshStandardMaterial color={outfitColors[2]} />
      </mesh>
    </group>
  )
}