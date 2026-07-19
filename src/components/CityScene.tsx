import React, { useMemo, useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { Era } from '../types'
import { Building } from './Building'
import { Vehicle } from './Vehicle'
import { Pedestrian } from './Pedestrian'
import { Storefront } from './Storefront'
import { Ground } from './Ground'

interface CitySceneProps {
  currentEra: Era
}

export const CityScene: React.FC<CitySceneProps> = ({ currentEra }) => {
  const groupRef = useRef<any>(null!)
  const { invalidate } = useThree()

  // Generate city layout
  const cityLayout = useMemo(() => ({
    buildings: generateBuildings(),
    vehicles: generateVehicles(),
    pedestrians: generatePedestrians(),
    storefronts: generateStorefronts(),
  }), [])

  // Animate on era change
  useEffect(() => {
    if (groupRef.current) {
      gsap.to(groupRef.current.rotation, {
        y: Math.random() * Math.PI * 0.1,
        duration: 2,
        ease: 'power2.inOut',
      })
      
      // Trigger re-render for smooth transitions
      invalidate()
    }
  }, [currentEra, invalidate])

  return (
    <group ref={groupRef}>
      {/* Ground plane */}
      <Ground era={currentEra.year} />

      {/* Buildings */}
      {cityLayout.buildings.map((building, i) => (
        <Building
          key={`building-${i}`}
          position={building.position}
          era={currentEra.year}
          index={i}
        />
      ))}

      {/* Storefronts */}
      {cityLayout.storefronts.map((storefront, i) => (
        <Storefront
          key={`storefront-${i}`}
          position={storefront.position}
          era={currentEra.year}
          index={i}
        />
      ))}

      {/* Vehicles */}
      {cityLayout.vehicles.map((vehicle, i) => (
        <Vehicle
          key={`vehicle-${i}`}
          position={vehicle.position}
          rotation={vehicle.rotation}
          era={currentEra.year}
          index={i}
        />
      ))}

      {/* Pedestrians */}
      {cityLayout.pedestrians.map((pedestrian, i) => (
        <Pedestrian
          key={`pedestrian-${i}`}
          position={pedestrian.position}
          rotation={pedestrian.rotation}
          era={currentEra.year}
          index={i}
        />
      ))}
    </group>
  )
}

// Generate building positions
function generateBuildings() {
  const buildings: { position: [number, number, number] }[] = []
  const gridSize = 20
  const spacing = 8

  for (let x = -gridSize; x <= gridSize; x += spacing) {
    for (let z = -gridSize; z <= gridSize; z += spacing) {
      // Skip center area for streets
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue
      
      buildings.push({
        position: [x + (Math.random() - 0.5) * 2, 0, z + (Math.random() - 0.5) * 2] as [number, number, number],
      })
    }
  }

  return buildings
}

// Generate vehicle positions
function generateVehicles() {
  const vehicles: { position: [number, number, number], rotation: [number, number, number] }[] = []
  const streetY = -0.5

  // Main streets
  for (let i = 0; i < 20; i++) {
    vehicles.push({
      position: [i * 4 - 40, streetY, 20] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number],
    })
    vehicles.push({
      position: [i * 4 - 40, streetY, -20] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    })
    vehicles.push({
      position: [20, streetY, i * 4 - 40] as [number, number, number],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number],
    })
    vehicles.push({
      position: [-20, streetY, i * 4 - 40] as [number, number, number],
      rotation: [0, Math.PI / 2, 0] as [number, number, number],
    })
  }

  return vehicles
}

// Generate pedestrian positions
function generatePedestrians() {
  const pedestrians: { position: [number, number, number], rotation: [number, number, number] }[] = []

  // Sidewalks
  for (let i = 0; i < 30; i++) {
    pedestrians.push({
      position: [(Math.random() - 0.5) * 30, 0, 22 + (Math.random() - 0.5) * 4] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    })
    pedestrians.push({
      position: [(Math.random() - 0.5) * 30, 0, -22 - (Math.random() - 0.5) * 4] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number],
    })
    pedestrians.push({
      position: [22 + (Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 30] as [number, number, number],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number],
    })
    pedestrians.push({
      position: [-22 - (Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 30] as [number, number, number],
      rotation: [0, Math.PI / 2, 0] as [number, number, number],
    })
  }

  return pedestrians
}

// Generate storefront positions
function generateStorefronts() {
  const storefronts: { position: [number, number, number] }[] = []
  
  // Ground floor shops along some buildings
  const positions: [number, number, number][] = [
    [5, 0, 21],
    [-5, 0, 21],
    [13, 0, 21],
    [-13, 0, 21],
    [5, 0, -21],
    [-5, 0, -21],
    [13, 0, -21],
    [-13, 0, -21],
    [21, 0, 5],
    [21, 0, -5],
    [21, 0, 13],
    [21, 0, -13],
    [-21, 0, 5],
    [-21, 0, -5],
    [-21, 0, 13],
    [-21, 0, -13],
  ]

  return positions.map((pos, i) => ({ position: pos }))
}