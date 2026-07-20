import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Era } from '../App'

interface PedestriansProps {
  era: Era
}

export const Pedestrians: React.FC<PedestriansProps> = ({ era }) => {
  const pedestrians = useMemo(() => {
    const items: JSX.Element[] = []
    const pedestrianCount = Math.floor(Math.random() * 6) + 4

    for (let i = 0; i < pedestrianCount; i++) {
      const x = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 15

      items.push(
        <Pedestrian
          key={i}
          position={[x, 0, z]}
          era={era}
          activity={['walking', 'standing', 'sitting'][Math.floor(Math.random() * 3)] as 'walking' | 'standing' | 'sitting'}
        />
      )
    }

    return items
  }, [era])

  return (
    <group position={[0, 0, -20]}>
      {pedestrians}
    </group>
  )
}

interface PedestrianProps {
  position: [number, number, number]
  era: Era
  activity: 'walking' | 'standing' | 'sitting'
}

const Pedestrian: React.FC<PedestrianProps> = ({ position, era, activity }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    if (groupRef.current && activity === 'walking') {
      groupRef.current.position.x += Math.sin(timeRef.current * 2) * 0.02
      groupRef.current.position.z += Math.cos(timeRef.current * 2) * 0.01
      groupRef.current.rotation.y = Math.sin(timeRef.current) * 0.3
    }
  })

  const style = useMemo(() => {
    return {
      1945: {
        skin: '#d2b48c',
        clothing: '#8b4513',
        hat: '#000000',
        accessories: true,
      },
      1965: {
        skin: '#deb887',
        clothing: '#4169e1',
        hat: '#ffffff',
        accessories: true,
      },
      1985: {
        skin: '#f5deb3',
        clothing: '#ff69b4',
        hat: '#ff00ff',
        accessories: true,
      },
      2005: {
        skin: '#eec99a',
        clothing: '#228b22',
        hat: '#000000',
        accessories: false,
      },
      2025: {
        skin: '#f1c2a3',
        clothing: '#4682b4',
        hat: '#ffffff',
        accessories: false,
      },
      2055: {
        skin: '#e3c19d',
        clothing: '#00ffff',
        hat: '#0a0a2a',
        accessories: true,
        glow: true,
      },
    }[era]
  }, [era])

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 1.6, 0]}>
        <capsuleGeometry args={[0.3, 1, 8, 16]} />
        <meshStandardMaterial color={style.clothing} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={style.skin} />
      </mesh>

      {/* Hat */}
      {style.hat && (
        <mesh position={[0, 2.6, 0.1]}>
          <cylinderGeometry args={[0.4, 0.35, 0.3]} />
          <meshStandardMaterial
            color={style.hat}
            emissive={era === 2055 ? style.hat : '#000000'}
            emissiveIntensity={era === 2055 ? 0.5 : 0}
          />
        </mesh>
      )}

      {/* Legs */}
      <group position={[0, 0.9, 0]}>
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, -0.4, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        ))}
      </group>

      {/* Arms */}
      <group position={[0, 1.5, 0]}>
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 6}>
            <cylinderGeometry args={[0.12, 0.12, 0.8]} />
            <meshStandardMaterial color={style.skin} />
          </mesh>
        ))}
      </group>

      {activity === 'sitting' && (
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.8, 0.2, 0.4]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      )}
    </group>
  )
}