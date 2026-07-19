import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Color } from 'three'

interface PedestrianProps {
  id: number
  style: string
  position: [number, number, number]
  transitionProgress: number
}

type PedestrianSpecs = {
  bodyColor: string
  clothingColors: [string, string, string]
  hat?: boolean
  accessory?: 'briefcase' | 'bag' | 'none'
  glowEffect?: boolean
}

const pedestrianSpecs: Record<string, PedestrianSpecs> = {
  'business-1940s': {
    bodyColor: '#4169E1',
    clothingColors: ['#8B4513', '#FFFFFF', '#000000'],
    hat: true,
    accessory: 'briefcase',
  },
  'casual-1940s': {
    bodyColor: '#FF69B4',
    clothingColors: ['#4169E1', '#FFFFFF', '#8B4513'],
    hat: false,
    accessory: 'none',
  },
  'mod-dress': {
    bodyColor: '#32CD32',
    clothingColors: ['#FFD700', '#FF69B4', '#000080'],
    hat: false,
    accessory: 'bag',
  },
  'business-1960s': {
    bodyColor: '#8B4513',
    clothingColors: ['#000000', '#FFFFFF', '#8B4513'],
    hat: false,
    accessory: 'briefcase',
  },
  'power-suit': {
    bodyColor: '#FFD700',
    clothingColors: ['#000000', '#8B4513', '#FFFFFF'],
    hat: false,
    accessory: 'none',
  },
  'casual-1980s': {
    bodyColor: '#FF69B4',
    clothingColors: ['#FF4500', '#000000', '#FFD700'],
    hat: false,
    accessory: 'none',
  },
  'business-casual': {
    bodyColor: '#4169E1',
    clothingColors: ['#8B4513', '#FFFFFF', '#000000'],
    hat: false,
    accessory: 'bag',
  },
  'jeans-tshirt': {
    bodyColor: '#FF1493',
    clothingColors: ['#000080', '#FFFFFF', '#8B4513'],
    hat: false,
    accessory: 'none',
  },
  'smart-casual': {
    bodyColor: '#32CD32',
    clothingColors: ['#4169E1', '#FFFFFF', '#000000'],
    hat: false,
    accessory: 'none',
  },
  'athleisure': {
    bodyColor: '#FF4500',
    clothingColors: ['#FFD700', '#000000', '#FFFFFF'],
    hat: false,
    accessory: 'none',
  },
  'tech-wear': {
    bodyColor: '#4169E1',
    clothingColors: ['#00FFFF', '#000000', '#FFFFFF'],
    hat: false,
    accessory: 'none',
    glowEffect: true,
  },
  'adaptive-clothing': {
    bodyColor: '#FF69B4',
    clothingColors: ['#FF1493', '#9400D3', '#FFFFFF'],
    hat: false,
    accessory: 'none',
    glowEffect: true,
  },
}

export function Pedestrian({ id, style, position }: PedestrianProps) {
  const groupRef = useRef<Group>(null!)
  const specs = pedestrianSpecs[style] || pedestrianSpecs['jeans-tshirt']

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.getElapsedTime()
      const walkRadius = 3
      const speed = 0.5 + (id % 3) * 0.2
      groupRef.current.position.x = position[0] + Math.sin(time * speed) * walkRadius
      groupRef.current.position.z = position[2] + Math.cos(time * speed * 0.7) * walkRadius
      groupRef.current.rotation.y = Math.atan2(
        Math.sin(time * speed * 0.7),
        Math.cos(time * speed)
      )
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
        <meshStandardMaterial color={specs.bodyColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={specs.clothingColors[0]} roughness={0.8} />
      </mesh>
      {specs.hat && (
        <mesh position={[0, 1.9, 0]}>
          <cylinderGeometry args={[0.35, 0.25, 0.3]} />
          <meshStandardMaterial color={specs.clothingColors[1]} />
        </mesh>
      )}
      {specs.glowEffect && (
        <pointLight
          position={[0, 1.5, 0]}
          color={specs.clothingColors[0]}
          intensity={0.5}
          distance={3}
        />
      )}
      {specs.accessory === 'briefcase' && (
        <mesh position={[0.4, 1.2, 0]}>
          <boxGeometry args={[0.3, 0.2, 0.4]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      )}
      {specs.accessory === 'bag' && (
        <mesh position={[0.3, 1.1, 0.2]}>
          <boxGeometry args={[0.2, 0.3, 0.1]} />
          <meshStandardMaterial color={specs.clothingColors[2]} />
        </mesh>
      )}
    </group>
  )
}