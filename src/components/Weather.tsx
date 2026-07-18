import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import { Group } from 'three'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export function Weather({ eraA, eraB, blendT }: { eraA: Era; eraB: Era; blendT: number }) {
  const rainStrength = useMemo(() => {
    const strengthFor = (e: Era) => {
      if (e === '1985') return 0.35
      if (e === '2005') return 0.55
      if (e === '2025') return 0.6
      if (e === '2055') return 0.15
      return 0.05
    }
    const a = strengthFor(eraA)
    const b = strengthFor(eraB)
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  const snowStrength = useMemo(() => {
    const strengthFor = (e: Era) => {
      if (e === '1945') return 0.25
      if (e === '1965') return 0.15
      if (e === '1985') return 0.08
      return 0.02
    }
    const a = strengthFor(eraA)
    const b = strengthFor(eraB)
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  const mistStrength = useMemo(() => {
    const strengthFor = (e: Era) => (e === '2055' ? 0.35 : e === '2025' ? 0.12 : 0.05)
    const a = strengthFor(eraA)
    const b = strengthFor(eraB)
    return a + (b - a) * blendT
  }, [eraA, eraB, blendT])

  const rain = useRainParticles(1200, 40)
  const snow = useRainParticles(900, 30, true)

  return (
    <group>
      {/* Mist layer (visual-only) */}
      {mistStrength > 0.02 && (
        <mesh position={[0, 10, 0]} rotation={[0, 0, 0]}>
          <sphereGeometry args={[120, 24, 18]} />
          <meshStandardMaterial
            transparent
            opacity={0.06 + mistStrength * 0.06}
            color="#cfe8ff"
            roughness={1}
            metalness={0}
          />
        </mesh>
      )}

      <rain.PointsComponent strength={rainStrength} materialColor="#9ad1ff" />
      <snow.PointsComponent strength={snowStrength} materialColor="#ffffff" />

      {/* World fogging via three-level fog is already handled by Sky; mist here adds atmosphere */}
    </group>
  )
}

function useRainParticles(count: number, height: number, slow = false) {
  const geometryRef = useRef<BufferGeometry | null>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 120
      const y = Math.random() * height + 2
      const z = (Math.random() - 0.5) * 80
      arr[i * 3] = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
    }
    return arr
  }, [count, height])

  const GroupComponent = useMemo(() => {
    return function PointsComponent({ strength, materialColor }: { strength: number; materialColor: string }) {
      const materialRef = useRef<PointsMaterial | null>(null)

      // Move with the useFrame loop.
      useFrame((state, delta) => {
        const g = geometryRef.current
        const mat = materialRef.current
        if (!g || !mat) return

        const opacity = Math.min(1, Math.max(0, strength))
        mat.opacity = 0.02 + opacity * 0.35
        mat.visible = opacity > 0.02

        const posAttr = g.getAttribute('position') as BufferAttribute
        const speed = slow ? 12 : 22

        for (let i = 0; i < count; i++) {
          const ix = i * 3
          posAttr.array[ix + 1] -= delta * speed * (0.3 + opacity)
          if (posAttr.array[ix + 1] < 0) {
            posAttr.array[ix + 1] = height + Math.random() * 10
            posAttr.array[ix] = (Math.random() - 0.5) * 120
            posAttr.array[ix + 2] = (Math.random() - 0.5) * 80
          }
        }
        posAttr.needsUpdate = true
      })

      return (
        <points>
          <bufferGeometry ref={(g) => (geometryRef.current = g || null)}>
            <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial ref={(m) => (materialRef.current = m)} size={slow ? 0.18 : 0.08} color={materialColor} transparent />
        </points>
      )
    }
  }, [count, height, positions, slow])

  return { PointsComponent: GroupComponent as any }
}
