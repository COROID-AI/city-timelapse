import React, { useMemo } from 'react'
import { Era } from '../../contexts/EraContext'
import { Vehicle } from './Vehicle'

interface VehicleManagerProps {
  currentEra: Era
  transitionProgress: number
}

const eraVehicles: Record<Era, { type: string; count: number; speed: number }[]> = {
  '1945': [
    { type: 'sedan-classic', count: 3, speed: 0.5 },
    { type: 'truck-vintage', count: 1, speed: 0.3 },
  ],
  '1965': [
    { type: 'sedan-muscle', count: 4, speed: 0.7 },
    { type: 'bus-retro', count: 1, speed: 0.4 },
  ],
  '1985': [
    { type: 'sedan-boxy', count: 5, speed: 0.8 },
    { type: 'suv', count: 2, speed: 0.6 },
  ],
  '2005': [
    { type: 'sedan-modern', count: 4, speed: 0.9 },
    { type: 'suv-luxury', count: 2, speed: 0.7 },
    { type: 'hybrid', count: 2, speed: 0.8 },
  ],
  '2025': [
    { type: 'electric-sedan', count: 5, speed: 1.0 },
    { type: 'autonomous-pod', count: 3, speed: 1.2 },
  ],
  '2055': [
    { type: 'flying-car', count: 4, speed: 1.5 },
    { type: 'autonomous-pod', count: 4, speed: 1.3 },
    { type: 'hover-vehicle', count: 2, speed: 1.4 },
  ],
}

export function VehicleManager({ currentEra, transitionProgress }: VehicleManagerProps) {
  const vehicles = useMemo(() => {
    const eraVehicle = eraVehicles[currentEra]
    const result: JSX.Element[] = []
    let id = 0

    eraVehicle.forEach(({ type, count, speed }) => {
      for (let i = 0; i < count; i++) {
        result.push(
          <Vehicle
            key={`${type}-${id}`}
            id={id}
            type={type}
            position={[
              -12 + Math.random() * 24,
              0.2,
              -12 + Math.random() * 24
            ]}
            speed={speed}
            transitionProgress={transitionProgress}
          />
        )
        id++
      }
    })

    return result
  }, [currentEra])

  return <group>{vehicles}</group>
}