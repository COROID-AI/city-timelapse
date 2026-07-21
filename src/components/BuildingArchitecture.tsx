import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { getPalette, type Era } from '../lib/eraConfig'

interface BuildingProps {
  position: Vector3
  size: { width: number; height: number; depth: number }
  era: Era
  buildingType: 'artdeco' | 'modern' | 'brutalist' | 'contemporary' | 'sustainable' | 'futuristic'
}

export const BuildingArchitecture = ({ position, size, era, buildingType }: BuildingProps) => {
  const palette = getPalette(era)
  const mainColor = palette.buildings[0]
  const accentColor = palette.accents[0]

  const geometry = useMemo(() => {
    const shapes: THREE.BufferGeometry[] = []
    
    switch (buildingType) {
      case 'artdeco':
        shapes.push(...createArtDecoGeometry(size))
        break
      case 'modern':
        shapes.push(...createModernGeometry(size))
        break
      case 'brutalist':
        shapes.push(...createBrutalistGeometry(size))
        break
      case 'contemporary':
        shapes.push(...createContemporaryGeometry(size))
        break
      case 'sustainable':
        shapes.push(...createSustainableGeometry(size))
        break
      case 'futuristic':
        shapes.push(...createFuturisticGeometry(size))
        break
    }
    
    return shapes
  }, [size, buildingType])

  return (
    <group position={position}>
      {geometry.map((geom, i) => (
        <mesh key={i} geometry={geom} castShadow receiveShadow>
          <meshStandardMaterial 
            color={i % 3 === 0 ? mainColor : accentColor} 
            roughness={0.8} 
            metalness={buildingType === 'futuristic' ? 0.6 : 0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function createArtDecoGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Main building block
  geometries.push(new THREE.BoxGeometry(size.width, size.height, size.depth))
  
  // Add decorative elements
  const topHeight = size.height * 0.15
  geometries.push(new THREE.BoxGeometry(size.width * 0.8, topHeight, size.depth * 0.8))
  
  // Vertical striations
  for (let i = 0; i < 3; i++) {
    geometries.push(new THREE.BoxGeometry(size.width * 0.05, size.height * 0.6, size.depth * 0.9))
  }
  
  return geometries
}

function createModernGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Clean modern lines
  geometries.push(new THREE.BoxGeometry(size.width, size.height, size.depth))
  
  // Large windows
  geometries.push(new THREE.BoxGeometry(size.width * 0.95, size.height * 0.3, size.depth * 0.05))
  geometries.push(new THREE.BoxGeometry(size.width * 0.95, size.height * 0.3, size.depth * 0.05))
  
  // Flat overhang
  geometries.push(new THREE.BoxGeometry(size.width * 1.1, size.height * 0.05, size.depth * 1.1))
  
  return geometries
}

function createBrutalistGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Massive concrete blocks
  geometries.push(new THREE.BoxGeometry(size.width, size.height, size.depth))
  
  // Deep window recesses
  for (let i = 0; i < 8; i++) {
    const offsetX = ((i % 4) - 1.5) * (size.width / 4)
    const offsetY = (Math.floor(i / 4) - 0.5) * (size.height / 3)
    geometries.push(new THREE.BoxGeometry(size.width * 0.15, size.height * 0.25, size.depth * 0.5))
  }
  
  // Concrete texture blocks
  geometries.push(new THREE.BoxGeometry(size.width * 1.05, size.height * 0.05, size.depth * 1.05))
  
  return geometries
}

function createContemporaryGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Mixed materials with glass curtain walls
  geometries.push(new THREE.BoxGeometry(size.width, size.height, size.depth * 0.8))
  
  // Glass panels
  geometries.push(new THREE.BoxGeometry(size.width * 0.02, size.height, size.depth * 0.8))
  for (let i = 0; i < 6; i++) {
    geometries.push(new THREE.BoxGeometry(size.width * 0.8, size.height * 0.15, size.depth * 0.8))
  }
  
  // Modern entrance
  geometries.push(new THREE.BoxGeometry(size.width * 0.3, size.height * 0.4, size.depth * 0.5))
  
  return geometries
}

function createSustainableGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Green building with living walls
  geometries.push(new THREE.BoxGeometry(size.width, size.height * 0.9, size.depth))
  
  // Green roof segments
  geometries.push(new THREE.BoxGeometry(size.width, size.height * 0.1, size.depth))
  
  // Solar panels
  geometries.push(new THREE.BoxGeometry(size.width * 0.4, size.height * 0.02, size.depth * 0.3))
  geometries.push(new THREE.BoxGeometry(size.width * 0.4, size.height * 0.02, size.depth * 0.3))
  
  // Living wall panels
  geometries.push(new THREE.BoxGeometry(size.width, size.height * 0.4, size.depth * 0.05))
  
  return geometries
}

function createFuturisticGeometry(size: { width: number; height: number; depth: number }): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []
  
  // Holographic glass with floating elements
  geometries.push(new THREE.BoxGeometry(size.width * 0.9, size.height * 0.9, size.depth * 0.9))
  
  // Floating platforms
  geometries.push(new THREE.BoxGeometry(size.width * 0.6, size.height * 0.02, size.depth * 0.6))
  geometries.push(new THREE.BoxGeometry(size.width * 0.4, size.height * 0.02, size.depth * 0.4))
  
  // Energy core
  geometries.push(new THREE.IcosahedronGeometry(size.width * 0.2, 0))
  
  // Neon edges
  geometries.push(new THREE.BoxGeometry(size.width * 1.02, size.height * 0.01, size.depth * 1.02))
  
  return geometries
}