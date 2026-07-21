import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { getPalette, type Era } from '../lib/eraConfig'

interface VehicleProps {
  position: Vector3
  era: Era
  vehicleType: 'vintage' | 'classic' | 'boxy' | 'modern_suv' | 'electric' | 'autonomous'
}

export const Vehicle = ({ position, era, vehicleType }: VehicleProps) => {
  const palette = getPalette(era)
  const [mainColor, accentColor] = palette.vehicles

  const geometry = useMemo(() => {
    switch (vehicleType) {
      case 'vintage':
        return createVintageCar()
      case 'classic':
        return createClassicCar()
      case 'boxy':
        return createBoxyCar()
      case 'modern_suv':
        return createModernSUV()
      case 'electric':
        return createElectricCar()
      case 'autonomous':
        return createAutonomousPod()
      default:
        return createVintageCar()
    }
  }, [vehicleType])

  return (
    <group position={position}>
      {geometry.map((part, i) => (
        <mesh key={i} {...part} castShadow receiveShadow>
          <meshStandardMaterial 
            color={part.color ?? mainColor} 
            roughness={0.6} 
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

function createVintageCar(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; rotation?: THREE.Euler; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(2, 0.6, 4), position: new THREE.Vector3(0, 0.3, 0), color: 0x8b4513 },
    { geometry: new THREE.BoxGeometry(1.8, 0.2, 2), position: new THREE.Vector3(0, 0.7, -0.2), color: 0x654321 },
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), position: new THREE.Vector3(-0.7, 0.1, -1), rotation: new THREE.Euler(0, 0, Math.PI / 2) },
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), position: new THREE.Vector3(0.7, 0.1, -1), rotation: new THREE.Euler(0, 0, Math.PI / 2) },
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), position: new THREE.Vector3(-0.7, 0.1, 1), rotation: new THREE.Euler(0, 0, Math.PI / 2) },
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), position: new THREE.Vector3(0.7, 0.1, 1), rotation: new THREE.Euler(0, 0, Math.PI / 2) },
  ]
}

function createClassicCar(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(1.8, 0.5, 4.2), position: new THREE.Vector3(0, 0.25, 0) },
    { geometry: new THREE.BoxGeometry(1.6, 0.3, 2), position: new THREE.Vector3(0, 0.65, -0.3) },
    { geometry: new THREE.TorusGeometry(0.35, 0.15, 16, 20), position: new THREE.Vector3(-0.6, 0.1, -1), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
    { geometry: new THREE.TorusGeometry(0.35, 0.15, 16, 20), position: new THREE.Vector3(0.6, 0.1, -1), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
    { geometry: new THREE.TorusGeometry(0.35, 0.15, 16, 20), position: new THREE.Vector3(-0.6, 0.1, 1), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
    { geometry: new THREE.TorusGeometry(0.35, 0.15, 16, 20), position: new THREE.Vector3(0.6, 0.1, 1), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
  ]
}

function createBoxyCar(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(2, 0.7, 4.5), position: new THREE.Vector3(0, 0.35, 0) },
    { geometry: new THREE.BoxGeometry(1.5, 0.4, 1.5), position: new THREE.Vector3(0, 0.9, 0.5) },
    { geometry: new THREE.BoxGeometry(0.2, 0.5, 0.5), position: new THREE.Vector3(-0.7, 0.2, -1.2) },
    { geometry: new THREE.BoxGeometry(0.2, 0.5, 0.5), position: new THREE.Vector3(0.7, 0.2, -1.2) },
  ]
}

function createModernSUV(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(1.9, 0.8, 4.3), position: new THREE.Vector3(0, 0.4, 0) },
    { geometry: new THREE.BoxGeometry(1.7, 0.5, 2), position: new THREE.Vector3(0, 1.1, -0.2) },
    { geometry: new THREE.CylinderGeometry(0.38, 0.38, 0.4, 20), position: new THREE.Vector3(-0.8, 0.2, -1) },
    { geometry: new THREE.CylinderGeometry(0.38, 0.38, 0.4, 20), position: new THREE.Vector3(0.8, 0.2, -1) },
    { geometry: new THREE.CylinderGeometry(0.38, 0.38, 0.4, 20), position: new THREE.Vector3(-0.8, 0.2, 1) },
    { geometry: new THREE.CylinderGeometry(0.38, 0.38, 0.4, 20), position: new THREE.Vector3(0.8, 0.2, 1) },
  ]
}

function createElectricCar(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(1.8, 0.6, 4), position: new THREE.Vector3(0, 0.3, 0) },
    { geometry: new THREE.BoxGeometry(1.6, 0.2, 3), position: new THREE.Vector3(0, 0.75, -0.5) },
    { geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16), position: new THREE.Vector3(-0.7, 0.1, -0.8) },
    { geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16), position: new THREE.Vector3(0.7, 0.1, -0.8) },
    { geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16), position: new THREE.Vector3(-0.7, 0.1, 0.8) },
    { geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16), position: new THREE.Vector3(0.7, 0.1, 0.8) },
  ]
}

function createAutonomousPod(): Array<{ geometry: THREE.BufferGeometry; position: THREE.Vector3; color?: number }> {
  return [
    { geometry: new THREE.BoxGeometry(1.5, 0.9, 2.5), position: new THREE.Vector3(0, 0.45, 0) },
    { geometry: new THREE.BoxGeometry(1.4, 0.2, 2.3), position: new THREE.Vector3(0, 0.9, 0) },
    { geometry: new THREE.BoxGeometry(0.1, 0.4, 0.5), position: new THREE.Vector3(-0.5, 0.2, 0.3) },
    { geometry: new THREE.BoxGeometry(0.1, 0.4, 0.5), position: new THREE.Vector3(0.5, 0.2, 0.3) },
    { geometry: new THREE.IcosahedronGeometry(0.15, 0), position: new THREE.Vector3(0, 1.3, 0.8) },
  ]
}