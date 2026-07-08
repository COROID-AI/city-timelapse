/**
 * VehicleManager - Spawns era-appropriate vehicles on streets
 */

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraId } from '../eras'
import { getEraSpec } from '../eras'

interface VehicleManagerProps {
  era: EraId
  colors: {
    building: string
    window: string
    road: string
    sidewalk: string
    signage: string
  }
}

export function VehicleManager({ era, colors }: VehicleManagerProps) {
  const vehicleCount = 6

  const vehicles = useMemo(() => {
    return Array.from({ length: vehicleCount }).map((_, i) => ({
      id: `vehicle-${i}`,
      position: [
        -12 + (i % 3) * 12,
        0,
        -12 + Math.floor(i / 3) * 24,
      ] as [number, number, number],
      rotation: [0, (Math.floor(i / 3) * Math.PI) / 2, 0] as [number, number, number],
      speed: 0.02 + Math.random() * 0.03,
      type: i % 4, // 0=vintage sedan, 1=truck, 2=bus, 3=sports
    }))
  }, [])

  return (
    <group>
      {vehicles.map((vehicle) => (
        <EraVehicle
          key={vehicle.id}
          {...vehicle}
          era={era}
          colors={colors}
        />
      ))}
    </group>
  )
}

interface EraVehicleProps {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  speed: number
  type: number
  era: EraId
  colors: any
}

function EraVehicle({ position, rotation, speed, type, era, colors }: EraVehicleProps) {
  const ref = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      const time = clock.getElapsedTime() * speed
      ref.current.position.y = Math.abs(Math.sin(time)) * 0.05
    }
  })

  const getVehicleGeometry = () => {
    const hue = era === '2055' ? Math.random() : 0.3 + (parseInt(era) / 2055) * 0.4

    switch (era) {
      case '1945':
        return (
          <group>
            {/* Vintage car body */}
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[2, 0.4, 1]} />
              <meshStandardMaterial color={new THREE.Color().setHSL(0.1, 0.5, 0.4)} metalness={0.4} roughness={0.6} />
            </mesh>
            {/* Car front */}
            <mesh position={[0.7, 0.1, 0]} castShadow>
              <boxGeometry args={[0.8, 0.2, 0.8]} />
              <meshStandardMaterial color={new THREE.Color().setHSL(0.1, 0.5, 0.3)} metalness={0.3} roughness={0.7} />
            </mesh>
            {/* Wheels */}
            {[-0.5, 0.5].map((x, i) => (
              <mesh key={i} position={[x, 0, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.3, 12]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            ))}
          </group>
        )

      case '1965':
        return (
          <group>
            {/* Classic car - longer, sleeker */}
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[2.5, 0.4, 1]} />
              <meshStandardMaterial color="#4169E1" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Chrome details */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[2, 0.1, 0.6]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Wheels */}
            {[-0.7, 0.7].map((x, i) => (
              <mesh key={i} position={[x, 0, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.4, 16]} />
                <meshStandardMaterial color="#333333" />
              </mesh>
            ))}
          </group>
        )

      case '1985':
        return (
          <group>
            {/* Boxy 80s car */}
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[2, 0.5, 1.2]} />
              <meshStandardMaterial
                color={new THREE.Color().setHSL(hue, 0.8, 0.5)}
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
            {/* Pop-up headlights */}
            {[-0.3, 0.3].map((z, i) => (
              <mesh key={i} position={[0.5, 0.3, z]} castShadow>
                <boxGeometry args={[0.2, 0.1, 0.1]} />
                <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.5} />
              </mesh>
            ))}
            {/* Wheels */}
            {[-0.5, 0.5].map((x, i) => (
              <mesh key={i} position={[x, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.4, 12]} />
                <meshStandardMaterial color="#FF00FF" />
              </mesh>
            ))}
          </group>
        )

      case '2005':
        return (
          <group>
            {/* Modern SUV */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[2.2, 0.6, 1.3]} />
              <meshStandardMaterial
                color={new THREE.Color().setHSL(hue, 0.3, 0.3)}
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
            {/* Tinted windows */}
            <mesh position={[0, 0.7, 0.1]}>
              <boxGeometry args={[2, 0.3, 1.1]} />
              <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
            </mesh>
            {/* Wheels */}
            {[-0.6, 0.6].map((x, i) => (
              <mesh key={i} position={[x, 0, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
                <meshStandardMaterial color="#2F4F4F" />
              </mesh>
            ))}
          </group>
        )

      case '2025':
        return (
          <group>
            {/* Electric car - smooth, aerodynamic */}
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[2, 0.4, 1]} />
              <meshStandardMaterial
                color="#32CD32"
                metalness={0.6}
                roughness={0.2}
                emissive="#32CD32"
                emissiveIntensity={0.1}
              />
            </mesh>
            {/* Charging port */}
            <mesh position={[0.8, 0.3, 0]}>
              <boxGeometry args={[0.1, 0.1, 0.2]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
            </mesh>
            {/* Wheels - covered for aerodynamics */}
            {[-0.45, 0.45].map((x, i) => (
              <mesh key={i} position={[x, 0.1, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.2, 12]} />
                <meshStandardMaterial color="#FFFFFF" />
              </mesh>
            ))}
          </group>
        )

      case '2055':
        return (
          <group>
            {/* Autonomous pod - curved, organic */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <capsuleGeometry args={[0.8, 1.8, 8, 16]} />
              <meshStandardMaterial
                color="#9370DB"
                metalness={0.8}
                roughness={0.1}
                emissive="#9370DB"
                emissiveIntensity={0.3}
              />
            </mesh>
            {/* Holo-display */}
            <mesh position={[0, 0.8, 0]}>
              <circleGeometry args={[0.3, 16]} />
              <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={0.5}
                transparent
                opacity={0.7}
              />
            </mesh>
            {/* Anti-grav emitters */}
            {[-0.5, 0.5].map((x, i) => (
              <mesh key={i} position={[x, -0.1, 0]}>
                <sphereGeometry args={[0.15, 12, 12]} />
                <meshStandardMaterial color="#DDA0DD" emissive="#DDA0DD" emissiveIntensity={0.8} />
              </mesh>
            ))}
          </group>
        )
    }
  }

  return (
    <group ref={ref} position={position} rotation={rotation}>
      {getVehicleGeometry()}
    </group>
  )
}