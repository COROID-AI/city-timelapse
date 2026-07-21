import React, { useMemo } from 'react'
import { Era } from '@/App'
import * as THREE from 'three'

interface BuildingData {
  position: [number, number, number]
  height: number
  width: number
  depth: number
  style: string
}

// Generate building positions in a grid pattern
function generateBuildings(): BuildingData[] {
  const buildings: BuildingData[] = []
  const gridSize = 6
  const spacing = 20
  
  for (let x = -gridSize; x <= gridSize; x += 2) {
    for (let z = -gridSize; z <= gridSize; z += 2) {
      if (Math.abs(x) < 40 && Math.abs(z) < 40) {
        const height = 15 + Math.random() * 25
        const width = 8 + Math.random() * 4
        const depth = 8 + Math.random() * 4
        buildings.push({
          position: [x * spacing, height / 2, z * spacing],
          height,
          width,
          depth,
          style: Math.random() > 0.5 ? 'main' : 'side'
        })
      }
    }
  }
  
  return buildings
}

// Building styles for each era
const getBuildingStyle = (era: Era, baseColor: THREE.Color) => {
  switch (era) {
    case '1945':
      return {
        color: baseColor.lerp(new THREE.Color('#8b7355'), 0.5), // Warm brick
        metalness: 0.2,
        roughness: 0.8,
        windowColor: new THREE.Color('#a89f80')
      }
    case '1965':
      return {
        color: baseColor.lerp(new THREE.Color('#a0a0a0'), 0.7), // Concrete gray
        metalness: 0.3,
        roughness: 0.7,
        windowColor: new THREE.Color('#80a0c0')
      }
    case '1985':
      return {
        color: baseColor.lerp(new THREE.Color('#90a0b0'), 0.4), // Modern concrete
        metalness: 0.4,
        roughness: 0.6,
        windowColor: new THREE.Color('#60c0ff')
      }
    case '2005':
      return {
        color: baseColor.lerp(new THREE.Color('#a8b0c0'), 0.2), // Glass and steel
        metalness: 0.6,
        roughness: 0.4,
        windowColor: new THREE.Color('#a0e0ff')
      }
    case '2025':
      return {
        color: baseColor.lerp(new THREE.Color('#b0c0d0'), 0.1), // Contemporary
        metalness: 0.7,
        roughness: 0.3,
        windowColor: new THREE.Color('#c0f0ff')
      }
    case '2055':
      return {
        color: baseColor.lerp(new THREE.Color('#a0d0f0'), 0.3), // Futuristic
        metalness: 0.8,
        roughness: 0.2,
        windowColor: new THREE.Color('#ffffff')
      }
  }
}

// Optimized building rendering with reduced draw calls
function Building({ 
  position, 
  height, 
  width, 
  depth, 
  era, 
  targetEra,
  transitionProgress 
}: {
  position: [number, number, number]
  height: number
  width: number
  depth: number
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const baseColor = useMemo(() => new THREE.Color(
    0.4 + Math.random() * 0.2,
    0.35 + Math.random() * 0.15,
    0.3 + Math.random() * 0.15
  ), [])

  const styles = useMemo(() => ({
    current: getBuildingStyle(era, baseColor),
    target: getBuildingStyle(targetEra, baseColor)
  }), [era, targetEra, baseColor])

  const lerpedStyle = useMemo(() => ({
    color: new THREE.Color().lerpColors(styles.current.color, styles.target.color, transitionProgress),
    metalness: THREE.MathUtils.lerp(styles.current.metalness, styles.target.metalness, transitionProgress),
    roughness: THREE.MathUtils.lerp(styles.current.roughness, styles.target.roughness, transitionProgress),
    windowColor: new THREE.Color().lerpColors(styles.current.windowColor, styles.target.windowColor, transitionProgress)
  }), [styles, transitionProgress])

  // Generate windows (optimized for performance)
  const windows = useMemo(() => {
    const count: JSX.Element[] = []
    const rows = Math.floor(height / 3)
    const cols = Math.floor(width / 0.8)
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        count.push(
          <mesh 
            key={`${row}-${col}`}
            position={[
              (col - cols/2) * 0.8 + 0.4,
              (row - rows/2) * 3 + height/2,
              depth/2 + 0.01
            ]}
          >
            <planeGeometry args={[0.6, 0.6]} />
            <meshStandardMaterial
              color={lerpedStyle.windowColor}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>
        )
      }
    }
    return count
  }, [height, width, depth, lerpedStyle.windowColor])

  return (
    <group position={position} userData={{ isBuilding: true }}>
      {/* Main building */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={lerpedStyle.color}
          metalness={lerpedStyle.metalness}
          roughness={lerpedStyle.roughness}
        />
      </mesh>
      
      {/* Windows */}
      {windows}
      
      {/* Roof details - era specific */}
      {era === '2055' && targetEra === '2055' && (
        <mesh position={[0, height/2 + 0.1, 0]}>
          <boxGeometry args={[width * 0.8, 0.2, depth * 0.8]} />
          <meshStandardMaterial color="#a0d0f0" emissive="#4080ff" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

export function BuildingSet({ 
  era, 
  targetEra, 
  transitionProgress 
}: {
  era: Era
  targetEra: Era
  transitionProgress: number
}) {
  const buildings = useMemo(() => generateBuildings(), [])

  return (
    <group>
      {buildings.map((building, i) => (
        <Building
          key={i}
          {...building}
          era={era}
          targetEra={targetEra}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  )
}