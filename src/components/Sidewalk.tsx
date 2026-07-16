import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

interface SidewalkProps {
  side: 'left' | 'right'
  era: Era
  transitionProgress: number
}

export function Sidewalk({ side, era, transitionProgress }: SidewalkProps) {
  const xOffset = side === 'left' ? -46 : 46
  
  const sidewalkColor = useMemo(() => {
    const colors: Record<Era, string> = {
      1945: '#8b7d6b',
      1965: '#7a7a7a',
      1985: '#6a6a6a',
      2005: '#5a5a5a',
      2025: '#4a4a4a',
      2055: '#3a3a3a'
    }
    return colors[era]
  }, [era])

  return (
    <group>
      {/* Sidewalk surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[xOffset, 0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 8]} />
        <meshStandardMaterial color={sidewalkColor} roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* Curb */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[xOffset, 0.02, 0]}>
        <boxGeometry args={[60, 0.2, 1]} />
        <meshStandardMaterial color={side === 'left' ? '#aa9966' : '#aa9966'} />
      </mesh>
    </group>
  )
}
