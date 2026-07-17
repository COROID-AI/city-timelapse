/**
 * Street Props — era-appropriate street furniture: lamp posts, benches, trees,
 * fire hydrants, antennas, traffic signals. Each era has a visibly different
 * prop set (gas lamps → sodium → LED → smart → bio-luminescent). Built once as
 * InstancedMeshes and crossfaded by `variantAlpha`.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { EXTENT, ROAD_COORDS, ROAD_HALF, mulberry32 } from './layout'
import { frame } from './frameState'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

interface PropPlacement {
  x: number
  z: number
  rotY: number
}

/** Deterministic spots along sidewalk edges, shared across eras. */
const PROP_SPOTS: PropPlacement[] = (() => {
  const rng = mulberry32(4242)
  const out: PropPlacement[] = []
  for (let k = 1; k < ROAD_COORDS.length - 1; k++) {
    const c = ROAD_COORDS[k]
    for (let p = -EXTENT + 6; p < EXTENT; p += 9 + rng() * 3) {
      out.push({ x: p, z: c - ROAD_HALF - 0.9, rotY: 0 })
      out.push({ x: p, z: c + ROAD_HALF + 0.9, rotY: Math.PI })
      out.push({ x: c - ROAD_HALF - 0.9, z: p, rotY: Math.PI / 2 })
      out.push({ x: c + ROAD_HALF + 0.9, z: p, rotY: -Math.PI / 2 })
    }
  }
  return out
})()

interface TreeSpot {
  x: number
  z: number
}
const TREE_SPOTS: TreeSpot[] = (() => {
  const rng = mulberry32(7777)
  const out: TreeSpot[] = []
  for (let i = 0; i < 10; i++) {
    out.push({
      x: -EXTENT + 4 + rng() * (EXTENT * 2 - 8),
      z: -EXTENT + 4 + rng() * (EXTENT * 2 - 8),
    })
  }
  // keep trees out of road lanes
  return out.filter((t) => {
    for (const c of ROAD_COORDS) {
      if (Math.abs(t.x - c) < ROAD_HALF + 0.5) return false
      if (Math.abs(t.z - c) < ROAD_HALF + 0.5) return false
    }
    return true
  })
})()

interface PropData {
  lampGeo: THREE.CylinderGeometry
  benchGeo: THREE.BoxGeometry
  hydrantGeo: THREE.CylinderGeometry
  treeTrunkGeo: THREE.CylinderGeometry
  treeCrownGeo: THREE.IcosahedronGeometry
  count: number
  treeCount: number
}

function buildProps(_eraIndex: number): PropData {
  return {
    lampGeo: new THREE.CylinderGeometry(0.08, 0.12, 1, 8),
    benchGeo: new THREE.BoxGeometry(1, 1, 1),
    hydrantGeo: new THREE.CylinderGeometry(0.18, 0.22, 1, 8),
    treeTrunkGeo: new THREE.CylinderGeometry(0.16, 0.22, 1, 6),
    treeCrownGeo: new THREE.IcosahedronGeometry(1, 1),
    count: PROP_SPOTS.length,
    treeCount: TREE_SPOTS.length,
  }
}

function EraProps({ eraIndex }: { eraIndex: number }) {
  const data = useMemo(() => buildProps(eraIndex), [eraIndex])
  const lampRef = useRef<THREE.InstancedMesh>(null)
  const lampHeadRef = useRef<THREE.InstancedMesh>(null)
  const benchRef = useRef<THREE.InstancedMesh>(null)
  const hydrantRef = useRef<THREE.InstancedMesh>(null)
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)

  const era = ERAS[eraIndex]
  const lampEmissive =
    era.buildings.style === 'bio'
      ? 0x4affc0
      : eraIndex >= 4
        ? 0xcfeaff
        : eraIndex >= 2
          ? 0xffd28a
          : 0xffce8a

  const lampPoleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.6,
        metalness: 0.7,
        transparent: true,
        opacity: eraIndex === 0 ? 1 : 0,
      }),
    [eraIndex],
  )
  const lampHeadMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: lampEmissive,
        transparent: true,
        opacity: eraIndex === 0 ? 1 : 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eraIndex],
  )
  const benchMat = useMemo(() => {
    const isBio = era.buildings.style === 'bio'
    return new THREE.MeshStandardMaterial({
      color: isBio ? 0x4a6a4a : 0x6a5a44,
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraIndex])
  const hydrantMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xb23a2e,
        roughness: 0.5,
        metalness: 0.3,
        transparent: true,
        opacity: eraIndex === 0 ? 1 : 0,
      }),
    [eraIndex],
  )
  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x5a4434,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: eraIndex === 0 ? 1 : 0,
      }),
    [eraIndex],
  )
  const crownMat = useMemo(() => {
    // 1945/1965 sparse trees; later eras greener; 2055 luminous
    const green =
      era.buildings.style === 'bio'
        ? 0x3affa0
        : eraIndex <= 1
          ? 0x5a6a3a
          : 0x3a6a3a
    return new THREE.MeshStandardMaterial({
      color: green,
      roughness: 0.8,
      metalness: 0,
      emissive: new THREE.Color(
        era.buildings.style === 'bio' ? 0x1a4a2a : 0x000000,
      ),
      emissiveIntensity: era.buildings.style === 'bio' ? 0.6 : 0,
      transparent: true,
      opacity: eraIndex === 0 ? 1 : 0,
      flatShading: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eraIndex])

  const lampHeadGeo = useMemo(
    () => new THREE.SphereGeometry(0.22, 8, 8),
    [],
  )

  useLayoutEffect(() => {
    const lamp = lampRef.current
    const bench = benchRef.current
    const hydrant = hydrantRef.current
    const trunk = trunkRef.current
    const crown = crownRef.current
    const lampHead = lampHeadRef.current
    const rng = mulberry32(6000 + eraIndex * 53)

    if (lamp && lampHead) {
      for (let i = 0; i < PROP_SPOTS.length; i++) {
        const sp = PROP_SPOTS[i]
        _p.set(sp.x, 2.4, sp.z)
        _q.setFromAxisAngle(_up, sp.rotY)
        _s.set(1, 4.8, 1)
        _m.compose(_p, _q, _s)
        lamp.setMatrixAt(i, _m)
        // lamp head at top
        _p.set(sp.x, 4.9, sp.z)
        _s.set(1, 1, 1)
        _m.compose(_p, _q, _s)
        lampHead.setMatrixAt(i, _m)
      }
      lamp.instanceMatrix.needsUpdate = true
      lampHead.instanceMatrix.needsUpdate = true
    }

    if (bench) {
      let bi = 0
      for (const sp of PROP_SPOTS) {
        if (rng() > 0.3) continue
        _p.set(sp.x, 0.5, sp.z)
        _q.setFromAxisAngle(_up, sp.rotY)
        _s.set(2.2, 0.9, 0.7)
        _m.compose(_p, _q, _s)
        bench.setMatrixAt(bi, _m)
        bi++
      }
      bench.count = bi
      bench.instanceMatrix.needsUpdate = true
    }

    if (hydrant) {
      // hydrants only in earlier eras (phased out later)
      let hi = 0
      for (const sp of PROP_SPOTS) {
        if (rng() > 0.15) continue
        _p.set(sp.x + (rng() - 0.5), 0.35, sp.z + (rng() - 0.5))
        _q.identity()
        _s.set(1, 0.7, 1)
        _m.compose(_p, _q, _s)
        hydrant.setMatrixAt(hi, _m)
        hi++
      }
      hydrant.count = hi
      hydrant.instanceMatrix.needsUpdate = true
    }

    if (trunk && crown) {
      for (let i = 0; i < TREE_SPOTS.length; i++) {
        const t = TREE_SPOTS[i]
        _p.set(t.x, 1.6, t.z)
        _q.identity()
        _s.set(1, 3.2, 1)
        _m.compose(_p, _q, _s)
        trunk.setMatrixAt(i, _m)
        // crown
        _p.set(t.x, 3.8 + (rng() - 0.5), t.z)
        _s.set(1.8, 2.2, 1.8)
        _m.compose(_p, _q, _s)
        crown.setMatrixAt(i, _m)
      }
      trunk.instanceMatrix.needsUpdate = true
      crown.instanceMatrix.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useFrame(() => {
    const alpha = variantAlpha(frame.progress, eraIndex)
    // hydrants fade out in modern eras (phased out)
    const hydrantAlpha = alpha * (eraIndex <= 2 ? 1 : Math.max(0, 1 - (eraIndex - 2) * 0.5))
    // trees denser/greener in later eras
    const treeAlpha = alpha * (eraIndex <= 1 ? 0.5 : 1)

    const pulse = 0.85 + Math.sin(frame.time * 3 + eraIndex * 1.7) * 0.15
    for (const [mat, a] of [
      [lampPoleMat, alpha],
      [lampHeadMat, alpha * pulse],
      [benchMat, alpha],
      [hydrantMat, hydrantAlpha],
      [trunkMat, treeAlpha],
      [crownMat, treeAlpha],
    ] as const) {
      mat.opacity = a
      mat.visible = a > 0.01
    }
  })

  return (
    <group>
      <instancedMesh
        ref={lampRef}
        args={[data.lampGeo, lampPoleMat, data.count]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={lampHeadRef}
        args={[lampHeadGeo, lampHeadMat, data.count]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={benchRef}
        args={[data.benchGeo, benchMat, data.count]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={hydrantRef}
        args={[data.hydrantGeo, hydrantMat, data.count]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={trunkRef}
        args={[data.treeTrunkGeo, trunkMat, data.treeCount]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={crownRef}
        args={[data.treeCrownGeo, crownMat, data.treeCount]}
        castShadow
        frustumCulled={false}
      />
    </group>
  )
}

export function StreetProps() {
  return (
    <group>
      {ERAS.map((_, i) => (
        <EraProps key={i} eraIndex={i} />
      ))}
    </group>
  )
}
