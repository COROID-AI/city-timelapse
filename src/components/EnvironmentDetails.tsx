import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Era, ERA_CONFIGS } from '../stores/types'

interface EnvironmentDetailsProps {
  currentEra: Era
}

export function EnvironmentDetails({ currentEra }: EnvironmentDetailsProps) {
  const config = ERA_CONFIGS[currentEra]

  const getStreetLight = (): JSX.Element => {
    if (currentEra === '1945') {
      return (
        <group>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 3]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, 3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 1.5]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, 2.5, 0.7]}>
            <sphereGeometry args={[0.3]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )
    } else if (currentEra === '2055') {
      return (
        <group>
          <mesh position={[0, 6, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 6]} />
            <meshStandardMaterial color="#FFFFFF" metalness={0.9} emissive="#00FFFF" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 6, 0]}>
            <torusGeometry args={[2, 0.05, 16, 32]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.8} />
          </mesh>
          <pointLight position={[0, 6, 0]} color="#00FFFF" intensity={0.5} distance={10} />
        </group>
      )
    } else {
      return (
        <group>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 4]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0, 3.5, 0.7]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2]} />
            <meshStandardMaterial color="#333" emissive="#FFFF00" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )
    }
  }

  return (
    <group>
      {/* Street lights */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={`light-${i}`} position={[-20 + i * 8, 0, 12]}>
          {getStreetLight()}
        </group>
      ))}

      {/* Trees */}
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={`tree-${i}`} position={[-25 + (i % 4) * 15, 0, -25 + Math.floor(i / 4) * 25]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 2]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <coneGeometry args={[1, 2, 8]} />
            <meshStandardMaterial color="#228B22" />
          </mesh>
        </group>
      ))}

      {/* Benches */}
      {Array.from({ length: 4 }).map((_, i) => (
        <group key={`bench-${i}`} position={[-15 + i * 12, 0, 11]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2, 0.1, 0.5]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[-0.8, 0.25, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0.8, 0.25, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        </group>
      ))}

      {/* Sky with dynamic color */}
      <color attach="background" args={[config.environmentLighting.color]} />
    </group>
  )
}