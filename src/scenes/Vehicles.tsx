import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { EraPalette } from '../eras'
import { useAppStore } from '../state'

interface VehiclesProps {
  palette: EraPalette
}

export function Vehicles({ palette }: VehiclesProps) {
  const { eraId } = useAppStore()
  const groupRef = useRef<THREE.Group>(null)

  // Determine vehicle count and colors by era
  const count = eraId === '1945' ? 3 : eraId === '1965' ? 5 : eraId === '1985' ? 8 : eraId === '2005' ? 10 : eraId === '2025' ? 12 : 15

  const vehicles = useMemo(() => {
    const list: { pos: [number, number, number]; rotY: number; color: string; scale: number; speed: number }[] = []
    const colors = [palette.neonAccent, '#ffffff', '#ffff00', '#ff4444', '#4444ff', palette.windowEmissive]
    for (let i = 0; i < count; i++) {
      const onNorth = Math.random() > 0.5
      const lane = onNorth ? -6 + (i % 3) * 3 : 6 - (i % 3) * 3
      const startZ = onNorth ? -30 - Math.random() * 10 : 30 + Math.random() * 10
      list.push({
        pos: [lane, 0.4, startZ],
        rotY: onNorth ? 0 : Math.PI,
        color: colors[i % colors.length],
        scale: 0.6 + Math.random() * 0.4,
        speed: 2 + Math.random() * 3,
      })
    }
    return list
  }, [count, palette])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const speedMult = eraId === '1945' ? 0.3 : eraId === '1965' ? 0.5 : eraId === '1985' ? 1.0 : 1.5
    groupRef.current.children.forEach((child, i) => {
      const v = vehicles[i]
      if (!v) return
      // Move vehicles along their lane
      const dir = v.rotY === 0 ? 1 : -1
      child.position.z += dir * v.speed * speedMult * delta * 10
      // Loop vehicles
      if (v.rotY === 0 && child.position.z > 35) child.position.z = -35
      if (v.rotY === Math.PI && child.position.z < -35) child.position.z = 35
      child.position.y = v.pos[1]
    })
  })

  return (
    <group ref={groupRef}>
      {vehicles.map((v, i) => (
        <mesh key={i} position={v.pos} rotation={[0, v.rotY, 0]} scale={[v.scale, v.scale, v.scale * 0.6]} castShadow>
          <boxGeometry args={[1.8, 0.6, 3.5]} />
          <meshStandardMaterial
            attach="material"
            color={v.color}
            roughness={0.3}
            metalness={0.7}
            emissive={v.color}
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}
    </group>
  )
}