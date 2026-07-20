import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { extend } from '@react-three/fiber'
import type { Era } from '../App'

// Extend Three.js primitives for JSX
extend({ Group: THREE.Group, Mesh: THREE.Mesh, BoxGeometry: THREE.BoxGeometry, MeshStandardMaterial: THREE.MeshStandardMaterial, CylinderGeometry: THREE.CylinderGeometry, SphereGeometry: THREE.SphereGeometry, CapsuleGeometry: THREE.CapsuleGeometry })

interface BuildingBlockProps {
  position: [number, number, number]
  era: Era
}

export const BuildingBlock: React.FC<BuildingBlockProps> = ({ position, era }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const prevEraRef = useRef<Era>(era)

  // Era-specific building styles
  const eraStyles = useMemo(() => {
    return {
      1945: {
        baseColor: '#8b7355',
        windowColor: '#add8e6',
        windowStyle: 'simple',
        hasDetail: true,
        heightVariation: 0.7,
        facadeStyle: 'brick',
      },
      1965: {
        baseColor: '#a9a9a9',
        windowColor: '#87ceeb',
        windowStyle: 'modern',
        hasDetail: true,
        heightVariation: 0.8,
        facadeStyle: 'concrete',
      },
      1985: {
        baseColor: '#202020',
        windowColor: '#00ffff',
        windowStyle: 'neon',
        hasDetail: true,
        heightVariation: 1.2,
        facadeStyle: 'glass',
      },
      2005: {
        baseColor: '#4682b4',
        windowColor: '#ffffff',
        windowStyle: 'reflective',
        hasDetail: true,
        heightVariation: 1,
        facadeStyle: 'glass',
      },
      2025: {
        baseColor: '#5f9ea0',
        windowColor: '#e0ffff',
        windowStyle: 'smart',
        hasDetail: true,
        heightVariation: 1.5,
        facadeStyle: 'smart_glass',
      },
      2055: {
        baseColor: '#0a0a2a',
        windowColor: '#00ffff',
        windowStyle: 'holographic',
        hasDetail: true,
        heightVariation: 2,
        facadeStyle: 'energy',
      },
    }[era]
  }, [era])

  // Animate building transitions
  useFrame(() => {
    if (prevEraRef.current !== era && groupRef.current) {
      gsap.to(groupRef.current.scale, {
        y: 1.1,
        duration: 1.5,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      })
      gsap.to(groupRef.current.rotation, {
        y: groupRef.current.rotation.y + (Math.random() - 0.5) * 0.2,
        duration: 2,
        ease: 'power2.inOut',
      })
    }
    prevEraRef.current = era
  })

  // Generate 2x2 grid of buildings
  const buildings = useMemo(() => {
    const items: React.ReactNode[] = []

    for (let i = 0; i < 4; i++) {
      const width = 15 + Math.random() * 10
      const height = 20 + Math.random() * 30 * eraStyles.heightVariation
      const depth = 15 + Math.random() * 10

      items.push(
        <Building
          key={i}
          position={[
            (i % 2 - 0.5) * 22,
            0,
            (Math.floor(i / 2) - 0.5) * 22,
          ]}
          dimensions={[width, height, depth]}
          era={era}
          eraStyles={eraStyles}
          type={['residential', 'commercial', 'mixed'][i % 3]}
        />
      )
    }

    return items
  }, [era, eraStyles])

  return (
    <group ref={groupRef} position={position}>
      {buildings}
    </group>
  )
}

interface BuildingProps {
  position: [number, number, number]
  dimensions: [number, number, number]
  era: Era
  eraStyles: ReturnType<typeof BuildingBlock> extends { eraStyles: infer S } ? S : never
  type: string
}

const Building: React.FC<BuildingProps> = ({ position, dimensions, era, eraStyles, type }) => {
  const { width, height, depth } = { width: dimensions[0], height: dimensions[1], depth: dimensions[2] }

  return (
    <group position={position}>
      {/* Main building structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={eraStyles.baseColor}
          roughness={era === 2055 ? 0.1 : 0.7}
          metalness={era === 2055 ? 0.9 : 0.3}
          emissive={era === 2055 ? '#00ffff' : '#000000'}
          emissiveIntensity={era === 2055 ? 0.2 : 0}
        />
      </mesh>

      {/* Windows - front face */}
      {Array.from({ length: Math.floor(height / 3) }).map((_, y) =>
        Array.from({ length: Math.floor(width / 2) }).map((_, x) => (
          <Window
            key={`${x}-${y}`}
            position={[
              -width / 2 + 1 + x * 2.5,
              -height / 2 + 2 + y * 3,
              depth / 2 + 0.01,
            ]}
            era={era}
            eraStyles={eraStyles}
          />
        ))
      )}

      {/* Windows - side face */}
      {Array.from({ length: Math.floor(height / 3) }).map((_, y) =>
        Array.from({ length: Math.floor(depth / 2) }).map((_, z) => (
          <Window
            key={`side-${z}-${y}`}
            position={[
              -width / 2 - 0.01,
              -height / 2 + 2 + y * 3,
              -depth / 2 + 1 + z * 2.5,
            ]}
            era={era}
            eraStyles={eraStyles}
            rotation-y={Math.PI / 2}
          />
        ))
      )}

      {/* Roof details */}
      {era === 2055 ? (
        <mesh position={[0, height / 2 + 0.5, 0]}>
          <boxGeometry args={[width + 2, 1, depth + 2]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={0.5}
            roughness={0.1}
            metalness={1}
          />
        </mesh>
      ) : (
        <mesh position={[0, height / 2 + 0.2, 0]}>
          <boxGeometry args={[width + 1, 0.4, depth + 1]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      )}

      {/* Entrance/Door */}
      <mesh position={[0, -height / 2 + 1.5, depth / 2 + 0.3]}>
        <boxGeometry args={[4, 3, 0.6]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

interface WindowProps {
  position: [number, number, number]
  era: Era
  eraStyles: typeof BuildingBlock extends { eraStyles: infer S } ? S : never
  'rotation-y'?: number
}

const Window: React.FC<WindowProps> = ({ position, era, eraStyles, 'rotation-y': rotationY }) => {
  const windowStyles = {
    1945: {
      color: eraStyles.windowColor,
      emissive: '#000000',
      emissiveIntensity: 0,
      size: [1.5, 2],
    },
    1965: {
      color: eraStyles.windowColor,
      emissive: '#000000',
      emissiveIntensity: 0,
      size: [1.8, 2.2],
    },
    1985: {
      color: eraStyles.windowColor,
      emissive: '#00ffff',
      emissiveIntensity: 0.8,
      size: [1.5, 2.5],
    },
    2005: {
      color: eraStyles.windowColor,
      emissive: '#ffffff',
      emissiveIntensity: 0.3,
      size: [2, 2.5],
    },
    2025: {
      color: eraStyles.windowColor,
      emissive: '#e0ffff',
      emissiveIntensity: 0.5,
      size: [1.5, 2],
    },
    2055: {
      color: eraStyles.windowColor,
      emissive: '#00ffff',
      emissiveIntensity: 1,
      size: [1, 1.5],
    },
  }

  const style = windowStyles[era]

  return (
    <mesh position={position} rotation-y={rotationY}>
      <boxGeometry args={[...style.size, 0.1]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.emissive}
        emissiveIntensity={style.emissiveIntensity}
        transparent
        opacity={era === 2055 ? 0.7 : 0.9}
      />
    </mesh>
  )
}