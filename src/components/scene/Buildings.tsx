import { useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, Color, MeshStandardMaterial } from 'three'
import { EraTheme } from '../era/theme'

const tmp = new Object3D()

type BuildingsProps = {
  theme: EraTheme
  count?: number
}

/**
 * Procedurally generates a city block of buildings using instanced meshes.
 * Building heights, widths, and styles vary based on the era theme.
 * No external 3D assets are used — all geometry is generated at runtime.
 */
export function Buildings({ theme, count = 40 }: BuildingsProps) {
  const meshRef = useRef<InstancedMesh>(null!)

  const { positions, scales, colors } = useMemo(() => {
    const positions: [number, number, number][] = []
    const scales: [number, number, number][] = []
    const colors: Color[] = []
    const rng = mulberry32(1337)

    for (let i = 0; i < count; i++) {
      const x = -18 + rng() * 36
      const z = -18 + rng() * 36
      const distFromCenter = Math.sqrt(x * x + z * z)
      if (distFromCenter < 4) continue

      const w = 2 + rng() * 4
      const d = 2 + rng() * 4
      const h = 6 + rng() * 24

      positions.push([x, h / 2, z])
      scales.push([w, h, d])
      colors.push(theme.buildingTint.clone().multiplyScalar(0.8 + rng() * 0.4))
    }

    return { positions, scales, colors }
  }, [count, theme.buildingTint])

  // Update instance matrices on every render so transitions are reflected.
  const visibleCount = positions.length
  for (let i = 0; i < visibleCount; i++) {
    tmp.position.set(positions[i][0], positions[i][1], positions[i][2])
    tmp.scale.set(scales[i][0], scales[i][1], scales[i][2])
    tmp.updateMatrix()
    meshRef.current?.setMatrixAt(i, tmp.matrix)
    meshRef.current?.setColorAt(i, colors[i])
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, visibleCount]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors />
    </instancedMesh>
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
