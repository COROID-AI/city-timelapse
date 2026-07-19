import React from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'

export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={2048}
        mixBlur={1}
        mixStrength={100}
        roughness={0.8}
        mirror={0.4}
        color="#222222"
      />
    </mesh>
  )
}