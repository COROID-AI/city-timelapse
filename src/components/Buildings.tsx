import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

interface BuildingProps {
  position: [number, number, number]
  height: number
  width: number
  depth: number
  era: Era
}

// Building style definitions per era
const buildingStyles: Record<Era, {
  baseColor: string
  windowColor: string
  materialRoughness: number
  materialMetalness: number
}> = {
  '1945': {
    baseColor: '#8B4513',
    windowColor: '#ADD8E6',
    materialRoughness: 0.9,
    materialMetalness: 0.1,
  },
  '1965': {
    baseColor: '#C0C0C0',
    windowColor: '#87CEEB',
    materialRoughness: 0.7,
    materialMetalness: 0.3,
  },
  '1985': {
    baseColor: '#A9A9A9',
    windowColor: '#4682B4',
    materialRoughness: 0.8,
    materialMetalness: 0.2,
  },
  '2005': {
    baseColor: '#E0E0E0',
    windowColor: '#87CEFA',
    materialRoughness: 0.4,
    materialMetalness: 0.6,
  },
  '2025': {
    baseColor: '#F0F0F0',
    windowColor: '#B0E0E6',
    materialRoughness: 0.3,
    materialMetalness: 0.7,
  },
  '2055': {
    baseColor: '#C0DFFF',
    windowColor: '#00FFFF',
    materialRoughness: 0.2,
    materialMetalness: 0.9,
  },
}

function Building({ position, height, width, depth, era }: BuildingProps) {
  const styles = buildingStyles[era]

  return (
    <group position={position}>
      {/* Main building */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={styles.baseColor}
          roughness={styles.materialRoughness}
          metalness={styles.materialMetalness}
          emissive={era === '2055' ? '#001122' : '#000000'}
        />
      </mesh>
      
      {/* Windows */}
      {Array.from({ length: Math.floor(height / 3) }).map((_, y) =>
        Array.from({ length: 4 }).map((__, x) => {
          const windowWidth = 2
          const windowHeight = 2
          const offsetX = x * 4 - width * 0.75
          const offsetY = y * 3 - height / 2 + 2
          
          return (
            <mesh
              key={`${x}-${y}`}
              position={[offsetX, offsetY, depth / 2 + 0.1]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[windowWidth, windowHeight, 0.2]} />
              <meshStandardMaterial
                color={styles.windowColor}
                emissive={styles.windowColor}
                emissiveIntensity={era === '2055' ? 0.5 : 0.2}
                transparent
                opacity={0.8}
              />
            </mesh>
          )
        })
      )}
    </group>
  )
}

export function Buildings() {
  const { currentEra } = useEra()

  const buildings = useMemo(() => [
    { position: [-40, 0, 0], height: 30, width: 20, depth: 20 },
    { position: [0, 0, 0], height: 45, width: 25, depth: 25 },
    { position: [40, 0, 0], height: 25, width: 18, depth: 18 },
    { position: [-40, 0, -50], height: 35, width: 22, depth: 22 },
    { position: [0, 0, -50], height: 50, width: 30, depth: 30 },
    { position: [40, 0, -50], height: 28, width: 20, depth: 20 },
    { position: [-40, 0, 50], height: 32, width: 24, depth: 24 },
    { position: [0, 0, 50], height: 40, width: 28, depth: 28 },
    { position: [40, 0, 50], height: 26, width: 16, depth: 16 },
  ], [currentEra])

  return (
    <group>
      {buildings.map((building, index) => (
        <Building
          key={index}
          position={[building.position[0], building.height / 2, building.position[2]]}
          height={building.height}
          width={building.width}
          depth={building.depth}
          era={currentEra}
        />
      ))}
    </group>
  )
}