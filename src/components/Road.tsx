import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'
import * as THREE from 'three'

interface RoadProps {
  era: Era
  transitionProgress: number
}

export function Road({ era, transitionProgress }: RoadProps) {
  const roadColor = useMemo(() => {
    const colors: Record<Era, string> = {
      1945: '#404040',
      1965: '#3a3a3a',
      1985: '#353535',
      2005: '#303030',
      2025: '#2a2a2a',
      2055: '#202020'
    }
    return colors[era]
  }, [era])

  const laneMarkingColor = '#ffff00'
  
  return (
    <group>
      {/* Main road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 12]} />
        <meshStandardMaterial color={roadColor} roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Lane markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[80, 0.2]} />
        <meshBasicMaterial color={laneMarkingColor} />
      </mesh>
      
      {/* Road edges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-44, 0.01, 0]}>
        <planeGeometry args={[2, 12]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[44, 0.01, 0]}>
        <planeGeometry args={[2, 12]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
    </group>
  )
}
