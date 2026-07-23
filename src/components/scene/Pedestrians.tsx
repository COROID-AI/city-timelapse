import { useMemo, useRef } from 'react'
import { Object3D, Color } from 'three'
import { useFrame } from '@react-three/fiber'
import { EraTheme } from '../era/theme'

const tmp = new Object3D()

type PedestriansProps = {
  theme: EraTheme
}

/**
 * Procedurally generates pedestrians as simple capsule/box figures.
 * Outfit color and count vary by era. Pedestrians walk along sidewalks.
 * No external 3D assets.
 */
export function Pedestrians({ theme }: PedestriansProps) {
  const groupRef = useRef<any>(null!)

  const peds = useMemo(() => {
    const list: {
      pos: [number, number, number]
      rot: [number, number, number]
      color: Color
      speed: number
      direction: number
    }[] = []
    const rng = mulberry32(777)

    for (let i = 0; i < theme.pedestrianCount; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const x = -28 + (i / theme.pedestrianCount) * 56
      const z = side * (5 + rng() * 2)
      const color = theme.pedestrian.clone().multiplyScalar(0.6 + rng() * 0.6)
      const speed = 0.5 + rng() * 1.5
      list.push({
        pos: [x, 0, z],
        rot: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
        color,
        speed,
        direction: side,
      })
    }

    return list
  }, [theme])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const children = groupRef.current.children
    children.forEach((child: any, i: number) => {
      const p = peds[i]
      if (!p) return
      // Walk back and forth along the sidewalk
      const offset = (state.clock.elapsedTime * p.speed) % 56
      const x = -28 + offset
      child.position.x = x
      // Simple arm swing animation
      const swing = Math.sin(state.clock.elapsedTime * p.speed * 3) * 0.1
      const arms = child.children[1] as any
      if (arms) {
        arms.rotation.z = swing
      }
    })
  })

  return (
    <group ref={groupRef}>
      {peds.map((p, i) => (
        <group key={i} position={p.pos} rotation={p.rot}>
          {/* Body */}
          <mesh castShadow position={[0, 0.8, 0]}>
            <boxGeometry args={[0.3, 0.8, 0.15]} />
            <meshStandardMaterial color={p.color} />
          </mesh>
          {/* Head */}
          <mesh castShadow position={[0, 1.35, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color={p.color.clone().multiplyScalar(1.2)} />
          </mesh>
          {/* Arms (for swing animation) */}
          <group position={[0, 0.7, 0]}>
            <mesh castShadow position={[-0.25, 0.1, 0]}>
              <boxGeometry args={[0.15, 0.6, 0.1]} />
              <meshStandardMaterial color={p.color} />
            </mesh>
            <mesh castShadow position={[0.25, -0.1, 0]}>
              <boxGeometry args={[0.15, 0.6, 0.1]} />
              <meshStandardMaterial color={p.color} />
            </mesh>
          </group>
          {/* Legs */}
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} castShadow position={[x, 0.3, 0]}>
              <boxGeometry args={[0.15, 0.6, 0.1]} />
              <meshStandardMaterial color={p.color.clone().multiplyScalar(0.7)} />
            </mesh>
          ))}
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
