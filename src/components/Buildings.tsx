import React, { useMemo } from 'react'
import { Building } from './Building'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface BuildingsProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Buildings({ eraA, eraB, blendT }: BuildingsProps) {
  const buildingConfigs = useMemo(() => {
    return [
      { position: [-40, 0, -20], width: 20, height: 15, depth: 15, type: 0 },
      { position: [-20, 0, -20], width: 15, height: 25, depth: 15, type: 1 },
      { position: [0, 0, -20], width: 25, height: 18, depth: 15, type: 0 },
      { position: [20, 0, -20], width: 18, height: 30, depth: 15, type: 2 },
      { position: [40, 0, -20], width: 22, height: 22, depth: 15, type: 1 },
      
      { position: [-40, 0, 0], width: 25, height: 20, depth: 20, type: 1 },
      { position: [-12, 0, 0], width: 18, height: 40, depth: 20, type: 0 },
      { position: [15, 0, 0], width: 20, height: 35, depth: 20, type: 2 },
      { position: [45, 0, 0], width: 15, height: 25, depth: 20, type: 1 },
      
      { position: [-45, 0, 20], width: 30, height: 12, depth: 15, type: 0 },
      { position: [-15, 0, 20], width: 15, height: 28, depth: 15, type: 1 },
      { position: [10, 0, 20], width: 20, height: 20, depth: 15, type: 2 },
      { position: [35, 0, 20], width: 25, height: 32, depth: 15, type: 0 },
    ]
  }, [])

  return (
    <group>
      {buildingConfigs.map((config, index) => (
        <Building
          key={index}
          position={config.position as [number, number, number]}
          width={config.width}
          height={config.height}
          depth={config.depth}
          type={config.type}
          eraA={eraA}
          eraB={eraB}
          blendT={blendT}
        />
      ))}
    </group>
  )
}