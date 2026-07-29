import React from 'react'
import * as THREE from 'three'
import type { EraPalette } from '../eras'

interface SkylightProps {
  palette: EraPalette
}

export function Skylight({ palette }: SkylightProps) {
  return (
    <group>
      {/* Soft top light for the block */}
      <pointLight position={[0, 30, 0]} intensity={0.6} color={palette.sunColor} distance={80} decay={2} />
      <pointLight position={[-15, 20, -15]} intensity={0.3} color="#aaccff" distance={60} decay={2} />
      <pointLight position={[15, 20, 15]} intensity={0.25} color="#ffaa66" distance={50} decay={2} />
      {/* Neon accent lights for modern/future eras */}
      <pointLight position={[20, 5, 0]} intensity={palette.neonIntensity} color={palette.neonAccent} distance={40} decay={2} />
      <pointLight position={[-20, 5, 0]} intensity={palette.neonIntensity * 0.7} color={palette.neonAccent} distance={40} decay={2} />
      <pointLight position={[0, 5, 20]} intensity={palette.neonIntensity * 0.5} color={palette.neonAccent} distance={40} decay={2} />
    </group>
  )
}