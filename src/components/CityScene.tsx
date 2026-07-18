import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Building } from './Building'
import { Vehicle } from './Vehicle'
import { Pedestrian } from './Pedestrian'
import { Storefront } from './Storefront'
import { Ground } from './Ground'
import { EraStyles } from '../lib/eraStyles'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface CitySceneProps {
  era: Era
  interpolatedStyles: EraStyles
  transitionProgress: number
}

export function CityScene({ era, interpolatedStyles, transitionProgress }: CitySceneProps) {
  useFrame(() => {
    // Animation frame for smooth transitions
  })

  // Create buildings
  const buildingConfigs = useMemo(() => {
    const baseHeight = 1 + Math.sin(transitionProgress * Math.PI) * 0.1
    return [
      { position: [-25, 0, -25] as [number, number, number], width: 12, height: 25 * baseHeight, depth: 12, type: 'office' as const },
      { position: [0, 0, -25] as [number, number, number], width: 15, height: 30 * baseHeight, depth: 15, type: 'office' as const },
      { position: [25, 0, -25] as [number, number, number], width: 10, height: 20 * baseHeight, depth: 10, type: 'residential' as const },
      { position: [-25, 0, 0] as [number, number, number], width: 14, height: 28 * baseHeight, depth: 14, type: 'office' as const },
      { position: [0, 0, 0] as [number, number, number], width: 8, height: 45 * baseHeight, depth: 8, type: 'skyscraper' as const },
      { position: [25, 0, 0] as [number, number, number], width: 12, height: 22 * baseHeight, depth: 12, type: 'residential' as const },
      { position: [-25, 0, 25] as [number, number, number], width: 16, height: 32 * baseHeight, depth: 16, type: 'office' as const },
      { position: [0, 0, 25] as [number, number, number], width: 18, height: 18 * baseHeight, depth: 18, type: 'mall' as const },
      { position: [25, 0, 25] as [number, number, number], width: 10, height: 25 * baseHeight, depth: 10, type: 'residential' as const },
    ]
  }, [transitionProgress])

  // Create vehicles
  const vehicleConfigs = useMemo(() => [
    { position: [-15, 0, -10] as [number, number, number], rotation: [0, 0.5, 0] as [number, number, number], type: 'car' as const },
    { position: [10, 0, -15] as [number, number, number], rotation: [0, -0.3, 0] as [number, number, number], type: 'car' as const },
    { position: [-5, 0, 5] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], type: 'truck' as const },
    { position: [20, 0, 8] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], type: 'car' as const },
    { position: [-20, 0, 12] as [number, number, number], rotation: [0, -Math.PI / 3, 0] as [number, number, number], type: 'bus' as const },
  ], [])

  // Create pedestrians
  const pedestrianConfigs = useMemo(() => [
    { position: [-10, 0, -5] as [number, number, number], rotation: [0, 0.5, 0] as [number, number, number] },
    { position: [8, 0, -8] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number] },
    { position: [0, 0, 10] as [number, number, number], rotation: [0, -0.3, 0] as [number, number, number] },
    { position: [-15, 0, 15] as [number, number, number], rotation: [0, Math.PI / 4, 0] as [number, number, number] },
    { position: [20, 0, 3] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
  ], [])

  // Create storefronts
  const storefrontConfigs = useMemo(() => [
    { position: [-8, 0, -25] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], width: 8, height: 12 },
    { position: [-18, 0, -25] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], width: 6, height: 10 },
    { position: [12, 0, -25] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], width: 10, height: 14 },
    { position: [-15, 0, 25] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], width: 7, height: 11 },
    { position: [5, 0, 25] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], width: 9, height: 13 },
  ], [])

  return (
    <>
      <Ground eraStyles={interpolatedStyles} />
      
      {buildingConfigs.map((config, i) => (
        <Building
          key={`building-${i}`}
          position={config.position}
          width={config.width}
          height={config.height}
          depth={config.depth}
          type={config.type}
          eraStyles={interpolatedStyles}
        />
      ))}

      {storefrontConfigs.map((config, i) => (
        <Storefront
          key={`storefront-${i}`}
          position={config.position}
          rotation={config.rotation}
          width={config.width}
          height={config.height}
          eraStyles={interpolatedStyles}
        />
      ))}

      {vehicleConfigs.map((config, i) => (
        <Vehicle
          key={`vehicle-${i}`}
          position={config.position}
          rotation={config.rotation}
          type={config.type}
          eraStyles={interpolatedStyles}
        />
      ))}

      {pedestrianConfigs.map((config, i) => (
        <Pedestrian
          key={`pedestrian-${i}`}
          position={config.position}
          rotation={config.rotation}
          eraStyles={interpolatedStyles}
        />
      ))}
    </>
  )
}