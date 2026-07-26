import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { eraConfig } from '../utils/eraConfig'
import { clamp, lerp, makeCanvasSign } from './cityUtils'

type BuildingProps = {
  x: number
  z: number
  size: { w: number; d: number; maxH: number }
  seed: number
  effectiveIndex: number
}

export function Building({ x, z, size, seed, effectiveIndex }: BuildingProps) {
  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const yearInt = clamp(Math.round(clamped), 0, eraConfig.eras.length - 1)

  const height = lerp(
    size.maxH * (0.55 + eraLo.buildings * 0.08),
    size.maxH * (0.55 + eraHi.buildings * 0.08),
    t,
  )

  const winDensity = lerp(0.35 + eraLo.buildings * 0.12, 0.38 + eraHi.buildings * 0.15, t)
  const windowEmiss = lerp(0.12 + eraLo.buildings * 0.05, 0.35 + eraHi.buildings * 0.07, t)

  const facadeBase = useMemo(() => new THREE.Color(eraLo.palette.base).lerp(new THREE.Color(eraHi.palette.base), t), [eraLo.palette.base, eraHi.palette.base, t])
  const facadeAccent = useMemo(() => new THREE.Color(eraLo.palette.accent).lerp(new THREE.Color(eraHi.palette.accent), t), [eraLo.palette.accent, eraHi.palette.accent, t])
  const windowCol = useMemo(() => new THREE.Color(eraLo.palette.windows).lerp(new THREE.Color(eraHi.palette.windows), t), [eraLo.palette.windows, eraHi.palette.windows, t])
  const signGlow = useMemo(() => new THREE.Color(eraLo.sign.glow).lerp(new THREE.Color(eraHi.sign.glow), t), [eraLo.sign.glow, eraHi.sign.glow, t])

  const signIntensity = lerp(0.0, 1.0, clamp((lo - 2) / 3 + t * 0.4, 0, 1))

  const facadeGeometry = useMemo(() => new THREE.BoxGeometry(size.w, height, size.d), [size.w, size.d, height])
  const accentBandGeometry = useMemo(
    () => new THREE.BoxGeometry(size.w * 0.98, height * 0.12, size.d * 0.12),
    [size.w, size.d, height],
  )

  const roofCylinderGeometry = useMemo(
    () => new THREE.CylinderGeometry(size.w * 0.34, size.w * 0.55, height * 0.12, 4),
    [size.w, height],
  )
  const roofConeGeometry = useMemo(() => new THREE.ConeGeometry(size.w * 0.48, height * 0.16, 4), [size.w, height])

  const windowUnitGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const signPlaneGeometry = useMemo(() => new THREE.PlaneGeometry(1.35, 0.66), [])

  const matFacade = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeBase,
        roughness: 0.86,
        metalness: 0.08,
        envMapIntensity: 0.25,
      }),
    [facadeBase],
  )

  const matAccent = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeAccent,
        roughness: 0.55,
        metalness: 0.2,
        emissive: facadeAccent.clone().multiplyScalar(0.25),
        emissiveIntensity: 0.08,
      }),
    [facadeAccent],
  )

  const winMat = useMemo(() => {
    const emiss = windowCol.clone().multiplyScalar(0.9)
    return new THREE.MeshStandardMaterial({
      color: windowCol,
      roughness: 0.22,
      metalness: 0.02,
      emissive: emiss,
      emissiveIntensity: windowEmiss,
    })
  }, [windowCol, windowEmiss])

  const roofKind = yearInt // stable shape per year
  const roofOpacity = roofKind <= lo ? 0.8 : 1

  const roofMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeAccent,
        roughness: 0.55,
        metalness: 0.2,
        emissive: facadeAccent.clone().multiplyScalar(0.25),
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: roofOpacity,
      }),
    [facadeAccent, roofOpacity],
  )

  const windowInstances = useMemo(() => {
    const countX = 5 + Math.round(winDensity * 10)
    const countY = 7 + Math.round(winDensity * 8)
    const x0 = -size.w / 2 + 0.15
    const z0 = size.d / 2 - 0.05
    const wStep = (size.w - 0.3) / (countX - 1)
    const hStep = height / (countY + 1)

    const matrices: THREE.Matrix4[] = []
    for (let ix = 0; ix < countX; ix++) {
      for (let iy = 0; iy < countY; iy++) {
        const bx = x0 + ix * wStep + (seed % 3) * 0.02
        const by = -height / 2 + (iy + 1) * hStep
        const bz = z0
        const mat = new THREE.Matrix4()
        mat.compose(
          new THREE.Vector3(bx, by, bz),
          new THREE.Quaternion(),
          new THREE.Vector3(0.07, 0.035, 0.02),
        )
        matrices.push(mat)
      }
    }
    return matrices
  }, [height, seed, size.d, size.w, winDensity])

  const instancedRef = useRef<THREE.InstancedMesh | null>(null)
  useEffect(() => {
    if (!instancedRef.current) return
    const inst = instancedRef.current
    for (let i = 0; i < windowInstances.length; i++) {
      inst.setMatrixAt(i, windowInstances[i])
    }
    inst.instanceMatrix.needsUpdate = true
  }, [windowInstances])

  const signTexture = useMemo(() => {
    if (typeof document === 'undefined') return null

    const year = eraConfig.eras[yearInt]?.year ?? eraConfig.eras[0].year
    const accent = eraConfig.eras[yearInt]?.palette.accent ?? eraConfig.eras[0].palette.accent

    const top = year <= 1965 ? 'MARKET' : year <= 1985 ? 'EATERY' : year <= 2005 ? 'CITY' : year <= 2025 ? 'NOVA' : 'FUTURE'
    const bottom = year <= 1965 ? '1945-65' : year <= 1985 ? 'SOUND & STYLE' : year <= 2005 ? 'NOW OPEN' : year <= 2025 ? 'SIGNAGE' : '2055 EDITION'

    return makeCanvasSign(top, bottom, accent)
  }, [yearInt])

  const signMaterial = useMemo(() => {
    if (!signTexture) return null
    return new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.55,
      metalness: 0.06,
      emissive: signGlow,
      emissiveIntensity: 0.35 * signIntensity,
      transparent: true,
      opacity: 0.98,
    })
  }, [signGlow, signIntensity, signTexture])

  const groupRef = useRef<THREE.Group | null>(null)

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      <mesh material={matFacade} geometry={facadeGeometry} position={[0, height / 2, 0]} castShadow receiveShadow />

      <mesh
        material={matAccent}
        geometry={accentBandGeometry}
        position={[0, height * 0.62, size.d / 2 - size.d * 0.06]}
      />

      {roofKind % 2 === 0 ? (
        <mesh
          material={roofMat}
          geometry={roofCylinderGeometry}
          position={[0, height + height * 0.06, 0]}
        />
      ) : (
        <mesh
          material={roofMat}
          geometry={roofConeGeometry}
          position={[0, height + height * 0.08, 0]}
        />
      )}

      <instancedMesh
        ref={instancedRef}
        args={[windowUnitGeometry, winMat, windowInstances.length]}
        frustumCulled={false}
      />

      {signMaterial ? (
        <mesh
          position={[0, height * 0.56, size.d / 2 + 0.03]}
          material={signMaterial}
          geometry={signPlaneGeometry}
        />
      ) : null}
    </group>
  )
}
