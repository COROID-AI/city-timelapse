import { useMemo } from 'react'
import type { Era } from '../types/era'
import { ERA_CONFIGS } from '../types/era'
import { Building } from './Building'
import { Vehicle } from './Vehicle'
import { Pedestrian } from './Pedestrian'
import { Street } from './Street'
import { Sky } from './Sky'
import { Storefront } from './Storefront'

interface CityBlockProps {
  era: Era
  transitionProgress: number
}

interface BuildingItem {
  key: string
  position: [number, number, number]
}

interface VehicleItem {
  key: string
  position: [number, number, number]
  rotation: [number, number, number]
}

interface PedestrianItem {
  key: string
  position: [number, number, number]
}

interface StorefrontItem {
  key: string
  position: [number, number, number]
}

export function CityBlock({ era, transitionProgress }: CityBlockProps) {
  // Create a 3x3 grid of buildings
  const buildings = useMemo(() => {
    const items: BuildingItem[] = []

    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        // Skip center for street area
        if (x === 0 && z === 0) continue

        items.push({
          key: `building-${x}-${z}`,
          position: [x * 15, 0, z * 15] as [number, number, number],
        })
      }
    }
    return items
  }, [])

  // Create vehicles
  const vehicles = useMemo(() => {
    const items: VehicleItem[] = []
    const count = era === '1945' || era === '1965' ? 3 : era === '1985' ? 2 : 5

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1
      const angle = (Math.random() * Math.PI) / 2
      const radius = 12 + Math.random() * 5
      
      items.push({
        key: `vehicle-${i}`,
        position: [
          side * Math.cos(angle) * radius,
          0,
          side * Math.sin(angle) * radius,
        ] as [number, number, number],
        rotation: [0, angle + Math.PI / 2, 0] as [number, number, number],
      })
    }
    return items
  }, [era])

  // Create pedestrians
  const pedestrians = useMemo(() => {
    const items: PedestrianItem[] = []
    const pedestrianConfig = ERA_CONFIGS[era].pedestrianStyle
    const count = Math.floor(pedestrianConfig.density * 30)

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 12 + Math.random() * 5
      
      items.push({
        key: `pedestrian-${i}`,
        position: [
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ] as [number, number, number],
      })
    }
    return items
  }, [era])

  // Create storefronts on some buildings
  const storefronts = useMemo(() => {
    const items: StorefrontItem[] = []
    const storePositions = [
      [-30, 0, -15],
      [-15, 0, -15],
      [15, 0, 15],
      [30, 0, 15],
    ]

    storePositions.forEach((pos, i) => {
      items.push({
        key: `store-${i}`,
        position: pos as [number, number, number],
      })
    })
    return items
  }, [])

  return (
    <>
      <Sky era={era} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color={era === '2055' ? '#1a1a2e' : '#2a2a2a'}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Street */}
      <Street era={era} />

      {/* Buildings */}
      {buildings.map((building) => (
        <Building
          key={building.key}
          position={building.position}
          era={era}
          transitionProgress={transitionProgress}
        />
      ))}

      {/* Storefronts */}
      {storefronts.map((store) => (
        <Storefront
          key={store.key}
          position={store.position}
          era={era}
        />
      ))}

      {/* Vehicles */}
      {vehicles.map((vehicle) => (
        <Vehicle
          key={vehicle.key}
          position={vehicle.position}
          rotation={vehicle.rotation}
          era={era}
        />
      ))}

      {/* Pedestrians */}
      {pedestrians.map((pedestrian) => (
        <Pedestrian
          key={pedestrian.key}
          position={pedestrian.position}
          era={era}
        />
      ))}
    </>
  )
}