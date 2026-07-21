import * as THREE from 'three'
import { useMemo } from 'react'
import { EraYear } from '../types'

interface PedestriansProps {
  era: EraYear
}

export function Pedestrians({ era }: PedestriansProps) {
  const getPedestrianStyle = () => {
    switch (era) {
      case 1945: return { color: 0x4a3520 }
      case 1965: return { color: 0x2563eb }
      case 1985: return { color: 0x7c3aed }
      case 2005: return { color: 0x0ea5e9 }
      case 2025: return { color: 0x14b8a6 }
      case 2055: return { color: 0xf59e0b }
      default: return { color: 0x4a3520 }
    }
  }

  const geometry = useMemo(() => new THREE.CapsuleGeometry(0.25, 1.5, 4, 8), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: getPedestrianStyle().color }), [era])

  const pedestrians = useMemo(() => {
    const count = era === 2055 ? 6 : 10
    return Array.from({ length: count }).map((_, i) => (
      <group position={[Math.sin(i * 0.5) * 20, 0, Math.cos(i * 0.5) * 20]} key={i}>
        <mesh geometry={geometry} material={material} />
        <mesh geometry={geometry} material={material} position={[0, 1.6, 0]} scale={[0.8, 0.6, 0.8]} />
      </group>
    ))
  }, [era])

  return pedestrians
}