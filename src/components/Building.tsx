import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ERA_CONFIGS, Era } from '../lib/types'
import * as THREE from 'three'

interface BuildingProps {
  position: [number, number, number]
  era: Era
}

export const Building: React.FC<BuildingProps> = ({ position, era }) => {
  const groupRef = useRef<THREE.Group>(null!)

  const { height, style, color } = useMemo(() => {
    const h = Math.random() * 15 + 10
    const config = ERA_CONFIGS.find(c => c.era === era)!
    return {
      height: h,
      style: config.buildingStyle,
      color: config.colorPalette.primary,
    }
  }, [era])

  // Smooth transition animation
  useFrame(() => {
    if (groupRef.current) {
      const targetScale = style === 'futuristic' ? 1.02 : 1
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(
        groupRef.current.scale.x,
        targetScale,
        0.02
      ))
    }
  })

  const getMaterial = () => {
    switch (style) {
      case 'brick':
        return <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
      case 'modernist':
        return <meshStandardMaterial color={color} roughness={0.7} metalness={0.3} />
      case 'glass_steel':
        return <meshStandardMaterial color={color} roughness={0.1} metalness={0.9} transparent opacity={0.8} />
      case 'mixed_use':
        return <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
      case 'sustainable':
        return <meshStandardMaterial color={color} roughness={0.5} metalness={0.5} emissive={color} emissiveIntensity={0.2} />
      case 'futuristic':
        return <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} emissive={color} emissiveIntensity={0.5} />
      default:
        return <meshStandardMaterial color={color} />
    }
  }

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow receiveShadow position-y={height / 2}>
        <boxGeometry args={[8, height, 8]} />
        {getMaterial()}
      </mesh>
    </group>
  )
}