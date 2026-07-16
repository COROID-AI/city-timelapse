import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Era, ERA_CONFIGS } from '../stores/types'

interface StorefrontProps {
  position: [number, number, number]
  currentEra: Era
  targetEra: Era
  transitionProgress: number
  isTransitioning: boolean
}

export function Storefront({ position, currentEra, targetEra, transitionProgress, isTransitioning }: StorefrontProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const signRef = useRef<THREE.Mesh>(null!)
  const config = ERA_CONFIGS[currentEra]

  useFrame((state) => {
    if (signRef.current && config.storefrontStyle.signage === 'holographic_3d') {
      // Holographic animation
      signRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2
      signRef.current.material.emissiveIntensity = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3
    }
  })

  const getSignageGeometry = () => {
    switch (config.storefrontStyle.signage) {
      case 'hand_painted':
        return (
          <mesh ref={signRef} position={[0, 2, 5.1]}>
            <planeGeometry args={[4, 1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        )
      case 'neon':
        return (
          <group position={[0, 2, 5.1]}>
            <mesh>
              <planeGeometry args={[4, 1]} />
              <meshStandardMaterial color="#000000" opacity={0.5} transparent />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <textGeometry args={['GENERAL STORE', { font: undefined, size: 0.3, height: 0.05 }]}>
                <meshStandardMaterial color="#FF69B4" emissive="#FF69B4" emissiveIntensity={0.5} />
              </textGeometry>
            </mesh>
          </group>
        )
      case 'modern_neon':
        return (
          <group position={[0, 2, 5.1]}>
            <mesh>
              <roundedBoxGeometry args={[4, 1, 0.1, 4, 0.1]} />
              <meshStandardMaterial color="#000000" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <planeGeometry args={[3.5, 0.8]} />
              <meshStandardMaterial 
                color="#00FF00" 
                emissive="#00FF00" 
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        )
      case 'led':
        return (
          <group position={[0, 2, 5.1]}>
            <mesh>
              <planeGeometry args={[4, 1]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[3.5, 0.8]} />
              <meshBasicMaterial color="#00FFFF" toneMapped={false} />
            </mesh>
          </group>
        )
      case 'holographic':
        return (
          <mesh ref={signRef} position={[0, 2, 5.1]}>
            <planeGeometry args={[4, 1]} />
            <meshStandardMaterial 
              color="#00FFFF" 
              emissive="#00FFFF" 
              emissiveIntensity={0.7}
              opacity={0.8}
              transparent
            />
          </mesh>
        )
      case 'holographic_3d':
        return (
          <group ref={signRef} position={[0, 2, 5.1]}>
            <mesh>
              <cylinderGeometry args={[2, 2, 0.1, 32]} />
              <meshStandardMaterial 
                color="#FF00FF" 
                emissive="#FF00FF" 
                emissiveIntensity={1}
                opacity={0.7}
                transparent
              />
            </mesh>
            <mesh position={[0, 0, 0.1]}>
              <torusGeometry args={[1.5, 0.1, 16, 32]} />
              <meshStandardMaterial 
                color="#00FFFF" 
                emissive="#00FFFF" 
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        )
      default:
        return <mesh position={[0, 2, 5.1]}><planeGeometry args={[4, 1]} /><meshStandardMaterial color="#8B4513" /></mesh>
    }
  }

  const getDisplayWindow = () => {
    switch (config.storefrontStyle.products) {
      case 'general_store':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color="#A0522D" />
            </mesh>
          </group>
        )
      case 'department_store':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshStandardMaterial color="#FF69B4" opacity={0.7} transparent />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshStandardMaterial color="#4169E1" opacity={0.7} transparent />
            </mesh>
          </group>
        )
      case 'electronics':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#00FFFF" opacity={0.5} transparent />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#FF00FF" opacity={0.5} transparent />
            </mesh>
          </group>
        )
      case 'tech_gadgets':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#00FF7F" opacity={0.6} transparent />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#1E90FF" opacity={0.6} transparent />
            </mesh>
          </group>
        )
      case 'eco_friendly':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#32CD32" opacity={0.5} transparent />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#228B22" opacity={0.5} transparent />
            </mesh>
          </group>
        )
      case 'anti_gravity':
        return (
          <group>
            <mesh position={[-1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#FFFFFF" opacity={0.3} transparent />
            </mesh>
            <mesh position={[1, 1, 5.1]}>
              <planeGeometry args={[1, 1.5]} />
              <meshBasicMaterial color="#E0FFFF" opacity={0.3} transparent />
            </mesh>
            <mesh position={[0, 1, 5.2]}>
              <torusGeometry args={[2, 0.05]} />
              <meshBasicMaterial color="#00FFFF" opacity={0.5} />
            </mesh>
          </group>
        )
      default:
        return null
    }
  }

  const getAdvertisement = () => {
    switch (config.storefrontStyle.advertisement) {
      case 'wartime_posters':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#FF0000" />
          </mesh>
        )
      case 'retro_futuristic':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#FFA500" />
          </mesh>
        )
      case 'vibrant_80s':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#FFFF00" />
          </mesh>
        )
      case 'digital_age':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#00BFFF" />
          </mesh>
        )
      case 'sustainable':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#32CD32" />
          </mesh>
        )
      case 'space_age':
        return (
          <mesh position={[0, 0.5, 5.11]}>
            <planeGeometry args={[3, 0.5]} />
            <meshBasicMaterial color="#9400D3" />
          </mesh>
        )
      default:
        return null
    }
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Main building front */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[6, 4, 0.5]} />
        <meshStandardMaterial color={config.buildingStyle.facadeColor} />
      </mesh>

      {/* Signage */}
      {getSignageGeometry()}

      {/* Display window */}
      {getDisplayWindow()}

      {/* Advertisement */}
      {getAdvertisement()}

      {/* Door */}
      <mesh position={[0, 0.5, 0.26]}>
        <planeGeometry args={[1, 2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  )
}