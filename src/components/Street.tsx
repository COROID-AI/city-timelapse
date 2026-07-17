import React, { useMemo } from 'react'
import { Era } from '../lib/types'

export const Street: React.FC<{ era: Era }> = ({ era }) => {
  const streetColor = useMemo(() => {
    const colors: Record<Era, string> = {
      '1945': '#444444',
      '1965': '#555555',
      '1985': '#333333',
      '2005': '#222222',
      '2025': '#33AA33',
      '2055': '#006666',
    }
    return colors[era]
  }, [era])

  return (
    <group>
      {/* Main road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={0.01} receiveShadow>
        <planeGeometry args={[200, 8]} />
        <meshStandardMaterial color={streetColor} />
      </mesh>
      {/* Sidewalks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={0.02} receiveShadow>
        <planeGeometry args={[200, 2]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  )
}