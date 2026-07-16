import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTransition, a } from '@react-spring/three'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import * as THREE from 'three'

interface SkyTransitionProps {
  era: Era
  prefersReducedMotion: boolean
}

export const SkyTransition: React.FC<SkyTransitionProps> = ({ era, prefersReducedMotion }) => {
  const meshRef = useRef<THREE.Mesh>(null!)

  const skyColors = {
    1945: '#87CEEB',
    1965: '#90CAF9',
    1985: '#4FC3F7',
    2005: '#29B6F6',
    2025: '#26C6DA',
    2055: '#4DD0E1',
  }

  const { color } = useTransition(() => ({
    color: skyColors[era as keyof typeof skyColors],
    from: { color: '#87CEEB' },
    config: { duration: 2500 },
  }))

  useFrame(() => {
    if (meshRef.current) {
      // Animate clouds for non-futuristic eras
      if (era < 2055) {
        meshRef.current.rotation.z += 0.0001
      }
    }
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, 30, 0]} scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 32]} />
        <a.meshBasicMaterial color={color} side={THREE.BackSide} />
      </mesh>

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </mesh>
    </>
  )
}