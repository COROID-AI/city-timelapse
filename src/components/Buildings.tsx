import * as THREE from 'three'
import { useMemo } from 'react'
import { EraYear } from '../types'

interface BuildingProps {
  era: EraYear
}

export function Buildings({ era }: BuildingProps) {
  // Define building styles per era
  const getBuildingStyle = () => {
    switch (era) {
      case 1945: return { type: 'brick', color: 0x4a3520 }
      case 1965: return { type: 'modernist', color: 0x2563eb }
      case 1985: return { type: 'neon', color: 0x7c3aed }
      case 2005: return { type: 'glass', color: 0x0ea5e9 }
      case 2025: return { type: 'mixed', color: 0x14b8a6 }
      case 2055: return { type: 'futuristic', color: 0xf59e0b }
      default: return { type: 'brick', color: 0x4a3520 }
    }
  }

  const geometry = useMemo(() => new THREE.BoxGeometry(5, 10, 5), [])
  
  const material = useMemo(() => {
    const { type, color } = getBuildingStyle()
    const mat = new THREE.MeshStandardMaterial({ color, wireframe: type === 'neon' })
    return mat
  }, [era])

  // Create instanced buildings for performance
  const instances = useMemo(() => {
    const count = era === 2055 ? 50 : 30
    const positions = Array.from({ length: count }, () => {
      return [
        (Math.random() - 0.5) * 80,
        5,
        (Math.random() - 0.5) * 80
      ]
    })
    
    return positions.map(pos => new THREE.Mesh(geometry, material).setPosition(pos))
  }, [era])

  return instances.map(mesh => <mesh object={mesh} />)
}