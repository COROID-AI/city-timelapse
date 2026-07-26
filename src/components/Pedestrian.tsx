import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { eraConfig } from '../utils/eraConfig'
import { clamp, lerp } from './cityUtils'

type PedestrianProps = {
  x: number
  z: number
  idx: number
  effectiveIndex: number
}

export function Pedestrian({ x, z, idx, effectiveIndex }: PedestrianProps) {
  const ref = useRef<THREE.Group | null>(null)

  const eraIdx = Math.round(clamp(effectiveIndex, 0, eraConfig.eras.length - 1))
  const era = eraConfig.eras[eraIdx]

  const outfit = era.pedestrians.base
  const accent = era.pedestrians.accent

  const bobAmp = lerp(0.03, 0.06, clamp((effectiveIndex - 1) / 4, 0, 1))

  const legGeometry = useMemo(() => new THREE.CylinderGeometry(0.05, 0.06, 0.32, 8), [])
  const torsoGeometry = useMemo(() => new THREE.CapsuleGeometry(0.12, 0.28, 8, 16), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), [])
  const scarfGeometry = useMemo(() => new THREE.TorusGeometry(0.11, 0.02, 10, 30), [])

  const legMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(20 / 255, 20 / 255, 25 / 255), roughness: 0.95 }), [])
  const torsoMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.8, metalness: 0.05 }), [outfit])
  const headMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2d1b8').getStyle(), roughness: 0.95 }),
    [],
  )
  const scarfMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.1 }),
    [accent],
  )

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x = x + Math.sin((idx + effectiveIndex) * 0.7 + performance.now() * 0.001) * 0.03
    ref.current.position.z += delta * (0.35 + idx * 0.03)
    if (ref.current.position.z > 28) ref.current.position.z = -28
    ref.current.rotation.y = Math.sin(performance.now() * 0.001 + idx) * 0.08
    ref.current.position.y = 0.0 + Math.sin(performance.now() * 0.004 + idx) * bobAmp
  })

  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh geometry={legGeometry} material={legMaterial} position={[0.07, 0.16, 0]} castShadow />
      <mesh geometry={legGeometry} material={legMaterial} position={[-0.07, 0.16, 0]} castShadow />

      <mesh geometry={torsoGeometry} material={torsoMaterial} position={[0, 0.45, 0]} castShadow />
      <mesh geometry={headGeometry} material={headMaterial} position={[0, 0.65, 0]} castShadow />

      <mesh
        geometry={scarfGeometry}
        material={scarfMaterial}
        position={[0.02, 0.58, 0.08]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  )
}
