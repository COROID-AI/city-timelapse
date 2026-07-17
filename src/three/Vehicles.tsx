/**
 * Vehicles — six era variants, each an animated InstancedMesh of cars/pods
 * driving along the interior road lanes. Per-era silhouette + palette differs
 * visibly (boxy sedans → muscle → SUV → pod → hover). Crossfaded in place by
 * `variantAlpha(frame.progress, eraIndex)`; vehicle position is driven by
 * per-instance phase so traffic flows during the idle heartbeat.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { EXTENT, LANES, mulberry32, ROAD_HALF } from './layout'
import { frame } from './frameState'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const PALETTE_N = 4

interface VehicleData {
  geo: THREE.BoxGeometry
  count: number
  /** per-instance: lane index, phase (0..1), speed, palette idx, verticalOffset */
  lanes: number[]
  phases: number[]
  speeds: number[]
  paletteIdx: number[]
  yOff: number[]
  lengths: number[]
  heights: number[]
}

const VEHICLES_PER_LANE = 3

function buildVehicles(eraIndex: number): VehicleData {
  const era = ERAS[eraIndex]
  const rng = mulberry32(3000 + eraIndex * 97)
  const lanes: number[] = []
  const phases: number[] = []
  const speeds: number[] = []
  const paletteIdx: number[] = []
  const yOff: number[] = []
  const lengths: number[] = []
  const heights: number[] = []
  const count = LANES.length * VEHICLES_PER_LANE

  for (let li = 0; li < LANES.length; li++) {
    for (let v = 0; v < VEHICLES_PER_LANE; v++) {
      lanes.push(li)
      phases.push(rng())
      speeds.push((2.6 + rng() * 2.4) * (1 + eraIndex * 0.06))
      paletteIdx.push(Math.floor(rng() * PALETTE_N) % era.vehicles.palette.length)
      // hover era floats slightly above the road
      yOff.push(era.vehicles.style === 'hover' ? 0.6 + rng() * 0.3 : 0)
      lengths.push(era.vehicles.length * (0.9 + rng() * 0.2))
      heights.push(era.vehicles.height)
    }
  }

  return {
    geo: new THREE.BoxGeometry(1, 1, 1),
    count,
    lanes,
    phases,
    speeds,
    paletteIdx,
    yOff,
    lengths,
    heights,
  }
}

function EraVehicles({ eraIndex }: { eraIndex: number }) {
  const data = useMemo(() => buildVehicles(eraIndex), [eraIndex])
  const ref = useRef<THREE.InstancedMesh>(null)

  const bodyMat = useMemo(() => {
    const era = ERAS[eraIndex]
    const base = new THREE.Color(era.vehicles.palette[0])
    return new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
    })
  }, [eraIndex])

  // Headlight / taillight emissive plane material
  const lightMat = useMemo(() => {
    const era = ERAS[eraIndex]
    const c =
      era.vehicles.style === 'hover'
        ? 0x4affc0
        : eraIndex >= 4
          ? 0xffffff
          : 0xffe9b0
    return new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: eraIndex === 0 ? 0.9 : 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  }, [eraIndex])

  const lightRef = useRef<THREE.InstancedMesh>(null)
  const lightGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const era = ERAS[eraIndex]
    for (let i = 0; i < data.count; i++) {
      const col = new THREE.Color(era.vehicles.palette[data.paletteIdx[i]])
      mesh.setColorAt(i, col)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data, eraIndex])

  useFrame(() => {
    const mesh = ref.current
    const lightMesh = lightRef.current
    if (!mesh) return
    const alpha = variantAlpha(frame.progress, eraIndex)
    bodyMat.opacity = alpha
    bodyMat.visible = alpha > 0.01
    lightMat.opacity = alpha * 0.9
    lightMat.visible = alpha > 0.01
    if (alpha <= 0.01) return

    const t = frame.time
    for (let i = 0; i < data.count; i++) {
      const lane = LANES[data.lanes[i]]
      const len = data.lengths[i]
      const hgt = data.heights[i]
      // position along the lane
      const span = EXTENT * 2 + len
      const pos =
        -EXTENT +
        (((data.phases[i] * span + t * data.speeds[i] * lane.dir) % span) +
          span) %
          span
      const y = hgt / 2 + data.yOff[i] + 0.12

      if (lane.axis === 'x') {
        _p.set(pos, y, lane.fixed)
        _q.setFromAxisAngle(_up, lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      } else {
        _p.set(lane.fixed, y, pos)
        _q.setFromAxisAngle(_up, lane.dir > 0 ? 0 : Math.PI)
      }
      _s.set(len, hgt, hgt * 1.5)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)

      if (lightMesh) {
        // taillight quad at the rear of the car
        _p.y = hgt * 0.55
        _s.set(len * 0.9, hgt * 0.3, 1)
        _m.compose(_p, _q, _s)
        lightMesh.setMatrixAt(i, _m)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (lightMesh) lightMesh.instanceMatrix.needsUpdate = true
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
        ref={lightRef}
        args={[lightGeo, lightMat, data.count]}
        frustumCulled={false}
      />
    </group>
  )
}

export function Vehicles() {
  return (
    <group>
      {ERAS.map((_, i) => (
        <EraVehicles key={i} eraIndex={i} />
      ))}
    </group>
  )
}

void ROAD_HALF
