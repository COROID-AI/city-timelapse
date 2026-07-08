/**
 * PedestrianManager - Spawns era-appropriate pedestrians on sidewalks
 */

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraId } from '../eras'

interface PedestrianManagerProps {
  era: EraId
  colors: {
    building: string
    window: string
    road: string
    sidewalk: string
    signage: string
  }
}

export function PedestrianManager({ era, colors }: PedestrianManagerProps) {
  const pedestrianCount = 12

  const pedestrians = useMemo(() => {
    return Array.from({ length: pedestrianCount }).map((_, i) => ({
      id: `pedestrian-${i}`,
      position: [
        -15 + Math.random() * 30,
        0,
        -15 + Math.random() * 30,
      ] as [number, number, number],
      rotation: [(Math.random() - 0.5) * Math.PI, 0, 0] as [number, number, number],
      speed: 0.005 + Math.random() * 0.01,
      walkPhase: Math.random() * Math.PI * 2,
    }))
  }, [pedestrianCount])

  return (
    <group>
      {pedestrians.map((pedestrian) => (
        <EraPedestrian
          key={pedestrian.id}
          {...pedestrian}
          era={era}
          colors={colors}
        />
      ))}
    </group>
  )
}

interface EraPedestrianProps {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  speed: number
  walkPhase: number
  era: EraId
  colors: any
}

function EraPedestrian({ position, rotation, speed, walkPhase, era, colors }: EraPedestrianProps) {
  const ref = useRef<THREE.Group>(null!)
  const timeOffset = useRef(walkPhase)

  useFrame(({ clock }) => {
    if (ref.current) {
      const time = clock.getElapsedTime()
      const walkCycle = Math.sin(time * speed + timeOffset.current)

      // Bob up and down while walking
      ref.current.position.y = walkCycle * 0.1 + 1

      // Rotate limbs
      const arms = ref.current.children[1]
      const legs = ref.current.children[2]
      if (arms && legs) {
        // @ts-ignore - accessing Object3D children
        arms.rotation.x = walkCycle * 0.3
        legs.rotation.x = -walkCycle * 0.3
      }
    }
  })

  const getPedestrianGeometry = () => {
    switch (era) {
      case '1945':
        return (
          <group>
            {/* Body - suit jacket */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshStandardMaterial color="#4169E1" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#DEB887" />
            </mesh>
            {/* Arms */}
            <group position={[0, 1.5, 0]}>
              {[-0.35, 0.35].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.6]} />
                  <meshStandardMaterial color="#8B4513" />
                </mesh>
              ))}
            </group>
            {/* Legs */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.8]} />
                  <meshStandardMaterial color="#2F4F4F" />
                </mesh>
              ))}
            </group>
            {/* Hat */}
            <mesh position={[0, 2.3, 0]}>
              <cylinderGeometry args={[0.3, 0.35, 0.3]} />
              <meshStandardMaterial color="#2F4F4F" />
            </mesh>
          </group>
        )

      case '1965':
        return (
          <group>
            {/* Body - mod dress/suit */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshStandardMaterial color="#FF69B4" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#FFA500" />
            </mesh>
            {/* Hair - beehive style */}
            <mesh position={[0, 2.3, 0.1]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            {/* Arms */}
            <group position={[0, 1.5, 0]}>
              {[-0.35, 0.35].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.6]} />
                  <meshStandardMaterial color="#FFA500" />
                </mesh>
              ))}
            </group>
            {/* Legs - mini skirt or pants */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.7]} />
                  <meshStandardMaterial color="#4169E1" />
                </mesh>
              ))}
            </group>
          </group>
        )

      case '1985':
        return (
          <group>
            {/* Body - oversized jacket */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.6, 0.9, 0.4]} />
              <meshStandardMaterial color="#FF00FF" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#FFFF00" />
            </mesh>
            {/* Hair - big hair */}
            <mesh position={[0, 2.4, 0]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial color="#000080" />
            </mesh>
            {/* Arms - dramatic pose */}
            <group position={[0, 1.5, 0]}>
              {[-0.4, 0.4].map((x, i) => (
                <mesh key={i} position={[x, 0.2, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.5]} />
                  <meshStandardMaterial color="#00FFFF" />
                </mesh>
              ))}
            </group>
            {/* Legs - leggings */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.8]} />
                  <meshStandardMaterial color="#800080" />
                </mesh>
              ))}
            </group>
          </group>
        )

      case '2005':
        return (
          <group>
            {/* Body - casual modern */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshStandardMaterial color="#00CED1" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Arms */}
            <group position={[0, 1.5, 0]}>
              {[-0.35, 0.35].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.6]} />
                  <meshStandardMaterial color="#8B4513" />
                </mesh>
              ))}
            </group>
            {/* Legs - jeans */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.8]} />
                  <meshStandardMaterial color="#2F4F4F" />
                </mesh>
              ))}
            </group>
            {/* Accessories - phone, headphones */}
            <mesh position={[0, 1.7, 0.25]}>
              <boxGeometry args={[0.1, 0.2, 0.4]} />
              <meshStandardMaterial color="#000000" emissive="#000000" />
            </mesh>
          </group>
        )

      case '2025':
        return (
          <group>
            {/* Body - smart clothing */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshStandardMaterial
                color="#32CD32"
                emissive="#32CD32"
                emissiveIntensity={0.1}
              />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#FFA500" />
            </mesh>
            {/* Arms */}
            <group position={[0, 1.5, 0]}>
              {[-0.35, 0.35].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.6]} />
                  <meshStandardMaterial
                    color="#32CD32"
                    emissive="#32CD32"
                    emissiveIntensity={0.1}
                  />
                </mesh>
              ))}
            </group>
            {/* Legs - techwear */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <cylinderGeometry args={[0.1, 0.1, 0.8]} />
                  <meshStandardMaterial color="#228B22" />
                </mesh>
              ))}
            </group>
            {/* AR glasses */}
            <mesh position={[0, 2.25, 0]}>
              <boxGeometry args={[0.3, 0.05, 0.2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Wearable device */}
            <mesh position={[0.3, 1.3, 0.3]}>
              <cylinderGeometry args={[0.1, 0.1, 0.2]} />
              <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={0.3}
              />
            </mesh>
          </group>
        )

      case '2055':
        return (
          <group>
            {/* Body - bio-tech clothing */}
            <mesh position={[0, 1.5, 0]} castShadow>
              <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
              <meshStandardMaterial
                color="#9370DB"
                emissive="#9370DB"
                emissiveIntensity={0.2}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#DDA0DD" />
            </mesh>
            {/* Arms - elongated for genetic modifications */}
            <group position={[0, 1.5, 0]}>
              {[-0.4, 0.4].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <capsuleGeometry args={[0.08, 0.7, 8, 16]} />
                  <meshStandardMaterial
                    color="#9370DB"
                    emissive="#9370DB"
                    emissiveIntensity={0.15}
                    transparent
                  />
                </mesh>
              ))}
            </group>
            {/* Legs */}
            <group position={[0, 0.9, 0]}>
              {[-0.15, 0.15].map((x, i) => (
                <mesh key={i} position={[x, -0.4, 0]}>
                  <capsuleGeometry args={[0.08, 0.6, 8, 16]} />
                  <meshStandardMaterial
                    color="#DDA0DD"
                    emissive="#DDA0DD"
                    emissiveIntensity={0.1}
                    transparent
                  />
                </mesh>
              ))}
            </group>
            {/* Holo-accessory */}
            <mesh position={[0, 2.3, 0]}>
              <tetrahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial
                color="#DDA0DD"
                emissive="#DDA0DD"
                emissiveIntensity={0.5}
                transparent
              />
            </mesh>
          </group>
        )
    }
  }

  return (
    <group ref={ref} position={position} rotation={rotation}>
      {getPedestrianGeometry()}
    </group>
  )
}