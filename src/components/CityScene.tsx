import React, { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { useEraStore } from '../store/eraStore'
import { eraConfig } from '../utils/eraConfig'
import { clamp, lerp } from './cityUtils'
import { Building } from './Building'
import { Road } from './Road'
import { Vehicle } from './Vehicle'
import { Pedestrian } from './Pedestrian'

export function CityScene() {
  const { effectiveIndex } = useEraStore((s) => ({
    effectiveIndex: s.fromIndex + (s.toIndex - s.fromIndex) * s.progress,
  }))

  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const sceneFog = useMemo(() => new THREE.Color(eraLo.fog).lerp(new THREE.Color(eraHi.fog), t), [eraLo.fog, eraHi.fog, t])

  const dots = useMemo(() => {
    const seed = 42
    const count = 120
    const points: { p: THREE.Vector3; s: number }[] = []
    for (let i = 0; i < count; i++) {
      const r1 = (i * 9301 + seed) % 233280
      const r2 = (i * 49297 + seed) % 233280
      const r3 = (i * 233280 + seed) % 233280
      const u = r1 / 233280
      const v = r2 / 233280
      const w = r3 / 233280
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const radius = lerp(22, 28, w)
      const px = radius * Math.sin(phi) * Math.cos(theta)
      const py = lerp(6, 18, v)
      const pz = radius * Math.sin(phi) * Math.sin(theta)
      points.push({ p: new THREE.Vector3(px, py, pz), s: lerp(0.015, 0.05, w) })
    }
    return points
  }, [])

  const hemiSky = useMemo(() => new THREE.Color(eraLo.sky).lerp(new THREE.Color(eraHi.sky), t), [eraLo.sky, eraHi.sky, t])

  const hemiGround = useMemo(() => new THREE.Color('#02030a'), [])

  const dirIntensity = lerp(0.9, 0.25, clamp((clamped - 1) / 4, 0, 1))
  const ambientIntensity = lerp(0.45, 0.85, clamp((clamped - 2) / 3, 0, 1))

  const laterEraGlow = clamp((lo - 2) / 2, 0, 1)

  return (
    <group>
      <color attach="background" args={[hemiSky]} />
      <fog attach="fog" args={[sceneFog, 18, 55]} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[90, 36, 24]} />
        <meshBasicMaterial side={THREE.BackSide} color={hemiSky} transparent opacity={0.88} />
      </mesh>

      <hemisphereLight intensity={ambientIntensity} color={hemiSky} groundColor={hemiGround} />
      <directionalLight
        castShadow
        intensity={dirIntensity}
        position={[8, 18, 9]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      <ambientLight intensity={0.25} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        panSpeed={0.65}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={7}
        maxDistance={42}
      />

      <Road effectiveIndex={effectiveIndex} />

      <group>
        {[
          { x: -14, z: -16, w: 6.2, d: 3.1, h: 9.2, seed: 1 },
          { x: -10, z: -6, w: 5.3, d: 2.6, h: 8.4, seed: 2 },
          { x: -15, z: 5, w: 6.6, d: 3.0, h: 10.2, seed: 3 },
          { x: 11, z: -16, w: 5.6, d: 2.7, h: 8.7, seed: 4 },
          { x: 14, z: -5, w: 6.0, d: 2.9, h: 9.6, seed: 5 },
          { x: 10, z: 7, w: 5.2, d: 2.5, h: 8.0, seed: 6 },
        ].map((b, i) => (
          <Building key={i} x={b.x} z={b.z} seed={b.seed} effectiveIndex={effectiveIndex} size={{ w: b.w, d: b.d, maxH: b.h }} />
        ))}
      </group>

      <group>
        {[
          { laneX: -2.4, z: -18, idx: 1 },
          { laneX: -0.8, z: 2, idx: 2 },
          { laneX: 0.8, z: -4, idx: 3 },
          { laneX: 2.4, z: 18, idx: 4 },
        ].map((v, i) => (
          <Vehicle key={i} laneX={v.laneX} z={v.z} idx={v.idx} effectiveIndex={effectiveIndex} />
        ))}
      </group>

      <group>
        {[
          { x: -8.2, z: -22, idx: 1 },
          { x: -9.0, z: -5, idx: 2 },
          { x: -7.7, z: 10, idx: 3 },
          { x: 7.7, z: -18, idx: 4 },
          { x: 8.4, z: 0, idx: 5 },
          { x: 7.2, z: 14, idx: 6 },
        ].map((p, i) => (
          <Pedestrian key={i} x={p.x} z={p.z} idx={p.idx} effectiveIndex={effectiveIndex} />
        ))}
      </group>

      <group>
        {dots.map((d, i) => (
          <mesh key={i} position={d.p}>
            <sphereGeometry args={[d.s, 6, 6]} />
            <meshBasicMaterial
              color={new THREE.Color('#bdf3ff')}
              transparent
              opacity={0.55 * laterEraGlow}
            />
          </mesh>
        ))}
      </group>

      <EffectComposer multisampling={4}>
        <Bloom intensity={lerp(0.5, 1.4, clamp((clamped - 2) / 3, 0, 1))} luminanceThreshold={0.2} luminanceSmoothing={0.08} />
        <Noise opacity={0.08} />
        <Vignette eskil={false} offset={0.22} darkness={0.65} />
      </EffectComposer>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial
          color={new THREE.Color(120 / 255, 160 / 255, 255 / 255)}
          transparent
          opacity={lerp(0.08, 0.22, clamp((clamped - 1) / 4, 0, 1))}
          roughness={1}
          metalness={0.0}
        />
      </mesh>
    </group>
  )
}
