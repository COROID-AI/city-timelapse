import React, { useMemo } from 'react'
import { Era } from '../contexts/EraContext'
import { Building } from './Building'
import { Ground } from './Ground'
import { Sky } from './Sky'
import { VehicleManager } from './vehicles/VehicleManager'
import { PedestrianManager } from './pedestrians/PedestrianManager'
import { StorefrontManager } from './storefronts/StorefrontManager'
import { useEra } from '../contexts/EraContext'

interface CitySceneProps {
  currentEra: Era
  transitionProgress: number
}

export function CityScene({ currentEra, transitionProgress }: CitySceneProps) {
  const buildings = useMemo(() => [
    { id: 1, position: [-8, 0, -6], size: [6, 12, 6] as [number, number, number] },
    { id: 2, position: [0, 0, -6], size: [8, 10, 7] as [number, number, number] },
    { id: 3, position: [6, 0, -6], size: [5, 8, 5] as [number, number, number] },
    { id: 4, position: [-8, 0, 0], size: [6, 14, 6] as [number, number, number] },
    { id: 5, position: [0, 0, 0], size: [9, 16, 8] as [number, number, number] },
    { id: 6, position: [6, 0, 0], size: [7, 11, 6] as [number, number, number] },
    { id: 7, position: [-8, 0, 6], size: [5, 9, 5] as [number, number, number] },
    { id: 8, position: [0, 0, 6], size: [8, 13, 7] as [number, number, number] },
    { id: 9, position: [6, 0, 6], size: [6, 10, 6] as [number, number, number] },
  ], [])

  return (
    <>
      <Sky currentEra={currentEra} transitionProgress={transitionProgress} />
      <Ground />
      {buildings.map((building) => (
        <Building
          key={building.id}
          position={building.position as [number, number, number]}
          size={building.size}
          currentEra={currentEra}
          transitionProgress={transitionProgress}
        />
      ))}
      <StorefrontManager 
        currentEra={currentEra} 
        transitionProgress={transitionProgress} 
      />
      <VehicleManager 
        currentEra={currentEra} 
        transitionProgress={transitionProgress} 
      />
      <PedestrianManager 
        currentEra={currentEra} 
        transitionProgress={transitionProgress} 
      />
    </>
  )
}