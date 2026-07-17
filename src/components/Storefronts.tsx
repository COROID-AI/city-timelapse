import React, { useMemo } from 'react'
import { ERA_CONFIGS, Era } from '../lib/types'

interface StorefrontsProps {
  era: Era
}

export const Storefronts: React.FC<StorefrontsProps> = ({ era }) => {
  const positions: [number, number, number][] = useMemo(() => [
    [-12, 0, -12],
    [-12, 0, 0],
    [-12, 0, 12],
    [12, 0, -12],
    [12, 0, 0],
    [12, 0, 12],
  ], [])

  return (
    <>
      {positions.map((pos, i) => (
        <Storefront key={i} position={pos} era={era} />
      ))}
    </>
  )
}

interface StorefrontProps {
  position: [number, number, number]
  era: Era
}

const Storefront: React.FC<StorefrontProps> = ({ position, era }) => {
  const signColors = useMemo(() => {
    const palettes: Record<Era, string[]> = {
      '1945': ['#8B4513', '#A0522D', '#CD853F'],
      '1965': ['#FF69B4', '#FFD700', '#8B0000'],
      '1985': ['#00FFFF', '#FF00FF', '#FFFF00'],
      '2005': ['#FF4500', '#32CD32', '#1E90FF'],
      '2025': ['#32CD32', '#20B2AA', '#90EE90'],
      '2055': ['#00CED1', '#FF00FF', '#00FF00'],
    }
    return palettes[era]
  }, [era])

  const getStorefrontMaterial = () => {
    switch (era) {
      case '1945':
        return <meshStandardMaterial color="#8B4513" roughness={0.9} />
      case '1965':
        return <meshStandardMaterial color="#2F4F4F" roughness={0.7} />
      case '1985':
        return <meshStandardMaterial color="#C0C0C0" roughness={0.2} transparent opacity={0.6} />
      case '2005':
        return <meshStandardMaterial color="#5F9EA0" roughness={0.5} />
      case '2025':
        return <meshStandardMaterial color="#2E8B57" roughness={0.4} emissive="#90EE90" emissiveIntensity={0.1} />
      case '2055':
        return <meshStandardMaterial color="#00CED1" roughness={0.3} emissive="#FF00FF" emissiveIntensity={0.3} />
      default:
        return <meshStandardMaterial color="#8B4513" />
    }
  }

  return (
    <group position={position}>
      <mesh position-y={2} castShadow>
        <boxGeometry args={[6, 4, 2]} />
        {getStorefrontMaterial()}
      </mesh>
      <mesh position-y={3.5} position-z={2.5}>
        <boxGeometry args={[3, 0.5, 0.1]} />
        <meshStandardMaterial color={signColors[0]} emissive={signColors[0]} emissiveIntensity={0.5} />
      </mesh>
      <mesh position-y={2.8} position-z={2.5}>
        <boxGeometry args={[3, 0.2, 0.05]} />
        <meshStandardMaterial color={signColors[1]} />
      </mesh>
      <mesh position-y={2.2} position-z={2.5}>
        <boxGeometry args={[2, 0.2, 0.05]} />
        <meshStandardMaterial color={signColors[2]} />
      </mesh>
    </group>
  )
}