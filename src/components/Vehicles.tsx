import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'
import * as THREE from 'three'

interface VehiclesProps {
  era: Era
  transitionProgress: number
}

export function Vehicles({ era, transitionProgress }: VehiclesProps) {
  const vehicles = useMemo(() => {
    const configs: Record<Era, { count: number; types: string[]; speed: number }> = {
      1945: { count: 8, types: ['sedan', 'truck', 'suv'], speed: 0.005 },
      1965: { count: 12, types: ['sedan', 'mustang', 'vw', 'truck'], speed: 0.008 },
      1985: { count: 16, types: ['sedan', 'bmw', 'truck', 'van'], speed: 0.01 },
      2005: { count: 20, types: ['sedan', 'suv', 'truck', 'bus'], speed: 0.012 },
      2025: { count: 18, types: ['electric', 'hybrid', 'autonomous', 'bus'], speed: 0.01 },
      2055: { count: 15, types: ['hover', 'autonomous', 'flying'], speed: 0.008 }
    }
    
    const config = configs[era]
    return Array.from({ length: config.count }, (_, i) => ({
      id: i,
      type: config.types[i % config.types.length] as any,
      lane: i % 2,
      offset: Math.random() * 80 - 40,
      speed: config.speed
    }))
  }, [era])

  return (
    <group>
      {vehicles.map((vehicle) => (
        <Vehicle
          key={vehicle.id}
          type={vehicle.type}
          lane={vehicle.lane}
          offset={vehicle.offset}
          era={era}
        />
      ))}
    </group>
  )
}

interface VehicleProps {
  type: string
  lane: number
  offset: number
  era: Era
}

function Vehicle({ type, lane, offset, era }: VehicleProps) {
  const position = useMemo(() => {
    const baseZ = -25 + offset
    const y = lane === 0 ? -3 : -3.5
    return new THREE.Vector3(0, y, baseZ)
  }, [lane, offset])

  const getColor = () => {
    const colors: Record<Era, string[]> = {
      1945: ['#8b4513', '#2d4d7a', '#7a2d2d', '#4d7a2d'],
      1965: ['#ff0000', '#0000ff', '#ffff00', '#00ff00', '#ff00ff'],
      1985: ['#ff6600', '#00aaff', '#cccccc', '#333333'],
      2005: ['#0066cc', '#ff0000', '#000000', '#ffffff'],
      2025: ['#00aaff', '#00ff88', '#ff00aa', '#444444'],
      2055: ['#00ffff', '#ff00ff', '#00aaff', '#aaaaaa']
    }
    const palette = colors[era]
    return palette[type.charCodeAt(0) % palette.length]
  }

  const renderVehicle = () => {
    const color = getColor()
    
    switch (type) {
      case 'sedan':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.4, 0)}>
              <boxGeometry args={[2, 0.6, 4]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh castShadow position={new THREE.Vector3(0, 0.8, 0)}>
              <boxGeometry args={[1.8, 0.4, 2]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={new THREE.Vector3(-0.7, 0.2, 1.5)}>
              <boxGeometry args={[0.2, 0.3, 0.8]} />
              <meshStandardMaterial color="#000" />
            </mesh>
            <mesh position={new THREE.Vector3(0.7, 0.2, 1.5)}>
              <boxGeometry args={[0.2, 0.3, 0.8]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          </group>
        )
      
      case 'mustang':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.3, 0)}>
              <boxGeometry args={[2, 0.5, 4.5]} />
              <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh castShadow position={new THREE.Vector3(0, 0.7, -0.5)}>
              <boxGeometry args={[1.6, 0.3, 1.8]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        )
      
      case 'electric':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.4, 0)}>
              <boxGeometry args={[1.8, 0.5, 4]} />
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.2} />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0.8, 0)}>
              <boxGeometry args={[1.6, 0.2, 1.5]} />
              <meshStandardMaterial color="#88ccff" opacity={0.5} transparent />
            </mesh>
          </group>
        )
      
      case 'autonomous':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.4, 0)}>
              <boxGeometry args={[2, 0.6, 4.2]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0.8, 0)}>
              <boxGeometry args={[1.8, 0.1, 1]} />
              <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0.9, 0)}>
              <circleGeometry args={[0.3, 16]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
          </group>
        )
      
      case 'hover':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.2, 0)}>
              <boxGeometry args={[2.5, 0.3, 4.5]} />
              <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive="#00ffff" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={new THREE.Vector3(-0.8, -0.1, 0)}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
            <mesh position={new THREE.Vector3(0.8, -0.1, 0)}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0, -1.5)}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
            <mesh position={new THREE.Vector3(0, 0, 1.5)}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
          </group>
        )
      
      case 'truck':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 0.8, 0)}>
              <boxGeometry args={[2.5, 1.6, 6]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.5} />
            </mesh>
            <mesh castShadow position={new THREE.Vector3(0, 0.4, 2)}>
              <boxGeometry args={[2.3, 0.8, 2]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          </group>
        )
      
      case 'bus':
        return (
          <group>
            <mesh castShadow position={new THREE.Vector3(0, 1, 0)}>
              <boxGeometry args={[2.8, 2, 8]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} position={new THREE.Vector3(-0.8, 1.3, -2.5 + i * 1.2)}>
                <boxGeometry args={[0.3, 0.5, 0.6]} />
                <meshStandardMaterial color="#88ccff" />
              </mesh>
            ))}
          </group>
        )
      
      default:
        return (
          <mesh castShadow>
            <boxGeometry args={[2, 0.5, 4]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
    }
  }

  return (
    <group position={position}>
      {renderVehicle()}
    </group>
  )
}
