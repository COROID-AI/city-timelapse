import { useMemo } from 'react'
import { useEraConfig } from '../../hooks/useEraConfig'
import { EraType } from '../../types/era'

interface VehicleGroupProps {
  era: EraType
  targetEra?: EraType | null
  transitionProgress?: number
  isTransition?: boolean
}

const VEHICLE_POSITIONS_ROAD = [
  [-100, 0, -10], [-60, 0, -10], [-20, 0, -10], [20, 0, -10], [60, 0, -10],
  [-85, 0, 10], [-45, 0, 10], [-5, 0, 10], [35, 0, 10], [75, 0, 10],
]

const VEHICLE_POSITIONS_STREET = [
  [-70, 0, -70], [10, 0, -70], [-50, 0, -40], [30, 0, -40],
]

export function VehicleGroup({ era, targetEra, transitionProgress = 1, isTransition = false }: VehicleGroupProps) {
  const { config } = useEraConfig(era)

  return (
    <group>
      {VEHICLE_POSITIONS_ROAD.map((pos, i) => (
        <Vehicle
          key={`road-vehicle-${i}-${isTransition ? 'trans' : 'main'}`}
          position={pos as [number, number, number]}
          type={config.vehicleStyle}
          transitionProgress={transitionProgress}
          isMoving={true}
          direction="z"
          variant={i % 4}
        />
      ))}
      
      {VEHICLE_POSITIONS_STREET.map((pos, i) => (
        <Vehicle
          key={`street-vehicle-${i}-${isTransition ? 'trans' : 'main'}`}
          position={pos as [number, number, number]}
          type={config.vehicleStyle}
          transitionProgress={transitionProgress}
          isMoving={false}
          direction="x"
          variant={i % 3}
        />
      ))}
    </group>
  )
}

interface VehicleProps {
  position: [number, number, number]
  type: string
  transitionProgress: number
  isMoving: boolean
  direction: 'x' | 'z'
  variant: number
}

function Vehicle({ position, type, transitionProgress, isMoving, direction, variant }: VehicleProps) {
  const vehicleSpecs = useMemo(() => {
    // Different vehicle shapes per era
    switch (type) {
      case 'classic': // 1945 - sedans, trucks
        return { length: variant === 0 || variant === 1 ? 5 : 7, width: 2.2, height: 2.2 }
      case 'muscle': // 1965 - long hood, short deck
        return { length: 5.5, width: 2.5, height: 1.8 }
      case '80s': // 1985 - boxy cars
        return { length: 4.8, width: 2.3, height: 2.4 }
      case 'modern': // 2005 - compact SUVs
        return { length: variant === 0 ? 4.5 : 5, width: 2.2, height: 2 }
      case 'electric': // 2025 - sleek EVs
        return { length: 5, width: 2.1, height: 1.7 }
      case 'hover': // 2055 - floating pods
        return { length: 5, width: 2.5, height: 2.5 }
      default:
        return { length: 6, width: 2.5, height: 2.5 }
    }
  }, [type, variant])

  const vehicleColors = useMemo(() => {
    switch (type) {
      case 'classic':
        return ['#8b4513', '#654321', '#d4af37', '#2f4f4f', '#8b0000']
      case 'muscle':
        return ['#ff0000', '#0000ff', '#ff00ff', '#00ff00', '#ffff00', '#ff69b4']
      case '80s':
        return ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#00bfa5']
      case 'modern':
        return ['#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f', '#1abc9c']
      case 'electric':
        return ['#00bcd4', '#2196f3', '#009688', '#8e24aa', '#00e5ff']
      case 'hover':
        return ['#8a2be2', '#9370db', '#ba55d3', '#00ffff', '#ff00ff', '#7df9ff']
      default:
        return ['#8b4513']
    }
  }, [type])

  const mainColor = vehicleColors[variant % vehicleColors.length]

  return (
    <group position={position} scale={[1, transitionProgress, 1]}>
      {/* Main body - different shapes per era */}
      {type === 'muscle' ? (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[vehicleSpecs.length * 0.7, vehicleSpecs.height, vehicleSpecs.width]} />
          <meshStandardMaterial color={mainColor} metalness={0.6} roughness={0.4} />
        </mesh>
      ) : type === 'hover' ? (
        <mesh castShadow receiveShadow>
          <capsuleGeometry args={[vehicleSpecs.width * 0.5, vehicleSpecs.length, 16, 16]} />
          <meshStandardMaterial 
            color={mainColor} 
            metalness={0.9} 
            roughness={0.1} 
            transparent 
            opacity={0.8}
          />
        </mesh>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[vehicleSpecs.length, vehicleSpecs.height, vehicleSpecs.width]} />
          <meshStandardMaterial 
            color={mainColor}
            metalness={type === 'electric' ? 0.7 : 0.4}
            roughness={type === 'hover' ? 0.1 : 0.7}
          />
        </mesh>
      )}
      
      {/* Wheels or hover engines */}
      {type !== 'hover' ? (
        <group>
          <Wheel position={[-vehicleSpecs.length / 2 + 1, -0.5, vehicleSpecs.width / 2 - 0.3]} type={type} />
          <Wheel position={[vehicleSpecs.length / 2 - 1, -0.5, vehicleSpecs.width / 2 - 0.3]} type={type} />
          <Wheel position={[-vehicleSpecs.length / 2 + 1, -0.5, -(vehicleSpecs.width / 2 - 0.3)]} type={type} />
          <Wheel position={[vehicleSpecs.length / 2 - 1, -0.5, -(vehicleSpecs.width / 2 - 0.3)]} type={type} />
        </group>
      ) : (
        <group>
          {/* Hover engines with glow */}
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={`engine-${i}`} position={[
              -vehicleSpecs.length / 2 + 1 + i * 2,
              -0.8,
              i < 3 ? 0.5 : -0.5
            ]}>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial color="#00ffff" toneMapped={false} />
            </mesh>
          ))}
          {/* Additional hover effect */}
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[vehicleSpecs.width * 0.6, vehicleSpecs.width * 1.2, 16]} />
            <meshBasicMaterial color="#00ffff" opacity={0.3} transparent side={2} />
          </mesh>
        </group>
      )}
      
      {/* Windows */}
      <mesh position={[0, 0.2, vehicleSpecs.width / 2]}>
        <boxGeometry args={[vehicleSpecs.length * 0.7, 0.8, 0.1]} />
        <meshStandardMaterial 
          color="#87ceeb" 
          opacity={type === 'electric' ? 0.7 : 0.6}
          transparent
        />
      </mesh>
      
      {/* Era-specific details */}
      {type === 'muscle' && (
        <group>
          {/* Hood scoop */}
          <mesh position={[0.5, 0.3, vehicleSpecs.width / 2 + 0.1]}>
            <boxGeometry args={[0.8, 0.6, 0.2]} />
            <meshStandardMaterial color="#333" metalness={0.8} />
          </mesh>
        </group>
      )}
      
      {type === 'electric' && (
        <group>
          {/* Charging port */}
          <mesh position={[vehicleSpecs.length / 2 + 0.1, 0, 0]}>
            <boxGeometry args={[0.2, 0.4, 0.4]} />
            <meshStandardMaterial color="#1de9b6" emissive="#1de9b6" emissiveIntensity={0.5} />
          </mesh>
          {/* Side mirror */}
          <mesh position={[0, 0.4, vehicleSpecs.width / 2 + 0.1]}>
            <boxGeometry args={[0.1, 0.3, 0.6]} />
            <meshStandardMaterial color="#ccc" metalness={0.9} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Wheel({ position, type }: { position: [number, number, number], type: string }) {
  const wheelColor = type === 'electric' ? '#37474f' : '#1a1a1a'
  const hasSpokes = type === 'classic'
  
  return (
    <group position={position} rotation-x={Math.PI / 2}>
      <mesh>
        <cylinderGeometry args={[0.6, 0.6, 0.4]} />
        <meshStandardMaterial color={wheelColor} />
      </mesh>
      {hasSpokes && (
        <mesh rotation-z={Math.PI / 2} position={[0, 0, 0.21]}>
          <torusGeometry args={[0.55, 0.05, 8, 12]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      )}
    </group>
  )
}