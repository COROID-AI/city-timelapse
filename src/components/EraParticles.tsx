/**
 * EraParticles - Atmospheric particle effects for each era
 */

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraId } from '../eras'

interface EraParticlesProps {
  era: EraId
}

export function EraParticles({ era }: EraParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const particleParams = useMemo(() => {
    switch (era) {
      case '1945':
        return {
          count: 100,
          color: '#CD853F',
          size: 0.3,
          speed: 0.01,
          type: 'smoke',
        }
      case '1965':
        return {
          count: 80,
          color: '#87CEEB',
          size: 0.25,
          speed: 0.02,
          type: 'haze',
        }
      case '1985':
        return {
          count: 150,
          color: '#FF00FF',
          size: 0.2,
          speed: 0.05,
          type: 'neon_sparkles',
        }
      case '2005':
        return {
          count: 120,
          color: '#00BFFF',
          size: 0.15,
          speed: 0.03,
          type: 'digital_sparkles',
        }
      case '2025':
        return {
          count: 80,
          color: '#32CD32',
          size: 0.25,
          speed: 0.015,
          type: 'pollen',
        }
      case '2055':
        return {
          count: 200,
          color: '#9370DB',
          size: 0.2,
          speed: 0.04,
          type: 'bio_luminescence',
        }
    }
  }, [era])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const positions = useMemo(() => {
    const pos: [number, number, number][] = []
    for (let i = 0; i < particleParams.count; i++) {
      pos.push([
        (Math.random() - 0.5) * 50,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 50,
      ])
    }
    return pos
  }, [particleParams.count])

  useFrame((_state, delta) => {
    if (!meshRef.current) return

    positions.forEach((pos, i) => {
      const [x, y, z] = pos
      dummy.position.set(x, y, z)

      // Animate based on particle type
      const timeOffset = i * 0.01
      const wobble = Math.sin(delta * particleParams.speed + timeOffset) * 0.5

      dummy.scale.setScalar(
        particleParams.size + wobble * (era === '2055' ? 0.5 : 0.2)
      )

      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <points>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleParams.count]}>
        <planeGeometry args={[1, 1]} />
        <pointsMaterial
          color={particleParams.color}
          size={particleParams.size}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </points>
  )
}