import * as THREE from 'three'
import { useMemo } from 'react'
import { EraYear } from '../types'

interface StorefrontsProps {
  era: EraYear
}

export function Storefronts({ era }: StorefrontsProps) {
  const getStorefrontStyle = () => {
    switch (era) {
      case 1945: return { color: 0x8B4513, signColor: 0xd4a373 }
      case 1965: return { color: 0x2563eb, signColor: 0x60a5fa }
      case 1985: return { color: 0x7c3aed, signColor: 0xa855f7 }
      case 2005: return { color: 0x0ea5e9, signColor: 0x38bdf8 }
      case 2025: return { color: 0x14b8a6, signColor: 0x2dd4bf }
      case 2055: return { color: 0xf59e0b, signColor: 0xfde047 }
      default: return { color: 0x8B4513, signColor: 0xd4a373 }
    }
  }

  const buildingGeometry = useMemo(() => new THREE.BoxGeometry(4, 3, 1), [])
  const signGeometry = useMemo(() => new THREE.BoxGeometry(3.5, 0.8, 0.1), [])
  
  const { color, signColor } = getStorefrontStyle()
  const buildingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color }), [era])
  const signMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: signColor, 
    emissive: era === 2055 ? signColor : 0x000000,
    emissiveIntensity: era === 2055 ? 1 : 0
  }), [era, signColor])

  const storefronts = useMemo(() => {
    const count = era === 2055 ? 15 : 12
    return Array.from({ length: count }).map((_, i) => (
      <group position={[(i - 6) * 15, 1.5, -15]} key={i}>
        <mesh geometry={buildingGeometry} material={buildingMaterial} />
        <mesh geometry={signGeometry} material={signMaterial} position={[0, 0.8, 0.55]} />
      </group>
    ))
  }, [era])

  return storefronts
}