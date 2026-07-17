/**
 * Buildings — the centrepiece of the detail budget.
 *
 * For each of the 6 eras we build, once, an InstancedMesh of building bodies
 * (per-slot footprint, era height + style) plus an InstancedMesh of emissive
 * window quads forming lit grids. The 16 footprints are fixed across eras so
 * variants crossfade *in place*. A single useFrame per era variant sets
 * material opacity via `variantAlpha(frame.progress, eraIndex)` so the whole
 * city visibly morphs/dissolves as a timelapse.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { SLOTS, mulberry32 } from './layout'
import { frame } from './frameState'
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()

interface EraBuilt {
  bodyGeo: THREE.BoxGeometry
  winGeo: THREE.PlaneGeometry
  bodyCount: number
  winCount: number
  /** body instance matrices. */
  bodyMatrices: THREE.Matrix4[]
  bodyColors: THREE.Color[]
  winMatrices: THREE.Matrix4[]
}

/** Build one era's geometry + instance data (called in useMemo per era). */
function buildEra(eraIndex: number): EraBuilt {
  const era = ERAS[eraIndex]
  const rng = mulberry32(7000 + eraIndex * 101)
  const bodyMatrices: THREE.Matrix4[] = []
  const bodyColors: THREE.Color[] = []
  const winMatrices: THREE.Matrix4[] = []

  for (const slot of SLOTS) {
    const w = slot.w
    const d = slot.d
    // Per-slot, per-era height: scale around the era's dominant height.
    const hVar = 0.6 + rng() * 0.9
    const stories = Math.max(2, Math.round(era.buildings.height * hVar))
    const floorH = 1.25
    const h = stories * floorH

    // Body placement (footprint fixed; height differs per era).
    _p.set(slot.x, h / 2, slot.z)
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), slot.rot)
    _s.set(w, h, d)
    _m.compose(_p, _q, _s)
    bodyMatrices.push(_m.clone())

    // Body colour from era palette (per slot).
    const palIdx = Math.floor(rng() * era.buildings.palette.length)
    bodyColors.push(new THREE.Color(era.buildings.palette[palIdx]))

    // Roof detail: a thin coping cap pushed as an extra body instance.
    _p.set(slot.x, h + 0.18, slot.z)
    _s.set(w + 0.4, 0.36, d + 0.4)
    _m.compose(_p, _q, _s)
    bodyMatrices.push(_m.clone())
    bodyColors.push(
      new THREE.Color(era.buildings.palette[palIdx]).multiplyScalar(0.7),
    )

    // Era-style roof add-ons for silhouette variety.
    const style = era.buildings.style
    if (style === 'lowrise' || style === 'midcentury') {
      // water tank / chimney block
      _p.set(slot.x + (rng() - 0.5) * w * 0.4, h + 0.9, slot.z)
      _s.set(1.4, 1.4, 1.4)
      _m.compose(_p, _q, _s)
      bodyMatrices.push(_m.clone())
      bodyColors.push(new THREE.Color(era.buildings.palette[palIdx]).multiplyScalar(0.6))
    } else if (style === 'glass' || style === 'eclectic') {
      // rooftop penthouse + antenna mast
      _p.set(slot.x - w * 0.2, h + 0.7, slot.z + d * 0.2)
      _s.set(w * 0.4, 1.4, d * 0.4)
      _m.compose(_p, _q, _s)
      bodyMatrices.push(_m.clone())
      bodyColors.push(new THREE.Color(era.buildings.palette[palIdx]).multiplyScalar(0.8))
    } else if (style === 'smart' || style === 'bio') {
      // tall spire / beacon for futuristic silhouettes
      _p.set(slot.x, h + 2.4, slot.z)
      _s.set(0.5, 5, 0.5)
      _m.compose(_p, _q, _s)
      bodyMatrices.push(_m.clone())
      bodyColors.push(new THREE.Color(era.buildings.windowGlow).multiplyScalar(0.5))
    }

    // Window grid on all 4 faces. Emissive quads.
    const cols = Math.max(2, Math.round(w / 2.4))
    const rows = Math.max(2, stories)
    const colStep = w / cols
    const rowStep = floorH
    const winW = colStep * 0.55
    const winH = rowStep * 0.62
    const faces: { nx: number; nz: number; off: number; rotY: number }[] = [
      { nx: 0, nz: 1, off: d / 2 + 0.02, rotY: 0 },
      { nx: 0, nz: -1, off: -(d / 2 + 0.02), rotY: Math.PI },
      { nx: 1, nz: 0, off: w / 2 + 0.02, rotY: Math.PI / 2 },
      { nx: -1, nz: 0, off: -(w / 2 + 0.02), rotY: -Math.PI / 2 },
    ]
    for (const f of faces) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // jitter lighting pattern: some windows dark, skip ~22%
          if (rng() < 0.22) continue
          const localY = row * rowStep + rowStep / 2 + 0.25
          const u = (col + 0.5) / cols - 0.5 // -0.5..0.5
          const along = u * (f.nz !== 0 ? w : d)
          _p.set(0, 0, 0)
          if (f.nz !== 0) {
            _p.set(slot.x + along, localY, slot.z + f.off)
          } else {
            _p.set(slot.x + f.off, localY, slot.z + along)
          }
          _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.rotY + slot.rot)
          _s.set(winW, winH, 1)
          _m.compose(_p, _q, _s)
          winMatrices.push(_m.clone())
        }
      }
    }
  }

  return {
    bodyGeo: new THREE.BoxGeometry(1, 1, 1),
    winGeo: new THREE.PlaneGeometry(1, 1),
    bodyCount: bodyMatrices.length,
    winCount: winMatrices.length,
    bodyMatrices,
    bodyColors,
    winMatrices,
  }
}

function EraBuildings({ eraIndex }: { eraIndex: number }) {
  const built = useMemo(() => buildEra(eraIndex), [eraIndex])
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const winRef = useRef<THREE.InstancedMesh>(null)

  const bodyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: ERAS[eraIndex].buildings.style === 'glass' ? 0.5 : 0.1,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
    })
    return m
  }, [eraIndex])

  const winMat = useMemo(() => {
    const c = new THREE.Color(ERAS[eraIndex].buildings.windowGlow)
    return new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: eraIndex === 0 ? ERAS[eraIndex].buildings.windowIntensity : 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  }, [eraIndex])

  useLayoutEffect(() => {
    const body = bodyRef.current
    const win = winRef.current
    if (body) {
      for (let i = 0; i < built.bodyMatrices.length; i++) {
        body.setMatrixAt(i, built.bodyMatrices[i])
        body.setColorAt(i, built.bodyColors[i])
      }
      body.instanceMatrix.needsUpdate = true
      if (body.instanceColor) body.instanceColor.needsUpdate = true
    }
    if (win) {
      for (let i = 0; i < built.winMatrices.length; i++) {
        win.setMatrixAt(i, built.winMatrices[i])
      }
      win.instanceMatrix.needsUpdate = true
    }
  }, [built])

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[built.bodyGeo, bodyMat, built.bodyCount]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={winRef}
        args={[built.winGeo, winMat, built.winCount]}
        frustumCulled={false}
      />
      <FrameOpacity body={bodyMat} win={winMat} eraIndex={eraIndex} />
    </group>
  )
}

/** Per-frame opacity ramp for this era's buildings. */
function FrameOpacity({
  body,
  win,
  eraIndex,
}: {
  body: THREE.MeshStandardMaterial
  win: THREE.MeshBasicMaterial
  eraIndex: number
}) {
  useFrame(() => {
    const a = variantAlpha(frame.progress, eraIndex)
    const tgt = a
    if (Math.abs(body.opacity - tgt) > 0.001 || tgt === 0 || tgt === 1) {
      body.opacity = tgt
      body.visible = tgt > 0.004
    }
    const winA = a * ERAS[eraIndex].buildings.windowIntensity
    if (Math.abs(win.opacity - winA) > 0.001 || winA === 0) {
      win.opacity = winA
      win.visible = winA > 0.004
    }
  })
  return null
}

export function Buildings() {
  return (
    <group>
      {ERAS.map((_, i) => (
        <EraBuildings key={i} eraIndex={i} />
      ))}
    </group>
  )
}
