import { useMemo, useRef } from 'react'
import { Object3D, Color } from 'three'
import { EraTheme } from '../era/theme'

const tmp = new Object3D()

type VehiclesProps = {
  theme: EraTheme
}

/**
 * Procedurally generates vehicles (cars + optionally flying cars) using
 * basic geometric primitives. Vehicle shape, color, and count vary by era.
 * No external 3D assets.
 */
export function Vehicles({ theme }: VehiclesProps) {
  const groupRef = useRef<any>(null!)

  const vehicles = useMemo(() => {
    const list: {
      pos: [number, number, number]
      rot: [number, number, number]
      color: Color
      scale: number
      flying: boolean
    }[] = []
    const rng = mulberry32(42)

    const roadZ = 0
    const roadX = 0

    // Ground vehicles along the two main roads
    for (let i = 0; i < theme.vehicleCount; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const alongX = -30 + (i / theme.vehicleCount) * 60
      const x = alongX
      const z = side * (2.5 + rng() * 1.5)
      const color = theme.vehicle.clone().multiplyScalar(0.7 + rng() * 0.5)
      const scale = 0.7 + rng() * 0.5
      const rot: [number, number, number] = [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]
      list.push({ pos: [x, 0.4, z], rot, color, scale, flying: false })
    }

    // Flying vehicles for 2055
    if (theme.flyingVehicles) {
      for (let i = 0; i < 6; i++) {
        const rng2 = mulberry32(100 + i)
        const x = -30 + rng2() * 60
        const z = -30 + rng2() * 60
        const y = 8 + rng2() * 6
        const color = theme.accent.clone().multiplyScalar(0.6 + rng2() * 0.6)
        list.push({ pos: [x, y, z], rot: [0, rng2() * Math.PI * 2, 0], color, scale: 0.4, flying: true })
      }
    }

    return list
  }, [theme])

  return (
    <group ref={groupRef}>
      {vehicles.map((v, i) => (
        <group key={i} position={v.pos} rotation={v.rot}>
          <VehicleMesh color={v.color} scale={v.scale} flying={v.flying} />
        </group>
      ))}
    </group>
  )
}

type VehicleMeshProps = {
  color: Color
  scale: number
  flying: boolean
}

function VehicleMesh({ color, scale, flying }: VehicleMeshProps) {
  const bodyColor = color.clone()
  const emissive = flying ? color.clone().multiplyScalar(0.5) : new Color(0, 0, 0)

  return (
    <group scale={scale}>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 0.6, 0.9]} />
        <meshStandardMaterial color={bodyColor} emissive={emissive} emissiveIntensity={flying ? 0.8 : 0} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial
          color={bodyColor.clone().multiplyScalar(0.7)}
          emissive={emissive}
          emissiveIntensity={flying ? 0.8 : 0}
          transparent
          opacity={flying ? 0.7 : 1}
        />
      </mesh>
      {/* Wheels */}
      {[-0.7, 0.7].map((x) =>
        [0.45, -0.45].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.35, z]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.3, 16]} />
            <meshStandardMaterial color={new Color(0.05, 0.05, 0.05)} />
          </mesh>
        ))
      )}
      {/* Flying engine glow */}
      {flying && (
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
          <meshStandardMaterial
            color={new Color(0.3, 0.8, 1)}
            emissive={new Color(0.3, 0.8, 1)}
            emissiveIntensity={1}
          />
        </mesh>
      )}
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
