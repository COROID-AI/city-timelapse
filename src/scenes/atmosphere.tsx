import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAppStore } from '../state'
import { ERA_PALETTES, type EraId } from '../eras'

export function Atmosphere() {
  const { eraId } = useAppStore()
  const particlesRef = useRef<THREE.Points>(null)

  const palette = ERA_PALETTES[eraId as EraId]

  const { geometry, material } = useMemo(() => {
    const count = 600
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100
      positions[i * 3 + 1] = Math.random() * 40 + 1
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      color: palette.particleColor,
      size: 0.3,
      transparent: true,
      opacity: palette.particleOpacity,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [eraId, palette])

  useFrame((_, delta) => {
    if (!particlesRef.current) return
    particlesRef.current.rotation.y += delta * 0.01
    const pos = particlesRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += delta * 0.3
      if (pos[i + 1] > 45) pos[i + 1] = 1
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={particlesRef}>
      <primitive attach="geometry" object={geometry} />
      <primitive attach="material" object={material} />
    </points>
  )
}