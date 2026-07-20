import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { Era } from '../App'

interface VehiclesProps {
  era: Era
}

export const Vehicles: React.FC<VehiclesProps> = ({ era }) => {
  const vehicles = useMemo(() => {
    const items: JSX.Element[] = []
    const vehicleCount = era === 2055 ? 3 : 4

    for (let i = 0; i < vehicleCount; i++) {
      const z = -30 + i * 15 + (Math.random() - 0.5) * 5
      const x = (Math.random() - 0.5) * 10

      items.push(
        <Vehicle
          key={i}
          position={[x, 0, z]}
          era={era}
          type={i % 2 === 0 ? 'car' : era === 2055 ? 'flying' : 'truck'}
        />
      )
    }

    return items
  }, [era])

  return (
    <group>
      {vehicles}
    </group>
  )
}

interface VehicleProps {
  position: [number, number, number]
  era: Era
  type: 'car' | 'truck' | 'flying'
}

const Vehicle: React.FC<VehicleProps> = ({ position, era, type }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (groupRef.current) {
      if (type === 'flying') {
        groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.5
        groupRef.current.rotation.y += delta * 0.5
      } else {
        groupRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.05
      }
    }
  })

  const vehicleStyles = useMemo(() => {
    if (type === 'flying') {
      const flyingStyles: Record<Era, { body: string; secondary: string; size: [number, number, number]; wing: boolean; glow?: boolean }> = {
        1945: { body: '#ff0000', secondary: '#ffffff', size: [6, 2, 3], wing: false },
        1965: { body: '#00ff00', secondary: '#ffffff', size: [5, 2, 2.5], wing: false },
        2005: { body: '#0099ff', secondary: '#ffffff', size: [4, 1.5, 2], wing: true },
        2025: { body: '#ff00ff', secondary: '#aaaaff', size: [3.5, 1.5, 2], wing: true },
        2055: { body: '#00ffff', secondary: '#ffffff', size: [4, 1, 1.5], wing: true, glow: true },
      }
      return flyingStyles[era]
    }

    const groundStyles: Record<Era, { body: string; secondary: string; size: [number, number, number] }> = {
      1945: { body: '#8b4513', secondary: '#cd853f', size: [6, 2, 3] },
      1965: { body: '#4169e1', secondary: '#ffffff', size: [7, 2, 4] },
      1985: { body: '#ff6b6b', secondary: '#ffffff', size: [6.5, 2, 3.5] },
      2005: { body: '#2f4f4f', secondary: '#ffffff', size: [6, 1.5, 3] },
      2025: { body: '#555555', secondary: '#ffffff', size: [5.5, 1.5, 2.5] },
      2055: { body: '#0a0a2a', secondary: '#00ffff', size: [4, 1, 2] },
    }
    return groundStyles[era]
  }, [era, type])

  if (type === 'flying') {
    const flyingStyle = vehicleStyles as { body: string; secondary: string; size: [number, number, number]; wing: boolean; glow?: boolean }
    return (
      <group ref={groupRef} position={position}>
        <mesh castShadow>
          <boxGeometry args={flyingStyle.size} />
          <meshStandardMaterial
            color={flyingStyle.body}
            emissive={flyingStyle.glow ? flyingStyle.secondary : '#000000'}
            emissiveIntensity={flyingStyle.glow ? 0.8 : 0}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {flyingStyle.wing && (
          <>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[flyingStyle.size[0] + 2, 0.1, flyingStyle.size[2] - 1]} />
              <meshStandardMaterial
                color={flyingStyle.secondary}
                emissive={flyingStyle.glow ? flyingStyle.secondary : '#000000'}
                emissiveIntensity={flyingStyle.glow ? 0.5 : 0}
              />
            </mesh>
            <mesh position={[0, -0.3, -0.8]}>
              <boxGeometry args={[flyingStyle.size[0] - 1, 0.1, 0.5]} />
              <meshStandardMaterial color={flyingStyle.secondary} transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, -0.3, 0.8]}>
              <boxGeometry args={[flyingStyle.size[0] - 1, 0.1, 0.5]} />
              <meshStandardMaterial color={flyingStyle.secondary} transparent opacity={0.7} />
            </mesh>
          </>
        )}

        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={era === 2055 ? 0.8 : 0.3}
          />
        </mesh>
      </group>
    )
  }

  const groundStyle = vehicleStyles as { body: string; secondary: string; size: [number, number, number] }
  const topSize = type === 'truck'
    ? [groundStyle.size[0] - 1, 0.8, groundStyle.size[2] - 0.5] as [number, number, number]
    : [2.5, 0.8, 2] as [number, number, number]

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={groundStyle.size} />
        <meshStandardMaterial color={groundStyle.body} metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[type === 'truck' ? 0 : 0.5, 0.8, 0]}>
        <boxGeometry args={topSize} />
        <meshStandardMaterial color={groundStyle.secondary} transparent opacity={0.8} />
      </mesh>

      {[-1, 1].map((x, i) =>
        [-1, 1].map((z) => (
          <mesh key={`${i}-${z}`} position={[x * (type === 'truck' ? 1.5 : 1), -0.5, z * (type === 'truck' ? 1 : 1.2)]}>
            <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        ))
      )}
    </group>
  )
}