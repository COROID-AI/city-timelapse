import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { TransitionState } from '../../hooks/useEraTransition'

interface PedestrianManagerProps {
  transition: TransitionState
}

// Vintage pedestrian (1940s)
function VintagePedestrian({ color = '#404080' }: { color?: string }) {
  return (
    <group>
      {/* Hat */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.7} />
      </mesh>
      {/* Body - suit jacket */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.12, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.2]} />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.2]} />
        <meshStandardMaterial color="#444444" roughness={0.8} />
      </mesh>
    </group>
  )
}

// 1960s pedestrian
function SixtiesPedestrian({ color = '#802080' }: { color?: string }) {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.7} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#402000" roughness={0.8} />
      </mesh>
      {/* Body - mini dress */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Legs */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.6, 16]} />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </mesh>
    </group>
  )
}

// 1980s pedestrian
function EightiesPedestrian({ color = '#2040c0' }: { color?: string }) {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.7} />
      </mesh>
      {/* Hair - big */}
      <mesh position={[0, 1.6, 0.1]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#004080" roughness={0.8} />
      </mesh>
      {/* Body - jacket */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Legs - jeans */}
      <mesh position={[-0.12, 0.4, 0]}>
        <boxGeometry args={[0.15, 0.8, 0.25]} />
        <meshStandardMaterial color="#224488" roughness={0.9} />
      </mesh>
      <mesh position={[0.12, 0.4, 0]}>
        <boxGeometry args={[0.15, 0.8, 0.25]} />
        <meshStandardMaterial color="#3355aa" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Modern pedestrian
function ModernPedestrian({ color = '#404040' }: { color?: string }) {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.7} />
      </mesh>
      {/* Body - casual clothes */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.45, 0.9, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.12, 0.35, 0]}>
        <boxGeometry args={[0.14, 0.7, 0.25]} />
        <meshStandardMaterial color="#555555" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.35, 0]}>
        <boxGeometry args={[0.14, 0.7, 0.25]} />
        <meshStandardMaterial color="#666666" roughness={0.8} />
      </mesh>
    </group>
  )
}

// Futuristic pedestrian
function FuturisticPedestrian({ color = '#40a0ff' }: { color?: string }) {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial 
          color="#a0ffa0" 
          roughness={0.3} 
          emissive="#40ff40"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Body - sleek suit */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.4, 0.9, 0.25]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.2} 
          metalness={0.8}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Energy effect */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 0.1, 16]} />
        <meshBasicMaterial 
          color="#40ffff" 
          transparent 
          opacity={0.3}
        />
      </mesh>
      {/* Legs - holographic */}
      <mesh position={[-0.1, 0.35, 0]}>
        <boxGeometry args={[0.12, 0.7, 0.2]} />
        <meshStandardMaterial 
          color="#4080ff" 
          transparent 
          opacity={0.7}
          emissive="#4080ff"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0.1, 0.35, 0]}>
        <boxGeometry args={[0.12, 0.7, 0.2]} />
        <meshStandardMaterial 
          color="#4080ff" 
          transparent 
          opacity={0.7}
          emissive="#4080ff"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  )
}

function Pedestrian({ 
  position, 
  era, 
  color 
}: { 
  position: [number, number, number]
  era: string
  color: string
}) {
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // Walking animation
      const time = state.clock.elapsedTime
      meshRef.current.position.y = position[1] + Math.sin(time * 3) * 0.02
      meshRef.current.rotation.y = Math.sin(time) * 0.1
    }
  })

  const getPedestrian = () => {
    switch (era) {
      case 'vintage':
        return <VintagePedestrian color={color} />
      case '60s':
        return <SixtiesPedestrian color={color} />
      case '80s':
        return <EightiesPedestrian color={color} />
      case 'modern':
        return <ModernPedestrian color={color} />
      case 'futuristic':
        return <FuturisticPedestrian color={color} />
      default:
        return <ModernPedestrian color={color} />
    }
  }

  return (
    <group ref={meshRef} position={position}>
      {getPedestrian()}
    </group>
  )
}

export function PedestrianManager({ transition }: PedestrianManagerProps) {
  const pedestrians = useMemo(() => {
    const skinColors = ['#ffdbac', '#ffd0a0', '#e0c080', '#c0a060']
    
    const pedestrianColors = {
      vintage: ['#404080', '#804020', '#208060', '#802040'],
      '60s': ['#802080', '#ff4080', '#4080ff', '#ff8040'],
      '80s': ['#2040c0', '#c02020', '#20c020', '#c08020'],
      modern: ['#404040', '#606060', '#808080', '#a0a0a0'],
      futuristic: ['#40a0ff', '#a040ff', '#40ffa0', '#ff40a0'],
    }

    const colors = pedestrianColors[transition.pedestrian as keyof typeof pedestrianColors] || pedestrianColors.modern

    // Create pedestrians along sidewalks
    const positions: [number, number, number][] = []
    for (let i = 0; i < 6; i++) {
      positions.push([
        -70 + i * 25,
        0,
        -12,
      ])
      positions.push([
        -70 + i * 25,
        0,
        12,
      ])
    }

    return positions.map((pos, i) => ({
      position: pos,
      color: colors[i % colors.length],
    }))
  }, [transition.pedestrian])

  return (
    <>
      {pedestrians.map((pedestrian, i) => (
        <Pedestrian
          key={i}
          position={pedestrian.position}
          era={transition.pedestrian}
          color={pedestrian.color}
        />
      ))}
    </>
  )
}