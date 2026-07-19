import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, Group } from 'three'
import { Era } from '../../contexts/EraContext'

interface VehicleProps {
  id: number
  type: string
  position: [number, number, number]
  speed: number
  transitionProgress: number
}

type VehicleSpecs = {
  color: string
  bodyShape: 'sedan' | 'suv' | 'truck' | 'pod' | 'hover' | 'flying'
  hasAntenna?: boolean
  hoverHeight?: number
  emissive?: boolean
}

const vehicleSpecs: Record<string, VehicleSpecs> = {
  'sedan-classic': { color: '#8B0000', bodyShape: 'sedan' },
  'truck-vintage': { color: '#D2691E', bodyShape: 'truck' },
  'sedan-muscle': { color: '#FF4500', bodyShape: 'sedan' },
  'bus-retro': { color: '#FF8C00', bodyShape: 'truck' },
  'sedan-boxy': { color: '#4169E1', bodyShape: 'sedan' },
  'suv': { color: '#228B22', bodyShape: 'suv' },
  'sedan-modern': { color: '#FF69B4', bodyShape: 'sedan', hasAntenna: true },
  'suv-luxury': { color: '#000000', bodyShape: 'suv', emissive: true },
  'hybrid': { color: '#32CD32', bodyShape: 'sedan', hasAntenna: true },
  'electric-sedan': { color: '#1E90FF', bodyShape: 'sedan', hasAntenna: true },
  'autonomous-pod': { color: '#00FFFF', bodyShape: 'pod', emissive: true },
  'flying-car': { color: '#9400D3', bodyShape: 'flying', hoverHeight: 2 },
  'hover-vehicle': { color: '#FF1493', bodyShape: 'hover', hoverHeight: 1 },
}

export function Vehicle({ type, position, speed }: VehicleProps) {
  const groupRef = useRef<Group>(null!)
  const specs = vehicleSpecs[type]

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.getElapsedTime()
      const offset = Math.sin(time * 0.5 + position[0] * 0.1) * 0.1
      groupRef.current.position.x = position[0] + Math.sin(time * speed) * 6
      groupRef.current.position.z = position[2] + Math.cos(time * speed * 0.7) * 4
      if (specs.hoverHeight) {
        groupRef.current.position.y = position[1] + Math.sin(time * speed) * 0.2 + specs.hoverHeight
      }
    }
  })

  const renderVehicle = () => {
    switch (specs.bodyShape) {
      case 'sedan':
        return (
          <>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[2, 0.6, 4]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.3}
                metalness={0.7}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.3 : 0}
              />
            </mesh>
            <mesh position={[0, 0.8, -0.5]} castShadow>
              <boxGeometry args={[1.8, 0.5, 2]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.3}
                metalness={0.7}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.3 : 0}
              />
            </mesh>
            {specs.hasAntenna && (
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.5]} />
                <meshStandardMaterial color="#333333" />
              </mesh>
            )}
          </>
        )
      case 'suv':
        return (
          <>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[2.2, 0.8, 4.2]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.3}
                metalness={0.7}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.3 : 0}
              />
            </mesh>
            <mesh position={[0, 0.9, -0.2]} castShadow>
              <boxGeometry args={[2, 0.6, 1.8]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.3}
                metalness={0.7}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.3 : 0}
              />
            </mesh>
          </>
        )
      case 'truck':
        return (
          <>
            <mesh position={[0, 0.8, 0.5]} castShadow>
              <boxGeometry args={[2, 0.6, 3]} />
              <meshStandardMaterial color={specs.color} roughness={0.4} />
            </mesh>
            <mesh position={[0, 1.4, -1.2]} castShadow>
              <boxGeometry args={[1.8, 0.8, 2]} />
              <meshStandardMaterial color={specs.color} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.2, -1.8]} castShadow>
              <boxGeometry args={[2.2, 0.6, 1]} />
              <meshStandardMaterial color="#555555" roughness={0.5} />
            </mesh>
          </>
        )
      case 'pod':
        return (
          <>
            <mesh position={[0, 0.4, 0]} castShadow>
              <capsuleGeometry args={[0.8, 2, 8, 16]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.1}
                metalness={0.9}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.5 : 0}
              />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial 
                color="#FFFFFF" 
                emissive="#FFFFFF"
                emissiveIntensity={0.8}
                transparent
                opacity={0.7}
              />
            </mesh>
          </>
        )
      case 'hover':
        return (
          <>
            <mesh position={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[1, 1.5, 0.3]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.2}
                metalness={0.8}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.4 : 0}
              />
            </mesh>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[1.2, 0.4, 2]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
          </>
        )
      case 'flying':
        return (
          <>
            <mesh position={[0, 0, 0]} castShadow>
              <coneGeometry args={[0.8, 1.5, 8]} />
              <meshStandardMaterial 
                color={specs.color} 
                roughness={0.1}
                metalness={0.9}
                emissive={specs.emissive ? specs.color : '#000000'}
                emissiveIntensity={specs.emissive ? 0.5 : 0}
              />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <ringGeometry args={[0.3, 0.8, 12]} />
              <meshBasicMaterial 
                color="#00FFFF" 
                transparent 
                opacity={0.6}
                side={2}
              />
            </mesh>
          </>
        )
    }
  }

  return (
    <group ref={groupRef} position={position}>
      {renderVehicle()}
    </group>
  )
}