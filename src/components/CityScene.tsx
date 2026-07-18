import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { Buildings } from './Buildings'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './Pedestrians'
import { Lighting } from './Lighting'
import { Storefronts } from './Storefronts'
import { Sky } from './Sky'
import { PostProcessing } from './PostProcessing'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface CitySceneProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function CityScene({ eraA, eraB, blendT }: CitySceneProps) {
  const groupRef = useRef<Group>(null)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.01
    }
  })

  return (
    <group ref={groupRef}>
      <Sky eraA={eraA} eraB={eraB} blendT={blendT} />
      <Lighting eraA={eraA} eraB={eraB} blendT={blendT} />
      
      <Buildings eraA={eraA} eraB={eraB} blendT={blendT} />
      <Storefronts eraA={eraA} eraB={eraB} blendT={blendT} />
      <Vehicles eraA={eraA} eraB={eraB} blendT={blendT} />
      <Pedestrians eraA={eraA} eraB={eraB} blendT={blendT} />
      
      <PostProcessing eraA={eraA} eraB={eraB} blendT={blendT} />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.8} roughness={0.2} />
      </mesh>

      <gridHelper args={[200, 40, '#222', '#111']} />
      
      {Array.from({ length: 12 }).map((_, i) => (
        <RoadMarking
          key={i}
          position={[-80 + i * 16, 0.01, 0]}
          rotation={[0, Math.PI / 2, 0]}
          eraA={eraA}
          eraB={eraB}
          blendT={blendT}
        />
      ))}
    </group>
  )
}

function RoadMarking({
  position,
  rotation,
  eraA,
  eraB,
  blendT,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  eraA: Era
  eraB: Era
  blendT: number
}) {
  const markingsA = useMemo(() => {
    if (eraA === '1945' || eraA === '1965') return null
    if (eraA === '1985' || eraA === '2005') return '#fff'
    return '#0ff'
  }, [eraA])

  const markingsB = useMemo(() => {
    if (eraB === '1945' || eraB === '1965') return null
    if (eraB === '1985' || eraB === '2005') return '#fff'
    return '#0ff'
  }, [eraB])

  const markings = markingsA && markingsB ? (blendT < 0.5 ? markingsA : markingsB) : markingsA || markingsB

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2, 0.1]} />
      <meshBasicMaterial color={markings} opacity={0.5} transparent />
    </mesh>
  )
}