/**
 * Continuous base scene: sky dome, ground, road grid, lights, fog.
 *
 * The meshes are static; their materials are driven by the SceneDriver each
 * frame (sky/ground colour, fog, light position/colour/intensity). Fog + tone
 * mapping exposure are applied here so they exist before the driver's first
 * frame.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { EXTENT, ROAD_COORDS, ROAD_HALF } from './layout'
import { roadMat, skyMat, planeGeo } from './factories'
import { sampleEraConfig } from '../era/interpolation'

const ROAD_WIDTH = ROAD_HALF * 2

export function SkySphere() {
  const geo = useMemo(() => new THREE.SphereGeometry(300, 32, 16), [])
  return <mesh geometry={geo} material={skyMat} />
}

export function Ground() {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x6a5a44,
        roughness: 0.97,
        metalness: 0,
      }),
    [],
  )
  return (
    <mesh
      geometry={planeGeo}
      material={mat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      scale={[EXTENT * 2 + 4, EXTENT * 2 + 4, 1]}
      receiveShadow
    />
  )
}

/** Curbs + sidewalks as a slightly raised tinted plane under the roads. */
export function Sidewalks() {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x8a8478,
        roughness: 0.95,
        metalness: 0,
      }),
    [],
  )
  return (
    <mesh
      geometry={planeGeo}
      material={mat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      scale={[EXTENT * 2, EXTENT * 2, 1]}
      receiveShadow
    />
  )
}

export function Roads() {
  const roads = useMemo(() => {
    const list: { x: number; z: number; w: number; d: number }[] = []
    for (const c of ROAD_COORDS) {
      list.push({ x: 0, z: c, w: EXTENT * 2, d: ROAD_WIDTH })
      list.push({ x: c, z: 0, w: ROAD_WIDTH, d: EXTENT * 2 })
    }
    return list
  }, [])

  const lineMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xf0e9c8,
        transparent: true,
        opacity: 0.45,
      }),
    [],
  )

  const dashes = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = []
    const step = 2.4
    for (const c of ROAD_COORDS) {
      for (let p = -EXTENT + step; p < EXTENT; p += step * 2) {
        out.push({ x: p, z: c, w: step * 0.6, d: 0.18 })
        out.push({ x: c, z: p, w: 0.18, d: step * 0.6 })
      }
    }
    return out
  }, [])

  return (
    <group>
      {roads.map((r, i) => (
        <mesh
          key={`r${i}`}
          geometry={planeGeo}
          material={roadMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[r.x, 0.05, r.z]}
          scale={[r.w, r.d, 1]}
          receiveShadow
        />
      ))}
      {dashes.map((d, i) => (
        <mesh
          key={`d${i}`}
          geometry={planeGeo}
          material={lineMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[d.x, 0.07, d.z]}
          scale={[d.w, d.d, 1]}
        />
      ))}
    </group>
  )
}

/**
 * Fog is applied to the scene object itself. We set it once here; the driver
 * mutates its color/near/far each frame.
 */
export function SceneFog() {
  const cfg = useMemo(() => sampleEraConfig(0), [])
  const fog = useMemo(
    () => new THREE.Fog(new THREE.Color(cfg.fogColor), cfg.fogNear, cfg.fogFar),
    [cfg.fogColor, cfg.fogNear, cfg.fogFar],
  )
  return <primitive object={fog} attach="fog" />
}
