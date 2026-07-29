import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { EraPalette } from '../eras'
import { useAppStore } from '../state'

interface PedestriansProps {
  palette: EraPalette
  count: number
}

export function Pedestrians({ palette, count }: PedestriansProps) {
  const { eraId } = useAppStore()
  const groupRef = useRef<THREE.Group>(null)

  const peds = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30,
      ),
      target: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30,
      ),
      speed: 1 + Math.random() * 2,
      idx: i,
    }))
  }, [count])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const speedMult = eraId === '1945' ? 0.3 : eraId === '1965' ? 0.5 : eraId === '1985' ? 1.0 : eraId === '2005' ? 1.2 : 1.5
    groupRef.current.children.forEach((child, i) => {
      const ped = peds[i]
      if (!ped) return
      const mesh = child as THREE.Mesh
      const dir = ped.target.clone().sub(mesh.position)
      const dist = dir.length()
      if (dist < 0.5) {
        ped.target.set(
          (Math.random() - 0.5) * 30,
          0.5,
          (Math.random() - 0.5) * 30,
        )
        dir.set(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2,
        )
      }
      dir.normalize()
      mesh.position.add(dir.multiplyScalar(ped.speed * speedMult * delta * 3))
      mesh.position.y = 0.5
    })
  })

  return (
    <group ref={groupRef}>
      {peds.map((p, i) => (
        <mesh key={i} position={p.pos} castShadow>
          <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
          <meshStandardMaterial
            attach="material"
            color={palette.windowColor}
            emissive={palette.neonAccent}
            emissiveIntensity={0.4}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}