import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'
import * as THREE from 'three'

interface BuildingRowProps {
  count: number
  side: 'left' | 'right'
  era: Era
  transitionProgress: number
}

export function BuildingRow({ count, side, era, transitionProgress }: BuildingRowProps) {
  const xOffset = side === 'left' ? -46 : 46
  
  const buildings = useMemo(() => {
    const types = ['residential', 'commercial', 'mixed']
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      type: types[i % 3] as 'residential' | 'commercial' | 'mixed',
      height: 8 + Math.random() * 12,
      width: 12 + Math.random() * 4,
      depth: 10 + Math.random() * 4,
      z: -30 + i * 10
    }))
  }, [count])

  return (
    <group position={[xOffset, 0, 0]}>
      {buildings.map((building) => (
        <Building
          key={building.id}
          position={[0, building.height / 2, building.z]}
          height={building.height}
          width={building.width}
          depth={building.depth}
          type={building.type}
          era={era}
          transitionProgress={transitionProgress}
          side={side}
        />
      ))}
    </group>
  )
}

interface BuildingProps {
  position: [number, number, number]
  height: number
  width: number
  depth: number
  type: 'residential' | 'commercial' | 'mixed'
  era: Era
  transitionProgress: number
  side: 'left' | 'right'
}

function Building({ position, height, width, depth, type, era, transitionProgress, side }: BuildingProps) {
  const buildingColors = useMemo(() => {
    const palettes: Record<Era, string[]> = {
      1945: ['#a87e5d', '#8b6e47', '#c9a66b', '#6b5a47'],
      1965: ['#c0c0c0', '#a0a0a0', '#808080', '#ffffff'],
      1985: ['#5a5a5a', '#4a4a4a', '#6a6a6a', '#3a3a3a'],
      2005: ['#7a7a8a', '#6a6a7a', '#8a8a9a', '#5a5a6a'],
      2025: ['#4a4a5a', '#3a3a4a', '#5a5a6a', '#2a2a3a'],
      2055: ['#2a2a3a', '#1a1a2a', '#3a3a4a', '#0a0a1a']
    }
    return palettes[era]
  }, [era])

  const windowPattern = useMemo(() => {
    const patterns = {
      1945: { rows: 8, cols: 6, style: 'double' as const },
      1965: { rows: 10, cols: 8, style: 'single' as const },
      1985: { rows: 12, cols: 10, style: 'grid' as const },
      2005: { rows: 14, cols: 12, style: 'energy' as const },
      2025: { rows: 16, cols: 14, style: 'smart' as const },
      2055: { rows: 20, cols: 18, style: 'holographic' as const }
    }
    return patterns[era]
  }, [era])

  return (
    <group position={new THREE.Vector3(...position)}>
      {/* Main building structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={buildingColors[0]} 
          roughness={0.7} 
          metalness={era >= 2025 ? 0.6 : 0.3}
        />
      </mesh>
      
      {/* Windows */}
      {Array.from({ length: windowPattern.rows }).map((_, row) => (
        Array.from({ length: windowPattern.cols }).map((_, col) => {
          const windowHeight = height / windowPattern.rows
          const windowWidth = width / windowPattern.cols
          
          let windowColor = '#ffffaa'
          if (windowPattern.style === 'smart') {
            windowColor = '#a0e0ff' // Blue-tinted smart windows
          } else if (windowPattern.style === 'holographic') {
            windowColor = '#80ff80' // Green holographic displays
          }
          
          const y = -height / 2 + windowHeight / 2 + row * windowHeight
          const x = -width / 2 + windowWidth / 2 + col * windowWidth
          
          return (
            <mesh
              key={`win-${row}-${col}`}
              position={new THREE.Vector3(x, y, depth / 2 + 0.01)}
            >
              <planeGeometry args={[windowWidth * 0.8, windowHeight * 0.8]} />
              <meshStandardMaterial 
                color={windowColor} 
                emissive={windowColor}
                emissiveIntensity={era >= 2025 ? 0.3 : 0.1}
                transparent
                opacity={0.9}
              />
            </mesh>
          )
        })
      ))}
      
      {/* Storefront base */}
      <mesh position={new THREE.Vector3(0, -height / 2 + 3, depth / 2 + 0.02)}>
        <boxGeometry args={[width * 0.6, 6, 0.5]} />
        <meshStandardMaterial color={buildingColors[1]} roughness={0.6} metalness={0.4} />
      </mesh>
      
      {/* Storefront signage */}
      <mesh position={new THREE.Vector3(0, -height / 2 + 4, depth / 2 + 0.3)}>
        <planeGeometry args={[6, 2]} />
        <meshStandardMaterial 
          color={era === 1945 ? '#8b4513' : era === 1965 ? '#ff6600' : era === 1985 ? '#ff00ff' : era === 2005 ? '#00aaff' : era === 2025 ? '#00ff88' : '#00ffff'}
          emissive={era === 1945 ? '#8b4513' : era === 1965 ? '#ff6600' : era === 1985 ? '#ff00ff' : era === 2005 ? '#00aaff' : era === 2025 ? '#00ff88' : '#00ffff'}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Entrance */}
      <mesh position={new THREE.Vector3(0, -height / 2 + 0.2, depth / 2 + 0.6)}>
        <boxGeometry args={[width * 0.3, 0.4, 0.8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}
