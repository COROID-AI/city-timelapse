import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Era } from '../types/era'
import { ERA_CONFIGS } from '../types/era'
import * as THREE from 'three'

interface BuildingProps {
  position: [number, number, number]
  era: Era
  transitionProgress: number
}

export function Building({ position, era, transitionProgress }: BuildingProps) {
  const meshRef = useRef<THREE.Group>(null)
  const prevEraRef = useRef<Era>(era)

  const config = ERA_CONFIGS[era]

  // Generate random building dimensions based on era
  const dimensions = useMemo(() => {
    const width = 6 + Math.random() * 3
    const depth = 6 + Math.random() * 3
    const height = config.buildingStyle.minHeight + Math.random() * (config.buildingStyle.maxHeight - config.buildingStyle.minHeight)
    return { width, depth, height }
  }, [era, config.buildingStyle.minHeight, config.buildingStyle.maxHeight])

  // Generate window layout
  const windows = useMemo(() => {
    const rows = Math.floor(dimensions.height / 2)
    const cols = 5
    const items = []
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isLit = era !== '1985' && Math.random() > 0.2
        items.push({
          row,
          col,
          isLit,
          x: (col - cols / 2 + 0.5) * (dimensions.width / cols),
          y: (row - rows / 2 + 0.5) * (dimensions.height / rows),
          z: dimensions.depth / 2 + 0.01,
        })
      }
    }
    return items
  }, [dimensions.height, dimensions.width, dimensions.depth, era, config.buildingStyle.maxHeight])

  // Animate transition
  useFrame(() => {
    if (meshRef.current && transitionProgress > 0 && transitionProgress < 1) {
      const progress = transitionProgress
      const scale = THREE.MathUtils.lerp(1, 1.1, Math.sin(progress * Math.PI))
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  useEffect(() => {
    prevEraRef.current = era
  }, [era])

  return (
    <group ref={meshRef} position={position} castShadow receiveShadow>
      {/* Main building structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial
          color={config.buildingStyle.facadeColor}
          roughness={era === '2055' ? 0.1 : 0.8}
          metalness={era === '2055' ? 0.8 : 0.1}
        />
      </mesh>

      {/* Roof details */}
      <mesh position={[0, dimensions.height / 2 + 0.1, 0]}>
        <boxGeometry args={[dimensions.width + 0.5, 0.2, dimensions.depth + 0.5]} />
        <meshStandardMaterial color={config.buildingStyle.roofColor} />
      </mesh>

      {/* Windows */}
      {windows.map((window, i) => (
        <mesh
          key={`window-${i}`}
          position={[window.x, window.y, window.z]}
        >
          <planeGeometry args={[0.8, 1.2]} />
          <meshStandardMaterial
            color={window.isLit ? (era === '1945' || era === '1965' ? '#FFE082' : '#4FC3F7') : '#111111'}
            emissive={window.isLit ? (era === '1945' || era === '1965' ? '#FFE082' : '#4FC3F7') : '#000000'}
            emissiveIntensity={window.isLit ? 0.8 : 0}
          />
        </mesh>
      ))}

      {/* Era-specific details */}
      {era === '1945' && (
        <>
          {/* Fire escape */}
          <mesh position={[-dimensions.width / 2 + 0.3, 0, 0]}>
            <boxGeometry args={[0.2, dimensions.height, 0.2]} />
            <meshStandardMaterial color="#5D4037" />
          </mesh>
        </>
      )}

      {era === '2055' && (
        <>
          {/* Holographic facade panels */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh
              key={`holo-${i}`}
              position={[
                (i % 2 - 0.5) * dimensions.width * 0.3,
                (Math.floor(i / 2) - 0.5) * dimensions.height * 0.3,
                dimensions.depth / 2 + 0.02,
              ]}
            >
              <planeGeometry args={[dimensions.width * 0.4, dimensions.height * 0.4]} />
              <meshStandardMaterial
                color="#00E5FF"
                emissive="#00E5FF"
                emissiveIntensity={0.3}
                transparent
                opacity={0.6}
              />
            </mesh>
          ))}
          {/* LED strips on corners */}
          <mesh position={[0, -dimensions.height / 2 + 1, 0]}>
            <boxGeometry args={[dimensions.width + 0.1, 0.1, 0.3]} />
            <meshStandardMaterial
              color="#00FF00"
              emissive="#00FF00"
              emissiveIntensity={0.5}
            />
          </mesh>
        </>
      )}
    </group>
  )
}