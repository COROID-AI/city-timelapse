import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { EraPalette } from '../eras'

interface GroundProps {
  palette: EraPalette
}

export function Ground({ palette }: GroundProps) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial attach="material" color={palette.groundTint} roughness={0.9} metalness={0.1} />
      </mesh>
      <RoadSegment width={16} length={200} position={[0, 0.01, 0]} color={palette.roadColor} />
      <RoadSegment width={200} length={16} position={[0, 0.01, 0]} color={palette.roadColor} rotation={[0, Math.PI / 2, 0]} />
      <RoadSegment width={3.5} length={200} position={[-8, 0.015, 0]} color={palette.sidewalkColor} />
      <RoadSegment width={3.5} length={200} position={[8, 0.015, 0]} color={palette.sidewalkColor} />
      <RoadSegment width={200} length={3.5} position={[0, 0.015, -8]} color={palette.sidewalkColor} />
      <RoadSegment width={200} length={3.5} position={[0, 0.015, 8]} color={palette.sidewalkColor} />
    </group>
  )
}

function RoadSegment({ width, length, position, rotation, color }: {
  width: number; length: number; position: [number, number, number]; rotation?: [number, number, number]; color: string
}) {
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]} receiveShadow>
      <planeGeometry args={[Math.max(0.01, width), Math.max(0.01, length)]} />
      <meshStandardMaterial attach="material" color={color} roughness={0.85} metalness={0.15} />
    </mesh>
  )
}