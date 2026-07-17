import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ERA_CONFIGS, Era } from '../lib/types'
import * as THREE from 'three'

interface VehiclesProps {
  era: Era
}

export const Vehicles: React.FC<VehiclesProps> = ({ era }) => {
  const vehicleCount = 12
  const vehiclePositions = useMemo(() => {
    return Array.from({ length: vehicleCount }, (_, i) => ({
      position: [
        (i % 6 - 2.5) * 15,
        0.5,
        (Math.floor(i / 6) - 1) * 30,
      ] as [number, number, number],
      rotation: [0, (i % 2) ? Math.PI : 0, 0] as [number, number, number],
    }))
  }, [])

  return (
    <>
      {vehiclePositions.map((vp, i) => (
        <Vehicle key={i} position={vp.position} rotation={vp.rotation} era={era} />
      ))}
    </>
  )
}

interface VehicleProps {
  position: [number, number, number]
  rotation: [number, number, number]
  era: Era
}

const Vehicle: React.FC<VehicleProps> = ({ position, rotation, era }) => {
  const vehicleRef = useRef<THREE.Group>(null!)

  const vehicleColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#8B4513',
      '1965': '#FF4500',
      '1985': '#4169E1',
      '2005': '#2F4F4F',
      '2025': '#32CD32',
      '2055': '#00CED1',
    }
    return colors[era]
  }, [era])

  const vehicleParams = useMemo(() => {
    switch (era) {
      case '1945':
        return { bodyWidth: 2, bodyHeight: 0.5, bodyDepth: 4, wheelRadius: 0.3, wheelHeight: 0.4 }
      case '1965':
        return { bodyWidth: 2.2, bodyHeight: 0.6, bodyDepth: 4.5, wheelRadius: 0.4, wheelHeight: 0.5 }
      case '1985':
        return { bodyWidth: 2, bodyHeight: 0.8, bodyDepth: 4, wheelRadius: 0.35, wheelHeight: 0.4 }
      case '2005':
        return { bodyWidth: 2.4, bodyHeight: 1, bodyDepth: 4.8, wheelRadius: 0.5, wheelHeight: 0.6 }
      case '2025':
        return { bodyWidth: 2.2, bodyHeight: 0.9, bodyDepth: 4.6, wheelRadius: 0.4, wheelHeight: 0.5 }
      case '2055':
        return { bodyWidth: 2, bodyHeight: 0.5, bodyDepth: 4, wheelRadius: 0, wheelHeight: 0 }
      default:
        return { bodyWidth: 2, bodyHeight: 0.5, bodyDepth: 4, wheelRadius: 0.3, wheelHeight: 0.4 }
    }
  }, [era])

  const wheelPositions = [-1.2, -0.4, 0.4, 1.2]

  useFrame(() => {
    if (vehicleRef.current) {
      vehicleRef.current.rotation.y = THREE.MathUtils.lerp(
        vehicleRef.current.rotation.y,
        rotation[1],
        0.1
      )
    }
  })

  return (
    <group ref={vehicleRef} position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position-y={0.25}>
        <boxGeometry args={[vehicleParams.bodyWidth, vehicleParams.bodyHeight, vehicleParams.bodyDepth]} />
        <meshStandardMaterial color={vehicleColor} metalness={0.6} roughness={0.3} />
      </mesh>
      {vehicleParams.wheelRadius > 0 && wheelPositions.map((x, i) => (
        <mesh key={i} position={[x, 0.2, vehicleParams.bodyDepth / 2 - 0.2]} castShadow>
          <cylinderGeometry args={[vehicleParams.wheelRadius, vehicleParams.wheelRadius, vehicleParams.wheelHeight, 16]} />
          <meshStandardMaterial color="#111" metalness={0.8} />
        </mesh>
      ))}
      {vehicleParams.wheelRadius > 0 && wheelPositions.map((x, i) => (
        <mesh key={i + 4} position={[x, 0.2, -vehicleParams.bodyDepth / 2 + 0.2]} castShadow>
          <cylinderGeometry args={[vehicleParams.wheelRadius, vehicleParams.wheelRadius, vehicleParams.wheelHeight, 16]} />
          <meshStandardMaterial color="#111" metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}