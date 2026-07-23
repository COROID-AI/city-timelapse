import { useMemo, useRef } from 'react'
import { Color, Object3D } from 'three'
import { Text } from '@react-three/drei'
import { EraTheme } from '../era/theme'

const tmp = new Object3D()

type StorefrontProps = {
  theme: EraTheme
}

/**
 * Generates era-appropriate storefronts with signage and architecture.
 * Signage text varies procedurally based on the era's theme.
 */
export function Storefronts({ theme }: StorefrontProps) {
  const groupRef = useRef<any>(null!)

  const storefronts = useMemo(() => {
    const list: {
      pos: [number, number, number]
      color: Color
      text: string
    }[] = []
    const rng = mulberry32(12345)

    for (let i = 0; i < 20; i++) {
      const x = -20 + rng() * 40
      const z = -20 + rng() * 40
      const dist = Math.sqrt(x * x + z * z)
      if (dist < 3) continue

      const color = theme.storefront.clone().multiplyScalar(0.7 + rng() * 0.5)
      const text = `${theme.adText}$${Math.floor(rng() * 100)}`
      list.push({ pos: [x, 1, z], color, text })
    }

    return list
  }, [theme])

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      {storefronts.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, 0, 0]} scale={[0.8, 1.2, 0.8]}>
          <mesh castShadow position={[0, 0.5, 0]} scale={[1, 0.5, 1]}>
            <boxGeometry args={[2, 0.5, 3]} />
            <meshStandardMaterial color={s.color} metalness={0.1} roughness={0.8} />
          </mesh>
          <Text position={[0, 0.8, 0]} fontSize={2} fontWeight="bold" textAlign="center" color={theme.accent}
            anchorX="center" anchorY="middle"
          >
            {s.text}
          </Text>
        </group>
      ))}
    </group>
  )
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
