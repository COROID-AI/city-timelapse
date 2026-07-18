import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { lerpHex } from '../utils/color'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface VehiclesProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Vehicles({ eraA, eraB, blendT }: VehiclesProps) {
  const vehicleConfigs = useMemo(
    () => [
      { position: [-35, 0, -5] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
      { position: [-10, 0, -5] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
      { position: [15, 0, -5] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
      { position: [-30, 0, 5] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
      { position: [25, 0, 5] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    ],
    []
  )

  return (
    <group>
      {vehicleConfigs.map((config, index) => (
        <Vehicle
          key={index}
          position={config.position}
          rotation={config.rotation}
          eraA={eraA}
          eraB={eraB}
          blendT={blendT}
          type={index % 3}
        />
      ))}
    </group>
  )
}

interface VehicleProps {
  position: [number, number, number]
  rotation: [number, number, number]
  eraA: Era
  eraB: Era
  blendT: number
  type: number
}

function Vehicle({ position, rotation, eraA, eraB, blendT, type }: VehicleProps) {
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x += Math.sin(state.clock.elapsedTime * 0.5 + type) * 0.004
    }
  })

  const opacityA = 1 - blendT
  const opacityB = blendT

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <VehicleVariant era={eraA} type={type} opacity={opacityA} />
      <VehicleVariant era={eraB} type={type} opacity={opacityB} />
    </group>
  )
}

function vehicleColor(era: Era, type: number) {
  const colors: Record<Era, string[]> = {
    '1945': ['#8B0000', '#2F4F4F', '#8B4513', '#4682B4'],
    '1965': ['#FF69B4', '#00CED1', '#FFD700', '#32CD32'],
    '1985': ['#FF4500', '#1E90FF', '#DC143C', '#00FF7F'],
    '2005': ['#000000', '#FFFFFF', '#FF0000', '#006400'],
    '2025': ['#4682B4', '#32CD32', '#FF6347', '#9370DB'],
    '2055': ['#00FFFF', '#4169E1', '#9932CC', '#00FF7F'],
  }
  return colors[era][type % 4]
}

function VehicleVariant({ era, type, opacity }: { era: Era; type: number; opacity: number }) {
  const color = useMemo(() => vehicleColor(era, type), [era, type])
  const isClassic = era === '1945' || era === '1965'
  const isFuture = era === '2055'

  if (isClassic) {
    return (
      <group opacity={opacity}>
        <mesh castShadow>
          <boxGeometry args={[6, 2, 3]} />
          <meshStandardMaterial args={[color, 0.3, 0.7]} transparent />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[5, 1.5, 2.5]} />
          <meshStandardMaterial args={[color, 0.3, 0.7]} transparent />
        </mesh>
        <mesh position={[2, -0.2, 1.2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.5, 16]} />
          <meshStandardMaterial color="#333" transparent opacity={0.9} />
        </mesh>
      </group>
    )
  }

  if (isFuture) {
    return (
      <group opacity={opacity}>
        <mesh castShadow>
          <capsuleGeometry args={[1.5, 4, 8, 16]} />
          <meshStandardMaterial args={[color, 0.8, 0.2]} emissive={color} emissiveIntensity={0.35} transparent />
        </mesh>
        <mesh position={[2, 0.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial args={['#00FFFF', 0, 0, 0.8]} emissive="#00FFFF" emissiveIntensity={0.8} transparent opacity={0.9} />
        </mesh>
        <mesh position={[-2, 0.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial args={['#00FFFF', 0, 0, 0.8]} emissive="#00FFFF" emissiveIntensity={0.8} transparent opacity={0.9} />
        </mesh>
      </group>
    )
  }

  // Modern / Contemporary / 1985 / 2005 / 2025
  return (
    <group opacity={opacity}>
      <mesh castShadow>
        <boxGeometry args={[5, 1, 2.5]} />
        <meshStandardMaterial args={[color, 0.6, 0.4]} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[4.5, 0.8, 2]} />
        <meshStandardMaterial args={[color, 0.6, 0.4, 0.7]} transparent opacity={0.8} />
      </mesh>
      <mesh position={[1.5, -0.2, 1]}>
        <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
        <meshStandardMaterial color="#222" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}
