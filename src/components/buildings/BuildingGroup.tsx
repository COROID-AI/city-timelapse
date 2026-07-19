import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EraType } from '../../types/era'
import { useEraConfig } from '../../hooks/useEraConfig'

interface BuildingGroupProps {
  era: EraType
  targetEra?: EraType | null
  transitionProgress?: number
  isTransition?: boolean
}

const BUILDING_POSITIONS = [
  [-120, 0, -30], [-80, 0, -30], [-40, 0, -30], [0, 0, -30], [40, 0, -30],
  [-120, 0, 0], [-80, 0, 0], [-40, 0, 0], [0, 0, 0], [40, 0, 0],
  [-120, 0, 30], [-80, 0, 30], [-40, 0, 30], [0, 0, 30], [40, 0, 30],
  [-110, 0, -60], [-70, 0, -60], [-30, 0, -60], [10, 0, -60], [50, 0, -60],
]

const BUILDING_TYPES = ['skyscraper', 'office', 'residential', 'shop', 'bank'] as const
type BuildingType = typeof BUILDING_TYPES[number]

// Building variants for each era
const ERA_BUILDING_STYLES: Record<string, { heights: number[], colors: string[] }> = {
  brick: { heights: [25, 35, 45], colors: ['#8b4513', '#a0522d', '#654321'] },
  modernist: { heights: [30, 50, 70], colors: ['#c0c0c0', '#d3d3d3', '#a9a9a9'] },
  glass: { heights: [40, 60, 80], colors: ['#87ceeb', '#b0e0e6', '#add8e6'] },
  contemporary: { heights: [35, 55, 75], colors: ['#3498db', '#5dade2', '#2ecc71'] },
  green: { heights: [40, 50, 65], colors: ['#27ae60', '#2ecc71', '#1abc9c'] },
  'bio-integrated': { heights: [50, 70, 90], colors: ['#8e44ad', '#9b59b6', '#3498db'] },
}

export function BuildingGroup({ era, targetEra, transitionProgress = 1, isTransition = false }: BuildingGroupProps) {
  const { config } = useEraConfig(era)
  
  // Create buildings with era-appropriate styles
  const buildings = useMemo(() => {
    return BUILDING_POSITIONS.map((pos, i) => {
      const eraStyle = ERA_BUILDING_STYLES[config.buildingStyle]
      const heightIndex = i % eraStyle.heights.length
      return {
        position: pos as [number, number, number],
        type: BUILDING_TYPES[i % BUILDING_TYPES.length],
        height: eraStyle.heights[heightIndex],
        width: 15 + (i % 3) * 5,
        depth: 15 + (i % 3) * 5,
        color: eraStyle.colors[heightIndex],
      }
    })
  }, [config.buildingStyle])

  return (
    <group>
      {buildings.map((building, index) => (
        <Building
          key={`building-${index}-${isTransition ? 'transition' : 'main'}`}
          position={building.position}
          type={building.type}
          height={building.height}
          width={building.width}
          depth={building.depth}
          style={config.buildingStyle}
          color={building.color}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  )
}

interface BuildingProps {
  position: [number, number, number]
  type: BuildingType
  height: number
  width: number
  depth: number
  style: string
  color: string
  transitionProgress: number
}

function Building({ position, type, height, width, depth, style, color, transitionProgress }: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.y = 0.5 + transitionProgress * 0.5
    }
  })

  // Generate windows based on building type and era
  const windows = useMemo(() => {
    const rows = Math.floor(height / 5)
    const cols = Math.floor(width / 3)
    const count = Math.min(rows * cols, 200) // Cap for performance
    
    return Array.from({ length: count }).map((_, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const isLit = style !== 'brick' && Math.random() > 0.3
      
      return {
        position: [
          -width / 2 + 2 + col * 3,
          -height / 2 + 4 + row * 5,
          depth / 2 + 0.05
        ] as [number, number, number],
        size: style === 'glass' ? [1.5, 2] as [number, number] : [1, 1.5] as [number, number],
        lit: isLit,
        color: isLit ? (style === 'glass' ? '#87ceeb' : '#ffff99') : '#333',
      }
    })
  }, [height, width, depth, style])

  // Door for shop/residential types
  const hasDoor = type === 'shop' || type === 'residential'

  return (
    <group position={position}>
      {/* Main building structure */}
      <mesh 
        ref={meshRef}
        castShadow 
        receiveShadow
        scale={[1, transitionProgress, 1]}
        position-y={height / 2}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color} 
          roughness={style === 'glass' || style === 'contemporary' ? 0.1 : 0.7}
          metalness={style === 'glass' || style === 'modernist' ? 0.8 : 0.2}
        />
      </mesh>

      {/* Windows */}
      {windows.map((window, i) => (
        <mesh 
          key={`window-${i}`} 
          position={window.position}
        >
          <planeGeometry args={window.size} />
          <meshStandardMaterial 
            color={window.color}
            emissive={window.lit ? window.color : '#000'}
            emissiveIntensity={window.lit ? 0.5 : 0}
          />
        </mesh>
      ))}

      {/* Door */}
      {hasDoor && (
        <mesh position={[0, 1.5, depth / 2 + 0.03]}>
          <planeGeometry args={[3, 4]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      )}

      {/* Roof details based on era */}
      <RoofDetail 
        type={type} 
        height={height} 
        width={width} 
        depth={depth} 
        style={style} 
      />
    </group>
  )
}

function RoofDetail({ type, height, width, depth, style }: {
  type: BuildingType
  height: number
  width: number
  depth: number
  style: string
}) {
  return (
    <group position-y={height / 2 + 0.5}>
      {style === 'brick' && (
        <mesh>
          <boxGeometry args={[width * 1.05, 1.5, depth * 1.05]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      )}
      
      {style === 'modernist' && (
        <mesh>
          <boxGeometry args={[width, 1, depth]} />
          <meshStandardMaterial color="#a9a9a9" metalness={0.9} roughness={0.1} />
        </mesh>
      )}
      
      {style === 'glass' && type === 'skyscraper' && (
        <mesh>
          <cylinderGeometry args={[width * 0.6, width * 0.4, 3, 16]} />
          <meshStandardMaterial color="#87ceeb" transparent opacity={0.6} metalness={0.8} />
        </mesh>
      )}
      
      {style === 'green' && (
        <group>
          {/* Green roof */}
          <mesh>
            <boxGeometry args={[width + 1, 0.5, depth + 1]} />
            <meshStandardMaterial color="#27ae60" />
          </mesh>
          {/* Solar panels */}
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={`solar-${i}`} position={[
              -width / 2 + 2 + i * 5,
              1.3,
              -depth / 2 + 3
            ]} rotation-x={-0.3}>
              <boxGeometry args={[4, 0.1, 2]} />
              <meshStandardMaterial color="#ecf0f1" metalness={0.8} />
            </mesh>
          ))}
        </group>
      )}
      
      {style === 'bio-integrated' && (
        <group>
          {/* Dome */}
          <mesh>
            <sphereGeometry args={[width * 0.4, 16, 16]} />
            <meshStandardMaterial color="#2ecc71" transparent opacity={0.7} />
          </mesh>
          {/* Vertical gardens */}
          {Array.from({ length: 8 }).map((_, i) => (
            <group key={`garden-${i}`}>
              <mesh position={[
                -width / 2 + 1 + i * 3.5,
                0,
                0
              ]}>
                <boxGeometry args={[1.5, height * 0.7, 1.5]} />
                <meshStandardMaterial color="#27ae60" opacity={0.5} transparent />
              </mesh>
              {/* Plant details */}
              {Array.from({ length: 10 }).map((_, j) => (
                <mesh key={`plant-${j}`} position={[
                  -width / 2 + 1 + i * 3.5,
                  height * 0.35 - j * 0.5,
                  0
                ]}>
                  <sphereGeometry args={[0.3, 8, 8]} />
                  <meshStandardMaterial color="#2ecc71" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )}
    </group>
  )
}