import React, { useMemo } from 'react'
import { useTransition, a } from '@react-spring/three'
import { Era } from '../context/UIContext'
import { eraConfigs } from '../data/eras'
import * as THREE from 'three'

interface VehicleProps {
  position: [number, number, number]
  era: Era
  prefersReducedMotion: boolean
}

const Vehicle: React.FC<VehicleProps> = ({ position, era, prefersReducedMotion }) => {
  const config = eraConfigs[era]

  const vehicleStyles = useMemo(() => {
    switch (era) {
      case 1945:
        return {
          color: '#4A2C2A',
          shape: 'sedan',
          height: 0.4,
        }
      case 1965:
        return {
          color: '#FF6B6B',
          shape: 'sedan',
          height: 0.4,
        }
      case 1985:
        return {
          color: '#2C3E50',
          shape: 'boxy',
          height: 0.5,
        }
      case 2005:
        return {
          color: '#3498DB',
          shape: 'suv',
          height: 0.6,
        }
      case 2025:
        return {
          color: '#27AE60',
          shape: 'ev',
          height: 0.5,
        }
      case 2055:
        return {
          color: '#9B59B6',
          shape: 'flying',
          height: 0.3,
        }
    }
  }, [era])

  const { position: animPosition, rotation } = useTransition(() => ({
    position: prefersReducedMotion ? position : [position[0] + Math.sin(Date.now() * 0.001) * 0.5, position[1], position[2]],
    rotation: prefersReducedMotion ? [0, 0, 0] : [0, Math.sin(Date.now() * 0.001) * 0.1, 0],
    from: { position, rotation: [0, 0, 0] },
    config: { duration: 2500 },
  }))

  const bodyGeometry = useMemo(() => {
    if (vehicleStyles.shape === 'flying') {
      return new THREE.ConeGeometry(0.3, 0.6, 8)
    }
    return new THREE.BoxGeometry(1, vehicleStyles.height, 0.5)
  }, [vehicleStyles.shape, vehicleStyles.height])

  return (
    <a.mesh position={animPosition} rotation={rotation} castShadow>
      <primitive object={bodyGeometry} attach="geometry" />
      <meshStandardMaterial
        color={vehicleStyles.color}
        metalness={era === 2055 ? 0.9 : 0.6}
        roughness={era === 2055 ? 0.1 : 0.4}
        emissive={era === 2055 ? 0x9B59B6 : 0x000000}
        emissiveIntensity={era === 2055 ? 0.5 : 0}
      />
    </a.mesh>
  )
}

interface VehicleGroupProps {
  era: Era
  prefersReducedMotion: boolean
}

export const VehicleGroup: React.FC<VehicleGroupProps> = ({ era, prefersReducedMotion }) => {
  const vehicles = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let i = 0; i < 5; i++) {
      positions.push([
        -6 + (i * 3),
        0,
        -10 + (i % 2) * 2,
      ])
    }
    return positions
  }, [])

  return (
    <group>
      {vehicles.map((pos, i) => (
        <Vehicle
          key={`${era}-vehicle-${i}`}
          position={pos}
          era={era}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </group>
  )
}