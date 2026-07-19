import React, { useMemo } from 'react'
import { Era } from '../../contexts/EraContext'
import { Pedestrian } from './Pedestrian'

interface PedestrianManagerProps {
  currentEra: Era
  transitionProgress: number
}

const eraPedestrianStyles: Record<Era, { style: string; count: number }[]> = {
  '1945': [
    { style: 'business-1940s', count: 6 },
    { style: 'casual-1940s', count: 4 },
  ],
  '1965': [
    { style: 'mod-dress', count: 8 },
    { style: 'business-1960s', count: 4 },
  ],
  '1985': [
    { style: 'power-suit', count: 6 },
    { style: 'casual-1980s', count: 6 },
  ],
  '2005': [
    { style: 'business-casual', count: 6 },
    { style: 'jeans-tshirt', count: 6 },
  ],
  '2025': [
    { style: 'smart-casual', count: 8 },
    { style: 'athleisure', count: 6 },
  ],
  '2055': [
    { style: 'tech-wear', count: 6 },
    { style: 'adaptive-clothing', count: 8 },
  ],
}

export function PedestrianManager({ currentEra, transitionProgress }: PedestrianManagerProps) {
  const pedestrians = useMemo(() => {
    const styles = eraPedestrianStyles[currentEra]
    const result: JSX.Element[] = []
    let id = 0

    styles.forEach(({ style, count }) => {
      for (let i = 0; i < count; i++) {
        result.push(
          <Pedestrian
            key={id}
            id={id}
            style={style}
            position={[
              -10 + Math.random() * 20,
              0,
              -10 + Math.random() * 20
            ]}
            transitionProgress={transitionProgress}
          />
        )
        id++
      }
    })

    return result
  }, [currentEra])

  return <group>{pedestrians}</group>
}