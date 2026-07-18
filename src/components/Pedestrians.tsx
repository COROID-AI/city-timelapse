import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface PedestriansProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Pedestrians({ eraA, eraB, blendT }: PedestriansProps) {
  const pedestrianConfigs = useMemo(
    () => [
      { position: [-30, 0, -15] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
      { position: [-5, 0, -15] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
      { position: [10, 0, -15] as [number, number, number], rotation: [0, Math.PI / 4, 0] as [number, number, number] },
      { position: [-25, 0, 10] as [number, number, number], rotation: [0, -Math.PI / 4, 0] as [number, number, number] },
      { position: [20, 0, 10] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number] },
    ],
    []
  )

  return (
    <group>
      {pedestrianConfigs.map((config, index) => (
        <Pedestrian
          key={index}
          position={config.position}
          rotation={config.rotation}
          eraA={eraA}
          eraB={eraB}
          blendT={blendT}
          type={index % 2}
        />
      ))}
    </group>
  )
}

interface PedestrianProps {
  position: [number, number, number]
  rotation: [number, number, number]
  eraA: Era
  eraB: Era
  blendT: number
  type: number
}

function Pedestrian({ position, rotation, eraA, eraB, blendT, type }: PedestrianProps) {
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x += Math.cos(state.clock.elapsedTime * 0.3 + type) * 0.002
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <PedestrianVariant era={eraA} type={type} opacity={1 - blendT} />
      <PedestrianVariant era={eraB} type={type} opacity={blendT} />
    </group>
  )
}

function skinColor(era: Era) {
  return {
    '1945': '#D2B48C',
    '1965': '#DEB887',
    '1985': '#F5DEB3',
    '2005': '#DAA520',
    '2025': '#D2B48C',
    '2055': '#8FBC8F',
  }[era]
}

function clothingColor(era: Era, type: number) {
  const colors: Record<Era, string[]> = {
    '1945': ['#2F4F4F', '#8B4513', '#4682B4', '#8B0000'],
    '1965': ['#FF69B4', '#9932CC', '#00CED1', '#FFD700'],
    '1985': ['#FF4500', '#1E90FF', '#32CD32', '#DC143C'],
    '2005': ['#000000', '#FFFFFF', '#FF0000', '#006400'],
    '2025': ['#4682B4', '#FF6347', '#32CD32', '#9370DB'],
    '2055': ['#00FFFF', '#4169E1', '#9932CC', '#00FF7F'],
  }
  return colors[era][type % 4]
}

function PedestrianVariant({ era, type, opacity }: { era: Era; type: number; opacity: number }) {
  const skin = useMemo(() => skinColor(era), [era])
  const cloth = useMemo(() => clothingColor(era, type), [era, type])

  const isClassic = era === '1945' || era === '1965'
  const isFuture = era === '2055'

  if (isClassic) {
    return (
      <group opacity={opacity}>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.5, 0.4, 0.8, 16]} />
          <meshStandardMaterial color={cloth} transparent opacity={0.95} />
        </mesh>
        {era === '1965' && (
          <mesh position={[0, 1.85, 0.2]}>
            <coneGeometry args={[0.25, 0.5, 16]} />
            <meshStandardMaterial color={type === 0 ? '#000080' : '#8B0000'} />
          </mesh>
        )}
      </group>
    )
  }

  if (isFuture) {
    return (
      <group opacity={opacity}>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={skin} emissive="#00FFFF" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
          <meshStandardMaterial color="#4169E1" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.5, 0.4, 0.8, 16]} />
          <meshStandardMaterial color={cloth} emissive={cloth} emissiveIntensity={0.15} />
        </mesh>
      </group>
    )
  }

  // Modern
  return (
    <group opacity={opacity}>
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.5, 0.4, 0.8, 16]} />
        <meshStandardMaterial color={cloth} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {era === '2025' && type === 0 && (
        <mesh position={[-0.1, 1.6, 0.25]}>
          <boxGeometry args={[0.5, 0.3, 0.05]} />
          <meshStandardMaterial args={['#000000', 0, 0, 0.2]} emissive="#00BFFF" emissiveIntensity={0.2} />
        </mesh>
      )}
    </group>
  )
}
