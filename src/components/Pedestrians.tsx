import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'
import * as THREE from 'three'

interface PedestriansProps {
  era: Era
  transitionProgress: number
}

export function Pedestrians({ era, transitionProgress }: PedestriansProps) {
  const pedestrians = useMemo(() => {
    const count = era === 1945 ? 8 : era === 1965 ? 12 : era === 1985 ? 16 : era === 2005 ? 20 : era === 2025 ? 18 : 15
    
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 60,
      z: -35 + Math.random() * 25,
      walking: Math.random() > 0.3
    }))
  }, [era])

  return (
    <group>
      {pedestrians.map((pedestrian) => (
        <Pedestrian
          key={pedestrian.id}
          position={new THREE.Vector3(pedestrian.x, 0.2, pedestrian.z)}
          era={era}
          walking={pedestrian.walking}
        />
      ))}
    </group>
  )
}

interface PedestrianProps {
  position: THREE.Vector3
  era: Era
  walking: boolean
}

function Pedestrian({ position, era, walking }: PedestrianProps) {
  const getColor = () => {
    const palettes: Record<Era, string[]> = {
      1945: ['#8b4513', '#2d4d7a', '#7a2d2d', '#4d7a2d', '#6a4d8b'],
      1965: ['#ff6600', '#00aaff', '#aa0066', '#006600', '#660000'],
      1985: ['#ff00ff', '#00ffff', '#ffff00', '#ff6600', '#0000ff'],
      2005: ['#0066cc', '#ff0000', '#000000', '#ffffff', '#333333'],
      2025: ['#00aaff', '#ff00aa', '#aaaaff', '#00ff88', '#ffaa00'],
      2055: ['#00ffff', '#ff00ff', '#00aaff', '#aa00ff', '#00ffaa']
    }
    return palettes[era][Math.floor(Math.random() * palettes[era].length)]
  }

  const renderModernPedestrian = () => {
    // Body
    const bodyColor = getColor()
    
    // Era-specific details
    if (era >= 2055) {
      return (
        <group>
          {/* Futuristic body */}
          <mesh position={new THREE.Vector3(0, 0.8, 0)}>
            <cylinderGeometry args={[0.3, 0.4, 0.6]} />
            <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={new THREE.Vector3(0, 1.3, 0)}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          {/* Holographic effects */}
          <mesh position={new THREE.Vector3(0, 1.4, 0)}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#00ffff" opacity={0.3} transparent />
          </mesh>
        </group>
      )
    }
    
    if (era >= 2025) {
      return (
        <group>
          {/* Smart clothing body */}
          <mesh position={new THREE.Vector3(0, 0.8, 0)}>
            <cylinderGeometry args={[0.35, 0.4, 0.8]} />
            <meshStandardMaterial color={bodyColor} emissive="#00aaff" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={new THREE.Vector3(0, 1.35, 0)}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>
          {/* Smart accessory */}
          <mesh position={new THREE.Vector3(0.4, 1.5, 0)}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="#00ff88" />
          </mesh>
        </group>
      )
    }
    
    // Classic pedestrian
    return (
      <group>
        <mesh position={new THREE.Vector3(0, 0.9, 0)}>
          <cylinderGeometry args={[0.35, 0.4, 0.9]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        <mesh position={new THREE.Vector3(0, 1.45, 0)}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffdbac" />
        </mesh>
      </group>
    )
  }

  return (
    <group position={position}>
      {renderModernPedestrian()}
    </group>
  )
}
