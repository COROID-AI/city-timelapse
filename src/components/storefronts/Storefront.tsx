import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

interface StorefrontProps {
  id: number
  type: string
  position: [number, number, number]
  rotation: [number, number, number]
  transitionProgress: number
}

type StorefrontSpecs = {
  signColor: string
  signText: string
  hasNeon?: boolean
  hasHologram?: boolean
  glowIntensity?: number
}

const storefrontSpecs: Record<string, StorefrontSpecs> = {
  'general-store': {
    signColor: '#8B4513',
    signText: 'GENERAL STORE',
    glowIntensity: 0,
  },
  'pharmacy': {
    signColor: '#4169E1',
    signText: 'DRUG STORE',
    glowIntensity: 0,
  },
  'department-store': {
    signColor: '#FFD700',
    signText: 'DEPARTMENTS',
    glowIntensity: 0,
  },
  'diner': {
    signColor: '#FF69B4',
    signText: 'DINER',
    hasNeon: true,
  },
  'electronics-store': {
    signColor: '#00FFFF',
    signText: 'ELECTRONICS',
    hasNeon: true,
  },
  'fashion-boutique': {
    signColor: '#FF1493',
    signText: 'FASHION',
    hasNeon: true,
  },
  'tech-store': {
    signColor: '#1E90FF',
    signText: 'TECH',
    hasNeon: true,
  },
  'coffee-shop': {
    signColor: '#8B4513',
    signText: 'COFFEE',
    hasNeon: true,
  },
  'smart-retail': {
    signColor: '#32CD32',
    signText: 'SMART STORE',
    hasNeon: true,
    glowIntensity: 0.3,
  },
  'delivery-hub': {
    signColor: '#FF4500',
    signText: 'AUTONOMOUS DELIVERY',
    hasHologram: true,
  },
  'holo-store': {
    signColor: '#9400D3',
    signText: 'HOLO SHOP',
    hasHologram: true,
    glowIntensity: 0.5,
  },
  'nutri-bar': {
    signColor: '#FFD700',
    signText: 'NUTRI BAR',
    hasHologram: true,
    glowIntensity: 0.4,
  },
}

export function Storefront({ id, type, position, rotation }: StorefrontProps) {
  const groupRef = useRef<Group>(null!)
  const specs = storefrontSpecs[type] || storefrontSpecs['general-store']

  useFrame((state) => {
    if (groupRef.current && specs.hasNeon) {
      const time = state.clock.getElapsedTime()
      const intensity = Math.sin(time * 2) * 0.3 + 0.7
      groupRef.current.traverse((child) => {
        if ((child as any).material?.emissive) {
          ;(child as any).material.emissiveIntensity = intensity
        }
      })
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh position={[0, 2, 0.1]} castShadow>
        <boxGeometry args={[4, 4, 0.5]} />
        <meshStandardMaterial 
          color="#333333" 
          roughness={0.6}
          emissive={specs.hasNeon || specs.hasHologram ? specs.signColor : '#000000'}
          emissiveIntensity={specs.glowIntensity || (specs.hasNeon ? 0.4 : 0)}
        />
      </mesh>
      <mesh position={[0, 2.5, 0.35]}>
        <boxGeometry args={[3, 1, 0.1]} />
        <meshBasicMaterial 
          color={specs.signColor}
          transparent={specs.hasHologram}
          opacity={specs.hasHologram ? 0.8 : 1}
        />
      </mesh>
      {specs.hasHologram && (
        <pointLight
          position={[0, 2.5, 1]}
          color={specs.signColor}
          intensity={0.5}
          distance={5}
        />
      )}
      <mesh position={[0, -0.5, 1.5]}>
        <boxGeometry args={[2, 2, 0.2]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
      </mesh>
    </group>
  )
}