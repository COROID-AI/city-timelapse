/**
 * BuildingRow - Row of buildings with era-appropriate architecture
 */

import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraId } from '../eras'

interface BuildingRowProps {
  era: EraId
  position: [number, number, number]
  rotation: [number, number, number]
  colors: {
    building: string
    window: string
    road: string
    sidewalk: string
    signage: string
  }
}

export function BuildingRow({ era, position, rotation, colors }: BuildingRowProps) {
  const buildings = useMemo(() => {
    const count = 8
    const items = []
    for (let i = 0; i < count; i++) {
      items.push({
        id: `building-${i}`,
        height: 3 + Math.random() * 8,
        width: 4 + Math.random() * 3,
        depth: 6 + Math.random() * 4,
        x: (i - count / 2 + 0.5) * 8,
        hasDetails: Math.random() > 0.3,
        eraModifier: Math.random() * 0.3, // Variation per building
      })
    }
    return items
  }, [])

  return (
    <group position={position} rotation={rotation}>
      {buildings.map((building, index) => (
        <EraBuilding
          key={building.id}
          {...building}
          era={era}
          colors={colors}
          index={index}
        />
      ))}
    </group>
  )
}

interface EraBuildingProps {
  id: string
  height: number
  width: number
  depth: number
  x: number
  hasDetails: boolean
  eraModifier: number
  era: EraId
  colors: {
    building: string
    window: string
    road: string
    sidewalk: string
    signage: string
  }
  index: number
}

function EraBuilding({
  id,
  height,
  width,
  depth,
  x,
  hasDetails,
  eraModifier,
  era,
  colors,
}: EraBuildingProps) {
  const getArchitectureStyle = () => {
    const baseHeight = height
    const baseWidth = width
    const baseDepth = depth

    switch (era) {
      case '1945':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Art Deco stepped crown */}
              <mesh position={[0, baseHeight / 2 + 1.5, 0]}>
                <boxGeometry args={[baseWidth + 0.5, 1, baseDepth + 0.5]} />
                <meshStandardMaterial color={colors.signage} metalness={0.6} roughness={0.4} />
              </mesh>
              {/* Decorative setbacks */}
              {Array.from({ length: 3 }).map((_, i) => (
                <mesh key={i} position={[0, baseHeight / 2 - i * 2, 0]}>
                  <boxGeometry args={[baseWidth - i * 0.5, 2, baseDepth - i * 0.5]} />
                  <meshStandardMaterial color={colors.building} metalness={0.5} roughness={0.5} />
                </mesh>
              ))}
            </group>
          ) : null,
          windowPattern: 'grid',
        }
      case '1965':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Mid-century modern windows */}
              <mesh position={[0, 0, baseDepth / 2 + 0.01]}>
                <planeGeometry args={[baseWidth, baseHeight]} />
                <meshStandardMaterial
                  color={colors.window}
                  emissive={colors.window}
                  emissiveIntensity={0.2}
                />
              </mesh>
              {/* Space-age antenna */}
              <mesh position={[0, baseHeight / 2 + 2, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 3]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          ) : null,
          windowPattern: 'curtain_wall',
        }
      case '1985':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Brutalist concrete with neon */}
              <NeonAccents baseWidth={baseWidth} baseHeight={baseHeight} baseDepth={baseDepth} />
              {/* Geometric protrusions */}
              {Array.from({ length: 2 }).map((_, i) => (
                <mesh key={i} position={[i % 2 === 0 ? 1 : -1, baseHeight / 2 - 2, 0]}>
                  <boxGeometry args={[1, 3, 1]} />
                  <meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={0.5} />
                </mesh>
              ))}
            </group>
          ) : null,
          windowPattern: 'neon_grid',
        }
      case '2005':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Glass curtain wall with reflective surfaces */}
              <mesh position={[0, 0, baseDepth / 2 + 0.01]}>
                <planeGeometry args={[baseWidth, baseHeight]} />
                <meshStandardMaterial
                  color={colors.window}
                  metalness={0.8}
                  roughness={0.1}
                  transparent
                  opacity={0.7}
                />
              </mesh>
              {/* LCD billboard */}
              <Billboard baseWidth={baseWidth} />
            </group>
          ) : null,
          windowPattern: 'glass_facade',
        }
      case '2025':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Green building with solar panels */}
              <SolarPanels baseWidth={baseWidth} baseHeight={baseHeight} />
              {/* Living wall */}
              <LivingWall baseWidth={baseWidth} baseHeight={baseHeight} baseDepth={baseDepth} />
            </group>
          ) : null,
          windowPattern: 'eco_glass',
        }
      case '2055':
        return {
          mainGeometry: <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />,
          details: hasDetails ? (
            <group>
              {/* Biotech organic forms - pulsating bio-lights */}
              <BioLights baseWidth={baseWidth} baseHeight={baseHeight} baseDepth={baseDepth} />
              {/* Organic curved surfaces */}
              <OrganicFacade baseWidth={baseWidth} baseHeight={baseHeight} baseDepth={baseDepth} />
            </group>
          ) : null,
          windowPattern: 'bio_luminescent',
        }
    }
  }

  const style = getArchitectureStyle()

  return (
    <group position={[x, height / 2, 0]}>
      {/* Main building structure */}
      <mesh castShadow receiveShadow>
        <primitive object={new THREE.BoxGeometry(width, height, depth)} />
        <meshStandardMaterial
          color={colors.building}
          metalness={0.6}
          roughness={0.4}
          displacementScale={eraModifier * 0.5}
        />
      </mesh>

      {/* Windows - era appropriate patterns */}
      <WindowGrid
        era={era}
        width={width}
        height={height}
        depth={depth}
        colors={colors}
        pattern={style.windowPattern}
      />

      {/* Era-specific details */}
      {style.details}

      {/* Storefront ground floor */}
      <Storefront
        era={era}
        width={width}
        depth={depth}
        colors={colors}
      />
    </group>
  )
}

function WindowGrid({
  era,
  width,
  height,
  depth,
  colors,
  pattern,
}: {
  era: EraId
  width: number
  height: number
  depth: number
  colors: any
  pattern: string
}) {
  const windowPositions = useMemo(() => {
    const positions: [number, number, number, string][] = []
    const rows = Math.floor(height / 1.5)
    const cols = Math.floor(width / 1.2)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions.push([
          -width / 2 + col * 1.2 + 0.6,
          -height / 2 + row * 1.5 + 0.75,
          depth / 2 + 0.01,
          pattern,
        ])
      }
    }
    return positions
  }, [width, height, depth, pattern])

  return (
    <group>
      {windowPositions.map(([x, y, z, pat], i) => {
        let windowMaterial
        switch (era) {
          case '2055':
            windowMaterial = (
              <meshStandardMaterial
                color={colors.window}
                emissive={colors.window}
                emissiveIntensity={0.3}
                transparent
                opacity={0.8}
              />
            )
            break
          case '2025':
            windowMaterial = (
              <meshStandardMaterial
                color={colors.window}
                metalness={0.8}
                roughness={0.1}
                transparent
                opacity={0.6}
              />
            )
            break
          default:
            windowMaterial = <meshStandardMaterial color={colors.window} />
        }

        return (
          <mesh key={i} position={[x, y, z]}>
            <planeGeometry args={[1, 1]} />
            {windowMaterial}
          </mesh>
        )
      })}
    </group>
  )
}

function Storefront({
  era,
  width,
  depth,
  colors,
}: {
  era: EraId
  width: number
  depth: number
  colors: any
}) {
  const getSignage = () => {
    switch (era) {
      case '1945':
        return (
          <group>
            <mesh position={[0, 0.5, depth / 2 + 0.02]}>
              <planeGeometry args={[width * 0.8, 1]} />
              <meshStandardMaterial color={colors.signage} />
            </mesh>
          </group>
        )
      case '1965':
        return (
          <group>
            <mesh position={[-width / 4, 0.5, depth / 2 + 0.02]}>
              <planeGeometry args={[width / 3, 1.5]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
            </mesh>
          </group>
        )
      case '1985':
        return (
          <group>
            <NeonSign depth={depth} />
          </group>
        )
      case '2005':
        return (
          <group>
            <LCDSign depth={depth} />
          </group>
        )
      case '2025':
        return (
          <group>
            <EcoSign depth={depth} />
          </group>
        )
      case '2055':
        return (
          <group>
            <BioSign depth={depth} />
          </group>
        )
    }
  }

  return (
    <group>
      {/* Shop front */}
      <mesh position={[0, 1, depth / 2 + 0.01]}>
        <planeGeometry args={[width, 2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {getSignage()}
    </group>
  )
}

function NeonAccents({ baseWidth, baseHeight, baseDepth }: { baseWidth: number; baseHeight: number; baseDepth: number }) {
  return (
    <group>
      {['pink', 'cyan', 'purple'].map((color, i) => (
        <mesh key={i} position={[0, baseHeight / 2 - i * 3, baseDepth / 2 + 0.02]}>
          <boxGeometry args={[baseWidth * 0.8, 0.2, 0.1]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}

function Billboard({ baseWidth }: { baseWidth: number }) {
  return (
    <mesh position={[0, 2, 0.1]}>
      <boxGeometry args={[baseWidth * 0.6, 2, 0.2]} />
      <meshStandardMaterial color="#00BFFF" />
    </mesh>
  )
}

function SolarPanels({ baseWidth, baseHeight }: { baseWidth: number; baseHeight: number }) {
  return (
    <group>
      <mesh position={[0, baseHeight / 2 + 0.5, 0]}>
        <boxGeometry args={[baseWidth - 1, 0.2, baseWidth - 1]} />
        <meshStandardMaterial color="#2F4F4F" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

function LivingWall({ baseWidth, baseHeight, baseDepth }: { baseWidth: number; baseHeight: number; baseDepth: number }) {
  return (
    <mesh position={[0, 0, baseDepth / 2 + 0.02]}>
      <planeGeometry args={[baseWidth, baseHeight]} />
      <meshStandardMaterial color="#228B22" />
    </mesh>
  )
}

function BioLights({ baseWidth, baseHeight, baseDepth }: { baseWidth: number; baseHeight: number; baseDepth: number }) {
  const ref = React.useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.5 + 0.5
      ref.current.traverse((obj) => {
        if ((obj as THREE.Mesh).material) {
          const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (material.emissive) {
            material.emissiveIntensity = pulse * 0.5
          }
        }
      })
    }
  })

  return (
    <group ref={ref}>
      <mesh position={[0, baseHeight / 2, baseDepth / 2 + 0.02]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color="#DDA0DD"
          emissive="#DDA0DD"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

function OrganicFacade({ baseWidth, baseHeight, baseDepth }: { baseWidth: number; baseHeight: number; baseDepth: number }) {
  return (
    <mesh position={[0, 0, -baseDepth / 2 - 0.1]}>
      <sphereGeometry args={[Math.max(baseWidth, baseHeight) * 0.7, 16, 16]} />
      <meshStandardMaterial color="#9370DB" transparent opacity={0.7} />
    </mesh>
  )
}

function NeonSign({ depth }: { depth: number }) {
  const ref = React.useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      const flicker = Math.sin(clock.getElapsedTime() * 10) * 0.3 + 0.7
      ref.current.traverse((obj) => {
        if ((obj as THREE.Mesh).material) {
          const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (material.emissive) {
            material.emissiveIntensity = flicker
          }
        }
      })
    }
  })

  return (
    <group ref={ref}>
      <mesh position={[0, 1, depth + 0.02]}>
        <boxGeometry args={[3, 1.5, 0.1]} />
        <meshStandardMaterial
          color="#FF00FF"
          emissive="#FF00FF"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  )
}

function LCDSign({ depth }: { depth: number }) {
  const ref = React.useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      // Simulate LCD screen animation
      const hue = (clock.getElapsedTime() * 0.1) % 1
      const color = new THREE.Color().setHSL(hue, 0.5, 0.5)
      ref.current.traverse((obj) => {
        if ((obj as THREE.Mesh).material) {
          const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
          material.color = color
        }
      })
    }
  })

  return (
    <group ref={ref}>
      <mesh position={[0, 1, depth + 0.02]}>
        <boxGeometry args={[3, 1.5, 0.1]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function EcoSign({ depth }: { depth: number }) {
  return (
    <mesh position={[0, 1, depth + 0.02]}>
      <boxGeometry args={[3, 1.5, 0.1]} />
      <meshStandardMaterial color="#32CD32" emissive="#32CD32" emissiveIntensity={0.4} />
    </mesh>
  )
}

function BioSign({ depth }: { depth: number }) {
  const ref = React.useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = Math.sin(clock.getElapsedTime() * 1.5) * 0.3 + 0.7
      ref.current.traverse((obj) => {
        if ((obj as THREE.Mesh).material) {
          const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (material.emissive) {
            material.emissiveIntensity = pulse
          }
        }
      })
    }
  })

  return (
    <group ref={ref}>
      <mesh position={[0, 1, depth + 0.02]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#9370DB" emissive="#9370DB" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}