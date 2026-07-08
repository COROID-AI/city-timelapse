/**
 * Street - Road and sidewalk surfaces with era-appropriate materials
 */

import React from 'react'
import * as THREE from 'three'
import type { EraId } from '../eras'

interface StreetProps {
  era: EraId
  colors: {
    building: string
    window: string
    road: string
    sidewalk: string
    signage: string
  }
}

export function Street({ era, colors }: StreetProps) {
  return (
    <group>
      {/* Main road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color={colors.road}
          metalness={era === '2055' ? 0.8 : 0.3}
          roughness={era === '1945' ? 0.8 : 0.5}
        />
      </mesh>

      {/* Sidewalks */}
      {Array.from({ length: 4 }).map((_, i) => {
        const pos: [number, number, number] =
          i === 0
            ? [-17.5, 0, 0]
            : i === 1
            ? [17.5, 0, 0]
            : i === 2
            ? [0, 0, -17.5]
            : [0, 0, 17.5]
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={pos} receiveShadow>
            <planeGeometry args={[5, 30]} />
            <meshStandardMaterial
              color={colors.sidewalk}
              metalness={0.2}
              roughness={0.7}
            />
          </mesh>
        )
      })}

      {/* Road markings - era appropriate */}
      <RoadMarkings era={era} roadColor={colors.road} />
    </group>
  )
}

function RoadMarkings({ era, roadColor }: { era: EraId; roadColor: string }) {
  const getMarkings = () => {
    switch (era) {
      case '1945':
        return (
          <group>
            {/* Simple center line */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[0.5, 30]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>
        )
      case '1965':
        return (
          <group>
            {/* Double yellow lines */}
            {[-1, 1].map((offset) => (
              <mesh key={offset} rotation={[-Math.PI / 2, 0, 0]} position={[offset, 0.01, 0]}>
                <planeGeometry args={[0.3, 30]} />
                <meshStandardMaterial color="#FFFF00" />
              </mesh>
            ))}
          </group>
        )
      case '1985':
        return (
          <group>
            {/* Bold white stripes */}
            {Array.from({ length: 10 }).map((_, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -12 + i * 2.5]}>
                <planeGeometry args={[2, 1]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  emissive="#FFFFFF"
                  emissiveIntensity={0.2}
                />
              </mesh>
            ))}
          </group>
        )
      case '2005':
        return (
          <group>
            {/* Reflective markings */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[0.5, 30]} />
              <meshStandardMaterial
                color="#FFFFFF"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          </group>
        )
      case '2025':
        return (
          <group>
            {/* Smart road with LED strips */}
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-12 + i * 6, 0.01, 0]}>
                <planeGeometry args={[0.3, 30]} />
                <meshStandardMaterial
                  color="#32CD32"
                  emissive="#32CD32"
                  emissiveIntensity={0.3}
                />
              </mesh>
            ))}
          </group>
        )
      case '2055':
        return (
          <group>
            {/* Glowing energy roads */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <planeGeometry args={[30, 30]} />
              <meshStandardMaterial
                color={roadColor}
                emissive="#9370DB"
                emissiveIntensity={0.4}
                transparent
                opacity={0.8}
              />
            </mesh>
          </group>
        )
    }
  }

  return <group>{getMarkings()}</group>
}