import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Era } from '../types/era'
import * as THREE from 'three'

interface PedestrianProps {
  position: [number, number, number]
  era: Era
}

export function Pedestrian({ position, era }: PedestrianProps) {
  const groupRef = useRef<THREE.Group>(null)
  const walkSpeed = useMemo(() => Math.random() * 0.015 + 0.003, [])
  const walkDirection = useMemo(() => Math.random() * Math.PI * 2, [])

  // Clothing colors based on era
  const clothingColor = useMemo(() => {
    if (era === '1945') return ['#4A148C', '#1B5E20', '#0D47A1', '#E65100'][Math.floor(Math.random() * 4)]
    if (era === '1965') return ['#AD1457', '#283593', '#00695C', '#4E342E'][Math.floor(Math.random() * 4)]
    if (era === '1985') return ['#212121', '#424242', '#616161', '#757575'][Math.floor(Math.random() * 4)]
    if (era === '2005') return ['#1976D2', '#388E3C', '#F57C00', '#7B1FA2'][Math.floor(Math.random() * 4)]
    if (era === '2025') return ['#00ACC1', '#FFAB00', '#D81B60', '#7C4DFF'][Math.floor(Math.random() * 4)]
    return '#00E5FF' // 2055 futuristic
  }, [era])

  useFrame((state) => {
    if (groupRef.current) {
      // Walking animation
      const time = state.clock.getElapsedTime()
      groupRef.current.position.x += Math.cos(walkDirection) * walkSpeed
      groupRef.current.position.z += Math.sin(walkDirection) * walkSpeed
      
      // Gentle bobbing motion
      groupRef.current.position.y = Math.sin(time * 3) * 0.05
      groupRef.current.rotation.y = walkDirection
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#FDB89D" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.3]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.35, 1.2, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.1, 0.1, 0.5]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>
      <mesh position={[0.35, 1.2, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.1, 0.1, 0.5]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.15, 0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.6]} />
        <meshStandardMaterial color={era === '1945' || era === '1965' ? '#1565C0' : '#333'} />
      </mesh>
      <mesh position={[0.15, 0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.6]} />
        <meshStandardMaterial color={era === '1945' || era === '1965' ? '#1565C0' : '#333'} />
      </mesh>

      {/* Era-specific accessories */}
      {era === '1945' && (
        // Vintage hat
        <mesh position={[0, 1.9, 0]}>
          <cylinderGeometry args={[0.25, 0.3, 0.3]} />
          <meshStandardMaterial color="#5D4037" />
        </mesh>
      )}

      {era === '1965' && (
        // Retro glasses
        <mesh position={[0, 1.65, 0.15]}>
          <torusGeometry args={[0.12, 0.02, 8, 16]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )}

      {era === '2055' && (
        // Holographic accessory
        <mesh position={[0, 1.3, 0.2]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
    </group>
  )
}