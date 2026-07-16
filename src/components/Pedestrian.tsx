import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Era, ERA_CONFIGS } from '../stores/types'

interface PedestrianProps {
  position: [number, number, number]
  currentEra: Era
}

export function Pedestrian({ position, currentEra }: PedestrianProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const config = ERA_CONFIGS[currentEra]

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle walking animation
      const time = state.clock.elapsedTime
      groupRef.current.position.y = 0.5 + Math.sin(time * 3) * 0.05
    }
  })

  const getPedestrianColors = (style: string) => {
    switch (style) {
      case 'vintage':
        return { skin: '#DEB887', clothing: '#8B4513', accent: '#4A90E2' }
      case 'mod':
        return { skin: '#F5DEB3', clothing: '#FF69B4', accent: '#00FF00' }
      case '80s':
        return { skin: '#D2B48C', clothing: '#FF0000', accent: '#FFFF00' }
      case 'early_2000s':
        return { skin: '#E6C2A8', clothing: '#0000FF', accent: '#FFFFFF' }
      case 'modern':
        return { skin: '#FAD9C1', clothing: '#2F4F4F', accent: '#87CEEB' }
      case 'futuristic':
        return { skin: '#FFE4E1', clothing: '#000000', accent: '#00FFFF' }
      default:
        return { skin: '#DEB887', clothing: '#8B4513', accent: '#4A90E2' }
    }
  }

  const colors = useMemo(() => getPedestrianColors(config.pedestrianStyle.clothingStyle), [config])

  const getPropGeometry = (prop: string) => {
    switch (prop) {
      case 'newspaper':
        return (
          <mesh position={[0.5, 1.3, 0.3]}>
            <planeGeometry args={[0.3, 0.4]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        )
      case 'umbrella':
        return (
          <group position={[0, 0.8, 0]}>
            <mesh>
              <coneGeometry args={[0.5, 0.8, 16, 1, true]} />
              <meshStandardMaterial color="#FF0000" opacity={0.5} transparent />
            </mesh>
            <mesh position={[0, -0.4, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
          </group>
        )
      case 'boombox':
        return (
          <mesh position={[0.3, 1.1, 0.2]}>
            <boxGeometry args={[0.3, 0.2, 0.2]} />
            <meshStandardMaterial color="#000000" metalness={0.8} />
          </mesh>
        )
      case 'phone':
        return (
          <mesh position={[0.4, 1.1, 0.1]}>
            <boxGeometry args={[0.15, 0.25, 0.05]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        )
      case 'smartphone':
        return (
          <mesh position={[0.4, 1.1, 0.1]}>
            <boxGeometry args={[0.12, 0.2, 0.03]} />
            <meshStandardMaterial color="#1a1a1a" emissive="#00FFFF" emissiveIntensity={0.3} />
          </mesh>
        )
      case 'holographic_device':
        return (
          <mesh position={[0.5, 1.2, 0]}>
            <torusGeometry args={[0.2, 0.02, 16, 32]} />
            <meshStandardMaterial 
              color="#00FFFF" 
              emissive="#00FFFF" 
              emissiveIntensity={0.8}
              transparent
              opacity={0.7}
            />
          </mesh>
        )
      default:
        return null
    }
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={colors.skin} />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.3]} />
        <meshStandardMaterial color={colors.clothing} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.35, 1.1, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5]} />
        <meshStandardMaterial color={colors.clothing} />
      </mesh>
      <mesh position={[0.35, 1.1, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5]} />
        <meshStandardMaterial color={colors.clothing} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.15, 0.6, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.15, 0.6, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.5]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Era-specific prop */}
      {getPropGeometry(config.pedestrianStyle.prop)}
    </group>
  )
}