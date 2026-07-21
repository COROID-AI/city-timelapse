import * as THREE from 'three'
import { useMemo } from 'react'
import { EraYear } from '../types'

interface GroundPlaneProps {
  era: EraYear
}

export function GroundPlane({ era }: GroundPlaneProps) {
  // Different ground textures per era
  const getGroundColor = () => {
    switch (era) {
      case 1945: return 0x4a3520; // Dark brown asphalt
      case 1965: return 0x5d4037; // Medium brown
      case 1985: return 0x3e2723; // Dark gray-brown
      case 2005: return 0x212121; // Dark gray concrete
      case 2025: return 0x424242; // Medium gray
      case 2055: return 0x212121; // Dark with glowing lines
      default: return 0x4a3520;
    }
  }

  const geometry = useMemo(() => new THREE.PlaneGeometry(200, 200, 32, 32), [])

  const material = useMemo(() => {
    const color = getGroundColor()
    const mat = new THREE.MeshStandardMaterial({ color })
    return mat
  }, [era])

  return <primitive object={new THREE.Mesh(geometry, material)} rotation={[-Math.PI / 2, 0, 0]} />
}