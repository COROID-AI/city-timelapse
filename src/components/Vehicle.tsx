import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eraConfig } from '../utils/eraConfig'
import { clamp, lerp } from './cityUtils'

type VehicleProps = {
  laneX: number
  z: number
  idx: number
  effectiveIndex: number
}

export function Vehicle({ laneX, z, idx, effectiveIndex }: VehicleProps) {
  const ref = useRef<THREE.Group | null>(null)
  const eraIdx = Math.round(clamp(effectiveIndex, 0, eraConfig.eras.length - 1))
  const era = eraConfig.eras[eraIdx]

  const bodyColor = era.vehicles.base
  const accent = era.vehicles.accent
  const headOn = clamp((effectiveIndex - 1) / 4, 0, 1)

  const speed = lerp(0.9, 2.2, clamp((effectiveIndex - 1) / 4, 0, 1))

  const carBodyGeometry = useMemo(() => new THREE.BoxGeometry(1.15, 0.25, 2.2), [])
  const accentGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.16, 1.0), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 10, 10), [])

  const accentMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.55, emissive: accent, emissiveIntensity: 0.08 + 0.14 * headOn }),
    [accent, headOn],
  )

  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.35 }),
    [bodyColor],
  )

  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('white'),
        emissive: new THREE.Color('white'),
        emissiveIntensity: 1.0 * headOn,
      }),
    [headOn],
  )

  useFrame((_, delta) => {
    if (!ref.current) return
    const m = ref.current
    m.position.z += delta * speed * (0.55 + idx * 0.07)
    if (m.position.z > 30) m.position.z = -30
  })

  return (
    <group ref={ref} position={[laneX, 0.06, z]}>
      <mesh castShadow geometry={carBodyGeometry} material={bodyMaterial} />
      <mesh geometry={accentGeometry} material={accentMaterial} position={[0, 0.19, 0.7]} />

      <mesh geometry={headGeometry} material={headMat} position={[0.55, 0.08, 1.1]} />
      <mesh geometry={headGeometry} material={headMat} position={[-0.55, 0.08, 1.1]} />

      <pointLight intensity={0.7 * headOn} distance={9} color={accent} position={[0, 0.2, 1.0]} />
    </group>
  )
}
