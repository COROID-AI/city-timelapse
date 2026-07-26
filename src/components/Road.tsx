import React, { useMemo } from 'react'
import * as THREE from 'three'
import { eraConfig } from '../utils/eraConfig'
import { clamp, lerp } from './cityUtils'

type RoadProps = {
  effectiveIndex: number
}

export function Road({ effectiveIndex }: RoadProps) {
  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const asphalt = new THREE.Color(eraLo.palette.base).lerp(new THREE.Color(eraHi.palette.base), t)
  const fog = new THREE.Color(eraLo.fog).lerp(new THREE.Color(eraHi.fog), t)

  const streetLightIntensity = lerp(0.15, 1.0, clamp((lo - 2) / 3 + t * 0.2, 0, 1))
  const streetLightColor = new THREE.Color(eraLo.streetLight).lerp(new THREE.Color(eraHi.streetLight), t)

  const groundGeometry = useMemo(() => new THREE.PlaneGeometry(55, 55, 1, 1), [])
  const laneGeometry = useMemo(() => new THREE.PlaneGeometry(50, 0.03), [])
  const lampPoleGeometry = useMemo(() => new THREE.CylinderGeometry(0.12, 0.14, 3.6, 6), [])
  const lampGlassGeometry = useMemo(() => new THREE.SphereGeometry(0.18, 12, 12), [])

  const groundMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: asphalt,
        roughness: 0.95,
        metalness: 0.02,
      }),
    [asphalt],
  )

  const laneMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 1, 1),
        roughness: 0.8,
        metalness: 0.02,
        emissive: new THREE.Color(0, 0, 0),
        emissiveIntensity: 0.0,
        transparent: true,
        opacity: 0.65,
      }),
    [],
  )

  const lampPoleMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(30 / 255, 30 / 255, 35 / 255), roughness: 0.7 }),
    [],
  )

  const lampGlassMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: streetLightColor,
      emissive: streetLightColor,
      emissiveIntensity: 1.2 * streetLightIntensity,
      transparent: true,
      opacity: 0.95,
    })
  }, [streetLightColor, streetLightIntensity])

  return (
    <group>
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={groundGeometry}
        material={groundMaterial}
      />

      <mesh
        position={[0, 0.02, -0.5]}
        rotation={[0, 0, 0]}
        geometry={laneGeometry}
        material={laneMaterial}
      />

      {Array.from({ length: 6 }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1
        const z = (i - 2.5) * 7
        const x = side * 10
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh castShadow geometry={lampPoleGeometry} material={lampPoleMaterial} position={[0, 1.8, 0]} />
            <mesh geometry={lampGlassGeometry} material={lampGlassMaterial} position={[0, 3.65, 0]} />
            <pointLight intensity={2.0 * streetLightIntensity} distance={10} color={fog.getStyle()} position={[0, 3.6, 0]} />
          </group>
        )
      })}
    </group>
  )
}
