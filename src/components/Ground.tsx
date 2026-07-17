import React, { useMemo } from 'react'
import { ERA_CONFIGS, Era } from '../lib/types'

interface GroundProps {
  era: Era
}

export const Ground: React.FC<GroundProps> = ({ era }) => {
  const groundProps = useMemo(() => {
    const config = ERA_CONFIGS.find(c => c.era === era)!
    const secondary = config.colorPalette.secondary
    return { secondary }
  }, [era])

  const getGroundMaterial = () => {
    switch (era) {
      case '1945':
        return <meshStandardMaterial color="#654321" roughness={0.9} metalness={0.1} />
      case '1965':
        return <meshStandardMaterial color="#555555" roughness={0.8} metalness={0.2} />
      case '1985':
        return <meshStandardMaterial color="#444444" roughness={0.6} metalness={0.4} />
      case '2005':
        return <meshStandardMaterial color="#333333" roughness={0.7} metalness={0.3} />
      case '2025':
        return <meshStandardMaterial color="#228B22" roughness={0.5} metalness={0.2} />
      case '2055':
        return <meshStandardMaterial color="#006666" roughness={0.4} metalness={0.5} emissive="#00CED1" emissiveIntensity={0.1} />
      default:
        return <meshStandardMaterial color="#333333" />
    }
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      {getGroundMaterial()}
    </mesh>
  )
}