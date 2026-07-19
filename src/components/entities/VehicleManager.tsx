import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Color } from 'three'
import type { TransitionState } from '../../hooks/useEraTransition'

interface VehicleManagerProps {
  transition: TransitionState
}

// Classic 1940s car
function ClassicCar({ color = '#4040c0' }: { color?: string }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2, 0.4, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Front */}
      <mesh position={[0.6, 0.3, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Wheels */}
      {[-0.4, 0.4].map((x, i) => (
        <group key={i} position={[x, 0.15, -0.25]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
            <meshStandardMaterial color="#222222" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {[-0.4, 0.4].map((x, i) => (
        <group key={i + 2} position={[x, 0.15, 0.25]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
            <meshStandardMaterial color="#222222" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Muscle car from 1960s
function MuscleCar({ color = '#c02020' }: { color?: string }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.3, 0.1]}>
        <boxGeometry args={[2.2, 0.5, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Hood scoop */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#444444" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Wheels - larger */}
      {[-0.5, 0.5].map((x, i) => (
        <group key={i} position={[x, 0.2, -0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {[-0.5, 0.5].map((x, i) => (
        <group key={i + 2} position={[x, 0.2, 0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Modern sedan
function Sedan({ color = '#20a0c0' }: { color?: string }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.8, 0.5, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.6, 0.3, 0.2]} />
        <meshStandardMaterial color="#80c0ff" transparent opacity={0.6} />
      </mesh>
      {/* Wheels */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i} position={[x, 0.25, -0.25]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.3, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i + 2} position={[x, 0.25, 0.25]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.3, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Electric vehicle
function EV({ color = '#20c080' }: { color?: string }) {
  return (
    <group>
      {/* Body - sleek, aerodynamic */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.7, 0.5, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Charging port indicator */}
      <mesh position={[0.5, 0.3, 0.45]}>
        <boxGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial 
          color="#ffffff" 
          emissive="#40ff40" 
          emissiveIntensity={0.5} 
        />
      </mesh>
      {/* Wheels - modern design */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i} position={[x, 0.25, -0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.25, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i + 2} position={[x, 0.25, 0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.25, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Hover vehicle
function HoverVehicle({ color = '#a040ff' }: { color?: string }) {
  return (
    <group>
      {/* Main body - aerodynamic */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.3, 1]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.1} 
          metalness={0.9}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Hover engine glow */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.5, 0.3, 0.1, 16]} />
        <meshStandardMaterial 
          color="#40ffff" 
          emissive="#40ffff" 
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Energy field effect */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 1.5, 16]} />
        <meshBasicMaterial 
          color="#40ffff" 
          transparent 
          opacity={0.2}
          side={2}
        />
      </mesh>
    </group>
  )
}

function Vehicle({ 
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
      // Hover animation for 2055 vehicles
      if (era === 'hover') {
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05
      }
    }
  })

  const getVehicle = () => {
    switch (era) {
      case 'classic':
        return <ClassicCar color={color} />
      case 'muscle':
        return <MuscleCar color={color} />
      case 'sedan':
        return <Sedan color={color} />
      case 'ev':
        return <EV color={color} />
      case 'hover':
        return <HoverVehicle color={color} />
      default:
        return <Sedan color={color} />
    }
  }

  return (
    <group ref={meshRef} position={position}>
      {getVehicle()}
    </group>
  )
}

export function VehicleManager({ transition }: VehicleManagerProps) {
  const vehicles = useMemo(() => {
    const vehicleColors = {
      classic: ['#4040c0', '#c06020', '#20a060', '#a02020'],
      muscle: ['#c02020', '#20c040', '#4060c0', '#a06020'],
      sedan: ['#20a0c0', '#a02080', '#60c020', '#c08020'],
      ev: ['#20c080', '#40a0ff', '#ff8040', '#8040ff'],
      hover: ['#a040ff', '#40ffff', '#ff40a0', '#40ff80'],
    }

    const colors = vehicleColors[transition.vehicle as keyof typeof vehicleColors] || vehicleColors.sedan

    // Create vehicles along the road
    const positions: [number, number, number][] = []
    for (let i = 0; i < 8; i++) {
      positions.push([
        -80 + i * 20,
        0,
        -5,
      ])
      positions.push([
        -80 + i * 20,
        0,
        5,
      ])
    }

    return positions.map((pos, i) => ({
      position: pos,
      color: colors[i % colors.length],
    }))
  }, [transition.vehicle])

  return (
    <>
      {vehicles.map((vehicle, i) => (
        <Vehicle
          key={i}
          position={vehicle.position}
          era={transition.vehicle}
          color={vehicle.color}
        />
      ))}
    </>
  )
}