import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EraStyles } from '../lib/eraStyles'

interface BuildingProps {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  type: 'office' | 'residential' | 'skyscraper' | 'mall'
  eraStyles: EraStyles
}

export function Building({ position, width, height, depth, type, eraStyles }: BuildingProps) {
  const meshRef = useRef<THREE.Group>(null!)
  const windowCount = Math.floor(width * depth * height * 0.3)

  const buildingGeometry = useMemo(() => {
    switch (eraStyles.architecturalStyle) {
      case 'traditional':
        // Brick buildings with simple windows
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Simple windows */}
            {Array.from({ length: Math.floor(width * 2) }).map((_, i) =>
              Array.from({ length: Math.floor(height * 2) }).map((_, j) => {
                const x = -width / 2 + (i + 1) * (width / (Math.floor(width * 2) + 1))
                const y = -height / 2 + (j + 1) * (height / (Math.floor(height * 2) + 1))
                const z = depth / 2 + 0.01
                return (
                  <mesh key={`${i}-${j}`} position={[x, y, z]}>
                    <planeGeometry args={[0.5, 0.8]} />
                    <meshStandardMaterial color={eraStyles.windowColors[0]} />
                  </mesh>
                )
              })
            )}
          </group>
        )
      
      case 'modernist':
        // Glass curtain walls
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} transparent opacity={0.3} />
            </mesh>
            <mesh castShadow position={[0, 0, depth / 2 + 0.05]}>
              <boxGeometry args={[width - 0.1, height - 0.1, 0.2]} />
              <meshStandardMaterial 
                color={eraStyles.windowColors[0]} 
                transparent 
                opacity={0.6}
              />
            </mesh>
          </group>
        )

      case 'brutalist':
        // Raw concrete with recessed windows
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Recessed windows in grid pattern */}
            {Array.from({ length: Math.floor(width * 1.5) }).map((_, i) =>
              Array.from({ length: Math.floor(height * 1.5) }).map((_, j) => {
                const x = -width / 2 + (i + 1) * (width / (Math.floor(width * 1.5) + 1))
                const y = -height / 2 + (j + 1) * (height / (Math.floor(height * 1.5) + 1))
                const z = depth / 2 - 0.3
                return (
                  <mesh key={`brut-${i}-${j}`} position={[x, y, z]}>
                    <boxGeometry args={[0.4, 0.6, 0.2]} />
                    <meshStandardMaterial color={eraStyles.windowColors[1]} />
                  </mesh>
                )
              })
            )}
          </group>
        )

      case 'postmodern':
        // Mixed materials with varied window shapes
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Varied windows */}
            {Array.from({ length: Math.floor(width * 1.5) }).map((_, i) =>
              Array.from({ length: Math.floor(height * 1.5) }).map((_, j) => {
                const x = -width / 2 + (i + 1) * (width / (Math.floor(width * 1.5) + 1))
                const y = -height / 2 + (j + 1) * (height / (Math.floor(height * 1.5) + 1))
                const z = depth / 2 + 0.02
                const rand = Math.random()
                const winWidth = rand > 0.7 ? 0.7 : rand > 0.3 ? 0.4 : 0.6
                const winHeight = rand > 0.7 ? 1.0 : rand > 0.3 ? 0.6 : 0.8
                return (
                  <mesh key={`post-${i}-${j}`} position={[x, y, z]}>
                    <planeGeometry args={[winWidth, winHeight]} />
                    <meshStandardMaterial color={eraStyles.windowColors[(i + j) % eraStyles.windowColors.length]} opacity={0.7} transparent />
                  </mesh>
                )
              })
            )}
          </group>
        )

      case 'contemporary':
        // Glass and steel with balconies
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Modern windows with balcony railings */}
            {Array.from({ length: Math.floor(width) }).map((_, i) =>
              Array.from({ length: Math.floor(height / 2) }).map((_, j) => {
                const x = -width / 2 + (i + 1) * (width / (Math.floor(width) + 1))
                const y = -height / 2 + (j + 1) * (height / (Math.floor(height / 2) + 1))
                const z = depth / 2 + 0.02
                return (
                  <group key={`cont-${i}-${j}`}>
                    <mesh position={[x, y, z]}>
                      <planeGeometry args={[0.6, 1.2]} />
                      <meshStandardMaterial color={eraStyles.windowColors[(i + j) % eraStyles.windowColors.length]} transparent opacity={0.6} />
                    </mesh>
                    {/* Balcony railing for some floors */}
                    {Math.random() > 0.6 && (
                      <mesh position={[x, y - 0.7, depth / 2 + 0.3]}>
                        <boxGeometry args={[0.8, 0.05, 0.05]} />
                        <meshStandardMaterial color="#CCCCCC" />
                      </mesh>
                    )}
                  </group>
                )
              })
            )}
          </group>
        )

      case 'futuristic':
        // Holographic surfaces with LED accents
        return (
          <group>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial 
                color={eraStyles.buildingColors[0]} 
                emissive={eraStyles.buildingColors[0]}
                emissiveIntensity={0.2}
              />
            </mesh>
            {/* Neon window strips */}
            {Array.from({ length: Math.floor(width * 2) }).map((_, i) =>
              Array.from({ length: Math.floor(height * 3) }).map((_, j) => {
                const x = -width / 2 + (i + 1) * (width / (Math.floor(width * 2) + 1))
                const y = -height / 2 + (j + 1) * (height / (Math.floor(height * 3) + 1))
                const z = depth / 2 + 0.05
                return (
                  <mesh key={`fut-${i}-${j}`} position={[x, y, z]}>
                    <planeGeometry args={[0.3, 0.2]} />
                    <meshStandardMaterial 
                      color={eraStyles.windowColors[(i + j) % eraStyles.windowColors.length]}
                      emissive={eraStyles.windowColors[(i + j) % eraStyles.windowColors.length]}
                      emissiveIntensity={0.8}
                    />
                  </mesh>
                )
              })
            )}
          </group>
        )
    }
  }, [width, height, depth, eraStyles])

  return (
    <group ref={meshRef} position={position}>
      {buildingGeometry}
    </group>
  )
}