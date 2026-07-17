/**
 * Pedestrians — six era variants, each an InstancedMesh crowd walking the
 * sidewalk paths. Era-accurate palette + height/silhouette (hats & coats → mod
 * mini → casual → streetwear → tech → future bodysuits). Crossfaded by
 * `variantAlpha`; position animates during the idle heartbeat so the city
 * feels alive.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { EXTENT, WALKS, mulberry32, ROAD_HALF } from './layout'
import { frame } from './frameState'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

interface PedData {
  geo: THREE.CapsuleGeometry
  count: number
  walks: number[]
  phases: number[]
  speeds: number[]
  paletteIdx: number[]
  heights: number[]
}

function buildPeds(eraIndex: number): PedData {
  const era = ERAS[eraIndex]
  const rng = mulberry32(5000 + eraIndex * 89)
  // density scales the crowd size per era
  const perWalk = Math.round(6 * era.pedestrians.density)
  const walks: number[] = []
  const phases: number[] = []
  const speeds: number[] = []
  const paletteIdx: number[] = []
  const heights: number[] = []
  const count = WALKS.length * perWalk

  for (let wi = 0; wi < WALKS.length; wi++) {
    for (let p = 0; p < perWalk; p++) {
      walks.push(wi)
      phases.push(rng())
      speeds.push((0.8 + rng() * 0.7) * (rng() > 0.5 ? 1 : -1))
      paletteIdx.push(
        Math.floor(rng() * era.pedestrians.palette.length) %
          era.pedestrians.palette.length,
      )
      // height varies by era styling (future crowds a touch taller/slender)
      const base = era.pedestrians.style === 'future' ? 1.85 : 1.7
      heights.push(base * (0.92 + rng() * 0.16))
    }
  }

  return {
    geo: new THREE.CapsuleGeometry(0.22, 0.9, 4, 8),
    count,
    walks,
    phases,
    speeds,
    paletteIdx,
    heights,
  }
}

function EraPeds({ eraIndex }: { eraIndex: number }) {
  const data = useMemo(() => buildPeds(eraIndex), [eraIndex])
  const ref = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.17, 8, 8), [])

  const bodyMat = useMemo(() => {
    const base = new THREE.Color(ERAS[eraIndex].pedestrians.palette[0])
    return new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.8,
      metalness: 0.05,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
    })
  }, [eraIndex])

  const headMat = useMemo(() => {
    // skin/visor tone shifts slightly futuristic
    const c = eraIndex >= 4 ? 0xcfd6e6 : 0xb98a64
    return new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.7,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
    })
  }, [eraIndex])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const era = ERAS[eraIndex]
    for (let i = 0; i < data.count; i++) {
      const col = new THREE.Color(
        era.pedestrians.palette[data.paletteIdx[i]],
      )
      mesh.setColorAt(i, col)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data, eraIndex])

  useFrame(() => {
    const mesh = ref.current
    const headMesh = headRef.current
    if (!mesh) return
    const alpha = variantAlpha(frame.progress, eraIndex)
    bodyMat.opacity = alpha
    bodyMat.visible = alpha > 0.01
    headMat.opacity = alpha
    headMat.visible = alpha > 0.01
    if (alpha <= 0.01) return

    const t = frame.time
    for (let i = 0; i < data.count; i++) {
      const walk = WALKS[data.walks[i]]
      const h = data.heights[i]
      const span = EXTENT * 2
      const pos =
        -EXTENT +
        (((data.phases[i] * span + t * data.speeds[i]) % span) + span) % span
      const bob = Math.sin(t * 6 + data.phases[i] * 12) * 0.04
      const y = h / 2 + 0.08 + bob

      if (walk.axis === 'x') {
        _p.set(pos, y, walk.fixed)
        _q.setFromAxisAngle(_up, data.speeds[i] > 0 ? Math.PI / 2 : -Math.PI / 2)
      } else {
        _p.set(walk.fixed, y, pos)
        _q.setFromAxisAngle(_up, data.speeds[i] > 0 ? 0 : Math.PI)
      }
      _s.set(1, h / 1.12, 1) // capsule body scale
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)

      if (headMesh) {
        _p.y = h + 0.12
        _s.set(1, 1, 1)
        _m.compose(_p, _q, _s)
        headMesh.setMatrixAt(i, _m)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (headMesh) headMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[data.geo, bodyMat, data.count]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={headRef}
        args={[headGeo, headMat, data.count]}
        frustumCulled={false}
      />
    </group>
  )
}

export function Pedestrians() {
  return (
    <group>
      {ERAS.map((_, i) => (
        <EraPeds key={i} eraIndex={i} />
      ))}
    </group>
  )
}

void ROAD_HALF
