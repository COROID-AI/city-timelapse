import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Era } from '../types/era'
import { ERA_CONFIGS } from '../types/era'
import * as THREE from 'three'

interface VehicleProps {
  position: [number, number, number]
  rotation: [number, number, number]
  era: Era
}

export function Vehicle({ position, rotation, era }: VehicleProps) {
  const meshRef = useRef<THREE.Group>(null)
  const speed = useMemo(() => Math.random() * 0.02 + 0.005, [])
  const direction = useMemo(() => Math.random() > 0.5 ? 1 : -1, [])

  const config = ERA_CONFIGS[era]
  const vehicleColor = config.vehicleStyle.colors[Math.floor(Math.random() * config.vehicleStyle.colors.length)]

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x += Math.sin(rotation[1]) * speed * direction
      meshRef.current.position.z += Math.cos(rotation[1]) * speed * direction
    }
  })

  // Vehicle geometry based on era
  const renderVehicle = () => {
    switch (era) {
      case '1945':
        return (
          <>
            {/* Vintage car body */}
            <mesh castShadow>
              <boxGeometry args={[2, 0.5, 4]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.6} />
            </mesh>
            {/* Hood */}
            <mesh position={[0, 0.3, -0.5]}>
              <boxGeometry args={[1.8, 0.3, 1]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.6} />
            </mesh>
            {/* Wheels */}
            {[-0.8, 0.8].map((x, i) =>
              [-1.2, 1.2].map((z) => (
                <mesh key={`wheel-${i}-${z}`} position={[x, -0.25, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
              ))
            )}
          </>
        )
      case '1965':
        return (
          <>
            {/* Muscle car */}
            <mesh castShadow>
              <boxGeometry args={[2.2, 0.6, 4.5]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.5} />
            </mesh>
            {/* Grill */}
            <mesh position={[0, 0, -2.35]}>
              <boxGeometry args={[1, 0.2, 0.1]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            {/* Wheels */}
            {[-0.9, 0.9].map((x, i) =>
              [-1.5, 1.5].map((z) => (
                <mesh key={`wheel-${i}-${z}`} position={[x, -0.35, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
                  <meshStandardMaterial color="#222" metalness={0.7} />
                </mesh>
              ))
            )}
          </>
        )
      case '1985':
        return (
          <>
            {/* Boxy sedan */}
            <mesh castShadow>
              <boxGeometry args={[1.8, 0.7, 4]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.7} />
            </mesh>
            {/* Wheels */}
            {[-0.7, 0.7].map((x, i) =>
              [-1.3, 1.3].map((z) => (
                <mesh key={`wheel-${i}-${z}`} position={[x, -0.4, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.32, 0.32, 0.35, 12]} />
                  <meshStandardMaterial color="#444" />
                </mesh>
              ))
            )}
          </>
        )
      case '2005':
        return (
          <>
            {/* Modern SUV/Crossover */}
            <mesh castShadow>
              <boxGeometry args={[2, 0.9, 4.2]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Windows */}
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[1.7, 0.6, 3.8]} />
              <meshStandardMaterial color="#888" transparent opacity={0.6} />
            </mesh>
            {/* Wheels */}
            {[-0.8, 0.8].map((x, i) =>
              [-1.4, 1.4].map((z) => (
                <mesh key={`wheel-${i}-${z}`} position={[x, -0.5, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
                  <meshStandardMaterial color="#333" metalness={0.5} />
                </mesh>
              ))
            )}
          </>
        )
      case '2025':
        return (
          <>
            {/* Electric vehicle */}
            <mesh castShadow>
              <boxGeometry args={[1.9, 0.8, 4]} />
              <meshStandardMaterial color={vehicleColor} roughness={0.3} metalness={0.6} />
            </mesh>
            {/* Charging port */}
            <mesh position={[0.6, 0.1, -2]}>
              <circleGeometry args={[0.15, 16]} />
              <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={0.5} />
            </mesh>
            {/* Wheels */}
            {[-0.75, 0.75].map((x, i) =>
              [-1.35, 1.35].map((z) => (
                <mesh key={`wheel-${i}-${z}`} position={[x, -0.45, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.34, 0.34, 0.25, 16]} />
                  <meshStandardMaterial color="#222" metalness={0.8} />
                </mesh>
              ))
            )}
          </>
        )
      case '2055':
        return (
          <>
            {/* Autonomous pod */}
            <mesh castShadow>
              <capsuleGeometry args={[0.8, 2.5, 8, 16]} />
              <meshStandardMaterial
                color={vehicleColor}
                roughness={0.1}
                metalness={0.9}
                emissive={vehicleColor}
                emissiveIntensity={0.2}
              />
            </mesh>
            {/* Underglow lights */}
            <mesh position={[0, -0.6, 0]}>
              <boxGeometry args={[1.5, 0.1, 3]} />
              <meshStandardMaterial
                color="#00E5FF"
                emissive="#00E5FF"
                emissiveIntensity={0.4}
              />
            </mesh>
          </>
        )
      default:
        return <mesh><boxGeometry args={[2, 0.5, 4]} /></mesh>
    }
  }

  return (
    <group ref={meshRef} position={position} rotation={rotation}>
      {renderVehicle()}
    </group>
  )
}