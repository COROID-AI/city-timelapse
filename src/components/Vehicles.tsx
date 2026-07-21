import * as THREE from 'three'
import { useMemo } from 'react'
import { EraYear } from '../types'

interface VehiclesProps {
  era: EraYear
}

export function Vehicles({ era }: VehiclesProps) {
  const getVehicleStyle = () => {
    switch (era) {
      case 1945: return { color: 0x8B4513, shape: 'sedan' }
      case 1965: return { color: 0xdc2626, shape: 'muscle' }
      case 1985: return { color: 0x7c3aed, shape: 'boxy' }
      case 2005: return { color: 0x0ea5e9, shape: 'suv' }
      case 2025: return { color: 0x14b8a6, shape: 'electric' }
      case 2055: return { color: 0xf59e0b, shape: 'pod' }
      default: return { color: 0x8B4513, shape: 'sedan' }
    }
  }

  const vehicleGeometry = useMemo(() => new THREE.BoxGeometry(2, 1, 4), [])
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), [])

  const { color } = getVehicleStyle()
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color }), [era])
  const wheelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x333333 }), [era])

  const vehicles = useMemo(() => {
    const count = era === 2055 ? 8 : 12
    return Array.from({ length: count }).map((_, i) => {
      return new THREE.Group()
    })
  }, [era])

  return vehicles.map((group, i) => (
    <group position={[(i - 6) * 12, 0.5, -20 + (i % 3) * 5]} key={i}>
      <mesh geometry={vehicleGeometry} material={bodyMaterial} position={[0, 0.5, 0]} />
      <mesh geometry={wheelGeometry} material={wheelMaterial} position={[0.7, 0.2, 0.8]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={wheelGeometry} material={wheelMaterial} position={[-0.7, 0.2, 0.8]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={wheelGeometry} material={wheelMaterial} position={[0.7, 0.2, -0.8]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={wheelGeometry} material={wheelMaterial} position={[-0.7, 0.2, -0.8]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  ))
}