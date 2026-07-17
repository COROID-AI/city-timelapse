/**
 * Signs & Advertisements — storefront signs on building facades + freestanding
 * billboards. Six era variants with distinct signage families (painted wood →
 * neon tubes → backlit acrylic → LED screens → holographic → projection).
 * Emissive panels that bloom, crossfaded by `variantAlpha`.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { SLOTS, ROAD_COORDS, mulberry32 } from './layout'
import { frame } from './frameState'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

interface SignInstance {
  x: number
  y: number
  z: number
  rotY: number
  w: number
  h: number
  paletteIdx: number
}

interface BillboardInstance {
  x: number
  z: number
  rotY: number
  w: number
  h: number
  paletteIdx: number
}

interface SignData {
  signGeo: THREE.PlaneGeometry
  signCount: number
  signs: SignInstance[]
  boardGeo: THREE.PlaneGeometry
  boardCount: number
  boards: BillboardInstance[]
  poleCount: number
}

function buildSigns(eraIndex: number): SignData {
  const era = ERAS[eraIndex]
  const rng = mulberry32(9000 + eraIndex * 113)
  const signs: SignInstance[] = []
  const boards: BillboardInstance[] = []

  // Storefront signs: one per building face facing a road.
  for (const slot of SLOTS) {
    // pick the two nearest road coords in x and z
    const nearX = ROAD_COORDS.reduce((best, c) =>
      Math.abs(c - slot.x) < Math.abs(best - slot.x) ? c : best,
    )
    const nearZ = ROAD_COORDS.reduce((best, c) =>
      Math.abs(c - slot.z) < Math.abs(best - slot.z) ? c : best,
    )
    const faceX = nearX < slot.x ? 1 : -1
    const faceZ = nearZ < slot.z ? 1 : -1

    const h = Math.max(2, Math.round(era.buildings.height)) * 1.25
    const signY = 2.6 + rng() * 1.5
    const sw = slot.w * 0.5
    const sd = slot.d * 0.5

    // sign on +x/-x face
    signs.push({
      x: slot.x + faceX * (sw + 0.1),
      y: signY,
      z: slot.z + (rng() - 0.5) * sd,
      rotY: faceX > 0 ? Math.PI / 2 : -Math.PI / 2,
      w: slot.w * 0.4,
      h: 1.1 + rng() * 0.6,
      paletteIdx: Math.floor(rng() * era.signs.palette.length),
    })
    // sign on +z/-z face (skip some for variety)
    if (rng() > 0.4) {
      signs.push({
        x: slot.x + (rng() - 0.5) * sw,
        y: signY + (rng() - 0.5),
        z: slot.z + faceZ * (sd + 0.1),
        rotY: faceZ > 0 ? 0 : Math.PI,
        w: slot.d * 0.4,
        h: 1.1 + rng() * 0.6,
        paletteIdx: Math.floor(rng() * era.signs.palette.length),
      })
    }
    void h
  }

  // Freestanding billboards at road intersections / edges.
  const boardSpots: { x: number; z: number }[] = [
    { x: ROAD_COORDS[1], z: ROAD_COORDS[1] - 5 },
    { x: ROAD_COORDS[3] - 5, z: ROAD_COORDS[2] },
    { x: ROAD_COORDS[2] + 5, z: ROAD_COORDS[3] },
    { x: ROAD_COORDS[1], z: ROAD_COORDS[3] + 5 },
  ]
  for (const spot of boardSpots) {
    boards.push({
      x: spot.x,
      z: spot.z,
      rotY: rng() * Math.PI * 2,
      w: 4 + rng() * 2,
      h: 2.6 + rng() * 1.6,
      paletteIdx: Math.floor(rng() * era.signs.palette.length),
    })
  }

  return {
    signGeo: new THREE.PlaneGeometry(1, 1),
    signCount: signs.length,
    signs,
    boardGeo: new THREE.PlaneGeometry(1, 1),
    boardCount: boards.length,
    boards,
    poleCount: boards.length,
  }
}

function EraSigns({ eraIndex }: { eraIndex: number }) {
  const data = useMemo(() => buildSigns(eraIndex), [eraIndex])
  const signRef = useRef<THREE.InstancedMesh>(null)
  const boardRef = useRef<THREE.InstancedMesh>(null)
  const poleRef = useRef<THREE.InstancedMesh>(null)

  const era = ERAS[eraIndex]
  const signMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(era.signs.palette[0]),
        transparent: true,
        opacity: eraIndex === 0 ? era.signs.intensity : 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [era, eraIndex],
  )

  const boardMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(era.signs.palette[1 % era.signs.palette.length]),
        transparent: true,
        opacity: eraIndex === 0 ? era.signs.intensity : 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [era, eraIndex],
  )

  const poleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.6,
        transparent: true,
        opacity: eraIndex === 0 ? 1 : 0,
      }),
    [eraIndex],
  )

  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 1, 6), [])

  useLayoutEffect(() => {
    const signMesh = signRef.current
    const boardMesh = boardRef.current
    const poleMesh = poleRef.current

    if (signMesh) {
      for (let i = 0; i < data.signs.length; i++) {
        const s = data.signs[i]
        const col = new THREE.Color(era.signs.palette[s.paletteIdx])
        signMesh.setColorAt(i, col)
        _p.set(s.x, s.y, s.z)
        _q.setFromAxisAngle(_up, s.rotY)
        _s.set(s.w, s.h, 1)
        _m.compose(_p, _q, _s)
        signMesh.setMatrixAt(i, _m)
      }
      signMesh.instanceMatrix.needsUpdate = true
      if (signMesh.instanceColor) signMesh.instanceColor.needsUpdate = true
    }
    if (boardMesh) {
      for (let i = 0; i < data.boards.length; i++) {
        const b = data.boards[i]
        const col = new THREE.Color(era.signs.palette[b.paletteIdx])
        boardMesh.setColorAt(i, col)
      }
      if (boardMesh.instanceColor) boardMesh.instanceColor.needsUpdate = true
    }
    if (poleMesh) {
      for (let i = 0; i < data.boards.length; i++) {
        const b = data.boards[i]
        _p.set(b.x, 2, b.z)
        _q.setFromAxisAngle(_up, b.rotY)
        _s.set(1, 4, 1)
        _m.compose(_p, _q, _s)
        poleMesh.setMatrixAt(i, _m)
      }
      poleMesh.instanceMatrix.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useFrame(() => {
    const alpha = variantAlpha(frame.progress, eraIndex)
    const flicker = 0.85 + Math.sin(frame.time * 8 + eraIndex) * 0.15
    const intensity = era.signs.intensity * alpha * flicker
    signMat.opacity = intensity
    signMat.visible = alpha > 0.01
    boardMat.opacity = intensity
    boardMat.visible = alpha > 0.01
    poleMat.opacity = alpha
    poleMat.visible = alpha > 0.01

    const boardMesh = boardRef.current
    if (boardMesh && alpha > 0.01) {
      // subtle billboard sway + scroll animation
      for (let i = 0; i < data.boards.length; i++) {
        const b = data.boards[i]
        const sway = Math.sin(frame.time * 0.6 + i) * 0.02
        _p.set(b.x, 4 + sway, b.z)
        _q.setFromAxisAngle(_up, b.rotY)
        _s.set(b.w, b.h, 1)
        _m.compose(_p, _q, _s)
        boardMesh.setMatrixAt(i, _m)
      }
      boardMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh
        ref={signRef}
        args={[data.signGeo, signMat, data.signCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={boardRef}
        args={[data.boardGeo, boardMat, data.boardCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={poleRef}
        args={[poleGeo, poleMat, data.poleCount]}
        castShadow
        frustumCulled={false}
      />
    </group>
  )
}

export function Signs() {
  return (
    <group>
      {ERAS.map((_, i) => (
        <EraSigns key={i} eraIndex={i} />
      ))}
    </group>
  )
}
