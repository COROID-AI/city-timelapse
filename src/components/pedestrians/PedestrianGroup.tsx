import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEraConfig } from '../../hooks/useEraConfig'
import { EraType } from '../../types/era'
import { useRef } from 'react'

interface PedestrianGroupProps {
  era: EraType
  targetEra?: EraType | null
  transitionProgress?: number
  isTransition?: boolean
}

const PEDESTRIAN_POSITIONS = [
  [-70, 0, -50], [-30, 0, -50], [10, 0, -50], [50, 0, -50],
  [-80, 0, -20], [-40, 0, -20], [0, 0, -20], [40, 0, -20],
  [-75, 0, 10], [-35, 0, 10], [5, 0, 10], [45, 0, 10],
]

export function PedestrianGroup({ era, transitionProgress = 1, isTransition = false }: PedestrianGroupProps) {
  const { config } = useEraConfig(era)

  return (
    <group>
      {PEDESTRIAN_POSITIONS.map((pos, i) => (
        <Pedestrian
          key={`pedestrian-${i}-${isTransition ? 'trans' : 'main'}`}
          position={pos as [number, number, number]}
          type={config.pedestrianStyle}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  )
}

interface PedestrianProps {
  position: [number, number, number]
  type: string
  transitionProgress: number
}

function Pedestrian({ position, type, transitionProgress }: PedestrianProps) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (groupRef.current && type !== 'futuristic') {
      // Gentle idle animation
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.05
    }
  })

  const outfitColors = useMemo(() => {
    switch (type) {
      case 'vintage':
        return { body: '#deb887', shirt: '#8b0000', pants: '#00008b' }
      case 'retro':
        return { body: '#daa520', shirt: '#ff69b4', pants: '#4169e1' }
      case 'punk':
        return { body: '#a0522d', shirt: '#00ff00', pants: '#800080' }
      case 'casual':
        return { body: '#bdb76b', shirt: '#32cd32', pants: '#4169e1' }
      case 'tech':
        return { body: '#87ceeb', shirt: '#00bcd4', pants: '#2c3e50' }
      case 'futuristic':
        return { body: '#9370db', shirt: '#00ffff', pants: '#8a2be2' }
      default:
        return { body: '#deb887', shirt: '#fff', pants: '#333' }
    }
  }, [type])

  return (
    <group ref={groupRef} position={position} scale={[1, transitionProgress, 1]}>
      {/* Body */}
      <mesh position={[0, 2, 0]}>
        <capsuleGeometry args={[0.4, 1.2, 8, 8]} />
        <meshStandardMaterial color={outfitColors.body} />
      </mesh>
      
      {/* Shirt */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.9, 0.8, 0.6]} />
        <meshStandardMaterial color={outfitColors.shirt} />
      </mesh>
      
      {/* Pants */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 1, 0.5]} />
        <meshStandardMaterial color={outfitColors.pants} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={outfitColors.body} />
      </mesh>
      
      {/* Accessories based on era */}
      {type === 'futuristic' && (
        <group>
          {/* Holographic visor */}
          <mesh position={[0, 2.7, 0.35]}>
            <planeGeometry args={[0.5, 0.2]} />
            <meshBasicMaterial color="#00ffff" opacity={0.7} transparent />
          </mesh>
          {/* LED accessories */}
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#ff00ff" toneMapped={false} />
          </mesh>
        </group>
      )}
      
      {type === 'vintage' && (
        <group position={[0, 3.1, 0]}>
          {/* Hat */}
          <mesh>
            <cylinderGeometry args={[0.5, 0.5, 0.2]} />
            <meshStandardMaterial color="#00008b" />
          </mesh>
        </group>
      )}
    </group>
  )
}