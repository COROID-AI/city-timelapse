import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, MeshStandardMaterial, Color, MathUtils } from 'three'
import type { TransitionState } from '../../hooks/useEraTransition'

interface BuildingProps {
  position: [number, number, number]
  transition: TransitionState
  index: number
}

// Art Deco building
function ArtDecoBuilding() {
  const height = 2

  return (
    <group>
      {/* Main building */}
      <mesh>
        <boxGeometry args={[1, height, 1]} />
        <meshStandardMaterial
          color="#c0a060"
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>
      {/* Art deco details */}
      <mesh position={[0, height / 2 + 0.1, 0]}>
        <boxGeometry args={[1.1, 0.2, 1.1]} />
        <meshStandardMaterial color="#a08040" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Windows with geometric pattern */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin((i / 6) * Math.PI * 2) * 0.3,
            0,
            Math.cos((i / 6) * Math.PI * 2) * 0.3,
          ]}
        >
          <boxGeometry args={[0.15, 0.3, 0.05]} />
          <meshStandardMaterial color="#80a0ff" emissive="#4080ff" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// Brutalist building - raw concrete look
function BrutalistBuilding() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        color="#888888" 
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  )
}

// Modern glass building
function GlassBuilding() {
  const height = 2

  return (
    <group>
      <mesh>
        <boxGeometry args={[1, height, 1]} />
        <meshStandardMaterial
          color="#a0c0ff"
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      {/* Building frame */}
      <mesh>
        <boxGeometry args={[1.05, height + 0.05, 1.05]} />
        <meshStandardMaterial color="#222222" roughness={0.5} metalness={0.8} />
      </mesh>
    </group>
  )
}

// Eco-futuristic building with green elements
function EcoFuturisticBuilding() {
  const height = 2

  return (
    <group>
      {/* Main structure */}
      <mesh>
        <boxGeometry args={[1, height, 1]} />
        <meshStandardMaterial
          color="#40a040"
          roughness={0.3}
          metalness={0.7}
          emissive="#208020"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0, height / 2 + 0.03, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.1]} />
        <meshStandardMaterial color="#808080" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Green wall */}
      <mesh position={[1 / 2 + 0.05, 0, 0]}>
        <boxGeometry args={[0.1, height * 0.5, 1]} />
        <meshStandardMaterial color="#20a020" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  )
}

export function Building({ position, transition, index }: BuildingProps) {
  const groupRef = useRef<THREE.Group>(null)
  const height = transition.buildingHeight

  // Animate transitions
  useFrame(() => {
    if (groupRef.current) {
      const targetScale = height
      const currentScale = groupRef.current.scale.y
      const newScale = MathUtils.lerp(currentScale, targetScale, 0.05)
      groupRef.current.scale.y = newScale
      groupRef.current.position.y = (newScale - 1) * -8
    }
  })

  const getBuildingVariant = () => {
    switch (transition.architecture) {
      case 'art-deco':
        return <ArtDecoBuilding />
      case 'brutalist':
        return <BrutalistBuilding />
      case 'glass':
        return <GlassBuilding />
      case 'eco-futuristic':
        return <EcoFuturisticBuilding />
      default:
        return <GlassBuilding />
    }
  }

  return (
    <group ref={groupRef} position={position} scale={[1, 1, 1]}>
      {getBuildingVariant()}
    </group>
  )
}